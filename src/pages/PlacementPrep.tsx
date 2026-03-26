import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain, BookOpen, Clock, ChevronRight, Trophy, Target, TrendingUp,
  Zap, CheckCircle2, XCircle, ArrowRight, BarChart3, Award,
  Timer, Sparkles, GraduationCap, Building2, Code2, Users, ChevronLeft,
  RotateCcw, AlertTriangle, Upload, Trash2, BookMarked, Play
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePlacementQuestionsStats, useRefreshQuestions } from "@/hooks/usePlacementQuestions";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import { PracticeMode } from "@/components/PracticeMode";
import { GoogleGenAI } from "@google/genai";
import { runCode } from "@/lib/compiler";
import {
  parsePlacementQuestionBank,
  filterCompanyQuestionsByDifficulty,
  parsePlacementQuestionsFromText,
  inferCompanyId,
  normalizeCompanyId,
} from "@/lib/placement-question-bank";

// ---------- Types ----------
interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty?: string;
}

interface CodingQuestion {
  title: string;
  difficulty: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: { input: string; output: string }[];
  starterCode: { cpp: string; java: string; python: string; [key: string]: string };
  solution: string;
  spaceComplexity: string;
  testCases: { input: string; output: string }[];
}

interface ScoreEntry {
  id: string;
  user_id: string;
  score: number;
  total: number;
  test_type: string;
  topic: string;
  time_taken: number;
  questions?: QuizQuestion[];
  created_at: string;
  profiles?: { username: string };
}

// ---------- Constants ----------
const TOPICS = [
  { id: "dsa", label: "Data Structures & Algorithms", icon: "🧮", color: "from-blue-500 to-cyan-500", count: 15 },
  { id: "os", label: "Operating Systems", icon: "🖥️", color: "from-green-500 to-emerald-500", count: 15 },
  { id: "dbms", label: "Database Management", icon: "🗄️", color: "from-purple-500 to-violet-500", count: 15 },
  { id: "cn", label: "Computer Networks", icon: "🌐", color: "from-orange-500 to-red-500", count: 15 },
  { id: "oops", label: "Object-Oriented Programming", icon: "📦", color: "from-pink-500 to-rose-500", count: 15 },
  { id: "aptitude", label: "Quantitative Aptitude", icon: "📊", color: "from-amber-500 to-yellow-500", count: 15 },
  { id: "sql", label: "SQL & Databases", icon: "📝", color: "from-teal-500 to-cyan-500", count: 15 },
  { id: "sysdesign", label: "System Design Basics", icon: "🏗️", color: "from-indigo-500 to-blue-500", count: 10 },
];

const COMPANIES = [
  { id: "tcs", label: "TCS Digital / NQT", icon: "🏢", color: "from-blue-600 to-blue-400", sections: ["Aptitude", "Logical Reasoning", "Verbal", "Programming"], difficulty: "Medium" },
  { id: "infosys", label: "Infosys InfyTQ", icon: "🏛️", color: "from-sky-600 to-sky-400", sections: ["Reasoning", "Java Basics", "DBMS", "Aptitude"], difficulty: "Medium" },
  { id: "wipro", label: "Wipro NLTH", icon: "🏗️", color: "from-purple-600 to-purple-400", sections: ["Aptitude", "Verbal", "Coding (MCQ)", "Technical"], difficulty: "Medium" },
  { id: "amazon", label: "Amazon SDE", icon: "📦", color: "from-orange-600 to-yellow-500", sections: ["DSA", "Problem Solving", "System Design", "LP/Behavioral"], difficulty: "Hard" },
  { id: "microsoft", label: "Microsoft SDE", icon: "🪟", color: "from-cyan-600 to-blue-500", sections: ["Algorithms", "System Design", "OS", "Problem Solving"], difficulty: "Hard" },
  { id: "google", label: "Google SWE", icon: "🔍", color: "from-green-500 to-blue-500", sections: ["DSA", "Algorithms", "System Design", "Coding"], difficulty: "Hard" },
];

