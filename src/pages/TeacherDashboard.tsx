import { useState, useEffect, useMemo } from "react";
import { motion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Brain, 
  Plus, 
  Users, 
  FileText, 
  TrendingUp, 
  Clock, 
  BookOpen, 
  Video,
  Menu,
  ChevronRight,
  Bell,
  Search,
  Zap,
  Target,
  BarChart3,
  Sparkles,
  LayoutGrid,
  AlertCircle,
  MessageSquare,
  ArrowUpRight,
  Lightbulb,
  CalendarDays,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireRole } from "@/hooks/useRequireRole";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];
const MAX_CLASSROOM_CARDS = 12;
const CRITICAL_TOPIC_THRESHOLD = 60;

type TeacherRoom = {
  id: string;
  name: string;
  students: number;
  active: boolean;
};

type TeacherStudent = {
  id: string;
  name: string;
  scores: number[];
  quizzes: number;
  activity: number;
  progress: number;
  lastUpdatedAt?: string;
};

type TeacherSession = {
  id: string;
  title: string;
  start_time: string;
  end_time?: string | null;
  status?: string | null;
  room_id?: string | null;
};

const TeacherDashboard = () => {
  const { isAuthorized, isLoading } = useRequireRole('teacher');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [uploadedNotes, setUploadedNotes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({
    avgQuizScore: 0,
    studentEngagement: 0,
    roomAttendance: 0
  });
  const [loadingData, setLoadingData] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Advanced Intelligence States
  const [learningStyles, setLearningStyles] = useState<any[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [topicHeatmap, setTopicHeatmap] = useState<any[]>([]);
  const [engagementMatrix, setEngagementMatrix] = useState<any[]>([]);
  const [teacherSessions, setTeacherSessions] = useState<TeacherSession[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionRoomId, setNewSessionRoomId] = useState("");
  const [newSessionDateTime, setNewSessionDateTime] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);

  const visibleRooms = useMemo(
    () => myRooms.filter((room) => room.active).slice(0, MAX_CLASSROOM_CARDS),
    [myRooms]
  );

  const SIDEBAR_COLLAPSE_KEY = "edusync.sidebar.collapsed";

  useEffect(() => {
    const checkSidebar = () => {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      setIsSidebarCollapsed(raw === "1");
    };
    checkSidebar();
    window.addEventListener("edusync:sidebar-toggled", checkSidebar);
    return () => window.removeEventListener("edusync:sidebar-toggled", checkSidebar);
  }, []);

  const tabs = [
    { id: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "classrooms", label: "Classrooms", icon: <Video className="h-4 w-4" /> },
    { id: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" /> },
    { id: "content", label: "Content", icon: <FileText className="h-4 w-4" /> },
  ];

  const formatDateKey = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  };

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>();
    myRooms.forEach((room: TeacherRoom) => {
      map.set(room.id, room.name);
    });
    return map;
  }, [myRooms]);

  const sessionDates = useMemo(() => {
    return teacherSessions.map((s) => {
      const d = new Date(s.start_time);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [teacherSessions]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedCalendarDate) return [] as TeacherSession[];
    const selectedKey = formatDateKey(selectedCalendarDate);
    return teacherSessions
      .filter((session) => formatDateKey(new Date(session.start_time)) === selectedKey)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [selectedCalendarDate, teacherSessions]);

  const todaySessions = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return teacherSessions
      .filter((session) => formatDateKey(new Date(session.start_time)) === todayKey)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [teacherSessions]);

  const fetchTeacherSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("study_sessions")
      .select("id, title, start_time, end_time, status, room_id, teacher_id")
      .eq("teacher_id", user.id)
      .order("start_time", { ascending: true });

    if (error) {
      console.warn("Failed to fetch teacher sessions:", error.message);
      return;
    }

    setTeacherSessions((data || []) as TeacherSession[]);
  };

  const createTeacherSession = async () => {
    if (!newSessionTitle.trim() || !newSessionDateTime || !newSessionRoomId) {
      toast({
        title: "Missing information",
        description: "Please provide title, room, and date/time.",
        variant: "destructive",
      });
      return;
    }

    setCreatingSession(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload: Record<string, any> = {
        title: newSessionTitle.trim(),
        room_id: newSessionRoomId,
        teacher_id: user.id,
        start_time: new Date(newSessionDateTime).toISOString(),
        status: "scheduled",
      };

      const endDate = new Date(newSessionDateTime);
      endDate.setMinutes(endDate.getMinutes() + 60);
      payload.end_time = endDate.toISOString();

      const { error } = await supabase.from("study_sessions").insert(payload);
      if (error) throw error;

      toast({
        title: "Session scheduled",
        description: "Your class session has been added to calendar.",
      });

      setNewSessionTitle("");
      setNewSessionRoomId("");
      setNewSessionDateTime("");
      await fetchTeacherSessions();
      setLastSyncedAt(new Date());
    } catch (error: any) {
      toast({
        title: "Unable to schedule",
        description: error?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setCreatingSession(false);
    }
  };

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Basic Data (Rooms, Assigned Students, Materials)
        const { data: roomsData } = await supabase
          .from('study_rooms')
          .select('id, name, is_active, created_at')
          .or(`created_by.eq.${user.id},host_id.eq.${user.id}`)
          .order('created_at', { ascending: false });
        
        let roomsWithCounts: TeacherRoom[] = [];
        if (roomsData) {
          roomsWithCounts = await Promise.all(roomsData.map(async (room) => {
            const { count } = await supabase
              .from('room_participants')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id);
            
            return {
              id: room.id,
              name: room.name,
              students: count || 0,
              active: room.is_active !== false
            };
          }));
          setMyRooms(roomsWithCounts);
        }

        const { data: assignedRows } = await supabase
          .from('teacher_student_assignments' as any)
          .select('student_id')
          .eq('teacher_id', user.id);

        const assignedStudentIds = Array.from(new Set((assignedRows || []).map((row: any) => row.student_id)));

        if (assignedStudentIds.length === 0) {
          setMyStudents([]);
          setLearningStyles([]);
          setTopicHeatmap([]);
          setAtRiskStudents([]);
          setEngagementMatrix([]);
          setAnalytics({ avgQuizScore: 0, studentEngagement: 0, roomAttendance: 0 });
          setUploadedNotes([]);
          setLastSyncedAt(new Date());
          return;
        }

        const { data: studentRoles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', assignedStudentIds);

        const validStudentIds = (studentRoles || [])
          .filter((row: any) => row.role === 'student')
          .map((row: any) => row.user_id);

        if (validStudentIds.length === 0) {
          setMyStudents([]);
          setLearningStyles([]);
          setTopicHeatmap([]);
          setAtRiskStudents([]);
          setEngagementMatrix([]);
          setAnalytics({ avgQuizScore: 0, studentEngagement: 0, roomAttendance: 0 });
          setLastSyncedAt(new Date());
          return;
        }

        const { data: studentProfiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', validStudentIds);

        const profileMap = new Map((studentProfiles || []).map((p: any) => [p.id, p.username || 'Unknown student']));
        
        const studentMap = new Map<string, TeacherStudent>();
        validStudentIds.forEach((studentId: string) => {
          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              id: studentId,
              name: profileMap.get(studentId) || 'Unknown student',
              scores: [],
              quizzes: 0,
              activity: 0,
              progress: 0,
              lastUpdatedAt: undefined,
            });
          }
        });

        const studentIds = Array.from(studentMap.keys());

        const { data: teacherQuizSets } = await supabase
          .from('quiz_sets')
          .select('id')
          .eq('created_by', user.id);

        const teacherQuizIds = (teacherQuizSets || []).map((q: any) => q.id);

        // 2. Fetch Learning Styles Distribution
        if (studentIds.length > 0) {
          const { data: stylesData } = await supabase
            .from('learning_styles')
            .select('style')
            .in('user_id', studentIds);

          if (stylesData) {
            const styleCounts: Record<string, number> = {};
            stylesData.forEach((s: any) => {
              styleCounts[s.style] = (styleCounts[s.style] || 0) + 1;
            });
            setLearningStyles(Object.entries(styleCounts).map(([name, value]) => ({ name, value })));
          }
        }

        // 3. Process Topic Heatmap and Student Progress
        if (studentIds.length > 0 && teacherQuizIds.length > 0) {
          const { data: quizProgress } = await supabase
            .from('user_progress')
            .select('user_id, progress_data, updated_at')
            .eq('content_type', 'quiz_set')
            .in('user_id', studentIds)
            .in('content_id', teacherQuizIds);

          if (quizProgress) {
          const topicAgg: Record<string, { total: number, count: number }> = {};

          quizProgress.forEach((p: any) => {
            const student = studentMap.get(p.user_id);
            if (student) {
              const score = p.progress_data?.score || 0;
              const topic = p.progress_data?.quiz_topic || p.progress_data?.topic || "General";
              student.scores.push(score);
              student.quizzes++;
              student.lastUpdatedAt = p.updated_at;

              // Heatmap Logic
              if (!topicAgg[topic]) topicAgg[topic] = { total: 0, count: 0 };
              topicAgg[topic].total += score;
              topicAgg[topic].count += 1;
            }
          });

          setTopicHeatmap(Object.entries(topicAgg).map(([name, data]) => ({
            name,
            score: Math.round(data.total / data.count)
          })).sort((a, b) => a.score - b.score).slice(0, 5));

          studentMap.forEach((student) => {
            if (student.quizzes > 0) {
              student.progress = Math.round(student.scores.reduce((a: number, b: number) => a + b, 0) / student.quizzes);
            }

            const recencyWeight = student.lastUpdatedAt
              ? Math.max(0, 30 - Math.floor((Date.now() - new Date(student.lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24)))
              : 0;
            student.activity = Math.min(100, student.quizzes * 10 + recencyWeight);
          });

          // 4. At-Risk Detection Logic
          const riskList = Array.from(studentMap.values())
            .filter(s => s.progress < 60)
            .map(s => ({
              id: s.id,
              name: s.name,
              score: s.progress,
              trend: "down",
              lastActive: "2 days ago"
            }));
          setAtRiskStudents(riskList.slice(0, 3));

          // 5. Engagement Matrix (X=Activity, Y=Performance)
          setEngagementMatrix(Array.from(studentMap.values()).map(s => ({
            name: s.name,
            activity: s.activity,
            performance: s.progress,
            z: 10
          })));
          }
        }

        const topStudents = Array.from(studentMap.values())
          .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name))
          .slice(0, 4);
        setMyStudents(topStudents);

        const allScores = Array.from(studentMap.values()).flatMap((student: any) => student.scores || []);
        const avgScore = allScores.length > 0
          ? allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
          : 0;

        setAnalytics(prev => ({
          ...prev,
          avgQuizScore: Math.round(avgScore),
          studentEngagement: studentMap.size > 0
            ? Math.round(Array.from(studentMap.values()).reduce((sum, s) => sum + s.activity, 0) / studentMap.size)
            : 0,
          roomAttendance: roomsWithCounts.length > 0
            ? Math.round((roomsWithCounts.filter((r) => r.active).length / roomsWithCounts.length) * 100)
            : 0,
        }));

        // Fetch materials for ROI
        const { data: mData } = await supabase
          .from('session_materials' as any)
          .select('*')
          .eq('uploaded_by', user.id)
          .order('created_at', { ascending: false });
        
        if (mData) {
          setUploadedNotes(mData.map((m: any) => ({
            id: m.id,
            title: m.title,
            views: m.download_count || 0,
            uploaded: new Date(m.created_at).toLocaleDateString(),
            impact: (m.download_count || 0) > 25 ? "High" : "Medium"
          })));
        }

        setLastSyncedAt(new Date());

      } catch (error) {
        console.error("Dashboard Intelligence Error:", error);
      } finally {
        setLoadingData(false);
      }
    };

    if (isAuthorized && !isLoading) {
      fetchTeacherData();
      fetchTeacherSessions();
    }
  }, [isAuthorized, isLoading]);

  const primaryLearningStyle = useMemo(() => {
    if (learningStyles.length === 0) {
      return { name: "No data", value: 0 };
    }
    return [...learningStyles].sort((a, b) => b.value - a.value)[0];
  }, [learningStyles]);

  const weakestTopic = useMemo(
    () => (topicHeatmap.length > 0 ? topicHeatmap[0] : null),
    [topicHeatmap]
  );
  const hasCriticalTopicGap = Boolean(weakestTopic && weakestTopic.score < CRITICAL_TOPIC_THRESHOLD);
  const hasEngagementChartData = engagementMatrix.length >= 3;

  const nextBestActions = useMemo(() => {
    const topRisk = atRiskStudents[0] || null;
    const topMaterial = uploadedNotes.length > 0
      ? [...uploadedNotes].sort((a, b) => b.views - a.views)[0]
      : null;

    return [
      {
        id: 1,
        type: "remediation",
        title: weakestTopic ? `Revise Topic: ${weakestTopic.name}` : "Build first diagnostic quiz",
        desc: weakestTopic
          ? `Average score is ${weakestTopic.score}%. Recommend focused remediation.`
          : "No topic performance data yet. Start by publishing one quiz.",
        icon: Target,
        action: "Open Quizzes",
        onClick: () => navigate("/teacher/quizzes"),
      },
      {
        id: 2,
        type: "outreach",
        title: topRisk ? `Reach out to ${topRisk.name}` : "No at-risk learners detected",
        desc: topRisk
          ? `${topRisk.name} is at ${topRisk.score}%. Schedule an intervention this week.`
          : "Great job. Keep monitoring engagement and retention trends.",
        icon: Users,
        action: "Open Students",
        onClick: () => navigate("/teacher/students"),
      },
      {
        id: 3,
        type: "content",
        title: topMaterial ? "Top Material Detected" : "Upload teaching material",
        desc: topMaterial
          ? `${topMaterial.title} has ${topMaterial.views} views and strong learner pickup.`
          : "Add notes to unlock content performance insights.",
        icon: Zap,
        action: "Open Notes",
        onClick: () => navigate("/teacher/notes"),
      },
    ];
  }, [weakestTopic, atRiskStudents, uploadedNotes, navigate]);

  const floatingGlassCardClass =
    "rounded-3xl bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300";

  const SpotlightCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        onMouseMove={handleMouseMove}
        whileHover={{ y: -5, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn("group relative overflow-hidden", className)}
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                650px circle at ${mouseX}px ${mouseY}px,
                rgba(139, 92, 246, 0.15),
                transparent 80%
              )
            `,
          }}
        />
        {children}
      </motion.div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-8">
      {/* 🚀 NEXT BEST ACTION ENGINE */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-2">
            <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
            <h2 className="text-[10px] tracking-[0.2em] font-black text-slate-500 uppercase">Strategic Priority (Next Best Actions)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {nextBestActions.map((action, idx) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(floatingGlassCardClass, "p-5 border-l-4 border-l-violet-500 flex flex-col justify-between group cursor-pointer hover:bg-violet-500/[0.02]")}
              onClick={action.onClick}
            >
               <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                      <ChevronRight className="h-4 w-4" />
                  </Button>
               </div>
               <div>
                  <h4 className="font-bold text-sm mb-1">{action.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed truncate">{action.desc}</p>
               </div>
               <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-violet-500">{action.type}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:underline">{action.action}</span>
               </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CLASS INTELLIGENCE LAYER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-xl font-bold">Class Intelligence</h3>
                 <p className="text-xs text-slate-500 mt-1">Learning style distribution & insights</p>
              </div>
              <Lightbulb className="h-5 w-5 text-violet-500" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="h-[200px] relative">
                {learningStyles.length === 0 ? (
                 <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02]">
                  <p className="text-xs text-slate-500">No learning style responses yet.</p>
                 </div>
                ) : (
                 <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                        data={learningStyles}
                        cx="50%" cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                         {learningStyles.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                       contentStyle={{ backgroundColor: '#0f0f0f', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                       itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                       <p className="text-2xl font-black text-slate-900 dark:text-white">{primaryLearningStyle.value}%</p>
                       <p className="text-[8px] uppercase font-bold text-slate-400">{primaryLearningStyle.name}</p>
                    </div>
                  </div>
                 </>
                )}
              </div>

              <div className="space-y-4">
                 <h4 className="text-[10px] uppercase font-bold text-violet-500 tracking-widest">Faculty Coach Action</h4>
                 <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/10">
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 italic">
                        {learningStyles.length > 0
                         ? `Your class is predominantly ${primaryLearningStyle.name}. Blend your next session with ${primaryLearningStyle.name.toLowerCase()}-first content to improve retention.`
                         : "No learning style data yet. Ask students to complete the learning style quiz for tailored recommendations."}
                      </p>
                 </div>
                      <Button variant="outline" size="sm" className="w-full rounded-xl text-[10px] h-9 border-violet-500/20 text-violet-500 font-bold hover:bg-violet-500 hover:text-white transition-all" onClick={() => navigate("/teacher/learning-styles")}>
                      {learningStyles.length > 0 ? "Apply to Lesson Plan" : "Collect Responses"}
                 </Button>
              </div>
           </div>
        </SpotlightCard>

        {/* Topic Difficulty Heatmap */}
        <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-xl font-bold">Topic Difficulty</h3>
                 <p className="text-xs text-slate-500 mt-1">Knowledge gaps requiring remediation</p>
              </div>
              <BarChart3 className="h-5 w-5 text-violet-500" />
           </div>
           
           <div className="h-[250px] w-full">
              {topicHeatmap.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">
                  No topic performance data yet.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={topicHeatmap}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 10 }} 
                    />
                    <YAxis 
                      hide 
                      domain={[0, 100]} 
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ backgroundColor: '#0f0f0f', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                        {topicHeatmap.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.score < 60 ? "#ef4444" : "#8b5cf6"} fillOpacity={entry.score < 60 ? 0.4 : 0.8} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
                  )}
           </div>
           
                 <div className="mt-4 flex items-center justify-between p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                    <div className={cn("flex items-center gap-2", hasCriticalTopicGap ? "text-rose-500" : "text-violet-500")}>
                 <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-bold font-mono uppercase tracking-tight">
                         {weakestTopic
                           ? hasCriticalTopicGap
                             ? `Critical Gap: ${weakestTopic.name} @ ${weakestTopic.score}%`
                             : `Focus Topic: ${weakestTopic.name} @ ${weakestTopic.score}%`
                           : "No topic performance data yet"}
                    </span>
              </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "rounded-xl h-8 px-4 font-bold text-[10px]",
                        hasCriticalTopicGap
                          ? "text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                          : "text-violet-500 hover:bg-violet-500/10 hover:text-violet-600"
                      )}
                      onClick={() => navigate("/teacher/quizzes")}
                    >
                        {hasCriticalTopicGap ? "Launch AI Fix" : "Review Quizzes"}
              </Button>
           </div>
        </SpotlightCard>
      </div>

      {/* STUDENT INTELLIGENCE LAYER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Engagement Velocity Matrix */}
         <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-xl font-bold">Engagement Velocity</h3>
                  <p className="text-xs text-slate-500 mt-1">Mapping Performance vs Activity</p>
               </div>
               <BarChart3 className="h-5 w-5 text-violet-500" />
            </div>

            <div className="h-[280px] w-full relative">
               {hasEngagementChartData ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                       <XAxis
                         type="number"
                         dataKey="activity"
                         name="Activity"
                         domain={[0, 100]}
                         tickLine={false}
                         axisLine={false}
                         tick={{ fill: '#64748b', fontSize: 11 }}
                         label={{ value: 'Activity', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }}
                       />
                       <YAxis
                         type="number"
                         dataKey="performance"
                         name="Performance"
                         domain={[0, 100]}
                         tickLine={false}
                         axisLine={false}
                         tick={{ fill: '#64748b', fontSize: 11 }}
                         label={{ value: 'Performance', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                       />
                       <ZAxis type="number" dataKey="z" range={[80, 260]} />
                       <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{ backgroundColor: '#0f0f0f', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                          itemStyle={{ color: '#fff' }}
                       />
                      <Scatter name="Students" data={engagementMatrix} fill="#8b5cf6" />
                    </ScatterChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] text-center px-8">
                    <p className="text-sm text-slate-500">
                      Need at least 3 active learners with quiz attempts to render a meaningful engagement map.
                    </p>
                 </div>
               )}
            </div>
            <div className="mt-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
              <p className="text-xs text-indigo-400 font-medium">
                {hasEngagementChartData
                  ? "Insight: Mix high performers with low-engagement learners in upcoming rooms."
                  : "Insight: The map appears once enough student activity is available."}
              </p>
              <Button size="icon" variant="ghost" className="h-10 w-10 text-indigo-500 rounded-xl hover:bg-indigo-500/10" onClick={() => navigate("/teacher/students")}>
                  <ArrowUpRight className="h-4 w-4" />
               </Button>
            </div>
         </SpotlightCard>

         {/* At-Risk Alerts */}
         <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-xl font-bold">Needs Attention</h3>
                  <p className="text-xs text-slate-500 mt-1">Proactive intervention required</p>
               </div>
               <AlertCircle className="h-5 w-5 text-rose-500" />
            </div>

            <div className="space-y-4">
               {atRiskStudents.length === 0 ? (
                 <div className="h-[200px] flex items-center justify-center text-slate-500 italic text-sm">No critical risks detected.</div>
               ) : (
                 atRiskStudents.map((student, idx) => (
                   <motion.div 
                    key={student.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between group hover:border-rose-500/30 transition-all"
                   >
                       <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 font-bold">
                             {student.name.charAt(0)}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</p>
                              <p className="text-[10px] text-rose-500 font-medium tracking-tight">Avg: {student.score}%</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-rose-500 rounded-xl hover:bg-rose-500/10">
                             <MessageSquare className="h-4 w-4" />
                          </Button>
                            <Button size="sm" variant="outline" className="rounded-xl h-9 border-rose-500/20 text-rose-500 text-[10px] font-bold" onClick={() => navigate("/teacher/students")}>
                             Intervene
                          </Button>
                       </div>
                   </motion.div>
                 ))
               )}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 tracking-widest">
                View Full Roster
            </Button>
         </SpotlightCard>
      </div>

    </div>
  );

  const renderClassrooms = () => (
    <div className="space-y-8">
       <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Class Average", value: `${analytics.avgQuizScore}%`, icon: TrendingUp },
          { label: "Engagement", value: `${analytics.studentEngagement}%`, icon: Users },
          { label: "Active Rooms", value: `${visibleRooms.length}`, icon: Video },
          { label: "Attendance", value: `${analytics.roomAttendance}%`, icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className={cn(floatingGlassCardClass, "p-4 flex items-center gap-4 bg-slate-50/[0.1]")}>
             <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                <stat.icon className="h-4 w-4" />
             </div>
             <div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{stat.value}</p>
             </div>
          </div>
        ))}
      </section>

       <div className="flex flex-wrap gap-4 px-2">
            <Button className="h-14 px-8 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-black font-bold shadow-lg shadow-violet-500/20" onClick={() => navigate("/study-rooms")}>
            <Plus className="mr-2 h-5 w-5" /> Create New Room
          </Button>
          <Button variant="outline" className="h-14 px-8 rounded-2xl border-slate-200 dark:border-white/10 font-bold" onClick={() => navigate("/study-rooms")}>
            Join Active Session
          </Button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
             <h3 className="text-xl font-bold mb-1">Scheduled Rooms</h3>
             <p className="text-xs text-slate-500 mb-5">Showing latest active rooms only ({visibleRooms.length}/{myRooms.length}).</p>
             <div className="space-y-4">
                {visibleRooms.length === 0 && (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-sm text-slate-500">
                    No classrooms yet. Create your first room to start tracking participation.
                  </div>
                )}
                {visibleRooms.map((room, idx) => (
                   <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group p-5 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
                   >
                      <div>
                         <h4 className="font-bold text-slate-900 dark:text-white">{room.name}</h4>
                         <p className="text-xs text-slate-500 mt-1">{room.students} Participants enrolled</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className={cn(
                           "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                           room.active ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                         )}>
                            {room.active ? "Live" : "Idle"}
                         </span>
                         <Button size="sm" variant="ghost" className="rounded-xl h-9" onClick={() => navigate(`/study-room/${room.id}`)}>Manage</Button>
                      </div>
                   </motion.div>
                ))}
             </div>
          </SpotlightCard>

          <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
             <h3 className="text-xl font-bold mb-6">Recent Top Performers</h3>
             <div className="space-y-6">
                {myStudents.length === 0 && (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-sm text-slate-500">
                    No student performance data yet.
                  </div>
                )}
                {myStudents.map((student, idx) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="space-y-2"
                  >
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center font-bold text-violet-500 text-xs">
                              {student.name.charAt(0)}
                           </div>
                           <span className="text-sm font-bold">{student.name}</span>
                        </div>
                        <span className="text-xs font-black text-violet-500">{student.progress}%</span>
                     </div>
                     <Progress value={student.progress} className="h-1.5" />
                  </motion.div>
                ))}
             </div>
          </SpotlightCard>
       </div>
    </div>
  );

  const renderContent = () => (
    <div className="space-y-8">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SpotlightCard className={cn(floatingGlassCardClass, "p-8 border-violet-500/30 shadow-[0_20px_40px_rgba(139,92,246,0.1)]")}>
             <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-violet-500 flex items-center justify-center text-white">
                   <Brain className="h-6 w-6" />
                </div>
                <div>
                   <h3 className="text-xl font-bold">AI Quiz Generator</h3>
                   <p className="text-xs text-slate-500">Create content from lecture materials</p>
                </div>
             </div>
             <p className="text-sm text-slate-600 dark:text-zinc-400 mb-8 leading-relaxed">
               Generate customized, context-aware assessments by processing your uploaded notes or specific lesson topics using EduSync AI.
             </p>
             <Button className="w-full h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold" onClick={() => navigate("/teacher/quizzes")}>
                Launch Generator
             </Button>
          </SpotlightCard>

          <SpotlightCard className={cn(floatingGlassCardClass, "p-8")}>
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold">Teaching Materials</h3>
                <span className="text-[10px] font-black uppercase text-violet-500 tracking-widest bg-violet-500/10 px-3 py-1 rounded-full text-xs">Content ROI Active</span>
             </div>
             <div className="space-y-4">
                {uploadedNotes.length === 0 && (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-sm text-slate-500">
                    No notes uploaded yet. Upload content to unlock material insights.
                  </div>
                )}
                {uploadedNotes.map((note, idx) => (
                   <div key={note.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-between group hover:border-violet-500/20 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
                            <FileText className="h-5 w-5 text-slate-400" />
                         </div>
                         <div>
                            <p className="text-sm font-bold truncate max-w-[150px]">{note.title}</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-2">
                               {note.views} views 
                               <span className={cn(
                                 "font-black uppercase tracking-tighter",
                                 note.impact === "High" ? "text-emerald-500" : "text-amber-500"
                               )}>
                                  • {note.impact} Impact
                               </span>
                            </p>
                         </div>
                      </div>
                       <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" onClick={() => navigate("/teacher/notes")}>Open</Button>
                   </div>
                ))}
                <Button variant="ghost" className="w-full h-12 rounded-xl border border-dashed border-slate-300 dark:border-white/10 text-slate-500 text-xs font-bold" onClick={() => navigate("/teacher/notes")}>
                   + Upload More Content
                </Button>
             </div>
          </SpotlightCard>
       </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cn(floatingGlassCardClass, "p-5 bg-slate-50/[0.1]")}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Sessions</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{teacherSessions.length}</p>
        </div>
        <div className={cn(floatingGlassCardClass, "p-5 bg-slate-50/[0.1]")}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Today</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{todaySessions.length}</p>
        </div>
        <div className={cn(floatingGlassCardClass, "p-5 bg-slate-50/[0.1]")}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Selected Day</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{selectedDaySessions.length}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <SpotlightCard className={cn(floatingGlassCardClass, "xl:col-span-8 p-8")}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold">Teaching Calendar</h3>
              <p className="text-xs text-slate-500 mt-1">Plan classes with the same session logic used across the app.</p>
            </div>
            <Button
              className="rounded-xl bg-slate-900 text-white dark:bg-white dark:text-black"
              onClick={() => navigate("/study-rooms")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Open Scheduling Workspace
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] p-4">
            <UiCalendar
              mode="single"
              selected={selectedCalendarDate}
              onSelect={setSelectedCalendarDate}
              modifiers={{ hasSession: sessionDates }}
              modifiersClassNames={{
                selected: "bg-violet-600 dark:bg-violet-400 text-white dark:text-black rounded-md font-bold",
                hasSession: "font-bold text-violet-700 dark:text-violet-300 underline decoration-2 underline-offset-4",
                today: "border border-violet-500/40",
              }}
              className="w-full"
            />
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500">Sessions On Selected Day</p>
            {selectedDaySessions.length === 0 ? (
              <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-sm text-slate-500">
                No sessions on this day.
              </div>
            ) : (
              selectedDaySessions.map((session) => {
                const sessionDate = new Date(session.start_time);
                const status = session.status || "scheduled";
                return (
                  <div key={session.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{session.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {sessionDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {session.room_id ? ` • ${roomNameById.get(session.room_id) || "Study Room"}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] px-3 py-1 rounded-full uppercase font-black tracking-widest",
                        status === "live" ? "bg-emerald-500/15 text-emerald-600" : "bg-violet-500/15 text-violet-600"
                      )}>
                        {status}
                      </span>
                      {session.room_id && (
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate(`/study-room/${session.room_id}`)}>
                          Open Room
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SpotlightCard>

        <SpotlightCard className={cn(floatingGlassCardClass, "xl:col-span-4 p-8")}>
          <h3 className="text-xl font-bold">Quick Schedule</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">Create a scheduled class using current session model.</p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-widest text-slate-500">Title</Label>
              <Input
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="Data Structures - Revision"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-widest text-slate-500">Room</Label>
              <select
                value={newSessionRoomId}
                onChange={(e) => setNewSessionRoomId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-3 text-sm"
              >
                <option value="">Select room</option>
                {myRooms.map((room: TeacherRoom) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-widest text-slate-500">Date & Time</Label>
              <Input
                type="datetime-local"
                value={newSessionDateTime}
                onChange={(e) => setNewSessionDateTime(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <Button
              className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold"
              onClick={createTeacherSession}
              disabled={creatingSession}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {creatingSession ? "Scheduling..." : "Schedule Session"}
            </Button>
          </div>

          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500 mb-3">Today Agenda</p>
            <div className="space-y-3">
              {todaySessions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs text-slate-500">
                  No sessions today.
                </div>
              ) : (
                todaySessions.map((session) => {
                  const start = new Date(session.start_time);
                  return (
                    <div key={session.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{session.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch(activeTab) {
      case "classrooms": return renderClassrooms();
      case "calendar": return renderCalendar();
      case "content": return renderContent();
      default: return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f0f0f] text-slate-900 dark:text-white overflow-x-hidden transition-colors duration-500 font-sans">
      {/* Ambient Gradient Depth */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 h-screen w-screen bg-[radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.06),transparent_70%)] opacity-50 dark:opacity-100" />
        <div className="absolute -bottom-10 -left-10 h-screen w-screen bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.04),transparent_70%)] opacity-50 dark:opacity-100" />
      </div>

      <AppSidebar />

      <header className={cn("fixed top-0 left-0 right-0 z-[60] h-24 flex items-center justify-between px-6 md:px-12 pointer-events-none transition-all duration-300", isSidebarCollapsed ? "md:left-16" : "md:left-64")}>
        {/* Floating Glass Header */}
        <div className="flex-1 flex items-center justify-between h-16 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-3xl border border-white dark:border-white/10 rounded-full px-4 md:px-6 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white rounded-r-3xl">
                <SheetHeader>
                  <SheetTitle>Teacher Workspace</SheetTitle>
                  <SheetDescription>EduSync Faculty Analytics Dashboard.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                   {tabs.map(tab => (
                     <Button key={tab.id} variant="ghost" className="w-full justify-start font-bold" onClick={() => { setActiveTab(tab.id); }}>
                        {tab.icon} <span className="ml-2 uppercase tracking-widest text-[10px]">{tab.label}</span>
                     </Button>
                   ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Nav Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-white/5 rounded-full p-1 border border-slate-200/50 dark:border-white/5 shadow-inner">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                        "relative flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
                        activeTab === tab.id 
                            ? "text-primary dark:text-white" 
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-white dark:bg-white/10 shadow-md shadow-primary/5 rounded-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className={cn("relative z-10 transition-colors", activeTab === tab.id ? "text-primary" : "text-slate-400")}>{tab.icon}</div>
                    <span className="relative z-10 hidden sm:inline-block">{tab.label}</span>
                  </button>
                ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center bg-slate-100/50 dark:bg-white/5 rounded-full px-4 h-10 border border-slate-200 dark:border-white/5">
                 <Search className="h-4 w-4 text-slate-400 mr-2" />
                 <input 
                    placeholder="Search student or insight..." 
                    className="bg-transparent border-none focus:ring-0 text-xs w-48 text-slate-900 dark:text-white placeholder:text-slate-500"
                 />
             </div>
             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent">
               <Bell className="h-4 w-4" />
             </Button>
             <div className="h-10 w-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-violet-600/20">
                T
             </div>
          </div>
        </div>
      </header>

      <main className={cn("relative z-10 pt-28 pb-24 px-6 md:px-12 transition-all duration-300", isSidebarCollapsed ? "md:ml-16" : "md:ml-64")}>
         <ArriveAnimation key={activeTab}>
            <div className="max-w-7xl mx-auto">
               <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 px-2 gap-4">
                  <div>
                     <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">
                        Faculty <span className="text-violet-500">Workspace</span>
                     </h1>
                     <p className="text-sm text-slate-500 font-medium">Strategic decision support powered by EduSync Analytics.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-200/50 dark:bg-white/5 px-4 py-2 rounded-full border border-slate-300/50 dark:border-white/5">
                     <Clock className="h-3 w-3" />
                    Last Data Sync: {lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (loadingData ? "Syncing..." : "Not synced")}
                  </div>
               </div>
               
               {renderTabContent()}
            </div>
         </ArriveAnimation>
      </main>

      <Button
        onClick={() => navigate("/teacher/quizzes")}
        className="fixed bottom-8 right-8 z-[70] rounded-full h-14 px-6 bg-violet-600 text-white hover:bg-violet-700 shadow-2xl shadow-violet-500/40 border border-violet-400/20 animate-bounce hover:animate-none group"
      >
        <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
        <span className="font-bold">AI Assistant</span>
      </Button>
    </div>
  );
};

const ArriveAnimation = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98, y: 15 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98, y: 15 }}
    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
  >
    {children}
  </motion.div>
);

export default TeacherDashboard;
