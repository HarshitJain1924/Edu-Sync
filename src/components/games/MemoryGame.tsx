import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Card = {
  id: number;
  value: string;
  flipped: boolean;
  matched: boolean;
};

type Props = {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
};

const EMOJIS = ["🍎","🍌","🍇","🍒","🍉","🍍","🥝","🍑","🥑","🍋","🍓","🍐"];

export default function MemoryGame({ paused, onFinish, onScoreChange }: Props) {
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [attempts, setAttempts] = useState(0);
  const totalPairs = useMemo(() => (rows * cols) / 2, [rows, cols]);
  const [cards, setCards] = useState<Card[]>(() => makeDeck(rows, cols));
  const flipped = cards.filter((c) => c.flipped && !c.matched);

  useEffect(() => {
    const matchedCount = cards.filter((c) => c.matched).length / 2;
    const score = matchedCount * 10 - attempts;
    onScoreChange?.(Math.max(0, score));
    if (matchedCount === totalPairs) {
      const xp = Math.max(10, 100 - attempts * 2);
      onFinish({ score: Math.max(0, score), xp });
    }
  }, [cards, attempts, totalPairs]);

  useEffect(() => {
    setCards(makeDeck(rows, cols));
    setAttempts(0);
    onScoreChange?.(0);
  }, [rows, cols]);

  function onCardClick(idx: number) {
    if (paused) return;
    setCards((prev) => {
      let next = prev.slice();
      const card = next[idx];
      if (card.flipped || card.matched) return prev;
      const currentlyFlipped = next.filter((c) => c.flipped && !c.matched);
      if (currentlyFlipped.length === 2) return prev;
      next[idx] = { ...card, flipped: true };
      const afterFlip = next.filter((c) => c.flipped && !c.matched);
      if (afterFlip.length === 2) {
        setAttempts((a) => a + 1);
        const [a, b] = afterFlip;
        if (a.value === b.value) {
          // mark matched
          next = next.map((c) => (c.flipped && !c.matched && c.value === a.value ? { ...c, matched: true } : c));
          // unflip matched
          next = next.map((c) => (c.matched ? { ...c, flipped: false } : c));
        } else {
          // unflip later
          setTimeout(() => {
            setCards((curr) => curr.map((c) => (c.flipped && !c.matched ? { ...c, flipped: false } : c)));
          }, 600);
        }
      }
      return next;
    });
  }

  function reset() {
    setCards(makeDeck(rows, cols));
    setAttempts(0);
    onScoreChange?.(0);
  }

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Select value={`${rows}x${cols}`} onValueChange={(v) => { const [r,c] = v.split("x").map(Number); setRows(r); setCols(c); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Grid"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="3x4">3×4</SelectItem>
            <SelectItem value="4x4">4×4</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">Attempts: <span className="font-semibold">{attempts}</span></div>
        <Button variant="ghost" onClick={reset}>Reset</Button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 4rem))` }}>
        {cards.map((card, idx) => (
          <button
            key={card.id}
            onClick={() => onCardClick(idx)}
            className={["w-16 h-20 md:w-20 md:h-24 rounded-lg border border-border flex items-center justify-center transition-transform",
              card.matched ? "bg-green-500/20" : card.flipped ? "bg-primary/20" : "bg-card hover:scale-105"].join(" ")}
          >
            <span className="text-2xl">{card.flipped || card.matched ? card.value : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function makeDeck(rows: number, cols: number): Card[] {
  const neededPairs = (rows * cols) / 2;
  const values = EMOJIS.slice(0, neededPairs);
  const deck: Card[] = [];
  let id = 1;
  for (const v of values) {
    deck.push({ id: id++, value: v, flipped: false, matched: false });
    deck.push({ id: id++, value: v, flipped: false, matched: false });
  }
  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
