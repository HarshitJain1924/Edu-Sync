import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Brain, ArrowRight, ShieldCheck, Timer as TimerIcon, Trophy, Award } from "lucide-react";

import NBackGame from "./NBackGame";
import GridMemory from "./GridMemory";
import PatternGame from "./PatternGame";
import DeductiveLogic from "./DeductiveLogic";
import SudokuBoard from "./SudokuBoard";
import TypingTest from "./TypingTest";
import QueensBoard from "./QueensBoard";
import MazeKeyDoor from "./MazeKeyDoor";
import BubbleMath from "./BubbleMath";
import PipeConnect from "./PipeConnect";

interface Props {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
}

// Category mappings for report generation
export const CATEGORY_MAP: Record<string, string> = {
  nback: "Memory",
  grid: "Memory",
  logic: "Logic",
  sudoku: "Logic",
  typing: "Reaction",
  pattern: "Reaction",
  queens: "Spatial",
  maze: "Spatial",
  bubble: "Numerical",
  pipe: "Planning"
};

const GAMES_POOL = [
  { id: "nback", component: NBackGame, name: "N-Back Challenge" },
  { id: "grid", component: GridMemory, name: "Grid Memory" },
  { id: "pattern", component: PatternGame, name: "Pattern Matching" },
  { id: "logic", component: DeductiveLogic, name: "Deductive Logic" },
  { id: "typing", component: TypingTest, name: "Reaction Speed" },
  { id: "maze", component: MazeKeyDoor, name: "Maze Escape" },
  { id: "bubble", component: BubbleMath, name: "Numerical Sorting" },
  { id: "pipe", component: PipeConnect, name: "Spatial Planning" }
];

// Note: Sudoku and Queens are omitted from the random 5-round gauntlet
// because they are traditionally much longer puzzles, but you can add them.

