import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Brain, Grid3x3, Puzzle, Zap, Layers, Timer, Keyboard, Target,
  Fingerprint, LayoutGrid, Calculator, CornerUpRight, Activity,
  GitMerge, ShieldCheck, Gamepad2, Filter
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AppSidebar from "@/components/AppSidebar";

type Difficulty = "Easy" | "Medium" | "Hard" | "Extreme";

interface GameItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  difficulty: Difficulty;
  xp: number;
  gradient: string;
  glowColor: string;
  featured?: boolean;
}

const Games = () => {
  const navigate = useNavigate();
  useRequireAuth();
  const [difficultyFilter, setDifficultyFilter] = useState<"All" | Difficulty>("All");

  const games: GameItem[] = [
    {
      id: "assessment",
      title: "Cognitive Assessment",
      description: "A full 15-minute corporate-style exam evaluating memory, logic, spatial reasoning, and reaction speed.",
      icon: ShieldCheck,
      difficulty: "Extreme",
      xp: 250,
      gradient: "from-blue-600 to-indigo-800",
      glowColor: "rgba(99,102,241,0.4)",
      featured: true,
    },
    {
      id: "sudoku",
      title: "Sudoku",
      description: "Classic number puzzle to sharpen your logic skills",
      icon: Grid3x3,
      difficulty: "Medium",
      xp: 50,
      gradient: "from-blue-500 to-cyan-500",
      glowColor: "rgba(6,182,212,0.3)",
    },
    {
      id: "nback",
      title: "N-Back Challenge",
      description: "Boost working memory with this cognitive test used in corporate hiring",
      icon: Fingerprint,
      difficulty: "Hard",
      xp: 80,
      gradient: "from-emerald-500 to-teal-500",
      glowColor: "rgba(20,184,166,0.3)",
    },
    {
      id: "grid",
      title: "Spatial Grid Memory",
      description: "Memorize and recreate patterns on a shifting spatial grid",
      icon: LayoutGrid,
      difficulty: "Medium",
      xp: 60,
      gradient: "from-blue-600 to-indigo-600",
      glowColor: "rgba(79,70,229,0.3)",
    },
    {
      id: "logic",
      title: "Deductive Logic",
      description: "Solve symbol-based algebraic equations under time pressure",
      icon: Calculator,
      difficulty: "Hard",
      xp: 90,
      gradient: "from-violet-600 to-purple-800",
      glowColor: "rgba(139,92,246,0.35)",
    },
    {
      id: "maze",
      title: "Maze Escape",
      description: "Navigate the maze — find the key and reach the door",
      icon: CornerUpRight,
      difficulty: "Medium",
      xp: 70,
      gradient: "from-yellow-500 to-orange-600",
      glowColor: "rgba(234,88,12,0.3)",
    },
    {
      id: "bubble",
      title: "Bubble Math",
      description: "Pop floating numbers in ascending order before time runs out",
      icon: Activity,
      difficulty: "Easy",
      xp: 40,
      gradient: "from-pink-500 to-rose-600",
      glowColor: "rgba(225,29,72,0.25)",
    },
    {
      id: "pipe",
      title: "Pipe Connect",
      description: "Rotate pipe segments to build a connected path from start to end",
      icon: GitMerge,
      difficulty: "Medium",
      xp: 65,
      gradient: "from-blue-400 to-cyan-500",
      glowColor: "rgba(6,182,212,0.25)",
    },
    {
      id: "queens",
      title: "Queens Puzzle",
      description: "Place queens on a chessboard without any conflicts",
      icon: Puzzle,
      difficulty: "Hard",
      xp: 75,
      gradient: "from-purple-500 to-pink-500",
      glowColor: "rgba(168,85,247,0.3)",
    },
    {
      id: "pattern",
      title: "Pattern Matching",
      description: "Identify and match visual patterns as fast as you can",
      icon: Layers,
      difficulty: "Easy",
      xp: 30,
      gradient: "from-green-500 to-emerald-500",
      glowColor: "rgba(16,185,129,0.25)",
    },
    {
      id: "zip",
      title: "Zip Match",
      description: "Connect matching pairs in the minimum number of moves",
      icon: Zap,
      difficulty: "Medium",
      xp: 40,
      gradient: "from-yellow-500 to-orange-500",
      glowColor: "rgba(245,158,11,0.3)",
    },
    {
      id: "memory",
      title: "Memory Flip",
      description: "Classic memory card game to train your visual recall",
      icon: Brain,
      difficulty: "Easy",
      xp: 25,
      gradient: "from-red-500 to-rose-500",
      glowColor: "rgba(239,68,68,0.25)",
    },
    {
      id: "speed",
      title: "Brain Speed Test",
      description: "Quick mental math challenges racing against the clock",
      icon: Timer,
      difficulty: "Medium",
      xp: 45,
      gradient: "from-indigo-500 to-purple-500",
      glowColor: "rgba(99,102,241,0.3)",
    },
    {
      id: "typing",
      title: "Typing Speed Test",
      description: "Test and improve your typing accuracy and WPM speed",
      icon: Keyboard,
      difficulty: "Easy",
      xp: 35,
      gradient: "from-teal-500 to-cyan-500",
      glowColor: "rgba(20,184,166,0.25)",
    },
    {
      id: "aptitude",
      title: "Aptitude Speed Run",
      description: "Solve placement-style aptitude questions as fast as possible",
      icon: Target,
      difficulty: "Hard",
      xp: 100,
      gradient: "from-amber-500 to-red-500",
      glowColor: "rgba(239,68,68,0.35)",
    },
  ];

  const featured = games.find((g) => g.featured);
  const regularGames = games.filter((g) => !g.featured);
  const filteredGames = difficultyFilter === "All"
    ? regularGames
    : regularGames.filter((g) => g.difficulty === difficultyFilter);

  const difficultyConfig: Record<Difficulty, { text: string; bg: string; border: string }> = {
    Easy: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    Medium: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    Hard: { text: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    Extreme: { text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  };

  const filterOptions: Array<"All" | Difficulty> = ["All", "Easy", "Medium", "Hard"];

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-[#0f0f0f] transition-colors duration-500">
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
        {/* Ambient Depth Orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden ml-64">
          <div className="absolute -top-[15%] -right-[10%] h-[55%] w-[55%] bg-violet-500/[0.08] blur-[140px]" />
          <div className="absolute -bottom-[10%] -left-[10%] h-[55%] w-[55%] bg-blue-500/[0.06] blur-[140px]" />
          <div className="absolute top-[35%] left-[20%] h-[35%] w-[35%] bg-violet-500/5 blur-[130px]" />
        </div>

        <div className="relative z-10 min-h-screen p-8 md:p-10">
          {/* Header */}
          <header className="mb-10 flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10">
                  <Gamepad2 className="h-6 w-6 text-violet-300" />
                </div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">Play & Prepare</h1>
              </div>
              <p className="text-zinc-400 text-base max-w-xl">
                Sharpen your cognitive skills with fun, gamified challenges designed to boost your placement readiness.
              </p>
            </div>

            {/* Difficulty Filter Pills */}
            <div className="flex gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5 shrink-0">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setDifficultyFilter(opt)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] rounded-xl transition-all duration-300 ${
                    difficultyFilter === opt
                      ? "bg-white/10 text-white border border-white/15 shadow-[0_0_10px_rgba(167,139,250,0.1)]"
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </header>

          {/* Featured Hero Banner */}
          {featured && (
            <section className="mb-10">
              <div
                className="group relative rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500"
                onClick={() => navigate(`/games/${featured.id}`)}
                style={{
                  boxShadow: `0 20px 60px -15px ${featured.glowColor}`
                }}
              >
                {/* Dark Base Background */}
                <div className="absolute inset-0 bg-[#0b0b0b]" />
                {/* Subtle Gradient Glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${featured.gradient} opacity-10`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_50%)]" />
                <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-sm" />

                <div className="relative p-10 md:p-12 flex items-center justify-between gap-8">
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-lg ${difficultyConfig[featured.difficulty].bg} ${difficultyConfig[featured.difficulty].text} border ${difficultyConfig[featured.difficulty].border}`}>
                        {featured.difficulty}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        <Zap className="h-3 w-3" />
                        {featured.xp} XP
                      </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                      {featured.title}
                    </h2>
                    <p className="text-white/70 text-base max-w-lg leading-relaxed">
                      {featured.description}
                    </p>
                    <Button
                      className="bg-white text-indigo-900 hover:bg-white/90 font-bold text-sm px-8 py-3 h-auto rounded-xl shadow-[0_8px_30px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_-5px_rgba(255,255,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                    >
                      Start Assessment
                    </Button>
                  </div>

                  <div className="hidden lg:flex items-center justify-center w-40 h-40 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500">
                    <featured.icon className="h-16 w-16 text-white/90" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Game Grid */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {filteredGames.map((game, idx) => {
                const dc = difficultyConfig[game.difficulty];
                const isHard = game.difficulty === "Hard" || game.difficulty === "Extreme";

                return (
                  <div
                    key={game.id}
                    className={`group relative rounded-[1.75rem] bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] overflow-hidden cursor-pointer transition-all duration-400 hover:-translate-y-1.5 ${
                      isHard
                        ? "hover:shadow-[0_20px_50px_-10px_var(--glow)] hover:border-white/15"
                        : "hover:shadow-[0_16px_40px_-12px_var(--glow)] hover:border-white/10"
                    }`}
                    style={{ "--glow": game.glowColor, animationDelay: `${idx * 50}ms` } as React.CSSProperties}
                    onClick={() => navigate(`/games/${game.id}`)}
                  >
                    {/* Top gradient accent line */}
                    <div className={`h-[2px] w-full bg-gradient-to-r ${game.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />

                    <div className="p-6 space-y-5">
                      {/* Icon + Difficulty Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className={`p-3 rounded-2xl bg-gradient-to-br ${game.gradient} shadow-lg transition-all duration-300 group-hover:shadow-[0_0_20px_var(--glow)] group-hover:scale-110`}
                          style={{ "--glow": game.glowColor } as React.CSSProperties}
                        >
                          <game.icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg ${dc.bg} ${dc.text} border ${dc.border}`}>
                            {game.difficulty}
                          </span>
                        </div>
                      </div>

                      {/* Title + Description */}
                      <div className="space-y-1.5">
                        <h3 className="text-[15px] font-bold text-white leading-snug group-hover:text-violet-100 transition-colors duration-300">
                          {game.title}
                        </h3>
                        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 group-hover:text-zinc-400 transition-colors">
                          {game.description}
                        </p>
                      </div>

                      {/* Footer: XP + Play Button */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300/80 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/10">
                          <Zap className="h-3 w-3" />
                          {game.xp} XP
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 group-hover:text-violet-300 transition-colors duration-300">
                          Play →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredGames.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center">
                <Filter className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 font-semibold mb-1">No games match this filter</p>
                <p className="text-zinc-600 text-sm">Try selecting a different difficulty level.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Games;
