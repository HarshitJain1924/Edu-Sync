import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
};

export default function QueensBoard({ paused, onFinish, onScoreChange }: Props) {
  const [size, setSize] = useState(8);
  const [queens, setQueens] = useState<number[]>(() => Array(8).fill(-1)); // queens[row] = col
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());

  useEffect(() => {
    onScoreChange?.(Math.max(0, queensPlaced(queens)) * 5 - conflicts.size * 2);
    if (queensPlaced(queens) === size && conflicts.size === 0) {
      const xp = 50 + (size - 4) * 10;
      onFinish({ score: size * 10, xp });
    }
  }, [queens, size, conflicts]);

  useEffect(() => {
    setQueens(Array(size).fill(-1));
    setConflicts(new Set());
  }, [size]);

  const board = useMemo(() => Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ({ r, c }))), [size]);

  function toggleQueen(r: number, c: number) {
    setQueens((q) => {
      const next = q.slice();
      next[r] = next[r] === c ? -1 : c;
      setConflicts(calcConflicts(next));
      return next;
    });
  }

  function reset() {
    setQueens(Array(size).fill(-1));
    setConflicts(new Set());
    onScoreChange?.(0);
  }

  const remaining = size - queensPlaced(queens);

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Board" /></SelectTrigger>
          <SelectContent>
            {[4,6,8].map((s) => (<SelectItem key={s} value={String(s)}>{s}×{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">Remaining Queens: <span className="font-semibold">{remaining}</span></div>
        <Button variant="ghost" onClick={reset}>Reset</Button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 2.5rem))` }}>
        {board.flat().map(({ r, c }) => {
          const isDark = (r + c) % 2 === 1;
          const hasQueen = queens[r] === c;
          const bad = conflicts.has(`${r}-${c}`);
          return (
            <button
              key={`${r}-${c}`}
              onClick={() => toggleQueen(r, c)}
              className={["w-10 h-10 md:w-12 md:h-12 flex items-center justify-center", isDark ? "bg-muted" : "bg-background", "border border-border", hasQueen ? (bad ? "bg-red-500/20" : "bg-primary/20 animate-pulse") : ""].join(" ")}
            >
              {hasQueen ? "♛" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function queensPlaced(queens: number[]): number {
  return queens.filter((c) => c !== -1).length;
}

function calcConflicts(queens: number[]): Set<string> {
  const s = new Set<string>();
  for (let r1 = 0; r1 < queens.length; r1++) {
    const c1 = queens[r1];
    if (c1 === -1) continue;
    for (let r2 = r1 + 1; r2 < queens.length; r2++) {
      const c2 = queens[r2];
      if (c2 === -1) continue;
      if (c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2)) {
        s.add(`${r1}-${c1}`);
        s.add(`${r2}-${c2}`);
      }
    }
  }
  return s;
}
