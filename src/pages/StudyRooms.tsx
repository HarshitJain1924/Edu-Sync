import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Calendar, Clock, Crown, Columns3, Zap, CheckCircle2, Handshake, GraduationCap } from "lucide-react";
import { roomSchema } from "@/lib/validations";
import { z } from "zod";
import { cn } from "@/lib/utils";
import AppSidebar from "@/components/AppSidebar";

// ─── Types ─────────────────────────────────────────────────────
interface StudyRoom {
  id: string;
  name: string;
  description: string;
  created_by: string;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  room_code: string;
  type: 'teacher' | 'free';
  scheduled_for: string | null;
  profiles: { username: string };
}

interface StudySession {
  id: string;
  title: string;
  description: string;
  start_time: string;
  status: string;
  teacher_id: string;
  room_id: string;
  profiles: { username: string };
  study_rooms: { name: string };
  room_type?: 'teacher' | 'free';
}

type ViewMode = "rooms" | "kanban";

// ─── Helpers ───────────────────────────────────────────────────
const ensureProfileExists = async (user: any) => {
  if (!user?.id) return;
  try {
    const { data, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (error && !["PGRST116", "406"].includes((error as any).code)) console.warn("Profile check failed", error);
    if (!data) {
      const username = user.user_metadata?.username || (typeof user.email === "string" ? user.email.split("@")[0] : "Student");
      const { error: insertError } = await supabase.from("profiles").insert({ id: user.id, username });
      if (insertError && (insertError as any).code !== "23505") console.error("Profile creation failed", insertError);
    }
  } catch (e) { console.error("ensureProfileExists error", e); }
};

// ─── Component ─────────────────────────────────────────────────
const StudyRooms = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // View
  const [viewMode, setViewMode] = useState<ViewMode>("rooms");

  // Data
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [newRoomType, setNewRoomType] = useState<"teacher" | "free">("teacher");
  const [newRoomScheduledFor, setNewRoomScheduledFor] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDesc, setSessionDesc] = useState("");
  const [sessionRoom, setSessionRoom] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [globalRole, setGlobalRole] = useState<string>("student");
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const syncTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("edusync:theme-changed", syncTheme as EventListener);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("edusync:theme-changed", syncTheme as EventListener);
    };
  }, []);

  const canScheduleSessions = globalRole === "teacher" || globalRole === "admin";

  useEffect(() => {
    if (!canScheduleSessions && newRoomType === "teacher") {
      setNewRoomType("free");
    }
  }, [canScheduleSessions, newRoomType]);

  useEffect(() => { checkUser(); fetchRooms(); fetchSessions(); }, []);

  // ─── Data Fetching ─────────────────────────────────────────
  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); } else {
      setCurrentUser(user); await ensureProfileExists(user);
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleData?.role) setGlobalRole(roleData.role);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from("study_rooms").select(`*, profiles:created_by (username)`).eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      const filtered = (data || []).filter((r: any) => r.type !== 'free' || r.created_by === user?.id);
      
      setRooms(filtered);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await supabase.from("study_sessions").select("id, title, description, start_time, status, teacher_id, room_id").order("start_time", { ascending: false }).limit(100);
      
      const roomIds = Array.from(new Set((data || []).map((s: any) => s.room_id).filter(Boolean)));
      let roomMap = new Map<string, any>();
      if (roomIds.length > 0) { 
        const { data: roomRows } = await supabase.from("study_rooms").select("id, name, type, created_by").in("id", roomIds); 
        roomMap = new Map((roomRows || []).map((r: any) => [r.id, r])); 
      }

      const teacherIds = Array.from(new Set((data || []).map((s: any) => s.teacher_id).filter(Boolean)));
      let teacherNameMap = new Map<string, string>();
      if (teacherIds.length > 0) { 
        const { data: teachers } = await supabase.from("profiles").select("id, username").in("id", teacherIds); 
        teacherNameMap = new Map((teachers || []).map((t: any) => [t.id, t.username || "Teacher"])); 
      }
      
      setSessions((data || []).map((session: any) => ({ 
        ...session, 
        profiles: { username: teacherNameMap.get(session.teacher_id) || "Teacher" }, 
        study_rooms: { name: roomMap.get(session.room_id)?.name || "Study Room" },
        room_type: roomMap.get(session.room_id)?.type || 'teacher',
      })));
    } catch (e) { console.warn("Sessions fetch failed:", e); }
  };

  // ─── Actions ───────────────────────────────────────────────
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = roomSchema.parse({ name: newRoomName, description: newRoomDescription });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await ensureProfileExists(user);
      
      const { data: room, error: roomError } = await supabase.from("study_rooms").insert({ 
        name: validated.name, 
        description: validated.description, 
        created_by: user.id, 
        host_id: user.id, 
        type: newRoomType,
        scheduled_for: newRoomScheduledFor ? new Date(newRoomScheduledFor).toISOString() : null,
        is_scheduled: !!newRoomScheduledFor,
        room_code: Math.random().toString(36).substring(2, 8).toUpperCase() 
      }).select().single();
      
      if (roomError) throw roomError;
      
      await supabase.from("room_participants").insert({ 
        room_id: room.id, 
        user_id: user.id, 
        role: newRoomType === 'teacher' ? 'teacher' : 'student', 
        joined_at: new Date().toISOString() 
      });

      if (newRoomScheduledFor) {
        await supabase.from("study_sessions").insert({
          title: validated.name,
          description: validated.description || 'Study Room Session',
          room_id: room.id,
          teacher_id: user.id,
          start_time: new Date(newRoomScheduledFor).toISOString(),
          status: "scheduled"
        });
        fetchSessions();
      }

      toast({ title: newRoomType === "teacher" ? "Class created!" : "Peer Room created!", description: `Room code: ${room.room_code}` });
      setCreateDialogOpen(false); 
      setNewRoomName(""); 
      setNewRoomDescription(""); 
      setNewRoomType(canScheduleSessions ? "teacher" : "free");
      setNewRoomScheduledFor("");
      fetchRooms();
    } catch (error: any) {
      if (error instanceof z.ZodError) toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      else toast({ title: "Error", description: error.message || "Failed to create room.", variant: "destructive" });
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await ensureProfileExists(user);
      const { error } = await supabase.from("room_participants").insert({ room_id: roomId, user_id: user.id });
      if (error && error.code !== "23505") throw error;
      navigate(`/study-room/${roomId}`);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const { data, error } = await supabase.from("study_rooms").select("id").eq("room_code", joinCode.toUpperCase().trim()).single();
      if (error || !data) { toast({ title: "Invalid room code", variant: "destructive" }); return; }
      handleJoinRoom(data.id);
    } catch { toast({ title: "Error finding room", variant: "destructive" }); }
  };

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canScheduleSessions) { toast({ title: "Not allowed", description: "Only teachers and admins can schedule sessions.", variant: "destructive" }); return; }
    if (!sessionTitle || !sessionTime || !sessionRoom || !currentUser) return;
    try {
      const { error } = await supabase.from("study_sessions").insert({ title: sessionTitle, description: sessionDesc, room_id: sessionRoom, teacher_id: currentUser.id, start_time: new Date(sessionTime).toISOString(), status: "scheduled" });
      if (error) throw error;
      toast({ title: "Session scheduled!" });
      setScheduleDialogOpen(false); setSessionTitle(""); setSessionDesc(""); setSessionRoom(""); setSessionTime(""); fetchSessions();
    } catch (err: any) { toast({ title: "Failed to schedule", description: err.message, variant: "destructive" }); }
  };

  // ─── Derived Data ──────────────────────────────────────────
  const sessionsToday = sessions.filter((s) => {
    const d = new Date(s.start_time);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const kanbanColumns = [
    { key: "scheduled", label: "Scheduled", accent: "#9c48ea", accentBg: "rgba(156,72,234,0.08)", accentBorder: "rgba(156,72,234,0.25)", items: sessions.filter((s) => s.status === "scheduled") },
    { key: "live", label: "Live Now", accent: "#10b981", accentBg: "rgba(16,185,129,0.08)", accentBorder: "rgba(16,185,129,0.25)", items: sessions.filter((s) => s.status === "live" || s.status === "in_progress" || s.status === "active") },
    { key: "completed", label: "Completed", accent: "#71717a", accentBg: "rgba(113,113,122,0.06)", accentBorder: "rgba(113,113,122,0.15)", items: sessions.filter((s) => s.status === "completed" || s.status === "ended") },
    { key: "cancelled", label: "Cancelled", accent: "#ff6f7e", accentBg: "rgba(255,111,126,0.06)", accentBorder: "rgba(255,111,126,0.15)", items: sessions.filter((s) => s.status === "cancelled") },
  ];

  // ─── Tokens → Tailwind ─────────────────────────────────────
  const SURFACE = isDarkMode ? "#0f0f0f" : "#e2e8f0";
  const CONTAINER = isDarkMode ? "#1a1919" : "#ffffff";
  const CONTAINER_HIGH = isDarkMode ? "#201f1f" : "#f1f5f9";
  const CONTAINER_HIGHEST = isDarkMode ? "#262625" : "#e2e8f0";
  const GHOST_BORDER = isDarkMode ? "rgba(73,72,71,0.15)" : "rgba(148,163,184,0.35)";

  const glassCard = "rounded-[2rem] backdrop-blur-xl";
  const ghostBorder = { border: `1px solid ${GHOST_BORDER}` };
  const cardBg = isDarkMode ? `${CONTAINER}80` : "rgba(255,255,255,0.92)";
  const inputClass = "bg-slate-100 dark:bg-[#262625] border border-slate-300 dark:border-0 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-[#71717a] rounded-xl focus-visible:ring-[#699cff]/30 focus-visible:ring-offset-0";
  const dialogStyle = { backgroundColor: CONTAINER_HIGH, border: `1px solid ${GHOST_BORDER}` };

  const statCards = [
    { label: "Active Rooms", value: rooms.length, accent: "#06b6d4" },
    { label: "Upcoming", value: sessions.filter((s) => s.status === "scheduled").length, accent: "#9c48ea" },
    { label: "Today", value: sessionsToday, accent: "#f59e0b" },
  ];

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen text-slate-900 dark:text-white" style={{ background: SURFACE }}>
        <AppSidebar />
        <main className="ml-64 flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Users className="h-10 w-10 text-[#cc97ff] animate-pulse" />
            <p className="text-slate-600 dark:text-[#71717a] text-sm font-medium" style={{ fontFamily: "Inter, sans-serif" }}>Loading study rooms…</p>
          </div>
        </main>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="flex h-screen text-slate-900 dark:text-white" style={{ background: SURFACE }}>
      <AppSidebar />
      <main className="ml-64 flex-1 overflow-y-auto relative isolate text-slate-900 dark:text-white" style={{ fontFamily: "Inter, sans-serif" }}>
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Ambient Depth Layers */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden ml-64">
          <div className="absolute -top-[15%] -right-[10%] h-[55%] w-[55%] bg-violet-500/[0.08] blur-[140px]" />
          <div className="absolute -bottom-[10%] -left-[10%] h-[55%] w-[55%] bg-blue-500/[0.06] blur-[140px]" />
          <div className="absolute top-[35%] left-[20%] h-[35%] w-[35%] bg-violet-500/5 blur-[130px]" />
        </div>

        <div className="relative z-10 min-h-screen" style={{ padding: "2.75rem" }}>
          {/* ── Header ── */}
          <header className="mb-10 flex flex-col xl:flex-row xl:items-start justify-between" style={{ gap: "2.75rem" }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-[#adaaaa] mb-3" style={{ fontFamily: "Inter, sans-serif" }}>Collaborative Learning</p>
              <h1 className="text-[3rem] font-extrabold text-slate-900 dark:text-white tracking-[-0.04em] leading-[1.1] mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
                Study Rooms
              </h1>
              <p className="text-slate-600 dark:text-[#adaaaa] text-base max-w-lg leading-relaxed">
                Join, host, and schedule collaborative classes in high-fidelity virtual environments.
              </p>
            </div>

            {/* Stat Tiles */}
            <div className="flex gap-4 shrink-0">
              {statCards.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(glassCard, "p-5 min-w-[120px] text-center transition-all duration-300 hover:-translate-y-0.5")}
                  style={{ background: cardBg, ...ghostBorder }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: stat.accent, fontFamily: "Inter, sans-serif" }}>{stat.label}</p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>{String(stat.value).padStart(2, "0")}</p>
                </div>
              ))}
            </div>
          </header>

          {/* ── Floating Dock Switcher ── */}
          <div className="flex justify-center mb-10">
            <div
              className="inline-flex p-1.5 rounded-full backdrop-blur-xl"
              style={{
                background: isDarkMode ? "rgba(44,44,44,0.40)" : "rgba(255,255,255,0.95)",
                border: `1px solid ${GHOST_BORDER}`,
                boxShadow: isDarkMode ? "0 8px 30px -5px rgba(0,0,0,0.5)" : "0 8px 24px -8px rgba(15,23,42,0.25)",
              }}
            >
              <button
                onClick={() => setViewMode("rooms")}
                className={cn(
                  "flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-bold transition-all duration-300",
                  viewMode === "rooms"
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-[#71717a] hover:text-slate-700 dark:hover:text-[#adaaaa] border border-transparent"
                )}
                style={
                  viewMode === "rooms"
                    ? {
                        background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                        border: isDarkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(148,163,184,0.5)",
                        boxShadow: isDarkMode ? "0 0 20px rgba(156,72,234,0.15)" : "0 0 16px rgba(124,58,237,0.16)",
                      }
                    : {}
                }
              >
                <Users className="h-4 w-4" />
                Rooms
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-bold transition-all duration-300",
                  viewMode === "kanban"
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-[#71717a] hover:text-slate-700 dark:hover:text-[#adaaaa] border border-transparent"
                )}
                style={
                  viewMode === "kanban"
                    ? {
                        background: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
                        border: isDarkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(148,163,184,0.5)",
                        boxShadow: isDarkMode ? "0 0 20px rgba(156,72,234,0.15)" : "0 0 16px rgba(124,58,237,0.16)",
                      }
                    : {}
                }
              >
                <Columns3 className="h-4 w-4" />
                Kanban
              </button>
            </div>
          </div>

          {/* ═══════════ ROOMS VIEW ═══════════ */}
          {viewMode === "rooms" && (
            <div className="animate-in fade-in duration-300">
              {/* Action Bar */}
              <div className={cn(glassCard, "p-6 mb-10")} style={{ background: cardBg, ...ghostBorder }}>
                <div className="flex flex-col xl:flex-row xl:items-center" style={{ gap: "1.4rem" }}>
                  <form onSubmit={handleJoinByCode} className="flex gap-3 flex-1 max-w-md">
                    <Input placeholder="ROOM CODE" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className={cn(inputClass, "h-12 font-mono uppercase tracking-[0.25em]")} maxLength={6} />
                    <Button type="submit" className="h-12 rounded-xl px-6 font-bold text-slate-900 dark:text-white" style={{ background: CONTAINER_HIGHEST, border: `1px solid ${GHOST_BORDER}` }} disabled={joinCode.length < 3}>
                      Join
                    </Button>
                  </form>

                  <div className="hidden h-8 w-px xl:block" style={{ background: GHOST_BORDER }} />

                  <div className="flex flex-wrap items-center gap-3">
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="h-12 rounded-xl px-6 font-bold text-white border-0" style={{ background: "linear-gradient(135deg, #9c48ea, #cc97ff)", boxShadow: "0 8px 25px -5px rgba(156,72,234,0.35)" }}>
                          <Plus className="h-4 w-4 mr-2" /> Create Room
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2rem] text-slate-900 dark:text-white" style={dialogStyle}>
                        <DialogHeader>
                          <DialogTitle className="text-slate-900 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Create Study Room</DialogTitle>
                          <DialogDescription className="text-slate-600 dark:text-[#adaaaa]">Set up a new collaborative workspace</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateRoom} className="space-y-4">
                          <div className="space-y-2"><Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Room Name</Label><Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Data Structures Grind" required className={inputClass} /></div>
                          <div className="space-y-2"><Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Description</Label><Textarea value={newRoomDescription} onChange={(e) => setNewRoomDescription(e.target.value)} placeholder="Let's work together..." className={cn(inputClass, "resize-none")} /></div>
                          
                          <div className="space-y-2">
                            <Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Room Type</Label>
                            <select value={newRoomType} onChange={(e: any) => setNewRoomType(e.target.value)} className="w-full h-10 rounded-xl p-2 text-slate-900 dark:text-white" style={{ background: CONTAINER_HIGHEST, border: `1px solid ${GHOST_BORDER}` }}>
                              {canScheduleSessions && <option value="teacher">Teacher Room (Moderated Class)</option>}
                              <option value="free">Peer Room (Peer-to-Peer Collab)</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Schedule For (Optional)</Label>
                            <Input type="datetime-local" value={newRoomScheduledFor} onChange={(e) => setNewRoomScheduledFor(e.target.value)} className={inputClass} />
                          </div>
                          
                          <Button type="submit" className="w-full h-12 rounded-xl font-bold text-white border-0 transition-transform hover:scale-[1.02]" style={{ background: newRoomType === 'teacher' ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                            {newRoomType === 'teacher' ? "Create Teacher Class" : "Create Peer Room"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {canScheduleSessions && (
                      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="h-12 rounded-xl px-5 font-bold text-[#adaaaa] hover:text-white gap-2 border-0 transition-colors" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GHOST_BORDER}` }}>
                            <Calendar className="h-4 w-4" /> Schedule Session
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2rem] text-slate-900 dark:text-white" style={dialogStyle}>
                          <DialogHeader>
                            <DialogTitle className="text-slate-900 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Schedule a Class Session</DialogTitle>
                            <DialogDescription className="text-slate-600 dark:text-[#adaaaa]">Students will see this in upcoming sessions.</DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleScheduleSession} className="space-y-4">
                            <div className="space-y-2"><Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Session Title</Label><Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="DSA Revision Class" required className={inputClass} /></div>
                            <div className="space-y-2">
                              <Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Room</Label>
                              <select value={sessionRoom} onChange={(e) => setSessionRoom(e.target.value)} className="w-full h-10 rounded-xl p-2 text-slate-900 dark:text-white" style={{ background: CONTAINER_HIGHEST, border: `1px solid ${GHOST_BORDER}` }} required>
                                <option value="">Select Room...</option>
                                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2"><Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Date & Time</Label><Input type="datetime-local" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} required className={inputClass} /></div>
                            <div className="space-y-2"><Label className="text-slate-600 dark:text-[#adaaaa] text-xs">Description (optional)</Label><Textarea value={sessionDesc} onChange={(e) => setSessionDesc(e.target.value)} placeholder="Topics we'll cover..." className={cn(inputClass, "resize-none")} /></div>
                            <Button type="submit" className="w-full h-12 rounded-xl font-bold text-white border-0" style={{ background: "linear-gradient(135deg, #9c48ea, #cc97ff)" }}>Schedule Session</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </div>

              {/* Room Cards */}
              {rooms.length === 0 ? (
                <div className="rounded-[2rem] p-16 text-center" style={{ background: `${CONTAINER}30`, border: `2px dashed ${GHOST_BORDER}` }}>
                  <Users className="h-12 w-12 mx-auto mb-5" style={{ color: "#494847" }} />
                  <p className="text-slate-900 dark:text-white font-bold text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>No study rooms yet</p>
                  <p className="text-slate-600 dark:text-[#71717a] text-sm mb-6">Start a new journey by creating a collaborative workspace.</p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="h-12 rounded-xl px-8 font-bold text-white border-0" style={{ background: "linear-gradient(135deg, #9c48ea, #cc97ff)", boxShadow: "0 8px 25px -5px rgba(156,72,234,0.35)" }}>
                    <Plus className="h-4 w-4 mr-2" /> Create First Room
                  </Button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3" style={{ gap: "1.4rem" }}>
                  {rooms.map((room) => {
                    const isFree = room.type === 'free';
                    const themeColor = isFree ? "#06b6d4" : "#f59e0b";
                    const themeGradient = isFree ? "linear-gradient(135deg, #06b6d4, #3b82f6)" : "linear-gradient(135deg, #f59e0b, #fbbf24)";
                    const hoverShadow = isFree ? "0 20px 50px -10px rgba(6,182,212,0.15)" : "0 20px 50px -10px rgba(245,158,11,0.15)";
                    const hoverBorder = isFree ? "rgba(6,182,212,0.25)" : "rgba(245,158,11,0.25)";

                    return (
                    <div
                      key={room.id}
                      className={cn(glassCard, "overflow-hidden group transition-all duration-300 hover:-translate-y-1.5")}
                      style={{ background: cardBg, ...ghostBorder, transition: "all 0.3s ease" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = hoverShadow; e.currentTarget.style.borderColor = hoverBorder; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = GHOST_BORDER; }}
                    >
                      {/* Top accent */}
                      <div className="h-[2px] w-full opacity-60 group-hover:opacity-100 transition-opacity" style={{ background: themeGradient }} />

                      <div className="p-7 space-y-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 transition-colors flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                            {isFree ? (
                              <Handshake className="h-4 w-4" style={{ color: themeColor }} />
                            ) : (
                              <GraduationCap className="h-4 w-4" style={{ color: themeColor }} />
                            )}
                            <span>{room.name}</span>
                          </h3>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>Active</span>
                            {isFree && <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded border border-cyan-500/20 text-cyan-500 bg-cyan-500/10">Peer Room</span>}
                          </div>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-[#adaaaa] line-clamp-2 leading-relaxed min-h-[2.5rem]">{room.description || "No description provided."}</p>

                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#71717a]">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" style={{ color: themeColor }} />
                            <span>{room.profiles?.username || "Unknown"}</span>
                          </div>
                          <span className={isFree && room.scheduled_for ? "text-cyan-600 dark:text-cyan-400 font-bold" : ""}>
                            {room.scheduled_for
                              ? `Starts ${new Date(room.scheduled_for).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                              : new Date(room.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(148,163,184,0.16)", border: `1px solid ${GHOST_BORDER}` }}>
                            <span className="text-[9px] font-mono uppercase text-slate-500 dark:text-[#71717a]">Code</span>
                            <span className="text-sm font-bold tracking-[0.2em]" style={{ color: themeColor }}>{room.room_code || "---"}</span>
                          </div>
                          <Button className="h-10 rounded-xl px-6 font-bold text-white border-0 transition-transform hover:scale-105" style={{ background: themeGradient, boxShadow: `0 6px 20px -5px ${themeColor}60` }} onClick={() => handleJoinRoom(room.id)}>
                            Join
                          </Button>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}

              {/* Upcoming Sessions (in Rooms view) */}
              {sessions.filter((s) => s.status === "scheduled").length > 0 && (
                <section className="mt-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Calendar className="h-5 w-5" style={{ color: "#cc97ff" }} />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Upcoming Sessions</h2>
                  </div>
                  <div className="grid md:grid-cols-2 xl:grid-cols-3" style={{ gap: "1.4rem" }}>
                    {sessions.filter((s) => s.status === "scheduled").slice(0, 6).map((session) => (
                      <div key={session.id} className={cn(glassCard, "overflow-hidden group transition-all duration-300 hover:-translate-y-1")} style={{ background: cardBg, ...ghostBorder }}>
                        <div className="h-[2px] w-full opacity-60 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(90deg, #9c48ea, #cc97ff)" }} />
                        <div className="p-6 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1" style={{ fontFamily: "Manrope, sans-serif" }}>{session.title}</h3>
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-lg" style={{ background: "rgba(156,72,234,0.08)", color: "#cc97ff", border: "1px solid rgba(156,72,234,0.2)" }}>{session.status}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#71717a]">
                            {session.room_type === 'free' ? (
                              <Handshake className="h-3 w-3" style={{ color: "#06b6d4" }} />
                            ) : (
                              <Crown className="h-3 w-3" style={{ color: "#f59e0b" }} />
                            )}
                            <span>{session.profiles?.username}</span>
                            <span className="text-[#494847]">•</span>
                            <span>{session.study_rooms?.name}</span>
                            {session.room_type === 'free' && (
                              <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded border border-cyan-500/20 text-cyan-500 bg-cyan-500/10">Peer</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs" style={{ color: "#cc97ff" }}>
                            <Clock className="h-3 w-3" />
                            {new Date(session.start_time).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {session.room_id && (
                            <Button size="sm" className="w-full rounded-xl font-bold text-white border-0 h-9" style={{ background: "linear-gradient(135deg, #9c48ea, #7c3aed)", boxShadow: "0 6px 15px -5px rgba(156,72,234,0.35)" }} onClick={() => handleJoinRoom(session.room_id)}>
                              Join Room
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ═══════════ KANBAN VIEW ═══════════ */}
          {viewMode === "kanban" && (
            <div className="animate-in fade-in duration-300">
              {/* Kanban Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Columns3 className="h-5 w-5" style={{ color: "#cc97ff" }} />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Session Board</h2>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg ml-2" style={{ background: "rgba(156,72,234,0.08)", color: "#cc97ff", border: "1px solid rgba(156,72,234,0.2)" }}>
                    {sessions.length} total
                  </span>
                </div>
                {canScheduleSessions && (
                  <Button onClick={() => setScheduleDialogOpen(true)} className="h-11 rounded-xl px-6 font-bold text-white border-0" style={{ background: "linear-gradient(135deg, #9c48ea, #cc97ff)", boxShadow: "0 8px 25px -5px rgba(156,72,234,0.35)" }}>
                    <Plus className="h-4 w-4 mr-2" /> New Session
                  </Button>
                )}
              </div>

              {/* Kanban Columns */}
              <div className="grid grid-cols-4 gap-5 min-h-[60vh]">
                {kanbanColumns.map((col) => (
                  <div
                    key={col.key}
                    className="rounded-[2rem] backdrop-blur-xl flex flex-col"
                    style={{ background: col.accentBg, border: `1px solid ${col.accentBorder}`, minHeight: "400px" }}
                  >
                    {/* Column Header */}
                    <div className="p-5 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.accent, boxShadow: `0 0 8px ${col.accent}40` }} />
                        <span className="text-sm font-bold text-slate-900 dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>{col.label}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: `${col.accent}15`, color: col.accent }}>{col.items.length}</span>
                    </div>

                    {/* Column Cards */}
                    <div className="flex-1 px-4 pb-4 space-y-3 overflow-y-auto">
                      {col.items.length === 0 ? (
                        <div className="h-24 rounded-2xl flex items-center justify-center" style={{ border: `2px dashed ${col.accentBorder}` }}>
                          <p className="text-xs text-slate-500 dark:text-[#494847] font-medium">No sessions</p>
                        </div>
                      ) : col.items.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 group"
                          style={{ background: CONTAINER_HIGH, border: `1px solid ${GHOST_BORDER}`, borderLeft: `3px solid ${col.accent}` }}
                          onClick={() => session.room_id && handleJoinRoom(session.room_id)}
                        >
                          <div className="p-4 space-y-2.5">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-[#7c3aed] dark:group-hover:text-[#cc97ff] transition-colors" style={{ fontFamily: "Manrope, sans-serif" }}>
                              {session.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#71717a]">
                              {session.room_type === 'free' ? (
                                <Handshake className="h-3 w-3" style={{ color: "#06b6d4" }} />
                              ) : (
                                <Crown className="h-3 w-3" style={{ color: "#f59e0b" }} />
                              )}
                              <span>{session.profiles?.username}</span>
                              {session.room_type === 'free' && (
                                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border border-cyan-500/20 text-cyan-500 bg-cyan-500/10">Peer</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#71717a]">
                              <Users className="h-3 w-3 opacity-60" />
                              <span>{session.study_rooms?.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]" style={{ color: col.accent }}>
                              <Clock className="h-3 w-3" />
                              {new Date(session.start_time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudyRooms;
