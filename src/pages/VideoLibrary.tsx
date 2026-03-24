import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Clock, Tag, Search, Sparkles, X, Video, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import AppSidebar from "@/components/AppSidebar";

interface VideoItem {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  duration: number;
  topic: string;
  difficulty: string;
  tags: string[];
  views_count: number;
  likes_count: number;
}

const POSITIVE_STUDY_TERMS = ["tutorial","course","learn","lesson","lecture","explained","beginner","advanced","interview","placement","bootcamp","roadmap","project","coding","school","academy","developer"];
const NEGATIVE_NOISE_TERMS = ["trailer","teaser","music","lyrics","valorant","gameplay","highlights","shorts","patch notes","official trailer"];

const LOCAL_SAVED_VIDEOS_KEY = "edu_sync_saved_videos";

const DEFAULT_LIBRARY_VIDEOS: VideoItem[] = [
  { id: "default-react-hooks", title: "React Hooks Interview Primer", description: "Core Hooks patterns and common interview scenarios with practical examples.", url: "https://www.youtube.com/watch?v=TNhaISOUy6Q", thumbnail_url: "https://img.youtube.com/vi/TNhaISOUy6Q/hqdefault.jpg", duration: 1200, topic: "React", difficulty: "beginner", tags: ["react","hooks","frontend"], views_count: 150, likes_count: 45 },
  { id: "default-react-full-course", title: "ReactJS Full Course | ReactJS - Learn Everything", description: "Complete ReactJS course from scratch to advanced with hands-on examples.", url: "https://www.youtube.com/watch?v=dpw9EHDh2bM", thumbnail_url: "https://img.youtube.com/vi/dpw9EHDh2bM/hqdefault.jpg", duration: 42954, topic: "React", difficulty: "intermediate", tags: ["react","full-course","frontend"], views_count: 1000540, likes_count: 23736 },
  { id: "default-css-grid", title: "CSS Grid Layout Masterclass", description: "Modern CSS Grid techniques for real responsive dashboards and apps.", url: "https://www.youtube.com/watch?v=9zBsdzdE4sM", thumbnail_url: "https://img.youtube.com/vi/9zBsdzdE4sM/hqdefault.jpg", duration: 2400, topic: "CSS", difficulty: "intermediate", tags: ["css","grid","responsive"], views_count: 234, likes_count: 78 },
  { id: "default-node-express-course", title: "Node and Express Full Course", description: "Build backend fundamentals with Node.js, Express, routing, middleware, and REST APIs.", url: "https://www.youtube.com/watch?v=Oe421EPjeBE", thumbnail_url: "https://img.youtube.com/vi/Oe421EPjeBE/hqdefault.jpg", duration: 2100, topic: "Backend", difficulty: "beginner", tags: ["nodejs","express","backend"], views_count: 320, likes_count: 110 },
];

const YT_PLACEHOLDER_THUMB = "https://i.ytimg.com/vi/invalid/hqdefault.jpg";

const getYoutubeIdFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const match = u.pathname.match(/\/embed\/([^/?]+)/);
    return match?.[1] ?? null;
  } catch { return null; }
};

const normalizeLibraryVideo = (video: VideoItem): VideoItem => {
  const isLegacyBrokenTsEntry = video.id === "default-typescript-patterns" || video.title?.toLowerCase().includes("advanced typescript patterns");
  if (isLegacyBrokenTsEntry) {
    return { id: "BwuLxPH8IDs", title: "TypeScript Tutorial for Beginners", description: "Learn TypeScript fundamentals, types, interfaces, and practical development workflows.", url: "https://www.youtube.com/watch?v=BwuLxPH8IDs", thumbnail_url: "https://img.youtube.com/vi/BwuLxPH8IDs/hqdefault.jpg", duration: 3660, topic: "TypeScript", difficulty: "intermediate", tags: ["typescript","javascript","frontend"], views_count: Math.max(0, video.views_count || 0), likes_count: Math.max(0, video.likes_count || 0) };
  }
  const ytId = getYoutubeIdFromUrl(video.url || "");
  const derivedThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";
  return { ...video, description: video.description || "High quality learning content curated for focused study.", thumbnail_url: !video.thumbnail_url || video.thumbnail_url.includes("ytimg.com/vi/invalid") ? (derivedThumb || YT_PLACEHOLDER_THUMB) : video.thumbnail_url, tags: Array.isArray(video.tags) ? video.tags : [], views_count: Number.isFinite(video.views_count) ? video.views_count : 0, likes_count: Number.isFinite(video.likes_count) ? video.likes_count : 0 };
};

