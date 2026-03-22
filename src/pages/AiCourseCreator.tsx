import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  BrainCircuit,
  Flame,
  Globe,
  Lightbulb,
  TrendingUp,
  Clock,
  BookOpen,
  ChevronRight,
  Search,
  Command,
  Bell,
  UserCircle2,
  Bookmark,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { generateCourseWithAI, AICourseDetails } from "@/lib/ai-service";
import AiCourseReview from "@/components/courses/AiCourseReview";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAIRecommendations, CourseRecommendation } from "@/lib/ai-recommendations";
import AppSidebar from "@/components/AppSidebar";

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const DURATIONS = ["1 Hour (Crash Course)", "3 Hours (Deep Dive)", "1 Week (Masterclass)"];

const getPicsumUrl = (topic: string, title: string) => {
  const seed = `${topic}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  return `https://picsum.photos/seed/${seed}/1200/700`;
};

const getTopicIcon = (topic: string): string => {
  const t = (topic || "").toLowerCase();
  if (t.includes("react") || t.includes("frontend") || t.includes("vue") || t.includes("angular")) return "⚛️";
  if (t.includes("node") || t.includes("backend") || t.includes("server") || t.includes("express")) return "🖥️";
  if (t.includes("python")) return "🐍";
  if (t.includes("ai") || t.includes("machine")) return "🤖";
  if (t.includes("data") || t.includes("analytics")) return "📊";
  if (t.includes("design") || t.includes("ui") || t.includes("ux")) return "🎨";
  return "📘";
};

const unsplashCache: Record<string, string> = {};

interface CourseThumbnailProps {
  title: string;
  topic: string;
  existingUrl?: string;
  height?: string;
  gradientFrom?: string;
  gradientTo?: string;
  children?: React.ReactNode;
}

interface HubCourse {
  id: string;
  title: string;
  created_by?: string;
  creator_name?: string;
  topic?: string;
  difficulty?: string;
  duration?: string;
  status?: string;
  thumbnail_url?: string;
  modules?: unknown[];
  created_at?: string;
}

type AppRole = "student" | "teacher" | "admin";

const formatDurationBadge = (duration?: string) => {
  if (!duration) return "N/A";
  const d = duration.toLowerCase();
  if (d.includes("1 hour")) return "1h";
  if (d.includes("3 hour")) return "3h";
  if (d.includes("week")) return "1w";
  return duration;
};

const CourseThumbnail = ({
  title,
  topic,
  existingUrl,
  height = "h-40",
  gradientFrom = "from-purple-500/20",
  gradientTo = "to-cyan-500/20",
  children,
}: CourseThumbnailProps) => {
  const [imgSrc, setImgSrc] = useState(existingUrl || "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      if (existingUrl) {
        if (!cancelled) setImgSrc(existingUrl);
        return;
      }

      const cacheKey = topic.toLowerCase().trim();
      if (unsplashCache[cacheKey]) {
        if (!cancelled) setImgSrc(unsplashCache[cacheKey]);
        return;
      }

      const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
      if (accessKey) {
        try {
          const query = encodeURIComponent(topic || title);
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
        } catch {
          // fall through to picsum
        }
      }

      const fallback = getPicsumUrl(topic, title);
      unsplashCache[cacheKey] = fallback;
      if (!cancelled) setImgSrc(fallback);
    };

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [existingUrl, topic, title]);

  return (
    <div className={`w-full ${height} bg-gradient-to-br ${gradientFrom} ${gradientTo} relative overflow-hidden rounded-t-2xl`}>
      {!failed && imgSrc && (
        <img
          src={imgSrc}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          loading="lazy"
          onError={() => {
            const fallback = getPicsumUrl(topic, title);
            if (imgSrc !== fallback) {
              setImgSrc(fallback);
            } else {
              setFailed(true);
            }
          }}
        />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.85) 100%)" }}
      />
      <div className="absolute top-3 left-3 text-2xl drop-shadow-lg select-none z-10">{getTopicIcon(topic)}</div>
      {children}
    </div>
  );
};

