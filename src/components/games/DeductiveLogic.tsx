import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Clock, ShieldAlert, Sparkles, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DeductiveLogicProps {
  onScoreChange: (score: number) => void;
  paused: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
}

const SYMBOLS = ["🔴", "🟦", "⭐", "🌙", "⚡", "🍀", "💎", "🔥"];

interface Problem {
  equations: { left: string; right: number; id: string }[];
  targetSymbol: string;
  answer: number;
}

export default function DeductiveLogic({ onScoreChange, paused, onFinish }: DeductiveLogicProps) {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [timeLeft, setTimeLeft] = useState(30); // seconds per problem
  const [answerInput, setAnswerInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const generateProblem = useCallback((currentLevel: number): Problem => {
    // Select 2 to 3 distinct symbols based on level
    const numSymbols = currentLevel < 4 ? 2 : 3;
    const shuffledSymbols = [...SYMBOLS].sort(() => 0.5 - Math.random());
    const selected = shuffledSymbols.slice(0, numSymbols);
    
    // Assign random values
    const values = selected.map(() => Math.floor(Math.random() * (currentLevel < 3 ? 10 : 20)) + 1);
    
    const equations: { left: string; right: number; id: string }[] = [];
    
    // Level 1-3 (2 symbols): A + B = X, A - B = Y
    if (numSymbols === 2) {
      const A = selected[0];
      const B = selected[1];
      const valA = values[0];
      const valB = values[1];
      
      // Eq 1: A + A = X or A + B = X
      if (Math.random() > 0.5) {
        equations.push({ left: `${A} + ${A}`, right: valA + valA, id: 'eq1' });
        equations.push({ left: `${A} + ${B}`, right: valA + valB, id: 'eq2' });
      } else {
        equations.push({ left: `${A} + ${B}`, right: valA + valB, id: 'eq1' });
        equations.push({ left: `${A} - ${B}`, right: valA - valB, id: 'eq2' });
      }
      
      return { equations, targetSymbol: B, answer: valB };
    } 
    
    // Level 4+ (3 symbols)
    const A = selected[0];
    const B = selected[1];
    const C = selected[2];
    const valA = values[0];
    const valB = values[1];
    const valC = values[2];

    equations.push({ left: `${A} + ${A}`, right: valA + valA, id: 'eq1' });
    equations.push({ left: `${A} + ${B}`, right: valA + valB, id: 'eq2' });
    
    if (Math.random() > 0.5) {
       equations.push({ left: `${B} + ${C}`, right: valB + valC, id: 'eq3' });
    } else {
       equations.push({ left: `${C} - ${A}`, right: valC - valA, id: 'eq3' });
    }

    return { equations, targetSymbol: C, answer: valC };

  }, []);

  const startNewProblem = useCallback((newLevel: number) => {
    setProblem(generateProblem(newLevel));
    setFeedback(null);
    setAnswerInput("");
    setTimeLeft(Math.max(30 - Math.floor(newLevel / 2) * 2, 10)); // time gets tighter
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [generateProblem]);

  useEffect(() => {
    if (!gameOver && !paused) {
      startNewProblem(1);
    }
  }, [gameOver, paused, startNewProblem]);

  // Timer
  useEffect(() => {
    if (paused || gameOver || feedback) return;

    if (timeLeft <= 0) {
      handleWrongAnswer();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, paused, gameOver, feedback]);

  const handleGameOver = () => {
    setGameOver(true);
    const xp = Math.min(score * 2 + level * 15, 100);
    onFinish({ score, xp });
  };

  const handleWrongAnswer = () => {
    setFeedback("wrong");
    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setTimeout(handleGameOver, 1500);
      } else {
        setTimeout(() => startNewProblem(level), 1500);
      }
      return newLives;
    });
  };

  const handleCorrectAnswer = () => {
    setFeedback("correct");
    const bonus = Math.floor(timeLeft / 2);
    const newScore = score + 20 + bonus;
    setScore(newScore);
    onScoreChange(newScore);
    
    setTimeout(() => {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      startNewProblem(nextLevel);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback || paused || gameOver || !problem) return;

    const parsed = parseInt(answerInput);
    if (!isNaN(parsed) && parsed === problem.answer) {
      handleCorrectAnswer();
    } else {
      handleWrongAnswer();
    }
  };

  if (gameOver || !problem) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto space-y-8">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm ${timeLeft <= 5 ? "bg-red-500/10 text-red-500 animate-pulse" : "bg-card border"}`}>
             <Clock className="h-4 w-4" />
             0:{timeLeft.toString().padStart(2, '0')}
           </div>
           <div className="text-sm font-bold text-muted-foreground ml-2">Level {level}</div>
        </div>
        
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-3 w-3 rounded-full ${i < lives ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-gray-700"}`} />
          ))}
        </div>
      </div>

      {feedback === "correct" && (
        <div className="animate-in fade-in zoom-in absolute z-10 flex flex-col items-center">
          <Sparkles className="h-20 w-20 text-green-500 drop-shadow-[0_0_30px_rgba(34,197,94,0.6)]" />
          <h2 className="text-3xl font-black text-green-500 mt-4">CORRECT!</h2>
        </div>
      )}

      {feedback === "wrong" && (
        <div className="animate-in fade-in zoom-in absolute z-10 flex flex-col items-center">
          <AlertTriangle className="h-20 w-20 text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]" />
          <h2 className="text-3xl font-black text-red-500 mt-4">TIME'S UP / WRONG</h2>
          <p className="text-white font-bold text-xl mt-2">Answer was {problem.answer}</p>
        </div>
      )}

      <div className={`w-full bg-card border rounded-3xl p-8 shadow-2xl transition-all duration-300 ${feedback ? 'opacity-20 blur-sm' : ''}`}>
        <div className="space-y-6 text-2xl font-bold tracking-widest text-center mb-8">
          {problem.equations.map(eq => (
            <div key={eq.id} className="flex items-center justify-center gap-4 bg-white/5 py-4 rounded-xl border border-white/5">
              <span className="text-4xl drop-shadow-md">{eq.left}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-blue-400 font-mono text-3xl">{eq.right}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6 mt-10 p-6 bg-gradient-to-b from-blue-500/10 to-transparent rounded-2xl border border-blue-500/20">
          <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-widest">Find the value</h3>
          <div className="flex items-center gap-4 w-full max-w-xs">
            <span className="text-5xl drop-shadow-lg animate-bounce">{problem.targetSymbol}</span>
            <span className="text-2xl font-bold text-muted-foreground">=</span>
            <Input 
              ref={inputRef}
              type="number" 
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              className="text-3xl font-mono text-center h-16 w-full bg-background border-2 border-blue-500/30 focus:border-blue-500"
              placeholder="?"
              autoFocus
              disabled={!!feedback || paused}
            />
          </div>
          <Button type="submit" size="lg" className="w-full max-w-xs h-14 text-lg font-bold" disabled={!answerInput || !!feedback || paused}>
            Submit <Brain className="ml-2 h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
