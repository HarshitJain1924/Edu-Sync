import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = { key: string; label: string; pair: string };
type Card = { id: number; key: string; label: string; revealed: boolean; matched: boolean };

type Props = {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
};

const DATA: Item[] = [
  { key: "1", label: "One", pair: "1" },
  { key: "2", label: "Two", pair: "2" },
  { key: "JS", label: "JavaScript", pair: "JS" },
  { key: "TS", label: "TypeScript", pair: "TS" },
  { key: "PI", label: "3.14", pair: "PI" },
  { key: "EVEN", label: "Even? 6", pair: "EVEN" },
];

export default function ZipMatch({ paused, onFinish, onScoreChange }: Props) {
  const [attempts, setAttempts] = useState(0);
  const [cards, setCards] = useState<Card[]>(() => makeCards());
  const revealed = cards.filter((c) => c.revealed && !c.matched);

  const matchedPairs = useMemo(() => cards.filter((c) => c.matched).length / 2, [cards]);
  const totalPairs = useMemo(() => cards.length / 2, [cards]);

  useEffect(() => {
    const score = matchedPairs * 12 - attempts;
    onScoreChange?.(Math.max(0, score));
    if (matchedPairs === totalPairs) {
      const xp = Math.max(10, 80 - attempts);
      onFinish({ score: Math.max(0, score), xp });
    }
  }, [matchedPairs, totalPairs, attempts]);

  function onCardClick(idx: number) {
    if (paused) return;
    setCards((prev) => {
      const next = prev.slice();
      const card = next[idx];
      if (card.matched || card.revealed) return prev;
      const curr = next.filter((c) => c.revealed && !c.matched);
      if (curr.length === 2) return prev;
      next[idx] = { ...card, revealed: true };
      const after = next.filter((c) => c.revealed && !c.matched);
      if (after.length === 2) {
        setAttempts((a) => a + 1);
        const [a, b] = after;
        if (a.key === b.key) {
          // match
          next.forEach((c) => { if (c.revealed && !c.matched && c.key === a.key) c.matched = true; });
          next.forEach((c) => { if (c.matched) c.revealed = false; });
        } else {
          setTimeout(() => {
            setCards((curr2) => curr2.map((c) => (c.revealed && !c.matched ? { ...c, revealed: false } : c)));
          }, 600);
        }
      }
      return next;
    });
  }

  function reset() {
    setCards(makeCards());
    setAttempts(0);
    onScoreChange?.(0);
  }

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div>Attempts: <span className="font-semibold">{attempts}</span></div>
        <div>Remaining: <span className="font-semibold">{totalPairs - matchedPairs}</span></div>
        <Button variant="ghost" onClick={reset}>Restart</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onCardClick(i)}
            className={["w-28 h-16 rounded-md border border-border bg-card flex items-center justify-center transition-transform",
              c.matched ? "bg-green-500/20" : c.revealed ? "bg-primary/20" : "hover:scale-105"].join(" ")}
          >
            <span className="text-sm font-medium">{c.revealed || c.matched ? c.label : "?"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function makeCards(): Card[] {
  const items: Item[] = shuffle(DATA).slice(0, 6);
  const arr: Card[] = [];
  let id = 1;
  for (const it of items) {
    arr.push({ id: id++, key: it.key, label: it.label, revealed: false, matched: false });
    arr.push({ id: id++, key: it.key, label: it.pair, revealed: false, matched: false });
  }
  return shuffle(arr);
}

function shuffle<T>(a: T[]): T[] { const arr = a.slice(); for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
