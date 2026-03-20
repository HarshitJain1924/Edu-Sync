import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Video, Calendar, Users, Play, Clock, Gamepad2, Brain, Sparkles, ArrowRight, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";

// Stable Picsum fallback URL
const getPicsumUrl = (topic: string, title: string) => {
  const seed = `${topic}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  return `https://picsum.photos/seed/${seed}/800/400`;
};

// Get topic-based emoji icon
const getTopicIcon = (topic: string): string => {
  const t = (topic || '').toLowerCase();
  if (t.includes('react') || t.includes('frontend') || t.includes('vue') || t.includes('angular')) return '⚛️';
  if (t.includes('node') || t.includes('backend') || t.includes('server') || t.includes('express')) return '🖥️';
  if (t.includes('python') || t.includes('django') || t.includes('flask')) return '🐍';
  if (t.includes('data') || t.includes('analytics') || t.includes('statistics')) return '📊';
  if (t.includes('ai') || t.includes('machine') || t.includes('deep') || t.includes('neural')) return '🤖';
  if (t.includes('web') || t.includes('html') || t.includes('css') || t.includes('javascript')) return '🌐';
  if (t.includes('mobile') || t.includes('ios') || t.includes('android') || t.includes('flutter')) return '📱';
  if (t.includes('design') || t.includes('ui') || t.includes('ux') || t.includes('figma')) return '🎨';
  if (t.includes('security') || t.includes('cyber') || t.includes('hack')) return '🔐';
  if (t.includes('cloud') || t.includes('aws') || t.includes('devops') || t.includes('docker')) return '☁️';
  if (t.includes('database') || t.includes('sql') || t.includes('mongo')) return '🗄️';
  if (t.includes('math') || t.includes('algorithm') || t.includes('dsa')) return '🧮';
  if (t.includes('market') || t.includes('seo') || t.includes('business')) return '📈';
  if (t.includes('game') || t.includes('unity') || t.includes('unreal')) return '🎮';
  if (t.includes('blockchain') || t.includes('crypto') || t.includes('web3')) return '⛓️';
  return '📘';
};

// In-memory cache so each topic only calls Unsplash once per session
const unsplashCache: Record<string, string> = {};

// --- Reusable thumbnail component (Unsplash search API → Picsum fallback) ---
interface CourseThumbnailProps {
  title: string;
  topic: string;
  existingUrl?: string;
  height?: string;
  gradientFrom?: string;
  gradientTo?: string;
  children?: React.ReactNode;
}

