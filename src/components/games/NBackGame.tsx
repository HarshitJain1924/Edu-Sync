import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Check, X } from "lucide-react";

interface NBackGameProps {
  onScoreChange: (score: number) => void;
  paused: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  isMiniGame?: boolean;
  onNextMiniGame?: (score: number, xp: number) => void;
}

const SHAPES = ["square", "circle", "triangle", "star"];
const COLORS = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500"];

export default function NBackGame({ onScoreChange, paused, onFinish, isMiniGame, onNextMiniGame }: NBackGameProps) {
  const [sequence, setSequence] = useState<{ shape: string; color: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nBackLevel, setNBackLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showItem, setShowItem] = useState(true);

  const N = nBackLevel;
  const GAME_SPEED = 2500; // ms per round
  const ITEM_VISIBLE_TIME = 1500; // ms the item is shown

  const generateRandomItem = () => ({
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  });

  // Initialize sequence
  useEffect(() => {
    const initialSeq = Array.from({ length: 20 }, () => generateRandomItem());
    // Ensure some matches exist for the current N
    for (let i = N; i < 20; i++) {
      if (Math.random() > 0.6) {
        initialSeq[i] = { ...initialSeq[i - N] }; // Guarantee a match 40% of the time
      }
    }
    setSequence(initialSeq);
  }, [N]);

  // Main game loop
  useEffect(() => {
    if (paused || gameOver || sequence.length === 0) return;

    if (currentIndex >= sequence.length) {
      handleGameOver();
      return;
    }

    setHasResponded(false);
    setFeedback(null);
    setShowItem(true);

    const hideTimer = setTimeout(() => {
      setShowItem(false);
    }, ITEM_VISIBLE_TIME);

    const nextItemTimer = setTimeout(() => {
      if (!hasResponded && currentIndex >= N) {
        // Did they miss a match?
        const isMatch = sequence[currentIndex].shape === sequence[currentIndex - N].shape 
                     && sequence[currentIndex].color === sequence[currentIndex - N].color;
        
        if (isMatch) {
          handleWrongAnswer();
        }
      }
      setCurrentIndex((prev) => prev + 1);
    }, GAME_SPEED);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(nextItemTimer);
    };
  }, [currentIndex, paused, gameOver, sequence, hasResponded, N]);

  const handleGameOver = () => {
    setGameOver(true);
    const xp = Math.min(score * 2 + (nBackLevel - 1) * 20, 100);
    onFinish({ score, xp });
  };

  const handleWrongAnswer = () => {
    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        handleGameOver();
      }
      return newLives;
    });
    setFeedback("wrong");
  };

  const checkMatch = () => {
    if (hasResponded || currentIndex < N || !showItem) return;
    setHasResponded(true);

    const currentItem = sequence[currentIndex];
    const nBackItem = sequence[currentIndex - N];

    const isMatch = currentItem.shape === nBackItem.shape && currentItem.color === nBackItem.color;

    if (isMatch) {
      const newScore = score + 10 * nBackLevel;
      setScore(newScore);
      onScoreChange(newScore);
      setFeedback("correct");
      
      // Level up if score is high enough
      if (newScore > 0 && newScore % 50 === 0 && nBackLevel < 3) {
        if (isMiniGame) {
           const xp = Math.min(score * 2 + (nBackLevel - 1) * 20, 100);
           if (onNextMiniGame) onNextMiniGame(newScore, xp);
           else onFinish({ score: newScore, xp });
           return;
        }

        setNBackLevel(prev => prev + 1);
        setCurrentIndex(0); // Restart sequence at new level
        const newSeq = Array.from({ length: 20 }, () => generateRandomItem());
        for (let i = nBackLevel + 1; i < 20; i++) {
          if (Math.random() > 0.6) newSeq[i] = { ...newSeq[i - (nBackLevel + 1)] };
        }
        setSequence(newSeq);
      }
    } else {
      handleWrongAnswer();
    }
  };

  if (gameOver) return null; // Parent component handles game over UI

  const renderShape = (item: { shape: string; color: string }) => {
    const { shape, color } = item;
    const baseClasses = `w-24 h-24 ${color} shadow-lg transition-all duration-300`;
    
    switch (shape) {
      case "circle": return <div className={`${baseClasses} rounded-full`} />;
      case "square": return <div className={`${baseClasses} rounded-2xl`} />;
      case "triangle": 
        return (
          <div className="w-0 h-0 border-l-[50px] border-r-[50px] border-b-[90px] border-l-transparent border-r-transparent shadow-none" 
               style={{ borderBottomColor: color.replace('bg-', 'var(--tw-colors-') + ')' }} // Rough approximation for triangle
          >
             {/* Actual triangle implementation using div borders or inline SVG is better */}
             <svg width="100" height="100" viewBox="0 0 100 100">
               <polygon points="50,10 90,90 10,90" className={color.replace('bg-', 'fill-')} />
             </svg>
          </div>
        );
      case "star":
        return (
          <svg width="100" height="100" viewBox="0 0 100 100" className={color.replace('bg-', 'fill-') + " drop-shadow-lg"}>
            <polygon points="50,5 61,35 95,35 67,55 78,85 50,70 22,85 33,55 5,35 39,35" />
          </svg>
        );
      default: return <div className={`${baseClasses} rounded-2xl`} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          {N}-Back Challenge
        </h2>
        <p className="text-muted-foreground text-sm">
          {currentIndex < N 
            ? `Memorize the sequence... (${N - currentIndex} to go)`
            : `Does this match the item from ${N} step${N > 1 ? 's' : ''} ago?`}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-3 w-3 rounded-full ${i < lives ? "bg-red-500" : "bg-gray-700"}`} />
        ))}
      </div>

      <div className={`relative w-48 h-48 bg-card rounded-3xl border-2 flex items-center justify-center transition-all duration-300 ${
        feedback === "correct" ? "border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] bg-green-500/10" :
        feedback === "wrong" ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] bg-red-500/10" :
        "border-border shadow-2xl"
      }`}>
        {feedback === "correct" && <Check className="absolute top-4 right-4 text-green-500 h-6 w-6" />}
        {feedback === "wrong" && <X className="absolute top-4 right-4 text-red-500 h-6 w-6" />}
        
        {sequence[currentIndex] && showItem ? (
          <div className="animate-in zoom-in duration-300">
            {/* Real SVG rendering for perfection */}
             <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-2xl overflow-visible">
               {sequence[currentIndex].shape === "circle" && <circle cx="50" cy="50" r="45" fill={getColorHex(sequence[currentIndex].color)} />}
               {sequence[currentIndex].shape === "square" && <rect x="5" y="5" width="90" height="90" rx="15" fill={getColorHex(sequence[currentIndex].color)} />}
               {sequence[currentIndex].shape === "triangle" && <polygon points="50,5 95,90 5,90" fill={getColorHex(sequence[currentIndex].color)} strokeLinejoin="round" strokeWidth="5" stroke={getColorHex(sequence[currentIndex].color)} />}
               {sequence[currentIndex].shape === "star" && <polygon points="50,5 61,35 95,35 67,55 78,85 50,70 22,85 33,55 5,35 39,35" fill={getColorHex(sequence[currentIndex].color)} strokeLinejoin="round" strokeWidth="2" stroke={getColorHex(sequence[currentIndex].color)}/>}
             </svg>
          </div>
        ) : (
          <div className="h-24 w-24"></div> // placeholder to prevent layout shifts
        )}
      </div>

      <div className="flex items-center gap-4 w-full">
        <Button 
          size="lg" 
          className={`flex-1 h-16 text-lg font-bold rounded-2xl ${hasResponded ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={checkMatch}
          disabled={hasResponded || currentIndex < N || !showItem}
          variant="default"
        >
          <Brain className="mr-2 h-6 w-6" />
          IT'S A MATCH
        </Button>
      </div>

      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentIndex / sequence.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// Helper to convert tailwind classes to hex for clean SVGs
function getColorHex(twClass: string) {
  switch (twClass) {
    case "bg-red-500": return "#ef4444";
    case "bg-blue-500": return "#3b82f6";
    case "bg-green-500": return "#22c55e";
    case "bg-yellow-500": return "#eab308";
    default: return "#fff";
  }
}
