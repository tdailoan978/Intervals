// Everything the app saves lives in localStorage under these keys.

import { withNewIds } from './util.js';

const KEYS = {
  workouts: 'it.workouts',
  settings: 'it.settings',
  presetOptions: 'it.presetOptions',
  activeRun: 'it.activeRun',
};

export const DEFAULT_SETTINGS = {
  getReady: 10,     // seconds of "Get ready" before the workout
  countdown: 5,     // beep on each of the last N seconds of a segment (0 = off)
  sound: true,
  voice: true,
  keepAwake: true,
};

export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const saveSettings = (settings) => write(KEYS.settings, settings);

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app still works, it just won't remember.
  }
}

// ---------- Saved workouts (an array, in the order shown on the home screen) ----------

// Returns null if workouts have never been saved on this device (used for first-run examples).
export const loadWorkouts = () => read(KEYS.workouts, null);
export const saveWorkouts = (list) => write(KEYS.workouts, list);

const list = () => loadWorkouts() || [];

export function upsertWorkout(workout) {
  const all = list();
  const saved = { ...workout, updatedAt: Date.now() };
  const i = all.findIndex((w) => w.id === workout.id);
  if (i >= 0) all[i] = saved; else all.push(saved);
  saveWorkouts(all);
}

export function deleteWorkout(id) {
  saveWorkouts(list().filter((w) => w.id !== id));
}

export function duplicateWorkout(id) {
  const all = list();
  const i = all.findIndex((w) => w.id === id);
  if (i < 0) return;
  const copy = { ...withNewIds(all[i]), name: `${all[i].name} copy`, updatedAt: Date.now() };
  all.splice(i + 1, 0, copy);
  saveWorkouts(all);
}

export function moveWorkout(id, delta) {
  const all = list();
  const i = all.findIndex((w) => w.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  saveWorkouts(all);
}

// ---------- Backup file ----------

export function makeBackup() {
  return {
    app: 'intervals',
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: list(),
    settings: loadSettings(),
  };
}

// Returns the workouts in a backup file's text, or throws if it isn't one.
export function parseBackup(text) {
  const data = JSON.parse(text);
  const workouts = Array.isArray(data) ? data : data?.workouts;
  const valid = Array.isArray(workouts) &&
    workouts.every((w) => w && typeof w.name === 'string' && Array.isArray(w.blocks));
  if (!valid) throw new Error('Not an Intervals backup');
  return { workouts, settings: data.settings || null };
}

// mode 'add' keeps your current workouts; 'replace' swaps them (and settings) for the backup's.
export function restoreBackup({ workouts, settings }, mode) {
  if (mode === 'replace') {
    saveWorkouts(workouts);
    if (settings) saveSettings({ ...DEFAULT_SETTINGS, ...settings });
    return;
  }
  const all = list();
  const ids = new Set(all.map((w) => w.id));
  for (const w of workouts) all.push(ids.has(w.id) ? withNewIds(w) : w);
  saveWorkouts(all);
}

// ---------- Last-used quick preset options, e.g. { tabata: { work: 20, rest: 10, rounds: 8 } } ----------

export const loadPresetOptions = () => read(KEYS.presetOptions, {});
export const savePresetOptions = (options) => write(KEYS.presetOptions, options);

// ---------- The workout currently on the run screen ----------
// Saved so it can be restored if iOS closes the app while it's in the background.

export const loadActiveRun = () => read(KEYS.activeRun);
export const saveActiveRun = (run) => write(KEYS.activeRun, run);
export const clearActiveRun = () => {
  try { localStorage.removeItem(KEYS.activeRun); } catch {}
};
