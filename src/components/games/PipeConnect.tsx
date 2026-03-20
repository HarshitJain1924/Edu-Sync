import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface PipeConnectProps {
  onScoreChange: (score: number) => void;
  paused: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  isMiniGame?: boolean;
  onNextMiniGame?: (scoreEarned: number, xpEarned: number) => void;
}

// Bitmask for directions: 1=UP, 2=RIGHT, 4=DOWN, 8=LEFT
// e.g. Straight vertical = 1+4 = 5
// Straight horizontal = 2+8 = 10
// Corner top-right = 1+2 = 3
// T-junction (no bottom) = 1+2+8 = 11

const PIPES = [
  5, 10,           // Straight (2)
  3, 6, 12, 9,     // Corner (4)
  11, 7, 14, 13,   // T-junction (4)
  15               // Cross (1)
];

const rotatePipe = (p: number) => ((p << 1) & 15) | (p >> 3);

type Cell = {
  type: number;
};

export default function PipeConnect({ onScoreChange, paused, onFinish, isMiniGame, onNextMiniGame }: PipeConnectProps) {
  const [level, setLevel] = useState(1);
  const size = level === 1 ? 5 : level === 2 ? 6 : 7; // simplified size logic to fit nicely
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [connected, setConnected] = useState<boolean[][]>([]);
  
  const [score, setScore] = useState(0);
  const [rotations, setRotations] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [gameOver, setGameOver] = useState(false);
  const [wonRound, setWonRound] = useState(false);
  
  const handleGameOver = useCallback(() => {
    setGameOver(true);
    const xp = Math.min(score * 2 + level * 20, 100);
    if (isMiniGame && onNextMiniGame) {
      onNextMiniGame(score, xp);
    } else {
      onFinish({ score, xp });
    }
  }, [score, level, isMiniGame, onNextMiniGame, onFinish]);

  // Generate solvable board
  const generateBoard = useCallback((currentLevel: number) => {
    const s = currentLevel === 1 ? 5 : currentLevel === 2 ? 6 : 7;
    const newGrid: Cell[][] = Array.from({ length: s }, () => 
      Array.from({ length: s }, () => ({ type: 0 }))
    );
    
    // 1. Create a random walk from (0,0) to (s-1, s-1)
    let r = 0, c = 0;
    const path = [{r, c}];
    while (r < s - 1 || c < s - 1) {
       // favor going towards bottom-right
       if (r === s - 1) c++;
       else if (c === s - 1) r++;
       else {
         if (Math.random() > 0.5) r++;
         else c++;
       }
       path.push({r, c});
    }

    // Assign pipes to path
    for (let i = 0; i < path.length; i++) {
       let inDir = 0;
       let outDir = 0;
       
       if (i > 0) {
         const prev = path[i-1];
         if (prev.r < path[i].r) inDir = 1; // entered from top
         else if (prev.c < path[i].c) inDir = 8; // entered from left
       } else {
         inDir = 8; // start receives from left (imaginary)
       }

       if (i < path.length - 1) {
         const next = path[i+1];
         if (next.r > path[i].r) outDir = 4; // going down
         else if (next.c > path[i].c) outDir = 2; // going right
       } else {
         outDir = 2; // end goes to right (imaginary)
       }

       newGrid[path[i].r][path[i].c].type = inDir | outDir;
    }

    // Assign random pipes to the rest to confuse the player, except start (0,0) and end (s-1,s-1)
    for (let i = 0; i < s; i++) {
       for (let j = 0; j < s; j++) {
         if (newGrid[i][j].type === 0) {
           newGrid[i][j].type = PIPES[Math.floor(Math.random() * PIPES.length)];
         }
         
         // Scramble rotations, but DON'T scramble the Start or End blocks
         if (i === 0 && j === 0) {
           // Start is fixed - force it to output RIGHT (2) and visually connect from LEFT (8)
           // T-junction or Corner works. Let's make it a simple straight pipe 10 (8+2)
           newGrid[0][0].type = 10; 
         } else if (i === s-1 && j === s-1) {
           // End is fixed - force it to receive from TOP (1) or LEFT (8) and output RIGHT (2)
           // Let's make it a T-junction that receives from top and left and outputs right
           newGrid[s-1][s-1].type = 11; // 1 (UP) + 2 (RIGHT) + 8 (LEFT)
         } else {
           // Randomize all other pipes
           const rots = Math.floor(Math.random() * 4);
           for(let k=0; k<rots; k++) newGrid[i][j].type = rotatePipe(newGrid[i][j].type);
         }
       }
    }

    setGrid(newGrid);
    setRotations(0);
    setWonRound(false);
    
    // check connection instantly just in case
    checkConnections(newGrid, s);
  }, []);

  useEffect(() => {
    if (!gameOver && !paused && grid.length === 0) {
      generateBoard(1);
    }
  }, [gameOver, paused, grid, generateBoard]);

  // Timer
  useEffect(() => {
    if (paused || gameOver || grid.length === 0 || wonRound) return;
    
    if (timeLeft <= 0) {
      handleGameOver();
      return;
    }
    
    const t = setInterval(() => setTimeLeft(l => l - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, paused, gameOver, grid, wonRound, handleGameOver]);

  const checkConnections = (currentGrid: Cell[][], currentSize: number) => {
    // BFS from 0,0
    const reach = Array.from({ length: currentSize }, () => Array(currentSize).fill(false));
    const q: {r:number, c:number}[] = [];
    
    // Start node is 0,0 - only flow if it connects left (imaginary input)
    // Actually, let's just assume start (0,0) is always receiving liquid.
    q.push({r: 0, c: 0});
    reach[0][0] = true;

    while (q.length > 0) {
      const {r, c} = q.shift()!;
      const pipe = currentGrid[r][c].type;

      // check UP (1)
      if ((pipe & 1) && r > 0 && (currentGrid[r-1][c].type & 4) && !reach[r-1][c]) {
        reach[r-1][c] = true;
        q.push({r: r-1, c: c});
      }
      // check RIGHT (2)
      if ((pipe & 2) && c < currentSize - 1 && (currentGrid[r][c+1].type & 8) && !reach[r][c+1]) {
        reach[r][c+1] = true;
        q.push({r: r, c: c+1});
      }
      // check DOWN (4)
      if ((pipe & 4) && r < currentSize - 1 && (currentGrid[r+1][c].type & 1) && !reach[r+1][c]) {
        reach[r+1][c] = true;
        q.push({r: r+1, c: c});
      }
      // check LEFT (8)
      if ((pipe & 8) && c > 0 && (currentGrid[r][c-1].type & 2) && !reach[r][c-1]) {
        reach[r][c-1] = true;
        q.push({r: r, c: c-1});
      }
    }

    setConnected(reach);

    // Is end reached?
    if (reach[currentSize-1][currentSize-1]) {
       handleWonRound();
    }
  };

  const handleWonRound = () => {
    if (wonRound) return;
    setWonRound(true);
    
    const bonus = Math.max(0, 50 - rotations);
    const newScore = score + 50 + bonus + timeLeft;
    setScore(newScore);
    onScoreChange(newScore);

    setTimeout(() => {
      const nextLevel = level < 3 ? level + 1 : 1; 
      // If we are at level 3, we just cycle for now with same size, or we could handle game over.
      if (level >= 3) {
        handleGameOver();
      } else {
        setLevel(nextLevel);
        setTimeLeft(90 - nextLevel * 10);
        generateBoard(nextLevel);
      }
    }, 1500);
  };

  const handlePipeClick = (r: number, c: number) => {
    if (paused || gameOver || wonRound) return;
    
    // Prevent clicking Start and End pipes
    if (r === 0 && c === 0) return;
    if (r === size - 1 && c === size - 1) return;

    const newGrid = [...grid];
    newGrid[r] = [...grid[r]];
    newGrid[r][c] = { type: rotatePipe(newGrid[r][c].type) };
    
    setGrid(newGrid);
    setRotations(r => r + 1);
    checkConnections(newGrid, size);
  };

  const getPipeSVG = (type: number, isConnected: boolean) => {
    const color = isConnected ? "#3b82f6" : "#64748b"; // Blue if connected, slate if not
    const strokeWidth = "20";
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="drop-shadow-sm pointer-events-none">
         {/* Center Joint */}
         <circle cx="50" cy="50" r="10" fill={color} />
         {/* UP */}
         {(type & 1) && <line x1="50" y1="50" x2="50" y2="0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
         {/* RIGHT */}
         {(type & 2) && <line x1="50" y1="50" x2="100" y2="50" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
         {/* DOWN */}
         {(type & 4) && <line x1="50" y1="50" x2="50" y2="100" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
         {/* LEFT */}
         {(type & 8) && <line x1="50" y1="50" x2="0" y2="50" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
      </svg>
    )
  };

  if (gameOver) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Pipe Connect
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-wider font-bold">Connect Start (Top-Left) to End (Bottom-Right)</p>
      </div>

      <div className="flex items-center justify-between w-full px-4">
        <div className="text-sm font-bold text-muted-foreground flex gap-4">
          <span>Level {level}</span>
          <span>Rotations: {rotations}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>0:{timeLeft.toString().padStart(2, '0')}</div>
        </div>
      </div>

      <div 
        className={`bg-card p-2 rounded-xl border shadow-xl relative transition-all duration-300 ${wonRound ? 'shadow-[0_0_30px_rgba(59,130,246,0.5)] border-blue-500' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gap: '2px', // tiny gap
          width: '100%',
          maxWidth: '450px',
          aspectRatio: '1/1'
        }}
      >
        {/* START indicator */}
        <div className="absolute -left-6 top-2 w-6 h-6 flex items-center justify-center">
           <Zap className="h-5 w-5 text-blue-500 animate-pulse" />
        </div>
        
        {/* END indicator */}
        <div className="absolute -right-6 bottom-2 w-6 h-6 flex items-center justify-center">
           <div className={`h-4 w-4 rounded-full border-2 border-blue-500 ${wonRound ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)]' : 'bg-transparent'}`} />
        </div>

        {grid.map((row, r) => 
          row.map((cell, c) => {
            const isConnected = connected[r]?.[c] || false;
            const isStartOrEnd = (r === 0 && c === 0) || (r === size - 1 && c === size - 1);
            
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handlePipeClick(r, c)}
                disabled={wonRound || paused || isStartOrEnd}
                className={`${isStartOrEnd ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 hover:bg-white/10 border-white/5'} border transition-colors duration-100 flex items-center justify-center relative overflow-hidden`}
              >
                 {getPipeSVG(cell.type, isConnected)}
              </button>
            )
          })
        )}
      </div>

      {wonRound && (
        <div className="text-xl font-bold text-green-400 animate-bounce">
          Connection Established!
        </div>
      )}
    </div>
  );
}
