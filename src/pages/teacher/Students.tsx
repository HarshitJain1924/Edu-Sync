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
  Eye
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { cn } from "@/lib/utils";

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
          .in("content_id", teacherQuizIds);

        if (quizError) throw quizError;

        (quizData || []).forEach((row: any) => {
          const student = studentMap.get(row.user_id);
          if (student) {
            const score = row.progress_data?.score || 0;
            const quizTitle = row.progress_data?.quiz_title || 'Unknown Quiz';
            const updatedAt = row.updated_at;
            
            student.quizzes_taken++;
            student.total_score += score;
            
            if (!student.latest_date || new Date(updatedAt) > new Date(student.latest_date)) {
              student.latest_quiz = quizTitle;
              student.latest_date = updatedAt;
            }
          }
        });

        const studentsData: StudentProgress[] = Array.from(studentMap.values()).map(s => ({
          user_id: s.user_id,
          username: s.username,
          avatar_url: s.avatar_url,
          quizzes_taken: s.quizzes_taken,
          average_score: s.quizzes_taken > 0 ? Math.round(s.total_score / s.quizzes_taken) : 0,
          latest_quiz: s.latest_quiz
        })).sort((a, b) => b.average_score - a.average_score);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher")} className="hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Students</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Manage and track student performance</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-6xl mx-auto">
        {/* Stats Overview */}
        {!loading && students.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Students</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{students.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Score</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                      {Math.round(students.reduce((sum, s) => sum + s.average_score, 0) / students.length)}%
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Quizzes</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                      {students.reduce((sum, s) => sum + s.quizzes_taken, 0)}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Students List */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Users className="h-5 w-5 text-blue-500" />
              Student Performance
            </CardTitle>
            <CardDescription>Click on any student to view detailed profile and performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-slate-600 dark:text-slate-400">Loading students...</div>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-600 dark:text-slate-400">No student data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((s, index) => {
                  const status = s.average_score >= 80 ? 'Excellent' : s.average_score >= 60 ? 'Good' : 'Needs Attention';
                  const statusColor = s.average_score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 
                                     s.average_score >= 60 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                                     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';

                  return (
                    <div
                      key={s.user_id}
                      onClick={() => {
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
                      className="group p-5 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 overflow-hidden"
                    >
                      {/* Animated background gradient on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 pointer-events-none" />
                      
                      <div className="space-y-4">
                        {/* Header Section */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              <Avatar className="h-11 w-11 border-2 border-white dark:border-slate-700 shadow-lg">
                                {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.username || "Student"} />}
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold uppercase">
                                  {(s.username || "S").charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                            </div>

                            {/* Student Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{s.username || "Unknown user"}</p>
                                <Badge className={cn("whitespace-nowrap text-xs font-semibold", statusColor)}>
                                  {status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-500 truncate font-medium">
                                {s.latest_quiz ? `📝 ${s.latest_quiz}` : '📭 No activity'}
                              </p>
                            </div>
                          </div>

                          {/* Main Score */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {s.average_score}%
                            </div>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Avg Score</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <Progress value={s.average_score} className="h-2 bg-slate-200 dark:bg-slate-700" />
                        </div>

                        {/* Metrics Row */}
                        <div className="grid grid-cols-4 gap-2">
                          {/* Quizzes Taken */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2.5 text-center hover:bg-slate-150 dark:hover:bg-slate-700 transition-colors group/metric">
                                  <Target className="h-4 w-4 text-purple-600 dark:text-purple-400 mx-auto mb-1 opacity-70 group-hover/metric:opacity-100 transition-opacity" />
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{s.quizzes_taken}</p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">Quizzes</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Total quizzes taken</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Engagement Streak */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2.5 text-center hover:bg-slate-150 dark:hover:bg-slate-700 transition-colors group/metric">
                                  <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400 mx-auto mb-1 opacity-70 group-hover/metric:opacity-100 transition-opacity" />
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{s.engagement_streak || 0}</p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">Streak</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Days active in a row</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Consistency */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2.5 text-center hover:bg-slate-150 dark:hover:bg-slate-700 transition-colors group/metric">
                                  <Zap className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mx-auto mb-1 opacity-70 group-hover/metric:opacity-100 transition-opacity" />
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{(s.consistency || 0)}%</p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">Activity</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>% of days active in last 30 days</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Days Since Activity */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2.5 text-center hover:bg-slate-150 dark:hover:bg-slate-700 transition-colors group/metric">
                                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto mb-1 opacity-70 group-hover/metric:opacity-100 transition-opacity" />
                                  <p className="text-sm font-bold text-slate-900 dark:text-white text-xs">
                                    {s.latest_date ? Math.floor((Date.now() - new Date(s.latest_date).getTime()) / (1000 * 60 * 60 * 24)) : '-'}
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">Days</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Days since last activity</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Hover indicator */}
                      <div className={cn(
                        "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300",
                        status === 'Excellent' && 'from-green-500 to-emerald-500',
                        status === 'Needs Attention' && 'from-amber-500 to-orange-500'
                      )} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Student Detail Sheet */}
      <Sheet open={selectedStudent !== null} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <SheetContent side="right" className="w-full sm:w-[600px] overflow-y-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
          {selectedStudent && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-slate-200 dark:border-slate-700">
                    {selectedStudent.avatar_url && <AvatarImage src={selectedStudent.avatar_url} alt={selectedStudent.username} />}
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold uppercase">
                      {selectedStudent.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <SheetTitle className="text-2xl text-slate-900 dark:text-white">{selectedStudent.username}</SheetTitle>
                </div>
                <SheetDescription className="text-slate-600 dark:text-slate-400">Student Performance Profile</SheetDescription>
              </SheetHeader>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-600 dark:text-slate-400">Loading details...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Performance Score */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Overall Performance
                      </h3>
                      <Badge className={cn(
                        "text-sm font-semibold",
                        selectedStudent.average_score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        selectedStudent.average_score >= 60 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      )}>
                        {selectedStudent.average_score >= 80 ? 'Excellent' : selectedStudent.average_score >= 60 ? 'Good' : 'Needs Attention'}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Average Score</span>
                          <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{selectedStudent.average_score}%</span>
                        </div>
                        <Progress value={selectedStudent.average_score} className="h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Target className="h-5 w-5 text-purple-500 mx-auto mb-2 opacity-50" />
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedStudent.quizzes_taken}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Quizzes Taken</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Clock className="h-5 w-5 text-orange-500 mx-auto mb-2 opacity-50" />
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {selectedStudent.latest_date ? new Date(selectedStudent.latest_date).toLocaleDateString() : 'N/A'}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Last Active</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Engagement & Consistency Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                      <div className="text-center">
                        <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{selectedStudent.engagement_streak || 0}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">Day Streak</p>
                      </div>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                      <div className="text-center">
                        <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{selectedStudent.consistency || 0}%</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 font-medium">Consistency</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <div className="text-center">
                        <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{selectedStudent.days_since_activity || 0}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">Days Ago</p>
                      </div>
                    </div>
                  </div>

                  {/* Score Range */}
                  <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Performance Range
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">Highest Score</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-green-600 dark:text-green-400">{selectedStudent.highest_score || 0}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">Lowest Score</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-red-600 dark:text-red-400">{selectedStudent.lowest_score || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weak Areas */}
                  {selectedStudent.weak_areas && selectedStudent.weak_areas.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        Areas Needing Improvement
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.weak_areas.map((area) => (
                          <Badge key={area} className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-medium">
                            📚 {area}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-3 font-medium">
                        💡 Consider assigning focused quizzes on these topics to help improve scores
                      </p>
                    </div>
                  )}

                  {/* Strong Areas */}
                  {selectedStudent.strong_areas && selectedStudent.strong_areas.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        Mastered Topics
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.strong_areas.map((area) => (
                          <Badge key={area} className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-300 dark:border-green-700 font-medium">
                            ✨ {area}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-3 font-medium">
                        🚀 Student is performing exceptionally in these areas
                      </p>
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Target className="h-5 w-5 text-purple-500 mx-auto mb-2 opacity-60" />
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedStudent.quizzes_taken}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Total Attempts</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Brain className="h-5 w-5 text-indigo-500 mx-auto mb-2 opacity-60" />
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {selectedStudent.learning_style?.primary_style ? selectedStudent.learning_style.primary_style[0].toUpperCase() : '?'}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Learning Style</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Learning Style */}
                  {selectedStudent.learning_style && (
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-violet-200 dark:border-violet-800">
                      <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        Learning Style
                      </h3>
                      <div className="space-y-3">
                        {selectedStudent.learning_style.primary_style && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Primary: <span className="text-violet-600 dark:text-violet-400">{selectedStudent.learning_style.primary_style}</span></p>
                          </div>
                        )}
                        {selectedStudent.learning_style.secondary_style && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">Secondary: {selectedStudent.learning_style.secondary_style}</p>
                        )}
                        
                        {/* Learning Style Scores */}
                        <div className="space-y-2 mt-4 pt-4 border-t border-violet-200 dark:border-violet-700">
                          {[
                            { label: 'Visual', score: selectedStudent.learning_style.visual_score },
                            { label: 'Auditory', score: selectedStudent.learning_style.auditory_score },
                            { label: 'Reading', score: selectedStudent.learning_style.reading_score },
                            { label: 'Kinesthetic', score: selectedStudent.learning_style.kinesthetic_score }
                          ].map(({ label, score }) => (
                            <div key={label}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-700 dark:text-slate-300">{label}</span>
                                <span className="font-medium text-slate-900 dark:text-white">{score}</span>
                              </div>
                              <Progress value={(score / 10) * 100} className="h-2" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quiz History */}
                  {selectedStudent.quiz_history.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                      <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Quiz History
                      </h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {selectedStudent.quiz_history.map((quiz, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{quiz.title}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{quiz.date}</p>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <Badge className={cn(
                                quiz.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                quiz.score >= 60 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              )}>
                                {quiz.score}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedStudent.quiz_history.length === 0 && (
                    <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No quiz history yet</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
