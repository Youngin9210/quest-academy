// Shapes of the data the app works with. TypeScript checks every use of these,
// so a typo like `player.pionts` is caught before the app runs.

export type ThemeId = 'space' | 'ocean' | 'pets' | 'bakery';

export interface Theme {
  name: string; icon: string; bgItems: string[];
  title: string; playerWord: string;
  meter: string; meterIcon: string; point: string; pointIcon: string;
  collection: string; collectVerb: string; finish: string;
  avatars: string[];
  missions: Record<string, { name: string; icon: string }>;
  story: Record<string, string | string[]>;
  cheers: string[]; oops: string[];
  collectibles: [emoji: string, name: string][];
}

// One saved fact or question: right/wrong counts and its spaced-practice box (0-5)
export interface Stat { r: number; w: number; box: number }

export interface Player {
  id: string; name: string; avatar: string; grade: number; theme: ThemeId;
  levels?: Record<string, number>;       // subject id -> grade, when different from `grade`
  points: number; streak: number; lastDay: string | null;
  found: Partial<Record<ThemeId, number>>; // collectibles found per world
  stats: Record<string, Stat>;
  missions: Record<string, { plays: number; history: number[] }>;
  subject?: string;
  updated?: number;
  typing?: Record<string, TypingRun[]>;
  typeHigh?: number;
  questLog?: string[];
  journal?: { date: string; ts?: number; prompt: string; text: string }[];
  // ...more fields (typing, journal, questLog, earned) are typed as we port those screens
  [more: string]: unknown;
}

// Everything saved in the browser under one key. The React app uses the SAME key
// and shape as the old app, so switching over keeps every kid's progress.
export interface SaveState {
  profiles: Player[];
  current: string | null;
  sound: boolean;
  grownPin?: { salt: string; hash: string };
  setupHidden?: boolean;
  setupSeen?: boolean;
  sync?: { token: string; family: string; admin: boolean; last: number; tombs: { id: string; updated: number }[]; ok: number };
  device?: string;
}

export interface TypingRun { wpm?: number; acc?: number; score?: number; zapped?: number; date: string; ts?: number }

// Question banks (subjects/*.js)
export interface BankQuestion {
  id: string; type: 'mc' | 'spell' | 'order'; grades?: number[]; emoji?: string;
  q?: string; choices?: string[]; answer?: number; hint?: string; explain?: string;   // mc
  word?: string; sentence?: string;                                                   // spell
  words?: string[];                                                                   // order
}
export interface Passage { id: string; title: string; emoji?: string; text: string; grades?: number[]; questions: BankQuestion[] }
export interface BankMission {
  id: string; name: string; icon: string; desc: string; grades?: number[];
  learn?: { emoji: string; text: string }[];
  questions?: BankQuestion[]; passages?: Passage[];
}
export interface Subject {
  name: string; icon: string; builtIn?: boolean;
  missions?: BankMission[];
  journalPrompts?: string[]; journalPrompts45?: string[];
}
