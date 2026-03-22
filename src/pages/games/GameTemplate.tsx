import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain, Play, Pause, X, Trophy, Heart, ChevronLeft, Zap,
  Grid3x3, Puzzle, Layers, Timer, Keyboard, Target,
  Fingerprint, LayoutGrid, Calculator, CornerUpRight, Activity,
  GitMerge, ShieldCheck, RotateCcw
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import GameHeader from "@/components/games/GameHeader";
import SudokuBoard from "@/components/games/SudokuBoard";
import QueensBoard from "@/components/games/QueensBoard";
import MemoryGame from "@/components/games/MemoryGame";
import PatternGame from "@/components/games/PatternGame";
import TypingTest from "@/components/games/TypingTest";
import ZipMatch from "@/components/games/ZipMatch";
import AptitudeRun from "@/components/games/AptitudeRun";
import NBackGame from "@/components/games/NBackGame";
import GridMemory from "@/components/games/GridMemory";
import DeductiveLogic from "@/components/games/DeductiveLogic";
import MazeKeyDoor from "@/components/games/MazeKeyDoor";
import BubbleMath from "@/components/games/BubbleMath";
import PipeConnect from "@/components/games/PipeConnect";
import CognitiveAssessment from "@/components/games/CognitiveAssessment";
import { addXP, getTotalXP } from "@/lib/xp";

interface GameMeta {
  title: string;
  description: string;
  icon: any;
  gradient: string;
  glowColor: string;
  difficulty: string;
  xp: number;
  rules: string[];
}

