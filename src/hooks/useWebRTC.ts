import { useCallback, useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import type { Instance } from "simple-peer";
import Peer from "simple-peer/simplepeer.min.js";
import { supabase } from "@/integrations/supabase/client";

type PeerInfo = { id: string; stream: MediaStream | null; name?: string };

export function useWebRTC(roomId: string, displayName: string, userId: string = "") {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Record<string, Instance>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const base = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    let cancelled = false;
    async function init() {
      let currentStream: MediaStream | undefined = undefined;

      try {
        // Try to get both video and audio
        currentStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) return;
        setLocalStream(currentStream);
        originalVideoTrackRef.current = currentStream.getVideoTracks()[0] || null;
      } catch (err: any) {
        console.warn("Failed to get video+audio, trying audio only", err);
        try {
          // Fallback to audio only
          currentStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (cancelled) return;
          setLocalStream(currentStream);
        } catch (err2) {
          console.error("Failed to get any media devices:", err2);
          // Last fallback: empty stream so signaling still works
          currentStream = new MediaStream();
          setLocalStream(currentStream);
        }
      }

      const socket = io(base, { transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
         setConnected(true);
         setConnectionStatus("connected");
      });
      
      socket.on("disconnect", () => {
         setConnected(false);
         setConnectionStatus("reconnecting");
      });

      socket.emit("join-room", { roomId, name: displayName, userId });

      socket.on("user-joined", ({ socketId, name: remoteName }) => {
        const peer = new Peer({ 
          initiator: true, 
          trickle: true, 
          stream: currentStream,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" }
            ]
          }
        });
        peersRef.current[socketId] = peer;
        setPeers((ps) => [...ps, { id: socketId, stream: null, name: remoteName || "Participant" }]);

        peer.on("signal", (data) => {
          socket.emit("signal", { to: socketId, data, name: displayName });
        });

        peer.on("stream", (remote) => {
          setPeers((ps) => ps.map((p) => (p.id === socketId ? { ...p, stream: remote } : p)));
        });

        peer.on("track", (track, stream) => {
          console.log(`Track received from ${socketId}: ${track.kind}`);
          setPeers((ps) => ps.map((p) => (p.id === socketId ? { ...p, stream: new MediaStream(stream.getTracks()) } : p)));
        });
      });

      socket.on("signal", ({ from, data, name: remoteName }) => {
        let peer = peersRef.current[from];
        if (!peer) {
          peer = new Peer({ 
            initiator: false, 
            trickle: true, 
            stream: currentStream,
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" }
              ]
            }
          });
          peersRef.current[from] = peer;
          setPeers((ps) => [...ps, { id: from, stream: null, name: remoteName || "Participant" }]);

          peer.on("signal", (s) => {
            socket.emit("signal", { to: from, data: s, name: displayName });
          });

          peer.on("stream", (remote) => {
            setPeers((ps) => ps.map((p) => (p.id === from ? { ...p, stream: remote } : p)));
          });

          peer.on("track", (track, stream) => {
            console.log(`Track received from ${from}: ${track.kind}`);
            setPeers((ps) => ps.map((p) => (p.id === from ? { ...p, stream: new MediaStream(stream.getTracks()) } : p)));
          });
        } else if (remoteName) {
           // Update name if we received it in a subsequent signal
           setPeers(ps => ps.map(p => p.id === from ? { ...p, name: remoteName } : p));
        }
        peer.signal(data);
      });

      socket.on("user-left", ({ socketId }) => {
        const peer = peersRef.current[socketId];
        if (peer) peer.destroy();
        delete peersRef.current[socketId];
        setPeers((ps) => ps.filter((p) => p.id !== socketId));
      });
    }

    init();

    return () => {
      cancelled = true;
      Object.values(peersRef.current).forEach((p) => p.destroy());
      peersRef.current = {};
      socketRef.current?.disconnect();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, displayName]);

  // Sync local stream tracks to all active peers when localStream changes OR when new peers join
  useEffect(() => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    const activePeers = Object.values(peersRef.current);
    activePeers.forEach((peer) => {
      try {
        const pc = (peer as any)._pc as RTCPeerConnection;
        if (!pc || pc.signalingState === "closed") return;
        
        const senders = pc.getSenders();
        
        if (videoTrack) {
          const vSender = senders.find(s => s.track && s.track.kind === 'video');
          if (vSender) {
            vSender.replaceTrack(videoTrack).catch(e => console.warn('Video track replace failed', e));
          } else {
            // If no sender exists yet, it might be a new peer waiting for negotiation
            try { (peer as any).addTrack(videoTrack, localStream); } catch {}
          }
        }
        
        if (audioTrack) {
          const aSender = senders.find(s => s.track && s.track.kind === 'audio');
          if (aSender) {
            aSender.replaceTrack(audioTrack).catch(e => console.warn('Audio track replace failed', e));
          } else {
            try { (peer as any).addTrack(audioTrack, localStream); } catch {}
          }
        }
      } catch (e) {
        console.warn('Failed to sync tracks to peer', e);
      }
    });

    console.log(`Synced tracks to ${activePeers.length} peers. V:${!!videoTrack} A:${!!audioTrack}`);
  }, [localStream, peers.length]);

  // Sync local hardware states to Supabase Room Participants table
  useEffect(() => {
    if (!roomId || !userId) return;

    const syncState = async () => {
      try {
        await supabase
          .from("room_participants")
          .update({
             mic_on: micOn,
             camera_on: camOn,
             screen_sharing: isScreenSharing,
             last_seen: new Date().toISOString()
          })
          .eq("room_id", roomId)
          .eq("user_id", userId);
      } catch (e) {
        console.warn("Failed to sync participant state", e);
      }
    };
    
    syncState();
  }, [micOn, camOn, isScreenSharing, roomId, userId]);

  const toggleMic = useCallback(() => {
    setMicOn((m) => {
      localStream?.getAudioTracks().forEach((t) => (t.enabled = !m));
      return !m;
    });
  }, [localStream]);

  const toggleCam = useCallback(() => {
    setCamOn((c) => {
      localStream?.getVideoTracks().forEach((t) => (t.enabled = !c));
      return !c;
    });
  }, [localStream]);

  const endCall = useCallback(() => {
    // Get current stream reference before any state changes
    const currentStream = localStream;
    
    try {
      // Stop all local tracks FIRST (camera and microphone)
      if (currentStream) {
        const tracks = currentStream.getTracks();
        tracks.forEach((track) => {
          try {
            console.log(`Stopping track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
            track.stop();
          } catch (e) {
            console.error('Error stopping track:', e);
          }
        });
      }
      
      // Also stop any original camera track if not part of current stream
      if (originalVideoTrackRef.current) {
        try {
          console.log('Stopping original video track');
          originalVideoTrackRef.current.stop();
        } catch {}
        originalVideoTrackRef.current = null;
      }

      // tear down peers
      Object.values(peersRef.current).forEach((p) => {
        try { p.destroy(); } catch {}
      });
      peersRef.current = {};
    } catch (e) {
      console.error('Error in endCall:', e);
    }
    
    // signal leave + fully detach socket
    try { socketRef.current?.emit("leave-room", { roomId }); } catch {}
    try {
      socketRef.current?.removeAllListeners?.();
      socketRef.current?.disconnect();
    } catch {}
    socketRef.current = null;
    setPeers([]);
    
    // Clear local stream state AFTER stopping tracks
    setLocalStream(null);
    setMicOn(true);
    setCamOn(true);
    setIsScreenSharing(false);
    
    console.log('End call completed');
  }, [roomId, localStream]);

  const screenShare = useCallback(async () => {
    if (!localStream) return;

    let displayStream: MediaStream;
    try {
      displayStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { displaySurface: "window" }, audio: false });
    } catch (e) {
      console.warn('Screen share declined', e);
      return;
    }

    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) return;

    // Save original cam track BEFORE replacing
    const origCamTrack = localStream.getVideoTracks()[0] ?? null;
    originalVideoTrackRef.current = origCamTrack;
    const audioTracks = localStream.getAudioTracks();

    // Replace video track in all peer senders
    Object.values(peersRef.current).forEach((peer) => {
      const sender = (peer as any)?._pc
        ?.getSenders?.()
        .find((s: RTCRtpSender) => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(screenTrack);
    });

    setLocalStream(new MediaStream([screenTrack, ...audioTracks]));
    setIsScreenSharing(true);

    screenTrack.onended = async () => {
      let camTrack = originalVideoTrackRef.current;

      // If original track is ended/dead, re-acquire camera
      if (!camTrack || camTrack.readyState === 'ended') {
        try {
          const fresh = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          camTrack = fresh.getVideoTracks()[0];
        } catch {
          camTrack = null;
        }
      }

      // Restore video track in all peers
      if (camTrack) {
        Object.values(peersRef.current).forEach((peer) => {
          const sender = (peer as any)?._pc
            ?.getSenders?.()
            .find((s: RTCRtpSender) => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(camTrack!);
        });
        setLocalStream(new MediaStream([camTrack, ...audioTracks]));
      }

      originalVideoTrackRef.current = null;
      setIsScreenSharing(false);
    };
  }, [localStream]);

  return { localStream, peers, connected, connectionStatus, micOn, camOn, isScreenSharing, toggleMic, toggleCam, screenShare, endCall };
}
