import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ChevronLeft, CheckCircle2, XCircle, Trophy, RotateCw, Clock, Home, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { GoogleGenAI } from "@google/genai";

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

const QUICK_AI_TOPICS = [
  "Data Structures & Algorithms",
  "Operating Systems",
  "DBMS and SQL",
  "Computer Networks",
  "OOPs and Java",
  "Quantitative Aptitude"
];

type GeneratedQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

const Quiz = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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

  useEffect(() => {
    fetchQuizSets();
    checkRole();
  }, []);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (data?.role) setRole(data.role);
    }
  };

  const getHomePath = () => {
    if (role === "admin") return "/admin";
    if (role === "teacher") return "/teacher";
    return "/dashboard";
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (selectedSet && !showResults && startTime) {
      interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [selectedSet, showResults, startTime]);

  const fetchQuizSets = async () => {
    try {
      const { data, error } = await supabase.from("quiz_sets").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      const sets = data || [];
      if (sets.length === 0) {
        setQuizSets([]);
        return;
      }

      // Hide quiz sets that have no questions to avoid showing broken/incomplete entries.
      const { data: linkedQuestions, error: linkedError } = await supabase
        .from("quiz_questions")
        .select("quiz_id")
        .in("quiz_id", sets.map((s) => s.id));

      if (linkedError) {
        setQuizSets(sets);
        return;
      }

      const validSetIds = new Set((linkedQuestions || []).map((q) => q.quiz_id));
      setQuizSets(sets.filter((s) => validSetIds.has(s.id)));
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load quiz sets", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (quizId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("order_index");
      if (error) throw error;

      const mappedQuestions = (data || []).map(q => ({ ...q, options: Array.isArray(q.options) ? q.options as string[] : [] }));

      if (mappedQuestions.length === 0) {
        toast({
          title: "Quiz unavailable",
          description: "This quiz has no questions yet. Please select another quiz.",
          variant: "destructive",
        });
        setSelectedSet(null);
        return;
      }

      setQuestions(mappedQuestions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setCorrectAnswers(0);
      setShowResults(false);
      setStartTime(Date.now());
      setTimer(0);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load questions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelect = (set: QuizSet) => {
    setSelectedSet(set);
    fetchQuestions(set.id);
  };

  const generateAiQuiz = async (topicOverride?: string) => {
    const topic = (topicOverride ?? aiTopic).trim();
    if (!topic) {
      toast({ title: "Missing topic", description: "Enter a topic to generate your quiz.", variant: "destructive" });
      return;
    }

    try {
      setAiLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in first.");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in first.");

      let generatedQuestions: GeneratedQuestion[] = [];

      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-quiz`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ topic, numQuestions: 10 }),
        });

        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || "Failed to generate quiz.");
        generatedQuestions = (payload?.questions || []) as GeneratedQuestion[];
      } catch (edgeError: any) {
        if (import.meta.env.DEV) console.warn("Edge generation failed, trying client fallback", edgeError);

        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!geminiKey) {
          throw new Error("AI service is unavailable right now. Try again in a minute.");
        }

        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const prompt = `Generate 10 placement-focused multiple choice questions on "${topic}".

Return ONLY valid JSON in this exact structure:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "One of the options exactly"
  }
]

Rules:
- Questions must be practical and interview/placement relevant.
- Exactly 4 options per question.
- No markdown, no extra text, no code block fences.`;

        const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        const raw = (result as any).text || result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const clean = String(raw).replace(/```json/g, "").replace(/```/g, "").trim();
        const match = clean.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("AI response format was invalid.");
        generatedQuestions = JSON.parse(match[0]) as GeneratedQuestion[];
      }

      if (!generatedQuestions.length) {
        throw new Error("AI did not return questions for this topic.");
      }

      const { data: quizSet, error: quizError } = await supabase
        .from("quiz_sets")
        .insert({
          title: `${topic} - AI Practice`,
          description: "Student-generated with AI",
          topic,
          created_by: user.id,
        })
        .select("id, title, description, topic")
        .single();

      if (quizError) throw quizError;

      const inserts = generatedQuestions.map((q, idx) => ({
        quiz_id: quizSet.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        order_index: idx,
      }));

      const { error: insertError } = await supabase.from("quiz_questions").insert(inserts);
      if (insertError) {
        await supabase.from("quiz_sets").delete().eq("id", quizSet.id);
        throw insertError;
      }

      setQuizSets((prev) => [quizSet, ...prev]);
      setAiTopic("");
      toast({ title: "AI quiz ready", description: `Generated ${generatedQuestions.length} questions on ${topic}.` });
      handleSetSelect(quizSet);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("AI quiz generation error:", error);
      toast({ title: "Generation failed", description: error?.message || "Could not generate AI quiz.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer) return;
    setShowFeedback(true);
    if (selectedAnswer === questions[currentIndex].correct_answer) {
      setCorrectAnswers((prev) => prev + 1);
    }
  };

  const saveQuizResults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedSet) return;

      const scorePercentage = Math.round((correctAnswers / questions.length) * 100);
      const progressData = {
        score: scorePercentage,
        correct_answers: correctAnswers,
        total_questions: questions.length,
        time_taken: timer,
        completed_at: new Date().toISOString(),
        quiz_title: selectedSet.title,
        quiz_topic: selectedSet.topic
      };

      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          content_type: 'quiz_set',
          content_id: selectedSet.id,
          progress_data: progressData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,content_type,content_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setShowResults(true);
      saveQuizResults();
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (loading && !selectedSet) return <div className="min-h-screen flex items-center justify-center"><Brain className="h-12 w-12 animate-pulse text-primary" /></div>;

  if (!selectedSet) {
    return (
      <div className="min-h-screen bg-[#0f172a] p-8 text-white relative flex flex-col items-center">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-5xl mx-auto relative z-10">
          <Button 
            variant="ghost" 
            className="mb-8 hover:bg-white/10 text-gray-400 hover:text-white transition-all rounded-xl border border-white/5 bg-white/5" 
            onClick={() => navigate(getHomePath())}
          >
            <Home className="mr-2 h-4 w-4" /> Back to Home
          </Button>

          <div className="mb-10 text-center animate-in slide-in-from-bottom flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Interactive Quiz
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-lg leading-relaxed">
              Test your knowledge across various topics. Select a quiz set below to begin your evaluation.
            </p>
          </div>

          <Card className="mb-8 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-indigo-400/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-300" />
                Generate Your Own AI Quiz
              </CardTitle>
              <CardDescription className="text-gray-300">
                Enter any placement topic and instantly create a personalized quiz set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. DBMS Joins, OS Scheduling, DSA Arrays"
                  className="bg-black/20 border-white/15 text-white placeholder:text-gray-400"
                />
                <Button
                  onClick={() => generateAiQuiz()}
                  disabled={aiLoading || !aiTopic.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[180px]"
                >
                  <Brain className="mr-2 h-4 w-4" />
                  {aiLoading ? "Generating..." : "Generate AI Quiz"}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {QUICK_AI_TOPICS.map((topic) => (
                  <Button
                    key={topic}
                    type="button"
                    variant="outline"
                    className="border-white/20 text-gray-200 hover:text-white hover:bg-white/10"
                    onClick={() => generateAiQuiz(topic)}
                    disabled={aiLoading}
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {quizSets.length === 0 ? (
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 max-w-2xl mx-auto">
              <CardHeader className="text-center p-8">
                <CardTitle className="text-2xl text-white">No quiz sets available yet</CardTitle>
                <CardDescription className="text-gray-400 text-base">
                  Ask your teacher to publish a quiz set, then refresh this page.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizSets.map((set, index) => (
                <Card
                  key={set.id}
                  className="cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-primary/20 group"
                  onClick={() => handleSetSelect(set)}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="p-6">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-primary group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl text-white font-semibold mb-2 line-clamp-2 leading-tight">
                      {set.title}
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-sm line-clamp-3">
                      {set.description || "Challenge yourself with these curated questions."}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading && selectedSet && questions.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Brain className="h-12 w-12 animate-pulse text-primary" /></div>;
  }

  if (showResults) {
    const scorePercentage = (correctAnswers / questions.length) * 100;
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center p-8 relative">
        <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] bg-green-500/20 rounded-full blur-[100px] pointer-events-none" />
        
        <Card className="max-w-2xl w-full bg-white/5 backdrop-blur-xl border-white/10 relative z-10 animate-in zoom-in-95 duration-500 shadow-2xl shadow-black/50">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-4">
            <div className="text-center relative">
              <svg className="w-48 h-48 mx-auto transform -rotate-90">
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={552.92} strokeDashoffset={552.92 - (552.92 * scorePercentage) / 100} className="text-primary transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-5xl font-bold tracking-tighter text-white">{Math.round(scorePercentage)}%</div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-1">Score</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20 text-green-400 mx-auto mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{correctAnswers}</div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Correct</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-400 mx-auto mb-3">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{questions.length - correctAnswers}</div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Incorrect</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 mx-auto mb-3">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">{formatTime(timer)}</div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Time</p>
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <Button size="lg" className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25" onClick={() => { setShowResults(false); setCurrentIndex(0); setSelectedAnswer(null); setShowFeedback(false); setCorrectAnswers(0); setStartTime(Date.now()); }}>
                <RotateCw className="mr-2 h-5 w-5" /> Retake Quiz
              </Button>
              <Button size="lg" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={() => setSelectedSet(null)}>
                Back to Sets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) return <div className="min-h-screen flex items-center justify-center">No questions</div>;

  const currentQuestion = questions[currentIndex];
  const isCorrect = showFeedback && selectedAnswer === currentQuestion.correct_answer;
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col relative w-full overflow-hidden">
      {/* Decorative Gradients */}
      <div className="absolute top-0 right-[10%] w-[30%] h-[30%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-[10%] w-[30%] h-[30%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="bg-white/5 border-b border-white/10 px-6 lg:px-12 py-4 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedSet(null)} className="text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronLeft className="mr-2 h-4 w-4" /> Exit
          </Button>
          <div className="flex items-center gap-6 bg-black/40 px-5 py-2 rounded-full border border-white/5 shadow-inner">
            <div className="flex items-center gap-2 text-primary">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-bold tracking-wider">{formatTime(timer)}</span>
            </div>
            <div className="h-4 w-px bg-white/20"></div>
            <div className="text-sm font-semibold tracking-wide">
              <span className="text-white">{currentIndex + 1}</span> <span className="text-gray-500">/ {questions.length}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 p-6 lg:p-8 flex items-center justify-center relative z-10 w-full">
        <div className="w-full max-w-3xl mx-auto">
          {/* Progress Bar Container */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium tracking-wide">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-primary" />
          </div>

          <div className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400">Active quiz</p>
              <p className="text-sm font-semibold text-white">{selectedSet.title}</p>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {selectedSet.topic}
            </span>
          </div>

          <Card className="mb-6 bg-white/5 backdrop-blur-xl border-white/10 shadow-xl shadow-black/20">
            <CardHeader className="pb-6 border-b border-white/5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold tracking-widest uppercase mb-4">
                Question {currentIndex + 1}
              </div>
              <CardTitle className="text-2xl text-white leading-relaxed">{currentQuestion.question}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === currentQuestion.correct_answer;
                
                let btnStyle = "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:border-white/20";
                
                if (showFeedback) {
                  if (isCorrectOption) btnStyle = "border-green-500/50 bg-green-500/20 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.15)] ring-1 ring-green-500/50";
                  else if (isSelected) btnStyle = "border-red-500/50 bg-red-500/20 text-red-300";
                  else btnStyle = "border-white/5 bg-black/20 text-gray-600 opacity-50";
                } else if (isSelected) {
                  btnStyle = "border-primary bg-primary/20 text-white shadow-[0_0_15px_rgba(var(--primary),0.3)] ring-1 ring-primary/50";
                }

                return (
                  <button 
                    key={index} 
                    onClick={() => !showFeedback && setSelectedAnswer(option)} 
                    disabled={showFeedback}
                    className={cn("w-full p-5 text-left rounded-xl transition-all duration-300 border backdrop-blur-sm group flex items-center gap-4", btnStyle)}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors",
                      showFeedback && isCorrectOption ? "border-green-400 text-green-400 bg-green-950" : 
                      showFeedback && isSelected ? "border-red-400 text-red-400 bg-red-950" :
                      isSelected ? "border-primary text-primary bg-primary/10" : "border-gray-500 text-gray-400 group-hover:border-white group-hover:text-white"
                    )}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="flex-1 text-base">{option}</span>
                    <div className="flex-shrink-0 w-6">
                      {showFeedback && isCorrectOption && <CheckCircle2 className="h-6 w-6 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-in zoom-in duration-300" />}
                      {showFeedback && isSelected && !isCorrectOption && <XCircle className="h-6 w-6 text-red-400 animate-in zoom-in duration-300" />}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {showFeedback && (
            <div className={cn(
              "mb-6 p-5 rounded-xl border backdrop-blur-md animate-in slide-in-from-top-4 duration-300 flex items-start gap-4", 
              isCorrect ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"
            )}>
              <div className={cn("p-2 rounded-full", isCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                {isCorrect ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
              </div>
              <div>
                <h3 className={cn("font-bold text-lg mb-1", isCorrect ? "text-green-300" : "text-red-300")}>
                  {isCorrect ? "Excellent! That's correct ✨" : "Not quite right"}
                </h3>
                <p className="text-gray-300 font-medium">
                  {isCorrect ? "You nailed it. Keep going!" : (
                    <span>The correct answer is <span className="text-green-400 font-bold bg-green-950/50 px-2 py-0.5 rounded ml-1">{currentQuestion.correct_answer}</span></span>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button 
              size="lg" 
              className={cn(
                "px-8 h-14 text-lg font-semibold rounded-xl shadow-xl transition-all w-full sm:w-auto",
                !selectedAnswer && !showFeedback ? "bg-white/10 text-gray-400 hover:bg-white/10 cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-white shadow-primary/25 hover:-translate-y-1"
              )}
              onClick={showFeedback ? handleNext : handleSubmitAnswer} 
              disabled={!showFeedback && !selectedAnswer}
            >
              {showFeedback ? (currentIndex < questions.length - 1 ? "Next Question" : "View Final Results") : "Submit Answer"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Quiz;
