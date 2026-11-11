// How far a player is in each mission (0..1). Ported from the old app unchanged,
// so both versions show the same numbers for the same saved data.
import type { Player, TypingRun } from '../types';
import { BANK, bankQuestionIds, levelOf } from './missions';

// Every math fact has a key, so we can track which ones are tricky
export const POOLS: Record<string, string[]> = {
  addsub: (() => {
    const k: string[] = [];
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) k.push(`${a}+${b}`);
    for (let c = 0; c <= 20; c++) for (let b = 0; b <= 10; b++) if (b <= c && c - b <= 10) k.push(`${c}-${b}`);
    return k;
  })(),
  muldiv: (() => {
    const k: string[] = [];
    for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) { k.push(`${a}×${b}`); k.push(`${a * b}÷${a}`); }
    return k;
  })(),
};

const MISSION_LEN = 10;
const typeTarget = (p: Player) => ({ 2: 8, 3: 12, 4: 15, 5: 20 } as Record<number, number>)[levelOf(p, 'typing')] ?? 12; // WPM goal

export function typingProgress(p: Player, id: string): number {
  const runs = (p.typing?.[id] ?? []).slice(-3);
  if (!runs.length) return 0;
  if (id === 'type-game') return Math.min(1, Math.max(...runs.map(r => r.score ?? 0)) / 1500);
  return runs.reduce((a, r) => a + ((r.acc ?? 0) / 100) * Math.min(1, (r.wpm ?? 0) / typeTarget(p)), 0) / 3;
}
export const bestLessonRun = (p: Player, id: string): TypingRun | null =>
  (p.typing?.[id] ?? []).filter(r => (r.acc ?? 0) >= 90).sort((a, b) => (b.wpm ?? 0) - (a.wpm ?? 0))[0] ?? null;

// Mastered = answered right on the first try twice in a row
export function bankProgress(p: Player, mid: string): number {
  const ids = bankQuestionIds(BANK[mid].mission, levelOf(p, BANK[mid].subject));
  return ids.reduce((a, id) => a + Math.min(2, p.stats['q:' + id]?.box ?? 0), 0) / (2 * ids.length);
}

export function mastery(p: Player, missionId: string): number {
  if (BANK[missionId]) return bankProgress(p, missionId);
  if (missionId.startsWith('type-')) return typingProgress(p, missionId);
  const pool = POOLS[missionId];
  if (pool) return pool.filter(k => (p.stats[k]?.box ?? 0) >= 3).length / pool.length;
  const h = p.missions[missionId]?.history ?? [];
  if (!h.length) return 0;
  return Math.min(1, h.slice(-5).reduce((a, b) => a + b, 0) / (5 * MISSION_LEN));
}

// Kid-facing progress: partial credit, so every right answer moves the bar
export function progress(p: Player, missionId: string): number {
  const pool = POOLS[missionId];
  if (!pool) return mastery(p, missionId);
  return pool.reduce((a, k) => a + Math.min(3, p.stats[k]?.box ?? 0), 0) / (3 * pool.length);
}
export const learnedCount = (p: Player, missionId: string) => POOLS[missionId].filter(k => (p.stats[k]?.r ?? 0) > 0).length;
export const showPct = (x: number) => (x > 0 && x < 0.01 ? 1 : Math.round(x * 100));
