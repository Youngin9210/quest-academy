// Which missions exist, per subject and grade. Plain TypeScript: no React here,
// so the same code serves the home screen now and the play screens later.
import { SPELL_AUDIO, SUBJECTS } from '../content';
import type { BankMission, BankQuestion, Player } from '../types';

export const GRADES = [2, 3, 4, 5] as const;
export const gradeName = (g: number) => ({ 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' } as Record<number, string>)[g] ?? `${g}th`;
export const SUBJECT_ORDER = ['math', 'reading', 'writing', 'science', 'social', 'typing'].filter(id => SUBJECTS[id]);

// A player's grade for one subject (grown-ups can set e.g. 4th grade math for a 3rd grader)
export const levelOf = (p: Player, subject: string): number => p.levels?.[subject] ?? p.grade;

export interface MathMission { id: string; grade: number; desc: string }
export const MISSIONS: MathMission[] = [
  { id: 'addsub', grade: 2, desc: 'Add & subtract up to 20' },
  { id: 'place', grade: 2, desc: 'Hundreds, tens & ones' },
  { id: 'twodigit', grade: 2, desc: 'Add & subtract up to 100' },
  { id: 'muldiv', grade: 3, desc: 'Times & divide facts' },
  { id: 'story', grade: 2, desc: 'Word problems' },
  { id: 'choice', grade: 2, desc: 'Tap the right answer' },
];
export const MISSIONS45: MathMission[] = [
  { id: 'muldiv', grade: 4, desc: 'Times & divide facts review' },
  { id: 'multi', grade: 4, desc: 'Multi-digit multiplication' },
  { id: 'longdiv', grade: 4, desc: 'Long division' },
  { id: 'fractions', grade: 4, desc: 'Fractions' },
  { id: 'decimals', grade: 4, desc: 'Decimals' },
  { id: 'measure', grade: 4, desc: 'Area, perimeter & volume' },
  { id: 'story', grade: 4, desc: 'Word problems' },
];

export interface TypingLesson { id: string; icon: string; name: string; desc: string; game?: boolean }
export const TYPING_LESSONS: TypingLesson[] = [
  { id: 'type-home', icon: '🏠', name: 'Home Row', desc: 'A S D F G H J K L' },
  { id: 'type-top', icon: '⬆️', name: 'Top Row', desc: 'Q W E R T Y U I O P' },
  { id: 'type-bottom', icon: '⬇️', name: 'Bottom Row', desc: 'Z X C V B N M' },
  { id: 'type-sentences', icon: '✍️', name: 'Sentences', desc: 'Capitals with Shift, . ? !' },
  { id: 'type-game', icon: '🎮', name: 'Word Blaster', desc: 'Zap the words before they land!', game: true },
];
export const BLASTER: Record<string, { thing: string; name: string; boom: string }> = {
  space: { thing: '☄️', name: 'Asteroid Blaster', boom: '💥' }, ocean: { thing: '🫧', name: 'Bubble Pop', boom: '✨' },
  pets: { thing: '🦴', name: 'Treat Catch', boom: '💖' }, bakery: { thing: '🧁', name: 'Sprinkle Storm', boom: '🍬' },
};

// Question-bank missions, indexed by id
export const BANK: Record<string, { subject: string; mission: BankMission }> = {};
SUBJECT_ORDER.filter(sid => !SUBJECTS[sid].builtIn).forEach(sid =>
  (SUBJECTS[sid].missions ?? []).forEach(m => { BANK[m.id] = { subject: sid, mission: m }; }));

// Spelling words only count when we have a real person's recording of them
export const usableQuestion = (q: BankQuestion) => q.type !== 'spell' || (!!q.word && !!SPELL_AUDIO[q.word]);
export const forGrade = (item: { grades?: number[] }, grade: number) => !item.grades || item.grades.includes(grade);

// The question ids a bank mission uses at a grade (falls back to all of them if too few match)
export function bankQuestionIds(m: BankMission, grade: number): string[] {
  if (m.passages) {
    const ps = m.passages.filter(x => forGrade(x, grade));
    return (ps.length ? ps : m.passages).flatMap(ps => ps.questions.map(q => q.id));
  }
  const usable = (m.questions ?? []).filter(usableQuestion);
  const qs = usable.filter(q => forGrade(q, grade));
  return (qs.length >= 5 ? qs : usable).map(q => q.id);
}

// What the home screen shows for one subject at a grade
export interface MissionCardInfo { id: string; icon: string; name: string; desc: string }
export function missionsFor(p: Player, subject: string, themeMissions: Record<string, { name: string; icon: string }>): MissionCardInfo[] {
  const lvl = levelOf(p, subject);
  if (subject === 'math') return (lvl >= 4 ? MISSIONS45 : MISSIONS).map(m => ({ id: m.id, desc: m.desc, ...themeMissions[m.id] }));
  if (subject === 'typing') return TYPING_LESSONS.map(m => ({ id: m.id, icon: m.icon, desc: m.desc, name: m.game ? (BLASTER[p.theme] ?? BLASTER.space).name : m.name }));
  return (SUBJECTS[subject].missions ?? [])
    .filter(m => forGrade(m, lvl) && (!m.questions || m.questions.some(usableQuestion)))
    .map(m => ({ id: m.id, icon: m.icon, name: m.name, desc: m.desc }));
}
