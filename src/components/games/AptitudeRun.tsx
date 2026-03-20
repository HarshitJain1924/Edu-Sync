import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowRight, Zap, Star } from "lucide-react";

import NBackGame from "./NBackGame";
import GridMemory from "./GridMemory";
import PatternGame from "./PatternGame";
import MazeKeyDoor from "./MazeKeyDoor";
import BubbleMath from "./BubbleMath";
import PipeConnect from "./PipeConnect";

interface Props {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
}

const GAMES_POOL = [
  { id: "nback", component: NBackGame, name: "N-Back Challenge" },
  { id: "grid", component: GridMemory, name: "Spatial Grid Memory" },
  { id: "pattern", component: PatternGame, name: "Pattern Matching" },
  { id: "maze", component: MazeKeyDoor, name: "Maze Escape" },
  { id: "bubble", component: BubbleMath, name: "Bubble Math" },
  { id: "pipe", component: PipeConnect, name: "Pipe Connect" }
];

export default function AptitudeRun({ paused = false, onFinish, onScoreChange }: Props) {
  const [started, setStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  
  const [gameSequence, setGameSequence] = useState<typeof GAMES_POOL>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [roundResult, setRoundResult] = useState<{score: number, xp: number} | null>(null);
  const [streak, setStreak] = useState(0);
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [lastXpGained, setLastXpGained] = useState(0);

  const TOTAL_ROUNDS = 5;

  // Initialize random gauntlet
  useEffect(() => {
    // Pick 5 random games
    const shuffled = [...GAMES_POOL].sort(() => 0.5 - Math.random());
    setGameSequence(shuffled.slice(0, TOTAL_ROUNDS));
  }, []);

  const handleStart = () => {
    setStarted(true);
    setCurrentRound(1);
    setTotalScore(0);
    setTotalXp(0);
    setStreak(0);
  };

  const handleChildScoreChange = useCallback((scoreToAdd: number) => {
    // We just ignore intermediate child scores or add them to a running total
    // It's cleaner to just tally at the end of the round.
  }, []);

  const handleRoundFinish = (result: { score: number; xp: number }) => {
    // Show transition summary
    setRoundResult(result);
    setTransitioning(true);
    
    // Update streaks and totals
    if (result.score > 50) {
       setStreak(s => s + 1);
    } else {
       setStreak(0);
    }

    const streakBonus = streak * 10;
    const finalScore = result.score + streakBonus;
    const finalXp = result.xp + Math.floor(streakBonus / 2);

    setTotalScore(prev => {
      const newScore = prev + finalScore;
      onScoreChange?.(newScore);
      return newScore;
    });
    
    setTotalXp(prev => prev + finalXp);
    
    // Popup animation
    setLastXpGained(finalXp);
    setShowXpPopup(true);
    setTimeout(() => setShowXpPopup(false), 2000);
  };

  const nextRound = () => {
    if (currentRound >= Math.min(TOTAL_ROUNDS, gameSequence.length)) {
      // Gauntlet complete!
      onFinish({ score: totalScore, xp: totalXp });
    } else {
      setTransitioning(false);
      setRoundResult(null);
      setCurrentRound(prev => prev + 1);
    }
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/30">
          <Zap className="h-12 w-12 text-white" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Aptitude Gauntlet</h2>
          <p className="text-muted-foreground">Survive a random sequence of {TOTAL_ROUNDS} cognitive games. Maintain a streak for bonus XP!</p>
        </div>
        <div className="w-full bg-white/5 rounded-xl p-4 space-y-2">
          <h3 className="font-bold text-sm text-gray-300 uppercase tracking-widest">Games Pool</h3>
          <div className="flex flex-wrap gap-2 justify-center">
             {GAMES_POOL.map(g => (
               <span key={g.id} className="text-xs px-2 py-1 bg-white/10 rounded-full text-blue-200">{g.name}</span>
             ))}
          </div>
        </div>
        <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={handleStart}>
          Enter the Gauntlet
        </Button>
      </div>
    );
  }

  // Visual XP popup
  const xpPopup = showXpPopup && (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-in fade-in slide-in-from-bottom-10 fill-mode-forwards duration-500">
      <div className="bg-emerald-500 text-white font-black text-2xl px-6 py-2 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center gap-2">
        <Star className="h-6 w-6" /> +{lastXpGained} XP
      </div>
    </div>
  );

  const streakDisplay = streak >= 2 && (
    <div className="fixed top-36 right-8 animate-in slide-in-from-right-10 fade-in duration-500 z-50">
      <div className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 font-black text-4xl italic flex items-center gap-2 drop-shadow-md">
        🔥 STREAK x{streak}
      </div>
    </div>
  );

  if (transitioning && roundResult) {
    const isLast = currentRound >= Math.min(TOTAL_ROUNDS, gameSequence.length);
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-2xl max-w-lg w-full shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
        {xpPopup}
        {streakDisplay}
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-green-400">Round {currentRound} Cleared!</h2>
          <p className="text-muted-foreground text-lg">Game: {gameSequence[currentRound - 1]?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-white/5 p-4 rounded-xl text-center border border-white/10">
            <div className="text-3xl font-bold text-blue-400">{roundResult.score}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Base Score</div>
          </div>
          <div className="bg-white/5 p-4 rounded-xl text-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="text-3xl font-bold text-emerald-400">{roundResult.xp}</div>
            <div className="text-xs text-emerald-500/70 uppercase tracking-widest font-bold mt-1">Base XP</div>
          </div>
        </div>

        {streak >= 2 && (
           <div className="w-full bg-orange-500/10 border border-orange-500/30 p-3 rounded-xl text-center text-orange-400 text-sm font-bold flex items-center justify-center gap-2">
             🔥 Streak Bonus: +{streak * 10} Score / +{Math.floor(streak * 5)} XP
           </div>
        )}

        <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={nextRound}>
          {isLast ? "Complete Gauntlet" : "Next Round"} <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  }

  const CurrentGameComponent = gameSequence[currentRound - 1]?.component;

  return (
    <div className="w-full flex flex-col items-center">
      {xpPopup}
      {streakDisplay}
      
      {/* HUD Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 px-6 py-4 bg-card border shadow-md rounded-2xl">
         <div className="space-y-1">
           <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gauntlet Mode</div>
           <div className="flex items-center gap-2">
             <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
               Round {currentRound} / {TOTAL_ROUNDS}
             </span>
             <span className="text-sm font-semibold text-gray-400 ml-2">({gameSequence[currentRound - 1]?.name})</span>
           </div>
         </div>

         <div className="flex items-center gap-6">
           <div className="text-right space-y-1">
             <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Score</div>
             <div className="text-2xl font-black text-white">{totalScore}</div>
           </div>
           <div className="h-10 w-[1px] bg-white/10" />
           <div className="text-right space-y-1">
             <div className="text-xs font-bold text-emerald-500/70 uppercase tracking-widest">Total XP</div>
             <div className="text-2xl font-black text-emerald-400">{totalXp}</div>
           </div>
         </div>
      </div>

      <div className="w-full relative">
         {/* Render the selected game */}
         {CurrentGameComponent ? (
           <CurrentGameComponent 
             paused={paused} 
             onScoreChange={handleChildScoreChange} 
             onFinish={handleRoundFinish}
             // Let the child know it's injected so it could adapt if it supports it
             isMiniGame={true}
           />
         ) : (
           <div className="text-center text-red-500">Error loading next game.</div>
         )}
      </div>
    </div>
  );
}
