import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";

interface GridMemoryProps {
  onScoreChange: (score: number) => void;
  paused: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  isMiniGame?: boolean;
  onNextMiniGame?: (score: number, xp: number) => void;
}

export default function GridMemory({ onScoreChange, paused, onFinish, isMiniGame, onNextMiniGame }: GridMemoryProps) {
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [showingSequence, setShowingSequence] = useState(false);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [gridSize, setGridSize] = useState(3); // 3x3 initially
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("Get Ready!");

  // Start new level
  useEffect(() => {
    if (gameOver || paused) return;

    // Adjust grid size based on level (3x3 up to level 5, 4x4 up to 10, 5x5 thereafter)
    const newSize = level < 6 ? 3 : level < 12 ? 4 : 5;
    if (newSize !== gridSize) setGridSize(newSize);

    const seqLength = 2 + level; // Level 1 = 3 tiles, Level 2 = 4 tiles
    const newSeq: number[] = [];
    const totalTiles = newSize * newSize;

    for (let i = 0; i < seqLength; i++) {
      newSeq.push(Math.floor(Math.random() * totalTiles));
    }

    setSequence(newSeq);
    setPlayerSequence([]);
    setShowingSequence(true);
    setMessage("Watch the pattern...");

    // Play sequence
    let step = 0;
    const interval = 800 - Math.min(level * 30, 400); // Speed up as level increases

    // Initial delay before showing
    const startDelay = setTimeout(() => {
      const playInterval = setInterval(() => {
        if (step >= newSeq.length) {
          clearInterval(playInterval);
          setActiveTile(null);
          setShowingSequence(false);
          setMessage("Your turn! Repeat the pattern.");
          return;
        }

        setActiveTile(newSeq[step]);
        
        // Turn off light shortly before next step for clear separation when same tile repeats
        setTimeout(() => setActiveTile(null), interval * 0.7);

        step++;
      }, interval);

      return () => clearInterval(playInterval);
    }, 1000);

    return () => clearTimeout(startDelay);
  }, [level, gameOver, paused]);

  const handleGameOver = () => {
    setGameOver(true);
    const xp = Math.min(score * 2 + level * 10, 100);
    onFinish({ score, xp });
  };

  const handleTileClick = (index: number) => {
    if (showingSequence || gameOver || paused) return;

    // Visual feedback for click
    setActiveTile(index);
    setTimeout(() => setActiveTile(null), 200);

    const newPlayerSeq = [...playerSequence, index];
    setPlayerSequence(newPlayerSeq);

    const currentIndex = newPlayerSeq.length - 1;

    // Check correctness
    if (newPlayerSeq[currentIndex] !== sequence[currentIndex]) {
      // Wrong tile
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          handleGameOver();
        } else {
          setMessage("Wrong! Watch again.");
          // Replay current level
          setTimeout(() => {
            setLevel(level); // trigger useEffect logic again by forcing a re-render/reset if needed, but since it depends on state mostly we explicitly re-trigger
            setPlayerSequence([]);
            setShowingSequence(true);
            
            // Re-play sequence
            let step = 0;
            const interval = 800 - Math.min(level * 30, 400);
            const playInterval = setInterval(() => {
              if (step >= sequence.length) {
                clearInterval(playInterval);
                setActiveTile(null);
                setShowingSequence(false);
                setMessage("Your turn! Repeat the pattern.");
                return;
              }
              setActiveTile(sequence[step]);
              setTimeout(() => setActiveTile(null), interval * 0.7);
              step++;
            }, interval);
          }, 1000);
        }
        return newLives;
      });
      return;
    }

    // If correct and sequence complete
    if (newPlayerSeq.length === sequence.length) {
      setMessage("Perfect! Next level...");
      const levelScore = sequence.length * 10;
      const newScore = score + levelScore;
      setScore(newScore);
      onScoreChange(newScore);

      setShowingSequence(true); // lock board
      
      if (isMiniGame && level >= 2) {
        setTimeout(() => {
          const xp = Math.min(newScore * 2 + level * 10, 100);
          if (onNextMiniGame) onNextMiniGame(newScore, xp);
          else onFinish({ score: newScore, xp });
        }, 1000);
        return;
      }

      setTimeout(() => {
        setLevel((prev) => prev + 1);
      }, 1000);
    }
  };

  if (gameOver) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Spatial Grid Memory
        </h2>
        <p className="text-muted-foreground text-sm font-medium h-6">
          {message}
        </p>
      </div>

      <div className="flex items-center justify-between w-full px-4">
        <div className="text-sm font-bold text-muted-foreground">Level {level}</div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-3 w-3 rounded-full ${i < lives ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-gray-700"}`} />
          ))}
        </div>
      </div>

      <div 
        className="grid gap-3 p-4 bg-card rounded-2xl border border-border shadow-2xl"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          width: '100%',
          maxWidth: gridSize === 3 ? '320px' : gridSize === 4 ? '400px' : '480px',
          aspectRatio: '1/1'
        }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, index) => (
          <button
            key={index}
            disabled={showingSequence || paused}
            onClick={() => handleTileClick(index)}
            className={`rounded-xl transition-all duration-200 border-2 ${
              activeTile === index
                ? "bg-blue-500 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-95"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(playerSequence.length / Math.max(sequence.length, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
