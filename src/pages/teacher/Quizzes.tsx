import React, { useEffect, useState } from "react";
import { 
  Brain, 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Trash2, 
  Search, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Zap,
  LayoutGrid,
  Trophy,
  History,
  Timer,
  ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { GoogleGenAI } from "@google/genai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const floatingGlassCardClass = "backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] rounded-3xl";

const SpotlightCard = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className = "" }, ref) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        ref={ref}
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
  }
);

SpotlightCard.displayName = "SpotlightCard";

interface QuizSet {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  created_at: string;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  order_index: number;
}

interface QuizAttempt {
  user_id: string;
  student_name: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  time_taken: number;
  completed_at: string | null;
}

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractGeminiText = (response: any): string => {
  if (response && typeof response.text === "function") return response.text();
  if (response && typeof response.text === "string") return response.text;
  if (response?.candidates?.[0]?.content?.parts?.[0]?.text) return response.candidates[0].content.parts[0].text;
  throw new Error("Unable to extract text from Gemini response");
};

const callGeminiWithRetry = async (ai: InstanceType<typeof GoogleGenAI>, prompt: string): Promise<string> => {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await ai.models.generateContent({ model, contents: prompt });
        const response = (result as any).response || result;
        return extractGeminiText(response);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
          const delayMatch = msg.match(/retry\s+in\s+([\d.]+)/i) || msg.match(/retryDelay.*?(\d+)/);
          const waitSecs = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) + 2 : 35;
          if (attempt === 0) {
            await sleep(waitSecs * 1000);
            continue;
          }
          break;
        }
        throw err;
      }
    }
  }

  throw new Error("All AI models are rate-limited. Please retry in 1-2 minutes.");
};

