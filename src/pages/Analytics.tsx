import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, TrendingUp, Award, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface SubjectPerformance {
  subject: string;
  score: number;
  trend: "up" | "down";
  change: string;
}

interface DailyActivity {
  day: string;
  hours: number;
}

interface QuizAttemptRecord {
  topic: string;
  score: number;
  createdAt: Date;
}

interface AnalyticsOverview {
  overallGrade: string;
  thisWeekHours: number;
  improvementPct: number;
  aiSessions: number;
}

const formatDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const computeGrade = (avgScore: number) => {
  if (avgScore >= 95) return "A+";
  if (avgScore >= 90) return "A";
  if (avgScore >= 85) return "A-";
  if (avgScore >= 80) return "B+";
  if (avgScore >= 75) return "B";
  if (avgScore >= 70) return "C+";
  if (avgScore >= 65) return "C";
  if (avgScore > 0) return "D";
  return "N/A";
};

const Analytics = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("student");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AnalyticsOverview>({
    overallGrade: "N/A",
    thisWeekHours: 0,
    improvementPct: 0,
    aiSessions: 0,
  });
  const [performanceData, setPerformanceData] = useState<SubjectPerformance[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<DailyActivity[]>([]);

  useEffect(() => {
    const loadAnalytics = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData?.role) setRole(roleData.role);

      const { data: progressRows } = await supabase
        .from("user_progress")
        .select("content_id, progress_data, created_at")
        .eq("user_id", user.id)
        .eq("content_type", "quiz_set")
        .order("created_at", { ascending: true });

      const quizSetAttempts = (progressRows || [])
        .map((row: any) => ({
          contentId: row.content_id as string,
          score: Number(row.progress_data?.score || 0),
          createdAt: new Date(row.created_at),
        }))
        .filter((item) => Number.isFinite(item.score));

      const quizIds = Array.from(new Set(quizSetAttempts.map((q) => q.contentId)));
      const topicByQuizId = new Map<string, string>();

      if (quizIds.length > 0) {
        const { data: quizSets } = await supabase
          .from("quiz_sets")
          .select("id, topic")
          .in("id", quizIds);

        (quizSets || []).forEach((quiz: any) => {
          topicByQuizId.set(quiz.id, quiz.topic || "General");
        });
      }

      const quizAttempts: QuizAttemptRecord[] = quizSetAttempts.map((attempt) => ({
        topic: topicByQuizId.get(attempt.contentId) || "General",
        score: Math.max(0, Math.min(100, attempt.score)),
        createdAt: attempt.createdAt,
      }));

      // Placement Prep quizzes are saved in placement_scores.
      try {
        const { data: placementRows } = await supabase
          .from("placement_scores")
          .select("score, total, topic, test_type, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        const normalizedPlacementAttempts = (placementRows || [])
          .map((row: any): QuizAttemptRecord | null => {
            const total = Number(row.total || 0);
            const rawScore = Number(row.score || 0);
            const normalizedScore = total > 0 ? (rawScore / total) * 100 : rawScore;
            const topic = row.topic || row.test_type || "Placement";
            const createdAt = new Date(row.created_at);

            if (!Number.isFinite(normalizedScore) || Number.isNaN(createdAt.getTime())) return null;

            return {
              topic,
              score: Math.max(0, Math.min(100, normalizedScore)),
              createdAt,
            };
          })
          .filter((item): item is QuizAttemptRecord => item !== null);

        quizAttempts.push(...normalizedPlacementAttempts);
      } catch {
        // Keep analytics resilient if placement_scores is unavailable.
      }

      const grouped = new Map<string, Array<{ score: number; createdAt: Date }>>();
      quizAttempts.forEach((attempt) => {
        const topic = attempt.topic || "General";
        const list = grouped.get(topic) || [];
        list.push({ score: attempt.score, createdAt: attempt.createdAt });
        grouped.set(topic, list);
      });

      const subjects: SubjectPerformance[] = Array.from(grouped.entries())
        .map(([subject, attempts]) => {
          const avg = attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length;
          const first = attempts[0]?.score || 0;
          const last = attempts[attempts.length - 1]?.score || 0;
          const delta = last - first;
          const pct = first > 0 ? Math.round((delta / first) * 100) : (delta > 0 ? 100 : 0);

          return {
            subject,
            score: Math.max(0, Math.min(100, Math.round(avg))),
            trend: delta >= 0 ? "up" : "down",
            change: `${delta >= 0 ? "+" : ""}${pct}%`,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      setPerformanceData(subjects);

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const { data: videoRows } = await supabase
        .from("video_progress")
        .select("progress_seconds, updated_at")
        .eq("user_id", user.id)
        .gte("updated_at", weekStart.toISOString());

      const buckets = new Map<string, { label: string; hours: number }>();
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const key = formatDateKey(day);
        const label = day.toLocaleDateString("en-US", { weekday: "short" });
        buckets.set(key, { label, hours: 0 });
      }

      (videoRows || []).forEach((row: any) => {
        if (!row.updated_at) return;
        const day = new Date(row.updated_at);
        const key = formatDateKey(day);
        const bucket = buckets.get(key);
        if (!bucket) return;

        const hours = Math.max(0, Number(row.progress_seconds || 0) / 3600);
        bucket.hours += hours;
      });

      const weekly = Array.from(buckets.values()).map((entry) => ({
        day: entry.label,
        hours: Math.round(entry.hours * 10) / 10,
      }));

      setWeeklyActivity(weekly);

      const thisWeekHours = weekly.reduce((sum, d) => sum + d.hours, 0);
      const avgScore = quizAttempts.length > 0
        ? quizAttempts.reduce((sum, q) => sum + q.score, 0) / quizAttempts.length
        : 0;

      const currentWindowStart = new Date(now);
      currentWindowStart.setDate(now.getDate() - 14);
      const previousWindowStart = new Date(now);
      previousWindowStart.setDate(now.getDate() - 28);

      const currentScores = quizAttempts
        .filter((q) => q.createdAt >= currentWindowStart)
        .map((q) => q.score);
      const previousScores = quizAttempts
        .filter((q) => q.createdAt >= previousWindowStart && q.createdAt < currentWindowStart)
        .map((q) => q.score);

      const currentAvg = currentScores.length > 0
        ? currentScores.reduce((sum, score) => sum + score, 0) / currentScores.length
        : 0;
      const previousAvg = previousScores.length > 0
        ? previousScores.reduce((sum, score) => sum + score, 0) / previousScores.length
        : 0;

      const improvementPct = previousAvg > 0
        ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100)
        : (currentAvg > 0 ? 100 : 0);

      setOverview({
        overallGrade: computeGrade(avgScore),
        thisWeekHours: Math.round(thisWeekHours),
        improvementPct,
        aiSessions: quizAttempts.length,
      });

      setLoading(false);
    };

    loadAnalytics();
  }, []);

  const getHomePath = () => {
    if (role === "admin") return "/admin";
    if (role === "teacher") return "/teacher";
    return "/dashboard";
  };

  const subjectChartData = performanceData.map((item) => ({
    subject: item.subject,
    score: item.score,
  }));

  const weeklyChartData = weeklyActivity.map((item) => ({
    day: item.day,
    hours: item.hours,
  }));

  const scoreBandData = [
    {
      name: "Excellent (85+)",
      value: performanceData.filter((item) => item.score >= 85).length,
      fill: "#10b981",
    },
    {
      name: "Good (70-84)",
      value: performanceData.filter((item) => item.score >= 70 && item.score < 85).length,
      fill: "#3b82f6",
    },
    {
      name: "Needs Work (<70)",
      value: performanceData.filter((item) => item.score < 70).length,
      fill: "#f59e0b",
    },
  ];

  const subjectChartConfig = {
    score: {
      label: "Score",
      color: "#4f46e5",
    },
  } satisfies ChartConfig;

  const weeklyChartConfig = {
    hours: {
      label: "Hours",
      color: "#06b6d4",
    },
  } satisfies ChartConfig;

  const scoreBandChartConfig = {
    excellent: { label: "Excellent", color: "#10b981" },
    good: { label: "Good", color: "#3b82f6" },
    needsWork: { label: "Needs Work", color: "#f59e0b" },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(getHomePath())}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Performance Analytics</h1>
            <p className="text-sm text-muted-foreground">Track your learning progress</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          Export Report
        </Button>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        {/* Overview Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-medium">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <span className="text-3xl font-bold">{overview.overallGrade}</span>
              </div>
              <p className="text-sm text-muted-foreground">Overall Grade</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-secondary to-accent shadow-medium">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <span className="text-3xl font-bold">{overview.thisWeekHours}h</span>
              </div>
              <p className="text-sm text-muted-foreground">This Week</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-accent to-secondary shadow-medium">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <span className="text-3xl font-bold">{overview.improvementPct >= 0 ? "+" : ""}{overview.improvementPct}%</span>
              </div>
              <p className="text-sm text-muted-foreground">Improvement</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent shadow-medium">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <span className="text-3xl font-bold">{overview.aiSessions}</span>
              </div>
              <p className="text-sm text-muted-foreground">AI Sessions</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="shadow-medium lg:col-span-2">
            <CardHeader>
              <CardTitle>Performance by Subject</CardTitle>
              <CardDescription>Average score (%) across topics</CardDescription>
            </CardHeader>
            <CardContent>
              {subjectChartData.length === 0 ? (
                <div className="text-sm text-muted-foreground">No quiz performance data yet.</div>
              ) : (
                <ChartContainer config={subjectChartConfig} className="h-[320px] w-full">
                  <BarChart data={subjectChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="subject" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="var(--color-score)" />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
              <CardDescription>Topic quality mix</CardDescription>
            </CardHeader>
            <CardContent>
              {subjectChartData.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data to visualize.</div>
              ) : (
                <ChartContainer config={scoreBandChartConfig} className="h-[320px] w-full">
                  <PieChart>
                    <Pie data={scoreBandData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={98} paddingAngle={4}>
                      {scoreBandData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <ChartLegend content={<ChartLegendContent />} verticalAlign="bottom" />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-medium mt-8">
          <CardHeader>
            <CardTitle>Weekly Activity Trend</CardTitle>
            <CardDescription>Study hours over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={weeklyChartConfig} className="h-[300px] w-full">
              <LineChart data={weeklyChartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="var(--color-hours)"
                  strokeWidth={3}
                  dot={{ fill: "var(--color-hours)", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analytics;
