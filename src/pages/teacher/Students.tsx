import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Users, 
  ArrowLeft, 
  BarChart3,
  TrendingUp,
  Sparkles,
  Clock,
  Target,
  ChevronRight,
  AlertCircle,
  Flame,
  Brain,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  Eye,
  Search,
  MessageSquare,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  TrendingDown
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface StudentProgress {
  user_id: string;
  username: string | null;
  avatar_url?: string | null;
  quizzes_taken: number;
  average_score: number;
  latest_quiz: string | null;
  latest_date?: string;
  engagement_streak?: number;
  consistency?: number;
  class_rank?: number;
}

interface DetailedStudent {
  user_id: string;
  username: string;
  avatar_url?: string | null;
  average_score: number;
  quizzes_taken: number;
  latest_quiz: string | null;
  latest_date?: string;
  engagement_streak?: number;
  consistency?: number;
  weak_areas?: string[];
  strong_areas?: string[];
  days_since_activity?: number;
  highest_score?: number;
  lowest_score?: number;
  learning_style?: {
    primary_style: string | null;
    secondary_style: string | null;
    visual_score: number;
    auditory_score: number;
    reading_score: number;
    kinesthetic_score: number;
  } | null;
  quiz_history: Array<{
    title: string;
    score: number;
    date: string;
  }>;
  total_study_time?: number;
}

const floatingGlassCardClass = "bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-3xl";

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

const getRiskLevel = (score: number, daysSince: number | undefined) => {
  if (score < 50 || (daysSince && daysSince > 7)) return { 
    label: "High Risk", 
    color: "text-rose-500", 
    bg: "bg-rose-500/10", 
    icon: ShieldAlert,
    desc: "Low engagement or poor scores"
  };
  if (score < 70 || (daysSince && daysSince > 3)) return { 
    label: "Needs Attention", 
    color: "text-amber-500", 
    bg: "bg-amber-500/10", 
    icon: ShieldQuestion,
    desc: "Inconsistent performance"
  };
  return { 
    label: "On Track", 
    color: "text-emerald-500", 
    bg: "bg-emerald-500/10", 
    icon: ShieldCheck,
    desc: "Consistent & strong scores"
  };
};

