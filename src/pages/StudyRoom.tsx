import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Video, Mic, Users, ArrowLeft, MessageSquare, MonitorUp, PhoneOff, Copy, Edit3, MicOff, VideoOff, Crown, Timer, Square, MoreVertical, Hand, Download, Upload, Lock, Unlock, FileText, BookOpen, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { messageSchema } from "@/lib/validations";
import { z } from 'zod';
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoGrid from "@/components/video/VideoGrid";
import Whiteboard from "@/components/video/Whiteboard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  message: string;
  created_at: string;
  profiles: { username: string };
  user_id: string;
}

interface Participant {
  id: string;
  is_online: boolean;
  user_id: string;
  mic_on: boolean;
  camera_on: boolean;
  screen_sharing: boolean;
  role: string;
  hand_raised: boolean;
  profiles: { username: string };
}

interface Material {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
}

interface ScreenRequest {
  userId: string;
  username: string;
}

const ensureProfileExists = async (user: any) => {
  if (!user?.id) return;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (error && !["PGRST116", "406"].includes((error as any).code)) {
      console.warn("Failed to check profile existence", error);
    }

    if (!data) {
      const username =
        user.user_metadata?.username ||
        (typeof user.email === "string" ? user.email.split("@")[0] : "Student");

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        username,
      });

      if (insertError && (insertError as any).code !== "23505") {
        console.error("Failed to create profile row", insertError);
      }
    }
  } catch (e) {
    console.error("ensureProfileExists unexpected error", e);
  }
};

