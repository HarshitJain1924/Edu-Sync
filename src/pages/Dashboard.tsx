import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  BookOpen,
  Clock,
  Zap,
  TrendingUp,
  Award,
  Flame,
  Target,
  BarChart3,
  Bell,
  CheckCheck,
  Menu,
  ChevronRight,
  Search,
  LayoutGrid,
  School,
  Users,
  Sparkles,
  User,
  Video,
  Play,
  Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";

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
  topic?: string;
  created_at?: string;
  duration?: string;
  thumbnail_url?: string;
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

interface FeaturedCourse {
  title: string;
  topic: string;
  subtitle: string;
  progress: number;
  durationLabel: string;
  moduleCount: number;
  thumbnailUrl?: string;
}

const courseImageCache: Record<string, string> = {};

const getPicsumUrl = (topic: string, title: string) => {
  const seed = `${topic}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
  return `https://picsum.photos/seed/${seed}/1200/900`;
};

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedWeekDay, setSelectedWeekDay] = useState(0);
  const [featuredCourse, setFeaturedCourse] = useState<FeaturedCourse>({
    title: "Your Latest Course",
    topic: "learning",
    subtitle: "Learning Path",
    progress: 35,
    durationLabel: "Self-paced",
    moduleCount: 0,
    thumbnailUrl: undefined,
  });
  const [featuredCourseRecord, setFeaturedCourseRecord] = useState<CourseRecord | null>(null);

  const LEVEL_XP = 3000;

  const READ_NOTIFICATIONS_KEY = "edusync.dashboard.notifications.read";
  const SIDEBAR_COLLAPSE_KEY = "edusync.sidebar.collapsed";

  const parseDurationToHours = (duration?: string) => {
    if (!duration) return 0;
    const d = duration.toLowerCase();
    if (d.includes("1 hour") || d === "1h") return 1;
    if (d.includes("3 hour") || d === "3h") return 3;
    if (d.includes("week") || d === "1w") return 7;
    const numeric = Number.parseFloat((duration.match(/[\d.]+/) || ["0"])[0]);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const countCourseLessons = (modules?: unknown[]): number => {
    if (!Array.isArray(modules)) return 0;
    return modules.reduce<number>((sum, mod) => {
      const modWithLessons = mod as { lessons?: unknown[] };
      const lessonCount: number = Array.isArray(modWithLessons.lessons) ? modWithLessons.lessons.length : 0;
      return sum + lessonCount;
    }, 0);
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

  useEffect(() => {
    const syncSidebarState = () => {
      try {
        setIsSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
      } catch {
        setIsSidebarCollapsed(false);
      }
    };

    syncSidebarState();
    window.addEventListener("storage", syncSidebarState);
    window.addEventListener("edusync:sidebar-toggled", syncSidebarState as EventListener);

    return () => {
      window.removeEventListener("storage", syncSidebarState);
      window.removeEventListener("edusync:sidebar-toggled", syncSidebarState as EventListener);
    };
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
        .select("id, title, topic, created_at, duration, thumbnail_url, modules")
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

      const latestCourse = [...courseRecords]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

      if (latestCourse) {
        const modules = Array.isArray(latestCourse.modules) ? latestCourse.modules.length : 0;
        const totalLessons = countCourseLessons(latestCourse.modules);
        const title = latestCourse.title || "Your Latest Course";
        const subtitle = modules > 0 ? `${modules} module${modules === 1 ? "" : "s"}` : "Learning Path";
        let progress = Math.max(0, Math.min(100, Math.round((currentXP / Math.max(1, nextLevelXP)) * 100) || 0));

        if (latestCourse.id && totalLessons > 0) {
          try {
            const { data: featuredProgressRows } = await (supabase as any)
              .from("course_progress")
              .select("lesson_id")
              .eq("user_id", authUser.id)
              .eq("course_id", latestCourse.id)
              .eq("completed", true);

            const completedLessons = new Set((featuredProgressRows || []).map((row: any) => row.lesson_id));
            progress = Math.round((completedLessons.size / totalLessons) * 100);
          } catch {
            // Keep fallback progress when course progress rows are unavailable.
          }
        }

        setFeaturedCourseRecord(latestCourse);
        setFeaturedCourse({
          title,
          topic: latestCourse.topic || "learning",
          subtitle,
          progress,
          durationLabel: latestCourse.duration || "Self-paced",
          moduleCount: modules,
          thumbnailUrl: latestCourse.thumbnail_url,
        });
      } else {
        setFeaturedCourseRecord(null);
        setFeaturedCourse({
          title: "Create Your First Course",
          topic: "learning",
          subtitle: "Learning Path",
          progress: 18,
          durationLabel: "Start now",
          moduleCount: 0,
          thumbnailUrl: undefined,
        });
      }

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
    { id: "progress", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "leaderboard", label: "Leaderboard", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "achievements", label: "Achievements", icon: <Award className="w-4 h-4" /> },
  ];

  const mobileNavItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Study Rooms", path: "/study-rooms" },
    { label: "Video Learning", path: "/videos" },
    { label: "Analytics", path: "/analytics" },
    { label: "Practice Hub", path: "/quiz" },
    { label: "Games", path: "/games" },
    { label: "Placement Prep", path: "/placement-prep" },
    { label: "Job Updates", path: "/jobs" },
    { label: "Resume Builder", path: "/resume-builder" },
    { label: "Settings", path: "/settings" },
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

  const heroProgress = Math.max(0, Math.min(100, featuredCourse.progress));

  const openFeaturedCourse = () => {
    if (featuredCourseRecord) {
      navigate("/course-view", { state: featuredCourseRecord });
      return;
    }
    navigate("/ai-course-creator");
  };
  const [heroImageUrl, setHeroImageUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const loadHeroImage = async () => {
      if (featuredCourse.thumbnailUrl && featuredCourse.thumbnailUrl.trim().length > 0) {
        setHeroImageUrl(featuredCourse.thumbnailUrl);
        return;
      }

      const topic = (featuredCourse.topic || featuredCourse.title || "learning").toLowerCase().trim();
      if (courseImageCache[topic]) {
        setHeroImageUrl(courseImageCache[topic]);
        return;
      }

      const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
      if (accessKey) {
        try {
          const query = encodeURIComponent(featuredCourse.topic || featuredCourse.title || "online learning");
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&client_id=${accessKey}`,
            { headers: { "Accept-Version": "v1" } }
          );

          if (res.ok) {
            const data = await res.json();
            const url = data.results?.[0]?.urls?.regular;
            if (url) {
              courseImageCache[topic] = url;
              if (!cancelled) setHeroImageUrl(url);
              return;
            }
          }
        } catch {
          // fall through to picsum fallback
        }
      }

      const fallback = getPicsumUrl(featuredCourse.topic || "learning", featuredCourse.title || "course");
      courseImageCache[topic] = fallback;
      if (!cancelled) setHeroImageUrl(fallback);
    };

    loadHeroImage();
    return () => {
      cancelled = true;
    };
  }, [featuredCourse.thumbnailUrl, featuredCourse.topic, featuredCourse.title]);

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

  const renderStats = () => (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
      {[
        { label: "Total Courses", value: `${stats.totalCourses}`, hint: `+${Math.max(0, stats.totalCourses - 10)} new`, icon: BookOpen },
        { label: "Study Hours", value: `${stats.studyHours}h`, hint: "Weekly", icon: Clock },
        { label: "Total XP", value: `${stats.totalXP.toLocaleString()}`, hint: "Top track", icon: Zap },
        { label: "Daily Streak", value: `${stats.streak} Days`, hint: "Elite", icon: Flame },
      ].map((item) => (
        <SpotlightCard key={item.label} className={cn(floatingGlassCardClass, "shadow-[0_20px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]")}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-slate-600 dark:text-zinc-400">{item.label}</p>
              <item.icon className="h-4 w-4 text-slate-700 dark:text-zinc-300" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">{item.value}</p>
              <span className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-zinc-300 font-semibold">
                {item.hint}
              </span>
            </div>
          </CardContent>
        </SpotlightCard>
      ))}
    </section>
  );

  const renderHero = () => (
    <section className="mb-8 relative">
      <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-violet-500/5 to-blue-500/5 blur-2xl" />
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_70%_20%,rgba(194,132,255,0.08),transparent_60%),radial-gradient(circle_at_18%_88%,rgba(105,156,255,0.06),transparent_62%)] blur-2xl" />
      <Card className={`${floatingGlassCardClass} relative rounded-[2rem] backdrop-blur-2xl overflow-hidden`}>
        <CardContent className="p-8 md:p-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-center">
          <div className="space-y-7">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-violet-300 animate-pulse" />
                <span className="text-[10px] tracking-[0.2em] uppercase text-violet-200/90 font-bold">Resume Learning Session</span>
              </div>
              <h2 className="text-5xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
                {featuredCourse.title}
                <span className="block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{featuredCourse.subtitle}</span>
              </h2>
            </div>

            <div className="max-w-xl space-y-3">
              <div className="flex items-center justify-between text-[10px] tracking-[0.18em] uppercase font-bold">
                <span className="text-slate-600 dark:text-zinc-400">Course Progress</span>
                <span className="text-slate-900 dark:text-white">{heroProgress}% Completed</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 border border-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400" style={{ width: `${heroProgress}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="h-12 px-8 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-black hover:bg-slate-800 dark:hover:bg-zinc-100 font-semibold"
                onClick={openFeaturedCourse}
              >
                Continue Session
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-12 px-8 rounded-2xl border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10"
                onClick={openFeaturedCourse}
              >
                Course Details
              </Button>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-3xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-2.5 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
              <div className="relative rounded-2xl overflow-hidden aspect-square bg-slate-200 dark:bg-black/70 group">
                <motion.img
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 0.5, 0]
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  src={heroImageUrl}
                  alt="Course Preview"
                  className="h-full w-full object-cover opacity-82 transition-transform duration-700 group-hover:scale-110"
                  onError={() => {
                    const fallback = getPicsumUrl(featuredCourse.topic || "learning", featuredCourse.title || "course");
                    if (heroImageUrl !== fallback) {
                      setHeroImageUrl(fallback);
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 dark:from-black/80 via-slate-900/20 dark:via-black/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={openFeaturedCourse}
                    aria-label="Open featured course"
                    className="h-16 w-16 rounded-full border border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/10 backdrop-blur-xl flex items-center justify-center transition-colors hover:bg-slate-200 dark:hover:bg-white/20"
                  >
                    <Play className="h-8 w-8 text-slate-900 dark:text-white fill-slate-900 dark:fill-white" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[10px] tracking-[0.16em] uppercase font-bold text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                  <span>{featuredCourse.durationLabel}</span>
                  <span>{featuredCourse.moduleCount} Modules</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );

  const renderWeeklyClassesPanel = () => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfWeekWindow = new Date(startOfToday);
    endOfWeekWindow.setDate(endOfWeekWindow.getDate() + 7);

    // Build 7 day lanes
    const lanes = Array.from({ length: 7 }, (_, index) => {
      const laneStart = new Date(startOfToday);
      laneStart.setDate(startOfToday.getDate() + index);

      const laneEnd = new Date(laneStart);
      laneEnd.setDate(laneEnd.getDate() + 1);

      const laneItems = weeklyClasses
        .filter((s) => {
          if (!s.start_time) return false;
          const ts = new Date(s.start_time);
          return ts >= laneStart && ts < laneEnd;
        })
        .sort((a, b) => new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime());

      const isToday = index === 0;

      return {
        key: laneStart.toISOString().slice(0, 10),
        dayLabel: isToday ? "Today" : laneStart.toLocaleDateString(undefined, { weekday: "short" }),
        dateNum: laneStart.getDate(),
        monthLabel: laneStart.toLocaleDateString(undefined, { month: "short" }),
        items: laneItems,
        isToday,
      };
    });

    const totalUpcoming = lanes.reduce((sum, l) => sum + l.items.filter((s) => (s.status || "").toLowerCase() !== "completed").length, 0);
    const totalCompleted = weeklyClasses.filter((s) => (s.status || "").toLowerCase() === "completed").length;

    const selectedDay = selectedWeekDay;
    const setSelectedDay = (i: number) => setSelectedWeekDay(i);
    const activeLane = lanes[selectedDay];

    const getSessionStatus = (session: WeeklyClassItem) => {
      const status = (session.status || "").toLowerCase();
      if (status === "completed") return "completed";
      if (!session.start_time) return "upcoming";
      const ts = new Date(session.start_time).getTime();
      const nowMs = Date.now();
      // Consider "live" if within 1h window
      if (ts <= nowMs && ts + 3600000 >= nowMs) return "live";
      if (ts > nowMs) return "upcoming";
      return "past";
    };

    const statusConfig: Record<string, { dot: string; label: string; text: string; bg: string; border: string }> = {
      live: { dot: "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]", label: "Live Now", text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
      upcoming: { dot: "bg-violet-400", label: "Upcoming", text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/20" },
      completed: { dot: "bg-zinc-500", label: "Completed", text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
      past: { dot: "bg-zinc-600", label: "Past", text: "text-zinc-500", bg: "bg-zinc-500/5", border: "border-zinc-500/10" },
    };

    return (
      <Card className={`${floatingGlassCardClass} h-full`}>
        <CardHeader className="pb-2 px-8 pt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">Weekly Schedule</CardTitle>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                <span className="text-slate-900 dark:text-zinc-200 font-semibold">{totalUpcoming}</span> upcoming · <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{totalCompleted}</span> completed
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl h-9 text-xs font-semibold"
              onClick={() => navigate("/study-rooms")}
            >
              <Video className="h-3.5 w-3.5 mr-1.5" />
              All Rooms
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          {/* Day Selector - Horizontal Pills */}
          <div className="flex gap-2 mb-6 overflow-x-auto py-1 no-scrollbar">
            {lanes.map((lane, i) => {
              const hasClasses = lane.items.length > 0;
              const isActive = selectedDay === i;
              return (
                <motion.button
                  key={lane.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedDay(i)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-3 rounded-2xl border transition-all duration-300 min-w-[72px] relative ${
                    isActive
                      ? "bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-white/20 shadow-[0_0_15px_rgba(167,139,250,0.15)]"
                      : "bg-transparent border-slate-200/30 dark:border-white/[0.04] hover:bg-slate-100/50 dark:hover:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/10"
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${isActive ? "text-violet-600 dark:text-violet-300" : "text-slate-600 dark:text-zinc-500"}`}>
                    {lane.dayLabel}
                  </span>
                  <span className={`text-lg font-bold ${isActive ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-zinc-400"}`}>
                    {lane.dateNum}
                  </span>
                  {hasClasses && (
                    <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${lane.isToday ? "bg-emerald-400 animate-pulse" : "bg-violet-400"}`} />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Session Timeline */}
          {activeLane.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/[0.02] p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-5 w-5 text-slate-600 dark:text-zinc-500" />
              </div>
              <p className="text-slate-700 dark:text-zinc-300 font-semibold text-sm mb-1">No classes on {activeLane.dayLabel}</p>
              <p className="text-slate-600 dark:text-zinc-500 text-xs mb-4">Schedule a session or join an existing Study Room.</p>
              <Button
                size="sm"
                className="rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:opacity-90 font-semibold text-xs h-9 px-5"
                onClick={() => navigate("/study-rooms")}
              >
                Browse Study Rooms
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeLane.items.map((session, idx) => {
                const status = getSessionStatus(session);
                const config = statusConfig[status] || statusConfig.upcoming;
                const timeStr = session.start_time
                  ? new Date(session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "TBD";

                return (
                  <div
                    key={session.id}
                    className={`group rounded-2xl border ${config.border} bg-slate-50 dark:bg-white/[0.02] backdrop-blur-xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] relative overflow-hidden`}
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    {/* Subtle left accent bar */}
                    <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${status === "live" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : status === "completed" ? "bg-slate-400 dark:bg-zinc-600" : "bg-violet-500/70 dark:bg-violet-400/60"}`} />

                    <div className="flex items-start justify-between gap-4 pl-4">
                      <div className="flex-1 space-y-2.5">
                        {/* Status + Time Row */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg ${config.bg} ${config.text} border ${config.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            {config.label}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10">
                            {timeStr}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-violet-700 dark:group-hover:text-violet-200 transition-colors">
                          {session.title || "Untitled Session"}
                        </h4>

                        {/* Meta chips */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 flex items-center justify-center text-[8px] text-white font-bold">
                              {(session.teacherName || "T").charAt(0)}
                            </span>
                            {session.teacherName || "Teacher"}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span>{session.roomName || "Study Room"}</span>
                        </div>
                      </div>

                      {/* Action area */}
                      {status === "live" ? (
                        <Button
                          size="sm"
                          className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs h-9 px-4 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                          onClick={() => navigate("/study-rooms")}
                        >
                          Join
                        </Button>
                      ) : status === "upcoming" ? (
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-zinc-500 bg-slate-100 dark:bg-white/5 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-white/5">
                          <Clock className="h-3 w-3" />
                          {timeStr}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600 dark:text-zinc-600 font-semibold uppercase tracking-wider">Done</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCalendarAndGoals = () => (
    <div className="space-y-6">
      <Card className={floatingGlassCardClass}>
        <CardHeader className="px-8 pt-8 pb-4">
          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">Study Calendar</CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="[&_.rdp]:bg-slate-100 dark:[&_.rdp]:bg-black/20">
            <UiCalendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/20"
              classNames={{
                caption_label: "text-sm font-semibold text-slate-900 dark:text-white",
                head_cell: "rounded-md w-9 font-semibold text-[0.8rem] text-slate-700 dark:text-zinc-300",
                nav_button: "h-7 w-7 border border-slate-300 dark:border-white/20 bg-white/80 dark:bg-transparent text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-white/10 p-0 opacity-100",
                day: "h-9 w-9 p-0 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 aria-selected:opacity-100",
                day_today: "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white font-bold",
                day_outside: "text-slate-600 dark:text-zinc-500 opacity-95",
                day_disabled: "text-slate-400 dark:text-zinc-600 opacity-60",
              }}
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
                active: "bg-violet-600 dark:bg-violet-400 text-white dark:text-black rounded-md font-bold",
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={floatingGlassCardClass}>
        <CardHeader className="px-8 pt-8 pb-3">
          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">Practice Hub</CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8 space-y-5">
          <p className="text-sm text-slate-600 dark:text-zinc-400">One place for revision and recall. Use quizzes for testing knowledge.</p>

          <div className="grid grid-cols-1 gap-3">
            <Button
              className="h-11 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-black hover:bg-slate-800 dark:hover:bg-zinc-100 font-semibold"
              onClick={() => navigate("/quiz")}
            >
              Quiz Mode
            </Button>
          </div>

          <Separator className="bg-slate-200 dark:bg-white/10" />

          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 dark:border-violet-400/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-300 flex-shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-1">Personalize Your Learning</p>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">Discover your learning style to get tailored content recommendations.</p>
                <Button
                  size="sm"
                  className="h-8 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs"
                  onClick={() => navigate("/learning-style-quiz")}
                >
                  Take Quiz
                </Button>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-200 dark:bg-white/10" />

          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-600 dark:text-zinc-400">Learning Goals</p>
          {[
            { label: "Create 5 Courses", progress: Math.min(100, Math.round((stats.totalCourses / 5) * 100)), stat: `${stats.totalCourses}/5` },
            { label: "Earn 10K XP", progress: Math.min(100, Math.round((stats.totalXP / 10000) * 100)), stat: `${Math.min(100, Math.round((stats.totalXP / 10000) * 100))}%` },
          ].map((goal) => (
            <div key={goal.label} className="space-y-2.5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] font-bold">
                <span className="text-slate-600 dark:text-zinc-400">{goal.label}</span>
                <span className="rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-2 py-1 text-slate-900 dark:text-zinc-200 normal-case tracking-normal text-xs">
                  {goal.stat}
                </span>
              </div>
              <Progress value={goal.progress} className="h-1.5 bg-slate-200 dark:bg-white/10" />
            </div>
          ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderActivityFeed = () => (
    <section className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Activity Feed</h3>
        <button className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          See Detailed Log
        </button>
      </div>

      <Card className={`${floatingGlassCardClass} overflow-hidden`}>
        <CardContent className="p-0 divide-y divide-slate-200 dark:divide-white/10">
          <AnimatePresence mode="popLayout">
            {recentActivity.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 text-slate-600 dark:text-zinc-400 text-sm"
              >
                No recent activity yet.
              </motion.div>
            ) : (
              recentActivity.slice(0, 6).map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-6 flex items-center gap-4 hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all duration-300 hover:pl-8 cursor-default group"
                >
                  <div className="h-11 w-11 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 flex items-center justify-center text-violet-600 dark:text-violet-200 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{item.action}</p>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 truncate">{item.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-500 whitespace-nowrap">{item.dateLabel}</p>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </section>
  );

  const renderMyProgress = () => (
    <div>
      {renderHero()}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">{renderWeeklyClassesPanel()}</div>
        <div className="lg:col-span-4">{renderCalendarAndGoals()}</div>
      </div>
      {renderActivityFeed()}
    </div>
  );

  const renderLeaderboard = () => (
    <Card className={floatingGlassCardClass}>
      <CardHeader className="px-8 pt-8 pb-4">
        <CardTitle className="text-2xl text-slate-900 dark:text-white">Top Learners</CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8 space-y-3">
        {leaderboard.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4 text-slate-700 dark:text-zinc-300">Leaderboard data is not available yet.</div>
        )}
        {leaderboard.map((item, idx) => (
          <motion.div
            key={item.rank}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "rounded-2xl border p-4 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
              item.isYou 
                ? "bg-violet-100 dark:bg-violet-500/10 border-violet-300 dark:border-violet-400/30" 
                : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-black/40 border border-slate-300 dark:border-white/10 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-zinc-300">#{item.rank}</div>
              <p className="text-slate-900 dark:text-white font-semibold">{item.name}</p>
            </div>
            <p className="text-slate-700 dark:text-zinc-300 font-semibold">{(item.xp / 1000).toFixed(0)}K XP</p>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );

  const renderAchievements = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {computeAchievements(stats).map((achievement, idx) => (
        <motion.div
          key={achievement.title}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
        >
          <Card className={cn(floatingGlassCardClass, "rounded-2xl h-full", achievement.unlocked ? "border-violet-300 dark:border-violet-300/25" : "border-slate-200 dark:border-white/10")}>
            <CardContent className="p-5 text-center">
              <p className="text-3xl mb-2">{achievement.icon}</p>
              <p className="text-slate-900 dark:text-white font-semibold text-sm">{achievement.title}</p>
              <p className="text-slate-600 dark:text-zinc-400 text-xs mt-1">{achievement.desc}</p>
              <p className={`text-[11px] mt-2 font-bold ${achievement.unlocked ? "text-violet-700 dark:text-violet-200" : "text-slate-500 dark:text-zinc-500"}`}>
                {achievement.unlocked ? "Unlocked" : "Locked"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === "leaderboard") return renderLeaderboard();
    if (activeTab === "achievements") return renderAchievements();
    return renderMyProgress();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-[#0f0f0f] transition-colors duration-500">
        <div className="text-slate-900 dark:text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f0f0f] text-slate-900 dark:text-white overflow-x-hidden transition-colors duration-500">
      {/* Ambient Gradient Depth */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 h-screen w-screen bg-[radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.05),transparent_70%)]" />
        <div className="absolute -bottom-10 -left-10 h-screen w-screen bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.03),transparent_70%)]" />
      </div>

      <AppSidebar />

      <header className={cn("fixed top-0 left-0 right-0 z-[60] h-24 flex items-center justify-between px-6 md:px-12 pointer-events-none transition-all duration-300", isSidebarCollapsed ? "md:left-16" : "md:left-64")}>
        {/* Floating Glass Header */}
        <div className="flex-1 flex items-center justify-between h-16 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-2xl border border-white dark:border-white/10 rounded-full px-4 md:px-6 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white rounded-r-3xl">
                <SheetHeader>
                  <SheetTitle className="text-slate-900 dark:text-white">EduSync</SheetTitle>
                  <SheetDescription className="text-slate-600 dark:text-zinc-400">Navigate your workspace.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  {mobileNavItems.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      className="w-full justify-between text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
                      onClick={() => navigate(item.path)}
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Nav Switcher (Reference: Pill Tab Switcher) */}
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
            
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent hover:border-slate-200/50">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm border border-slate-200/50 dark:border-white/5">
                  <Bell className="h-5 w-5" />
                  {unreadNotificationCount > 0 && <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px] bg-white/95 dark:bg-zinc-950 border-slate-200 dark:border-white/10 rounded-2xl shadow-huge backdrop-blur-xl p-0 mt-4 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-white/5 rounded-t-2xl">
                  <DropdownMenuLabel className="p-0 text-sm font-bold uppercase tracking-widest opacity-60">Notifications</DropdownMenuLabel>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg text-xs text-primary font-bold hover:bg-primary/10"
                    onClick={() => markAllNotificationsRead()}
                  >
                    Mark all read
                  </Button>
                </div>
                <DropdownMenuSeparator className="m-0 bg-slate-200 dark:bg-white/10" />

                <ScrollArea className="h-[360px]">
                  <div className="p-2 space-y-1">
                    {notifications.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-sm italic">
                        No notifications right now.
                      </div>
                    )}

                    {notifications.map((notification) => {
                      const isRead = readNotificationIds.includes(notification.id);
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                              "flex flex-col gap-1 p-3 rounded-xl cursor-pointer transition-colors",
                              isRead ? "opacity-60 grayscale-[0.3]" : "bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200/50 dark:hover:bg-white/10"
                          )}
                          onClick={() => {
                            markNotificationRead(notification.id);
                            if (notification.route) navigate(notification.route);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-1">{notification.title}</p>
                            {!isRead && <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">{notification.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0.5 hover:scale-105 transition-transform rounded-full">
                  <Avatar className="h-11 w-11 border-2 border-white dark:border-slate-800 shadow-lg">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={profileName} />}
                    <AvatarFallback className="bg-slate-100 dark:bg-primary/10 text-primary text-[10px] font-black uppercase">
                      {profileName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-zinc-950 border-slate-200 dark:border-white/10 rounded-2xl p-2 mt-4 shadow-huge">
                <DropdownMenuLabel className="px-3 py-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{profileName}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Learner Profile</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
                <DropdownMenuItem className="rounded-xl py-3 px-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => navigate("/ai-course-creator")}>Create New Course</DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl py-3 px-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => navigate("/settings")}>Account Settings</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className={cn("relative z-10 pt-28 pb-24 px-6 transition-all duration-300 md:px-12", isSidebarCollapsed ? "md:ml-16" : "md:ml-64")}>
        {renderStats()}
        {renderTabContent()}
      </main>

      <Button
        onClick={() => navigate("/ai-course-creator")}
        className="fixed bottom-8 right-8 z-30 rounded-full h-14 px-5 bg-violet-500/25 border border-violet-300/30 text-white backdrop-blur-xl hover:bg-violet-500/35 shadow-[0_15px_35px_rgba(139,92,246,0.4)]"
      >
        <Zap className="h-5 w-5 mr-2" />
        Boost Focus
      </Button>
    </div>
  );
};

export default Dashboard;