export default function TeacherQuizzes() {
  useRequireRole("teacher");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [quizzes, setQuizzes] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSet | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("quiz_sets")
          .select("id, title, description, topic, created_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setQuizzes(data || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.message || "Failed to load quizzes.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (!selectedQuiz) return;

    fetchAttempts(selectedQuiz.id);
    const intervalId = setInterval(() => {
      fetchAttempts(selectedQuiz.id);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [selectedQuiz]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("quiz_sets")
        .insert({
          title: title.trim(),
          description: prompt.trim() || null,
          topic: topic.trim() || "General",
          created_by: user.id,
        })
        .select("id, title, description, topic, created_at")
        .single();

      if (error) throw error;

      setQuizzes((prev) => [data, ...prev]);
      setTitle("");
      setTopic("");
      setPrompt("");

      toast({
        title: "Quiz created",
        description: "You can now add questions to this quiz.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create quiz.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (quizId: string) => {
    try {
      setQuestionsLoading(true);
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (error) throw error;

      setQuestions(
        (data || []).map((q: any) => ({
          ...q,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
        }))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load questions.",
        variant: "destructive",
      });
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleSelectQuiz = (quiz: QuizSet) => {
    setSelectedQuiz(quiz);
    fetchQuestions(quiz.id);
    fetchAttempts(quiz.id);
  };

  const fetchAttempts = async (quizId: string) => {
    try {
      setAttemptsLoading(true);

      const { data: rows, error } = await supabase
        .from("user_progress")
        .select("user_id, progress_data, updated_at")
        .eq("content_type", "quiz_set")
        .eq("content_id", quizId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const userIds = Array.from(new Set((rows || []).map((row: any) => row.user_id)));
      if (userIds.length === 0) {
        setAttempts([]);
        return;
      }

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const allowedStudentIds = new Set(
        (roleRows || [])
          .filter((row: any) => row.role === "student")
          .map((row: any) => row.user_id)
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.username || "Unknown student"]));

      const parsed: QuizAttempt[] = (rows || [])
        .filter((row: any) => allowedStudentIds.has(row.user_id))
        .map((row: any) => ({
          user_id: row.user_id,
          student_name: profileMap.get(row.user_id) || "Unknown student",
          score: row.progress_data?.score || 0,
          correct_answers: row.progress_data?.correct_answers || 0,
          total_questions: row.progress_data?.total_questions || 0,
          time_taken: row.progress_data?.time_taken || 0,
          completed_at: row.progress_data?.completed_at || row.updated_at || null,
        }));

      setAttempts(parsed);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load student attempts.",
        variant: "destructive",
      });
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;

    const trimmedQuestion = newQuestion.trim();
    const a = optionA.trim();
    const b = optionB.trim();
    const c = optionC.trim();
    const d = optionD.trim();
    const correct = correctAnswer.trim();

    if (!trimmedQuestion || !a || !b || !c || !d || !correct) {
      toast({
        title: "Missing fields",
        description: "Fill question, all options and correct answer.",
        variant: "destructive",
      });
      return;
    }

    const options = [a, b, c, d];
    if (!options.includes(correct)) {
      toast({
        title: "Invalid correct answer",
        description: "Correct answer must match one of the options.",
        variant: "destructive",
      });
      return;
    }

    try {
      setQuestionsLoading(true);

      const { error } = await supabase.from("quiz_questions").insert({
        quiz_id: selectedQuiz.id,
        question: trimmedQuestion,
        options,
        correct_answer: correct,
        order_index: questions.length,
      });

      if (error) throw error;

      setNewQuestion("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setCorrectAnswer("");

      await fetchQuestions(selectedQuiz.id);

      toast({
        title: "Question added",
        description: "The question has been added to this quiz.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to add question.",
        variant: "destructive",
      });
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedQuiz) return;

    try {
      setQuestionsLoading(true);
      const { error } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      await fetchQuestions(selectedQuiz.id);
      toast({
        title: "Question deleted",
        description: "The question has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete question.",
        variant: "destructive",
      });
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleDeleteQuiz = async (quiz: QuizSet) => {
    try {
      setLoading(true);

      const { error: deleteQuestionsError } = await supabase
        .from("quiz_questions")
        .delete()
        .eq("quiz_id", quiz.id);

      if (deleteQuestionsError) throw deleteQuestionsError;

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Not authenticated");

      const { error: deleteQuizError } = await supabase
        .from("quiz_sets")
        .delete()
        .eq("id", quiz.id)
        .eq("created_by", user.id);

      if (deleteQuizError) throw deleteQuizError;

      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));

      if (selectedQuiz?.id === quiz.id) {
        setSelectedQuiz(null);
        setQuestions([]);
        setAttempts([]);
      }

      toast({
        title: "Quiz deleted",
        description: `"${quiz.title}" and its questions have been removed.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete quiz.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-violet-500/30 overflow-x-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-8 py-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate("/teacher")} 
              className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/50 transition-all group shrink-0"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-black uppercase tracking-widest px-2 py-0">
                  Assessment Engine
                </Badge>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                Quiz Intelligence
                <Sparkles className="h-6 w-6 text-violet-400" />
              </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Column: Generator & Form */}
            <div className="lg:col-span-5 space-y-8">
              {/* Magic AI Generator */}
              <SpotlightCard className={cn(floatingGlassCardClass, "p-8 border-violet-500/20 bg-violet-500/[0.02]")}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">AI Magic Generator</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Instant mastery assessment</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Quiz Topic / Objective</Label>
                    <Input
                      placeholder="e.g. World War II or Calculus Limits"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-violet-500/50 focus:ring-violet-500/20 transition-all placeholder:text-slate-600 font-medium"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      let createdQuizSetId: string | null = null;
                      if (!aiTopic.trim()) {
                        toast({
                          title: "Missing title",
                          description: "Please enter a quiz title/topic.",
                          variant: "destructive",
                        });
                        return;
                      }

                      setAiLoading(true);
                      try {
                        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
                        if (!geminiKey) throw new Error("Gemini API key missing. Set VITE_GEMINI_API_KEY.");

                        // First create the quiz set
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;

                        const { data: quizSet, error: quizError } = await supabase
                          .from("quiz_sets")
                          .insert({
                            title: aiTopic.trim(),
                            description: "Generated by AI Intelligence",
                            topic: aiTopic.trim(),
                            created_by: user.id,
                          })
                          .select("id, title, description, topic, created_at")
                          .single();

                        if (quizError) throw quizError;
                        createdQuizSetId = quizSet.id;

                        // Generate questions
                        const ai = new GoogleGenAI({ apiKey: geminiKey });
                        const prompt = `Generate 5 placement-focused MCQs on "${aiTopic.trim()}". Return ONLY a valid JSON array of question objects with "question", "options" (4), and "correctAnswer". No markdown.`;

                        const raw = await callGeminiWithRetry(ai, prompt);
                        const clean = String(raw).replace(/```json/g, "").replace(/```/g, "").trim();
                        const match = clean.match(/\[[\s\S]*\]/);
                        if (!match) throw new Error("Invalid AI response format.");

                        const generatedQuestions = JSON.parse(match[0]);

                        const inserts = generatedQuestions.map((q: any, idx: number) => ({
                          quiz_id: quizSet.id,
                          question: q.question,
                          options: q.options,
                          correct_answer: q.correctAnswer,
                          order_index: idx,
                        }));

                        const { error: insertError } = await supabase.from("quiz_questions").insert(inserts);
                        if (insertError) throw insertError;

                        toast({ title: "AI intelligence deployed", description: `Roster updated with ${generatedQuestions.length} questions.` });
                        setQuizzes((prev) => [quizSet, ...prev]);
                        setAiTopic("");
                      } catch (err: any) {
                        if (createdQuizSetId) await supabase.from("quiz_sets").delete().eq("id", createdQuizSetId);
                        toast({ title: "Signal failed", description: err?.message, variant: "destructive" });
                      } finally {
                        setAiLoading(false);
                      }
                    }}
                    disabled={aiLoading || !aiTopic.trim()}
                    className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-violet-500/20 transition-all active:scale-[0.98]"
                  >
                    <Sparkles className={cn("mr-2 h-4 w-4", aiLoading && "animate-spin")} />
                    {aiLoading ? "Generating Mastery..." : "Deploy AI Intelligence"}
                  </Button>
                </div>
              </SpotlightCard>

              {/* Manual Creation Form */}
              <div className={cn(floatingGlassCardClass, "p-8 space-y-6")}>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Plus className="h-4 w-4 text-violet-400" />
                    Manual Framework
                  </h3>
                </div>
                <form className="space-y-4" onSubmit={handleGenerate}>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quiz Title</Label>
                    <Input
                      placeholder="e.g. Calculus Quiz 1"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deep Topic</Label>
                    <Input
                      placeholder="e.g. Limits and Derivatives"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Objectives / Prompt</Label>
                    <Textarea
                      placeholder="Define the scope of this assessment..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-xl min-h-[100px]"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold">
                    {loading ? "Initializing..." : "Create Quiz Set"}
                  </Button>
                </form>
              </div>
            </div>

            {/* Right Column: Quiz Grid */}
            <div className="lg:col-span-7 space-y-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <LayoutGrid className="h-5 w-5 text-blue-400" />
                  Deployed Frameworks
                </h2>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-400 font-bold uppercase tracking-widest px-2 py-0.5">
                  {quizzes.length} ACTIVE
                </Badge>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-3xl bg-white/[0.03] animate-pulse" />)}
                </div>
              ) : quizzes.length === 0 ? (
                <div className={cn(floatingGlassCardClass, "p-12 text-center text-slate-500")}>
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold uppercase tracking-widest text-xs">No active assessments found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AnimatePresence mode="popLayout">
                    {quizzes.map((quiz, idx) => (
                      <SpotlightCard 
                        key={quiz.id} 
                        className={cn(
                          floatingGlassCardClass, 
                          "p-6 group cursor-pointer border-white/5 hover:border-violet-500/30 transition-all",
                          selectedQuiz?.id === quiz.id && "ring-2 ring-violet-500/50 bg-violet-500/[0.03] border-violet-500/30"
                        )}
                      >
                        <div onClick={() => handleSelectQuiz(quiz)} className="h-full flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between mb-4">
                              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                <BookOpen className="h-5 w-5 text-violet-400" />
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteQuiz(quiz); }}
                                className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <h3 className="text-lg font-black text-white leading-tight mb-1 group-hover:text-violet-400 transition-colors capitalize">{quiz.title}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{quiz.topic}</p>
                          </div>
                          <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-slate-600" />
                              <span className="text-[10px] font-bold text-slate-600 uppercase italic">
                                {new Date(quiz.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                          </div>
                        </div>
                      </SpotlightCard>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Selected Quiz Detail Section */}
          <AnimatePresence mode="wait">
            {selectedQuiz && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="pt-12"
              >
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                  {/* Question Editor */}
                  <div className={cn(floatingGlassCardClass, "xl:col-span-12 p-8")}>
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <CheckCircle2 className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white tracking-tight uppercase">Intelligence Configuration: {selectedQuiz.title}</h2>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Edit assessment logic and verify accuracy</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => setSelectedQuiz(null)} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest">
                        Minimize
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      {/* Left: Add/Edit Form */}
                      <div className="space-y-6">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                          <Plus className="h-4 w-4 text-violet-400" />
                          Injection Point
                        </h3>
                        <form className="space-y-4" onSubmit={handleAddQuestion}>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Core Question</Label>
                            <Textarea
                              placeholder="Define the query..."
                              value={newQuestion}
                              onChange={(e) => setNewQuestion(e.target.value)}
                              className="bg-white/5 border-white/10 rounded-xl min-h-[80px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { id: 'A', value: optionA, setter: setOptionA },
                              { id: 'B', value: optionB, setter: setOptionB },
                              { id: 'C', value: optionC, setter: setOptionC },
                              { id: 'D', value: optionD, setter: setOptionD }
                            ].map(opt => (
                              <div key={opt.id} className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Choice {opt.id}</Label>
                                <Input
                                  value={opt.value}
                                  onChange={(e) => opt.setter(e.target.value)}
                                  className="bg-white/5 border-white/10 rounded-xl py-5"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Validated Key (Correct Answer)</Label>
                            <Input
                              placeholder="Must match one choice exactly..."
                              value={correctAnswer}
                              onChange={(e) => setCorrectAnswer(e.target.value)}
                              className="bg-white/5 border-emerald-500/20 rounded-xl py-6 border-2 focus:border-emerald-500/50"
                            />
                          </div>
                          <Button type="submit" disabled={questionsLoading} className="w-full h-12 bg-white text-black hover:bg-white/90 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]">
                            {questionsLoading ? "Syncing..." : "Inject Question"}
                          </Button>
                        </form>
                      </div>

                      {/* Right: Question List */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-400" />
                            Active Roster
                          </h3>
                          <Badge variant="outline" className="border-white/10 text-slate-500 font-bold px-2 py-0">
                            {questions.length} NODES
                          </Badge>
                        </div>
                        <ScrollArea className="h-[500px] pr-4">
                          <div className="space-y-4">
                            {questions.map((q, index) => (
                              <div key={q.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group relative">
                                <div className="flex justify-between items-start gap-4 mb-4">
                                  <div className="flex items-center gap-3">
                                    <span className="h-6 w-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 border border-white/5">
                                      {index + 1}
                                    </span>
                                    <p className="font-bold text-white text-sm">{q.question}</p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    className="h-8 w-8 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all -mt-1 -mr-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {q.options.map((opt, i) => (
                                    <div key={i} className={cn(
                                      "p-2 rounded-lg text-xs font-medium border transition-all",
                                      opt === q.correct_answer 
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                                        : "bg-white/[0.02] border-white/5 text-slate-500"
                                    )}>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>

                    {/* Student Attempts View */}
                    <div className="mt-12 pt-12 border-t border-white/5 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                            <History className="h-5 w-5 text-violet-400" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Deployment Metrics</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live feed of student performance and engagement</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-bold uppercase tracking-widest px-3 py-1">
                          Live Insights
                        </Badge>
                      </div>

                      {attemptsLoading ? (
                        <div className="space-y-4">
                          {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)}
                        </div>
                      ) : attempts.length === 0 ? (
                        <div className="py-12 text-center rounded-3xl bg-white/[0.02] border border-white/5 border-dashed">
                          <Search className="h-8 w-8 mx-auto mb-3 opacity-20" />
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">No transmissions detected yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {attempts.map((attempt) => (
                            <div key={`${attempt.user_id}-${attempt.completed_at}`} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-violet-500/20 transition-all flex items-center justify-between gap-4 group">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-black text-white truncate text-sm uppercase tracking-tight">{attempt.student_name}</p>
                                </div>
                                <div className="flex items-center gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                  <div className="flex items-center gap-1.5">
                                    <Trophy className="h-3 w-3 text-amber-500" />
                                    {attempt.correct_answers}/{attempt.total_questions}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Timer className="h-3 w-3 text-blue-400" />
                                    {Math.floor(attempt.time_taken / 60)}m {attempt.time_taken % 60}s
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${attempt.score}%` }}
                                      className={cn(
                                        "h-full rounded-full",
                                        attempt.score >= 80 ? "bg-emerald-500" :
                                        attempt.score >= 60 ? "bg-blue-500" : "bg-rose-500"
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={cn(
                                  "text-2xl font-black italic tracking-tighter transition-all group-hover:scale-110",
                                  attempt.score >= 80 ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" :
                                  attempt.score >= 60 ? "text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]" : 
                                  "text-rose-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]"
                                )}>
                                  {attempt.score}%
                                </div>
                                <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-tighter">
                                  {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : "-"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
