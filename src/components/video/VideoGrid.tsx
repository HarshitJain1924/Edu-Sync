import { useEffect, useRef, useState } from "react";
import { MicOff, Mic } from "lucide-react";

type PeerInfo = { id: string; stream: MediaStream | null; name?: string };

type Props = {
  localStream: MediaStream | null;
  peers: PeerInfo[];
  currentName: string;
  localMicOn?: boolean;
};

// Helper to continuously check audio volume and return if someone is speaking
const useActiveSpeaker = (stream: MediaStream | null) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setIsSpeaking(false);
      return;
    }

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let microphone: MediaStreamAudioSourceNode;
    let javascriptNode: ScriptProcessorNode;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      microphone = audioContext.createMediaStreamSource(stream);
      javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      javascriptNode.connect(audioContext.destination);

      javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;

        const length = array.length;
        for (let i = 0; i < length; i++) {
          values += array[i];
        }

        const average = values / length;
        // Threshold for speaking
        setIsSpeaking(average > 10);
      };
    } catch (e) {
      console.warn("Audio analysis failed", e);
    }

    return () => {
      if (javascriptNode) javascriptNode.disconnect();
      if (analyser) analyser.disconnect();
      if (microphone) microphone.disconnect();
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [stream]);

  return isSpeaking;
};

export default function VideoGrid({ localStream, peers, currentName, localMicOn = true }: Props) {
  const localRef = useRef<HTMLVideoElement>(null);
  const isLocalSpeaking = useActiveSpeaker(localStream);

  useEffect(() => {
    if (!localRef.current) return;
    if (localStream) {
      localRef.current.srcObject = localStream;
      try { localRef.current.play(); } catch {}
    } else {
      const videoEl = localRef.current;
      try {
        videoEl.pause();
        const currentStream = videoEl.srcObject as MediaStream;
        if (currentStream) {
          currentStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
        }
        videoEl.srcObject = null;
        videoEl.load();
      } catch (e) {}
    }
  }, [localStream]);

  // Determine grid columns dynamically
  const totalParticipants = peers.length + 1;
  let gridClass = "grid-cols-1";
  if (totalParticipants === 2) gridClass = "grid-cols-1 sm:grid-cols-2";
  else if (totalParticipants >= 3 && totalParticipants <= 4) gridClass = "grid-cols-2";
  else if (totalParticipants >= 5) gridClass = "grid-cols-2 md:grid-cols-3";

  // Check if camera is disabled locally
  const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0 && localStream.getVideoTracks()[0].enabled;

  return (
    <div className={`grid ${gridClass} gap-4 w-full h-full min-h-[400px]`}>
      {/* Local Video Tile */}
      <div className={`relative rounded-xl overflow-hidden bg-slate-900 border-2 transition-colors duration-300 shadow-lg ${isLocalSpeaking && localMicOn ? 'border-primary shadow-primary/30 shadow-xl' : 'border-border/50'}`}>
        {hasLocalVideo ? (
           <video ref={localRef} autoPlay playsInline muted className="w-full h-full object-cover aspect-video" />
        ) : (
           <div className="w-full h-full flex items-center justify-center bg-slate-800 aspect-video">
             <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-bold text-white/50">
               {currentName[0]?.toUpperCase() || 'U'}
             </div>
           </div>
        )}
        
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
          <span className="text-sm font-medium text-white">{currentName} (You)</span>
        </div>
        
        <div className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
          {localMicOn ? <Mic className={`h-4 w-4 text-emerald-400 ${isLocalSpeaking ? 'animate-pulse-mic' : ''}`} /> : <MicOff className="h-4 w-4 text-red-400" />}
        </div>
      </div>

      {/* Remote Video Tiles */}
      {peers.map((p) => (
        <PeerTile key={p.id} info={p} />
      ))}
    </div>
  );
}

function PeerTile({ info }: { info: PeerInfo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const isSpeaking = useActiveSpeaker(info.stream);
  
  // Audio state - if no audio tracks or disabled
  const hasAudio = info.stream && info.stream.getAudioTracks().length > 0 && info.stream.getAudioTracks()[0].enabled;
  const hasVideo = info.stream && info.stream.getVideoTracks().length > 0 && info.stream.getVideoTracks()[0].enabled;

  useEffect(() => {
    if (ref.current && info.stream) {
      ref.current.srcObject = info.stream;
      try { ref.current.play(); } catch {}
    }
  }, [info.stream]);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-slate-900 border-2 transition-colors duration-300 shadow-lg ${isSpeaking && hasAudio ? 'border-primary shadow-primary/30 shadow-xl' : 'border-border/50'}`}>
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover aspect-video" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800 aspect-video">
          <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-bold text-white/50">
            {info.name?.[0]?.toUpperCase() || 'P'}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
        <span className="text-sm font-medium text-white line-clamp-1">{info.name || "Participant"}</span>
      </div>

      <div className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
        {hasAudio ? <Mic className={`h-4 w-4 text-emerald-400 ${isSpeaking ? 'animate-pulse-mic' : ''}`} /> : <MicOff className="h-4 w-4 text-red-400" />}
      </div>
    </div>
  );
}
