import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
  isMiniGame?: boolean;
  onNextMiniGame?: (score: number, xp: number) => void;
};

const pads = [
  { id: 0, color: "bg-red-500" },
  { id: 1, color: "bg-blue-500" },
  { id: 2, color: "bg-green-500" },
  { id: 3, color: "bg-yellow-500" },
];

export default function PatternGame({ paused, onFinish, onScoreChange, isMiniGame, onNextMiniGame }: Props) {
  const [sequence, setSequence] = useState<number[]>([randPad()]);
  const [step, setStep] = useState(0);
  const [playingBack, setPlayingBack] = useState(true);
  const [activePad, setActivePad] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    onScoreChange?.(Math.max(0, (sequence.length - 1) * 10));
  }, [sequence.length]);

  useEffect(() => {
    if (paused) return;
    playback();
    // cleanup
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence, paused]);

  function playback() {
    setPlayingBack(true);
    let i = 0;
    const playNext = () => {
      if (i >= sequence.length) {
        setPlayingBack(false);
        setActivePad(null);
        setStep(0);
        return;
      }
      setActivePad(sequence[i]);
      timeoutRef.current = window.setTimeout(() => {
        setActivePad(null);
        timeoutRef.current = window.setTimeout(() => {
          i++;
          playNext();
        }, 200);
      }, 500);
    };
    playNext();
  }

  function onPadClick(id: number) {
    if (paused || playingBack) return;
    const expected = sequence[step];
    if (id === expected) {
      if (step + 1 === sequence.length) {
        if (isMiniGame && sequence.length >= 5) {
          const score = Math.max(0, (sequence.length - 1) * 10);
          const xp = 10 + (sequence.length - 1) * 5;
          if (onNextMiniGame) onNextMiniGame(score, xp);
          else onFinish({ score, xp });
          return;
        }
        // level up
        setSequence((s) => [...s, randPad()]);
      } else {
        setStep(step + 1);
      }
    } else {
      const score = Math.max(0, (sequence.length - 1) * 10);
      const xp = 10 + (sequence.length - 1) * 5;
      onFinish({ score, xp });
    }
  }

  function restart() {
    setSequence([randPad()]);
    setStep(0);
    setPlayingBack(true);
    onScoreChange?.(0);
  }

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="grid grid-cols-2 gap-4">
        {pads.map((p) => (
          <button
            key={p.id}
            onClick={() => onPadClick(p.id)}
            className={["w-28 h-28 md:w-32 md:h-32 rounded-xl shadow-soft transition-transform",
              p.color,
              activePad === p.id ? "ring-4 ring-white scale-105" : "hover:scale-105"].join(" ")}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">Level: <span className="font-semibold">{sequence.length - 1}</span></div>
        <Button variant="ghost" onClick={restart}>Restart</Button>
      </div>
    </div>
  );
}

function randPad(): number { return Math.floor(Math.random() * 4); }
