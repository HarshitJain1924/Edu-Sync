import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  Play,
  Plus,
  X,
  Bot,
  User,
  Send,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  Zap,
  BookOpen,
  MessageSquare,
  Pause,
  Layers,
  ChevronRight,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/hooks/use-toast";
import { askCourseTutor } from "@/lib/ai-tutor";
import { AICourseDetails } from "@/lib/ai-service";
import { GoogleGenAI } from "@google/genai";
import { cn } from "@/lib/utils";

// YouTube IFrame API types
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

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

interface Note {
  id: string;
  timestamp_seconds: number;
  note_text: string;
  is_bookmark: boolean;
  created_at: string;
}

interface Interaction {
  liked: boolean;
  saved: boolean;
  rating: number | null;
}

interface Keyframe {
  time: number;
  label: string;
}

const LOCAL_SAVED_VIDEOS_KEY = "edu_sync_saved_videos";

const parseIsoDurationToSeconds = (iso: string): number => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};

const VideoPlayer = () => {
  useRequireAuth();
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Refs
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Video State
  const [video, setVideo] = useState<Video | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [interaction, setInteraction] = useState<Interaction>({
    liked: false,
    saved: false,
    rating: null,
  });
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  
  // AI Tutor & Summary State
  const [messages, setMessages] = useState<Array<{role: 'user' | 'tutor' | 'ai', content: string}>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTutorTyping, setIsTutorTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Premium Features & Sync State
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [timestampSource, setTimestampSource] = useState<"description-chapters" | "ai-checkpoints">("ai-checkpoints");
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerDuration, setPlayerDuration] = useState<number | null>(null);
  const [pendingResumeSeconds, setPendingResumeSeconds] = useState<number>(0);

  const getEffectiveDuration = () => {
    const liveDuration = playerRef.current?.getDuration?.();
    if (typeof liveDuration === "number" && Number.isFinite(liveDuration) && liveDuration > 0) {
      return liveDuration;
    }
    if (typeof playerDuration === "number" && Number.isFinite(playerDuration) && playerDuration > 0) {
      return playerDuration;
    }
    return video?.duration || 0;
  };

  const parseTimestampToSeconds = (value: string): number | null => {
    const parts = value.split(":").map((v) => Number(v));
    if (parts.some((v) => Number.isNaN(v))) return null;

    if (parts.length === 2) {
      const [mm, ss] = parts;
      return mm * 60 + ss;
    }

    if (parts.length === 3) {
      const [hh, mm, ss] = parts;
      return hh * 3600 + mm * 60 + ss;
    }

    return null;
  };

  const extractDescriptionTimestamps = (description: string, durationSeconds: number): Keyframe[] => {
    const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
    const matches: Keyframe[] = [];

    // Pass 1: Parse common line-based chapter formats.
    for (const line of lines) {
      // Format A: 00:00 Intro
      const startMatch = line.match(/^((?:\d{1,2}:)?\d{1,2}:\d{2})\s*(?:[-–—|]\s*)?(.*)$/);
      if (startMatch) {
        const seconds = parseTimestampToSeconds(startMatch[1]);
        if (seconds !== null && seconds >= 0 && (durationSeconds <= 0 || seconds <= durationSeconds)) {
          matches.push({
            time: seconds,
            label: (startMatch[2] || "").trim()
          });
        }
        continue;
      }

      // Format B: Intro: 00:00
      const endMatch = line.match(/^(.*?)(?:\s*[-–—|:]\s*)?((?:\d{1,2}:)?\d{1,2}:\d{2})$/);
      if (endMatch) {
        const seconds = parseTimestampToSeconds(endMatch[2]);
        if (seconds !== null && seconds >= 0 && (durationSeconds <= 0 || seconds <= durationSeconds)) {
          matches.push({
            time: seconds,
            label: (endMatch[1] || "").trim()
          });
        }
      }
    }

    // Pass 2: Handle dense single-line chapter blocks (many labels + timestamps inline).
    if (matches.length < 2) {
      const timeRegex = /((?:\d{1,2}:)?\d{1,2}:\d{2})/g;
      const all = Array.from(description.matchAll(timeRegex));

      if (all.length >= 2) {
        let previousEnd = 0;
        const inlineMatches: Keyframe[] = [];

        for (let i = 0; i < all.length; i++) {
          const token = all[i][1];
          const startIndex = all[i].index ?? 0;
          const endIndex = startIndex + token.length;

          const seconds = parseTimestampToSeconds(token);
          if (seconds === null || seconds < 0 || (durationSeconds > 0 && seconds > durationSeconds)) {
            previousEnd = endIndex;
            continue;
          }

          // Label usually appears before the timestamp in this format.
          let label = description
            .slice(previousEnd, startIndex)
            .replace(/^[\s\-–—|:,.]+|[\s\-–—|:,.]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();

          // If timestamp-first format appears inline, pull a short tail after timestamp.
          if (!label) {
            const nextStart = (all[i + 1]?.index ?? description.length);
            label = description
              .slice(endIndex, nextStart)
              .replace(/^[\s\-–—|:,.]+|[\s\-–—|:,.]+$/g, "")
              .replace(/\s+/g, " ")
              .trim();
          }

          inlineMatches.push({ time: seconds, label });
          previousEnd = endIndex;
        }

        if (inlineMatches.length > matches.length) {
          matches.splice(0, matches.length, ...inlineMatches);
        }
      }
    }

    const deduped = Array.from(new Map(matches.map((m) => [m.time, m])).values())
      .sort((a, b) => a.time - b.time);

    return deduped;
  };

  // 1. Fetch Basic Data
  useEffect(() => {
    if (videoId) {
      setPlayerDuration(null);
      setPendingResumeSeconds(0);
      fetchVideoData();
      fetchNotes();
      fetchInteraction();
      fetchProgress();
      incrementViewCount();
    }
  }, [videoId]);

  // 2. Load YouTube API
  useEffect(() => {
    if (!video) return;

    const loadYoutubeApi = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
        return;
      }

      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    };

    const initPlayer = () => {
      const ytId = extractYoutubeId(video.url);
      if (!ytId) {
        setPlayerError("Invalid YouTube URL");
        return;
      }

      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: ytId,
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
          enablejsapi: 1
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    };

    const onPlayerReady = (event: any) => {
      setIsPlayerReady(true);
      const duration = event?.target?.getDuration?.();
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        const normalized = Math.floor(duration);
        setPlayerDuration((prev) => (prev === normalized ? prev : normalized));
      }

      if (pendingResumeSeconds > 0) {
        event?.target?.seekTo?.(pendingResumeSeconds, true);
        setCurrentTime(pendingResumeSeconds);
        const effective = Math.max(duration || 0, getEffectiveDuration());
        if (effective > 0) {
          setProgress((pendingResumeSeconds / effective) * 100);
        }
      }
      fetchYoutubeMetadata();
    };

    const onPlayerStateChange = (event: any) => {
      if (event.data === window.YT.PlayerState.PLAYING) {
        setIsPaused(false);
        startPollingProgress();
      } else {
        if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPaused(true);
        }
        stopPollingProgress();
      }
    };

    const onPlayerError = (event: any) => {
      let errorMsg = "Failed to load video (Error: " + event.data + ")";
      
      if (event.data === 150 || event.data === 101) {
          errorMsg = "This video has playback restrictions. It might be limited by the creator, age-restricted, or require you to be signed into YouTube in your browser profile.";
      } else if (event.data === 2) {
          errorMsg = "Invalid video ID or the video has been deleted.";
      } else if (event.data === 5) {
          errorMsg = "The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred.";
      } else if (event.data === 100) {
          errorMsg = "The video requested was not found. This occurs when a video has been removed (for any reason) or has been marked as private.";
      }
      
      setPlayerError(errorMsg);
    };

    loadYoutubeApi();

    return () => {
        stopPollingProgress();
        if (playerRef.current) {
            playerRef.current.destroy();
        }
    };
  }, [video]);

  const fetchYoutubeMetadata = async () => {
    const ytId = video ? extractYoutubeId(video.url) : null;
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!ytId || !apiKey) return;

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ytId}&key=${apiKey}`);
      const data = await response.json();
      if (data.items?.[0]) {
          console.log("Fetched YouTube metadata:", data.items[0].snippet);
          // We could update state here if we want to show real titles/descriptions
      }
    } catch (error) {
      console.error("Error fetching YouTube metadata:", error);
    }
  };

  // Extract ID
  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const findEmbeddableAlternative = async (seedQuery: string, topic?: string): Promise<Video | null> => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) return null;

    const query = `${seedQuery} ${topic || ""} tutorial course lecture`;
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=8&order=relevance&key=${apiKey}`
    );
    const searchData = await searchRes.json();
    const ids = (searchData?.items || []).map((item: any) => item?.id?.videoId).filter(Boolean);
    if (!ids.length) return null;

    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${ids.join(",")}&key=${apiKey}`
    );
    const detailsData = await detailsRes.json();
    const detailItems = detailsData?.items || [];

    const firstEmbeddable = detailItems.find((item: any) => item?.status?.embeddable !== false);
    if (!firstEmbeddable) return null;

    return {
      id: firstEmbeddable.id,
      title: firstEmbeddable?.snippet?.title || "Recommended Study Video",
      description: firstEmbeddable?.snippet?.description || "Embeddable alternative selected for uninterrupted study.",
      url: `https://www.youtube.com/watch?v=${firstEmbeddable.id}`,
      thumbnail_url:
        firstEmbeddable?.snippet?.thumbnails?.maxres?.url ||
        firstEmbeddable?.snippet?.thumbnails?.high?.url ||
        `https://img.youtube.com/vi/${firstEmbeddable.id}/hqdefault.jpg`,
      duration: parseIsoDurationToSeconds(firstEmbeddable?.contentDetails?.duration || "PT0S"),
      topic: topic || "External Study",
      difficulty: "various",
      tags: firstEmbeddable?.snippet?.tags || [],
      views_count: parseInt(firstEmbeddable?.statistics?.viewCount || "0", 10),
      likes_count: parseInt(firstEmbeddable?.statistics?.likeCount || "0", 10),
    };
  };

  const ensureEmbeddableVideo = async (candidate: Video): Promise<{ video: Video; replaced: boolean }> => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const ytId = extractYoutubeId(candidate.url || "");
    if (!apiKey || !ytId) return { video: candidate, replaced: false };

    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${ytId}&key=${apiKey}`
      );
      const data = await res.json();
      const embeddable = data?.items?.[0]?.status?.embeddable !== false;
      if (embeddable) return { video: candidate, replaced: false };

      const replacement = await findEmbeddableAlternative(candidate.title, candidate.topic);
      if (!replacement) return { video: candidate, replaced: false };

      return { video: replacement, replaced: true };
    } catch {
      return { video: candidate, replaced: false };
    }
  };

  const startPollingProgress = () => {
    if (progressIntervalRef.current) return;
    progressIntervalRef.current = window.setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
            const time = playerRef.current.getCurrentTime();
            const duration = getEffectiveDuration();

            if (duration > 0) {
              const normalized = Math.floor(duration);
              setPlayerDuration((prev) => (prev === normalized ? prev : normalized));
            }

            setCurrentTime(time);
            if (duration > 0) {
                setProgress((time / duration) * 100);
            }
        }
    }, 1000);
  };

  const stopPollingProgress = () => {
    if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    }
  };

  // Sync with DB every 5 seconds (only when playing)
  useEffect(() => {
    // Only sync if it's a Supabase video (UUID), not an external YouTube ID (11 chars)
    const isSupabaseVideo = videoId && videoId.length !== 11;
    if (!video || !videoId || isPaused || !isPlayerReady || !isSupabaseVideo) return;

    const interval = setInterval(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const isCompleted = progress >= 90;
            await supabase
              .from('video_progress')
              .upsert({
                user_id: user.id,
                video_id: videoId,
                progress_seconds: Math.floor(currentTime),
                completed: isCompleted
              }, { onConflict: 'user_id,video_id' });
        } catch (error) {
            console.error('Error updating progress sync:', error);
        }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, isPlayerReady, currentTime, video, videoId]);

  // AI & Init Messages
  useEffect(() => {
    if (video) {
        if (messages.length === 0) {
            setMessages([
              { role: 'tutor', content: `Hello! I'm your AI Tutor for "${video.title}". I'm now synchronized with your playback. Pause anytime for deep-dive actions or use timestamps on your timeline!` }
            ]);
          }
      if (!summary && !generatingSummary) {
        generateVideoSummary();
      }
    }
  }, [video]);

  useEffect(() => {
    if (!video) return;

    const duration = getEffectiveDuration();
    if (duration <= 0) return;

    const descriptionTimestamps = extractDescriptionTimestamps(video.description || "", duration);
    if (descriptionTimestamps.length > 0) {
      setTimestampSource("description-chapters");
      setKeyframes(descriptionTimestamps);
      return;
    }

    const checkpointCount = Math.max(4, Math.min(8, keyPoints.length || 5));
    const interval = duration / (checkpointCount + 1);
    const autoTimestamps: Keyframe[] = Array.from({ length: checkpointCount }, (_, i) => ({
      time: Math.floor(interval * (i + 1)),
      label: keyPoints[i] || ""
    }));
    setTimestampSource("ai-checkpoints");
    setKeyframes(autoTimestamps);
  }, [video, playerDuration, keyPoints]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateVideoSummary = async () => {
    if (!video) return;
    setGeneratingSummary(true);

    const buildFallbackSummary = () => {
      const cleaned = (video.description || "").replace(/\s+/g, " ").trim();
      const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
      const fallbackSummary = sentences.slice(0, 2).join(" ") || `This lesson covers ${video.title} and introduces key concepts with practical context.`;

      const fallbackPoints = [
        `Core concept: ${video.title}`,
        `Main topic: ${video.topic || "General"}`,
        "Identify the most important terms and definitions while watching.",
        "Pause at key moments and explain the idea in your own words.",
        "Review and summarize what to apply in practice."
      ];

      return { fallbackSummary, fallbackPoints };
    };

    const parseSummaryPayload = (raw: string) => {
      const cleanText = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed?.summary) return null;

      return {
        summary: String(parsed.summary),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map((p: unknown) => String(p)).slice(0, 5)
          : []
      };
    };

    try {
      const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!geminiApiKey) {
        const { fallbackSummary, fallbackPoints } = buildFallbackSummary();
        setSummary(fallbackSummary);
        setKeyPoints(fallbackPoints);
        return;
      }

      // Prefer currently supported fast models; avoid deprecated/unsupported IDs.
      const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
      const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `
        You are an educational assistant. Provide a concise summary and exactly 5 key takeaways for the following educational video:
        Title: ${video.title}
        Description: ${video.description}
        Return JSON structure: { "summary": string, "keyPoints": string[] }
      `;

      let data: { summary: string; keyPoints: string[] } | null = null;
      let quotaBlocked = false;

      for (const modelName of MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (import.meta.env.DEV) {
              console.log(`Video Summary attempting with model: ${modelName} (Attempt ${attempt + 1})`);
            }
            const response = await genAI.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });

            const rawText =
              typeof (response as any)?.text === "string"
                ? (response as any).text
                : typeof (response as any)?.text === "function"
                  ? (response as any).text()
                  : (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text || "";

            data = parseSummaryPayload(String(rawText));
            if (data?.summary) break;
          } catch (modelError: any) {
            const msg = modelError?.message || "";
            if (import.meta.env.DEV) {
              console.warn(`Summary failed with ${modelName}:`, msg);
            }

            // Unsupported model ID: skip to next model immediately.
            if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("is not found")) {
              break;
            }

            // Quota/rate limit: do not keep spamming retries; switch to fallback.
            if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.toLowerCase().includes("quota")) {
              quotaBlocked = true;
              break;
            }

            break;
          }
        }
        if (data?.summary || quotaBlocked) break;
      }

      if (!data?.summary) {
        const { fallbackSummary, fallbackPoints } = buildFallbackSummary();
        setSummary(fallbackSummary);
        setKeyPoints(fallbackPoints);

        if (quotaBlocked) {
          toast({
            title: "AI summary limit reached",
            description: "Showing a smart fallback summary for now."
          });
        }
        return;
      }

      const generatedSummary = data.summary;
      setSummary(generatedSummary);
      setKeyPoints((data.keyPoints || []).slice(0, 5));
      
      // Proactively share summary in tutor chat
      setMessages(prev => [...prev, { 
          role: 'ai', 
          content: `I've analyzed the video! Here's a quick summary:\n\n${generatedSummary}` 
      }]);
    } catch (error) {
      console.error("Error generating summary:", error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const userMsg = typeof e === 'string' ? e : chatInput;
    if (!userMsg?.trim() || isTutorTyping || !video) return;
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    if (typeof e !== 'string') setChatInput("");
    setIsTutorTyping(true);
    try {
      const pseudoCourse: AICourseDetails = {
        title: video.title,
        description: video.description,
        topic: video.topic,
        difficulty: video.difficulty,
        duration: `${Math.ceil(video.duration / 60)} mins`,
        learningGoal: summary || video.description,
        modules: [{
          id: 'module-1',
          title: video.title,
          description: video.description,
          content: video.description,
          durationMinutes: video.duration / 60,
          lessons: [{ id: 'lesson-1', title: video.title, durationMinutes: video.duration / 60, explanation: video.description, keyPoints: keyPoints }],
          resources: []
        }]
      };
      const response = await askCourseTutor(userMsg, pseudoCourse);
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (e) {
      toast({ title: "Error", description: "Tutor connection failed.", variant: "destructive" });
    } finally {
      setIsTutorTyping(false);
    }
  };

  const fetchVideoData = async () => {
    if (!videoId) return;

    // Check if it's a Supabase UUID or a direct YouTube ID (11 chars)
    const isYoutubeId = videoId.length === 11;

    if (isYoutubeId) {
        console.log("External YouTube ID detected, fetching metadata from API...");
        const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
        if (!apiKey) {
        const fallbackVideo: Video = {
                id: videoId,
                title: "External Video",
                description: "Study session started from search.",
                url: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                duration: 600, // Default 10 mins if unknown
                topic: "General",
                difficulty: "intermediate",
                tags: [],
                views_count: 0,
                likes_count: 0
        };
        setVideo(fallbackVideo);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`);
            const data = await response.json();
            
            if (data.items?.[0]) {
                const item = data.items[0];
                // Convert ISO 8601 duration (PT#M#S) to seconds
                const durationMatch = item.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                const hours = parseInt(durationMatch[1] || '0');
                const minutes = parseInt(durationMatch[2] || '0');
                const seconds = parseInt(durationMatch[3] || '0');
                const durationSeconds = (hours * 3600) + (minutes * 60) + seconds;

              const fetchedVideo: Video = {
                    id: videoId,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    thumbnail_url: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url,
                    duration: durationSeconds,
                    topic: "External Study",
                    difficulty: "various",
                    tags: item.snippet.tags || [],
                    views_count: parseInt(item.statistics.viewCount || '0'),
                    likes_count: parseInt(item.statistics.likeCount || '0')
                };

                const { video: playable, replaced } = await ensureEmbeddableVideo(fetchedVideo);
                setVideo(playable);

                if (replaced) {
                  toast({
                    title: "Switched to playable video",
                    description: "The original video has playback restrictions, so we loaded a working alternative."
                  });
                  if (playable.id !== videoId) {
                    navigate(`/video/${playable.id}`, { replace: true });
                  }
                }
            }
        } catch (error) {
            console.error("Error fetching external video:", error);
        } finally {
            setLoading(false);
        }
        return;
    }

    try {
      const { data, error } = await supabase.from("videos").select("*").eq("id", videoId).single();
      if (error) throw error;
      const { video: playable, replaced } = await ensureEmbeddableVideo(data as Video);
      setVideo(playable);

      if (replaced) {
        toast({
          title: "Switched to playable video",
          description: "This item had embed restrictions, so we replaced it with a playable alternative."
        });
        if (playable.id !== videoId) {
          navigate(`/video/${playable.id}`, { replace: true });
        }
      }
    } catch (error) {
      console.error("Error fetching video:", error);
      toast({ title: "Error", description: "Failed to load video", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("video_notes").select("*").eq("video_id", videoId).eq("user_id", user.id).order("timestamp_seconds", { ascending: true });
      setNotes(data || []);
    } catch (error) { console.error("Error fetching notes:", error); }
  };

  const fetchInteraction = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("video_interactions").select("*").eq("video_id", videoId).eq("user_id", user.id).maybeSingle();
      if (data) setInteraction({ liked: data.liked, saved: data.saved, rating: data.rating });
    } catch (error) { console.error("Error fetching interaction:", error); }
  };

  const fetchProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("video_progress").select("*").eq("video_id", videoId).eq("user_id", user.id).maybeSingle();
      const duration = getEffectiveDuration();
      if (data && duration > 0) {
        const progressPercent = (data.progress_seconds / duration) * 100;
        setProgress(progressPercent);
        setCurrentTime(data.progress_seconds);
        setPendingResumeSeconds(data.progress_seconds);
      } else if (data) {
        setPendingResumeSeconds(data.progress_seconds);
      }
    } catch (error) { console.error("Error fetching progress:", error); }
  };

  useEffect(() => {
    if (video) {
      fetchProgress();
    }
  }, [video, playerDuration]);

  const incrementViewCount = async () => {
    try {
      if (!video) return;
      await supabase.from("videos").update({ views_count: video.views_count + 1 }).eq("id", videoId);
    } catch (error) { console.error("Error incrementing views:", error); }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const newSavedState = !interaction.saved;

      const updateLocalSavedVideos = (isSaved: boolean) => {
        if (!video) return;
        try {
          const raw = localStorage.getItem(LOCAL_SAVED_VIDEOS_KEY);
          const parsed = raw ? (JSON.parse(raw) as Video[]) : [];
          const deduped = new Map(parsed.map((v) => [v.id, v]));

          if (isSaved) {
            deduped.set(video.id, {
              ...video,
              duration: Math.max(1, Math.floor(video.duration || 0)),
              tags: Array.isArray(video.tags) ? video.tags : [],
            });
          } else {
            deduped.delete(video.id);
          }

          localStorage.setItem(LOCAL_SAVED_VIDEOS_KEY, JSON.stringify(Array.from(deduped.values())));
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn("Failed to persist local saved videos", e);
          }
        }
      };

      if (video) {
        // Ensure the video exists in videos table so interaction FK works for external YouTube items.
        const { error: videoUpsertError } = await supabase.from("videos").upsert({
          id: video.id,
          title: video.title,
          description: video.description,
          url: video.url,
          thumbnail_url: video.thumbnail_url,
          duration: Math.max(1, Math.floor(video.duration || 0)),
          topic: video.topic,
          difficulty: video.difficulty,
          tags: video.tags,
          views_count: video.views_count,
          likes_count: video.likes_count,
        });
        if (videoUpsertError) {
          console.error("Error ensuring video row for bookmark:", videoUpsertError);
        }
      }

      await supabase.from("video_interactions").upsert({ user_id: user.id, video_id: videoId, liked: false, saved: newSavedState }, { onConflict: 'user_id,video_id' });
      setInteraction({ ...interaction, saved: newSavedState });
      updateLocalSavedVideos(newSavedState);
      toast({ title: newSavedState ? "Bookmarked!" : "Bookmark removed" });
    } catch (error) { console.error("Error toggling save:", error); }
  };

  const handleAddNote = async (overrideText?: string, overrideTime?: number) => {
    const text = overrideText || newNote;
    if (!text.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("video_notes").insert({ user_id: user.id, video_id: videoId, timestamp_seconds: overrideTime !== undefined ? overrideTime : Math.floor(currentTime), note_text: text, is_bookmark: false });
      setNewNote("");
      setShowNoteInput(false);
      fetchNotes();
      toast({ title: "Note added!" });
    } catch (error) { console.error("Error adding note:", error); }
  };

  const handleAddBookmark = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("video_notes").insert({ user_id: user.id, video_id: videoId, timestamp_seconds: Math.floor(currentTime), note_text: "Bookmark", is_bookmark: true });
      fetchNotes();
      toast({ title: "Bookmark added!" });
    } catch (error) { console.error("Error adding bookmark:", error); }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const jumpToTime = (seconds: number) => {
      if (playerRef.current && playerRef.current.seekTo) {
          playerRef.current.seekTo(seconds, true);
          setCurrentTime(seconds);
          const duration = getEffectiveDuration();
          if (duration > 0) {
            setProgress((seconds / duration) * 100);
          }
          toast({ title: `Jumped to ${formatTime(seconds)}` });
      }
  };

  if (loading || !video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background transition-colors duration-700", isFocusMode && "bg-black/95")}>
      
      {isFocusMode && <div className="focus-tint" />}

      {/* Header */}
      <header className={cn(
          "sticky top-0 z-[50] w-full border-b border-white/5 backdrop-blur-xl shrink-0 transition-opacity duration-500",
          isFocusMode && "opacity-20 hover:opacity-100"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/videos")} className="rounded-full hover:bg-white/5">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-lg font-bold leading-none truncate max-w-[200px] md:max-w-md">{video.title}</h2>
              <div className="text-xs text-muted-foreground mt-1 tracking-wide flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] h-4 py-0">{video.topic}</Badge>
                  <span>{video.difficulty}</span>
                  {isPlayerReady && <Badge variant="outline" className="text-[9px] h-4 border-green-500/30 text-green-500 bg-green-500/5">Live Sync</Badge>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end gap-1 w-48">
                <div className="flex justify-between w-full text-[10px] font-bold tracking-tighter uppercase text-muted-foreground">
                    <span>Study Session</span>
                    <span className="text-primary">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5 w-full bg-white/5" />
            </div>
            <Button
              variant={interaction.saved ? "primary" : "outline"}
              size="sm"
              onClick={handleSave}
              className={cn(
                "gap-2 rounded-full px-4 h-9",
                interaction.saved && "shadow-glow"
              )}
            >
              <Bookmark className={cn("h-4 w-4", interaction.saved && "fill-current")} />
              <span className="text-xs font-bold uppercase tracking-wider">{interaction.saved ? "Bookmarked" : "Bookmark"}</span>
            </Button>
            <Button 
                variant={isFocusMode ? "primary" : "outline"} 
                size="sm" 
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={cn("gap-2 rounded-full px-4 h-9", isFocusMode && "bg-primary shadow-glow")}
            >
                {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="text-xs font-bold uppercase tracking-wider">{isFocusMode ? "Exit Focus" : "Focus Mode"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 relative z-[45]">
        <div className={cn(
            "grid grid-cols-1 lg:grid-cols-12 gap-8 transition-all duration-700",
            isFocusMode ? "h-[calc(100vh-10rem)] scale-[1.02]" : "h-[calc(100vh-8rem)]"
        )}>
          {/* Main Video Section */}
          <div className="lg:col-span-8 space-y-6 overflow-y-auto pr-2 custom-scrollbar no-scrollbar-md">
            
            <div className={cn(
                "group relative border border-white/5 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500",
                isFocusMode ? "study-spotlight scale-[1.01]" : "bg-black"
            )}>
              <div className="aspect-video bg-black relative">
                
                {/* YOUTUBE PLAYER TARGET */}
                <div id="youtube-player" className="w-full h-full" />
                
                {playerError && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                        <h3 className="text-xl font-bold mb-2">Playback Optimization Needed</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mb-6">{playerError}</p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Button onClick={() => window.location.reload()} variant="outline" className="gap-2 rounded-xl">
                                <RefreshCw className="h-4 w-4" />
                                Retry Loading
                            </Button>
                            <Button 
                                onClick={() => window.open(video.url, '_blank')} 
                                variant="primary" 
                                className="gap-2 rounded-xl shadow-glow"
                            >
                                <Play className="h-4 w-4" />
                                Watch on YouTube
                            </Button>
                        </div>
                    </div>
                )}

                {/* Pause Overlay Action */}
                {isPlayerReady && (
                  <div className="absolute inset-x-0 bottom-4 flex justify-end px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Button 
                            variant="secondary" 
                      size="sm" 
                      className="rounded-full gap-2 shadow-xl border border-white/10 pointer-events-auto bg-black/70 hover:bg-black/80 text-white"
                            onClick={() => {
                                if (playerRef.current) {
                                    if (isPaused) playerRef.current.playVideo();
                                    else playerRef.current.pauseVideo();
                                }
                            }}
                        >
                      <Zap className="h-4 w-4 text-primary" />
                      {isPaused ? "Resume & Sync" : "Quick Actions"}
                        </Button>
                    </div>
                )}

                {isPaused && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 right-4 rounded-full text-white/50 hover:text-white"
                            onClick={() => playerRef.current?.playVideo()}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                        <div className="text-center space-y-2 mb-8">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Study Quick Actions</h3>
                            <p className="text-muted-foreground text-sm">Paused at {formatTime(currentTime)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl bg-white/5 border-white/10 hover:bg-primary/10 hover:border-primary/30" onClick={() => { handleSendMessage(`Can you explain what's happening at ${formatTime(currentTime)} in this video?`); playerRef.current?.playVideo(); }}>
                                <Bot className="h-6 w-6 text-primary" />
                                <span className="text-xs font-bold uppercase tracking-widest">Explain moment</span>
                            </Button>
                            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl bg-white/5 border-white/10 hover:bg-primary/10 hover:border-primary/30" onClick={() => { handleAddNote("Key Insight from pause", currentTime); playerRef.current?.playVideo(); }}>
                                <Zap className="h-6 w-6 text-yellow-500" />
                                <span className="text-xs font-bold uppercase tracking-widest">Capture Insight</span>
                            </Button>
                            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl bg-white/5 border-white/10 hover:bg-primary/10 hover:border-primary/30" onClick={() => { handleSendMessage(`Provide a technical deep dive into the current topic.`); playerRef.current?.playVideo(); }}>
                                <Layers className="h-6 w-6 text-purple-500" />
                                <span className="text-xs font-bold uppercase tracking-widest">Deep Dive</span>
                            </Button>
                            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl bg-white/5 border-white/10 hover:bg-primary/10 hover:border-primary/30" onClick={() => playerRef.current?.playVideo()}>
                                <Play className="h-6 w-6 text-white" />
                                <span className="text-xs font-bold uppercase tracking-widest">Resume</span>
                            </Button>
                        </div>
                    </div>
                )}
              </div>

              {/* Progress & Timestamp Timeline */}
              <div className="px-6 py-4 bg-black/40 backdrop-blur-md border-t border-white/5 space-y-3">
                  <div className="relative h-6 flex items-center">
                      <Progress value={progress} className="h-1.5 w-full bg-white/10" />
                      {keyframes.map((kf, i) => (
                          <div key={i} className="absolute top-1/2 -translate-y-1/2 group/kf pointer-events-auto cursor-pointer" style={{ left: `${(kf.time / Math.max(getEffectiveDuration(), 1)) * 100}%` }} onClick={() => jumpToTime(kf.time)}>
                              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse-subtle" />
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border border-white/10 opacity-0 group-hover/kf:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-50">{kf.label || formatTime(kf.time)}</div>
                          </div>
                      ))}
                  </div>
                  <div className="flex justify-between items-center">
                         <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{formatTime(currentTime)} / {formatTime(getEffectiveDuration())}</span>
                       <div />
                  </div>
              </div>
            </div>

            <Card className="border-white/5 bg-white/5 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-white/5 p-1 rounded-none border-b border-white/5 h-12">
                    <TabsTrigger value="summary" className="data-[state=active]:bg-primary/10 gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" />AI Summary</TabsTrigger>
                    <TabsTrigger value="takeaways" className="data-[state=active]:bg-primary/10 gap-2"><Clock className="h-3.5 w-3.5 text-primary" />Timestamps</TabsTrigger>
                    <TabsTrigger value="details" className="data-[state=active]:bg-primary/10 gap-2"><Info className="h-3.5 w-3.5 text-primary" />Details</TabsTrigger>
                  </TabsList>
                  <ScrollArea className="h-64">
                    <TabsContent value="summary" className="p-6 m-0 outline-none animate-in slide-in-from-bottom-2">
                        <div className="text-sm leading-relaxed text-foreground/80 font-medium">{summary || "Generating overview..."}</div>
                    </TabsContent>
                    <TabsContent value="takeaways" className="p-6 m-0 outline-none animate-in slide-in-from-bottom-2">
                         <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                           Source: {timestampSource === "description-chapters" ? "Description Chapters" : "AI Checkpoints"}
                         </div>
                         <div className="grid gap-3">
                             {keyframes.map((kf, i) => (
                                 <div key={i} className="group flex gap-4 p-3 rounded-xl border border-white/5 bg-white/5 hover:border-primary/20 hover:bg-primary/5 cursor-pointer transition-all" onClick={() => jumpToTime(kf.time)}>
                                     <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-primary group-hover:scale-110 transition-transform">{i + 1}</div>
                                     <div className="space-y-1">
                                         <span className="text-[10px] font-bold text-primary opacity-60 uppercase">{formatTime(kf.time)} TIMESTAMP</span>
                                         <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{kf.label || `Jump to ${formatTime(kf.time)}`}</p>
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </TabsContent>
                    <TabsContent value="details" className="p-6 m-0 outline-none animate-in slide-in-from-bottom-2">
                         <div className="text-sm text-muted-foreground leading-relaxed italic">{video.description}</div>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
            </Card>

            <div className="relative group">
                {!showNoteInput ? (
                    <Button variant="ghost" className="w-full flex items-center justify-center gap-2 h-14 border border-dashed border-white/10 rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all" onClick={() => setShowNoteInput(true)}>
                        <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                        <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground">Take synchronization note at {formatTime(currentTime)}</span>
                    </Button>
                ) : (
                    <Card className="p-4 bg-muted/30 border-primary/20 rounded-2xl animate-in slide-in-from-top-2">
                        <Textarea placeholder="Jot down a key insight..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="bg-transparent border-none focus-visible:ring-0 text-sm mb-4 min-h-[80px]" />
                        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setShowNoteInput(false)}>Dismiss</Button><Button size="sm" onClick={() => handleAddNote()}>Save Insight</Button></div>
                    </Card>
                )}
            </div>
          </div>

          {/* AI Tutor Sidebar */}
          <div className={cn("lg:col-span-4 flex flex-col h-full glass-sidebar rounded-3xl overflow-hidden transition-all duration-700", isFocusMode ? "study-spotlight scale-[1.03]" : "shadow-lg border border-white/5")}>
            <div className="p-6 border-b border-white/5 bg-primary/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2.5 rounded-xl"><Bot className={cn("h-6 w-6 text-primary", isTutorTyping && "animate-pulse")} /></div>
                    <div>
                        <h3 className="font-extrabold text-sm uppercase tracking-widest text-primary">Edu-Sync Tutor</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className={cn("h-1.5 w-1.5 rounded-full", isPlayerReady ? "bg-green-500 animate-pulse" : "bg-yellow-500")} />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{isPlayerReady ? "Synced with Playback" : "Syncing Player..."}</span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn("max-w-[88%] flex gap-3", m.role === 'user' ? 'flex-row-reverse' : '')}>
                      <div className={cn("mt-1 shrink-0 h-8 w-8 rounded-xl flex items-center justify-center shadow-sm", m.role === 'user' ? 'bg-secondary' : 'bg-primary/20 border border-primary/20')}>
                        {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                      </div>
                      <div className={cn("px-4 py-3 rounded-2xl text-sm leading-relaxed", m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none shadow-glow' : 'bg-white/5 backdrop-blur-md rounded-tl-none border border-white/5')}>{m.content}</div>
                    </div>
                  </div>
                ))}
                {isTutorTyping && (<div className="flex justify-start"><div className="bg-white/5 px-5 py-3 rounded-2xl rounded-tl-none border border-white/5"><div className="flex gap-1.5"><span className="h-2 w-2 bg-primary/50 rounded-full animate-bounce" /><span className="h-2 w-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.2s]" /><span className="h-2 w-2 bg-primary/50 rounded-full animate-bounce [animation-delay:0.4s]" /></div></div></div>)}
                <div ref={chatScrollRef} />
              </div>
            </ScrollArea>
            <div className="p-6 bg-white/5 border-t border-white/5">
              <form onSubmit={handleSendMessage} className="relative">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask your synced tutor..." className="pr-12 h-12 bg-black/40 border-white/10 rounded-2xl focus-visible:ring-primary/50" disabled={isTutorTyping} />
                <Button type="submit" size="icon" variant="ghost" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 text-primary hover:text-primary hover:bg-primary/10 rounded-xl" disabled={!chatInput.trim() || isTutorTyping}><Send className="h-5 w-5" /></Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
