export type Grid = number[][]; // 9x9 grid, 0 means empty

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function isSafe(grid: Grid, row: number, col: number, num: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === num || grid[i][col] === num) return false;
  }
  const sr = Math.floor(row / 3) * 3;
  const sc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[sr + r][sc + c] === num) return false;
    }
  }
  return true;
}

function findEmpty(grid: Grid): [number, number] | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

export function solve(grid: Grid): boolean {
  const spot = findEmpty(grid);
  if (!spot) return true;
  const [r, c] = spot;
  for (const n of shuffle([1,2,3,4,5,6,7,8,9])) {
    if (isSafe(grid, r, c, n)) {
      grid[r][c] = n;
      if (solve(grid)) return true;
      grid[r][c] = 0;
    }
  }
  return false;
}

export function generateSolved(): Grid {
  const g = emptyGrid();
  solve(g);
  return g;
}

export type Difficulty = "easy" | "medium" | "hard";

export function makePuzzle(solved: Grid, difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const puzzle = solved.map((row) => row.slice());
  const solution = solved.map((row) => row.slice());

  // Number of cells to remove based on difficulty
  const removeCounts: Record<Difficulty, number> = { easy: 40, medium: 50, hard: 58 };
  let toRemove = removeCounts[difficulty];

  const positions: Array<[number, number]> = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) positions.push([r, c]);
  for (const [r, c] of shuffle(positions)) {
    if (toRemove <= 0) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    toRemove--;
  }
  return { puzzle, solution };
}

export function isValidMove(grid: Grid, row: number, col: number, value: number): boolean {
  if (value < 1 || value > 9) return false;
  return isSafe(grid, row, col, value);
}
