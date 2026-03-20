import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface BubbleMathProps {
  onScoreChange: (score: number) => void;
  paused: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  isMiniGame?: boolean;
  onNextMiniGame?: (scoreEarned: number, xpEarned: number) => void;
}

type Bubble = {
  id: number;
  value: number;
  display: string;
  clicked: boolean;
  x: number;
  y: number;
  color: string;
};

const COLORS = ["from-blue-400 to-cyan-400", "from-purple-400 to-pink-400", "from-emerald-400 to-teal-400", "from-orange-400 to-yellow-400", "from-red-400 to-rose-400"];

export default function BubbleMath({ onScoreChange, paused, onFinish, isMiniGame, onNextMiniGame }: BubbleMathProps) {
  const [level, setLevel] = useState(1);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [expectedValueIndex, setExpectedValueIndex] = useState(0); // Index in sorted array
  const [sortedValues, setSortedValues] = useState<number[]>([]);
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10); // slightly more than 5s to be fair with React state
  const [gameOver, setGameOver] = useState(false);
  const [round, setRound] = useState(1);
  
  const handleGameOver = useCallback(() => {
    setGameOver(true);
    const xp = Math.min(score * 2 + level * 15, 100);
    if (isMiniGame && onNextMiniGame) {
      onNextMiniGame(score, xp);
    } else {
      onFinish({ score, xp });
    }
  }, [score, level, isMiniGame, onNextMiniGame, onFinish]);

  const generateRound = useCallback((currentLevel: number) => {
    const numBubbles = currentLevel === 1 ? 3 : currentLevel === 2 ? 4 : 5;
    const newBubbles: Bubble[] = [];
    
    for (let i = 0; i < numBubbles; i++) {
      let val = 0;
      let display = "";
      
      if (currentLevel === 1) {
        // Integers
        val = Math.floor(Math.random() * 40) - 20;
        display = val.toString();
      } else if (currentLevel === 2) {
        // Decimals
        val = Number((Math.random() * 10 - 5).toFixed(1));
        display = val.toString();
      } else {
        // Fractions
        const num = Math.floor(Math.random() * 9) + 1;
        const den = Math.floor(Math.random() * 8) + 2; // 2 to 9
        val = num / den;
        display = `${num}/${den}`;
      }
      
      // Prevent duplicates
      if (newBubbles.some(b => Math.abs(b.value - val) < 0.01)) {
        i--;
        continue;
      }
      
      // Find a non-overlapping position
      let x = 0;
      let y = 0;
      let overlap = true;
      let attempts = 0;
      
      while (overlap && attempts < 50) {
        x = Math.floor(Math.random() * 70) + 10; // 10% to 80%
        y = Math.floor(Math.random() * 60) + 10; // 10% to 70%
        overlap = false;
        
        for (const b of newBubbles) {
          const dx = Math.abs(b.x - x);
          const dy = Math.abs(b.y - y);
          // Ensure they are at least 20-25% apart (rough approximation for 80px bubbles in a ~400px container)
          if (dx < 22 && dy < 25) {
            overlap = true;
            break;
          }
        }
        attempts++;
      }
      
      newBubbles.push({
        id: i,
        value: val,
        display,
        clicked: false,
        x,
        y,
        color: COLORS[i % COLORS.length]
      });
    }
    
    setBubbles(newBubbles);
    setSortedValues([...newBubbles].map(b => b.value).sort((a, b) => a - b));
    setExpectedValueIndex(0);
    setTimeLeft(currentLevel === 1 ? 8 : currentLevel === 2 ? 10 : 12);
  }, []);

  useEffect(() => {
    if (!gameOver && !paused && bubbles.length === 0) {
      generateRound(1);
    }
  }, [gameOver, paused, bubbles, generateRound]);

  // Timer
  useEffect(() => {
    if (paused || gameOver || bubbles.length === 0) return;
    
    if (timeLeft <= 0) {
      handleWrongClick(); // Time out counts as wrong
      return;
    }
    
    const t = setInterval(() => setTimeLeft(l => l - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, paused, gameOver, bubbles]);

  const handleWrongClick = () => {
    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        handleGameOver();
      } else {
        // Next round same level
        setRound(r => r + 1);
        generateRound(level);
      }
      return newLives;
    });
  };

  const handleBubbleClick = (id: number) => {
    if (paused || gameOver) return;
    
    const bubble = bubbles.find(b => b.id === id);
    if (!bubble || bubble.clicked) return;
    
    const expectedValue = sortedValues[expectedValueIndex];
    
    // Allow slight float imprecision
    if (Math.abs(bubble.value - expectedValue) < 0.01) {
      // Correct!
      const nextIndex = expectedValueIndex + 1;
      setExpectedValueIndex(nextIndex);
      setBubbles(prev => prev.map(b => b.id === id ? { ...b, clicked: true } : b));
      
      const newScore = score + 10 + (timeLeft * 2); // Time bonus
      setScore(newScore);
      onScoreChange(newScore);
      
      if (nextIndex >= sortedValues.length) {
        // Round complete
        setTimeout(() => {
          const nextLevel = (round % 3 === 0 && level < 3) ? level + 1 : level;
          if (nextLevel !== level) setLevel(nextLevel);
          setRound(r => r + 1);
          generateRound(nextLevel);
        }, 500);
      }
    } else {
      // Wrong bubble clicked
      handleWrongClick();
    }
  };

  if (gameOver) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Math Bubble Sort
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-wider font-bold">Pop bubbles in ASCENDING order (lowest to highest)</p>
      </div>

      <div className="flex items-center justify-between w-full px-4">
        <div className="text-sm font-bold text-muted-foreground flex gap-4">
          <span>Level {level}</span>
          <span>Round {round}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`font-mono font-bold ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>0:{timeLeft.toString().padStart(2, '0')}</div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`h-3 w-3 rounded-full ${i < lives ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-gray-700"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full h-[400px] bg-card/50 border border-white/10 rounded-3xl overflow-hidden shadow-inner">
        {bubbles.map(bubble => (
          <button
            key={bubble.id}
            disabled={bubble.clicked || paused}
            onClick={() => handleBubbleClick(bubble.id)}
            className={`absolute rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-95 ${
              bubble.clicked ? "opacity-0 scale-50" : "opacity-100 scale-100"
            } bg-gradient-to-br ${bubble.color}`}
            style={{
              width: '80px',
              height: '80px',
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              transitionDuration: bubble.clicked ? '300ms' : '0s' // snap to position initially
            }}
          >
            {/* Adding subtle float animation via a wrapper div */}
            <div className={`w-full h-full flex items-center justify-center font-bold text-xl text-white drop-shadow-md rounded-full shadow-[inset_-5px_-5px_20px_rgba(0,0,0,0.2),inset_5px_5px_20px_rgba(255,255,255,0.4)]`}>
              {bubble.display}
            </div>
          </button>
        ))}
        {/* Helper text if they forget */}
        {level === 1 && expectedValueIndex === 0 && (
           <div className="absolute bottom-4 w-full text-center text-xs text-white/40 animate-pulse pointer-events-none">Start with the lowest number!</div>
        )}
      </div>
    </div>
  );
}
