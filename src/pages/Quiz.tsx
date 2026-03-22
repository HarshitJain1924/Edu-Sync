import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain, CheckCircle2, XCircle, Trophy, RotateCw, Clock,
  Sparkles, ChevronLeft, ChevronRight, Heart, Shuffle, Layers,
  Zap, Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleGenAI } from "@google/genai";
import AppSidebar from "@/components/AppSidebar";

// ─── Interfaces ────────────────────────────────────────────────────
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  order_index: number;
}

interface QuizSet {
  id: string;
  title: string;
  description: string | null;
  topic: string;
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  order_index: number;
}

interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  topic: string;
}

type CardStatus = "unknown" | "learning" | "mastered";
type HubMode = "quiz" | "flashcards";

type GeneratedQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

const QUICK_AI_TOPICS = [
  "Data Structures & Algorithms",
  "Operating Systems",
  "DBMS and SQL",
  "Computer Networks",
  "OOPs and Java",
  "Quantitative Aptitude",
];

// ─── Component ─────────────────────────────────────────────────────
const Quiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Hub state
  const [hubMode, setHubMode] = useState<HubMode>("quiz");

  // Quiz state
  const [role, setRole] = useState<string>("student");
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<QuizSet | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Flashcard state
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [selectedFlashSet, setSelectedFlashSet] = useState<FlashcardSet | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashIndex, setFlashIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStatuses, setCardStatuses] = useState<Map<number, CardStatus>>(new Map());
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [flashLoading, setFlashLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [flashAiTopic, setFlashAiTopic] = useState("");
  const [flashAiLoading, setFlashAiLoading] = useState(false);

  // ─── Effects ───────────────────────────────────────────────────
  useEffect(() => {
    fetchQuizSets();
    fetchFlashcardSets();
    checkRole();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (selectedSet && !showResults && startTime) {
      interval = setInterval(() => setTimer(Math.floor((Date.now() - startTime) / 1000)), 1000);
    }
    return () => clearInterval(interval);
  }, [selectedSet, showResults, startTime]);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (data?.role) {
        setRole(data.role);
        setIsTeacher(data.role === "teacher" || data.role === "admin");
      }
    }
  };

  // ─── Quiz Logic ────────────────────────────────────────────────
  const fetchQuizSets = async () => {
    try {
      const { data, error } = await supabase.from("quiz_sets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const sets = data || [];
      if (sets.length === 0) { setQuizSets([]); return; }
      const { data: linkedQuestions } = await supabase.from("quiz_questions").select("quiz_id").in("quiz_id", sets.map((s) => s.id));
      const validSetIds = new Set((linkedQuestions || []).map((q) => q.quiz_id));
      setQuizSets(sets.filter((s) => validSetIds.has(s.id)));
    } catch { toast({ title: "Error", description: "Failed to load quiz sets", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const fetchQuestions = async (quizId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("order_index");
      if (error) throw error;
      const mapped = (data || []).map(q => ({ ...q, options: Array.isArray(q.options) ? q.options as string[] : [] }));
      if (mapped.length === 0) { toast({ title: "Quiz unavailable", description: "No questions yet.", variant: "destructive" }); setSelectedSet(null); return; }
      setQuestions(mapped); setCurrentIndex(0); setSelectedAnswer(null); setShowFeedback(false); setCorrectAnswers(0); setShowResults(false); setStartTime(Date.now()); setTimer(0);
    } catch { toast({ title: "Error", description: "Failed to load questions", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleSetSelect = (set: QuizSet) => { setSelectedSet(set); fetchQuestions(set.id); };

  const generateAiQuiz = async (topicOverride?: string) => {
    const topic = (topicOverride ?? aiTopic).trim();
    if (!topic) { toast({ title: "Missing topic", description: "Enter a topic.", variant: "destructive" }); return; }
    try {
      setAiLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in first.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in first.");
      let generatedQuestions: GeneratedQuestion[] = [];
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-quiz`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ topic, numQuestions: 10 }) });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed");
        generatedQuestions = (payload?.questions || []) as GeneratedQuestion[];
      } catch {
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiKey) throw new Error("AI unavailable.");
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const prompt = `Generate 10 placement-focused MCQs on "${topic}". Return ONLY valid JSON: [{"question":"...","options":["A","B","C","D"],"correctAnswer":"exact option"}]. No markdown.`;
        const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        const raw = (result as any).text || result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const clean = String(raw).replace(/```json/g, "").replace(/```/g, "").trim();
        const match = clean.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("Invalid AI response.");
        generatedQuestions = JSON.parse(match[0]) as GeneratedQuestion[];
      }
      if (!generatedQuestions.length) throw new Error("No questions generated.");
      const { data: quizSet, error: quizError } = await supabase.from("quiz_sets").insert({ title: `${topic} - AI Practice`, description: "Student-generated with AI", topic, created_by: user.id }).select("id, title, description, topic").single();
      if (quizError) throw quizError;
      const inserts = generatedQuestions.map((q, idx) => ({ quiz_id: quizSet.id, question: q.question, options: q.options, correct_answer: q.correctAnswer, order_index: idx }));
      const { error: insertError } = await supabase.from("quiz_questions").insert(inserts);
      if (insertError) { await supabase.from("quiz_sets").delete().eq("id", quizSet.id); throw insertError; }
      setQuizSets((prev) => [quizSet, ...prev]); setAiTopic("");
      toast({ title: "AI quiz ready", description: `Generated ${generatedQuestions.length} questions on ${topic}.` });
      handleSetSelect(quizSet);
    } catch (error: any) { toast({ title: "Generation failed", description: error?.message || "Could not generate.", variant: "destructive" }); }
    finally { setAiLoading(false); }
  };

  const handleSubmitAnswer = () => { if (!selectedAnswer) return; setShowFeedback(true); if (selectedAnswer === questions[currentIndex].correct_answer) setCorrectAnswers((p) => p + 1); };

  const saveQuizResults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedSet) return;
      const scorePercentage = Math.round((correctAnswers / questions.length) * 100);
      await supabase.from("user_progress").upsert({ user_id: user.id, content_type: "quiz_set", content_id: selectedSet.id, progress_data: { score: scorePercentage, correct_answers: correctAnswers, total_questions: questions.length, time_taken: timer, completed_at: new Date().toISOString(), quiz_title: selectedSet.title, quiz_topic: selectedSet.topic }, updated_at: new Date().toISOString() }, { onConflict: "user_id,content_type,content_id" });
    } catch {}
  };

  const handleNext = () => { if (currentIndex < questions.length - 1) { setCurrentIndex(currentIndex + 1); setSelectedAnswer(null); setShowFeedback(false); } else { setShowResults(true); saveQuizResults(); } };
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── Flashcard Logic ───────────────────────────────────────────
  const fetchFlashcardSets = async () => {
    try {
      const { data, error } = await supabase.from("flashcard_sets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setFlashcardSets(data || []);
    } catch { toast({ title: "Error", description: "Failed to load flashcard sets", variant: "destructive" }); }
    finally { setFlashLoading(false); }
  };

  const fetchFlashcards = async (setId: string) => {
    try {
      setFlashLoading(true);
      const { data, error } = await supabase.from("flashcards").select("*").eq("set_id", setId).order("order_index", { ascending: true });
      if (error) throw error;
      setFlashcards(data || []); setFlashIndex(0); setIsFlipped(false); setCardStatuses(new Map()); setFavorites(new Set());
    } catch { toast({ title: "Error", description: "Failed to load flashcards", variant: "destructive" }); }
    finally { setFlashLoading(false); }
  };

  const handleFlashSetSelect = (set: FlashcardSet) => { setSelectedFlashSet(set); fetchFlashcards(set.id); };
  const handleFlip = () => setIsFlipped(!isFlipped);
  const handleKnown = () => { const m = new Map(cardStatuses); const c = m.get(flashIndex) || "unknown"; m.set(flashIndex, c === "learning" ? "mastered" : "learning"); setCardStatuses(m); if (flashIndex < flashcards.length - 1) { setFlashIndex(flashIndex + 1); setIsFlipped(false); } };
  const handleUnknown = () => { const m = new Map(cardStatuses); m.set(flashIndex, "unknown"); setCardStatuses(m); if (flashIndex < flashcards.length - 1) { setFlashIndex(flashIndex + 1); setIsFlipped(false); } };
  const handleFlashNext = () => { if (flashIndex < flashcards.length - 1) { setFlashIndex(flashIndex + 1); setIsFlipped(false); } };
  const handleFlashPrev = () => { if (flashIndex > 0) { setFlashIndex(flashIndex - 1); setIsFlipped(false); } };
  const handleFlashReset = () => { setFlashIndex(0); setIsFlipped(false); setCardStatuses(new Map()); };
  const handleShuffle = () => { setFlashcards([...flashcards].sort(() => Math.random() - 0.5)); setFlashIndex(0); setIsFlipped(false); };
  const toggleFavorite = () => { const f = new Set(favorites); f.has(flashIndex) ? f.delete(flashIndex) : f.add(flashIndex); setFavorites(f); };
  const getMasteredCount = () => Array.from(cardStatuses.values()).filter(s => s === "mastered").length;
  const getLearningCount = () => Array.from(cardStatuses.values()).filter(s => s === "learning").length;

  const handleAddFlashcard = async () => {
    if (!selectedFlashSet) return;
    const q = newQuestion.trim(), a = newAnswer.trim();
    if (!q || !a) { toast({ title: "Missing fields", description: "Provide both question and answer.", variant: "destructive" }); return; }
    try {
      await supabase.from("flashcards").insert({ set_id: selectedFlashSet.id, question: q, answer: a, order_index: flashcards.length });
      setNewQuestion(""); setNewAnswer("");
      await fetchFlashcards(selectedFlashSet.id);
      toast({ title: "Flashcard added" });
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Failed.", variant: "destructive" }); }
  };

  const handleDeleteCurrent = async () => {
    if (!selectedFlashSet || flashcards.length === 0) return;
    const card = flashcards[flashIndex];
    if (!card) return;
    try {
      await supabase.from("flashcards").delete().eq("id", card.id);
      toast({ title: "Flashcard deleted" });
      setFlashIndex(Math.max(0, flashIndex - 1));
      await fetchFlashcards(selectedFlashSet.id);
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Failed.", variant: "destructive" }); }
  };

  const generateAiFlashcards = async () => {
    if (!selectedFlashSet || !flashAiTopic.trim()) return;
    setFlashAiLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-flashcards`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ topic: flashAiTopic.trim(), numCards: 8 }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed");
      const cards = (data.cards || []) as { question: string; answer: string }[];
      if (!cards.length) { toast({ title: "No cards generated" }); return; }
      const inserts = cards.map((c, idx) => ({ set_id: selectedFlashSet.id, question: c.question, answer: c.answer, order_index: flashcards.length + idx }));
      await supabase.from("flashcards").insert(inserts);
      toast({ title: "AI flashcards added", description: `Added ${cards.length} cards.` });
      setFlashAiTopic("");
      await fetchFlashcards(selectedFlashSet.id);
    } catch (err: any) { toast({ title: "Generation failed", description: err?.message || "Could not generate.", variant: "destructive" }); }
    finally { setFlashAiLoading(false); }
  };

  // ─── Shared Styles ─────────────────────────────────────────────
  const glass = "rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] shadow-[0_20px_40px_rgba(0,0,0,0.4)]";

  // ─── Active Quiz View ──────────────────────────────────────────
  if (selectedSet && !showResults && questions.length > 0) {
    const currentQuestion = questions[currentIndex];
    const isCorrect = showFeedback && selectedAnswer === currentQuestion.correct_answer;
    const progressPct = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#0f0f0f] text-slate-900 dark:text-white flex flex-col relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-0 right-[10%] w-[30%] h-[30%] bg-violet-500/[0.06] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-[10%] w-[30%] h-[30%] bg-indigo-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 lg:px-12 py-4 sticky top-0 z-20">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedSet(null)} className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl"><ChevronLeft className="mr-2 h-4 w-4" />Exit</Button>
            <div className="flex items-center gap-6 bg-white/[0.03] px-5 py-2 rounded-full border border-white/[0.06]">
              <div className="flex items-center gap-2 text-violet-400"><Clock className="h-4 w-4" /><span className="font-mono font-bold tracking-wider">{formatTime(timer)}</span></div>
              <div className="h-4 w-px bg-white/10" />
              <div className="text-sm font-semibold"><span className="text-white">{currentIndex + 1}</span> <span className="text-zinc-500">/ {questions.length}</span></div>
            </div>
          </div>
        </div>

        <main className="flex-1 p-6 lg:p-8 flex items-center justify-center relative z-10 w-full">
          <div className="w-full max-w-3xl mx-auto">
            <div className="mb-8"><div className="flex justify-between text-xs text-zinc-500 mb-2 font-medium"><span>Progress</span><span>{Math.round(progressPct)}%</span></div>
              <Progress value={progressPct} className="h-2 bg-white/[0.06] [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-500" /></div>

            <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Active quiz</p><p className="text-sm font-semibold text-white">{selectedSet.title}</p></div>
              <span className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-bold text-violet-300 uppercase tracking-wider">{selectedSet.topic}</span>
            </div>

            <div className={`${glass} mb-6 p-8`}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-500/10 text-violet-300 text-[10px] font-bold tracking-[0.18em] uppercase mb-4 border border-violet-500/20">Question {currentIndex + 1}</div>
              <h2 className="text-xl font-bold text-white leading-relaxed mb-6">{currentQuestion.question}</h2>
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrectOption = option === currentQuestion.correct_answer;
                  let style = "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05] hover:border-white/10";
                  if (showFeedback) {
                    if (isCorrectOption) style = "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30";
                    else if (isSelected) style = "border-rose-500/30 bg-rose-500/10 text-rose-300";
                    else style = "border-white/[0.03] bg-black/20 text-zinc-600 opacity-50";
                  } else if (isSelected) { style = "border-violet-500/40 bg-violet-500/10 text-white ring-1 ring-violet-500/30"; }
                  return (
                    <button key={index} onClick={() => !showFeedback && setSelectedAnswer(option)} disabled={showFeedback} className={cn("w-full p-5 text-left rounded-2xl transition-all duration-300 border backdrop-blur-sm flex items-center gap-4 group", style)}>
                      <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-bold shrink-0 transition-colors", showFeedback && isCorrectOption ? "border-emerald-400 text-emerald-400" : showFeedback && isSelected ? "border-rose-400 text-rose-400" : isSelected ? "border-violet-400 text-violet-400" : "border-zinc-600 text-zinc-500 group-hover:border-white/20 group-hover:text-zinc-300")}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1 text-base">{option}</span>
                      <div className="w-6 shrink-0">{showFeedback && isCorrectOption && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}{showFeedback && isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-rose-400" />}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {showFeedback && (
              <div className={cn("mb-6 p-5 rounded-2xl border backdrop-blur-md flex items-start gap-4", isCorrect ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5")}>
                <div className={cn("p-2 rounded-xl", isCorrect ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>{isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}</div>
                <div><h3 className={cn("font-bold mb-1", isCorrect ? "text-emerald-300" : "text-rose-300")}>{isCorrect ? "Correct! ✨" : "Not quite right"}</h3>
                  <p className="text-zinc-400 text-sm">{isCorrect ? "Keep going!" : <span>The answer is <span className="text-emerald-400 font-bold">{currentQuestion.correct_answer}</span></span>}</p></div>
              </div>
            )}

            <div className="flex justify-end">
              <Button className={cn("px-8 h-13 text-base font-bold rounded-xl transition-all w-full sm:w-auto", !selectedAnswer && !showFeedback ? "bg-white/5 text-zinc-500 cursor-not-allowed" : "bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90 shadow-[0_8px_25px_-5px_rgba(139,92,246,0.4)]")} onClick={showFeedback ? handleNext : handleSubmitAnswer} disabled={!showFeedback && !selectedAnswer}>
                {showFeedback ? (currentIndex < questions.length - 1 ? "Next Question" : "View Results") : "Submit Answer"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Quiz Results View ─────────────────────────────────────────
  if (showResults && selectedSet) {
    const scorePct = (correctAnswers / questions.length) * 100;
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#0f0f0f] text-slate-900 dark:text-white flex items-center justify-center p-8 relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-[20%] left-[25%] w-[350px] h-[350px] bg-amber-500/[0.06] blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[20%] right-[25%] w-[350px] h-[350px] bg-emerald-500/[0.05] blur-[130px] rounded-full pointer-events-none" />
        <div className={`${glass} max-w-xl w-full overflow-hidden relative z-10`}>
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-violet-400" />
          <div className="p-10 space-y-8 text-center">
            <div className="relative inline-block"><div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full scale-150" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(245,158,11,0.35)]"><Trophy className="h-10 w-10 text-white" /></div></div>
            <div><h2 className="text-3xl font-extrabold tracking-tight mb-1">Quiz Complete! 🎉</h2><p className="text-zinc-400 text-sm">{selectedSet.title}</p></div>
            <div className="relative"><svg className="w-40 h-40 mx-auto -rotate-90"><circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/5" /><circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={452.39} strokeDashoffset={452.39 - (452.39 * scorePct) / 100} className="text-violet-400 transition-all duration-1000" /></svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-4xl font-extrabold text-white">{Math.round(scorePct)}%</div><div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">Score</div></div></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"><div className="text-xl font-bold text-emerald-400">{correctAnswers}</div><p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Correct</p></div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"><div className="text-xl font-bold text-rose-400">{questions.length - correctAnswers}</div><p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Wrong</p></div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"><div className="text-xl font-bold text-white">{formatTime(timer)}</div><p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Time</p></div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold hover:opacity-90" onClick={() => { setShowResults(false); setCurrentIndex(0); setSelectedAnswer(null); setShowFeedback(false); setCorrectAnswers(0); setStartTime(Date.now()); }}><RotateCw className="mr-2 h-4 w-4" />Retake</Button>
              <Button variant="outline" className="flex-1 h-12 rounded-xl border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]" onClick={() => setSelectedSet(null)}>Back</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Flashcard View ─────────────────────────────────────
  if (selectedFlashSet && flashcards.length > 0) {
    const currentCard = flashcards[flashIndex];
    const progressPct = flashcards.length > 0 ? ((flashIndex + 1) / flashcards.length) * 100 : 0;
    const currentStatus = cardStatuses.get(flashIndex) || "unknown";
    const statusBorder = { mastered: "border-emerald-500/30", learning: "border-amber-500/30", unknown: "border-white/[0.06]" }[currentStatus];

    return (
      <div className="flex h-screen" style={{ background: "#0f0f0f" }}>
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
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden ml-64">
            <div className="absolute -top-[15%] -right-[10%] h-[55%] w-[55%] bg-violet-500/[0.08] blur-[140px]" />
            <div className="absolute -bottom-[10%] -left-[10%] h-[55%] w-[55%] bg-blue-500/[0.06] blur-[140px]" />
            <div className="absolute top-[35%] left-[20%] h-[35%] w-[35%] bg-violet-500/5 blur-[130px]" />
          </div>

          <div className="relative z-10 min-h-screen p-8 md:p-10 max-w-3xl mx-auto">
            <Button variant="ghost" className="mb-6 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl gap-2" onClick={() => setSelectedFlashSet(null)}><ChevronLeft className="h-4 w-4" />Back to sets</Button>

            <div className={`${glass} p-5 mb-6`}>
              <div className="flex justify-between mb-2 text-xs text-zinc-400"><span>Card {flashIndex + 1} of {flashcards.length}</span><span>{Math.round(progressPct)}%</span></div>
              <Progress value={progressPct} className="h-2 bg-white/[0.06] [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-500" />
              <div className="flex gap-3 mt-4">
                <Button size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] rounded-xl" onClick={handleShuffle}><Shuffle className="mr-2 h-3.5 w-3.5" />Shuffle</Button>
                <Button size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] rounded-xl" onClick={handleFlashReset}><RotateCw className="mr-2 h-3.5 w-3.5" />Restart</Button>
              </div>
            </div>

            <div className={cn("h-80 cursor-pointer mb-6 border-2 rounded-3xl bg-white/[0.03] backdrop-blur-xl flex items-center justify-center relative transition-all duration-300 hover:shadow-lg", statusBorder)} onClick={handleFlip}>
              <Button size="icon" variant="ghost" className="absolute top-4 right-4 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl" onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}><Heart className={cn("h-4 w-4", favorites.has(flashIndex) ? "fill-rose-500 text-rose-500" : "")} /></Button>
              {isTeacher && <Button size="icon" variant="ghost" className="absolute top-4 left-4 text-rose-400 hover:bg-rose-500/10 rounded-xl" onClick={(e) => { e.stopPropagation(); handleDeleteCurrent(); }}><Trash2 className="h-4 w-4" /></Button>}
              <div className="text-center px-8"><p className="text-[10px] uppercase tracking-[0.18em] font-bold text-violet-300 mb-4">{isFlipped ? "Answer" : "Question"}</p><p className="text-lg text-white font-medium leading-relaxed">{isFlipped ? currentCard.answer : currentCard.question}</p></div>
            </div>

            {isFlipped && (
              <div className="flex gap-3 mb-4">
                <Button variant="outline" className="flex-1 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-300 hover:bg-rose-500/10 h-11" onClick={handleUnknown}><XCircle className="mr-2 h-4 w-4" />Unknown</Button>
                <Button variant="outline" className="flex-1 rounded-xl border-emerald-500/20 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10 h-11" onClick={handleKnown}><CheckCircle2 className="mr-2 h-4 w-4" />Known</Button>
              </div>
            )}

            <div className="flex justify-between mb-6">
              <Button variant="outline" className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] rounded-xl" onClick={handleFlashPrev} disabled={flashIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" />Previous</Button>
              <Button className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl font-bold hover:opacity-90" onClick={handleFlashNext} disabled={flashIndex === flashcards.length - 1}>Next<ChevronRight className="ml-2 h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="text-center p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15"><div className="text-2xl font-bold text-emerald-400">{getMasteredCount()}</div><p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Mastered</p></div>
              <div className="text-center p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15"><div className="text-2xl font-bold text-amber-400">{getLearningCount()}</div><p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Learning</p></div>
              <div className="text-center p-4 rounded-2xl bg-rose-500/5 border border-rose-500/15"><div className="text-2xl font-bold text-rose-400">{flashcards.length - getMasteredCount() - getLearningCount()}</div><p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Unknown</p></div>
            </div>

            {isTeacher && (
              <div className={`${glass} p-6 space-y-4`}>
                <h3 className="text-sm font-bold text-white">Add Flashcard</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-zinc-400 text-xs">Question</Label><Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Enter question" className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-zinc-600 rounded-xl mt-1" /></div>
                  <div><Label className="text-zinc-400 text-xs">Answer</Label><Input value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} placeholder="Enter answer" className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-zinc-600 rounded-xl mt-1" /></div>
                </div>
                <Button className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl font-bold hover:opacity-90" onClick={handleAddFlashcard}>Add Flashcard</Button>
                <div className="pt-4 border-t border-white/[0.06] space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-2"><Sparkles className="h-3 w-3 text-violet-400" />Generate with AI</h4>
                  <div className="flex gap-3"><Input value={flashAiTopic} onChange={(e) => setFlashAiTopic(e.target.value)} placeholder="e.g. Newton's Laws" className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-zinc-600 rounded-xl" />
                    <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shrink-0" disabled={flashAiLoading || !flashAiTopic.trim()} onClick={generateAiFlashcards}>{flashAiLoading ? "Generating..." : "Generate"}</Button></div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ─── Hub Landing (Dock Switcher + Grid) ────────────────────────
  return (
    <div className="flex h-screen" style={{ background: "#0f0f0f" }}>
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

        <div className="relative z-10 min-h-screen p-8 md:p-10">
          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10">
                  <Brain className="h-6 w-6 text-violet-300" />
                </div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Practice Hub</h1>
              </div>
              <p className="text-zinc-400 text-base max-w-lg">
                Master any topic with AI-generated quizzes and spaced-repetition flashcards.
              </p>
            </div>
          </header>

          {/* ── Floating Dock Switcher ── */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] shadow-[0_8px_30px_-5px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => setHubMode("quiz")}
                className={cn(
                  "flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-bold transition-all duration-300",
                  hubMode === "quiz"
                    ? "bg-white/10 text-white border border-white/15 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                )}
              >
                <Brain className="h-4 w-4" />
                Quiz Mode
              </button>
              <button
                onClick={() => setHubMode("flashcards")}
                className={cn(
                  "flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-bold transition-all duration-300",
                  hubMode === "flashcards"
                    ? "bg-white/10 text-white border border-white/15 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                )}
              >
                <Layers className="h-4 w-4" />
                Flashcards
              </button>
            </div>
          </div>

          {/* ── Quiz Mode Content ── */}
          {hubMode === "quiz" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* AI Generator */}
              <div className={`${glass} p-8`}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-violet-300" />
                  <h2 className="text-lg font-bold text-white">Generate AI Quiz</h2>
                </div>
                <p className="text-xs text-zinc-500 mb-5">Enter any placement topic and instantly create a personalized quiz set.</p>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. DBMS Joins, OS Scheduling, DSA Arrays" className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-zinc-600 rounded-xl flex-1" />
                  <Button onClick={() => generateAiQuiz()} disabled={aiLoading || !aiTopic.trim()} className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl font-bold hover:opacity-90 min-w-[180px] shadow-[0_8px_25px_-5px_rgba(139,92,246,0.3)]">
                    <Brain className="mr-2 h-4 w-4" />{aiLoading ? "Generating..." : "Generate AI Quiz"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AI_TOPICS.map((topic) => (
                    <button key={topic} onClick={() => generateAiQuiz(topic)} disabled={aiLoading} className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/10 transition-all">
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quiz Sets Grid */}
              {quizSets.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
                  <Brain className="h-10 w-10 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400 font-semibold mb-1">No quiz sets available yet</p>
                  <p className="text-zinc-600 text-sm">Generate one with AI or ask your teacher to publish a quiz.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {quizSets.map((set, i) => (
                    <div
                      key={set.id}
                      className={`${glass} cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-10px_rgba(139,92,246,0.2)] hover:border-white/10 transition-all duration-300 overflow-hidden group`}
                      onClick={() => handleSetSelect(set)}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 to-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="p-6 space-y-4">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Trophy className="h-5 w-5 text-violet-300" /></div>
                        <div>
                          <h3 className="text-[15px] font-bold text-white leading-snug line-clamp-2 mb-1.5 group-hover:text-violet-100 transition-colors">{set.title}</h3>
                          <p className="text-xs text-zinc-500 line-clamp-2">{set.description || "Challenge yourself with these curated questions."}</p>
                        </div>
                        <span className="inline-block text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20">{set.topic}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Flashcards Mode Content ── */}
          {hubMode === "flashcards" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {flashcardSets.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
                  <Layers className="h-10 w-10 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400 font-semibold mb-1">No flashcard sets yet</p>
                  <p className="text-zinc-600 text-sm">Ask your teacher to create a flashcard set to practice.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {flashcardSets.map((set, i) => (
                    <div
                      key={set.id}
                      className={`${glass} cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-10px_rgba(139,92,246,0.2)] hover:border-white/10 transition-all duration-300 overflow-hidden group`}
                      onClick={() => handleFlashSetSelect(set)}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="h-[2px] w-full bg-gradient-to-r from-fuchsia-500 to-violet-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="p-6 space-y-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Layers className="h-5 w-5 text-fuchsia-300" /></div>
                        <h3 className="text-[15px] font-bold text-white leading-snug line-clamp-2 group-hover:text-fuchsia-100 transition-colors">{set.title}</h3>
                        <p className="text-xs text-zinc-500 line-clamp-2">{set.description || "Practice active recall with this flashcard set."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Quiz;