const CourseCard = ({
  course,
  onOpen,
  onDelete,
  canDelete = false,
  accent = "primary",
}: {
  course: HubCourse;
  onOpen: () => void;
  onDelete?: (course: HubCourse) => void;
  canDelete?: boolean;
  accent?: "primary" | "orange" | "purple";
}) => {
  const accentClass =
    accent === "orange"
      ? "group-hover:border-orange-400/50 group-hover:shadow-[0_20px_70px_rgba(251,146,60,0.16)]"
      : accent === "purple"
      ? "group-hover:border-purple-400/50 group-hover:shadow-[0_20px_70px_rgba(168,85,247,0.18)]"
      : "group-hover:border-cyan-400/50 group-hover:shadow-[0_20px_70px_rgba(34,211,238,0.16)]";

  const creator = course.creator_name || "Student";
  const creatorInitial = creator.charAt(0).toUpperCase();

  return (
    <motion.div whileHover={{ y: -5, scale: 1.02, rotateX: 1.2 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <Card
        onClick={onOpen}
        className={`group h-full rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden cursor-pointer flex flex-col ${accentClass}`}
      >
        <CourseThumbnail title={course.title} topic={course.topic} existingUrl={course.thumbnail_url}>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              type="button"
              className="h-7 w-7 rounded-full bg-black/35 backdrop-blur-sm border border-white/20 flex items-center justify-center text-gray-200 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
            {canDelete && onDelete && (
              <button
                type="button"
                className="h-7 px-2 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-red-100 hover:bg-red-500/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(course);
                }}
              >
                Delete
              </button>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 text-white">
              {course.status || "community"}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-full rounded-xl bg-black/45 backdrop-blur-md border border-white/15 px-3 py-2 text-sm text-white flex items-center justify-between">
              Start Learning
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </CourseThumbnail>

        <CardContent className="p-4 flex-1 flex flex-col">
          <p className="text-lg font-semibold text-white line-clamp-2 min-h-[3.5rem]">{course.title}</p>

          <div className="mt-3 flex items-center gap-2 flex-wrap min-h-[2.2rem]">
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-cyan-200">{course.topic || "General"}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-gray-200">{course.difficulty || "N/A"}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-gray-200">{formatDurationBadge(course.duration)}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-gray-200">{Array.isArray(course.modules) ? course.modules.length : 0} modules</span>
          </div>

          <div className="mt-auto pt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-cyan-400/40 to-indigo-500/40 border border-white/20 flex items-center justify-center text-[11px] font-bold text-white">
                {creatorInitial}
              </div>
              <span className="text-xs text-slate-700 dark:text-gray-300">{creator}</span>
            </div>
            <button
              type="button"
              className="text-sm text-cyan-300 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              Start Learning →
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function AiCourseCreator() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [duration, setDuration] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [language, setLanguage] = useState("English");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("Initializing AI Engine...");
  const [generatedCourse, setGeneratedCourse] = useState<AICourseDetails | null>(null);
  const [communityCourses, setCommunityCourses] = useState<HubCourse[]>([]);
  const [trendingCourses, setTrendingCourses] = useState<HubCourse[]>([]);
  const [myCourses, setMyCourses] = useState<HubCourse[]>([]);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [loadingHub, setLoadingHub] = useState(true);
  const [activeFeed, setActiveFeed] = useState<"trending" | "community" | "mine">("trending");
  const [role, setRole] = useState<AppRole>("student");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const formAnchorRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const stepWithDots = useMemo(() => {
    if (!isGenerating) return generationStep;
    const dots = [".", "..", "..."];
    return `${generationStep}${dots[Math.floor((Date.now() / 400) % dots.length)]}`;
  }, [generationStep, isGenerating]);

  const attachCreatorNames = useCallback(async (courses: HubCourse[]) => {
    const creatorIds = Array.from(new Set((courses || []).map((course) => course.created_by).filter(Boolean) as string[]));
    if (creatorIds.length === 0) return courses;

    const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", creatorIds);

    const map = new Map((profiles || []).map((profile) => [profile.id, profile.username || "Student"]));
    return courses.map((course) => ({
      ...course,
      creator_name: map.get(course.created_by) || "Student",
    }));
  }, []);

  const fetchCommunityCourses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ai_generated_courses")
        .select(
          `
          id,
          title,
          created_by,
          topic,
          difficulty,
          duration,
          status,
          thumbnail_url,
          modules
        `
        )
        .in("status", ["community", "official"])
        .order("created_at", { ascending: false })
        .limit(9);

      if (error) throw error;
      const withCreators = await attachCreatorNames((data || []) as HubCourse[]);
      setCommunityCourses(withCreators);
    } catch (err) {
      console.error("Failed to fetch community courses:", err);
      setCommunityCourses([]);
    }
  }, [attachCreatorNames]);

  const fetchTrendingCourses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ai_generated_courses")
        .select(
          `
          id,
          title,
          created_by,
          topic,
          difficulty,
          duration,
          thumbnail_url,
          modules,
          created_at
        `
        )
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      const withCreators = await attachCreatorNames((data || []) as HubCourse[]);
      setTrendingCourses(withCreators);
    } catch (err) {
      console.error("Failed to fetch trending courses:", err);
      setTrendingCourses([]);
    }
  }, [attachCreatorNames]);

  const fetchMyCourses = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("ai_generated_courses")
        .select("id, title, created_by, topic, difficulty, duration, status, thumbnail_url, modules")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(9);

      if (error) throw error;
      setMyCourses((data || []) as HubCourse[]);
    } catch (err) {
      console.error("Failed to fetch my courses:", err);
      setMyCourses([]);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const recs = await getAIRecommendations([]);
      setRecommendations(recs);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setRecommendations([]);
    }
  }, []);

  useEffect(() => {
    const loadHub = async () => {
      setLoadingHub(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roleData?.role === "student" || roleData?.role === "teacher" || roleData?.role === "admin") {
          setRole(roleData.role);
        }
      }

      await Promise.all([fetchCommunityCourses(), fetchTrendingCourses(), fetchMyCourses(), fetchRecommendations()]);
      setLoadingHub(false);
    };

    loadHub();
  }, [fetchCommunityCourses, fetchTrendingCourses, fetchMyCourses, fetchRecommendations]);

  const handleDeleteCourse = async (course: HubCourse) => {
    const isOwner = Boolean(currentUserId && course.created_by === currentUserId);
    const canDelete = isOwner || role === "admin";
    if (!canDelete) {
      toast.error("You do not have permission to delete this course.");
      return;
    }

    const confirmDelete = window.confirm(`Delete course "${course.title}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      let query = supabase.from("ai_generated_courses").delete().eq("id", course.id);
      if (role !== "admin" && currentUserId) {
        query = query.eq("created_by", currentUserId);
      }

      const { error } = await query;
      if (error) throw error;

      toast.success("Course deleted successfully.");
      await Promise.all([fetchMyCourses(), fetchTrendingCourses(), fetchCommunityCourses()]);
    } catch (error) {
      console.error("Failed to delete course:", error);
      toast.error("Failed to delete course.");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !difficulty || !duration || !learningGoal) {
      toast.error("Please fill in all fields to generate the best course.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep("Analyzing topic and parameters");

    try {
      const course = await generateCourseWithAI(
        topic,
        difficulty,
        duration,
        learningGoal,
        (step) => setGenerationStep(step.replace(/\.\.\.$/, "")),
        language
      );
      setGeneratedCourse(course);
      toast.success("AI Course generated successfully!");
      await Promise.all([fetchMyCourses(), fetchTrendingCourses(), fetchCommunityCourses()]);
    } catch {
      toast.error("Failed to generate course. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("Initializing AI Engine");
    }
  };

  if (generatedCourse) {
    return <AiCourseReview course={generatedCourse} onBack={() => setGeneratedCourse(null)} />;
  }

  const feedMeta = {
    trending: {
      title: "Trending",
      subtitle: "Most active courses this week",
      icon: Flame,
      accent: "orange" as const,
      data: trendingCourses,
      emptyTitle: "No trending courses yet.",
      emptyDesc: "Generate a course and kickstart the feed.",
    },
    community: {
      title: "Community",
      subtitle: "Courses created by learners like you",
      icon: Globe,
      accent: "purple" as const,
      data: communityCourses,
      emptyTitle: "Community is quiet right now.",
      emptyDesc: "Be the first to publish something amazing.",
    },
    mine: {
      title: "Your Courses",
      subtitle: "All courses you generated with AI",
      icon: Sparkles,
      accent: "primary" as const,
      data: myCourses,
      emptyTitle: "You have not generated any courses yet.",
      emptyDesc: "Create your first course from the panel on the left.",
    },
  };

  const currentFeed = feedMeta[activeFeed];
  const CurrentFeedIcon = currentFeed.icon;

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <AppSidebar />
      <div className="absolute -top-40 -left-20 w-[28rem] h-[28rem] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-[30rem] h-[30rem] rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[28rem] h-[28rem] rounded-full bg-purple-500/20 blur-[120px] pointer-events-none" />

      <main className="ml-64 px-5 md:px-8 py-8 relative z-10">
        <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-7">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-indigo-300 bg-clip-text text-transparent">Learn A Skill</h1>
          <p className="text-muted-foreground mt-1">Build AI-powered courses and browse what the community is learning.</p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-[390px_1fr] gap-6 lg:gap-8 items-start">
          <motion.aside
            ref={formAnchorRef}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:sticky lg:top-6"
          >
            <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_24px_80px_rgba(9,17,39,0.55)] overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                  </div>
                  <CardTitle className="text-xl">AI Course Copilot</CardTitle>
                </div>
                <CardDescription className="text-slate-600 dark:text-gray-400">Describe your goal and generate a personalized learning path in seconds.</CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleGenerate} className="space-y-5">
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder="What do you want to learn today?"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="h-12 rounded-2xl bg-black/35 border-white/10 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:border-cyan-400/50 focus-visible:shadow-[0_0_0_3px_rgba(34,211,238,0.14)] transition-all duration-300 ease-out"
                        disabled={isGenerating}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-cyan-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
                        AI
                      </div>
                    </div>

                    <Textarea
                      placeholder="I want to achieve this specific outcome..."
                      value={learningGoal}
                      onChange={(e) => setLearningGoal(e.target.value)}
                      className="min-h-[110px] rounded-2xl bg-black/35 border-white/10 text-white placeholder:text-gray-500 resize-none focus-visible:ring-0 focus-visible:border-cyan-400/50 focus-visible:shadow-[0_0_0_3px_rgba(34,211,238,0.14)] transition-all duration-300 ease-out"
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400">Difficulty</p>
                    <div className="flex flex-wrap gap-2">
                      {DIFFICULTIES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setDifficulty(item)}
                          disabled={isGenerating}
                          className={`px-3.5 py-2 rounded-full text-sm border transition-all duration-300 ease-out ${
                            difficulty === item
                              ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-100"
                              : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400">Duration</p>
                    <div className="flex flex-wrap gap-2">
                      {DURATIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setDuration(item)}
                          disabled={isGenerating}
                          className={`px-3.5 py-2 rounded-full text-sm border transition-all duration-300 ease-out ${
                            duration === item
                              ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-100"
                              : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          }`}
                        >
                          {item.includes("1 Hour") ? "1h" : item.includes("3 Hours") ? "3h" : "1 week"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-gray-400">Language</p>
                    <Select value={language} onValueChange={setLanguage} disabled={isGenerating}>
                      <SelectTrigger className="h-11 rounded-2xl bg-black/35 border-white/10 text-white focus:ring-0 focus:ring-offset-0 focus:border-cyan-400/50">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                        <SelectItem value="German">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isGenerating ? (
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4 relative overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.7s_infinite]" />
                      <div className="relative z-10 flex items-center gap-2 text-cyan-200">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{stepWithDots}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="h-2 rounded-full bg-white/10 animate-pulse" />
                        <div className="h-2 rounded-full bg-white/10 animate-pulse" />
                        <div className="h-2 rounded-full bg-white/10 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-500 via-cyan-500 to-purple-500 hover:brightness-110 border border-white/20 text-white font-medium shadow-[0_12px_35px_rgba(56,189,248,0.3)] transition-all duration-300 ease-out group"
                    >
                      <Sparkles className="mr-2 h-4 w-4 group-hover:rotate-12 transition-transform duration-300" />
                      Generate With AI
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border-cyan-400/25 backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-cyan-100/80">Your Courses</p>
                  <p className="text-3xl font-bold mt-1">{myCourses.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-400/25 backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-purple-100/80">Community</p>
                  <p className="text-3xl font-bold mt-1">{communityCourses.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border-orange-400/25 backdrop-blur-xl">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-orange-100/80">Trending</p>
                  <p className="text-3xl font-bold mt-1">{trendingCourses.length}</p>
                </CardContent>
              </Card>
            </div>

            {loadingHub && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Card key={idx} className="rounded-2xl bg-white/5 border-white/10 overflow-hidden">
                    <div className="h-40 bg-white/5 animate-pulse" />
                    <CardContent className="p-4 space-y-2">
                      <div className="h-4 rounded bg-white/10 animate-pulse" />
                      <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {recommendations.length > 0 && (
              <Card className="rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-2xl">
                    <Lightbulb className="h-6 w-6 text-yellow-300" />
                    AI Suggestions
                  </CardTitle>
                  <CardDescription>Tap any chip and auto-fill your generator prompt.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {recommendations.slice(0, 8).map((rec, i) => (
                    <button
                      key={i}
                      type="button"
                      className="px-3 py-2 rounded-full text-sm bg-white/5 border border-white/10 text-gray-200 hover:text-white hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all duration-300"
                      onClick={() => {
                        setTopic(rec.title);
                        setLearningGoal(rec.description);
                        formAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      {rec.title}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <section className="space-y-5">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-2 inline-flex gap-2 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setActiveFeed("trending")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeFeed === "trending" ? "bg-orange-500/20 text-orange-200 border border-orange-400/40" : "text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Flame className="h-4 w-4" /> Trending ({trendingCourses.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFeed("community")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeFeed === "community" ? "bg-purple-500/20 text-purple-200 border border-purple-400/40" : "text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Community ({communityCourses.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFeed("mine")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeFeed === "mine" ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40" : "text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Your Courses ({myCourses.length})
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <CurrentFeedIcon className="h-6 w-6 text-primary" />
                  {currentFeed.title}
                </h2>
                <p className="text-sm text-muted-foreground">{currentFeed.subtitle}</p>
              </div>

              {currentFeed.data.length === 0 ? (
                <Card className="rounded-2xl bg-white/5 border-white/10">
                  <CardContent className="p-10 text-center">
                    <Sparkles className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                    <p className="text-slate-900 dark:text-gray-300">{currentFeed.emptyTitle}</p>
                    <p className="text-sm text-gray-500 mt-1">{currentFeed.emptyDesc}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {currentFeed.data.map((course, i) => {
                    const canDelete = activeFeed === "mine" || role === "admin";
                    return (
                      <CourseCard
                        key={`${course.id}-${i}`}
                        course={course}
                        accent={currentFeed.accent}
                        canDelete={canDelete}
                        onDelete={handleDeleteCourse}
                        onOpen={() => navigate("/course-view", { state: course })}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
