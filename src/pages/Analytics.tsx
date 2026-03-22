import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, Award, Clock, BarChart3, Download } from "lucide-react";
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
  Area,
  AreaChart,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import AppSidebar from "@/components/AppSidebar";

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

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
      if (!user) { setLoading(false); return; }

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
        const { data: quizSets } = await supabase.from("quiz_sets").select("id, topic").in("id", quizIds);
        (quizSets || []).forEach((quiz: any) => { topicByQuizId.set(quiz.id, quiz.topic || "General"); });
      }

      const quizAttempts: QuizAttemptRecord[] = quizSetAttempts.map((attempt) => ({
        topic: topicByQuizId.get(attempt.contentId) || "General",
        score: Math.max(0, Math.min(100, attempt.score)),
        createdAt: attempt.createdAt,
      }));

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
            return { topic, score: Math.max(0, Math.min(100, normalizedScore)), createdAt };
          })
          .filter((item): item is QuizAttemptRecord => item !== null);

        quizAttempts.push(...normalizedPlacementAttempts);
      } catch { /* resilient */ }

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

      const currentScores = quizAttempts.filter((q) => q.createdAt >= currentWindowStart).map((q) => q.score);
      const previousScores = quizAttempts.filter((q) => q.createdAt >= previousWindowStart && q.createdAt < currentWindowStart).map((q) => q.score);

      const currentAvg = currentScores.length > 0 ? currentScores.reduce((s, sc) => s + sc, 0) / currentScores.length : 0;
      const previousAvg = previousScores.length > 0 ? previousScores.reduce((s, sc) => s + sc, 0) / previousScores.length : 0;

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

  // ─── Chart Data ──────────────────────────────────────────────────
  const subjectChartData = performanceData.map((item) => ({ subject: item.subject, score: item.score }));
  const weeklyChartData = weeklyActivity.map((item) => ({ day: item.day, hours: item.hours }));

  const scoreBandData = [
    { name: "Excellent (85+)", value: performanceData.filter((i) => i.score >= 85).length, fill: "#10b981" },
    { name: "Good (70-84)", value: performanceData.filter((i) => i.score >= 70 && i.score < 85).length, fill: "#6366f1" },
    { name: "Needs Work (<70)", value: performanceData.filter((i) => i.score < 70).length, fill: "#f59e0b" },
  ];

  const subjectChartConfig = { score: { label: "Score", color: "#8b5cf6" } } satisfies ChartConfig;
  const weeklyChartConfig = { hours: { label: "Hours", color: "#06b6d4" } } satisfies ChartConfig;
  const scoreBandChartConfig = {
    excellent: { label: "Excellent", color: "#10b981" },
    good: { label: "Good", color: "#6366f1" },
    needsWork: { label: "Needs Work", color: "#f59e0b" },
  } satisfies ChartConfig;

  const floatingGlassCard =
    "rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300";

  // ─── Overview Stat Cards ─────────────────────────────────────────
  const statsItems = [
    {
      label: "Overall Grade",
      value: overview.overallGrade,
      icon: Award,
      gradient: "from-violet-500 to-purple-600",
      glow: "rgba(139,92,246,0.25)",
    },
    {
      label: "This Week",
      value: `${overview.thisWeekHours}h`,
      icon: Clock,
      gradient: "from-blue-500 to-cyan-500",
      glow: "rgba(6,182,212,0.25)",
    },
    {
      label: "Improvement",
      value: `${overview.improvementPct >= 0 ? "+" : ""}${overview.improvementPct}%`,
      icon: TrendingUp,
      gradient: overview.improvementPct >= 0 ? "from-emerald-500 to-teal-500" : "from-rose-500 to-red-500",
      glow: overview.improvementPct >= 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)",
    },
    {
      label: "AI Sessions",
      value: `${overview.aiSessions}`,
      icon: Brain,
      gradient: "from-indigo-500 to-violet-600",
      glow: "rgba(99,102,241,0.25)",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-100 dark:bg-[#0f0f0f] transition-colors duration-500">
        <AppSidebar />
        <main className="ml-64 flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <BarChart3 className="h-10 w-10 text-violet-400 animate-pulse" />
            <p className="text-slate-600 dark:text-zinc-500 text-sm font-semibold">Loading analytics…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-[#0f0f0f] transition-colors duration-500">
      <AppSidebar />
      <main className="ml-64 flex-1 overflow-y-auto relative isolate">
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Ambient Depth Orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden ml-64">
          <div className="absolute -top-[15%] -right-[10%] h-[55%] w-[55%] bg-violet-500/[0.08] blur-[140px]" />
          <div className="absolute -bottom-[10%] -left-[10%] h-[55%] w-[55%] bg-blue-500/[0.06] blur-[140px]" />
          <div className="absolute top-[35%] left-[20%] h-[35%] w-[35%] bg-violet-500/5 blur-[130px]" />
        </div>

        <div className="relative z-10 min-h-screen p-8 md:p-10">
          {/* Header */}
          <header className="mb-10 flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10">
                  <BarChart3 className="h-6 w-6 text-violet-300" />
                </div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Performance Analytics</h1>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 text-base">
                Track your learning progress, quiz scores, and study habits over time.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white rounded-xl h-10 px-5 text-xs font-semibold gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </Button>
          </header>

          {/* Overview Stats */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
            {statsItems.map((item) => (
              <div
                key={item.label}
                className={`${floatingGlassCard} p-6 hover:-translate-y-1 hover:shadow-xl group`}
              >
                <div className="flex items-center justify-between mb-5">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg transition-all duration-300 group-hover:scale-110`}
                    style={{ boxShadow: `0 0 20px ${item.glow}` }}
                  >
                    <item.icon className="h-5 w-5 text-white dark:text-white" />
                  </div>
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{item.value}</span>
                </div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-600 dark:text-zinc-500">{item.label}</p>
              </div>
            ))}
          </section>

          {/* Charts Row: Performance + Score Distribution */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Performance by Subject — Bar Chart */}
            <div className={`${floatingGlassCard} lg:col-span-2`}>
              <CardHeader className="px-8 pt-8 pb-2">
                <CardTitle className="text-xl font-bold text-white">Performance by Subject</CardTitle>
                <p className="text-xs text-slate-600 dark:text-zinc-500 mt-1">Average score (%) across your top topics</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                {subjectChartData.length === 0 ? (
                  <div className="h-[320px] flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <BarChart3 className="h-8 w-8 text-slate-400 dark:text-zinc-600 mx-auto" />
                      <p className="text-slate-600 dark:text-zinc-500 text-sm">No quiz performance data yet.</p>
                      <p className="text-slate-700 dark:text-zinc-600 text-xs">Complete some quizzes to see your stats here.</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={subjectChartConfig} className="h-[320px] w-full">
                    <BarChart data={subjectChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="subject" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} tick={{ fill: "#71717a", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                      <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="url(#barGradient)" />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </div>

            {/* Score Distribution — Pie Chart */}
            <div className={floatingGlassCard}>
              <CardHeader className="px-8 pt-8 pb-2">
                <CardTitle className="text-xl font-bold text-white">Score Distribution</CardTitle>
                <p className="text-xs text-slate-600 dark:text-zinc-500 mt-1">Topic quality breakdown</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                {subjectChartData.length === 0 ? (
                  <div className="h-[320px] flex items-center justify-center">
                    <p className="text-slate-600 dark:text-zinc-500 text-sm">No data to visualize.</p>
                  </div>
                ) : (
                  <ChartContainer config={scoreBandChartConfig} className="h-[320px] w-full">
                    <PieChart>
                      <Pie data={scoreBandData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={98} paddingAngle={4} stroke="none">
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
            </div>
          </section>

          {/* Weekly Activity Trend — Area Chart */}
          <section>
            <div className={floatingGlassCard}>
              <CardHeader className="px-8 pt-8 pb-2">
                <CardTitle className="text-xl font-bold text-white">Weekly Activity Trend</CardTitle>
                <p className="text-xs text-slate-600 dark:text-zinc-500 mt-1">Study hours over the last 7 days</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <ChartContainer config={weeklyChartConfig} className="h-[300px] w-full">
                  <AreaChart data={weeklyChartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      fill="url(#areaGradient)"
                      dot={{ fill: "#06b6d4", stroke: "#0a0a0c", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "#06b6d4", strokeWidth: 2, fill: "#0a0a0c" }}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </div>
          </section>

          {/* Subject Performance Table */}
          {performanceData.length > 0 && (
            <section className="mt-8">
              <div className={floatingGlassCard}>
                <CardHeader className="px-8 pt-8 pb-4">
                  <CardTitle className="text-xl font-bold text-white">Subject Breakdown</CardTitle>
                  <p className="text-xs text-slate-600 dark:text-zinc-500 mt-1">Detailed performance per topic with trend indicators</p>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <div className="space-y-2">
                    {performanceData.map((subject) => (
                      <div
                        key={subject.subject}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-violet-300">
                              {subject.subject.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{subject.subject}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-bold ${subject.trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                                {subject.change}
                              </span>
                              <TrendingUp className={`h-3 w-3 ${subject.trend === "up" ? "text-emerald-400" : "text-rose-400 rotate-180"}`} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Score bar */}
                          <div className="w-32 h-2 rounded-full bg-white/[0.06] overflow-hidden hidden sm:block">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                              style={{ width: `${subject.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-white w-10 text-right">{subject.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Analytics;