const GameTemplate = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [lives, setLives] = useState(3);
  const [xpEarned, setXpEarned] = useState(0);
  const [totalXP, setTotalXP] = useState(getTotalXP());

  const gameInfo: Record<string, GameMeta> = {
    sudoku: { title: "Sudoku", description: "Fill the 9×9 grid so each row, column, and box contains digits 1–9", icon: Grid3x3, gradient: "from-blue-500 to-cyan-500", glowColor: "rgba(6,182,212,0.3)", difficulty: "Medium", xp: 50, rules: ["Fill each row with digits 1–9", "No repeats in any column or 3×3 box", "Earn XP based on completion speed", "Try to beat your personal best"] },
    queens: { title: "Queens Puzzle", description: "Place queens on a chessboard without any conflicts", icon: Puzzle, gradient: "from-purple-500 to-pink-500", glowColor: "rgba(168,85,247,0.3)", difficulty: "Hard", xp: 75, rules: ["Place one queen per row", "No two queens can share a column or diagonal", "Earn bonus XP for fewer moves", "Compete on the leaderboard"] },
    pattern: { title: "Pattern Matching", description: "Identify and match visual patterns at speed", icon: Layers, gradient: "from-green-500 to-emerald-500", glowColor: "rgba(16,185,129,0.25)", difficulty: "Easy", xp: 30, rules: ["Match the displayed pattern quickly", "Speed determines your score", "Accuracy bonuses for streaks", "You have 3 lives"] },
    zip: { title: "Zip Match", description: "Connect matching pairs in minimum moves", icon: Zap, gradient: "from-yellow-500 to-orange-500", glowColor: "rgba(245,158,11,0.3)", difficulty: "Medium", xp: 40, rules: ["Find and connect matching pairs", "Fewer moves = higher score", "Complete before time runs out", "Earn XP on completion"] },
    memory: { title: "Memory Flip", description: "Classic memory card game to train visual recall", icon: Brain, gradient: "from-red-500 to-rose-500", glowColor: "rgba(239,68,68,0.25)", difficulty: "Easy", xp: 25, rules: ["Flip cards to find matching pairs", "Memorize card positions", "Match all pairs to complete", "Speed bonus for quick completion"] },
    speed: { title: "Brain Speed Test", description: "Quick mental math challenges against the clock", icon: Timer, gradient: "from-indigo-500 to-purple-500", glowColor: "rgba(99,102,241,0.3)", difficulty: "Medium", xp: 45, rules: ["Solve math problems rapidly", "Each correct answer adds time", "Wrong answers cost a life", "Maximize your streak"] },
    typing: { title: "Typing Speed Test", description: "Test and improve your typing WPM and accuracy", icon: Keyboard, gradient: "from-teal-500 to-cyan-500", glowColor: "rgba(20,184,166,0.25)", difficulty: "Easy", xp: 35, rules: ["Type the displayed text accurately", "WPM and accuracy are tracked", "Complete the passage to finish", "Higher accuracy = more XP"] },
    aptitude: { title: "Aptitude Speed Run", description: "Solve placement-style aptitude questions fast", icon: Target, gradient: "from-amber-500 to-red-500", glowColor: "rgba(239,68,68,0.35)", difficulty: "Hard", xp: 100, rules: ["Answer aptitude questions under pressure", "Each correct answer earns points", "Time penalty for wrong answers", "Target: highest score possible"] },
    nback: { title: "N-Back Challenge", description: "Boost working memory with corporate-style cognitive training", icon: Fingerprint, gradient: "from-emerald-500 to-teal-500", glowColor: "rgba(20,184,166,0.3)", difficulty: "Hard", xp: 80, rules: ["Remember items from N steps back", "Identify when current matches N-back", "Difficulty increases with level", "Used in corporate hiring assessments"] },
    grid: { title: "Spatial Grid Memory", description: "Memorize and recreate patterns on a shifting grid", icon: LayoutGrid, gradient: "from-blue-600 to-indigo-600", glowColor: "rgba(79,70,229,0.3)", difficulty: "Medium", xp: 60, rules: ["Watch the pattern light up on the grid", "Recreate the pattern from memory", "Patterns get longer each round", "You have 3 lives"] },
    logic: { title: "Deductive Logic", description: "Solve symbol-based algebraic equations under time pressure", icon: Calculator, gradient: "from-violet-600 to-purple-800", glowColor: "rgba(139,92,246,0.35)", difficulty: "Hard", xp: 90, rules: ["Decode symbol values from equations", "Use logic — no guessing!", "Speed and accuracy both matter", "Corporate aptitude style problems"] },
    maze: { title: "Maze Escape", description: "Navigate the maze — find the key and reach the door", icon: CornerUpRight, gradient: "from-yellow-500 to-orange-600", glowColor: "rgba(234,88,12,0.3)", difficulty: "Medium", xp: 70, rules: ["Use arrow keys to navigate", "Find the key first, then the door", "Walls block your path", "Complete in minimum time for bonus XP"] },
    bubble: { title: "Bubble Math", description: "Pop floating numbers in ascending order before time runs out", icon: Activity, gradient: "from-pink-500 to-rose-600", glowColor: "rgba(225,29,72,0.25)", difficulty: "Easy", xp: 40, rules: ["Pop bubbles in ascending numerical order", "Wrong pops cost a life", "Bubbles get faster each round", "Complete all rounds to earn full XP"] },
    pipe: { title: "Pipe Connect", description: "Rotate pipe segments to build a connected flow path", icon: GitMerge, gradient: "from-blue-400 to-cyan-500", glowColor: "rgba(6,182,212,0.25)", difficulty: "Medium", xp: 65, rules: ["Rotate pipe segments to connect them", "Build a path from start to end", "All pipes must be connected", "Fewer rotations = higher score"] },
    assessment: { title: "Cognitive Assessment", description: "Full 15-minute corporate-style exam covering memory, logic, spatial, and reaction", icon: ShieldCheck, gradient: "from-blue-600 to-indigo-800", glowColor: "rgba(99,102,241,0.4)", difficulty: "Extreme", xp: 250, rules: ["15-minute timed assessment", "Covers multiple cognitive domains", "Corporate hiring standard format", "Your comprehensive score is recorded"] },
  };

  const currentGame = gameInfo[gameId || ""] || gameInfo.sudoku;

  const handleStart = () => {
    setIsPlaying(true);
    setShowResults(false);
    setScore(0);
    setTimer(0);
    setLives(3);
  };

  const handlePause = () => setIsPaused(!isPaused);

  const handleExit = () => navigate("/games");

  const onGameFinish = ({ score: s, xp }: { score: number; xp: number }) => {
    setScore(s);
    const total = addXP(xp);
    setXpEarned(xp);
    setTotalXP(total);
    setIsPlaying(false);
    setShowResults(true);
  };

  useEffect(() => {
    if (!isPlaying || isPaused) return;
    const t = window.setInterval(() => setTimer((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isPlaying, isPaused]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const difficultyColor: Record<string, string> = {
    Easy: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    Medium: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    Hard: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    Extreme: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  };

  const GameIcon = currentGame.icon;

  // ─── Results Screen ──────────────────────────────────────────────
  if (showResults) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center p-8 relative overflow-hidden">
        {/* Celebration Ambient */}
        <div className="absolute top-[15%] left-[25%] w-[350px] h-[350px] bg-amber-500/[0.06] blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[15%] right-[25%] w-[400px] h-[400px] bg-emerald-500/[0.05] blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-[40%] right-[15%] w-[250px] h-[250px] bg-violet-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-xl">
          <div className="rounded-[2rem] bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Top Gradient Accent */}
            <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-violet-400" />

            <div className="p-10 space-y-8 text-center">
              {/* Trophy */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full scale-150" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(245,158,11,0.35)]">
                  <Trophy className="h-10 w-10 text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-extrabold tracking-tight mb-1">Game Complete! 🎉</h2>
                <p className="text-zinc-400 text-sm">{currentGame.title}</p>
              </div>

              {/* XP Display */}
              <div className="py-4">
                <div className="text-6xl font-extrabold bg-gradient-to-r from-amber-300 via-amber-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
                  {xpEarned}
                </div>
                <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mt-2">XP Earned</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Total XP: <span className="text-zinc-400 font-semibold">{totalXP.toLocaleString()}</span>
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-2xl font-bold text-white mb-1">{score}</div>
                  <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Score</p>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-2xl font-bold text-white mb-1">{formatTime(timer)}</div>
                  <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Time</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleStart}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold hover:opacity-90 shadow-[0_8px_25px_-5px_rgba(139,92,246,0.4)] hover:shadow-[0_12px_35px_-5px_rgba(139,92,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Play Again
                </Button>
                <Button
                  onClick={handleExit}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-all"
                >
                  Exit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Pre-Game Start Screen ───────────────────────────────────────
  if (!isPlaying) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center p-8 relative overflow-hidden">
        {/* Ambient Orbs */}
        <div className="absolute top-[-10%] right-[15%] w-[450px] h-[450px] bg-violet-500/[0.06] blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[15%] w-[400px] h-[400px] bg-indigo-500/[0.05] blur-[130px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-xl">
          <div className="rounded-[2rem] bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Top Gradient Accent */}
            <div className={`h-1 w-full bg-gradient-to-r ${currentGame.gradient}`} />

            <div className="p-10 space-y-8">
              {/* Game Icon + Info */}
              <div className="text-center space-y-4">
                <div
                  className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${currentGame.gradient} mx-auto`}
                  style={{ boxShadow: `0 0 30px ${currentGame.glowColor}` }}
                >
                  <GameIcon className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight mb-2">{currentGame.title}</h1>
                  <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">{currentGame.description}</p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border ${difficultyColor[currentGame.difficulty] || difficultyColor.Medium}`}>
                    {currentGame.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <Zap className="h-3 w-3" />
                    {currentGame.xp} XP
                  </span>
                </div>
              </div>

              {/* How to Play */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">How to Play</h3>
                <ul className="space-y-2.5">
                  {currentGame.rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                      <span className="mt-0.5 w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.06] flex items-center justify-center text-[10px] font-bold text-zinc-500 shrink-0">
                        {i + 1}
                      </span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleStart}
                  className={`flex-1 h-13 rounded-xl bg-gradient-to-r ${currentGame.gradient} text-white font-bold text-base hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300`}
                  style={{ boxShadow: `0 8px 30px -5px ${currentGame.glowColor}` }}
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Game
                </Button>
                <Button
                  onClick={handleExit}
                  variant="outline"
                  className="h-13 px-6 rounded-xl border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Gameplay ─────────────────────────────────────────────
  const gameComponents: Record<string, JSX.Element> = {
    sudoku: <SudokuBoard onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    nback: <NBackGame onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    grid: <GridMemory onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    logic: <DeductiveLogic onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    maze: <MazeKeyDoor onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    bubble: <BubbleMath onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    pipe: <PipeConnect onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    assessment: <CognitiveAssessment onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    queens: <QueensBoard onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    memory: <MemoryGame onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    pattern: <PatternGame onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    typing: <TypingTest onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    zip: <ZipMatch onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
    aptitude: <AptitudeRun onScoreChange={setScore} paused={isPaused} onFinish={onGameFinish} />,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-[350px] h-[350px] bg-violet-500/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] left-[20%] w-[300px] h-[300px] bg-indigo-500/[0.03] blur-[100px] rounded-full" />
      </div>

      {/* Game Header Bar */}
      <div className="sticky top-0 z-30 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleExit}
            className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Exit</span>
          </Button>

          <div className="flex items-center gap-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-2">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-mono font-bold text-sm text-white">{score}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Timer className="h-3.5 w-3.5 text-violet-400" />
              <span className="font-mono font-bold text-sm tracking-wider text-white">{formatTime(timer)}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart
                  key={i}
                  className={`h-3.5 w-3.5 transition-all ${i < lives ? "text-rose-400 fill-rose-400" : "text-zinc-700"}`}
                />
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={handlePause}
            className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl"
          >
            <Pause className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Game Board */}
      <main className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-[1.75rem] bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="p-8 md:p-12">
              <div className="flex flex-col items-center justify-center min-h-[450px] space-y-6">
                {gameComponents[String(gameId)] || (
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                      <Brain className="h-7 w-7 text-zinc-500" />
                    </div>
                    <p className="text-zinc-400 font-semibold">Game coming soon</p>
                    <p className="text-zinc-600 text-sm">This game is still in development.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pause Modal */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
          <div className="w-full max-w-sm mx-4 rounded-[1.75rem] bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />
            <div className="p-8 space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                <Pause className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Game Paused</h3>
                <p className="text-xs text-zinc-500">{currentGame.title} · {formatTime(timer)} elapsed</p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={handlePause}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold hover:opacity-90 shadow-[0_8px_25px_-5px_rgba(139,92,246,0.4)] transition-all"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
                <Button
                  onClick={handleExit}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all"
                >
                  Exit Game
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameTemplate;
