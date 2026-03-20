import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, Trash2, Edit, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireRole } from "@/hooks/useRequireRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppSidebar from "@/components/AppSidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Session {
  id: string;
  title: string;
  description: string | null;
  scheduled_time: string;
  duration_minutes: number;
  teacher_id: string;
  max_participants: number | null;
  study_room_id: string | null;
  status: string;
  profiles?: {
    username: string;
  };
  enrolled_count?: number;
}

const SessionManagement = () => {
  const { isAuthorized, isLoading } = useRequireRole('admin');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_time: '',
    duration_minutes: 60,
    teacher_id: '',
    max_participants: '',
    status: 'scheduled'
  });

  useEffect(() => {
    if (isAuthorized) {
      fetchSessions();
      fetchTeachers();
    }
  }, [isAuthorized]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('sessions')
        .select(`
          id,
          title,
          description,
          scheduled_time,
          duration_minutes,
          teacher_id,
          max_participants,
          study_room_id,
          status,
          profiles!sessions_teacher_id_fkey(username)
        `)
        .order('scheduled_time', { ascending: false });

      if (error) throw error;

      // Get enrollment counts
      const sessionsWithCounts = await Promise.all(
        (data || []).map(async (session: Session) => {
          const { count } = await (supabase as any)
            .from('session_participants')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', session.id);
          
          return { ...session, enrolled_count: count || 0 };
        })
      );

      setSessions(sessionsWithCounts);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load sessions.",
        variant: "destructive",
      });
    }
  };

  const fetchTeachers = async () => {
    try {
      // First, get all user IDs with teacher or admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['teacher', 'admin']);

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        console.log('No teachers or admins found');
        setTeachers([]);
        return;
      }

      const userIds = roleData.map(r => r.user_id);

      // Then fetch profiles for those users
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      if (profileError) throw profileError;

      console.log('Fetched teachers:', profileData);
      setTeachers(profileData || []);
    } catch (error: any) {
      console.error('Error fetching teachers:', error);
      toast({
        title: "Error",
        description: "Failed to load teachers.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.teacher_id) {
      toast({
        title: "Error",
        description: "Please select a teacher for the session.",
        variant: "destructive",
      });
      return;
    }

    try {
      let studyRoomId = editingSession?.study_room_id;

      // Create a study room if this is a new session
      if (!editingSession) {
        // Get current admin user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: "Error",
            description: "You must be logged in to create a session.",
            variant: "destructive",
          });
          return;
        }

        const { data: roomData, error: roomError } = await supabase
          .from('study_rooms')
          .insert([{
            name: formData.title,
            description: formData.description || `Study session scheduled for ${new Date(formData.scheduled_time).toLocaleString()}`,
            created_by: user.id, // Admin creates the room
            max_participants: formData.max_participants ? parseInt(formData.max_participants) : 10,
            is_active: true
          }])
          .select()
          .single();

        if (roomError) {
          console.error('Error creating study room:', roomError);
          toast({
            title: "Error",
            description: `Failed to create study room: ${roomError.message}`,
            variant: "destructive",
          });
          return;
        }

        studyRoomId = roomData.id;
      }

      const sessionData = {
        title: formData.title,
        description: formData.description || null,
        scheduled_time: new Date(formData.scheduled_time).toISOString(),
        duration_minutes: formData.duration_minutes,
        teacher_id: formData.teacher_id,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        study_room_id: studyRoomId,
        status: formData.status
      };

      let error;
      if (editingSession) {
        const result = await (supabase as any)
          .from('sessions')
          .update(sessionData)
          .eq('id', editingSession.id);
        error = result.error;
      } else {
        const result = await (supabase as any)
          .from('sessions')
          .insert([sessionData]);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: editingSession ? "Session updated successfully." : "Session created successfully.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchSessions();
    } catch (error: any) {
      console.error('Error saving session:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save session.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const { error } = await (supabase as any)
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session deleted successfully.",
      });

      fetchSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: "Failed to delete session.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setFormData({
      title: session.title,
      description: session.description || '',
      scheduled_time: new Date(session.scheduled_time).toISOString().slice(0, 16),
      duration_minutes: session.duration_minutes,
      teacher_id: session.teacher_id,
      max_participants: session.max_participants?.toString() || '',
      status: session.status
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingSession(null);
    setFormData({
      title: '',
      description: '',
      scheduled_time: '',
      duration_minutes: 60,
      teacher_id: '',
      max_participants: '',
      status: 'scheduled'
    });
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Session Management</h1>
              <p className="text-muted-foreground">Schedule and manage study sessions</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingSession ? 'Edit Session' : 'Schedule New Session'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingSession 
                      ? 'Update the session details below.' 
                      : 'Create a new study session for students.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="title">Session Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Mathematics 101 - Algebra Basics"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what will be covered in this session..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="scheduled_time">Scheduled Time *</Label>
                      <Input
                        id="scheduled_time"
                        type="datetime-local"
                        value={formData.scheduled_time}
                        onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="duration">Duration (minutes) *</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={formData.duration_minutes}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                        min="15"
                        step="15"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="teacher">Teacher *</Label>
                    {teachers.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                        No teachers available. Please assign teacher role to users first.
                      </div>
                    ) : (
                      <Select
                        value={formData.teacher_id}
                        onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max_participants">Max Participants</Label>
                      <Input
                        id="max_participants"
                        type="number"
                        value={formData.max_participants}
                        onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                        placeholder="Leave empty for unlimited"
                        min="1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="status">Status *</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                      ℹ️ A study room will be automatically created for this session. Students and teachers can join using the "Join" button.
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingSession ? 'Update Session' : 'Create Session'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </header>

          {/* Sessions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                All Sessions
              </CardTitle>
              <CardDescription>
                Showing {sessions.length} session(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">No sessions scheduled yet</p>
                  <p className="text-sm">Click the "Schedule Session" button to create your first session</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-start justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{session.title}</h3>
                            {session.description && (
                              <p className="text-sm text-muted-foreground mb-2">{session.description}</p>
                            )}
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span>📅 {formatDateTime(session.scheduled_time)}</span>
                              <span>⏱️ {session.duration_minutes} minutes</span>
                              <span>👨‍🏫 {session.profiles?.username || 'Unknown'}</span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {session.enrolled_count || 0}
                                {session.max_participants && ` / ${session.max_participants}`}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                session.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                session.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                                session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {session.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            {session.study_room_id && (
                              <Button
                                size="sm"
                                variant="link"
                                className="mt-2 p-0 h-auto text-xs"
                                onClick={() => navigate(`/study-room/${session.study_room_id}`)}
                              >
                                🔗 Join Study Room
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {session.study_room_id && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => navigate(`/study-room/${session.study_room_id}`)}
                          >
                            Join
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(session)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(session.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SessionManagement;
