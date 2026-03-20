import { useState, useEffect, useCallback } from "react";
import { DoorOpen, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MazeKeyDoorProps {
  onScoreChange: (score: number) => void;
  paused: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  isMiniGame?: boolean;
  onNextMiniGame?: (scoreEarned: number, xpEarned: number) => void;
}

type Position = { r: number; c: number };

// Simple maze configs
const MAZES = {
  1: { size: 6, start: {r:0,c:0}, key: {r:5,c:0}, door: {r:5,c:5},
       walls: ["0,1","1,1","1,3","2,3","3,3","4,3","2,5","3,5","5,1","5,4","4,1"] },
  2: { size: 8, start: {r:0,c:0}, key: {r:7,c:0}, door: {r:7,c:7},
       walls: ["0,1","1,1","2,1","2,2","2,3","1,3","1,5","2,5","3,5","4,5","5,5","6,5","7,5","5,3","6,3","7,3","4,1","5,1","6,1","1,7","2,7","3,7"] },
  3: { size: 10, start: {r:0,c:0}, key: {r:0,c:9}, door: {r:9,c:9},
       walls: ["0,1","1,1","2,1","3,1","3,2","3,3","2,3","1,3","0,3","0,5","1,5","2,5","3,5","4,5","5,5","6,5","7,5","8,5","8,4","8,3","7,3","6,3","5,3","5,1","6,1","7,1","8,1","9,1","9,3","9,7","8,7","7,7","6,7","5,7","4,7","3,7","2,7","1,7","1,8","1,9","3,9","4,9","5,9","7,9"] }
};

export default function MazeKeyDoor({ onScoreChange, paused, onFinish, isMiniGame, onNextMiniGame }: MazeKeyDoorProps) {
  const [level, setLevel] = useState(1);
  const maze = MAZES[Math.min(level, 3) as keyof typeof MAZES];
  
  const [pos, setPos] = useState<Position>(maze.start);
  const [hasKey, setHasKey] = useState(false);
  const [moves, setMoves] = useState(0);
  const [discoveredWalls, setDiscoveredWalls] = useState<Set<string>>(new Set());
  const [gameOver, setGameOver] = useState(false);
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const handleGameOver = useCallback(() => {
    setGameOver(true);
    const xp = Math.min(score * 2 + level * 10, 100);
    if (isMiniGame && onNextMiniGame) {
      onNextMiniGame(score, xp);
    } else {
      onFinish({ score, xp });
    }
  }, [score, level, isMiniGame, onNextMiniGame, onFinish]);

  // Timer
  useEffect(() => {
    if (paused || gameOver) return;
    if (timeLeft <= 0) {
      setLives(prev => {
        if (prev <= 1) handleGameOver();
        else {
          setTimeLeft(60);
          resetLevel();
        }
        return prev - 1;
      });
      return;
    }
    const t = setInterval(() => setTimeLeft(l => l - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, paused, gameOver, handleGameOver]);

  const resetLevel = () => {
    setPos(maze.start);
    setHasKey(false);
    // keeping discovered walls to make it slightly easier on retry
  };

  const startLevel = (l: number) => {
    setLevel(l);
    const newMaze = MAZES[Math.min(l, 3) as keyof typeof MAZES];
    setPos(newMaze.start);
    setHasKey(false);
    setDiscoveredWalls(new Set());
    setMoves(0);
    setTimeLeft(60 - (l * 5));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (paused || gameOver) return;
      
      let dr = 0, dc = 0;
      if (e.key === "ArrowUp" || e.key === "w") dr = -1;
      else if (e.key === "ArrowDown" || e.key === "s") dr = 1;
      else if (e.key === "ArrowLeft" || e.key === "a") dc = -1;
      else if (e.key === "ArrowRight" || e.key === "d") dc = 1;
      else return;

      e.preventDefault();
      
      const nr = pos.r + dr;
      const nc = pos.c + dc;
      
      if (nr < 0 || nr >= maze.size || nc < 0 || nc >= maze.size) return;
      
      const posStr = `${nr},${nc}`;
      
      if (maze.walls.includes(posStr)) {
        // Hit a wall
        setDiscoveredWalls(new Set(discoveredWalls).add(posStr));
        resetLevel(); // Restart from beginning
        return;
      }
      
      // Move
      setMoves(m => m + 1);
      setPos({ r: nr, c: nc });
      
      // Check Key
      if (!hasKey && nr === maze.key.r && nc === maze.key.c) {
        setHasKey(true);
      }
      
      // Check Door
      if (hasKey && nr === maze.door.r && nc === maze.door.c) {
        const bonus = Math.max(0, 50 - moves) + timeLeft;
        const newScore = score + 50 + bonus;
        setScore(newScore);
        onScoreChange(newScore);
        
        if (level < 3) {
          startLevel(level + 1);
        } else {
          handleGameOver();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pos, paused, gameOver, maze, hasKey, discoveredWalls, score, moves, timeLeft, level, onScoreChange, handleGameOver]);

  if (gameOver) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          Maze Key-Door
        </h2>
        <p className="text-muted-foreground text-sm">Find the Key 🗝️ then reach the Door 🚪. Beware of invisible walls!</p>
      </div>

      <div className="flex items-center justify-between w-full px-4">
        <div className="text-sm font-bold text-muted-foreground flex gap-4">
          <span>Level {level}</span>
          <span>Moves: {moves}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>0:{timeLeft.toString().padStart(2, '0')}</div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`h-3 w-3 rounded-full ${i < lives ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-gray-700"}`} />
            ))}
          </div>
        </div>
      </div>

      <div 
        className="bg-card p-4 rounded-xl border shadow-xl relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${maze.size}, 1fr)`,
          gap: '4px',
          width: '100%',
          maxWidth: '400px',
          aspectRatio: '1/1'
        }}
      >
        {Array.from({ length: maze.size * maze.size }).map((_, i) => {
          const r = Math.floor(i / maze.size);
          const c = i % maze.size;
          const posStr = `${r},${c}`;
          
          const isPlayer = pos.r === r && pos.c === c;
          const isKey = maze.key.r === r && maze.key.c === c;
          const isDoor = maze.door.r === r && maze.door.c === c;
          const isWallDiscovered = discoveredWalls.has(posStr);
          const isStart = maze.start.r === r && maze.start.c === c;

          return (
            <div 
              key={i} 
              className={`rounded-md flex items-center justify-center relative transition-all duration-300 ${
                isWallDiscovered ? "bg-red-500/20 border border-red-500/50" : "bg-white/5 border border-white/10"
              } ${isStart ? "bg-emerald-500/10" : ""}`}
            >
              {isPlayer && (
                <div className="absolute inset-0 m-auto w-3/4 h-3/4 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10 animate-pulse" />
              )}
              {!hasKey && isKey && (
                <Key className="h-1/2 w-1/2 text-yellow-400 drop-shadow-lg" />
              )}
              {isDoor && (
                <DoorOpen className={`h-1/2 w-1/2 ${hasKey ? "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]" : "text-gray-500"}`} />
              )}
            </div>
          )
        })}
      </div>
      
      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-2 md:hidden mt-4">
        <div />
        <Button variant="secondary" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))}>↑</Button>
        <div />
        <Button variant="secondary" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))}>←</Button>
        <Button variant="secondary" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))}>↓</Button>
        <Button variant="secondary" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))}>→</Button>
      </div>
    </div>
  );
}
