// The content files from the old app (themes, question banks) are plain scripts
// that put their data on `window`. Importing them runs them once; we then hand
// the data to the rest of the React app with proper types. Later we can turn
// them into real modules (`export const reading = {...}`) and drop `window`.
import '../../themes.js';
import '../../subjects/reading.js';
import '../../subjects/writing.js';
import '../../subjects/science.js';
import '../../subjects/social.js';
import '../../subjects/reading-45.js';
import '../../subjects/writing-45.js';
import '../../subjects/science-45.js';
import '../../subjects/social-45.js';
import '../../audio/spell-audio.js';
import type { Subject, Theme, ThemeId } from './types';

const w = window as unknown as {
  THEMES: Record<ThemeId, Theme>;
  SUBJECTS: Record<string, Subject>;
  SPELL_AUDIO: Record<string, true>;
};

export const THEMES = w.THEMES;
export const SUBJECTS = w.SUBJECTS;
// Math and typing are built into the app (generated questions), not question banks
SUBJECTS.math = { name: 'Math', icon: '🔢', builtIn: true };
SUBJECTS.typing = { name: 'Typing', icon: '⌨️', builtIn: true };
export const SPELL_AUDIO = w.SPELL_AUDIO;
export const themeOf = (id: string | undefined): Theme => THEMES[id as ThemeId] ?? THEMES.space;
