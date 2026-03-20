import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Difficulty, Grid, generateSolved, isValidMove, makePuzzle } from "./sudoku/generate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  difficulty?: Difficulty;
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
};

export default function SudokuBoard({ difficulty = "medium", paused, onFinish, onScoreChange }: Props) {
  const [currentDiff, setCurrentDiff] = useState<Difficulty>(difficulty);
  const [solution, setSolution] = useState<Grid>(() => generateSolved());
  const initial = useMemo(() => makePuzzle(solution.map(r => r.slice()), currentDiff), [solution, currentDiff]);
  const [puzzle, setPuzzle] = useState<Grid>(initial.puzzle);
  const [fixed, setFixed] = useState<boolean[][]>(() => initial.puzzle.map(row => row.map((v) => v !== 0)));
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  useEffect(() => {
    const filled = countFilled(puzzle);
    const sc = filled * 2 - mistakes; // simple score heuristic
    onScoreChange?.(Math.max(0, sc));
    if (isSolved(puzzle, initial.solution)) {
      const xp = Math.max(20, Math.floor(100 - mistakes * 3));
      onFinish({ score: Math.max(0, sc), xp });
    }
  }, [puzzle, mistakes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (paused) return;
      if (!selected) return;
      const digit = Number(e.key);
      const { r, c } = selected;
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        if (!fixed[r][c]) updateCell(r, c, 0);
        return;
      }
      if (!Number.isNaN(digit) && digit >= 1 && digit <= 9) {
        if (fixed[r][c]) return;
        placeNumber(r, c, digit);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, paused, fixed]);

  function updateCell(r: number, c: number, value: number) {
    setPuzzle((g) => {
      const next = g.map((row) => row.slice());
      next[r][c] = value;
      return next;
    });
  }

  function placeNumber(r: number, c: number, value: number) {
    const valid = isValidMove(withZeros(puzzle, r, c), r, c, value);
    const key = `${r}-${c}`;
    if (!valid) {
      setInvalid((s) => new Set(s).add(key));
      setMistakes((m) => m + 1);
    } else {
      setInvalid((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
      updateCell(r, c, value);
    }
  }

  function handleCheck() {
    let wrong = 0;
    const newInvalid = new Set<string>();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0 && puzzle[r][c] !== initial.solution[r][c]) {
          wrong++;
          newInvalid.add(`${r}-${c}`);
        }
      }
    }
    setInvalid(newInvalid);
    if (wrong > 0) setMistakes((m) => m + wrong);
  }

  function handleHint() {
    // find an empty cell
    const empties: Array<[number, number]> = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] === 0 && !fixed[r][c]) empties.push([r, c]);
    if (empties.length === 0) return;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    updateCell(r, c, initial.solution[r][c]);
  }

  function handleRestart() {
    setPuzzle(initial.puzzle.map((row) => row.slice()));
    setFixed(initial.puzzle.map((row) => row.map((v) => v !== 0)));
    setSelected(null);
    setMistakes(0);
    setInvalid(new Set());
    onScoreChange?.(0);
  }

  function changeDifficulty(diff: Difficulty) {
    setCurrentDiff(diff);
    setSolution(generateSolved());
    setPuzzle(initial.puzzle.map((row) => row.slice()));
    setFixed(initial.puzzle.map((row) => row.map((v) => v !== 0)));
    setSelected(null);
    setMistakes(0);
    setInvalid(new Set());
    onScoreChange?.(0);
  }

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Select value={currentDiff} onValueChange={(v) => changeDifficulty(v as Difficulty)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="capitalize">{currentDiff}</Badge>
        <Badge variant="outline">Mistakes: {mistakes}</Badge>
      </div>
      <div className="grid grid-cols-9 gap-[2px] bg-border p-[2px] rounded-md shadow-soft select-none">
        {puzzle.map((row, r) => (
          row.map((val, c) => {
            const isSel = selected?.r === r && selected?.c === c;
            const isFixed = fixed[r][c];
            const isInvalid = invalid.has(`${r}-${c}`);
            const thickRight = (c + 1) % 3 === 0 && c !== 8;
            const thickBottom = (r + 1) % 3 === 0 && r !== 8;
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => setSelected({ r, c })}
                className={[
                  "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-background",
                  "cursor-pointer",
                  isSel ? "bg-primary/10" : "",
                  isFixed ? "font-bold" : "",
                  isInvalid ? "ring-2 ring-red-500" : "",
                  thickRight ? "border-r-2 border-border" : "",
                  thickBottom ? "border-b-2 border-border" : "",
                ].join(" ")}
              >
                <span className={isFixed ? "text-foreground" : "text-muted-foreground"}>{val || ""}</span>
              </div>
            );
          })
        ))}
      </div>

      <div className="flex items-center gap-2">
        {[1,2,3,4,5,6,7,8,9].map((n) => (
          <Button key={n} variant="secondary" size="icon" onClick={() => selected && !fixed[selected.r][selected.c] && placeNumber(selected.r, selected.c, n)}>
            {n}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleCheck} variant="outline">Check</Button>
        <Button onClick={handleHint} variant="outline">Hint</Button>
        <Button onClick={handleRestart} variant="ghost">Restart</Button>
      </div>
    </div>
  );
}

function withZeros(grid: Grid, r: number, c: number): Grid {
  const next = grid.map((row) => row.slice());
  next[r][c] = 0;
  return next;
}

function isSolved(grid: Grid, solution: Grid): boolean {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] !== solution[r][c]) return false;
  return true;
}

function countFilled(grid: Grid): number {
  let count = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (grid[r][c] !== 0) count++;
  return count;
}