const parseIsoDurationToSeconds = (iso: string): number => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0", 10) * 3600 + parseInt(match[2] || "0", 10) * 60 + parseInt(match[3] || "0", 10);
};

const sanitizeLibraryVideos = async (videos: VideoItem[], apiKey?: string): Promise<VideoItem[]> => {
  if (!apiKey) return videos;
  const ytIds = Array.from(new Set(videos.map((v) => getYoutubeIdFromUrl(v.url || "")).filter((id): id is string => Boolean(id))));
  if (ytIds.length === 0) return videos;
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${ytIds.join(",")}&key=${apiKey}`);
    const data = await response.json();
    const items = data?.items || [];
    const embeddableMap = new Map<string, boolean>();
    for (const item of items) embeddableMap.set(item.id, item?.status?.embeddable !== false);
    const usedIds = new Set(videos.map((v) => v.id));
    const pickFallback = (topic: string) => { const sameTopic = DEFAULT_LIBRARY_VIDEOS.find((v) => !usedIds.has(v.id) && v.topic.toLowerCase() === (topic || "").toLowerCase()); return sameTopic || DEFAULT_LIBRARY_VIDEOS.find((v) => !usedIds.has(v.id)); };
    const output: VideoItem[] = [];
    for (const video of videos) { const ytId = getYoutubeIdFromUrl(video.url || ""); if (!ytId) { output.push(video); continue; } const embeddable = embeddableMap.get(ytId) ?? true; if (embeddable) { output.push(video); continue; } const fallback = pickFallback(video.topic || ""); if (fallback) { usedIds.add(fallback.id); output.push(normalizeLibraryVideo(fallback)); } }
    return Array.from(new Map(output.map((v) => [v.id, v])).values());
  } catch { return videos; }
};

const relevanceScore = (title: string, description: string, durationSeconds: number, categoryId?: string): number => {
  const haystack = `${title} ${description}`.toLowerCase();
  let score = 0;
  POSITIVE_STUDY_TERMS.forEach((term) => { if (haystack.includes(term)) score += 2; });
  NEGATIVE_NOISE_TERMS.forEach((term) => { if (haystack.includes(term)) score -= 4; });
  if (durationSeconds >= 600) score += 3; else if (durationSeconds >= 300) score += 1;
  if (categoryId === "27") score += 3;
  return score;
};

// ─── Component ─────────────────────────────────────────────────
const VideoLibrary = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [searchMode, setSearchMode] = useState<'library' | 'youtube'>('library');
  const [isSearching, setIsSearching] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());

  const switchSearchMode = (mode: 'library' | 'youtube') => {
    if (mode === searchMode) return;
    setSearchMode(mode); setYoutubeError(null); setIsSearching(false); setSearchQuery("");
    if (mode === 'library') { setTopicFilter("all"); setDifficultyFilter("all"); setFilteredVideos(videos); return; }
    setFilteredVideos([]);
  };

  useEffect(() => { fetchVideos(); }, []);
  useEffect(() => { if (searchMode === 'library') filterVideos(); }, [searchQuery, topicFilter, difficultyFilter, videos, searchMode]);

  const getLocalSavedVideos = (): VideoItem[] => { try { const raw = localStorage.getItem(LOCAL_SAVED_VIDEOS_KEY); const parsed = raw ? (JSON.parse(raw) as VideoItem[]) : []; return Array.isArray(parsed) ? parsed.map((v) => normalizeLibraryVideo(v)) : []; } catch { return []; } };

  const fetchVideos = async () => {
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
      const { data: { user } } = await supabase.auth.getUser();
      let bookmarkedIds: string[] = [];
      if (user) { const { data: bookmarkRows } = await supabase.from("video_interactions").select("video_id").eq("user_id", user.id).eq("saved", true); bookmarkedIds = (bookmarkRows || []).map((r: any) => r.video_id); }
      const { data, error } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const normalized = (data || []).map((v) => normalizeLibraryVideo(v as VideoItem));
      const localSavedVideos = getLocalSavedVideos();
      const combinedMap = new Map<string, VideoItem>(); normalized.forEach((v) => combinedMap.set(v.id, v)); localSavedVideos.forEach((v) => combinedMap.set(v.id, v));
      const combinedVideos = Array.from(combinedMap.values());
      const bookmarkedSet = new Set(bookmarkedIds); localSavedVideos.forEach((v) => bookmarkedSet.add(v.id)); setSavedVideoIds(bookmarkedSet);
      const savedFirst = [...combinedVideos.filter((v) => bookmarkedSet.has(v.id)), ...combinedVideos.filter((v) => !bookmarkedSet.has(v.id))];
      const finalVideos = savedFirst.length > 0 ? savedFirst : DEFAULT_LIBRARY_VIDEOS;
      const embeddableOnly = await sanitizeLibraryVideos(finalVideos, apiKey);
      setVideos(embeddableOnly); setFilteredVideos(embeddableOnly);
    } catch { const localSavedVideos = getLocalSavedVideos(); const mergedFallback = [...localSavedVideos, ...DEFAULT_LIBRARY_VIDEOS.filter((v) => !localSavedVideos.some((lv) => lv.id === v.id))]; setSavedVideoIds(new Set(localSavedVideos.map((v) => v.id))); const embeddableOnly = await sanitizeLibraryVideos(mergedFallback, import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined); setVideos(embeddableOnly); setFilteredVideos(embeddableOnly); }
    finally { setLoading(false); }
  };

  const handleYoutubeSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true); setYoutubeError(null);
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) { setYoutubeError("YouTube API key is missing."); toast({ title: "YouTube search unavailable", description: "Add VITE_YOUTUBE_API_KEY to .env", variant: "destructive" }); setIsSearching(false); return; }
    try {
      const educationalQuery = `${searchQuery} tutorial course lecture interview preparation`;
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(educationalQuery)}&type=video&videoEmbeddable=true&order=relevance&maxResults=25&key=${apiKey}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "YouTube search failed.");
      if (data.items) {
        const ids = (data.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
        let detailsMap = new Map<string, any>();
        if (ids.length > 0) { const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet,status&id=${ids.join(",")}&key=${apiKey}`); const detailsData = await detailsRes.json(); detailsMap = new Map((detailsData?.items || []).map((d: any) => [d.id, d])); }
        const ranked = (data.items || []).map((item: any) => { const id = item.id.videoId; const detail = detailsMap.get(id); const title = item.snippet.title || "Untitled"; const description = item.snippet.description || ""; const durationSec = parseIsoDurationToSeconds(detail?.contentDetails?.duration || ""); const categoryId = detail?.snippet?.categoryId; const embeddable = detail?.status?.embeddable !== false; return { video: { id, title, description, url: `https://www.youtube.com/watch?v=${id}`, thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url, duration: durationSec, topic: "YouTube Search", difficulty: "various", tags: [], views_count: parseInt(detail?.statistics?.viewCount || "0", 10), likes_count: parseInt(detail?.statistics?.likeCount || "0", 10) } as VideoItem, score: relevanceScore(title, description, durationSec, categoryId), embeddable }; });
        let ytVideos = ranked.filter((r) => r.embeddable).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).map((r) => r.video).slice(0, 12);
        if (ytVideos.length === 0) ytVideos = ranked.filter((r) => r.embeddable).sort((a, b) => b.score - a.score).map((r) => r.video).slice(0, 12);
        setFilteredVideos(ytVideos);
        if (ytVideos.length === 0) setYoutubeError("No study-focused YouTube videos found.");
      }
    } catch (error) { const message = error instanceof Error ? error.message : "Unable to search YouTube."; setYoutubeError(message); toast({ title: "YouTube search failed", description: message, variant: "destructive" }); setFilteredVideos([]); }
    finally { setIsSearching(false); }
  };

  const filterVideos = () => {
    let filtered = [...videos];
    if (searchQuery) filtered = filtered.filter((v) => v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.description?.toLowerCase().includes(searchQuery.toLowerCase()) || v.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    if (topicFilter !== "all") filtered = filtered.filter((v) => v.topic === topicFilter);
    if (difficultyFilter !== "all") filtered = filtered.filter((v) => v.difficulty === difficultyFilter);
    setFilteredVideos(filtered);
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "External";
    if (seconds >= 3600) { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`; }
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const formatViews = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  const difficultyStyle: Record<string, string> = {
    beginner: "text-emerald-700 bg-emerald-100 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    intermediate: "text-amber-700 bg-amber-100 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20",
    advanced: "text-rose-700 bg-rose-100 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20",
  };

  const uniqueTopics = Array.from(new Set(videos.map((v) => v.topic)));
  const glass = "rounded-2xl bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/[0.06]";

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-100 dark:bg-[#0f0f0f] transition-colors duration-500">
        <AppSidebar />
        <main className="ml-64 flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Video className="h-10 w-10 text-violet-400 animate-pulse" />
            <p className="text-slate-600 dark:text-zinc-500 text-sm font-semibold">Loading videos…</p>
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
        {/* Ambient Orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden ml-64">
          <div className="absolute -top-[15%] -right-[10%] h-[55%] w-[55%] bg-violet-500/[0.08] blur-[140px]" />
          <div className="absolute -bottom-[10%] -left-[10%] h-[55%] w-[55%] bg-blue-500/[0.06] blur-[140px]" />
          <div className="absolute top-[35%] left-[20%] h-[35%] w-[35%] bg-violet-500/5 blur-[130px]" />
        </div>

        <div className="relative z-10 min-h-screen p-8 md:p-10 bg-slate-100 dark:bg-[#0f0f0f] transition-colors duration-500">
          {/* Header */}
          <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10">
                  <Video className="h-6 w-6 text-violet-300" />
                </div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Video Learning</h1>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 text-base max-w-lg">
                Explore educational videos and enhance your learning journey with curated content.
              </p>
            </div>

            {/* Mode Toggle Dock */}
            <div className="inline-flex p-1.5 rounded-full bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] shadow-[0_8px_30px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.5)] shrink-0">
              <button
                onClick={() => switchSearchMode('library')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300",
                  searchMode === 'library'
                    ? "bg-violet-100 dark:bg-white/10 text-slate-900 dark:text-white border border-violet-200 dark:border-white/15 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "text-slate-600 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300 border border-transparent"
                )}
              >
                <Tag className="h-4 w-4" />
                Library
              </button>
              <button
                onClick={() => switchSearchMode('youtube')}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300",
                  searchMode === 'youtube'
                    ? "bg-violet-100 dark:bg-white/10 text-slate-900 dark:text-white border border-violet-200 dark:border-white/15 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "text-slate-600 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-300 border border-transparent"
                )}
              >
                <Play className="h-4 w-4" />
                Global Search
              </button>
            </div>
          </header>

          {/* Search & Filters */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-zinc-500 h-4 w-4" />
              <Input
                placeholder={searchMode === 'library' ? "Search library..." : "Search YouTube directly..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchMode === 'youtube') handleYoutubeSearch(); }}
                className="pl-11 pr-24 h-12 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-zinc-600 rounded-xl focus-visible:ring-violet-500/30"
              />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-14 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg" onClick={() => { setSearchQuery(""); if (searchMode === "youtube") setFilteredVideos([]); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              {searchMode === 'youtube' && (
                <Button variant="ghost" size="sm" onClick={handleYoutubeSearch} disabled={isSearching} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 text-violet-700 dark:text-violet-400 hover:bg-violet-500/10 rounded-lg font-bold text-xs">
                  {isSearching ? "..." : "Search"}
                </Button>
              )}
            </div>

            {searchMode === 'library' && (
              <>
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-12 bg-white/80 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-white rounded-xl">
                    <SelectValue placeholder="Topic" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#151320] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl">
                    <SelectItem value="all">All Topics</SelectItem>
                    {uniqueTopics.map((topic) => (<SelectItem key={topic} value={topic}>{topic}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="w-full md:w-[180px] h-12 bg-white/80 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06] text-slate-900 dark:text-white rounded-xl">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#151320] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl">
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Active Filter Info */}
          <div className="mb-6 flex items-center gap-3">
            <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border", searchMode === 'youtube' ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20" : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20")}>
              {searchMode === 'youtube' ? 'YouTube Active' : 'Library Active'}
            </span>
            <span className="text-xs text-slate-600 dark:text-zinc-500 font-medium">{filteredVideos.length} results</span>
          </div>

          {searchMode === 'youtube' && youtubeError && (
            <div className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">{youtubeError}</div>
          )}

          {/* Video Grid */}
          {filteredVideos.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] p-16 text-center">
              <Play className="h-10 w-10 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-zinc-400 font-semibold mb-1">
                {searchMode === 'youtube' ? "No YouTube results yet" : "No videos found"}
              </p>
              <p className="text-slate-600 dark:text-zinc-600 text-sm">
                {searchMode === 'youtube' ? "Enter a query and hit search to find educational videos." : "Try adjusting your search or filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredVideos.map((video, i) => (
                <div
                  key={video.id}
                  className={cn(glass, "overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-10px_rgba(139,92,246,0.2)] hover:border-violet-200 dark:hover:border-white/10")}
                  onClick={() => navigate(`/video/${video.id}`)}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden bg-black/30">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { const img = e.currentTarget; if (img.src !== YT_PLACEHOLDER_THUMB) img.src = YT_PLACEHOLDER_THUMB; }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Play className="h-6 w-6 text-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(video.duration)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-bold text-[15px] text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-100 transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {video.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-md border", difficultyStyle[video.difficulty] || "text-zinc-400 bg-white/5 border-white/10")}>
                        {video.difficulty}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-md border text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06]">
                        {video.topic}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-500">
                        <Eye className="h-3 w-3" />
                        {formatViews(video.views_count)} views
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 dark:text-zinc-500 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                        Watch →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoLibrary;
