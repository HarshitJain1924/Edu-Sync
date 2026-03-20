const XP_KEY = "edusync_xp_total";

export type XPAward = {
  amount: number;
  reason?: string;
  gameId?: string;
  timestamp?: number;
};

export function getTotalXP(): number {
  try {
    const raw = localStorage.getItem(XP_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function addXP(amount: number): number {
  const current = getTotalXP();
  const next = Math.max(0, Math.floor(current + amount));
  try {
    localStorage.setItem(XP_KEY, String(next));
  } catch {}
  return next;
}

export function resetXP(): void {
  try {
    localStorage.setItem(XP_KEY, "0");
  } catch {}
}
