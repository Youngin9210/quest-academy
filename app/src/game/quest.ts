// Daily Quest bookkeeping (the quest questions themselves come in lesson 3)
import type { Player } from '../types';
import { today } from './dates';

export const QUEST_LEN = 10, QUEST_BONUS = 10;
export const questDoneToday = (p: Player) => (p.questLog ?? []).includes(today());
export function questStreak(p: Player): number {
  const log = new Set(p.questLog ?? []);
  let n = 0;
  const d = new Date();
  if (!log.has(today())) d.setDate(d.getDate() - 1);   // today isn't over yet
  while (log.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