export default function CognitiveAssessment({ paused = false, onFinish, onScoreChange }: Props) {
  const [started, setStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  
  const [gameSequence, setGameSequence] = useState<typeof GAMES_POOL>([]);
  const [transitioning, setTransitioning] = useState(false);
  
  // Scoring tracking
  const [categoryScores, setCategoryScores] = useState<Record<string, { earned: number; possible: number }>>({});
  
  const TOTAL_ROUNDS = 5;
  const TOTAL_DURATION_SECONDS = 15 * 60; // 15 minutes
  const [globalTimeLeft, setGlobalTimeLeft] = useState(TOTAL_DURATION_SECONDS);
  const [isAssessmentComplete, setIsAssessmentComplete] = useState(false);

  // Initialize random gauntlet
  useEffect(() => {
    // Pick 5 random games ensuring variety
    const shuffled = [...GAMES_POOL].sort(() => 0.5 - Math.random());
    setGameSequence(shuffled.slice(0, TOTAL_ROUNDS));
  }, []);

  // Global Timer
  useEffect(() => {
    if (!started || paused || transitioning || isAssessmentComplete) return;
    
    if (globalTimeLeft <= 0) {
      handleCompleteAssessment();
      return;
    }
    
    const t = setInterval(() => setGlobalTimeLeft(l => l - 1), 1000);
    return () => clearInterval(t);
  }, [globalTimeLeft, started, paused, transitioning, isAssessmentComplete]);

  const handleStart = () => {
    setStarted(true);
    setCurrentRound(1);
    setTotalScore(0);
    setTotalXp(0);
    setCategoryScores({});
    setGlobalTimeLeft(TOTAL_DURATION_SECONDS);
    setIsAssessmentComplete(false);
  };

  const handleRoundFinish = useCallback((result: { score: number; xp: number }) => {
    const currentGame = gameSequence[currentRound - 1];
    const category = CATEGORY_MAP[currentGame.id] || "General";
    
    // Update category tracking
    setCategoryScores(prev => {
      const existing = prev[category] || { earned: 0, possible: 0 };
      return {
        ...prev,
        [category]: {
          earned: existing.earned + result.score,
          possible: existing.possible + 100 // assuming 100 is target max per mini-game
        }
      };
    });

    setTotalScore(prev => prev + result.score);
    setTotalXp(prev => prev + result.xp);
    onScoreChange?.(totalScore + result.score);
    
    setTransitioning(true);
  }, [currentRound, gameSequence, totalScore, onScoreChange]);

  const handleCompleteAssessment = useCallback(() => {
    setIsAssessmentComplete(true);
    setTransitioning(false);
  }, []);

  const nextRound = () => {
    if (currentRound >= Math.min(TOTAL_ROUNDS, gameSequence.length)) {
      handleCompleteAssessment();
    } else {
      setTransitioning(false);
      setCurrentRound(prev => prev + 1);
    }
  };

  const finalizeAndExit = () => {
    onFinish({ score: totalScore, xp: totalXp });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
        <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)] border border-blue-400/20">
          <ShieldCheck className="h-16 w-16 text-white" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-white">Cognitive Assessment</h2>
          <p className="text-muted-foreground">A 15-minute corporate-style cognitive evaluation. Test your memory, logic, and spatial reasoning under pressure.</p>
        </div>
        
        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 text-gray-300">
               <TimerIcon className="h-5 w-5 text-blue-400" />
               <span className="font-bold">Duration</span>
             </div>
             <div className="font-mono text-lg text-white">15:00</div>
          </div>
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 text-gray-300">
               <Brain className="h-5 w-5 text-purple-400" />
               <span className="font-bold">Categories</span>
             </div>
             <div className="text-sm font-semibold text-white">Memory, Logic, Spatial + 2</div>
          </div>
        </div>
        
        <Button size="lg" className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700" onClick={handleStart}>
          Begin Assessment
        </Button>
      </div>
    );
  }

  if (isAssessmentComplete) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-2xl max-w-xl w-full shadow-2xl space-y-8 animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
             <Award className="h-12 w-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
          </div>
          <h2 className="text-4xl font-black text-white">Assessment Complete</h2>
          <p className="text-muted-foreground text-lg">Your cognitive performance report is ready.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-white/5 p-4 rounded-xl text-center border border-white/10 flex flex-col items-center justify-center">
            <div className="text-sm text-muted-foreground uppercase tracking-widest font-bold mb-1">Total Score</div>
            <div className="text-4xl font-black text-blue-400 flex items-center gap-2">
              {totalScore} <Trophy className="h-6 w-6" />
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl text-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex flex-col items-center justify-center">
            <div className="text-sm text-emerald-500/70 uppercase tracking-widest font-bold mb-1">XP Earned</div>
            <div className="text-4xl font-black text-emerald-400">+{totalXp}</div>
          </div>
        </div>

        <div className="w-full space-y-4 bg-white/5 p-6 rounded-2xl border border-white/10">
          <h3 className="text-lg font-bold text-white mb-2 border-b border-white/10 pb-2">Category Breakdown</h3>
          
          {Object.entries(categoryScores).map(([category, stats]) => {
            const percentage = Math.min(100, Math.round((stats.earned / Math.max(stats.possible, 1)) * 100));
            return (
              <div key={category} className="space-y-1">
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-bold text-gray-300">{category}</span>
                   <span className="font-mono text-blue-400">{percentage}%</span>
                 </div>
                 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${percentage}%` }} />
                 </div>
              </div>
            )
          })}
          
          {Object.keys(categoryScores).length === 0 && (
             <div className="text-center text-muted-foreground py-4">Insufficient data gathered.</div>
          )}
        </div>

        <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={finalizeAndExit}>
          Return to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  }

  if (transitioning) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-2xl max-w-lg w-full shadow-2xl space-y-8 animate-in slide-in-from-right-10 duration-300">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-white">Section Complete</h2>
          <p className="text-muted-foreground text-lg">Preparing next cognitive module...</p>
        </div>
        
        <div className="flex items-center gap-4 text-blue-400 opacity-80 animate-pulse">
           <Brain className="h-12 w-12" />
        </div>

        <Button size="lg" className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700" onClick={nextRound}>
          Start Next Section <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  }

  const CurrentGameComponent = gameSequence[currentRound - 1]?.component;

  return (
    <div className="w-full flex flex-col items-center">
      {/* HUD Header */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between mb-8 px-6 py-4 bg-card border shadow-md rounded-2xl gap-4">
         
         <div className="flex items-center gap-4 min-w-[200px]">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm border shadow-inner ${globalTimeLeft <= 60 ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : 'bg-black/50 border-white/10 text-blue-400'}`}>
             <TimerIcon className="h-4 w-4" />
             {formatTime(globalTimeLeft)}
           </div>
           
           <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
           
           <div className="space-y-1">
             <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progress</div>
             <div className="text-sm font-black text-white">
               Test {currentRound} <span className="text-muted-foreground">of {TOTAL_ROUNDS}</span>
             </div>
           </div>
         </div>

         <div className="flex-1 w-full max-w-md mx-4">
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
               <div 
                 className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" 
                 style={{ width: `${(currentRound / TOTAL_ROUNDS) * 100}%` }} 
               />
            </div>
            <div className="text-center mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              {gameSequence[currentRound - 1]?.name}
            </div>
         </div>

      </div>

      <div className="w-full relative">
         {CurrentGameComponent ? (
           <CurrentGameComponent 
             paused={paused} 
             onScoreChange={() => {}} 
             onFinish={handleRoundFinish}
             isMiniGame={true}
           />
         ) : (
           <div className="text-center text-red-500">Error loading assessment module.</div>
         )}
      </div>
    </div>
  );
}