export default function TeacherStudents() {
  useRequireRole("teacher");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<DetailedStudent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchStudentDetail = async (
    studentId: string,
    studentName: string,
    avatarUrl: string | null | undefined,
    avgScore: number,
    quizzesTaken: number,
    latestQuiz: string | null,
    latestDate?: string,
  ) => {
    setDetailLoading(true);
    try {
      // Fetch learning style
      const { data: learningStyleData } = await supabase
        .from('learning_styles')
        .select('primary_style, secondary_style, visual_score, auditory_score, reading_score, kinesthetic_score')
        .eq('user_id', studentId)
        .single();

      // Fetch quiz history
      const { data: { user } } = await supabase.auth.getUser();
      const { data: teacherQuizzes } = await supabase
        .from('quiz_sets')
        .select('id')
        .eq('created_by', user?.id);

      const teacherQuizIds = (teacherQuizzes || []).map((q: any) => q.id);

      const { data: quizHistory } = await supabase
        .from("user_progress")
        .select("progress_data, updated_at, content_id")
        .eq("content_type", "quiz_set")
        .eq("user_id", studentId)
        .in("content_id", teacherQuizIds)
        .order('updated_at', { ascending: false });

      const quizzes = (quizHistory || []).map((q: any) => ({
        title: q.progress_data?.quiz_title || 'Unknown Quiz',
        score: q.progress_data?.score || 0,
        date: new Date(q.updated_at).toLocaleDateString()
      }));

      // Calculate engagement streak (consecutive days of activity)
      const quizDates = (quizHistory || [])
        .map((q: any) => new Date(q.updated_at).toDateString())
        .filter((v, i, a) => a.indexOf(v) === i) // unique dates
        .map((d: string) => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      let engagementStreak = 0;
      if (quizDates.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let currentDate = new Date(quizDates[0]);
        currentDate.setHours(0, 0, 0, 0);
        
        // Check if most recent activity is within last 7 days
        const daysSinceLastActivity = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActivity < 7) {
          for (let i = 0; i < quizDates.length; i++) {
            const expectedDate = new Date(currentDate);
            expectedDate.setDate(expectedDate.getDate() - i);
            
            if (quizDates[i].toDateString() === expectedDate.toDateString()) {
              engagementStreak++;
            } else {
              break;
            }
          }
        }
      }

      // Calculate consistency (% of days with activity in last 30 days)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const recentQuizzes = (quizHistory || []).filter((q: any) => new Date(q.updated_at) > last30Days);
      const uniqueRecentDates = new Set(recentQuizzes.map((q: any) => new Date(q.updated_at).toDateString()));
      const consistency = Math.round((uniqueRecentDates.size / 30) * 100);

      // Calculate weak and strong areas based on quiz titles and scores
      const scoreByTopic = new Map<string, { scores: number[], count: number }>();
      quizzes.forEach((quiz: any) => {
        const topic = quiz.title.split('-')[0].trim() || 'General';
        if (!scoreByTopic.has(topic)) {
          scoreByTopic.set(topic, { scores: [], count: 0 });
        }
        const existing = scoreByTopic.get(topic)!;
        existing.scores.push(quiz.score);
        existing.count += 1;
      });

      const topicAverages = Array.from(scoreByTopic.entries()).map(([topic, data]) => ({
        topic,
        avg: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count)
      })).sort((a, b) => a.avg - b.avg);

      const weak_areas = topicAverages.filter(t => t.avg < 60).map(t => t.topic);
      const strong_areas = topicAverages.filter(t => t.avg >= 80).map(t => t.topic);

      const highest_score = Math.max(...quizzes.map(q => q.score), 0);
      const lowest_score = Math.min(...quizzes.map(q => q.score), 0);
      const days_since_activity = latestDate ? Math.floor((Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24)) : undefined;

      setSelectedStudent({
        user_id: studentId,
        username: studentName,
        avatar_url: avatarUrl || null,
        average_score: avgScore,
        quizzes_taken: quizzesTaken,
        latest_quiz: latestQuiz,
        latest_date: latestDate,
        engagement_streak: engagementStreak,
        consistency,
        weak_areas,
        strong_areas,
        days_since_activity,
        highest_score,
        lowest_score,
        learning_style: learningStyleData || null,
        quiz_history: quizzes
      });
    } catch (error) {
      console.error('Error fetching student details:', error);
      toast({
        title: "Error",
        description: "Failed to load student details",
        variant: "destructive"
      });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch students explicitly assigned to this teacher by admin
        const { data: assignedRows } = await supabase
          .from('teacher_student_assignments' as any)
          .select('student_id')
          .eq('teacher_id', user.id);

        const assignedStudentIds = Array.from(new Set((assignedRows || []).map((row: any) => row.student_id)));
        if (assignedStudentIds.length === 0) {
          setStudents([]);
          return;
        }

        // 2. Keep only users with student role
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', assignedStudentIds);

        const studentIds = (roleRows || [])
          .filter((row: any) => row.role === 'student')
          .map((row: any) => row.user_id);

        if (studentIds.length === 0) {
          setStudents([]);
          return;
        }

        // 3. Fetch teacher-created quizzes only
        const { data: teacherQuizzes } = await supabase
          .from('quiz_sets')
          .select('id')
          .eq('created_by', user.id);

        const teacherQuizIds = (teacherQuizzes || []).map((q: any) => q.id);
        if (teacherQuizIds.length === 0) {
          setStudents([]);
          return;
        }

        // 4. Build student map from profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', studentIds);

        const profileMap = new Map((profiles || []).map((p: any) => [
          p.id,
          {
            username: p.username || 'Unknown student',
            avatar_url: p.avatar_url || null,
          },
        ]));
        
        // Remove duplicates and initialize student data
        const studentMap = new Map<string, any>();
        studentIds.forEach((studentId) => {
          const profileData = profileMap.get(studentId);
          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              user_id: studentId,
              username: profileData?.username || 'Unknown student',
              avatar_url: profileData?.avatar_url || null,
              quizzes_taken: 0,
              total_score: 0,
              latest_quiz: 'None',
              latest_date: null
            });
          }
        });

        if (studentMap.size === 0) {
          setStudents([]);
          return;
        }

        // 5. Fetch quiz progress and merge
        const { data: quizData, error: quizError } = await supabase
          .from("user_progress")
          .select("user_id, progress_data, updated_at, content_id")
          .eq("content_type", "quiz_set")
          .in("user_id", Array.from(studentMap.keys()))
          .in("content_id", teacherQuizIds)
          .order('updated_at', { ascending: false });

        if (quizError) throw quizError;

        // Group quiz data by student for metric calculation
        const quizGroups = new Map<string, any[]>();
        (quizData || []).forEach((row: any) => {
          if (!quizGroups.has(row.user_id)) quizGroups.set(row.user_id, []);
          quizGroups.get(row.user_id)!.push(row);
        });

        const studentsData: StudentProgress[] = Array.from(studentMap.values()).map(s => {
          const studentQuizzes = quizGroups.get(s.user_id) || [];
          let totalScore = 0;
          let latestQuiz = 'None';
          let latestDate = null;

          studentQuizzes.forEach((q, idx) => {
            totalScore += q.progress_data?.score || 0;
            if (idx === 0) {
              latestQuiz = q.progress_data?.quiz_title || 'Unknown Quiz';
              latestDate = q.updated_at;
            }
          });

          // Calculate engagement streak
          const quizDates = studentQuizzes
            .map((q: any) => new Date(q.updated_at).toDateString())
            .filter((v, i, a) => a.indexOf(v) === i)
            .map((d: string) => new Date(d))
            .sort((a, b) => b.getTime() - a.getTime());

          let streak = 0;
          if (quizDates.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let currentDate = new Date(quizDates[0]);
            currentDate.setHours(0, 0, 0, 0);
            if (Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) < 7) {
              for (let i = 0; i < quizDates.length; i++) {
                const expected = new Date(currentDate);
                expected.setDate(expected.getDate() - i);
                if (quizDates[i].toDateString() === expected.toDateString()) streak++;
                else break;
              }
            }
          }

          // Calculate consistency (last 30 days)
          const last30 = new Date();
          last30.setDate(last30.getDate() - 30);
          const uniqueRecent = new Set(studentQuizzes.filter(q => new Date(q.updated_at) > last30).map(q => new Date(q.updated_at).toDateString()));
          const consistency = Math.round((uniqueRecent.size / 30) * 100);

          return {
            user_id: s.user_id,
            username: s.username,
            avatar_url: s.avatar_url,
            quizzes_taken: studentQuizzes.length,
            average_score: studentQuizzes.length > 0 ? Math.round(totalScore / studentQuizzes.length) : 0,
            latest_quiz: latestQuiz,
            latest_date: latestDate || undefined,
            engagement_streak: streak,
            consistency: consistency
          };
        }).sort((a, b) => b.average_score - a.average_score);

        setStudents(studentsData);
      } catch (error: any) {
        console.error('Error loading students:', error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load students.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = students.filter(s => 
    (s.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-violet-500/30 overflow-x-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Modern Header */}
        <header className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate("/teacher")} 
              className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/50 transition-all group shrink-0"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-violet-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Mentorship Hub</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                My <span className="text-violet-500">Students</span>
              </h1>
            </div>
          </div>

          <div className="relative group w-full md:w-96">
            <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-500 transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students by name..."
              className="pl-11 h-12 bg-white/5 backdrop-blur-md border-white/10 rounded-2xl focus-visible:ring-violet-500 transition-all placeholder:text-slate-600"
            />
          </div>
        </header>

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-12">
          {/* Stats Grid */}
          {!loading && students.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Total Students", value: students.length, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                { 
                  label: "Collective Avg", 
                  value: `${Math.round(students.reduce((sum, s) => sum + s.average_score, 0) / students.length)}%`, 
                  icon: BarChart3, 
                  color: "text-emerald-500", 
                  bg: "bg-emerald-500/10",
                  trend: "Trending Up",
                  trendIcon: TrendingUp
                },
                { 
                  label: "Total Attempts", 
                  value: students.reduce((sum, s) => sum + s.quizzes_taken, 0), 
                  icon: Target, 
                  color: "text-violet-500", 
                  bg: "bg-violet-500/10" 
                }
              ].map((stat, i) => (
                <SpotlightCard key={i} className={cn(floatingGlassCardClass, "p-8")}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg", stat.bg, stat.color)}>
                          <stat.icon className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{stat.label}</span>
                      </div>
                      <div>
                        <div className="text-4xl font-black text-white leading-none tracking-tight">
                          {stat.value}
                        </div>
                        {stat.trend && (
                          <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                            <stat.trendIcon className="h-3 w-3" />
                            {stat.trend}
                          </div>
                        )}
                      </div>
                    </div>
                    <stat.icon className={cn("h-12 w-12 opacity-5", stat.color)} />
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}

          {/* Activity Section */}
          <section className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-violet-500" />
                <h2 className="text-lg font-black uppercase tracking-widest text-white">Student Roster</h2>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-400 font-bold uppercase tracking-tighter text-[10px]">
                  {loading ? "Syncing..." : `${filteredStudents.length} Active`}
                </Badge>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={cn(floatingGlassCardClass, "h-64 animate-pulse bg-white/5")} />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(floatingGlassCardClass, "p-20 text-center space-y-6")}
              >
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto ring-1 ring-white/10">
                  <Users className="h-10 w-10 text-slate-600" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-black text-2xl text-white">No students match your query</h4>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium">Try searching by full name or check if the student is assigned to your classroom.</p>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredStudents.map((s, index) => {
                    const daysSince = s.latest_date ? Math.floor((Date.now() - new Date(s.latest_date).getTime()) / (1000 * 60 * 60 * 24)) : undefined;
                    const risk = getRiskLevel(s.average_score, daysSince);
                    const RiskIcon = risk.icon;

                    return (
                      <SpotlightCard 
                        key={s.user_id} 
                        className={cn(floatingGlassCardClass, "p-8 group cursor-pointer hover:border-violet-500/30 transition-all flex flex-col justify-between h-full bg-white/[0.03]")}
                      >
                        <div onClick={() => {
                          fetchStudentDetail(
                            s.user_id,
                            s.username || 'Unknown',
                            s.avatar_url,
                            s.average_score,
                            s.quizzes_taken,
                            s.latest_quiz,
                            s.latest_date,
                          );
                        }}>
                          <div className="flex items-start justify-between mb-8">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <Avatar className="h-14 w-14 border-2 border-white/10 group-hover:border-violet-500/50 transition-colors shadow-2xl">
                                  {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.username || "Student"} />}
                                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-600 text-white font-black text-lg">
                                    {(s.username || "S").charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-[#020617] border border-white/10 flex items-center justify-center text-[10px] font-black text-white shadow-xl">
                                  {index + 1}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-black text-lg tracking-tight group-hover:text-violet-500 transition-colors truncate max-w-[140px]">
                                  {s.username || "Anonymous"}
                                </h3>
                                <Badge className={cn("border-none px-2 py-0.5 text-[9px] uppercase tracking-wider font-black", risk.bg, risk.color)}>
                                  <RiskIcon className="h-3 w-3 mr-1 inline-block" />
                                  {risk.label}
                                </Badge>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-3xl font-black tracking-tighter text-white">
                                {s.average_score}%
                              </div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Average</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1">
                              <div className="flex items-center gap-2 text-slate-500">
                                <Flame className="h-3 w-3 text-orange-500" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Streak</span>
                              </div>
                              <div className="text-xl font-black text-white">{s.engagement_streak || 0}d</div>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1">
                              <div className="flex items-center gap-2 text-slate-500">
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Consistency</span>
                              </div>
                              <div className="text-xl font-black text-white">{s.consistency || 0}%</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto space-y-6">
                          <Progress value={s.average_score} className="h-1.5 bg-white/5" indicatorClassName="bg-gradient-to-r from-violet-500 to-blue-500" />
                          
                          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="flex-1 rounded-xl bg-white/5 hover:bg-violet-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchStudentDetail(
                                  s.user_id,
                                  s.username || 'Unknown',
                                  s.avatar_url,
                                  s.average_score,
                                  s.quizzes_taken,
                                  s.latest_quiz,
                                  s.latest_date,
                                );
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Deep Stats
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="rounded-xl h-9 w-9 bg-white/5 hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Student Detail Sheet - Modern Overhaul */}
      <Sheet open={selectedStudent !== null} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <SheetContent side="right" className="w-full sm:w-[600px] overflow-y-auto bg-[#020617]/95 backdrop-blur-3xl border-l border-white/10 p-0 selection:bg-violet-500/30">
          {selectedStudent && (
            <div className="p-8 space-y-12">
              <SheetHeader className="space-y-6 pt-12">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border-4 border-white/10 shadow-2xl">
                    {selectedStudent.avatar_url && <AvatarImage src={selectedStudent.avatar_url} alt={selectedStudent.username} />}
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-600 text-white font-black text-3xl">
                      {selectedStudent.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <SheetTitle className="text-4xl font-black text-white tracking-tighter">
                      {selectedStudent.username}
                    </SheetTitle>
                    <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Academic Profile Level {Math.max(1, Math.min(5, Math.floor(selectedStudent.average_score / 20) + 1))}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Fetching Deep Analytics...</span>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-right duration-500">
                  {/* Primary Performance Gauge */}
                  <div className={cn(floatingGlassCardClass, "p-8 space-y-6 bg-gradient-to-br from-violet-500/5 to-blue-500/5 overflow-hidden relative")}>
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <TrendingUp className="h-32 w-32" />
                    </div>
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="space-y-1">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Mastery Level</h3>
                        <div className="text-5xl font-black text-white tracking-tighter leading-none">
                          {selectedStudent.average_score}%
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase tracking-widest border-none",
                          selectedStudent.average_score >= 80 ? 'bg-emerald-500 text-white' :
                          selectedStudent.average_score >= 60 ? 'bg-blue-500 text-white' :
                          'bg-rose-500 text-white'
                        )}>
                          {selectedStudent.average_score >= 80 ? 'Expert' : selectedStudent.average_score >= 60 ? 'Proficient' : 'Developing'}
                        </Badge>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">
                          {selectedStudent.average_score >= 60 ? 'Growth Plan Active' : 'Remediation Required'}
                        </p>
                      </div>
                    </div>
                    <Progress value={selectedStudent.average_score} className="h-3 bg-white/5" indicatorClassName="bg-gradient-to-r from-violet-500 to-blue-500" />
                  </div>

                  {/* Core Metrics Widgets */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className={cn(floatingGlassCardClass, "p-6 space-y-4 border-none bg-white/[0.03]")}>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Target className="h-3.5 w-3.5 text-purple-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Total Attempts</span>
                      </div>
                      <div className="text-3xl font-black text-white tracking-tighter">{selectedStudent.quizzes_taken}</div>
                      <div className="h-1 w-12 bg-purple-500/50 rounded-full" />
                    </div>
                    <div className={cn(floatingGlassCardClass, "p-6 space-y-4 border-none bg-white/[0.03]")}>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Last Activity</span>
                      </div>
                      <div className="text-lg font-black text-white truncate">
                        {selectedStudent.latest_date ? new Date(selectedStudent.latest_date).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="h-1 w-12 bg-orange-500/50 rounded-full" />
                    </div>
                  </div>

                  {/* Knowledge Mapping */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={cn(floatingGlassCardClass, "p-6 space-y-4 border-rose-500/20")}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Weak Topics</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.weak_areas && selectedStudent.weak_areas.length > 0 ? (
                          selectedStudent.weak_areas.map(area => (
                            <Badge key={area} className="bg-rose-500/10 text-rose-500 border-none text-[9px] font-black uppercase">
                              {area}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600 font-medium italic">No weaknesses detected</span>
                        )}
                      </div>
                    </div>
                    <div className={cn(floatingGlassCardClass, "p-6 space-y-4 border-emerald-500/20")}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mastered</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.strong_areas && selectedStudent.strong_areas.length > 0 ? (
                          selectedStudent.strong_areas.map(area => (
                            <Badge key={area} className="bg-emerald-500/10 text-emerald-500 border-none text-[9px] font-black uppercase">
                              {area}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600 font-medium italic">Establishing baseline...</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Learning Engine Stats */}
                  <div className={cn(floatingGlassCardClass, "p-8 space-y-8")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Brain className="h-5 w-5 text-indigo-500" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-white">Cognitive Style Mapping</h4>
                      </div>
                      <Badge variant="outline" className="border-indigo-500/30 text-indigo-500 font-black text-[9px] uppercase tracking-tighter">
                        {selectedStudent.learning_style?.primary_style || "Undetermined"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {[
                        { label: 'Visual', score: selectedStudent.learning_style?.visual_score || 0, color: 'bg-violet-500' },
                        { label: 'Auditory', score: selectedStudent.learning_style?.auditory_score || 0, color: 'bg-blue-500' },
                        { label: 'Reading', score: selectedStudent.learning_style?.reading_score || 0, color: 'bg-emerald-500' },
                        { label: 'Kinesthetic', score: selectedStudent.learning_style?.kinesthetic_score || 0, color: 'bg-amber-500' }
                      ].map(({ label, score, color }) => (
                        <div key={label} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label} Logic</span>
                            <span className="text-[10px] font-black text-white">{selectedStudent.learning_style ? `${score}%` : 'N/A'}</span>
                          </div>
                          <Progress value={score} className="h-1 bg-white/5" indicatorClassName={cn(color, !selectedStudent.learning_style && "opacity-20")} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions Footer - Floating */}
                  <div className="p-2 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center gap-2">
                    <Button 
                      className="flex-1 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest h-11"
                    >
                      <Zap className="mr-2 h-3.5 w-3.5" />
                      Assign Remediation
                    </Button>
                    <Button 
                      variant="outline" 
                      className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest h-11 px-4"
                    >
                      Notify
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