const DIFFICULTIES = [
  { id: "easy", label: "Easy", color: "text-green-400 bg-green-500/15 border-green-500/30" },
  { id: "medium", label: "Medium", color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30" },
  { id: "hard", label: "Hard", color: "text-red-400 bg-red-500/15 border-red-500/30" },
  { id: "placement", label: "Placement Level", color: "text-purple-400 bg-purple-500/15 border-purple-500/30" },
];

const QUESTION_BANK_STORAGE_KEY = "placement_question_bank_v1";

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

interface PdfParseApiResponse {
  text?: string;
  questions?: unknown[];
}

const asUnknownRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

// ---------- Component ----------
const PlacementPrep = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: qStats } = usePlacementQuestionsStats();
  const { invalidateAll } = useRefreshQuestions();

  // UI states
  const [mode, setMode] = useState<"quiz" | "practice">("quiz"); // NEW: Mode toggle
  const [activeTab, setActiveTab] = useState<"home" | "quiz" | "results">("home");
  const [quizType, setQuizType] = useState<"topic" | "company" | "mock" | "coding">("topic");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [showDifficultyPicker, setShowDifficultyPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; id: string } | null>(null);

  // Quiz states
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<"cpp" | "java" | "python">("python");
  const [userCode, setUserCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [executionResult, setExecutionResult] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [questionBank, setQuestionBank] = useState<Record<string, QuizQuestion[]>>({});
  const [bankSummary, setBankSummary] = useState({ companies: 0, questions: 0 });

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bankFileInputRef = useRef<HTMLInputElement | null>(null);

  // Results & analytics
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [weakTopics, setWeakTopics] = useState<{ topic: string; score: number }[]>([]);
  const [totalTests, setTotalTests] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  // -- Effects --
  useEffect(() => {
    fetchScores();
    fetchLeaderboard();

    try {
      const raw = localStorage.getItem(QUESTION_BANK_STORAGE_KEY);
      if (!raw) return;

      const parsed = parsePlacementQuestionBank(JSON.parse(raw));
      const normalizedCompanies: Record<string, QuizQuestion[]> = {};
      let totalQuestions = 0;

      Object.entries(parsed.companies).forEach(([company, rows]) => {
        const normalizedRows: QuizQuestion[] = rows.map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || "No explanation provided.",
          difficulty: q.difficulty,
        }));
        normalizedCompanies[company] = normalizedRows;
        totalQuestions += normalizedRows.length;
      });

      setQuestionBank(normalizedCompanies);
      setBankSummary({
        companies: Object.keys(normalizedCompanies).length,
        questions: totalQuestions,
      });
    } catch {
      localStorage.removeItem(QUESTION_BANK_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setTimerActive(false);
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  // -- Data Fetching --
  const fetchScores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("placement_scores")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) {
        setScores(data);
        setTotalTests(data.length);
        const avg = data.length > 0 ? Math.round(data.reduce((a, s) => a + (s.score / s.total) * 100, 0) / data.length) : 0;
        setAvgScore(avg);
        // Find weak topics
        const topicMap: Record<string, { total: number; correct: number }> = {};
        data.forEach((s) => {
          if (!topicMap[s.topic]) topicMap[s.topic] = { total: 0, correct: 0 };
          topicMap[s.topic].total += s.total;
          topicMap[s.topic].correct += s.score;
        });
        const weak = Object.entries(topicMap)
          .map(([topic, v]) => ({ topic, score: Math.round((v.correct / v.total) * 100) }))
          .filter((t) => t.score < 60)
          .sort((a, b) => a.score - b.score);
        setWeakTopics(weak);
      }
    } catch { /* table may not exist yet */ }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from("placement_scores")
        .select("*, profiles:user_id (username)")
        .order("score", { ascending: false })
        .limit(10);
      if (data) setLeaderboard(data);
    } catch { /* table may not exist yet */ }
  };

  const extractText = (response: any): string => {
    // Case 1: text() function
    if (response && typeof response.text === "function") {
      return response.text();
    }
  
    // Case 2: direct text string
    if (response && typeof response.text === "string") {
      return response.text;
    }
  
    // Case 3: candidates structure (most reliable fallback)
    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
  
    // Case 4: safety fallback
    throw new Error("Unable to extract text from Gemini response");
  };

  // -- AI Generation with retry & fallback models --
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const callWithRetry = async (ai: InstanceType<typeof GoogleGenAI>, prompt: string): Promise<string> => {
    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await ai.models.generateContent({ model, contents: prompt });
          const response = result.response || result;
          return extractText(response);
        } catch (err: any) {
          const msg = err?.message || "";
          // Rate limited — extract retry delay
          if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
            const delayMatch = msg.match(/retry\s+in\s+([\d.]+)/i) || msg.match(/retryDelay.*?(\d+)/);
            const waitSecs = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) + 2 : 40;
            if (attempt === 0) {
              // Countdown timer for the user
              for (let s = waitSecs; s > 0; s--) {
                setGenProgress(`⏳ Rate limited on ${model}. Retrying in ${s}s...`);
                await sleep(1000);
              }
              continue; // retry same model
            }
            // After retry, try next model
            setGenProgress(`Switching to next model...`);
            break;
          }
          throw err; // non-rate-limit error
        }
      }
    }
    throw new Error("All AI models rate-limited. Please wait 1-2 minutes and try again.");
  };

  const generateQuestions = async (type: "topic" | "company" | "mock" | "coding", id: string, difficulty: string) => {
    if (type === "company") {
      const bankRows = questionBank[id] || [];
      const filtered = filterCompanyQuestionsByDifficulty(bankRows, difficulty);
      const selected = shuffle(filtered)
        .slice(0, Math.min(15, filtered.length))
        .map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || "No explanation provided.",
          difficulty: q.difficulty,
        }));

      if (selected.length > 0) {
        setQuizType(type);
        setQuestions(selected);
        setCodingQuestions([]);
        setAnswers(new Array(selected.length).fill(null));
        setCurrentQ(0);
        setSelectedAnswer(null);
        setShowExplanation(false);
        setTimeLeft(20 * 60);
        setTimerActive(true);
        setActiveTab("quiz");
        setExecutionResult("");
        setIsRunning(false);
        setGenProgress(`Loaded ${selected.length} bank questions for ${COMPANIES.find((c) => c.id === id)?.label || id}.`);
        return;
      }
    }

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) {
      setGenProgress("⚠️ No imported bank questions found for this mode and Gemini key is missing. Import a question-bank JSON or set VITE_GEMINI_API_KEY.");
      return;
    }

    setIsGenerating(true);
    setGenProgress("Initializing AI...");
    setQuizType(type);

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      let prompt = "";
      let numQ = 15;
      let timeMins = 15;

      if (type === "coding") {
        numQ = 3;
        timeMins = 45;
        prompt = `Generate 3 ${difficulty}-level LeetCode-style coding questions for campus placement preparation.

Each question must be a JSON object matching this structure exactly:
{
  "title": "Problem Title",
  "difficulty": "Easy/Medium/Hard",
  "description": "Full problem description...",
  "inputFormat": "Explanation of input format",
  "outputFormat": "Explanation of output format",
  "constraints": ["Constraint 1", "Constraint 2"],
  "examples": [{"input": "...", "output": "..."}],
  "starterCode": {"cpp": "...", "java": "...", "python": "..."},
  "solution": "Explain the optimal approach, algorithm, and data structures used.",
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "testCases": [
    { "input": "1 2 3", "output": "3 2 1" },
    { "input": "10 20", "output": "20 10" }
  ]
}

Difficulty: ${difficulty}. The questions should be standard Data Structures and Algorithms problems.

Also include:
"testCases": array of 3-5 test cases with input and expected output.

Ensure:
- Input format matches stdin perfectly
- Output format is exact output (no extra spaces/newlines)

Return ONLY a JSON array of exactly 3 question objects. No extra text.`;
      } else if (type === "topic") {
        const topic = TOPICS.find((t) => t.id === id)?.label || id;
        prompt = `Generate ${numQ} ${difficulty}-level multiple choice placement exam questions on the topic "${topic}".

Each question must have:
- "question": the question text
- "options": array of exactly 4 options
- "correctAnswer": the correct option (must match one of the options exactly)
- "explanation": a brief explanation of why the correct answer is right (2-3 sentences)

Difficulty: ${difficulty}. Questions should match the level asked in campus placement written exams.

Return ONLY a JSON array of ${numQ} question objects. No extra text.`;
      } else if (type === "company") {
        const company = COMPANIES.find((c) => c.id === id);
        numQ = 15;
        timeMins = 20;
        const companyPrompts: Record<string, string> = {
          tcs: `Generate ${numQ} TCS NQT / TCS Digital placement test style questions. Include a mix of quantitative aptitude, logical reasoning, verbal ability, and basic programming MCQs. Difficulty: ${difficulty}. Match the actual TCS exam pattern.`,
          infosys: `Generate ${numQ} Infosys InfyTQ / Infosys placement test style questions. Include logical reasoning, Java basics, DBMS concepts, and quantitative aptitude. Difficulty: ${difficulty}.`,
          wipro: `Generate ${numQ} Wipro NLTH / Wipro placement test style questions. Include aptitude, verbal ability, coding MCQs, and technical fundamentals. Difficulty: ${difficulty}.`,
          amazon: `Generate ${numQ} Amazon SDE interview style MCQs. Focus on data structures, algorithms, problem solving, and system design basics. Difficulty: ${difficulty}. These should match Amazon's bar.`,
          microsoft: `Generate ${numQ} Microsoft SDE interview MCQs. Focus on algorithms, system design basics, OS concepts, and problem-solving ability. Difficulty: ${difficulty}.`,
          google: `Generate ${numQ} Google SWE interview style MCQs. Focus on algorithms, data structures, system design, and coding concepts. Difficulty: ${difficulty}. High quality questions expected.`,
        };
        prompt = `${companyPrompts[id] || `Generate ${numQ} placement test questions for ${company?.label || id}.`}

Each question must have:
- "question": the question text
- "options": array of exactly 4 options
- "correctAnswer": the correct option (must match one of the options exactly)
- "explanation": a brief explanation of why this is the correct answer (2-3 sentences)

Return ONLY a JSON array of ${numQ} question objects. No extra text.`;
      } else {
        // Mock test — mixed
        numQ = 30;
        timeMins = 30;
        prompt = `Generate a 30-question mock campus placement test with this distribution:
- 10 quantitative aptitude questions
- 10 technical fundamentals questions (OS, DBMS, CN, OOPs mix)
- 10 logical reasoning questions

Difficulty: ${difficulty}. Questions should match real campus placement exam standards.

Each question must have:
- "question": the question text
- "options": array of exactly 4 options
- "correctAnswer": the correct option (must match one of the options exactly)
- "explanation": a brief explanation (2-3 sentences)

Return ONLY a JSON array of 30 question objects. No extra text.`;
      }

      const text = await callWithRetry(ai, prompt);
      const cleanText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Invalid AI response format");

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No questions generated");

      if (type === "coding") {
        const cq = parsed.slice(0, numQ);
        setCodingQuestions(cq);
        setQuestions([]);
        setUserCode(cq[0]?.starterCode?.python || "");
        setCodeLanguage("python");
      } else {
        setQuestions(parsed.slice(0, numQ));
        setCodingQuestions([]);
      }
      
      setAnswers(new Array(parsed.slice(0, numQ).length).fill(null));
      setCurrentQ(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setTimeLeft(timeMins * 60);
      setTimerActive(true);
      setActiveTab("quiz");
      setGenProgress("");
      setExecutionResult("");
      setIsRunning(false);
    } catch (err: any) {
      console.error("AI generation error:", err);
      setGenProgress(`❌ ${err.message || "Unknown error"}. Please wait a minute and try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

  const handleAnswer = (option: string) => {
    setSelectedAnswer(option);
    const newAnswers = [...answers];
    newAnswers[currentQ] = option;
    setAnswers(newAnswers);
    setShowExplanation(true);
  };

  const convertArrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const applyParsedBank = async (companiesMap: Record<string, QuizQuestion[]>) => {
    let total = 0;
    Object.values(companiesMap).forEach((rows) => {
      total += rows.length;
    });

    if (total === 0) {
      setGenProgress("❌ No valid questions found. Ensure file has company, question, options, and correctAnswer (or clear MCQ pattern in PDF).");
      return;
    }

    // Convert to database format and save
    const questionsToSave: any[] = [];
    Object.entries(companiesMap).forEach(([company, questions]) => {
      questions.forEach((q) => {
        questionsToSave.push({
          company: company || "general",
          question: q.question,
          options: q.options,
          correct_answer: q.correctAnswer,
          difficulty: q.difficulty || "placement",
          explanation: q.explanation,
        });
      });
    });

    try {
      setGenProgress("💾 Saving questions to database...");
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !isAdmin) {
        setGenProgress("❌ Admin access required to save questions.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("http://localhost:4000/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ questions: questionsToSave }),
      });

      if (!response.ok) {
        throw new Error("Failed to save to database");
      }

      const result = await response.json();
      
      // Also update local storage for backward compatibility
      setQuestionBank(companiesMap);
      setBankSummary({ companies: Object.keys(companiesMap).length, questions: total });
      localStorage.setItem(QUESTION_BANK_STORAGE_KEY, JSON.stringify({ companies: companiesMap }));
      
      // Invalidate cache to refresh the stats
      invalidateAll();
      
      setGenProgress(`✅ Successfully imported ${result.inserted || total} questions to database across ${Object.keys(companiesMap).length} companies.`);
    } catch (err) {
      console.error("Error saving to database:", err);
      setGenProgress("❌ Failed to save to database. Check server connection.");
    }
  };

  const extractPdfPayload = async (base64: string): Promise<{ text: string; questions: unknown[] }> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const endpoints = ["/api/parse-resume-pdf", "http://localhost:4000/api/parse-resume-pdf"];
    let lastError = "";

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ data: base64 }),
        });

        const raw = await response.text();
        if (!response.ok) {
          lastError = `${endpoint} returned ${response.status}`;
          continue;
        }

        let parsed: PdfParseApiResponse | null = null;
        try {
          parsed = JSON.parse(raw) as PdfParseApiResponse;
        } catch {
          lastError = `${endpoint} returned non-JSON response`;
          continue;
        }

        const text = String(parsed?.text || "").trim();
        const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
        if (text || questions.length > 0) {
          return { text, questions };
        }

        lastError = `${endpoint} returned empty text`;
      } catch (err: any) {
        lastError = err?.message || `Failed calling ${endpoint}`;
      }
    }

    throw new Error(lastError || "Could not reach PDF parser service");
  };

  const handleQuestionBankImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      setGenProgress("❌ Only admins can upload question banks.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        setGenProgress("Uploading PDF and extracting text...");
        const buffer = await file.arrayBuffer();
        const base64 = convertArrayBufferToBase64(buffer);
        const parsedPayload = await extractPdfPayload(base64);
        const text = String(parsedPayload?.text || "").trim();
        const backendQuestions = Array.isArray(parsedPayload?.questions) ? parsedPayload.questions : [];

        const normalizedFromPdf: Record<string, QuizQuestion[]> = {};

        if (backendQuestions.length > 0) {
          backendQuestions.forEach((rawRow) => {
            const row = asUnknownRecord(rawRow);
            if (!row) return;

            const question = String(row.question || "").trim();
            const options = Array.isArray(row.options)
              ? row.options.map((o: unknown) => String(o).trim()).filter(Boolean)
              : [];
            const correctAnswer = String(row.correctAnswer || "").trim();
            const explanation = String(row.explanation || "Imported from question bank PDF.").trim();
            const companyId =
              normalizeCompanyId(String(row.company || "")) ||
              inferCompanyId(file.name) ||
              "wipro";

            if (!question || options.length < 2 || !correctAnswer) return;
            normalizedFromPdf[companyId] = normalizedFromPdf[companyId] || [];
            normalizedFromPdf[companyId].push({
              question,
              options,
              correctAnswer,
              explanation,
              difficulty: String(row.difficulty || "placement"),
            });
          });
        }

        if (Object.keys(normalizedFromPdf).length > 0) {
          await applyParsedBank(normalizedFromPdf);
          return;
        }

        if (!text) {
          setGenProgress("❌ PDF has no readable text. Try a text-based PDF or JSON export.");
          return;
        }

        const companyHint = inferCompanyId(file.name);
        const parsedFromPdf = parsePlacementQuestionsFromText(text, companyHint);
        const normalizedFromText: Record<string, QuizQuestion[]> = {};

        Object.entries(parsedFromPdf.companies).forEach(([companyId, rows]) => {
          normalizedFromText[companyId] = rows.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "Imported from question bank PDF.",
            difficulty: q.difficulty,
          }));
        });

        await applyParsedBank(normalizedFromText);
      } else {
        const text = await file.text();
        const payload = JSON.parse(text);
        const parsed = parsePlacementQuestionBank(payload);
        const nextBank: Record<string, QuizQuestion[]> = {};

        Object.entries(parsed.companies).forEach(([companyId, rows]) => {
          const normalizedRows: QuizQuestion[] = rows.map((q) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "No explanation provided.",
            difficulty: q.difficulty,
          }));

          if (normalizedRows.length > 0) {
            nextBank[companyId] = normalizedRows;
          }
        });

        await applyParsedBank(nextBank);
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("returned 401") || msg.includes("returned 403")) {
        setGenProgress("❌ Admin authorization failed. Please re-login with an admin account and try again.");
      } else if (msg.includes("returned 404")) {
        setGenProgress("❌ PDF parser API route not found. Ensure backend server is running and endpoint is available.");
      } else if (msg.includes("localhost:4000") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setGenProgress("❌ PDF parser server is not reachable. Start backend with: node server.js, then try again.");
      } else {
        setGenProgress("❌ Could not import this file. Upload a valid JSON or a text-readable PDF.");
      }
    } finally {
      event.target.value = "";
    }
  };

  const clearQuestionBank = async () => {
    if (!isAdmin) {
      setGenProgress("❌ Only admins can clear the question bank.");
      return;
    }

    try {
      setGenProgress("🗑️ Clearing question bank...");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      await fetch("http://localhost:4000/api/questions", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });

      setQuestionBank({});
      setBankSummary({ companies: 0, questions: 0 });
      localStorage.removeItem(QUESTION_BANK_STORAGE_KEY);
      invalidateAll();
      setGenProgress("✅ Bank cache and database cleared.");
    } catch (err) {
      console.error("Error clearing bank:", err);
      setGenProgress("❌ Failed to clear database. Check server connection.");
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setExecutionResult("Running...");

    try {
      const result = await runCode(userCode, codeLanguage);
      setExecutionResult(result.stdout || result.stderr || result.compile_output || "Program finished with no output");
    } catch (err) {
      setExecutionResult("Execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  const submitCode = async () => {
    const testCases = codingQuestions[currentQ].testCases;

    if (!testCases || testCases.length === 0) {
        setExecutionResult("❌ Missing test cases for this problem.");
        setShowExplanation(true);
        return;
    }

    setIsRunning(true);
    let allPassed = true;
    let outputLog = "Running test cases...\n\n";

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const result = await runCode(userCode, codeLanguage, tc.input);

      const actual = result.stdout;
      const expected = tc.output;

      if (normalize(actual) !== normalize(expected)) {
        allPassed = false;
        outputLog += `❌ Test Case ${i + 1} Failed\nInput: ${tc.input}\nExpected: ${expected.trim()}\nGot:\n${actual.trim() || result.stderr || "No output"}\n\n`;
        break; // Stop at first failure like LeetCode
      } else {
        outputLog += `✅ Test Case ${i + 1} Passed\n`;
      }
    }

    if (allPassed) {
      outputLog += "\n🎉 Accepted! All test cases passed.";
      const newAnswers = [...answers];
      newAnswers[currentQ] = "correct";
      setAnswers(newAnswers);
    } else {
      outputLog += "\n❌ Wrong Answer. Some test cases failed.";
      // Do not mark as correct, leave null so they can't farm points
    }

    setExecutionResult(outputLog);
    setShowExplanation(true);
    setIsRunning(false);
  };

  const nextQuestion = () => {
    const isCoding = quizType === "coding";
    const qList = isCoding ? codingQuestions : questions;
    if (currentQ < qList.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(answers[currentQ + 1] || null);
      setShowExplanation(answers[currentQ + 1] !== null);
      if (isCoding) setUserCode(codingQuestions[currentQ + 1].starterCode[codeLanguage] || "");
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    const isCoding = quizType === "coding";
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      setSelectedAnswer(answers[currentQ - 1] || null);
      setShowExplanation(answers[currentQ - 1] !== null);
      if (isCoding) setUserCode(codingQuestions[currentQ - 1].starterCode[codeLanguage] || "");
    }
  };

  const handleAutoSubmit = () => {
    finishQuiz();
  };

  const finishQuiz = async () => {
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const score = quizType === "coding" 
      ? answers.filter(Boolean).length 
      : answers.reduce((acc, ans, i) => acc + (ans === questions[i]?.correctAnswer ? 1 : 0), 0);
    const total = quizType === "coding" ? codingQuestions.length : questions.length;
    setActiveTab("results");

    // Save to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const topicLabel = quizType === "topic"
          ? (TOPICS.find((t) => t.id === selectedTopic)?.label || selectedTopic)
          : quizType === "company"
            ? (COMPANIES.find((c) => c.id === selectedCompany)?.label || selectedCompany)
            : "Mock Test";

        await supabase.from("placement_scores").insert({
          user_id: user.id,
          score,
          total,
          test_type: quizType,
          topic: quizType === "coding" ? `Coding (${selectedDifficulty})` : topicLabel,
          time_taken: (quizType === "coding" ? 45 * 60 : (quizType === "mock" ? 30 * 60 : 15 * 60)) - timeLeft,
          questions: quizType === "coding" ? codingQuestions as any : questions, // Save the AI-generated questions
        });
        fetchScores();
        fetchLeaderboard();
      }
    } catch (err) { 
      console.error("Failed to save score:", err);
    }
  };

  const retakeQuiz = (entry: ScoreEntry) => {
    if (!entry.questions || entry.questions.length === 0) {
      // If for some reason questions are missing, fall back to generation if possible
      // but usually we want to return
      console.warn("No questions found in this score entry");
      return;
    }

    setQuizType(entry.test_type as any);
    if (entry.test_type === "coding") {
      setCodingQuestions(entry.questions as any[]);
      setQuestions([]);
      setUserCode((entry.questions as any[])[0]?.starterCode?.python || "");
      setCodeLanguage("python");
    } else {
      setQuestions(entry.questions);
      setCodingQuestions([]);
    }
    setAnswers(new Array(entry.questions.length).fill(null));
    setCurrentQ(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    
    const timeMins = entry.test_type === "coding" ? 45 : (entry.test_type === "mock" ? 30 : 15);
    setTimeLeft(timeMins * 60);
    setTimerActive(true);
    setActiveTab("quiz");
    setGenProgress("");
  };

  const resetQuiz = () => {
    setActiveTab("home");
    setQuestions([]);
    setCodingQuestions([]);
    setUserCode("");
    setAnswers([]);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setTimerActive(false);
    setTimeLeft(0);
    setGenProgress("");
  };

  // Difficulty picker wrapper
  const startWithDifficulty = (type: "topic" | "company" | "mock", id: string) => {
    setPendingAction({ type, id });
    setQuizType(type as "topic" | "company" | "mock");
    if (type === "topic") setSelectedTopic(id);
    if (type === "company") setSelectedCompany(id);
    setShowDifficultyPicker(true);
  };

  const confirmDifficulty = (diff: string) => {
    setSelectedDifficulty(diff);
    setShowDifficultyPicker(false);
    if (pendingAction) {
      generateQuestions(pendingAction.type as any, pendingAction.id, diff);
    }
  };

  // -- Helpers --
  const formatTime = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  const getScore = () => answers.reduce((acc, ans, i) => acc + (ans === questions[i]?.correctAnswer ? 1 : 0), 0);

  // ---------- RENDER ----------
  // Show practice mode if selected
  if (mode === "practice") {
    return (
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <main className="ml-64">
          <PracticeMode onBack={() => setMode("quiz")} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">

          {/* ========== DIFFICULTY PICKER MODAL ========== */}
          {showDifficultyPicker && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowDifficultyPicker(false)}>
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-2">Select Difficulty</h3>
                <p className="text-slate-600 dark:text-gray-400 text-sm mb-6">Choose the difficulty level for your practice session</p>
                <div className="grid grid-cols-2 gap-3">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => confirmDifficulty(d.id)}
                      className={`p-4 rounded-xl border text-center font-semibold transition-all hover:scale-105 ${d.color}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========== HOME TAB ========== */}
          {activeTab === "home" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Header with Mode Toggle */}
              <header>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-primary to-indigo-600 rounded-xl shadow-lg">
                        <GraduationCap className="h-7 w-7 text-white" />
                      </div>
                      Placement Prep
                    </h1>
                    <p className="text-slate-600 dark:text-gray-400 mt-2">AI-powered preparation for campus placements & interviews</p>
                  </div>

                  {/* Mode Toggle */}
                  <div className="flex gap-2 bg-white/5 border border-white/10 rounded-lg p-1.5">
                    <button
                      onClick={() => setMode("quiz")}
                      className={`px-4 py-2 rounded-md font-semibold transition-all ${
                        mode === "quiz"
                          ? "bg-primary text-white"
                          : "hover:bg-white/10 text-slate-400"
                      }`}
                    >
                      🎯 Quiz Mode
                    </button>
                    <button
                      onClick={() => setMode("practice")}
                      className={`px-4 py-2 rounded-md font-semibold transition-all ${
                        mode === "practice"
                          ? "bg-primary text-white"
                          : "hover:bg-white/10 text-slate-400"
                      }`}
                    >
                      📖 Practice Mode
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 text-xs"
                    onClick={() => navigate("/resume-builder")}
                  >
                    Build / Improve My Resume
                  </Button>

                  {/* ADMIN ONLY: Question Bank Controls */}
                  {!roleLoading && isAdmin && (
                    <div className="border-l border-white/10 pl-3">
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          className="border-blue-500/40 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 text-xs"
                          onClick={() => bankFileInputRef.current?.click()}
                        >
                          <Upload className="h-3 w-3 mr-1" /> Import PDF/JSON
                        </Button>
                        <input
                          ref={bankFileInputRef}
                          type="file"
                          accept=".pdf,.json"
                          onChange={handleQuestionBankImport}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          className="border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 text-xs"
                          onClick={clearQuestionBank}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Clear Bank
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Database Statistics */}
                {qStats && (
                  <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <p className="text-xs text-slate-400">
                      📚 Database: <span className="text-white font-semibold">{qStats.total}</span> questions across{" "}
                      <span className="text-white font-semibold">{qStats.companies}</span> companies
                    </p>
                  </div>
                )}
              </header>

              {/* Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20"><Target className="h-5 w-5 text-blue-400" /></div>
                      <div>
                        <p className="text-2xl font-bold text-white">{avgScore}%</p>
                        <p className="text-xs text-slate-600 dark:text-gray-400">Avg Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20"><CheckCircle2 className="h-5 w-5 text-green-400" /></div>
                      <div>
                        <p className="text-2xl font-bold text-white">{totalTests}</p>
                        <p className="text-xs text-slate-600 dark:text-gray-400">Tests Taken</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/20">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20"><BarChart3 className="h-5 w-5 text-purple-400" /></div>
                      <div>
                        <p className="text-2xl font-bold text-white">{scores.filter((s) => (s.score / s.total) >= 0.7).length}</p>
                        <p className="text-xs text-slate-600 dark:text-gray-400">Topics Mastered</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/20"><AlertTriangle className="h-5 w-5 text-orange-400" /></div>
                      <div>
                        <p className="text-2xl font-bold text-white">{weakTopics.length}</p>
                        <p className="text-xs text-slate-600 dark:text-gray-400">Weak Areas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Weak Topics Adaptive Recommendation */}
              {weakTopics.length > 0 && (
                <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-orange-400" /> Recommended Practice
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {weakTopics.slice(0, 4).map((wt) => (
                      <button
                        key={wt.topic}
                        onClick={() => startWithDifficulty("topic", TOPICS.find((t) => t.label === wt.topic)?.id || "aptitude")}
                        className="flex-shrink-0 bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all min-w-[180px]"
                      >
                        <p className="text-sm font-semibold text-white">{wt.topic}</p>
                        <p className="text-xs text-red-400 mt-1">Last score: {wt.score}%</p>
                        <p className="text-xs text-primary mt-2">Practice Again →</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Practice History */}
              {scores.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-400" /> Recent Practice History
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scores.slice(0, 6).map((s) => (
                      <Card key={s.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{s.topic}</p>
                              <p className="text-[10px] text-gray-500">{new Date(s.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              (s.score / s.total) >= 0.7 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                            }`}>
                              {Math.round((s.score / s.total) * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-3">
                            <span>{s.score}/{s.total} Correct</span>
                            <span>{formatTime(s.time_taken)} taken</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full h-8 text-xs text-primary hover:bg-primary/10 border border-primary/20"
                            onClick={() => retakeQuiz(s)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Retake This Test
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isGenerating && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-white font-medium">{genProgress}</p>
                </div>
              )}
              {!isGenerating && genProgress && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center text-red-300 text-sm">{genProgress}</div>
              )}

              {/* Coding Practice Section */}
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <Code2 className="h-5 w-5 text-pink-400" /> Coding Practice
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {[
                    { id: "easy", label: "Easy Level", color: "from-green-600 to-green-400 border-green-500/30" },
                    { id: "medium", label: "Medium Level", color: "from-yellow-600 to-yellow-400 border-yellow-500/30" },
                    { id: "hard", label: "Hard Level", color: "from-red-600 to-red-400 border-red-500/30" }
                  ].map((level) => (
                    <Card
                      key={level.id}
                      className={`bg-white/5 border ${level.color} hover:bg-white/10 cursor-pointer transition-all duration-300 group hover:scale-[1.02]`}
                      onClick={() => generateQuestions("coding", "coding", level.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{level.label}</h3>
                          <Code2 className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm text-gray-400">Practice standard {level.label.split(' ')[0]} DS & Algo problems.</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* TCS Digital / NQT Section */}
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-blue-400" /> Company Exam Modes
                </h2>

                {!roleLoading && isAdmin && (
                  <Card className="bg-white/5 border-white/10 mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">Use Your Own Question Bank</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Upload JSON or PDF. JSON supports companies map / flat array. PDF supports numbered MCQs with A/B/C/D options.
                          </p>
                          {bankSummary.questions > 0 && (
                            <p className="text-xs text-emerald-300 mt-2">
                              Imported: {bankSummary.questions} questions across {bankSummary.companies} companies.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            ref={bankFileInputRef}
                            type="file"
                            accept="application/json,.json,application/pdf,.pdf"
                            className="hidden"
                            onChange={handleQuestionBankImport}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-blue-500/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                            onClick={() => bankFileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" /> Import JSON / PDF
                          </Button>
                          {bankSummary.questions > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                              onClick={clearQuestionBank}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {COMPANIES.map((company) => (
                    <Card
                      key={company.id}
                      className="bg-white/5 border-white/10 hover:border-white/25 cursor-pointer transition-all duration-300 group hover:scale-[1.02]"
                      onClick={() => startWithDifficulty("company", company.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-3xl">{company.icon}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            company.difficulty === "Hard" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"
                          }`}>{company.difficulty}</span>
                        </div>
                        <CardTitle className="text-lg text-white group-hover:text-primary transition-colors">{company.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {company.sections.map((s) => (
                            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/5">{s}</span>
                          ))}
                        </div>
                        <Button size="sm" variant="ghost" className="w-full text-primary hover:bg-primary/10 text-sm font-semibold">
                          Start Exam <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Topic-Wise Practice */}
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-emerald-400" /> Topic-Wise Practice
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => startWithDifficulty("topic", topic.id)}
                      className="bg-white/5 border border-white/10 rounded-xl p-5 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
                    >
                      <span className="text-3xl mb-3 block">{topic.icon}</span>
                      <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{topic.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{topic.count} questions</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mock Test */}
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <Timer className="h-5 w-5 text-purple-400" /> Full Mock Test
                </h2>
                <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer" onClick={() => startWithDifficulty("mock", "mock")}>
                  <CardContent className="pt-6 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">Campus Placement Mock Test</h3>
                        <p className="text-gray-400 text-sm mt-1">30 Questions · 30 Minutes · Mixed Topics</p>
                        <div className="flex gap-2 mt-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">10 Aptitude</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300">10 Technical</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300">10 Reasoning</span>
                        </div>
                      </div>
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                        Start Mock Test <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Leaderboard */}
              {leaderboard.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    <Trophy className="h-5 w-5 text-yellow-400" /> Leaderboard
                  </h2>
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="pt-4">
                      <div className="divide-y divide-white/5">
                        {leaderboard.slice(0, 8).map((entry, i) => (
                          <div key={entry.id} className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                                i === 1 ? "bg-gray-400/20 text-gray-300" :
                                i === 2 ? "bg-amber-600/20 text-amber-500" :
                                "bg-white/5 text-gray-500"
                              }`}>{i + 1}</span>
                              <div>
                                <p className="text-sm font-medium text-white">{entry.profiles?.username || "Student"}</p>
                                <p className="text-xs text-gray-500">{entry.topic}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">{entry.score}/{entry.total}</p>
                              <p className="text-xs text-gray-500">{Math.round((entry.score / entry.total) * 100)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* ========== QUIZ TAB ========== */}
          {activeTab === "quiz" && questions.length > 0 && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
              {/* Quiz Header */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={resetQuiz} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                  <ChevronLeft className="h-4 w-4" /> Exit Quiz
                </button>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold ${
                  timeLeft < 60 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/5 text-white"
                }`}>
                  <Timer className="h-4 w-4" /> {formatTime(timeLeft)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Question {currentQ + 1} of {questions.length}</span>
                  <span>{answers.filter(Boolean).length} answered</span>
                </div>
                <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2 [&>div]:bg-primary" />
              </div>

              {/* Question Card */}
              <Card className="bg-white/5 border-white/10 mb-6">
                <CardContent className="pt-6 pb-6">
                  <p className="text-white text-lg font-medium leading-relaxed mb-6">{questions[currentQ].question}</p>

                  <div className="space-y-3">
                    {questions[currentQ].options.map((option, oi) => {
                      const isCorrect = option === questions[currentQ].correctAnswer;
                      const isSelected = selectedAnswer === option;
                      let cls = "w-full text-left p-4 rounded-xl border transition-all duration-200 ";

                      if (showExplanation) {
                        if (isCorrect) cls += "border-green-500/50 bg-green-500/10 text-green-300";
                        else if (isSelected && !isCorrect) cls += "border-red-500/50 bg-red-500/10 text-red-300";
                        else cls += "border-white/5 bg-white/[0.02] text-gray-500";
                      } else {
                        cls += isSelected
                          ? "border-primary/50 bg-primary/10 text-white"
                          : "border-white/10 bg-white/[0.02] text-gray-300 hover:bg-white/5 hover:border-white/20";
                      }

                      return (
                        <button key={oi} className={cls} onClick={() => handleAnswer(option)} disabled={showExplanation}>
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full border border-current flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span className="text-sm">{option}</span>
                            {showExplanation && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-400 ml-auto flex-shrink-0" />}
                            {showExplanation && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-400 ml-auto flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {showExplanation && questions[currentQ].explanation && (
                    <div className="mt-5 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Explanation</p>
                      <p className="text-sm text-gray-300">{questions[currentQ].explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={prevQuestion} disabled={currentQ === 0} className="text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                {showExplanation && (
                  <Button onClick={nextQuestion} className="bg-primary hover:bg-primary/90 text-white">
                    {currentQ === questions.length - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>

              {/* Question dots navigator */}
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {questions.map((_, qi) => (
                  <button
                    key={qi}
                    onClick={() => { setCurrentQ(qi); setSelectedAnswer(answers[qi] || null); setShowExplanation(answers[qi] !== null); }}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      qi === currentQ ? "bg-primary text-white ring-2 ring-primary/50" :
                      answers[qi] !== null ? (answers[qi] === questions[qi].correctAnswer ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400") :
                      "bg-white/5 text-gray-500 hover:bg-white/10"
                    }`}
                  >{qi + 1}</button>
                ))}
              </div>
            </div>
          )}

          {/* ========== CODING TAB ========== */}
          {activeTab === "quiz" && quizType === "coding" && codingQuestions.length > 0 && (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
              {/* Quiz Header */}
              <div className="flex items-center justify-between mb-6">
                 <button onClick={resetQuiz} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                  <ChevronLeft className="h-4 w-4" /> Exit Practice
                </button>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold ${
                  timeLeft < 60 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-white/5 text-white"
                }`}>
                  <Timer className="h-4 w-4" /> {formatTime(timeLeft)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Problem {currentQ + 1} of {codingQuestions.length}</span>
                  <span>{answers.filter(Boolean).length} completed</span>
                </div>
                <Progress value={((currentQ + 1) / codingQuestions.length) * 100} className="h-2 [&>div]:bg-primary" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                {/* Left Panel: Problem Description */}
                <div className="space-y-6">
                  <Card className="bg-white/5 border-white/10 h-full">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-bold ${
                          codingQuestions[currentQ].difficulty === "Easy" ? "bg-green-500/15 text-green-400 border border-green-500/20" :
                          codingQuestions[currentQ].difficulty === "Medium" ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" :
                          "bg-red-500/15 text-red-400 border border-red-500/20"
                        }`}>
                          {codingQuestions[currentQ].difficulty}
                        </span>
                      </div>
                      <CardTitle className="text-2xl text-white font-bold leading-tight flex gap-2">
                        <span>{currentQ + 1}.</span> <span>{codingQuestions[currentQ].title}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 text-sm text-gray-300">
                      <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                        {codingQuestions[currentQ].description}
                      </div>

                      <div className="space-y-4">
                        {codingQuestions[currentQ].examples.map((ex, i) => (
                          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                            <p className="font-semibold text-white mb-2">Example {i + 1}:</p>
                            <p className="font-mono text-xs text-gray-400 mb-1"><span className="text-gray-500">Input:</span> {ex.input}</p>
                            <p className="font-mono text-xs text-gray-400"><span className="text-gray-500">Output:</span> {ex.output}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                        <p className="font-semibold text-blue-300 mb-2">Constraints:</p>
                        <ul className="list-disc pl-5 space-y-1 text-gray-400 font-mono text-xs">
                          {codingQuestions[currentQ].constraints.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Panel: Editor & Solution */}
                <div className="flex flex-col gap-4">
                  <Card className="bg-[#1e1e1e] border-white/10 flex-1 flex flex-col overflow-hidden relative min-h-[500px]">
                    <div className="bg-black/40 border-b border-white/5 p-3 flex justify-between items-center">
                      <div className="flex gap-2">
                        {(["cpp", "java", "python"] as const).map((lang) => (
                          <button
                            key={lang}
                            onClick={() => {
                              setCodeLanguage(lang);
                              if (!answers[currentQ]) setUserCode(codingQuestions[currentQ].starterCode[lang] || "");
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              codeLanguage === lang ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {lang === "cpp" ? "C++" : lang === "java" ? "Java" : "Python"}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <textarea
                      value={userCode}
                      onChange={(e) => setUserCode(e.target.value)}
                      disabled={showExplanation}
                      className="flex-1 w-full bg-transparent text-gray-300 font-mono text-sm p-4 focus:outline-none resize-none"
                      spellCheck={false}
                      placeholder="Write your code here..."
                      style={{ tabSize: 4 }}
                    />

                    <div className="bg-black/80 text-green-400 font-mono text-xs p-4 border-t border-white/10 h-[180px] overflow-auto whitespace-pre-wrap flex-shrink-0">
                      <div className="text-gray-500 mb-2 border-b border-white/10 pb-1 font-semibold tracking-wider text-[10px] uppercase">Console Output</div>
                      {isRunning ? "Running..." : executionResult || "Ready."}
                    </div>
                    
                    {/* Solution Overlay */}
                    {showExplanation && (
                      <div className="absolute inset-0 top-[53px] bg-black/95 backdrop-blur-md p-6 overflow-y-auto border-t border-white/10 animate-in slide-in-from-bottom border-t-primary/30 z-10">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle2 className="h-6 w-6 text-green-400" />
                          <h3 className="text-xl font-bold text-white">Optimal Approach</h3>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-green-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {codingQuestions[currentQ].solution}
                          </div>
                          <div className="flex gap-4">
                            <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10">
                              <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Time Complexity</p>
                              <p className="font-mono text-blue-300 text-sm">{codingQuestions[currentQ].timeComplexity}</p>
                            </div>
                            <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10">
                              <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Space Complexity</p>
                              <p className="font-mono text-purple-300 text-sm">{codingQuestions[currentQ].spaceComplexity}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-3 justify-end items-center mt-6">
                    {!showExplanation ? (
                      <>
                        <Button 
                          onClick={handleRunCode} 
                          disabled={isRunning}
                          variant="outline" 
                          className="text-white border-white/20 hover:bg-white/10 hover:text-white px-6 py-5 text-sm"
                        >
                          <Zap className="h-4 w-4 mr-2" /> Run Code
                        </Button>
                        <Button 
                          onClick={submitCode} 
                          disabled={isRunning}
                          className="bg-primary hover:bg-primary/90 text-white px-8 py-5 text-sm shadow-lg shadow-primary/25"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Submit Code
                        </Button>
                      </>
                    ) : (
                      <Button onClick={nextQuestion} variant="outline" className="text-white hover:text-black hover:bg-white px-8 py-5 text-sm border-white">
                        {currentQ === codingQuestions.length - 1 ? "Finish Session" : "Next Problem"} <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigator */}
              <div className="flex flex-wrap gap-2 mt-8 justify-center pb-8">
                {codingQuestions.map((_, qi) => (
                  <button
                    key={qi}
                    onClick={() => { setCurrentQ(qi); setUserCode(codingQuestions[qi].starterCode[codeLanguage] || ""); setShowExplanation(answers[qi] !== null); }}
                    className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      qi === currentQ ? "bg-primary text-white shadow-lg shadow-primary/30" :
                      answers[qi] !== null ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                      "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{qi + 1}</span>
                    {answers[qi] !== null && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ========== RESULTS TAB ========== */}
          {activeTab === "results" && (
            <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Quiz Complete!</h2>
                <p className="text-gray-400 mt-1">Here are your results</p>
              </div>

              {/* Score Card */}
              <Card className="bg-white/5 border-white/10 mb-6">
                <CardContent className="pt-6 pb-6 text-center">
                  <p className="text-6xl font-bold text-white mb-2">{getScore()}<span className="text-2xl text-gray-500">/{quizType === "coding" ? codingQuestions.length : questions.length}</span></p>
                  <p className="text-lg font-semibold" style={{ color: getScore() / (quizType === "coding" ? codingQuestions.length : questions.length) >= 0.7 ? "#4ade80" : getScore() / (quizType === "coding" ? codingQuestions.length : questions.length) >= 0.5 ? "#facc15" : "#f87171" }}>
                    {Math.round((getScore() / (quizType === "coding" ? codingQuestions.length : questions.length)) * 100)}% — {getScore() / (quizType === "coding" ? codingQuestions.length : questions.length) >= 0.7 ? "Excellent!" : getScore() / (quizType === "coding" ? codingQuestions.length : questions.length) >= 0.5 ? "Good effort!" : "Keep practicing!"}
                  </p>
                  <div className="mt-4 flex justify-center gap-6 text-sm text-gray-400">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-400" /> {getScore()} {quizType === "coding" ? "Attempted" : "Correct"}</span>
                    <span className="flex items-center gap-1"><XCircle className="h-4 w-4 text-red-400" /> {(quizType === "coding" ? codingQuestions.length : questions.length) - getScore()} {quizType === "coding" ? "Skipped" : "Wrong"}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-blue-400" /> {formatTime((quizType === "coding" ? 45 * 60 : (quizType === "mock" ? 30 * 60 : 15 * 60)) - timeLeft)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Review answers */}
              <h3 className="text-lg font-semibold text-white mb-3">Review Answers</h3>
              <div className="space-y-3 mb-8">
                {quizType === "coding" ? (
                  codingQuestions.map((q, qi) => {
                    const isAttempted = answers[qi] !== null;
                    return (
                      <details key={qi} className={`rounded-xl border p-4 ${isAttempted ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        <summary className="flex items-center gap-3 cursor-pointer text-sm">
                          {isAttempted ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                          <span className="text-white font-medium">Q{qi + 1}: {q.title}</span>
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/5 font-semibold text-gray-400">{q.difficulty}</span>
                        </summary>
                        <div className="mt-3 pl-7 text-sm space-y-2">
                          <p className="text-green-300 font-semibold mb-1">Solution Approach:</p>
                          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{q.solution}</p>
                          <div className="flex gap-4 mt-3 font-mono text-xs p-3 bg-white/5 rounded-lg">
                            <span className="text-blue-300 font-semibold">Time: {q.timeComplexity}</span>
                            <span className="text-purple-300 font-semibold">Space: {q.spaceComplexity}</span>
                          </div>
                        </div>
                      </details>
                    );
                  })
                ) : (
                  questions.map((q, qi) => {
                    const isCorrect = answers[qi] === q.correctAnswer;
                    return (
                      <details key={qi} className={`rounded-xl border p-4 ${isCorrect ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                        <summary className="flex items-center gap-3 cursor-pointer text-sm">
                          {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                          <span className="text-white font-medium">Q{qi + 1}: {q.question.substring(0, 80)}...</span>
                        </summary>
                        <div className="mt-3 pl-7 text-sm space-y-2">
                          {!isCorrect && <p className="text-red-300">Your answer: {answers[qi] || "Not answered"}</p>}
                          <p className="text-green-300">Correct: {q.correctAnswer}</p>
                          {q.explanation && <p className="text-gray-400 mt-2">{q.explanation}</p>}
                        </div>
                      </details>
                    );
                  })
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={resetQuiz} className="flex-1 bg-white/10 hover:bg-white/15 text-white border border-white/10">
                  <RotateCcw className="h-4 w-4 mr-2" /> Back to Home
                </Button>
                <Button onClick={() => {
                  const currentParams = {
                    test_type: quizType,
                    questions: questions,
                    topic: (quizType === "topic" ? selectedTopic : quizType === "company" ? selectedCompany : "Mock Test")
                  };
                  retakeQuiz(currentParams as any);
                }} className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
                  <RotateCcw className="h-4 w-4 mr-2" /> Retake This Test
                </Button>
                <Button onClick={() => { resetQuiz(); if (pendingAction) startWithDifficulty(pendingAction.type as any, pendingAction.id); }} className="flex-1 bg-primary hover:bg-primary/90 text-white">
                  <Zap className="h-4 w-4 mr-2" /> New Practice Session
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default PlacementPrep;
