import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Plus, Users, FileText, TrendingUp, Clock, BookOpen, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Progress } from "@/components/ui/progress";
import AppSidebar from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const TeacherDashboard = () => {
  const { isAuthorized, isLoading } = useRequireRole('teacher');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [uploadedNotes, setUploadedNotes] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({
    avgQuizScore: 0,
    studentEngagement: 0,
    roomAttendance: 0
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch ALL rooms where teacher is creator OR host
        const { data: allTeacherRooms } = await supabase
          .from('study_rooms')
          .select('id')
          .or(`created_by.eq.${user.id},host_id.eq.${user.id}`);
        
        const allRoomIds = allTeacherRooms?.map(r => r.id) || [];

        // 2. Fetch study rooms for display (limit 3)
        const { data: roomsData } = await supabase
          .from('study_rooms')
          .select('*')
          .or(`created_by.eq.${user.id},host_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (roomsData) {
          const roomsWithCounts = await Promise.all(roomsData.map(async (room) => {
            const { count } = await supabase
              .from('room_participants')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id);
            
            return {
              id: room.id,
              name: room.name,
              students: count || 0,
              active: room.is_active
            };
          }));
          setMyRooms(roomsWithCounts);
        }

        // 3. Fetch all participants with 'student' role in teacher's rooms
        const { data: participants } = await supabase
          .from('room_participants')
          .select('user_id, profiles(username)')
          .in('room_id', allRoomIds)
          .eq('role', 'student');
        
        // Remove duplicates (same student in multiple rooms)
        const studentMap = new Map();
        (participants || []).forEach((p: any) => {
          if (!studentMap.has(p.user_id)) {
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            studentMap.set(p.user_id, {
              id: p.user_id,
              name: profile?.username || 'Unknown student',
              scores: [],
              quizzes: 0,
              progress: 0
            });
          }
        });

        // 4. Fetch quiz progress and merge into studentMap
        const { data: quizProgress } = await supabase
          .from('user_progress')
          .select('user_id, progress_data')
          .eq('content_type', 'quiz_set')
          .in('user_id', Array.from(studentMap.keys()));

        if (quizProgress) {
          quizProgress.forEach((p: any) => {
            const student = studentMap.get(p.user_id);
            if (student) {
              const score = p.progress_data?.score || 0;
              student.scores.push(score);
              student.quizzes++;
            }
          });

          // Calculate average progress for those who have quizzes
          studentMap.forEach((student) => {
            if (student.quizzes > 0) {
              student.progress = Math.round(student.scores.reduce((a: number, b: number) => a + b, 0) / student.quizzes);
            }
          });
        }

        // Set top 4 students (sorted by progress, then alphabetically)
        const topStudents = Array.from(studentMap.values())
          .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name))
          .slice(0, 4);

        setMyStudents(topStudents);

        const allScores = Array.from(studentMap.values()).flatMap((student: any) => student.scores || []);
        const avgScore = allScores.length > 0
          ? allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
          : 0;

        try {
          // 5. Update Analytics
          const { data: sessionData } = await supabase
            .from('study_sessions' as any)
            .select('*')
            .eq('teacher_id', user.id);

          setAnalytics(prev => ({
            ...prev,
            avgQuizScore: Math.round(avgScore),
            studentEngagement: Math.min(studentMap.size * 10, 100),
            roomAttendance: sessionData?.length ? Math.min(sessionData.length * 20, 100) : 0
          }));
        } catch (e) {
          console.warn("Analytics partial failure:", e);
          setAnalytics(prev => ({
            ...prev,
            avgQuizScore: Math.round(avgScore),
            studentEngagement: Math.min(studentMap.size * 10, 100)
          }));
        }

        // 6. Fetch recent objects (sessions and materials)
        let sessions = [];
        try {
          const { data: sData } = await supabase
            .from('study_sessions' as any)
            .select('*')
            .eq('teacher_id', user.id)
            .order('start_time', { ascending: false })
            .limit(10);
          if (sData) sessions = sData;
        } catch (e) { console.warn("Sessions fetch failed:", e); }

        let materials = [];
        try {
          const { data: mData } = await supabase
            .from('session_materials' as any)
            .select('*')
            .eq('uploaded_by', user.id)
            .order('created_at', { ascending: false })
            .limit(3);
          if (mData) materials = mData;
        } catch (e) { console.warn("Materials fetch failed:", e); }
        
        if (materials.length > 0) {
          setUploadedNotes(materials.map((m: any) => ({
            id: m.id,
            title: m.title,
            views: 0, 
            uploaded: new Date(m.created_at).toLocaleDateString()
          })));
        }

        // Build recent activity
        const activities = [];
        
        if (sessions && sessions.length > 0) {
          sessions.slice(0, 2).forEach((session: any) => {
            activities.push({
              id: `session-${session.id}`,
              action: `Session "${session.title}" scheduled`,
              time: new Date(session.start_time).toLocaleDateString(),
              icon: Video
            });
          });
        }

        if (materials && materials.length > 0) {
          activities.push({
            id: 'material-recent',
            action: `Material "${materials[0].title}" uploaded`,
            time: new Date(materials[0].created_at).toLocaleDateString(),
            icon: FileText
          });
        }

        setRecentActivity(activities.slice(0, 4));

      } catch (error) {
        console.error('Error fetching teacher data:', error);
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        });
      } finally {
        setLoadingData(false);
      }
    };

    if (isAuthorized && !isLoading) {
      fetchTeacherData();
    }
  }, [isAuthorized, isLoading, toast]);

  if (isLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Teacher Dashboard 👨‍🏫</h1>
            <p className="text-muted-foreground">Manage your classes, students, and content</p>
          </header>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Button className="h-24 flex flex-col gap-2" onClick={() => navigate("/study-rooms")}>
              <Plus className="h-6 w-6" />
              Create Room
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => navigate("/teacher/notes")}
            >
              <FileText className="h-6 w-6" />
              Upload Notes
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => navigate("/teacher/quizzes")}
            >
              <Brain className="h-6 w-6" />
              Generate Quiz
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => navigate("/teacher/students")}
            >
              <Users className="h-6 w-6" />
              View Students
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => navigate("/teacher/learning-styles")}
            >
              <Brain className="h-6 w-6" />
              Learning Styles
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* My Study Rooms */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  My Study Rooms
                </CardTitle>
                <CardDescription>Active and archived rooms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myRooms.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No study rooms yet. Create your first room!</p>
                  ) : (
                    myRooms.map((room) => (
                    <div key={room.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <h3 className="font-semibold">{room.name}</h3>
                        <p className="text-sm text-muted-foreground">{room.students} students</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${room.active ? 'bg-green-500/10 text-green-500' : 'bg-muted-foreground/10 text-muted-foreground'}`}>
                          {room.active ? 'Active' : 'Archived'}
                        </span>
                        <Button size="sm" variant="outline">View</Button>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* My Students */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  My Students
                </CardTitle>
                <CardDescription>Recent student performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No student data available yet.</p>
                  ) : (
                  myStudents.map((student) => (
                    <div key={student.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{student.name}</h3>
                          <p className="text-xs text-muted-foreground">{student.quizzes} quizzes completed</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">{student.progress}%</span>
                      </div>
                      <Progress value={student.progress} className="h-2" />
                    </div>
                  ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Uploaded Notes */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Uploaded Notes
                </CardTitle>
                <CardDescription>Most viewed materials</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadedNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No videos uploaded yet.</p>
                  ) : (
                  uploadedNotes.map((note) => (
                    <div key={note.id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:shadow-medium transition-all">
                      <div>
                        <h3 className="font-semibold">{note.title}</h3>
                        <p className="text-sm text-muted-foreground">{note.views} views • {note.uploaded}</p>
                      </div>
                      <Button size="sm" variant="ghost">Edit</Button>
                    </div>
                  ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Analytics */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Performance Analytics
                </CardTitle>
                <CardDescription>Overall class metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Average Quiz Score</span>
                      <span className="text-2xl font-bold text-primary">{analytics.avgQuizScore}%</span>
                    </div>
                    <Progress value={analytics.avgQuizScore} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Student Engagement</span>
                      <span className="text-2xl font-bold text-primary">{analytics.studentEngagement}%</span>
                    </div>
                    <Progress value={analytics.studentEngagement} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Room Attendance</span>
                      <span className="text-2xl font-bold text-primary">{analytics.roomAttendance}%</span>
                    </div>
                    <Progress value={analytics.roomAttendance} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generate AI Quiz Panel */}
            <Card className="shadow-soft border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Quiz Generator
                </CardTitle>
                <CardDescription>Generate custom quizzes using AI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-4">
                      Create custom quizzes based on your uploaded notes and topics using AI
                    </p>
                    <Button className="w-full" size="lg" onClick={() => navigate("/teacher/quizzes")}>
                      <Brain className="mr-2 h-5 w-5" />
                      Generate Quiz with AI
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest updates from your classes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
                  ) : (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <activity.icon className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;