export default function StudyRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("You");
  
  const [roomName, setRoomName] = useState("");
  const [hostId, setHostId] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [globalRole, setGlobalRole] = useState<string>("student");
  const [myRole, setMyRole] = useState<'teacher' | 'student'>('student');
  
  // Derivation: You are a room teacher if the guest list says so
  const isRoomTeacher = myRole === 'teacher';
  const isTeacher = isRoomTeacher; // For backwards compat in JSX


  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'people' | 'materials'>('chat');
  
  // Timer State
  const [timerMode, setTimerMode] = useState<'idle' | 'study' | 'break'>('idle');
  const [timeLeft, setTimeLeft] = useState(0);

  // Classroom-specific state
  const [allowStudentDrawing, setAllowStudentDrawing] = useState(false);
  const [pendingScreenRequest, setPendingScreenRequest] = useState<ScreenRequest | null>(null);
  const [screenApproved, setScreenApproved] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionChannelRef = useRef<any>(null);

  useEffect(() => { checkAuth(); }, []);

  const { localStream, peers, connectionStatus, micOn, camOn, toggleMic, toggleCam, isScreenSharing, screenShare, endCall } = useWebRTC(roomId || "", displayName, currentUser?.id);

  // Participant Join Toast
  const prevParticipantsRef = useRef<Participant[]>([]);
  useEffect(() => {
    if (prevParticipantsRef.current.length > 0) {
      const newPs = participants.filter(p => !prevParticipantsRef.current.find(pp => pp.user_id === p.user_id));
      newPs.forEach(p => {
        if (p.user_id !== currentUser?.id) {
          toast({ title: `${p.profiles?.username || 'A user'} joined`, className: "bg-emerald-600 text-white border-none" });
        }
      });
    }
    prevParticipantsRef.current = participants;

    // ✅ Sync myRole with the actual record in participants list
    if (currentUser && participants.length > 0) {
      const me = participants.find(p => p.user_id === currentUser.id);
      if (me && me.role && (me.role === 'teacher' || me.role === 'student')) {
        if (me.role !== myRole) {
          console.log(`Syncing role to: ${me.role}`);
          setMyRole(me.role as 'teacher' | 'student');
        }
      }
    }
  }, [participants, currentUser, toast, myRole]);

  useEffect(() => {
    if (roomId && currentUser) {
      setDisplayName(currentUser.user_metadata?.username || currentUser.email || "You");
      fetchRoomDetails();
      fetchMessages();
      fetchParticipants();
      fetchMaterials();
      
      const messagesChannel = subscribeToMessages();
      const participantsChannel = subscribeToParticipants();
      const actionChannel = subscribeToActions();
      actionChannelRef.current = actionChannel;

      ensureParticipantRecord();

      return () => {
        if (messagesChannel) supabase.removeChannel(messagesChannel);
        if (participantsChannel) supabase.removeChannel(participantsChannel);
        if (actionChannel) supabase.removeChannel(actionChannel);
      };
    }
  }, [roomId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Timer Countdown
  useEffect(() => {
    if (timerMode === 'idle' || timeLeft <= 0) {
      if (timeLeft === 0 && timerMode !== 'idle') {
        toast({ title: timerMode === 'study' ? "Study session complete! Take a break." : "Break over! Back to focus." });
        setTimerMode('idle');
      }
      return;
    }
    const t = setInterval(() => setTimeLeft(l => l - 1), 1000);
    return () => clearInterval(t);
  }, [timerMode, timeLeft]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    } else {
      setCurrentUser(user);
      await ensureProfileExists(user);
      // Fetch global role from user_roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleData?.role) setGlobalRole(roleData.role);
    }
  };

  const ensureParticipantRecord = async () => {
    if (!currentUser || !roomId) return;
    try {
      await ensureProfileExists(currentUser);
      // 1. Fetch room details
      const { data: roomData } = await supabase
        .from('study_rooms')
        .select('created_by, host_id')
        .eq('id', roomId)
        .single();

      // 2. Fetch global role explicitly to avoid state race conditions on re-entry
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      
      const currentGlobalRole = roleData?.role || globalRole || 'student';
      const isOwner = roomData?.created_by === currentUser.id || roomData?.host_id === currentUser.id;
      const isGlobalTeacher = currentGlobalRole === 'teacher' || currentGlobalRole === 'admin';
      const role = (isOwner || isGlobalTeacher) ? 'teacher' : 'student';

      const { data: existing } = await supabase
        .from('room_participants')
        .select('id, role')
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('room_participants').insert({
          room_id: roomId,
          user_id: currentUser.id,
          is_online: true,
          role,
          joined_at: new Date().toISOString()
        });
        setMyRole(role);
      } else {
        // Upsert online status and enforce 'teacher' role for owners/admins
        const finalRole = (isOwner || isGlobalTeacher) ? 'teacher' : (existing.role || 'student');
        await supabase.from('room_participants')
          .update({ is_online: true, role: finalRole })
          .eq('id', existing.id);
        setMyRole(finalRole as 'teacher' | 'student');
      }
    } catch(e) { console.error('ensureParticipantRecord error', e); }
  };

  const fetchRoomDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("study_rooms")
        .select("name, host_id, created_by, allow_student_drawing")
        .eq("id", roomId)
        .single();
      if (error) throw error;
      setRoomName(data.name);
      const ownerId = data.host_id || data.created_by;
      setHostId(data.host_id || null);
      setCreatedBy(data.created_by || null);
      setAllowStudentDrawing(data.allow_student_drawing ?? false);

      // ✅ Set role IMMEDIATELY from room ownership
      if (ownerId === currentUser?.id) {
        setMyRole('teacher');
      }
    } catch (e) {
      console.error('fetchRoomDetails error', e);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("room_messages")
        .select(`id, message, created_at, user_id, profiles:user_id (username)`)
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const mapped = data.map((m: any) => ({
          ...m,
          profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles || { username: 'Unknown' }
        }));
        setMessages(mapped);
      }
    } catch {}
  };

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("room_participants")
        .select(`id, is_online, user_id, mic_on, camera_on, screen_sharing, role, hand_raised, profiles:user_id (username)`)
        .eq("room_id", roomId);
      if (!error && data) {
        const mapped = data.map((p: any) => ({
          ...p,
          profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles || { username: 'Unknown' }
        }));
        setParticipants(mapped);
      }
    } catch {}
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("session_materials")
        .select("id, title, file_url, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      if (!error) setMaterials(data || []);
    } catch {}
  };

  const subscribeToMessages = () => {
    return supabase.channel(`room_messages:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, fetchMessages)
      .subscribe();
  };

  const subscribeToParticipants = () => {
    return supabase.channel(`room_participants_live:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` }, fetchParticipants)
      .subscribe();
  };

  const subscribeToActions = () => {
    const chan = supabase.channel(`room_actions:${roomId}`, { config: { broadcast: { self: false } } });
    
    chan.on('broadcast', { event: 'typing' }, ({ payload }) => {
      setTypingUsers(prev => new Set(prev).add(payload.username));
      setTimeout(() => setTypingUsers(prev => { const n = new Set(prev); n.delete(payload.username); return n; }), 3000);
    });

    chan.on('broadcast', { event: 'host_action' }, async ({ payload }) => {
      if (payload.target === currentUser?.id) {
        if (payload.action === 'mute' && micOn) toggleMic();
        if (payload.action === 'remove') {
          toast({ title: "You were removed from the room", variant: "destructive" });
          await handleLeaveRoom();
        }
      }
      if (payload.action === 'end_all') {
        toast({ title: "The teacher ended the session." });
        await handleLeaveRoom();
      }
    });

    // Student screen share request → teacher sees popup
    chan.on('broadcast', { event: 'screen_request' }, ({ payload }) => {
      if (myRole === 'teacher') {
        setPendingScreenRequest({ userId: payload.userId, username: payload.username });
      }
    });

    // Teacher response to screen share request
    chan.on('broadcast', { event: 'screen_approved' }, ({ payload }) => {
      if (payload.target === currentUser?.id) {
        setScreenApproved(true);
        toast({ title: "✅ Teacher approved your screen share!", className: "bg-emerald-600 text-white border-none" });
        // Auto-invoke screen share now
        screenShare();
      }
    });

    chan.on('broadcast', { event: 'screen_rejected' }, ({ payload }) => {
      if (payload.target === currentUser?.id) {
        toast({ title: "Screen share request was declined.", variant: "destructive" });
      }
    });

    // Whiteboard drawing permission toggle
    chan.on('broadcast', { event: 'whiteboard_permission' }, ({ payload }) => {
      setAllowStudentDrawing(payload.allowed);
      if (!payload.allowed) {
        toast({ title: "🔒 Teacher disabled student drawing" });
      } else {
        toast({ title: "✏️ Teacher enabled student drawing", className: "bg-blue-600 text-white border-none" });
      }
    });

    // Raise hand notification for teacher
    chan.on('broadcast', { event: 'raise_hand' }, ({ payload }) => {
      if (myRole === 'teacher') {
        toast({
          title: `✋ ${payload.username} raised their hand`,
          description: "You can unmute them or allow screen share.",
          className: "bg-amber-600 text-white border-none",
        });
      }
    });

    // Materials updated
    chan.on('broadcast', { event: 'materials_updated' }, fetchMaterials);

    chan.subscribe();
    return chan;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUser) return;
    try {
      const validated = messageSchema.parse({ message });
      await supabase.from("room_messages").insert({ room_id: roomId, user_id: currentUser.id, message: validated.message });
      setMessage("");
    } catch {}
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (!typingTimeoutRef.current) {
      supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'typing', payload: { username: displayName } });
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
    }
  };

  const handleLeaveRoom = async () => {
    endCall();
    if (currentUser) {
      // Mark as offline instead of deleting
      await supabase.from("room_participants")
        .update({ is_online: false })
        .eq("room_id", roomId)
        .eq("user_id", currentUser.id);
    }
    navigate("/study-rooms");
  };

  // --- Teacher Controls ---
  const teacherMuteUser = (userId: string) => {
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'host_action', payload: { action: 'mute', target: userId } });
    toast({ title: "Participant muted" });
  };

  const teacherRemoveUser = (userId: string) => {
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'host_action', payload: { action: 'remove', target: userId } });
  };

  const teacherEndSession = async () => {
    try {
      // 1. Mark room as inactive in DB so it doesn't show in lists
      await supabase.from('study_rooms').update({ is_active: false }).eq('id', roomId);
      
      // 2. Broadcast to others
      supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'host_action', payload: { action: 'end_all' } });
      
      // 3. Leave
      handleLeaveRoom();
    } catch (err) {
      console.error("Failed to end session", err);
      handleLeaveRoom(); // Leave anyway
    }
  };

  const toggleWhiteboardPermission = async () => {
    const newVal = !allowStudentDrawing;
    setAllowStudentDrawing(newVal);
    await supabase.from('study_rooms').update({ allow_student_drawing: newVal }).eq('id', roomId);
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'whiteboard_permission', payload: { allowed: newVal } });
  };

  const approveScreenShare = (userId: string) => {
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'screen_approved', payload: { target: userId } });
    setPendingScreenRequest(null);
    toast({ title: "Screen share approved" });
  };

  const rejectScreenShare = (userId: string) => {
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'screen_rejected', payload: { target: userId } });
    setPendingScreenRequest(null);
  };

  const handleUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setIsUploading(true);
    try {
      const filePath = `${roomId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('session-materials').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('session-materials').getPublicUrl(filePath);

      await supabase.from('session_materials').insert({
        room_id: roomId,
        uploaded_by: currentUser.id,
        title: file.name,
        file_url: publicUrl,
      });

      supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'materials_updated', payload: {} });
      await fetchMaterials();
      toast({ title: `📎 ${file.name} uploaded!`, className: "bg-emerald-600 text-white border-none" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Student Actions ---
  const raiseHand = async () => {
    if (!currentUser) return;
    await supabase.from('room_participants').update({ hand_raised: true }).eq('room_id', roomId).eq('user_id', currentUser.id);
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'raise_hand', payload: { username: displayName, userId: currentUser.id } });
    toast({ title: "✋ Hand raised! Teacher has been notified." });
  };

  const lowerHand = async () => {
    if (!currentUser) return;
    await supabase.from('room_participants').update({ hand_raised: false }).eq('room_id', roomId).eq('user_id', currentUser.id);
  };

  const requestScreenShare = () => {
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'screen_request', payload: { userId: currentUser?.id, username: displayName } });
    toast({ title: "📤 Screen share request sent to teacher." });
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Invite link copied!" });
  };

  const startTimer = (mins: number, mode: 'study' | 'break') => {
    setTimerMode(mode);
    setTimeLeft(mins * 60);
    // Broadcast timer start to all students
    supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'host_action', payload: { action: 'timer_start', mins, timerMode: mode } });
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const raisedHands = participants.filter(p => p.hand_raised && p.user_id !== currentUser?.id);

  const myHandRaised = participants.find(p => p.user_id === currentUser?.id)?.hand_raised ?? false;

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-[#0f111a] text-slate-900 dark:text-white overflow-hidden transition-colors duration-500">
      {isTeacher && pendingScreenRequest && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-amber-400/50 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 min-w-[300px]">
          <p className="font-semibold text-amber-300">📡 Screen Share Request</p>
          <p className="text-sm text-gray-300"><strong>{pendingScreenRequest.username}</strong> wants to share their screen.</p>
          <div className="flex gap-3 mt-1">
            <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => approveScreenShare(pendingScreenRequest.userId)}>
              ✅ Approve
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => rejectScreenShare(pendingScreenRequest.userId)}>
              ❌ Reject
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 bg-slate-100 dark:bg-[#161b22] border-b border-slate-300 dark:border-white/10 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleLeaveRoom} className="hover:bg-slate-200 dark:hover:bg-white/10 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold truncate max-w-[200px] sm:max-w-md">{roomName || "Classroom"}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold tracking-wider uppercase ${connectionStatus === 'connected' ? 'text-emerald-400' : connectionStatus === 'reconnecting' ? 'text-yellow-400' : 'text-red-400'}`}>
                {connectionStatus === 'connected' ? '🟢 LIVE' : connectionStatus === 'reconnecting' ? '🟡 RECONNECTING' : '🔴 DISCONNECTED'}
              </span>
              <Badge variant="outline" className={`text-xs ml-2 ${isTeacher ? 'border-amber-400 text-amber-400' : 'border-blue-400 text-blue-400'}`}>
                {isTeacher ? '👑 Teacher' : '🎓 Student'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {timerMode !== 'idle' && (
            <div className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-mono font-bold ${timerMode === 'study' ? 'bg-blue-500/10 border-blue-400/30 text-blue-400' : 'bg-green-500/10 border-green-400/30 text-green-400'}`}>
              <Timer className="h-4 w-4" />
              {timerMode.toUpperCase()}: {formatTimer(timeLeft)}
              <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => setTimerMode('idle')}>
                <Square className="h-3 w-3" />
              </Button>
            </div>
          )}
          {isTeacher && raisedHands.length > 0 && (
            <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse">
              <Hand className="h-3 w-3" />
              {raisedHands.length} hand{raisedHands.length > 1 ? 's' : ''} raised
            </div>
          )}
          <Button size="sm" onClick={copyInvite} className="hidden sm:flex gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none">
            <Copy className="h-4 w-4" /> Invite
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Stage Area */}
        <div className="flex-1 p-4 flex flex-col min-h-0 relative">
          <div className="flex-1 bg-slate-200 dark:bg-[#1c212b] rounded-2xl overflow-hidden shadow-2xl border border-slate-300 dark:border-white/5 flex items-center justify-center relative">
            {showWhiteboard ? (
              <Whiteboard roomId={roomId || ''} userId={currentUser?.id} isReadOnly={!isTeacher && !allowStudentDrawing} />
            ) : (
              <div className="w-full h-full p-2">
                <VideoGrid localStream={localStream} peers={peers} currentName={displayName} localMicOn={micOn} />
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          <div className="h-20 shrink-0 mt-4 bg-slate-100 dark:bg-[#161b22] border border-slate-300 dark:border-white/10 rounded-2xl flex items-center justify-center gap-3 md:gap-5 px-4 shadow-xl">
            <Button size="icon" className={`h-12 w-12 rounded-full ${micOn ? 'bg-slate-300 text-slate-900 hover:bg-slate-400 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600 text-white'}`} onClick={toggleMic}>
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            <Button size="icon" className={`h-12 w-12 rounded-full ${camOn ? 'bg-slate-300 text-slate-900 hover:bg-slate-400 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600 text-white'}`} onClick={toggleCam}>
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            {/* Screen Share: teacher does it directly, student sends request */}
            {isTeacher ? (
              <Button size="icon" className={`h-12 w-12 rounded-full ${isScreenSharing ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-slate-300 text-slate-900 hover:bg-slate-400 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'}`} onClick={screenShare} title="Share Screen">
                <MonitorUp className="h-5 w-5" />
              </Button>
            ) : (
              <Button size="icon" className="h-12 w-12 rounded-full bg-slate-300 text-slate-900 hover:bg-amber-600 hover:text-white dark:bg-slate-700 dark:text-white" onClick={requestScreenShare} title="Request Screen Share">
                <MonitorUp className="h-5 w-5" />
              </Button>
            )}

            <div className="w-[1px] h-8 bg-slate-300 dark:bg-white/10 mx-1" />

            <Button size="icon" className={`h-12 w-12 rounded-full ${showWhiteboard ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-300 text-slate-900 hover:bg-slate-400 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'}`} onClick={() => setShowWhiteboard(s => !s)} title="Toggle Whiteboard">
              <Edit3 className="h-5 w-5" />
            </Button>

            {/* Student: Raise Hand */}
            {!isTeacher && (
              <Button size="icon" className={`h-12 w-12 rounded-full ${myHandRaised ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-300 text-slate-900 hover:bg-slate-400 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'}`} onClick={myHandRaised ? lowerHand : raiseHand} title={myHandRaised ? 'Lower Hand' : 'Raise Hand'}>
                <Hand className="h-5 w-5" />
              </Button>
            )}

            <Button size="icon" className="h-12 w-[80px] rounded-full bg-red-600 hover:bg-red-700 ml-2 hidden sm:flex" onClick={handleLeaveRoom}>
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-80 h-full bg-slate-100 dark:bg-[#161b22] border-l border-slate-300 dark:border-white/10 flex flex-col shrink-0">
          <div className="flex border-b border-slate-300 dark:border-white/10 shrink-0">
            <button className={`flex-1 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'chat' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-400/5' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('chat')}>
              <MessageSquare className="h-4 w-4" /> Chat
            </button>
            <button className={`flex-1 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'people' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-400/5' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('people')}>
              <Users className="h-4 w-4" /> People ({participants.filter(p => p.is_online).length})
            </button>
            <button className={`flex-1 py-3 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'materials' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-400/5' : 'text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('materials')}>
              <FileText className="h-4 w-4" /> Notes
            </button>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-[#0f111a]">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg, idx) => {
                    const isMe = msg.user_id === currentUser?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-sm'}`}>
                          {!isMe && <p className="text-xs font-semibold text-blue-300 mb-0.5">{msg.profiles?.username || 'User'}</p>}
                          <p className="text-sm text-inherit break-words">{msg.message}</p>
                          <p className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5 text-right">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })}
                  {[...typingUsers].length > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-slate-200 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-slate-600 dark:text-gray-400 italic">
                        {[...typingUsers].join(', ')} typing...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-slate-300 dark:border-white/10 shrink-0">
                <form className="flex gap-2" onSubmit={handleSendMessage}>
                  <Input
                    value={message}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    className="flex-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-full text-sm"
                    autoComplete="off"
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* People Tab */}
          {activeTab === 'people' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Teacher Controls Panel */}
              {isTeacher && (
                <div className="p-3 border-b border-slate-300 dark:border-white/10 bg-amber-500/5 space-y-2 shrink-0">
                  <p className="text-xs text-amber-400 font-bold tracking-wider uppercase flex items-center gap-1"><Crown className="h-3 w-3" /> Teacher Controls</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="text-xs border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => startTimer(25, 'study')}>
                      <Timer className="h-3 w-3 mr-1" /> 25m Focus
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => startTimer(5, 'break')}>
                      <Timer className="h-3 w-3 mr-1" /> 5m Break
                    </Button>
                    <Button size="sm" variant="outline" className={`text-xs col-span-2 border-slate-300 dark:border-white/10 ${allowStudentDrawing ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-400/30' : 'bg-white dark:bg-white/5'}`} onClick={toggleWhiteboardPermission}>
                      {allowStudentDrawing ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                      {allowStudentDrawing ? 'Disable Student Drawing' : 'Allow Student Drawing'}
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs col-span-2" onClick={teacherEndSession}>
                      End Session for All
                    </Button>
                  </div>
                </div>
              )}

              {/* Student Panel (visible only to students) */}
              {!isTeacher && (
                <div className="p-3 border-b border-slate-300 dark:border-white/10 bg-blue-500/5 space-y-2 shrink-0">
                  <p className="text-xs text-blue-400 font-bold tracking-wider uppercase flex items-center gap-1"><BookOpen className="h-3 w-3" /> Student Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className={`text-xs border-slate-300 dark:border-white/10 ${myHandRaised ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-400/30' : 'bg-white dark:bg-white/5'}`} onClick={myHandRaised ? lowerHand : raiseHand}>
                      <Hand className="h-3 w-3 mr-1" />{myHandRaised ? 'Lower Hand' : 'Raise Hand'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs border-slate-300 dark:border-white/10 bg-white dark:bg-white/5" onClick={requestScreenShare}>
                      <MonitorUp className="h-3 w-3 mr-1" /> Share Screen
                    </Button>
                  </div>
                  {!allowStudentDrawing && (
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-1">🔒 Whiteboard is read-only — teacher controls drawing</p>
                  )}
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {participants.map(p => {
                    const isMe = p.user_id === currentUser?.id;
                    const isParticipantTeacher = p.role === 'teacher';
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
                            {p.profiles?.username?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#161b22] ${p.is_online ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{p.profiles?.username || 'User'}{isMe ? ' (you)' : ''}</span>
                            {isParticipantTeacher && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
                            {p.hand_raised && !isParticipantTeacher && <Hand className="h-3 w-3 text-amber-400 shrink-0 animate-bounce" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-0 ${isParticipantTeacher ? 'bg-amber-400/15 text-amber-400' : 'bg-blue-400/15 text-blue-400'}`}>
                              {isParticipantTeacher ? 'Teacher' : 'Student'}
                            </Badge>
                            {p.mic_on ? <Mic className="h-3 w-3 text-emerald-400" /> : <MicOff className="h-3 w-3 text-red-400" />}
                            {!p.camera_on && <VideoOff className="h-3 w-3 text-red-400" />}
                          </div>
                        </div>
                        {isTeacher && !isMe && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                              <DropdownMenuItem onClick={() => teacherMuteUser(p.user_id)} className="hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                <MicOff className="h-4 w-4 mr-2" /> Mute
                              </DropdownMenuItem>
                              {p.hand_raised && (
                                <DropdownMenuItem onClick={async () => { await supabase.from('room_participants').update({ hand_raised: false }).eq('room_id', roomId).eq('user_id', p.user_id); }} className="hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                                  <Hand className="h-4 w-4 mr-2" /> Lower Hand
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => teacherRemoveUser(p.user_id)} className="text-red-400 hover:bg-red-400/10 cursor-pointer">
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Materials Tab */}
          {activeTab === 'materials' && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-[#0f111a]">
              {isTeacher && (
                <div className="p-3 border-b border-slate-300 dark:border-white/10 shrink-0">
                  <input type="file" ref={fileInputRef} onChange={handleUploadMaterial} className="hidden" />
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <Upload className="h-4 w-4" />
                    {isUploading ? 'Uploading...' : 'Upload Lecture Notes'}
                  </Button>
                </div>
              )}
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {materials.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-gray-500 text-sm">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No materials yet{isTeacher ? ' — upload notes above.' : '.'}
                    </div>
                  ) : (
                    materials.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-300 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{m.title}</p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-500">{new Date(m.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" download>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-blue-600/20 shrink-0" title="Download">
                            <Download className="h-4 w-4 text-blue-400" />
                          </Button>
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
