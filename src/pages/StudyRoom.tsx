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
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const [roomType, setRoomType] = useState<'teacher' | 'free'>('teacher');
  
  // Derivation: You are a room teacher if the guest list says so
  const isRoomTeacher = myRole === 'teacher';
  const isFreeRoom = roomType === 'free';
  const hasFullAccess = isRoomTeacher || isFreeRoom;
  const isTeacher = hasFullAccess; // For backwards compat in JSX


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
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .limit(1)
        .maybeSingle();
      
      if (roleError) console.warn("Error fetching user role:", roleError);
      
      const roleValue = typeof roleData === 'string' ? roleData : roleData?.role;
      const currentGlobalRole = roleValue || globalRole || 'student';
      console.log(`Global role calculated as: ${currentGlobalRole} (roleData: ${JSON.stringify(roleData)})`);
      
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
        const { error: insertError } = await supabase.from('room_participants').insert({
          room_id: roomId,
          user_id: currentUser.id,
          is_online: true,
          role,
          joined_at: new Date().toISOString()
        });
        
        if (insertError) {
          console.warn("Insert participant failed (likely 409), falling back to update:", insertError);
          const { error: fallbackUpdateError } = await supabase.from('room_participants')
            .update({ is_online: true, role })
            .eq('room_id', roomId)
            .eq('user_id', currentUser.id);
          if (fallbackUpdateError) console.error("Fallback Update Error:", fallbackUpdateError);
        }
        setMyRole(role);
      } else {
        // Enforce the computed role ensuring global teachers stay teachers!
        const finalRole = role; 
        console.log(`Updating existing participant ${existing.id} to role: ${finalRole}`);
        
        const { error: updateError } = await supabase.from('room_participants')
          .update({ is_online: true, role: finalRole })
          .eq('id', existing.id);
          
        if (updateError) console.error("Update participant failed:", updateError);
          
        setMyRole(finalRole as 'teacher' | 'student');
      }
      
      // Immediately fetch participants again to ensure the UI updates with our self-sync logic
      setTimeout(() => fetchParticipants(), 500);
    } catch(e) { console.error('ensureParticipantRecord error', e); }
  };

  const fetchRoomDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("study_rooms")
        .select("name, host_id, created_by, allow_student_drawing, type")
        .eq("id", roomId)
        .single();
      if (error) throw error;
      setRoomName(data.name);
      setRoomType(data.type || 'teacher');
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
    if (isFreeRoom) {
      screenShare();
    } else {
      supabase.channel(`room_actions:${roomId}`).send({ type: 'broadcast', event: 'screen_request', payload: { userId: currentUser?.id, username: displayName } });
      toast({ title: "📤 Screen share request sent to teacher." });
    }
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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#020202] text-slate-900 dark:text-white overflow-hidden relative font-sans transition-all duration-700" style={{ backgroundImage: "var(--study-room-gradient)" }}>
      <style>{`
        :root { --study-room-gradient: radial-gradient(ellipse at top, #f8fafc, #f1f5f9); }
        .dark { --study-room-gradient: radial-gradient(ellipse at top, #0a0e1a, #020202); }
      `}</style>
      {isTeacher && pendingScreenRequest && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-white/90 dark:bg-[#1a1919]/90 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-3xl p-5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] flex flex-col gap-3 min-w-[300px]">
          <p className="font-bold text-blue-600 dark:text-blue-400">📡 Screen Share Request</p>
          <p className="text-sm text-slate-600 dark:text-gray-300"><strong>{pendingScreenRequest.username}</strong> wants to share their screen.</p>
          <div className="flex gap-3 mt-1">
            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-[0_0_20px_rgba(37,99,235,0.2)]" onClick={() => approveScreenShare(pendingScreenRequest.userId)}>
              ✅ Approve
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white" onClick={() => rejectScreenShare(pendingScreenRequest.userId)}>
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-20 shrink-0 px-6 sm:px-8 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" onClick={handleLeaveRoom} className="hover:bg-slate-200 dark:hover:bg-white/10 rounded-full h-10 w-10 text-slate-600 dark:text-white shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold truncate max-w-[200px] sm:max-w-md tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              {roomName || "Classroom"}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : connectionStatus === 'reconnecting' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                {connectionStatus === 'connected' ? 'LIVE' : connectionStatus === 'reconnecting' ? 'RECONNECTING' : 'DISCONNECTED'}
              </span>
              <span className={`text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md ${isFreeRoom ? 'bg-[#06b6d4]/10 text-[#06b6d4]' : (isRoomTeacher ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-[#3b82f6]/10 text-[#3b82f6]')}`}>
                {isFreeRoom ? '🧠 Peer Room' : (isRoomTeacher ? '👑 Teacher' : '🎓 Student')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {timerMode !== 'idle' && (
            <div className={`hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-xl text-sm font-mono font-bold shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] ${timerMode === 'study' ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'}`}>
              <Timer className="h-4 w-4" />
              {timerMode.toUpperCase()}: {formatTimer(timeLeft)}
              <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-white/10 ml-2" onClick={() => setTimerMode('idle')}>
                <Square className="h-3 w-3" />
              </Button>
            </div>
          )}
          {isTeacher && raisedHands.length > 0 && (
            <div className="flex items-center gap-2 bg-[#f59e0b]/20 ring-1 ring-[#f59e0b]/40 text-[#fbd38d] px-4 py-2 rounded-full text-xs font-bold animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Hand className="h-4 w-4" />
              {raisedHands.length} hand{raisedHands.length > 1 ? 's' : ''} raised
            </div>
          )}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button onClick={copyInvite} className="hidden sm:flex items-center gap-2 h-10 px-5 rounded-full font-bold text-white border-0 transition-transform hover:scale-105" style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", boxShadow: "0 8px 25px -5px rgba(59,130,246,0.3)" }}>
              <Copy className="h-4 w-4" /> Invite
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden px-4 sm:px-8 pb-28 gap-6 relative z-0">
        
        {/* Stage Area */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 bg-[#0e0e0e]/80 rounded-[2rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] flex items-center justify-center relative backdrop-blur-md ring-1 ring-white/5">
            {showWhiteboard ? (
              <Whiteboard roomId={roomId || ''} userId={currentUser?.id} isReadOnly={!hasFullAccess && !allowStudentDrawing} />
            ) : (
              <div className="w-full h-full p-2 lg:p-4">
                <VideoGrid localStream={localStream} peers={peers} currentName={displayName} localMicOn={micOn} />
              </div>
            )}
          </div>
        </div>

        {/* Control Dock (Floating Pill) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 h-16 sm:h-20 px-6 sm:px-8 bg-white/60 dark:bg-[#1a1919]/60 backdrop-blur-3xl rounded-full shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)] ring-1 ring-slate-200 dark:ring-white/10 flex items-center justify-center gap-3 sm:gap-5 transition-all">
          <Button 
            size="icon" 
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${micOn ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400 ring-1 ring-rose-500/30'}`} 
            onClick={toggleMic}
          >
            {micOn ? <Mic className="h-5 w-5 sm:h-6 sm:w-6" /> : <MicOff className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>

          <Button 
            size="icon" 
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${camOn ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400 ring-1 ring-rose-500/30'}`} 
            onClick={toggleCam}
          >
            {camOn ? <Video className="h-5 w-5 sm:h-6 sm:w-6" /> : <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" />}
          </Button>

          {/* Screen Share */}
          {isTeacher ? (
            <Button 
              size="icon" 
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${isScreenSharing ? 'bg-[#06b6d4]/10 text-[#06b6d4] ring-1 ring-[#06b6d4]/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white ring-1 ring-slate-200 dark:ring-white/10'}`} 
              onClick={screenShare} 
              title="Share Screen"
            >
              <MonitorUp className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          ) : (
            <Button 
              size="icon" 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white ring-1 ring-slate-200 dark:ring-white/10 hover:bg-[#f59e0b]/20 hover:text-[#f59e0b] hover:ring-[#f59e0b]/40" 
              onClick={requestScreenShare} 
              title="Request Screen Share"
            >
              <MonitorUp className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          )}

          <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/10 mx-1 sm:mx-2 hidden sm:block" />

          {/* Toggle Whiteboard */}
          <Button 
            size="icon" 
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${showWhiteboard ? 'bg-[#9c48ea]/20 text-[#9c48ea] dark:text-[#cc97ff] ring-1 ring-[#9c48ea]/40 shadow-[0_0_20px_rgba(156,72,234,0.3)]' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white ring-1 ring-slate-200 dark:ring-white/10'}`} 
            onClick={() => setShowWhiteboard(s => !s)} 
            title="Toggle Whiteboard"
          >
            <Edit3 className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>

          {/* Student: Raise Hand */}
          {!isTeacher && (
            <Button 
              size="icon" 
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${myHandRaised ? 'bg-[#f59e0b]/20 text-[#f59e0b] ring-1 ring-[#f59e0b]/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white ring-1 ring-slate-200 dark:ring-white/10'}`} 
              onClick={myHandRaised ? lowerHand : raiseHand} 
              title={myHandRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          )}

          <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block"></div>
          
          {/* Leave Button */}
          <Button 
            size="icon" 
            className="w-12 sm:w-[100px] h-12 sm:h-14 rounded-full font-bold transition-all duration-300 hover:scale-110 active:scale-95 bg-rose-600 hover:bg-rose-500 text-white border-0 shadow-[0_0_20px_rgba(225,29,72,0.4)] ml-1 sm:ml-2" 
            onClick={handleLeaveRoom}
            title="Leave Room"
          >
            <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-[360px] h-full bg-white/40 dark:bg-[#1a1919]/60 backdrop-blur-3xl rounded-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(0,0,0,0.4)] flex flex-col shrink-0 overflow-hidden ring-1 ring-slate-200 dark:ring-white/5 relative z-10">
          <div className="flex p-3 shrink-0 gap-2 border-b border-slate-200 dark:border-white/5">
            <button className={`flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200 dark:ring-white/5' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('chat')}>
              <MessageSquare className="h-4 w-4" /> Chat
            </button>
            <button className={`flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'people' ? 'bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200 dark:ring-white/5' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('people')}>
              <Users className="h-4 w-4" /> People ({participants.filter(p => p.is_online).length})
            </button>
            <button className={`flex-1 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'materials' ? 'bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200 dark:ring-white/5' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/5'}`} onClick={() => setActiveTab('materials')}>
              <FileText className="h-4 w-4" /> Notes
            </button>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 bg-transparent">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg, idx) => {
                    const isMe = msg.user_id === currentUser?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-4 py-2.5 shadow-sm ${isMe ? 'bg-[#3b82f6]/80 text-white rounded-2xl rounded-tr-sm backdrop-blur-md' : 'bg-slate-200/50 dark:bg-white/5 text-slate-800 dark:text-gray-200 rounded-2xl rounded-tl-sm ring-1 ring-slate-300 dark:ring-white/5'}`}>
                          {!isMe && <p className="text-xs font-bold text-[#7c3aed] dark:text-[#9c48ea] mb-1">{msg.profiles?.username || 'User'}</p>}
                          <p className="text-sm text-inherit break-words leading-relaxed">{msg.message}</p>
                          <p className="text-[9px] text-slate-500 dark:text-white/40 mt-1.5 mb-0.5 text-right font-medium tracking-wider uppercase">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })}
                  {[...typingUsers].length > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 ring-1 ring-white/5 rounded-2xl rounded-tl-sm px-4 py-2 text-xs text-gray-400 italic font-medium">
                        {[...typingUsers].join(', ')} typing...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-3 shrink-0">
                <form className="flex gap-2 bg-white/5 rounded-full p-1.5 ring-1 ring-white/10 focus-within:ring-[#699cff]/50 transition-all shadow-inner" onSubmit={handleSendMessage}>
                  <Input
                    value={message}
                    onChange={handleTyping}
                    placeholder="Message..."
                    className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-sm text-white placeholder-gray-500 px-3 h-10"
                    autoComplete="off"
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 rounded-full border-0 text-white shadow-md transition-transform hover:scale-105" style={{ background: "linear-gradient(135deg, #3b82f6, #699cff)" }}>
                    <Send className="h-4 w-4 ml-0.5" />
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* People Tab */}
          {activeTab === 'people' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent">
              {/* Controls Panel */}
              {(isTeacher || isFreeRoom) && (
                <div className="m-3 p-4 rounded-2xl bg-slate-100 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10 space-y-3 shrink-0 backdrop-blur-md">
                  <p className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 ${isFreeRoom ? 'text-blue-600 dark:text-[#06b6d4]' : 'text-amber-600 dark:text-[#f59e0b]'}`}>
                    {isFreeRoom ? <Users className="h-3 w-3" /> : <Crown className="h-3 w-3" />} 
                    {isFreeRoom ? 'Room Controls' : 'Teacher Controls'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="ghost" className="text-xs bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/5 rounded-xl h-9" onClick={() => startTimer(25, 'study')}>
                      <Timer className="h-3 w-3 mr-1" /> 25m Focus
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/5 rounded-xl h-9" onClick={() => startTimer(5, 'break')}>
                      <Timer className="h-3 w-3 mr-1" /> 5m Break
                    </Button>
                    
                    {!isFreeRoom && (
                      <Button size="sm" variant="ghost" className={`text-xs col-span-2 rounded-xl h-9 ${allowStudentDrawing ? 'bg-blue-500/10 dark:bg-[#3b82f6]/20 text-blue-600 dark:text-[#699cff] ring-1 ring-blue-500/30' : 'bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/5'}`} onClick={toggleWhiteboardPermission}>
                        {allowStudentDrawing ? <Unlock className="h-3 w-3 mr-1.5" /> : <Lock className="h-3 w-3 mr-1.5" />}
                        {allowStudentDrawing ? 'Disable Student Drawing' : 'Allow Student Drawing'}
                      </Button>
                    )}
                    
                    {isRoomTeacher && (
                      <Button size="sm" variant="ghost" className="text-xs col-span-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 ring-1 ring-rose-500/30 rounded-xl h-9" onClick={teacherEndSession}>
                        End Session for All
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Student Panel (visible only to non-teacher students in moderated rooms) */}
              {!isTeacher && !isFreeRoom && (
                <div className="m-3 p-4 rounded-2xl bg-[#3b82f6]/5 dark:bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/20 space-y-3 shrink-0 backdrop-blur-md">
                  <p className="text-[10px] text-[#3b82f6] dark:text-[#699cff] font-bold tracking-widest uppercase flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Student Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="ghost" className={`text-xs rounded-xl h-9 ${myHandRaised ? 'bg-[#f59e0b]/20 text-[#f59e0b] dark:text-[#fbd38d] ring-1 ring-[#f59e0b]/30 hover:bg-[#f59e0b]/30' : 'bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/5'}`} onClick={myHandRaised ? lowerHand : raiseHand}>
                      <Hand className="h-3 w-3 mr-1.5" />{myHandRaised ? 'Lower Hand' : 'Raise Hand'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-white/5 rounded-xl h-9" onClick={requestScreenShare}>
                      <MonitorUp className="h-3 w-3 mr-1.5" /> Share Screen
                    </Button>
                  </div>
                  {!allowStudentDrawing && (
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-1">🔒 Whiteboard is read-only — teacher controls drawing</p>
                  )}
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="px-3 pb-3 space-y-1.5">
                  {participants.filter(p => p.is_online).map(p => {
                    const isMe = p.user_id === currentUser?.id;
                    const isParticipantTeacher = p.role === 'teacher';
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100/50 dark:bg-white/[0.03] hover:bg-slate-200/50 dark:hover:bg-white/[0.08] ring-1 ring-slate-200 dark:ring-white/5 transition-all group">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9c48ea] to-[#3b82f6] flex items-center justify-center text-sm font-bold shrink-0 text-white shadow-inner">
                            {p.profiles?.username?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1a1919] ${p.is_online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-500'}`}></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-800 dark:text-white tracking-wide truncate">{p.profiles?.username || 'User'}{isMe ? ' (you)' : ''}</span>
                            {isParticipantTeacher && <Crown className="h-3 w-3 text-[#f59e0b] shrink-0" />}
                            {p.hand_raised && !isParticipantTeacher && <Hand className="h-3 w-3 text-[#f59e0b] shrink-0 animate-bounce" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md ${isParticipantTeacher ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-[#3b82f6]/10 text-[#699cff]'}`}>
                              {isParticipantTeacher ? (isFreeRoom ? 'Host' : 'Teacher') : 'Student'}
                            </span>
                            {p.mic_on ? <Mic className="h-3.5 w-3.5 text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> : <MicOff className="h-3.5 w-3.5 text-rose-400" />}
                            {!p.camera_on && <VideoOff className="h-3.5 w-3.5 text-rose-400" />}
                          </div>
                        </div>
                        {isRoomTeacher && !isMe && !isFreeRoom && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-white/10 text-white">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#201f1f]/90 backdrop-blur-xl border-white/10 text-white rounded-2xl p-1 shadow-2xl min-w-[140px]">
                              <DropdownMenuItem onClick={() => teacherMuteUser(p.user_id)} className="hover:bg-white/10 cursor-pointer rounded-xl focus:bg-white/10 active:bg-white/20">
                                <MicOff className="h-4 w-4 mr-2" /> Mute
                              </DropdownMenuItem>
                              {p.hand_raised && (
                                <DropdownMenuItem onClick={async () => { await supabase.from('room_participants').update({ hand_raised: false }).eq('room_id', roomId).eq('user_id', p.user_id); }} className="hover:bg-white/10 cursor-pointer rounded-xl focus:bg-white/10">
                                  <Hand className="h-4 w-4 mr-2" /> Lower Hand
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => teacherRemoveUser(p.user_id)} className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 cursor-pointer rounded-xl focus:bg-rose-500/10 focus:text-rose-300">
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
            <div className="flex-1 flex flex-col min-h-0 bg-transparent">
              {isTeacher && (
                <div className="p-4 shrink-0">
                  <input type="file" ref={fileInputRef} onChange={handleUploadMaterial} className="hidden" />
                  <Button className="w-full text-white gap-2 rounded-xl shadow-[0_10px_20px_-10px_rgba(59,130,246,0.5)] border-0 transition-transform hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, #3b82f6, #9c48ea)" }} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <Upload className="h-4 w-4" />
                    {isUploading ? 'Uploading...' : 'Upload Lecture Notes'}
                  </Button>
                </div>
              )}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {materials.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-slate-100 dark:bg-white/5 rounded-2xl ring-1 ring-slate-200 dark:ring-white/10 text-slate-400 dark:text-gray-400 text-sm">
                      <div className="w-12 h-12 rounded-full hidden flex items-center justify-center mx-auto mb-3 bg-white/5 ring-1 ring-white/10">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="font-bold text-slate-800 dark:text-white mb-1">No Materials Yet</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500">{isTeacher ? 'Upload notes using the button above.' : 'Check back later for lecture notes.'}</p>
                    </div>
                  ) : (
                    materials.map(m => (
                      <div key={m.id} className="group flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.08] ring-1 ring-white/5 rounded-2xl transition-all shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0 group-hover:bg-[#3b82f6]/20 transition-colors">
                            <FileText className="h-4 w-4 text-[#699cff]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{m.title}</p>
                            <p className="text-[10px] font-medium tracking-wide text-gray-400 uppercase">{new Date(m.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" download>
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-white/10 text-white shrink-0 shadow-sm" title="Download">
                            <Download className="h-4 w-4" />
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