const CourseThumbnail = ({ title, topic, existingUrl, height = "h-36", gradientFrom = "from-purple-500/20", gradientTo = "to-blue-500/20", children }: CourseThumbnailProps) => {
  const [imgSrc, setImgSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      // Check cache first
      const cacheKey = topic.toLowerCase().trim();
      if (unsplashCache[cacheKey]) {
        if (!cancelled) setImgSrc(unsplashCache[cacheKey]);
        return;
      }

      // Try Unsplash search API
      const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
      if (accessKey) {
        try {
          const query = encodeURIComponent(topic);
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&client_id=${accessKey}`,
            { headers: { "Accept-Version": "v1" } }
          );
          if (res.ok) {
            const data = await res.json();
            const url = data.results?.[0]?.urls?.regular;
            if (url) {
              unsplashCache[cacheKey] = url;
              if (!cancelled) setImgSrc(url);
              return;
            }
          }
        } catch { /* fall through to Picsum */ }
      }

      // Fallback to Picsum
      const picsumUrl = getPicsumUrl(topic, title);
      unsplashCache[cacheKey] = picsumUrl;
      if (!cancelled) setImgSrc(picsumUrl);
    };

    loadImage();
    return () => { cancelled = true; };
  }, [topic, title]);

  return (
    <div className={`w-full ${height} bg-gradient-to-br ${gradientFrom} ${gradientTo} relative overflow-hidden rounded-t-lg`}>
      {!failed && imgSrc && (
        <img
          src={imgSrc}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={() => {
            // If Unsplash image fails to render, try Picsum
            const fallback = getPicsumUrl(topic, title);
            if (imgSrc !== fallback) {
              setImgSrc(fallback);
            } else {
              setFailed(true);
            }
          }}
        />
      )}
      {/* Dark gradient overlay for text contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)' }}
      />
      {/* Topic emoji icon */}
      <div className="absolute top-3 left-3 text-3xl drop-shadow-lg select-none z-10">
        {getTopicIcon(topic)}
      </div>
      {/* Extra overlays (progress bar, status badge, etc.) */}
      {children}
    </div>
  );
};

interface ContinueLearningCourse {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  duration: string;
  modules: any;
  thumbnail_url?: string;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
}

const Dashboard = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const [videoStats, setVideoStats] = useState({
    videosWatched: 0,
    totalWatchTime: 0,
    streak: 0
  });
  const [userName, setUserName] = useState<string>("...");
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    completedClasses: 0,
    studyGroups: 0,
  });
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    checkRoleAndRedirect();
  }, []);

  const checkRoleAndRedirect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData?.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      } else if (roleData?.role === "teacher") {
        navigate("/teacher", { replace: true });
        return;
      }

      // If student or no role, stay on dashboard
      setIsCheckingRole(false);
      fetchUserAndStats();
      fetchUpcomingSessions();
      fetchDashboardHighlights();
    } catch (error) {
      console.error("Error checking role:", error);
      setIsCheckingRole(false);
      fetchUserAndStats();
      fetchUpcomingSessions();
      fetchDashboardHighlights();
    }
  };

  useEffect(() => {
    if (!isCheckingRole) {
      fetchUserAndStats();
      fetchUpcomingSessions();
      fetchCommunityCourses();
      fetchRecommendations();
      fetchContinueLearning();
      fetchTrendingCourses();
      fetchDashboardHighlights();
    }
  }, [isCheckingRole]);

  const fetchDashboardHighlights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let completedClasses = 0;
      try {
        const { data: completedRows } = await (supabase as any)
          .from('course_progress')
          .select('course_id')
          .eq('user_id', user.id)
          .eq('completed', true);

        completedClasses = new Set((completedRows || []).map((row: any) => row.course_id)).size;
      } catch {
        completedClasses = 0;
      }

      let studyGroups = 0;
      try {
        const { data: participantRows } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', user.id);

        studyGroups = new Set((participantRows || []).map((row: any) => row.room_id)).size;
      } catch {
        studyGroups = 0;
      }

      setDashboardStats({ completedClasses, studyGroups });
    } catch (error) {
      console.error('Failed to fetch dashboard highlights:', error);
    }
  };

  const fetchUserAndStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Prefer profile username; fall back to email local-part.
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      const derivedName = profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Learner';
      setUserName(derivedName);

      const { data: progress } = await supabase
        .from('video_progress')
        .select('progress_seconds, completed, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (progress) {
        const completed = progress.filter(p => p.completed).length;
        const totalSeconds = progress.reduce((sum, p) => sum + p.progress_seconds, 0);

        // Calculate streak: consecutive days with video activity
        let streak = 0;
        if (progress.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const uniqueDays = new Set<string>();
          progress.forEach(p => {
            if (p.updated_at) {
              const date = new Date(p.updated_at);
              date.setHours(0, 0, 0, 0);
              uniqueDays.add(date.toISOString().split('T')[0]);
            }
          });

          const sortedDays = Array.from(uniqueDays).sort().reverse();
          
          // Check if today or yesterday has activity
          const todayStr = today.toISOString().split('T')[0];
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          if (sortedDays.includes(todayStr) || sortedDays.includes(yesterdayStr)) {
            streak = 1;
            let currentDate = new Date(sortedDays[0]);
            
            for (let i = 1; i < sortedDays.length; i++) {
              const prevDate = new Date(sortedDays[i]);
              const dayDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (dayDiff === 1) {
                streak++;
                currentDate = prevDate;
              } else {
                break;
              }
            }
          }
        }

        setVideoStats({
          videosWatched: completed,
          totalWatchTime: totalSeconds,
          streak
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };



  // Fetch courses the student has started (has progress entries)
  const fetchContinueLearning = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: progressData, error: progressError } = await (supabase as any)
        .from('course_progress')
        .select('course_id, lesson_id, completed')
        .eq('user_id', user.id);

      if (progressError || !progressData || progressData.length === 0) return;

      // Group progress by course_id
      const courseProgressMap: Record<string, { completed: number; total: number }> = {};
      progressData.forEach((p: any) => {
        if (!courseProgressMap[p.course_id]) courseProgressMap[p.course_id] = { completed: 0, total: 0 };
        courseProgressMap[p.course_id].total++;
        if (p.completed) courseProgressMap[p.course_id].completed++;
      });

      const courseIds = Object.keys(courseProgressMap);
      // Fetch course details
      const { data: coursesData } = await supabase
        .from('ai_generated_courses')
        .select('id, title, topic, difficulty, duration, modules, thumbnail_url')
        .in('id', courseIds);

      if (!coursesData) {
        // Fallback without thumbnail_url
        const { data: fallback } = await supabase
          .from('ai_generated_courses')
          .select('id, title, topic, difficulty, duration, modules')
          .in('id', courseIds);
        if (!fallback) return;
        const results: ContinueLearningCourse[] = fallback.map((c: any) => {
          const totalLessons = (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0);
          const cp = courseProgressMap[c.id];
          const completedLessons = cp?.completed || 0;
          return {
            ...c,
            completedLessons,
            totalLessons: Math.max(totalLessons, cp?.total || 0),
            progressPercent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)
          };
        }).filter((c: ContinueLearningCourse) => c.progressPercent < 100);
        setContinueLearning(results);
        return;
      }

      const results: ContinueLearningCourse[] = coursesData.map((c: any) => {
        const totalLessons = (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0);
        const cp = courseProgressMap[c.id];
        const completedLessons = cp?.completed || 0;
        return {
          ...c,
          completedLessons,
          totalLessons: Math.max(totalLessons, cp?.total || 0),
          progressPercent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100)
        };
      }).filter((c: ContinueLearningCourse) => c.progressPercent < 100);

      setContinueLearning(results);
    } catch (err) {
      // course_progress table may not exist yet
    }
  };


  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const fetchUpcomingSessions = async () => {
    try {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Fetch upcoming study sessions for the next 7 days.
      const { data: sessions, error } = await supabase
        .from('study_sessions')
        .select(`
          id,
          title,
          start_time,
          teacher_id,
          room_id,
          status
        `)
        .eq('status', 'scheduled')
        .gte('start_time', now.toISOString())
        .lt('start_time', weekEnd.toISOString())
        .order('start_time', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      const teacherIds = Array.from(new Set((sessions || []).map((s: any) => s.teacher_id).filter(Boolean)));
      const roomIds = Array.from(new Set((sessions || []).map((s: any) => s.room_id).filter(Boolean)));

      let teacherNameMap = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', teacherIds);
        teacherNameMap = new Map((teachers || []).map((t: any) => [t.id, t.username || 'Teacher']));
      }

      let roomNameMap = new Map<string, string>();
      if (roomIds.length > 0) {
        const { data: roomRows } = await supabase
          .from('study_rooms')
          .select('id, name')
          .in('id', roomIds);
        roomNameMap = new Map((roomRows || []).map((r: any) => [r.id, r.name || 'Study Room']));
      }

      const normalized = (sessions || []).map((session: any) => ({
        ...session,
        scheduled_time: session.start_time,
        study_room_id: session.room_id,
        profiles: { username: teacherNameMap.get(session.teacher_id) || 'Teacher' },
        study_rooms: { name: roomNameMap.get(session.room_id) || 'Study Room' },
      }));

      setUpcomingSessions(normalized);
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
    }
  };

  const formatSessionTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (isToday) return `Today, ${time}`;
    if (isTomorrow) return `Tomorrow, ${time}`;
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayName}, ${time}`;
  };

  const formatDayKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getWeeklyColumns = () => {
    const columns: Array<{ label: string; shortLabel: string; dateKey: string }> = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      columns.push({
        label: d.toLocaleDateString('en-US', { weekday: 'long' }),
        shortLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateKey: formatDayKey(d),
      });
    }

    return columns;
  };

  const formatCardTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Completed Classes", value: String(dashboardStats.completedClasses), icon: BookOpen, color: "from-primary to-primary/70" },
    { label: "Active Sessions", value: String(upcomingSessions.length), icon: Video, color: "from-secondary to-accent" },
    { label: "Study Hours", value: String(Math.round(videoStats.totalWatchTime / 3600)), icon: TrendingUp, color: "from-accent to-secondary" },
    { label: "Study Groups", value: String(dashboardStats.studyGroups), icon: Users, color: "from-primary to-accent" },
  ];

  const weeklyColumns = getWeeklyColumns();
  const sessionsByDay = weeklyColumns.map((day) => {
    const items = upcomingSessions.filter((session) => {
      const d = new Date(session.scheduled_time || session.start_time);
      return formatDayKey(d) === day.dateKey;
    });

    return { ...day, items };
  });
  const hasWeeklySessions = sessionsByDay.some((d) => d.items.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar />

      {/* Main Content */}
      <main className="ml-64 p-8">
        <header className="mb-8 relative z-10">
          <h1 className="text-4xl font-extrabold mb-2 text-white">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">{userName}! 👋</span>
          </h1>
          <p className="text-gray-400 text-lg">Track your learning progress and access your study materials</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="glass-card rounded-xl p-6 relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="relative z-10">
                 <div className="flex items-center justify-between mb-4">
                   <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} shadow-lg`}>
                     <stat.icon className="h-6 w-6 text-white" />
                   </div>
                   <div className="text-3xl font-bold text-white group-hover:scale-110 transition-transform duration-300">{stat.value}</div>
                 </div>
                 <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
               </div>
            </div>
          ))}
        </div>

        {/* Video Learning Stats */}
        <div className="glass-panel rounded-xl mb-8 border border-white/5">
          <div className="p-6 border-b border-white/5">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Video className="h-5 w-5 text-primary" />
              🎥 Video Learning Progress
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="text-4xl font-bold text-primary mb-2 text-glow">
                  {videoStats.videosWatched}
                </div>
                <div className="text-sm text-gray-400 flex items-center justify-center gap-2 font-medium">
                  <Play className="h-4 w-4" />
                  Videos Watched
                </div>
              </div>
              <div className="text-center p-6 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="text-4xl font-bold text-primary mb-2 text-glow">
                  {formatWatchTime(videoStats.totalWatchTime)}
                </div>
                <div className="text-sm text-gray-400 flex items-center justify-center gap-2 font-medium">
                  <Clock className="h-4 w-4" />
                  Time Spent Learning
                </div>
              </div>
              <div className="text-center p-6 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                <div className="text-4xl font-bold text-orange-500 mb-2 text-glow">
                  {videoStats.streak} days 🔥
                </div>
                <div className="text-sm text-gray-400 flex items-center justify-center gap-2 font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Active Streak
                </div>
              </div>
            </div>
            <Button 
              className="w-full mt-6 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 h-12 text-lg font-medium" 
              onClick={() => navigate('/videos')}
            >
              <Video className="mr-2 h-5 w-5" />
              Browse Video Library
            </Button>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="glass-panel rounded-xl border border-white/5">
           <div className="p-6 border-b border-white/5">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Calendar className="h-5 w-5 text-secondary" />
              Weekly Class Board
            </h2>
            <p className="text-sm text-gray-400 mt-1">Kanban view of all scheduled classes for the next 7 days</p>
          </div>
          <div className="p-6">
            {!hasWeeklySessions ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No classes scheduled for this week</p>
                <p className="text-sm mt-1">Teacher and admin scheduled classes will appear here automatically</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="grid gap-4 min-w-[920px]" style={{ gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))' }}>
                  {sessionsByDay.map((day) => (
                    <div key={day.dateKey} className="rounded-xl border border-white/10 bg-white/[0.03] min-h-[280px]">
                      <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] rounded-t-xl">
                        <p className="text-sm font-semibold text-white">{day.label}</p>
                        <p className="text-xs text-gray-400">{day.shortLabel}</p>
                        <p className="text-[11px] mt-1 text-primary">{day.items.length} class{day.items.length === 1 ? '' : 'es'}</p>
                      </div>

                      <div className="p-3 space-y-3">
                        {day.items.length === 0 ? (
                          <div className="text-xs text-gray-500 border border-dashed border-white/10 rounded-lg p-3 text-center">
                            No class
                          </div>
                        ) : (
                          day.items.map((session: any) => (
                            <div key={session.id} className="rounded-lg border border-white/10 bg-[#1b2233] p-3 hover:border-primary/40 transition-colors">
                              <p className="text-sm font-semibold text-white line-clamp-2">{session.title}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatCardTime(session.scheduled_time || session.start_time)}</p>
                              <p className="text-xs text-gray-400 mt-1">Teacher: <span className="text-gray-200">{session.profiles?.username || 'Teacher'}</span></p>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{session.study_rooms?.name || 'Study Room'}</p>

                              {session.study_room_id ? (
                                <Button
                                  size="sm"
                                  onClick={() => navigate(`/study-room/${session.study_room_id}`)}
                                  className="w-full mt-3 bg-green-500 hover:bg-green-600 text-white"
                                >
                                  Join
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  className="w-full mt-3 opacity-50"
                                >
                                  Room Not Ready
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Continue Learning Section */}
        {continueLearning.length > 0 && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Play className="h-6 w-6 text-emerald-400" />
                Continue Learning
              </h2>
              <p className="text-gray-400 mt-1">Pick up where you left off</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {continueLearning.map((course) => (
                <Card
                  key={course.id}
                  className="bg-white/5 border-white/10 hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer overflow-hidden hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  onClick={() => navigate('/course-view', { state: course })}
                >
                  <CourseThumbnail title={course.title} topic={course.topic} existingUrl={course.thumbnail_url} gradientFrom="from-emerald-500/10" gradientTo="to-cyan-500/10">
                    {/* Progress overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-gray-300">{course.completedLessons}/{course.totalLessons} lessons</span>
                        <span className="text-emerald-400 font-bold">{course.progressPercent}%</span>
                      </div>
                      <Progress value={course.progressPercent} className="h-1.5 [&>div]:bg-emerald-500 bg-white/10" />
                    </div>
                  </CourseThumbnail>
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{course.topic}</span>
                      <span className="text-xs text-gray-500">{course.difficulty}</span>
                    </div>
                    <CardTitle className="text-base text-white group-hover:text-emerald-400 transition-colors leading-tight">
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-4">
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
                      onClick={(e) => { e.stopPropagation(); navigate('/course-view', { state: course }); }}
                    >
                      Resume Course <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button 
              className="h-32 text-lg flex flex-col items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 group"
              onClick={() => navigate("/study-rooms")}
            >
              <div className="p-3 rounded-full bg-white/10 group-hover:bg-primary group-hover:text-white transition-colors">
                 <Users className="h-6 w-6" />
              </div>
              <span className="font-semibold text-gray-300 group-hover:text-white">Join Study Room</span>
            </Button>
            <Button 
              className="h-32 text-lg flex flex-col items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all duration-300 group"
              onClick={() => navigate("/flashcards")}
            >
              <div className="p-3 rounded-full bg-white/10 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                 <BookOpen className="h-6 w-6" />
              </div>
              <span className="font-semibold text-gray-300 group-hover:text-white">Practice Flashcards</span>
            </Button>
            <Button 
              className="h-32 text-lg flex flex-col items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all duration-300 group"
              onClick={() => navigate("/quiz")}
            >
              <div className="p-3 rounded-full bg-white/10 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                 <Brain className="h-6 w-6" />
              </div>
              <span className="font-semibold text-gray-300 group-hover:text-white">Take a Quiz</span>
            </Button>
            <Button 
              className="h-32 text-lg flex flex-col items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 group"
              onClick={() => navigate("/ai-course-creator")}
            >
              <div className="p-3 rounded-full bg-white/10 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                 <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 group-hover:text-gray-200">Open</span>
                <span className="text-sm font-bold text-white">Learn A Skill</span>
              </div>
            </Button>
          </div>
        </div>






      </main>
    </div>
  );
};

export default Dashboard;
