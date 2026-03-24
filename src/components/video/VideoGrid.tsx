import { useEffect, useRef, useState } from "react";
import { MicOff, Mic } from "lucide-react";

type PeerInfo = { id: string; stream: MediaStream | null; name?: string };

type Props = {
  localStream: MediaStream | null;
  peers: PeerInfo[];
  currentName: string;
  localMicOn?: boolean;
};

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
        for (let i = 0; i < length; i++) values += array[i];
        setIsSpeaking(values / length > 10);
      };
    } catch (e) {
      console.warn("Audio analysis failed", e);
    }

    return () => {
      if (javascriptNode) javascriptNode.disconnect();
      if (analyser) analyser.disconnect();
      if (microphone) microphone.disconnect();
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [stream]);

  return isSpeaking;
};

export default function VideoGrid({ localStream, peers, currentName, localMicOn = true }: Props) {
  const localParticipant = { id: 'local', stream: localStream, name: currentName + " (You)", isMuted: !localMicOn };

  // Determine Layout
  const mainParticipant = peers.length > 0 ? peers[0] : localParticipant;
  const smallParticipants = peers.length > 0 ? [localParticipant, ...peers.slice(1)] : [];

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Layout 1: Just Local */}
      {peers.length === 0 && (
        <div className="flex-1 w-full h-full">
          <PeerTile info={localParticipant} isMuted={!localMicOn} isMain={true} />
        </div>
      )}

      {/* Layout 2: Two Participants (50/50 Split) */}
      {peers.length === 1 && (
        <div className="flex-1 w-full h-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <PeerTile info={mainParticipant} isMain={true} />
          <PeerTile info={localParticipant} isMuted={!localMicOn} isMain={true} />
        </div>
      )}

      {/* Layout 3: Three or more (1 Main Stage, others in a bottom strip) */}
      {peers.length > 1 && (
        <div className="flex-1 w-full h-full flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <PeerTile info={mainParticipant} isMain={true} />
          </div>
          <div className="h-40 md:h-56 shrink-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-hidden">
            {smallParticipants.slice(0, 5).map(p => (
              <PeerTile key={p.id} info={p} isMuted={p.id === 'local' ? !localMicOn : undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeerTile({ info, isMain = false, isMuted }: { info: any, isMain?: boolean, isMuted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const isSpeaking = useActiveSpeaker(info.stream);
  
  const hasAudio = info.stream && info.stream.getAudioTracks().length > 0 && info.stream.getAudioTracks()[0].enabled;
  const hasVideo = info.stream && info.stream.getVideoTracks().length > 0 && info.stream.getVideoTracks()[0].enabled;
  
  const micOff = isMuted !== undefined ? isMuted : !hasAudio;

  useEffect(() => {
    if (!ref.current || !info.stream) {
      if (ref.current) ref.current.srcObject = null;
      return;
    }
    
    if (ref.current.srcObject !== info.stream) {
      ref.current.srcObject = info.stream;
      const playPromise = ref.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== "AbortError") console.warn("Video play error:", error);
        });
      }
    }
  }, [info.stream]);

  const wrapperClass = `
    relative overflow-hidden w-full h-full bg-[#161b22] flex items-center justify-center transition-all duration-500 ease-out group shadow-xl
    ${isMain ? 'rounded-[2.5rem]' : 'rounded-[2rem]'}
    ${isSpeaking && !micOff 
      ? 'scale-[1.02] ring-2 ring-[#9c48ea]/70 shadow-[0_0_40px_rgba(156,72,234,0.3)] z-10' 
      : 'ring-1 ring-white/5 hover:scale-[1.01] hover:brightness-110'
    }
  `;

  return (
    <div className={wrapperClass}>
      {hasVideo ? (
        <video 
          ref={ref} 
          autoPlay 
          playsInline 
          muted={info.id === 'local'} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" 
        />
      ) : (
        <div className="absolute inset-0 bg-[#0e0e0e] flex items-center justify-center opacity-90">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-extrabold text-white shadow-inner bg-gradient-to-tr from-[#9c48ea] to-[#3b82f6]">
            {info.name?.[0]?.toUpperCase() || 'P'}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 flex items-center gap-3 bg-[#0a0a0a]/60 backdrop-blur-2xl px-4 py-2 rounded-full border border-white/5 shadow-lg group-hover:bg-[#0a0a0a]/80 transition-colors">
        <span className="text-sm font-bold text-white tracking-wide truncate max-w-[150px] sm:max-w-xs drop-shadow-md">
          {info.name || "Participant"}
        </span>
      </div>

      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 rounded-full bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/5 shadow-lg transition-transform group-hover:scale-110">
        {!micOff ? (
          <div className="relative">
             <Mic className={`h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]`} />
             {isSpeaking && (
               <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400/40"></span>
             )}
          </div>
        ) : (
          <MicOff className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400" />
        )}
      </div>
    </div>
  );
}
