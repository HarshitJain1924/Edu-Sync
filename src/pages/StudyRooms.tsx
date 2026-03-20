import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, ArrowLeft, LogOut, Calendar, Clock, Crown } from "lucide-react";
import { roomSchema } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { z } from 'zod';

interface StudyRoom {
  id: string;
  name: string;
  description: string;
  created_by: string;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  room_code: string;
  profiles: {
    username: string;
  };
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
      // PGRST116 / 406 are "No rows" style conditions; ignore those
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
        // Ignore duplicate key, but surface other errors
        console.error("Failed to create profile row", insertError);
      }
    }
  } catch (e) {
    console.error("ensureProfileExists unexpected error", e);
  }
};

const StudyRooms = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDesc, setSessionDesc] = useState("");
  const [sessionRoom, setSessionRoom] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [globalRole, setGlobalRole] = useState<string>("student");

  const canScheduleSessions = globalRole === "teacher" || globalRole === "admin";

  useEffect(() => {
    checkUser();
    fetchRooms();
    fetchSessions();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    } else {
      setCurrentUser(user);
      await ensureProfileExists(user);
      // Fetch global role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (roleData?.role) {
        setGlobalRole(roleData.role);
      } else if (roleError) {
        console.error("Error fetching user role:", roleError);
      }
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("study_rooms")
        .select(`*, profiles:created_by (username)`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await supabase
        .from("study_sessions")
        .select("id, title, start_time, status, teacher_id, room_id")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(5);

      const teacherIds = Array.from(new Set((data || []).map((s: any) => s.teacher_id).filter(Boolean)));
      const roomIds = Array.from(new Set((data || []).map((s: any) => s.room_id).filter(Boolean)));

      let teacherNameMap = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", teacherIds);
        teacherNameMap = new Map((teachers || []).map((t: any) => [t.id, t.username || "Teacher"]));
      }

      let roomNameMap = new Map<string, string>();
      if (roomIds.length > 0) {
        const { data: roomRows } = await supabase
          .from("study_rooms")
          .select("id, name")
          .in("id", roomIds);
        roomNameMap = new Map((roomRows || []).map((r: any) => [r.id, r.name || "Study Room"]));
      }

      const normalized = (data || []).map((session: any) => ({
        ...session,
        profiles: { username: teacherNameMap.get(session.teacher_id) || "Teacher" },
        study_rooms: { name: roomNameMap.get(session.room_id) || "Study Room" },
      }));

      setSessions(normalized);
    } catch (e) {
      console.warn("Sessions join fetch failed:", e);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = roomSchema.parse({
        name: newRoomName,
        description: newRoomDescription,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await ensureProfileExists(user);

      // Step 1: Create room and get its ID back
      const { data: room, error: roomError } = await supabase
        .from("study_rooms")
        .insert({
          name: validated.name,
          description: validated.description,
          created_by: user.id,
          host_id: user.id,
          room_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Step 2: Insert creator as a participant with role = teacher
      await supabase.from("room_participants").insert({
        room_id: room.id,
        user_id: user.id,
        role: 'teacher',
        joined_at: new Date().toISOString()
      });

      toast({ title: "Room created!", description: `Room code: ${room.room_code}` });
      setCreateDialogOpen(false);
      setNewRoomName("");
      setNewRoomDescription("");
      fetchRooms();
    } catch (error: any) {
      console.error("Room creation error:", error);
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to create room.", 
          variant: "destructive" 
        });
      }
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await ensureProfileExists(user);

      // Add user as participant
      const { error } = await supabase
        .from("room_participants")
        .insert({
          room_id: roomId,
          user_id: user.id,
        });

      if (error && error.code !== "23505") throw error; // Ignore duplicate key error

      navigate(`/study-room/${roomId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
    if (!canScheduleSessions) {
      toast({
        title: "Not allowed",
        description: "Only teachers and admins can schedule sessions.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionTitle || !sessionTime || !sessionRoom || !currentUser) return;
    try {
      const { error } = await supabase.from('study_sessions').insert({
        title: sessionTitle,
        description: sessionDesc,
        room_id: sessionRoom,
        teacher_id: currentUser.id,
        start_time: new Date(sessionTime).toISOString(),
        status: 'scheduled'
      });
      if (error) throw error;
      toast({ title: "Session scheduled!" });
      setScheduleDialogOpen(false);
      setSessionTitle(""); setSessionDesc(""); setSessionRoom(""); setSessionTime("");
      fetchSessions();
    } catch (err: any) {
      toast({ title: "Failed to schedule", description: err.message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const sessionsToday = sessions.filter((session) => {
    const date = new Date(session.start_time);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070f] to-[#0a0e1a] p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Study Rooms</h1>
                <p className="text-sm text-gray-400">Join, host, and schedule collaborative classes.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:w-[360px]">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-cyan-200/80">Active Rooms</p>
                <p className="mt-1 text-2xl font-bold">{rooms.length}</p>
              </div>
              <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-violet-200/80">Upcoming</p>
                <p className="mt-1 text-2xl font-bold">{sessions.length}</p>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-amber-200/80">Today</p>
                <p className="mt-1 text-2xl font-bold">{sessionsToday}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
            <form onSubmit={handleJoinByCode} className="flex w-full max-w-md gap-2">
              <Input
                placeholder="Enter room code..."
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                className="h-10 border-white/15 bg-white/5 font-mono uppercase text-white placeholder:text-gray-500"
                maxLength={6}
              />
              <Button type="submit" variant="secondary" className="h-10 bg-white/10 text-white hover:bg-white/20" disabled={joinCode.length < 3}>
                Join
              </Button>
            </form>

            <div className="hidden h-6 w-px bg-white/15 xl:block" />

            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-500">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Study Room</DialogTitle>
                    <DialogDescription>Set up a new virtual study space</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="room-name">Room Name</Label>
                      <Input id="room-name" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Math Study Session" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="room-description">Description</Label>
                      <Textarea id="room-description" value={newRoomDescription} onChange={(e) => setNewRoomDescription(e.target.value)} placeholder="Let's work on chapter 5 problems together" />
                    </div>
                    <Button type="submit" className="w-full">Create Room</Button>
                  </form>
                </DialogContent>
              </Dialog>

              {canScheduleSessions && (
                <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10">
                      <Calendar className="h-4 w-4" /> Schedule Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Schedule a Class Session</DialogTitle>
                      <DialogDescription>Students will see this in their upcoming sessions.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleScheduleSession} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Session Title</Label>
                        <Input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="DSA Revision Class" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Room</Label>
                        <select value={sessionRoom} onChange={e => setSessionRoom(e.target.value)} className="w-full border border-border rounded-md p-2 bg-background text-foreground" required>
                          <option value="">Select Room...</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date & Time</Label>
                        <Input type="datetime-local" value={sessionTime} onChange={e => setSessionTime(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea value={sessionDesc} onChange={e => setSessionDesc(e.target.value)} placeholder="Topics we'll cover today..." />
                      </div>
                      <Button type="submit" className="w-full">Schedule Session</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}

              <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />Logout
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-52 rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <Card className="border-white/10 bg-white/[0.03] text-white">
            <CardContent className="py-14 text-center">
              <p className="text-gray-300 mb-5">No study rooms yet. Create one to get started.</p>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-500">
                <Plus className="h-4 w-4 mr-2" />
                Create First Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} className="group border-white/10 bg-white/[0.03] text-white transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_20px_50px_rgba(6,182,212,0.08)]">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg leading-tight">{room.name}</CardTitle>
                    <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">Active</Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-gray-400 min-h-10">
                    {room.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-cyan-300" />
                      <span>{room.profiles?.username || "Unknown"}</span>
                    </div>
                    <span className="text-xs">{new Date(room.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5">
                      <span className="text-[11px] font-mono uppercase text-gray-400">Code </span>
                      <span className="text-sm font-bold tracking-widest text-cyan-200">{room.room_code || '---'}</span>
                    </div>
                    <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400" onClick={() => handleJoinRoom(room.id)}>
                      Join
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Upcoming Sessions */}
        {sessions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-cyan-300" />
              Upcoming Sessions
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map(session => (
                <Card key={session.id} className="border border-white/10 bg-white/[0.03] text-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{session.title}</CardTitle>
                      <Badge variant="outline" className="text-[10px] border-cyan-400/30 text-cyan-300">{session.status}</Badge>
                    </div>
                    <CardDescription className="text-xs text-gray-400 line-clamp-2">{session.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                      <Crown className="h-3 w-3 text-amber-400" />
                      <span className="text-xs">{session.profiles?.username || 'Teacher'}</span>
                      <span className="text-xs text-gray-500">• {session.study_rooms?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cyan-300 mb-3">
                      <Clock className="h-3 w-3" />
                      {new Date(session.start_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {session.room_id && (
                      <Button size="sm" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400" onClick={() => handleJoinRoom(session.room_id)}>Join Room</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRooms;
