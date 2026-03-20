import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  BookOpen, Clock, Zap, TrendingUp, Award,
  Flame, Target, BarChart3, Bell, CheckCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";

interface DashboardStats {
  totalCourses: number;
  studyHours: number;
  totalXP: number;
  streak: number;
  level: number;
  nextLevelXP: number;
  currentXP: number;
}

interface CourseRecord {
  id: string;
  title: string;
  created_at?: string;
  duration?: string;
  modules?: unknown[];
}

interface ActivityItem {
  id: string;
  action: string;
  title: string;
  dateLabel: string;
  timestamp?: string;
}

interface LeaderboardItem {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  isYou: boolean;
}

interface AchievementItem {
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
}

interface WeeklyClassItem {
  id: string;
  title: string;
  start_time?: string;
  status?: string;
  teacher_id?: string;
  room_id?: string;
  teacherName?: string;
  roomName?: string;
}

interface AppNotification {
  id: string;
  title: string;
  description: string;
  timestamp: number;
  route?: string;
}

interface TabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const Dashboard = () => {
  useRequireAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>({
    totalCourses: 0,
    studyHours: 0,
    totalXP: 0,
    streak: 0,
    level: 1,
    nextLevelXP: 1000,
    currentXP: 0,
  });

  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("progress");
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [studyDaysThisMonth, setStudyDaysThisMonth] = useState<Set<number>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [bestStreak, setBestStreak] = useState(0);
  const [weeklyClasses, setWeeklyClasses] = useState<WeeklyClassItem[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [profileName, setProfileName] = useState("Learner");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const LEVEL_XP = 3000;

  const READ_NOTIFICATIONS_KEY = "edusync.dashboard.notifications.read";

  const parseDurationToHours = (duration?: string) => {
    if (!duration) return 0;
    const d = duration.toLowerCase();
    if (d.includes("1 hour") || d === "1h") return 1;
    if (d.includes("3 hour") || d === "3h") return 3;
    if (d.includes("week") || d === "1w") return 7;
    const numeric = Number.parseFloat((duration.match(/[\d.]+/) || ["0"])[0]);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const toDateLabel = (iso?: string) => {
    if (!iso) return "Unknown";
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return "Unknown";
    const diffMs = Date.now() - ts;
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor(diffMs / dayMs);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString();
  };

  const buildStreakFromDates = (isoDates: string[]) => {
    if (!isoDates.length) return 0;
    const dayKeys = new Set(
      isoDates
        .map((d) => new Date(d))
        .filter((d) => !Number.isNaN(d.getTime()))
        .map((d) => {
          const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return local.getTime();
        })
    );

    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    if (!dayKeys.has(cursor.getTime())) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (dayKeys.has(cursor.getTime())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  };

  const buildBestStreakFromDates = (isoDates: string[]) => {
    if (!isoDates.length) return 0;
    const dayKeys = Array.from(
      new Set(
        isoDates
          .map((d) => new Date(d))
          .filter((d) => !Number.isNaN(d.getTime()))
          .map((d) => {
            const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return local.getTime();
          })
      )
    ).sort((a, b) => a - b);

    if (!dayKeys.length) return 0;
    let best = 1;
    let current = 1;
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 1; i < dayKeys.length; i += 1) {
      if (dayKeys[i] - dayKeys[i - 1] === dayMs) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 1;
      }
    }

    return best;
  };

  const computeAchievements = (s: DashboardStats): AchievementItem[] => {
    const progressToNext = s.nextLevelXP ? (s.currentXP / s.nextLevelXP) * 100 : 0;
    return [
      { icon: "🎓", title: "Scholar", desc: "Create 5 courses", unlocked: s.totalCourses >= 5 },
      { icon: "🔥", title: "Streak Master", desc: "7-day streak", unlocked: s.streak >= 7 },
      { icon: "🚀", title: "Rocket Start", desc: "Reach level 3", unlocked: s.level >= 3 },
      { icon: "💎", title: "XP Collector", desc: "Earn 10,000 XP", unlocked: s.totalXP >= 10000 },
      { icon: "🧩", title: "Builder", desc: "Build 20 modules", unlocked: s.totalXP >= 3000 },
      { icon: "🏅", title: "Consistent", desc: "50 study hours", unlocked: s.studyHours >= 50 },
      { icon: "⚡", title: "Momentum", desc: "Level progress above 50%", unlocked: progressToNext >= 50 },
      { icon: "🧠", title: "Mastery", desc: "Reach level 5", unlocked: s.level >= 5 },
    ];
  };

  const formatSessionDateTime = (iso?: string) => {
    if (!iso) return "TBD";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "TBD";
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} • ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const fetchWeeklyClasses = async () => {
    try {
      const { data } = await supabase
        .from("study_sessions")
        .select("id, title, start_time, status, teacher_id, room_id")
        .order("start_time", { ascending: true })
        .limit(40);

      const rows = (data || []) as WeeklyClassItem[];
      if (!rows.length) {
        setWeeklyClasses([]);
        return;
      }

      const teacherIds = Array.from(new Set(rows.map((s) => s.teacher_id).filter(Boolean))) as string[];
      const roomIds = Array.from(new Set(rows.map((s) => s.room_id).filter(Boolean))) as string[];

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

      const normalized = rows.map((session) => ({
        ...session,
        teacherName: session.teacher_id ? teacherNameMap.get(session.teacher_id) || "Teacher" : "Teacher",
        roomName: session.room_id ? roomNameMap.get(session.room_id) || "Study Room" : "Study Room",
      }));

      setWeeklyClasses(normalized);
    } catch (error) {
      console.warn("Failed to fetch weekly classes:", error);
      setWeeklyClasses([]);
    }
  };

  useEffect(() => {
    fetchUserAndStats();
    fetchWeeklyClasses();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadNotificationIds(parsed.filter((v) => typeof v === "string"));
      }
    } catch {
      setReadNotificationIds([]);
    }
  }, []);

  const fetchUserAndStats = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      const resolvedName =
        profile?.username ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.user_metadata?.username ||
        authUser.email?.split("@")[0] ||
        "Learner";
      setProfileName(resolvedName);

      if (profile?.avatar_url) {
        setAvatarUrl(`${profile.avatar_url}?t=${Date.now()}`);
      } else {
        setAvatarUrl(null);
      }

      // Main source: user-generated courses
      const { data: courses, error: coursesError } = await supabase
        .from("ai_generated_courses")
        .select("id, title, created_at, duration, modules")
        .eq("created_by", authUser.id);
      if (coursesError) throw coursesError;

      const courseRecords = (courses || []) as CourseRecord[];
      const totalCourses = courseRecords.length;
      const studyHours = courseRecords.reduce((sum, c) => sum + parseDurationToHours(c.duration), 0);
      const moduleCount = courseRecords.reduce((sum, c) => sum + (Array.isArray(c.modules) ? c.modules.length : 0), 0);
      const totalXP = totalCourses * 250 + moduleCount * 120 + Math.floor(studyHours * 30);
      const level = Math.max(1, Math.floor(totalXP / LEVEL_XP) + 1);
      const currentXP = totalXP % LEVEL_XP;
      const nextLevelXP = LEVEL_XP;

      const courseDates = courseRecords
        .map((c) => c.created_at)
        .filter((d): d is string => Boolean(d));

      // Optional source: progress updates for better activity/streak data.
      let progressRows: Array<{ updated_at?: string; completed?: boolean }> = [];
      try {
        const { data: progressData } = await (supabase as any)
          .from("course_progress")
          .select("updated_at, completed")
          .eq("user_id", authUser.id)
          .order("updated_at", { ascending: false })
          .limit(200);
        progressRows = (progressData || []) as Array<{ updated_at?: string; completed?: boolean }>;
      } catch {
        progressRows = [];
      }

      const progressDates = progressRows
        .map((p) => p.updated_at)
        .filter((d): d is string => Boolean(d));
      const allActivityDates = [...courseDates, ...progressDates];
      const streak = buildStreakFromDates(allActivityDates);
      const best = buildBestStreakFromDates(allActivityDates);
      setBestStreak(best);

      const activityFromCourses: ActivityItem[] = courseRecords
        .filter((c) => c.created_at)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 6)
        .map((c) => ({
          id: c.id,
          action: "Course Created",
          title: c.title,
          dateLabel: toDateLabel(c.created_at),
          timestamp: c.created_at,
        }));

      const completedCount = progressRows.filter((p) => p.completed).length;
      const completionActivity: ActivityItem[] =
        completedCount > 0
          ? [
              {
                id: "completed-courses",
                action: "Courses Completed",
                title: `${completedCount} completed`,
                dateLabel: "Overall",
              },
            ]
          : [];

      const combinedActivity = [...activityFromCourses, ...completionActivity]
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
        .slice(0, 6);
      setRecentActivity(combinedActivity);

      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      const activeDays = new Set<number>();
      allActivityDates.forEach((d) => {
        const date = new Date(d);
        if (!Number.isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year) {
          activeDays.add(date.getDate());
        }
      });
      setStudyDaysThisMonth(activeDays);

      // Leaderboard from real course creators and derived XP.
      try {
        const { data: leaderboardCourses } = await supabase
          .from("ai_generated_courses")
          .select("created_by, duration, modules, profiles:created_by (username)")
          .not("created_by", "is", null)
          .limit(500);

        const map = new Map<string, { name: string; xp: number }>();
        ((leaderboardCourses || []) as any[]).forEach((row) => {
          const userId = row.created_by as string;
          if (!userId) return;
          const durationHours = parseDurationToHours(row.duration);
          const modules = Array.isArray(row.modules) ? row.modules.length : 0;
          const xp = 250 + modules * 120 + Math.floor(durationHours * 30);

          const existing = map.get(userId) || {
            name: row.profiles?.username || "Learner",
            xp: 0,
          };
          existing.xp += xp;
          map.set(userId, existing);
        });

        const ranked = Array.from(map.entries())
          .map(([userId, payload]) => ({ userId, ...payload }))
          .sort((a, b) => b.xp - a.xp)
          .slice(0, 10)
          .map((item, idx) => ({
            rank: idx + 1,
            userId: item.userId,
            name: item.userId === authUser.id ? "You" : item.name,
            xp: item.xp,
            isYou: item.userId === authUser.id,
          }));

        if (!ranked.some((r) => r.isYou)) {
          ranked.push({
            rank: ranked.length + 1,
            userId: authUser.id,
            name: "You",
            xp: totalXP,
            isYou: true,
          });
        }
        setLeaderboard(ranked);
      } catch {
        setLeaderboard([
          {
            rank: 1,
            userId: authUser.id,
            name: "You",
            xp: totalXP,
            isYou: true,
          },
        ]);
      }

      setStats({
        totalCourses,
        studyHours,
        totalXP,
        streak,
        level,
        nextLevelXP,
        currentXP,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: TabProps[] = [
    { id: "progress", label: "My Progress", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "achievements", label: "Achievements", icon: <Award className="w-4 h-4" /> },
  ];

  const notifications = useMemo<AppNotification[]>(() => {
    const now = Date.now();
    const next24h = now + 24 * 60 * 60 * 1000;

    const upcomingToday = weeklyClasses.filter((s) => {
      if (!s.start_time) return false;
      const ts = new Date(s.start_time).getTime();
      return Number.isFinite(ts) && ts >= now && ts <= next24h;
    });

    const notificationItems: AppNotification[] = [];

    if (upcomingToday.length > 0) {
      notificationItems.push({
        id: `upcoming-classes-${upcomingToday.length}`,
        title: "Upcoming class reminder",
        description: `${upcomingToday.length} class(es) scheduled in the next 24 hours.`,
        timestamp: now,
        route: "/study-rooms",
      });
    }

    weeklyClasses
      .filter((s) => s.start_time)
      .slice(0, 5)
      .forEach((session) => {
        const ts = new Date(session.start_time || "").getTime();
        notificationItems.push({
          id: `session-${session.id}`,
          title: session.title || "Study session update",
          description: `${formatSessionDateTime(session.start_time)} • ${session.roomName || "Study Room"}`,
          timestamp: Number.isFinite(ts) ? ts : now - 1,
          route: "/study-rooms",
        });
      });

    recentActivity.slice(0, 5).forEach((activity, idx) => {
      const ts = activity.timestamp ? new Date(activity.timestamp).getTime() : now - (idx + 1) * 60000;
      notificationItems.push({
        id: `activity-${activity.id}`,
        title: activity.action,
        description: activity.title,
        timestamp: Number.isFinite(ts) ? ts : now - (idx + 1) * 60000,
      });
    });

    if (stats.streak === 0) {
      notificationItems.push({
        id: "streak-zero",
        title: "Streak reset",
        description: "Do one learning action today to start your streak again.",
        timestamp: now - 5000,
        route: "/ai-course-creator",
      });
    }

    if (stats.totalCourses > 0) {
      notificationItems.push({
        id: `courses-${stats.totalCourses}`,
        title: "Course milestone",
        description: `You have created ${stats.totalCourses} course(s). Keep building!`,
        timestamp: now - 10000,
        route: "/ai-course-creator",
      });
    }

    if (bestStreak > 0) {
      notificationItems.push({
        id: `best-streak-${bestStreak}`,
        title: "Best streak record",
        description: `Your best streak is ${bestStreak} day(s).`,
        timestamp: now - 15000,
      });
    }

    return notificationItems
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [weeklyClasses, recentActivity, stats.streak, stats.totalCourses, bestStreak]);

  const unreadNotificationCount = useMemo(() => {
    const readSet = new Set(readNotificationIds);
    return notifications.filter((n) => !readSet.has(n.id)).length;
  }, [notifications, readNotificationIds]);

  const markNotificationRead = (notificationId: string) => {
    setReadNotificationIds((prev) => {
      if (prev.includes(notificationId)) return prev;
      const next = [...prev, notificationId];
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotificationIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const renderStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Courses</p>
          <BookOpen className="w-4 h-4 text-blue-400" />
        </div>
        <p className="text-2xl font-bold text-white">{stats.totalCourses}</p>
      </div>

      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Study Hours</p>
          <Clock className="w-4 h-4 text-purple-400" />
        </div>
        <p className="text-2xl font-bold text-white">{stats.studyHours}</p>
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total XP</p>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-2xl font-bold text-white">{(stats.totalXP / 1000).toFixed(1)}K</p>
      </div>

      <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Streak</p>
          <Flame className="w-4 h-4 text-red-400" />
        </div>
        <p className="text-2xl font-bold text-white">{stats.streak}</p>
      </div>
    </div>
  );

  const renderProfileCard = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] items-start gap-6 mb-8">
      <div className="space-y-6">
        <div className="w-full bg-gradient-to-br from-[#11182c]/95 to-[#14132a]/95 border border-white/10 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: User Info and Level */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl text-white font-bold">
                      {profileName?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">
                    {profileName}
                  </p>
                  <p className="text-gray-400 text-sm">Level {stats.level}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-semibold">LEVEL PROGRESS</span>
                  <span className="text-xs text-gray-400">{stats.currentXP} / {stats.nextLevelXP}</span>
                </div>
                <Progress value={(stats.currentXP / stats.nextLevelXP) * 100} className="h-2" />
              </div>
            </div>

            {/* Center: Stats Grid (Day Streak removed to free space) */}
            <div className="md:col-span-1 grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-2xl font-bold text-white">{stats.studyHours}h</p>
                <p className="text-xs text-gray-400">Study Time</p>
              </div>
              <div className="text-center p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-2xl font-bold text-white">{computeAchievements(stats).filter((a) => a.unlocked).length}</p>
                <p className="text-xs text-gray-400">Badges</p>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="md:col-span-1 flex flex-col gap-2">
              <Button
                onClick={() => navigate("/ai-course-creator")}
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white font-semibold"
              >
                <Zap className="w-4 h-4 mr-2" />
                Create Course
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {renderWeeklyClasses("mb-0")}
      </div>

      <Card className="w-full xl:w-[320px] bg-white/5 border-white/10 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-white">Study Calendar</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-[11px] text-gray-400">Current Streak</p>
              <p className="text-base font-semibold text-white">{stats.streak} days</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-[11px] text-gray-400">Best Streak</p>
              <p className="text-base font-semibold text-white">{bestStreak} days</p>
            </div>
          </div>

          <UiCalendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="w-full rounded-md border border-white/10 bg-black/20"
            modifiers={{
              active: (date) => {
                const now = new Date();
                return (
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear() &&
                  studyDaysThisMonth.has(date.getDate())
                );
              },
            }}
            modifiersClassNames={{
              active: "bg-primary/25 text-primary-foreground rounded-md",
            }}
          />

          <div className="mt-3 space-y-1 text-[11px] text-gray-400">
            <p>
              <span className="inline-block w-2 h-2 rounded-full bg-primary/60 mr-2 align-middle" />
              Highlighted dates = days with recorded activity this month.
            </p>
            {selectedDate && (
              <p>
                Selected day: {selectedDate.toLocaleDateString()} {studyDaysThisMonth.has(selectedDate.getDate()) ? "(has activity)" : "(no activity logged)"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderWeeklyClasses = (className = "") => (
    <Card className={`bg-white/5 border-white/10 ${className}`.trim()}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-300" />
          Weekly Classes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(() => {
          const now = new Date();
          const startOfToday = new Date(now);
          startOfToday.setHours(0, 0, 0, 0);

          const endOfToday = new Date(startOfToday);
          endOfToday.setDate(endOfToday.getDate() + 1);

          const endOfWeek = new Date(startOfToday);
          endOfWeek.setDate(endOfWeek.getDate() + 7);

          const todayItems = weeklyClasses.filter((s) => {
            if (!s.start_time) return false;
            const ts = new Date(s.start_time);
            return ts >= startOfToday && ts < endOfToday && (s.status || "").toLowerCase() !== "completed";
          });

          const weekItems = weeklyClasses.filter((s) => {
            if (!s.start_time) return false;
            const ts = new Date(s.start_time);
            return ts >= endOfToday && ts <= endOfWeek && (s.status || "").toLowerCase() !== "completed";
          });

          const completedItems = weeklyClasses
            .filter((s) => (s.status || "").toLowerCase() === "completed")
            .slice(0, 8);

          const columns = [
            { key: "today", title: "Today", items: todayItems, accent: "text-cyan-300 border-cyan-400/20" },
            { key: "week", title: "This Week", items: weekItems, accent: "text-violet-300 border-violet-400/20" },
            { key: "completed", title: "Completed", items: completedItems, accent: "text-emerald-300 border-emerald-400/20" },
          ];

          const totalVisible = todayItems.length + weekItems.length + completedItems.length;

          return (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xs text-gray-400">Today</p>
                  <p className="text-xl font-semibold text-white">{todayItems.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xs text-gray-400">This Week</p>
                  <p className="text-xl font-semibold text-white">{weekItems.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xs text-gray-400">Completed</p>
                  <p className="text-xl font-semibold text-white">{completedItems.length}</p>
                </div>
              </div>

              {totalVisible === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                  <p className="text-white font-medium">No classes in the weekly board yet.</p>
                  <p className="text-gray-400 text-sm mt-1">Join or schedule sessions in Study Rooms to populate this board.</p>
                  <Button className="mt-3" size="sm" onClick={() => navigate("/study-rooms")}>
                    Go to Study Rooms
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {columns.map((column) => (
                    <div key={column.key} className={`rounded-xl border bg-black/20 p-3 ${column.accent}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">{column.title}</h4>
                        <span className="text-xs text-gray-400">{column.items.length}</span>
                      </div>
                      <div className="space-y-2 min-h-16">
                        {column.items.length === 0 ? (
                          <p className="text-xs text-gray-500">No classes</p>
                        ) : (
                          column.items.slice(0, 4).map((session) => (
                            <div key={session.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                              <p className="text-sm font-medium text-white leading-tight">{session.title || "Untitled Session"}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{formatSessionDateTime(session.start_time)}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">{session.roomName} • {session.teacherName}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </CardContent>
    </Card>
  );

  const renderMyProgress = () => (
    <div className="space-y-6">
      {/* Recent Activity */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentActivity.length === 0 && (
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
              <div>
                <p className="text-white font-semibold text-sm">No recent activity</p>
                <p className="text-gray-400 text-xs">Start by creating your first AI course.</p>
              </div>
              <Button size="sm" onClick={() => navigate("/ai-course-creator")}>Create</Button>
            </div>
          )}
          {recentActivity.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
              <div>
                <p className="text-white font-semibold text-sm">{item.action}</p>
                <p className="text-gray-400 text-xs">{item.title}</p>
              </div>
              <span className="text-gray-500 text-xs">{item.dateLabel}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Learning Goals */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Learning Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              goal: "Create 5 courses",
              progress: Math.min(100, Math.round((stats.totalCourses / 5) * 100)),
            },
            {
              goal: "Earn 10,000 XP",
              progress: Math.min(100, Math.round((stats.totalXP / 10000) * 100)),
            },
            {
              goal: "Maintain 7-day streak",
              progress: Math.min(100, Math.round((stats.streak / 7) * 100)),
            },
          ].map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-white text-sm font-medium">{item.goal}</p>
                <span className="text-gray-400 text-xs">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderLeaderboard = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Top Learners
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboard.length === 0 && (
          <div className="p-3 rounded-lg border bg-white/5 border-white/5 text-sm text-gray-300">
            Leaderboard data is not available yet.
          </div>
        )}
        {leaderboard.map((item) => (
          <div 
            key={item.rank} 
            className={`flex items-center justify-between p-3 rounded-lg border ${
              item.isYou 
                ? "bg-primary/20 border-primary/40" 
                : "bg-white/5 border-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {item.rank === 1 ? "🏆" : item.rank === 2 ? "🥈" : item.rank === 3 ? "🥉" : "👤"}
              </span>
              <div>
                <p className={item.isYou ? "text-primary font-semibold" : "text-white font-semibold text-sm"}>
                  {item.name}
                </p>
              </div>
            </div>
            <p className="text-gray-400 text-sm font-semibold">{(item.xp / 1000).toFixed(0)}K XP</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderAchievements = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {computeAchievements(stats).map((achievement, i) => (
        <div
          key={i}
          className={`flex flex-col items-center justify-center p-6 rounded-xl transition-all group cursor-pointer border ${
            achievement.unlocked
              ? "bg-gradient-to-br from-white/5 to-primary/10 border-primary/30 hover:border-primary/50"
              : "bg-gradient-to-br from-white/5 to-white/0 border-white/10 hover:border-white/20"
          }`}
        >
          <p className="text-4xl mb-2 group-hover:scale-125 transition-transform">{achievement.icon}</p>
          <p className="text-white font-semibold text-sm text-center">{achievement.title}</p>
          <p className="text-gray-400 text-xs text-center mt-1">{achievement.desc}</p>
          <p className={`text-[11px] mt-2 font-semibold ${achievement.unlocked ? "text-primary" : "text-gray-500"}`}>
            {achievement.unlocked ? "Unlocked" : "Locked"}
          </p>
        </div>
      ))}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "progress":
        return renderMyProgress();
      case "leaderboard":
        return renderLeaderboard();
      case "achievements":
        return renderAchievements();
      default:
        return renderMyProgress();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#05070f] to-[#0a0e1a]">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#05070f] to-[#0a0e1a]">
      <AppSidebar />
      <main className="ml-64 flex-1 overflow-y-auto">
        <div className="min-h-screen p-6 md:p-8">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
              <p className="text-gray-400">Welcome back! Keep up the momentum.</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="relative border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                  {unreadNotificationCount > 0 && (
                    <Badge className="ml-2 bg-red-500 hover:bg-red-500 text-white text-[10px] h-5 px-1.5">
                      {unreadNotificationCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px] max-h-[420px] overflow-y-auto bg-[#101626] border-white/10 text-white">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>App Notifications</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-gray-300 hover:text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      markAllNotificationsRead();
                    }}
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
                  </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />

                {notifications.length === 0 && (
                  <DropdownMenuItem className="py-3 text-gray-400" disabled>
                    No notifications right now.
                  </DropdownMenuItem>
                )}

                {notifications.map((notification) => {
                  const isRead = readNotificationIds.includes(notification.id);
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`items-start flex-col gap-1 py-2.5 px-2 cursor-pointer ${isRead ? "opacity-70" : ""}`}
                      onClick={() => {
                        markNotificationRead(notification.id);
                        if (notification.route) navigate(notification.route);
                      }}
                    >
                      <div className="w-full flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white line-clamp-1">{notification.title}</p>
                        {!isRead && <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{notification.description}</p>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats Header */}
          {renderStats()}

          {/* Profile Card */}
          {renderProfileCard()}

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
