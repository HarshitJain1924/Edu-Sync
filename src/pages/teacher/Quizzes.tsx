import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Brain, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/hooks/useRequireRole";
import { GoogleGenAI } from "@google/genai";

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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Generate Quizzes</h1>
            <p className="text-sm text-muted-foreground">Create quiz sets your students can take.</p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>New Quiz Set</CardTitle>
            <CardDescription>Start with a title, topic, and optional instructions/prompt.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleGenerate}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Calculus Quiz 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g. Limits and Derivatives"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">Instructions / Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="Short description or AI prompt for questions. (AI wiring is a future step.)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                <Brain className="mr-2 h-4 w-4" />
                {loading ? "Creating..." : "Create Quiz Set"}
              </Button>
            </form>

            {/* AI Quiz Generation */}
            <div className="pt-4 mt-4 border-t space-y-4">
              <h3 className="text-md font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Generate Quiz with AI
              </h3>
              <p className="text-sm text-muted-foreground">
                Generate a complete quiz with questions automatically
              </p>
              <div className="space-y-2">
                <Label htmlFor="ai-quiz-title">Quiz Title</Label>
                <Input
                  id="ai-quiz-title"
                  placeholder="e.g. World War II Quiz"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
              </div>
              <Button
                disabled={aiLoading || !aiTopic.trim()}
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
                        description: "Generated by AI",
                        topic: aiTopic.trim(),
                        created_by: user.id,
                      })
                      .select("id, title, description, topic, created_at")
                      .single();

                    if (quizError) throw quizError;
                    createdQuizSetId = quizSet.id;

                    // Generate questions with the same direct Gemini flow used by Placement Prep.
                    const ai = new GoogleGenAI({ apiKey: geminiKey });
                    const prompt = `Generate 5 placement-focused MCQs on "${aiTopic.trim()}".

Each question must include:
- "question": string
- "options": array of exactly 4 options
- "correctAnswer": exact text matching one option

Return ONLY a valid JSON array of question objects. No markdown.`;

                    const raw = await callGeminiWithRetry(ai, prompt);
                    const clean = String(raw).replace(/```json/g, "").replace(/```/g, "").trim();
                    const match = clean.match(/\[[\s\S]*\]/);
                    if (!match) throw new Error("Invalid AI response format.");

                    const generatedQuestions = JSON.parse(match[0]) as {
                      question: string;
                      options: string[];
                      correctAnswer: string;
                    }[];

                    if (!generatedQuestions.length) {
                      toast({
                        title: "No questions generated",
                        description: "Try a different topic.",
                      });
                      return;
                    }

                    // Insert questions into quiz_questions table
                    const inserts = generatedQuestions.map((q, idx) => ({
                      quiz_id: quizSet.id,
                      question: q.question,
                      options: q.options,
                      correct_answer: q.correctAnswer,
                      order_index: idx,
                    }));

                    const { error: insertError } = await supabase
                      .from("quiz_questions")
                      .insert(inserts);

                    if (insertError) throw insertError;

                    toast({
                      title: "AI quiz created",
                      description: `Created "${aiTopic.trim()}" with ${generatedQuestions.length} questions.`,
                    });

                    setQuizzes((prev) => [quizSet, ...prev]);
                    setAiTopic("");
                  } catch (err: any) {
                    if (createdQuizSetId) {
                      await supabase.from("quiz_sets").delete().eq("id", createdQuizSetId);
                    }
                    if (import.meta.env.DEV) console.error("AI quiz error", err);
                    toast({
                      title: "Generation failed",
                      description: err?.message || "Could not generate quiz.",
                      variant: "destructive",
                    });
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                <Brain className="mr-2 h-4 w-4" />
                {aiLoading ? "Generating..." : "Generate Quiz with AI"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Quiz Sets</CardTitle>
            <CardDescription>Recent quizzes you have created.</CardDescription>
          </CardHeader>
          <CardContent>
            {quizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quizzes yet. Create your first quiz set above.</p>
            ) : (
              <div className="space-y-3">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="w-full flex items-center justify-between p-3 bg-muted rounded-lg gap-3"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => handleSelectQuiz(quiz)}
                        className="font-medium hover:underline text-left"
                      >
                        {quiz.title}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {quiz.topic} {quiz.description && `• ${quiz.description}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(quiz.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteQuiz(quiz)}
                        disabled={loading}
                      >
                        Delete Quiz
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedQuiz && (
          <Card>
            <CardHeader>
              <CardTitle>Questions for: {selectedQuiz.title}</CardTitle>
              <CardDescription>
                Add, view, or delete questions in this quiz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form className="space-y-4" onSubmit={handleAddQuestion}>
                <div className="space-y-2">
                  <Label htmlFor="question">Question</Label>
                  <Textarea
                    id="question"
                    placeholder="Enter the question"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="optionA">Option A</Label>
                    <Input
                      id="optionA"
                      value={optionA}
                      onChange={(e) => setOptionA(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="optionB">Option B</Label>
                    <Input
                      id="optionB"
                      value={optionB}
                      onChange={(e) => setOptionB(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="optionC">Option C</Label>
                    <Input
                      id="optionC"
                      value={optionC}
                      onChange={(e) => setOptionC(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="optionD">Option D</Label>
                    <Input
                      id="optionD"
                      value={optionD}
                      onChange={(e) => setOptionD(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correct">Correct Answer (must match one option)</Label>
                  <Input
                    id="correct"
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={questionsLoading}>
                  {questionsLoading ? "Saving..." : "Add Question"}
                </Button>
              </form>

              <div className="space-y-3">
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No questions yet for this quiz.
                  </p>
                ) : (
                  questions.map((q, index) => (
                    <div
                      key={q.id}
                      className="p-3 bg-muted rounded-lg flex justify-between items-start gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          Q{index + 1}. {q.question}
                        </p>
                        <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                          {q.options.map((opt, i) => (
                            <li key={i}>
                              {opt}
                              {opt === q.correct_answer && " (correct)"}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t space-y-3">
                <h3 className="text-base font-semibold">Student Attempts</h3>
                {attemptsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading attempts...</p>
                ) : attempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No student attempts yet for this quiz.</p>
                ) : (
                  <div className="space-y-2">
                    {attempts.map((attempt) => (
                      <div key={`${attempt.user_id}-${attempt.completed_at || "latest"}`} className="p-3 rounded-lg bg-muted flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{attempt.student_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attempt.correct_answers}/{attempt.total_questions} correct • {Math.floor(attempt.time_taken / 60)}m {attempt.time_taken % 60}s
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{attempt.score}%</p>
                          <p className="text-xs text-muted-foreground">
                            {attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : "-"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
