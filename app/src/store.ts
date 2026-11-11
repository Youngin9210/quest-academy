// The saved state, shared by every component.
//
// React re-draws a component when data it uses CHANGES IDENTITY (a new object),
// not when something inside an object is mutated. So `updateState` copies the
// state, lets you change the copy, saves it, and tells React about the new object.
import { useSyncExternalStore } from 'react';
import type { SaveState } from './types';

const KEY = 'mathquest.v1';

function load(): SaveState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && Array.isArray(s.profiles)) return s;
  } catch { /* storage blocked or corrupt */ }
  return { profiles: [], current: null, sound: true };
}

let state: SaveState = load();
const listeners = new Set<() => void>();

export function getState(): SaveState { return state; }

export function updateState(change: (draft: SaveState) => void): void {
  const draft = structuredClone(state);
  change(draft);
  state = draft;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

// A hook: call it inside a component to read the state. The component re-draws
// whenever updateState() runs.
export function useSave(): SaveState {
  return useSyncExternalStore(subscribe, getState);
}

export const currentPlayer = (s: SaveState) => s.profiles.find(p => p.id === s.current) ?? null;
