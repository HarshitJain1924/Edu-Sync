import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Clock, Tag, Search, Filter, Sparkles, Home, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Video {
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

const POSITIVE_STUDY_TERMS = [
  "tutorial",
  "course",
  "learn",
  "lesson",
  "lecture",
  "explained",
  "beginner",
  "advanced",
  "interview",
  "placement",
  "bootcamp",
  "roadmap",
  "project",
  "coding",
  "school",
  "academy",
  "developer"
];

const NEGATIVE_NOISE_TERMS = [
  "trailer",
  "teaser",
  "music",
  "lyrics",
  "valorant",
  "gameplay",
  "highlights",
  "shorts",
  "patch notes",
  "official trailer"
];

const LOCAL_SAVED_VIDEOS_KEY = "edu_sync_saved_videos";

const DEFAULT_LIBRARY_VIDEOS: Video[] = [
  {
    id: "default-react-hooks",
    title: "React Hooks Interview Primer",
    description: "Core Hooks patterns and common interview scenarios with practical examples.",
    url: "https://www.youtube.com/watch?v=TNhaISOUy6Q",
    thumbnail_url: "https://img.youtube.com/vi/TNhaISOUy6Q/hqdefault.jpg",
    duration: 1200,
    topic: "React",
    difficulty: "beginner",
    tags: ["react", "hooks", "frontend"],
    views_count: 150,
    likes_count: 45,
  },
  {
    id: "default-react-full-course",
    title: "ReactJS Full Course | ReactJS - Learn Everything",
    description: "Complete ReactJS course from scratch to advanced with hands-on examples.",
    url: "https://www.youtube.com/watch?v=dpw9EHDh2bM",
    thumbnail_url: "https://img.youtube.com/vi/dpw9EHDh2bM/hqdefault.jpg",
    duration: 42954,
    topic: "React",
    difficulty: "intermediate",
    tags: ["react", "full-course", "frontend"],
    views_count: 1000540,
    likes_count: 23736,
  },
  {
    id: "default-css-grid",
    title: "CSS Grid Layout Masterclass",
    description: "Modern CSS Grid techniques for real responsive dashboards and apps.",
    url: "https://www.youtube.com/watch?v=9zBsdzdE4sM",
    thumbnail_url: "https://img.youtube.com/vi/9zBsdzdE4sM/hqdefault.jpg",
    duration: 2400,
    topic: "CSS",
    difficulty: "intermediate",
    tags: ["css", "grid", "responsive"],
    views_count: 234,
    likes_count: 78,
  },
  {
    id: "default-node-express-course",
    title: "Node and Express Full Course",
    description: "Build backend fundamentals with Node.js, Express, routing, middleware, and REST APIs.",
    url: "https://www.youtube.com/watch?v=Oe421EPjeBE",
    thumbnail_url: "https://img.youtube.com/vi/Oe421EPjeBE/hqdefault.jpg",
    duration: 2100,
    topic: "Backend",
    difficulty: "beginner",
    tags: ["nodejs", "express", "backend"],
    views_count: 320,
    likes_count: 110,
  },
];

const YT_PLACEHOLDER_THUMB = "https://i.ytimg.com/vi/invalid/hqdefault.jpg";

const getYoutubeIdFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "");
    }
    if (u.searchParams.get("v")) {
      return u.searchParams.get("v");
    }
    const match = u.pathname.match(/\/embed\/([^/?]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const normalizeLibraryVideo = (video: Video): Video => {
  // Migrate legacy broken default entry that can show a gray YouTube placeholder.
  const isLegacyBrokenTsEntry =
    video.id === "default-typescript-patterns" ||
    video.title?.toLowerCase().includes("advanced typescript patterns");

  if (isLegacyBrokenTsEntry) {
    return {
      // Use direct YouTube ID route so player loads this known-working external video,
      // instead of stale DB UUID records that may point to unavailable embeds.
      id: "BwuLxPH8IDs",
      title: "TypeScript Tutorial for Beginners",
      description: "Learn TypeScript fundamentals, types, interfaces, and practical development workflows.",
      url: "https://www.youtube.com/watch?v=BwuLxPH8IDs",
      thumbnail_url: "https://img.youtube.com/vi/BwuLxPH8IDs/hqdefault.jpg",
      duration: 3660,
      topic: "TypeScript",
      difficulty: "intermediate",
      tags: ["typescript", "javascript", "frontend"],
      views_count: Math.max(0, video.views_count || 0),
      likes_count: Math.max(0, video.likes_count || 0),
    };
  }

  const ytId = getYoutubeIdFromUrl(video.url || "");
  const derivedThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";

  return {
    ...video,
    description: video.description || "High quality learning content curated for focused study.",
    thumbnail_url:
      !video.thumbnail_url || video.thumbnail_url.includes("ytimg.com/vi/invalid")
        ? (derivedThumb || YT_PLACEHOLDER_THUMB)
        : video.thumbnail_url,
    tags: Array.isArray(video.tags) ? video.tags : [],
    views_count: Number.isFinite(video.views_count) ? video.views_count : 0,
    likes_count: Number.isFinite(video.likes_count) ? video.likes_count : 0,
  };
};

const parseIsoDurationToSeconds = (iso: string): number => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};

const sanitizeLibraryVideos = async (videos: Video[], apiKey?: string): Promise<Video[]> => {
  if (!apiKey) return videos;

  const ytIds = Array.from(
    new Set(
      videos
        .map((v) => getYoutubeIdFromUrl(v.url || ""))
        .filter((id): id is string => Boolean(id))
    )
  );

  if (ytIds.length === 0) return videos;

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=status&id=${ytIds.join(",")}&key=${apiKey}`
    );
    const data = await response.json();
    const items = data?.items || [];

    const embeddableMap = new Map<string, boolean>();
    for (const item of items) {
      embeddableMap.set(item.id, item?.status?.embeddable !== false);
    }

    const usedIds = new Set(videos.map((v) => v.id));

    const pickFallback = (topic: string) => {
      const sameTopic = DEFAULT_LIBRARY_VIDEOS.find((v) => !usedIds.has(v.id) && v.topic.toLowerCase() === (topic || "").toLowerCase());
      if (sameTopic) return sameTopic;
      return DEFAULT_LIBRARY_VIDEOS.find((v) => !usedIds.has(v.id));
    };

    const output: Video[] = [];
    for (const video of videos) {
      const ytId = getYoutubeIdFromUrl(video.url || "");
      if (!ytId) {
        output.push(video);
        continue;
      }

      const embeddable = embeddableMap.get(ytId) ?? true;
      if (embeddable) {
        output.push(video);
        continue;
      }

      const fallback = pickFallback(video.topic || "");
      if (fallback) {
        usedIds.add(fallback.id);
        output.push(normalizeLibraryVideo(fallback));
      }
    }

    // Deduplicate by id after replacements.
    const deduped = Array.from(new Map(output.map((v) => [v.id, v])).values());
    return deduped;
  } catch {
    return videos;
  }
};

const relevanceScore = (title: string, description: string, durationSeconds: number, categoryId?: string): number => {
  const haystack = `${title} ${description}`.toLowerCase();
  let score = 0;

  POSITIVE_STUDY_TERMS.forEach((term) => {
    if (haystack.includes(term)) score += 2;
  });

  NEGATIVE_NOISE_TERMS.forEach((term) => {
    if (haystack.includes(term)) score -= 4;
  });

  if (durationSeconds >= 600) score += 3;
  else if (durationSeconds >= 300) score += 1;

  if (categoryId === "27") score += 3; // YouTube Education category

  return score;
};

const VideoLibrary = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
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

    setSearchMode(mode);
    setYoutubeError(null);
    setIsSearching(false);
    setSearchQuery("");

    if (mode === 'library') {
      setTopicFilter("all");
      setDifficultyFilter("all");
      setFilteredVideos(videos);
      return;
    }

    setFilteredVideos([]);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (searchMode === 'library') {
        filterVideos();
    }
  }, [searchQuery, topicFilter, difficultyFilter, videos, searchMode]);

  const getLocalSavedVideos = (): Video[] => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVED_VIDEOS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Video[]) : [];
      return Array.isArray(parsed) ? parsed.map((v) => normalizeLibraryVideo(v)) : [];
    } catch {
      return [];
    }
  };

  const fetchVideos = async () => {
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
      const { data: { user } } = await supabase.auth.getUser();

      let bookmarkedIds: string[] = [];
      if (user) {
        const { data: bookmarkRows } = await supabase
          .from("video_interactions")
          .select("video_id")
          .eq("user_id", user.id)
          .eq("saved", true);
        bookmarkedIds = (bookmarkRows || []).map((r: any) => r.video_id);
      }

      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((v) => normalizeLibraryVideo(v as Video));
      const localSavedVideos = getLocalSavedVideos();

      const combinedMap = new Map<string, Video>();
      normalized.forEach((v) => combinedMap.set(v.id, v));
      localSavedVideos.forEach((v) => combinedMap.set(v.id, v));

      const combinedVideos = Array.from(combinedMap.values());
      const bookmarkedSet = new Set(bookmarkedIds);
      localSavedVideos.forEach((v) => bookmarkedSet.add(v.id));
      setSavedVideoIds(bookmarkedSet);

      const savedFirst = [
        ...combinedVideos.filter((v) => bookmarkedSet.has(v.id)),
        ...combinedVideos.filter((v) => !bookmarkedSet.has(v.id)),
      ];

      const finalVideos = savedFirst.length > 0 ? savedFirst : DEFAULT_LIBRARY_VIDEOS;
      const embeddableOnly = await sanitizeLibraryVideos(finalVideos, apiKey);

      setVideos(embeddableOnly);
      setFilteredVideos(embeddableOnly);
    } catch (error) {
      console.error("Error fetching videos:", error);
      // Graceful fallback when DB is empty/unavailable
      const localSavedVideos = getLocalSavedVideos();
      const mergedFallback = [...localSavedVideos, ...DEFAULT_LIBRARY_VIDEOS.filter((v) => !localSavedVideos.some((lv) => lv.id === v.id))];
      setSavedVideoIds(new Set(localSavedVideos.map((v) => v.id)));
      const embeddableOnly = await sanitizeLibraryVideos(mergedFallback, import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined);
      setVideos(embeddableOnly);
      setFilteredVideos(embeddableOnly);
    } finally {
      setLoading(false);
    }
  };

  const handleYoutubeSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setYoutubeError(null);
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

    if (!apiKey) {
      const message = "YouTube API key is missing. Add VITE_YOUTUBE_API_KEY to .env and restart the app.";
      setYoutubeError(message);
      toast({ title: "YouTube search unavailable", description: message, variant: "destructive" });
      setIsSearching(false);
      return;
    }
    
    try {
      const educationalQuery = `${searchQuery} tutorial course lecture interview preparation`;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(educationalQuery)}&type=video&videoEmbeddable=true&order=relevance&maxResults=25&key=${apiKey}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "YouTube search request failed.");
      }
      
      if (data.items) {
          const ids = (data.items || []).map((item: any) => item.id?.videoId).filter(Boolean);

          let detailsMap = new Map<string, any>();
          if (ids.length > 0) {
            const detailsRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet,status&id=${ids.join(",")}&key=${apiKey}`
            );
            const detailsData = await detailsRes.json();
            const detailItems = detailsData?.items || [];
            detailsMap = new Map(detailItems.map((d: any) => [d.id, d]));
          }

          const ranked = (data.items || []).map((item: any) => {
            const id = item.id.videoId;
            const detail = detailsMap.get(id);
            const title = item.snippet.title || "Untitled";
            const description = item.snippet.description || "";
            const durationSec = parseIsoDurationToSeconds(detail?.contentDetails?.duration || "");
            const categoryId = detail?.snippet?.categoryId;

            const embeddable = detail?.status?.embeddable !== false;

            return {
              video: {
                id,
                title,
                description,
                url: `https://www.youtube.com/watch?v=${id}`,
                thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                duration: durationSec,
                topic: "YouTube Search",
                difficulty: "various",
                tags: [],
                views_count: parseInt(detail?.statistics?.viewCount || "0", 10),
                likes_count: parseInt(detail?.statistics?.likeCount || "0", 10)
              } as Video,
              score: relevanceScore(title, description, durationSec, categoryId),
              embeddable
            };
          });

          let ytVideos = ranked
            .filter((r) => r.embeddable)
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((r) => r.video)
            .slice(0, 12);

          // If strict filtering returns nothing, fallback to best available relevance order.
          if (ytVideos.length === 0) {
            ytVideos = ranked
              .filter((r) => r.embeddable)
              .sort((a, b) => b.score - a.score)
              .map((r) => r.video)
              .slice(0, 12);
          }

          setFilteredVideos(ytVideos);

          if (ytVideos.length === 0) {
            setYoutubeError("No study-focused YouTube videos found for this query.");
          }
      }
    } catch (error) {
      console.error("YouTube search error:", error);
      const message = error instanceof Error ? error.message : "Unable to search YouTube right now.";
      setYoutubeError(message);
      toast({ title: "YouTube search failed", description: message, variant: "destructive" });
      setFilteredVideos([]);
    } finally {
      setIsSearching(false);
    }
  };

  const filterVideos = () => {
    let filtered = [...videos];

    if (searchQuery) {
      filtered = filtered.filter(
        (video) =>
          video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          video.tags?.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    if (topicFilter !== "all") {
      filtered = filtered.filter((video) => video.topic === topicFilter);
    }

    if (difficultyFilter !== "all") {
      filtered = filtered.filter((video) => video.difficulty === difficultyFilter);
    }

    setFilteredVideos(filtered);
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "External";
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "intermediate":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "advanced":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const uniqueTopics = Array.from(new Set(videos.map((v) => v.topic)));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-white relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-4">
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"
            onClick={() => navigate("/dashboard")}
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent flex items-center gap-3 tracking-tight">
                🎥 Video Learning
                <Badge variant="secondary" className="text-[10px] font-bold animate-pulse-subtle bg-primary/10 text-primary border-primary/30">
                <Sparkles className="h-3 w-3 mr-1" /> AI POWERED
                </Badge>
            </h1>
            <p className="text-gray-400 flex items-center gap-2">
                Explore educational videos and enhance your learning journey with our AI tutor
            </p>
          </div>

          <div className="flex bg-white/5 backdrop-blur-xl p-1 rounded-xl border border-white/15 self-start md:self-auto shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <Button 
                variant="ghost"
                size="sm" 
                className={`rounded-lg gap-2 px-4 transition-all duration-200 ${
                  searchMode === 'library'
                    ? 'bg-primary text-white shadow-[0_8px_20px_rgba(59,130,246,0.35)] border border-primary/70'
                    : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
                aria-pressed={searchMode === 'library'}
                onClick={() => switchSearchMode('library')}
            >
                <Tag className="h-4 w-4" />
                Library
            </Button>
            <Button 
                variant="ghost"
                size="sm" 
              className={`rounded-lg gap-2 px-4 transition-all duration-200 ${
                searchMode === 'youtube'
                  ? 'bg-primary text-white shadow-[0_8px_20px_rgba(59,130,246,0.35)] border border-primary/70'
                  : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
                aria-pressed={searchMode === 'youtube'}
                onClick={() => switchSearchMode('youtube')}
            >
                <Play className="h-4 w-4" />
                Global Search
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={searchMode === 'library' ? "Search library..." : "Search YouTube directly..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchMode === 'youtube') handleYoutubeSearch();
              }}
              className="pl-10 pr-24 bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus-visible:ring-primary/50"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-11 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-300 hover:bg-white/10"
                onClick={() => {
                  setSearchQuery("");
                  if (searchMode === "youtube") {
                    setFilteredVideos([]);
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {searchMode === 'youtube' && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleYoutubeSearch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 text-primary hover:bg-primary/10"
                    disabled={isSearching}
                >
                    {isSearching ? "..." : "Search"}
                </Button>
            )}
            <Sparkles className="absolute right-12 top-1/2 transform -translate-y-1/2 text-primary/40 h-3 w-3" />
          </div>
          
          {searchMode === 'library' && (
              <>
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-white/5 border-white/10 text-white">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Topic" />
                    </SelectTrigger>
                  <SelectContent className="bg-[#101a32] border-white/10 text-white">
                    <SelectItem value="all">All Topics</SelectItem>
                    {uniqueTopics.map((topic) => (
                        <SelectItem key={topic} value={topic}>
                        {topic}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                  <SelectContent className="bg-[#101a32] border-white/10 text-white">
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                </Select>
              </>
          )}
        </div>

        {searchMode === 'youtube' && youtubeError && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {youtubeError}
          </div>
        )}

        <div className="mb-6 flex items-center gap-3 text-sm text-gray-300">
          <Badge className={`border text-gray-100 ${searchMode === 'youtube' ? 'bg-primary/25 border-primary/60' : 'bg-emerald-500/20 border-emerald-400/50'}`}>
            {searchMode === 'youtube' ? 'Global YouTube (Active)' : 'Library (Active)'}
          </Badge>
          <span>{filteredVideos.length} results</span>
        </div>

        {/* Video Grid */}
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {searchMode === 'youtube' ? "No YouTube results yet. Enter a query and run search." : "No videos found matching your criteria."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className="group hover:shadow-[0_10px_40px_rgba(37,99,235,0.18)] transition-all duration-300 cursor-pointer overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl hover:border-primary/40"
                onClick={() => navigate(`/video/${video.id}`)}
              >
                <div className="relative aspect-video overflow-hidden bg-black/30">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== YT_PLACEHOLDER_THUMB) {
                        img.src = YT_PLACEHOLDER_THUMB;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {formatDuration(video.duration)}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors text-white">
                      {video.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                    {video.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="outline" className={getDifficultyColor(video.difficulty)}>
                      {video.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-white/20 text-gray-200">
                      {video.topic}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>👁️ {video.views_count} views</span>
                  </div>
                  <Button className="w-full mt-4 bg-primary/90 hover:bg-primary text-white" variant="default">
                    <Play className="mr-2 h-4 w-4" />
                    Watch Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoLibrary;
