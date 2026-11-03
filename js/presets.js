// Built-in quick workouts. Each function returns an ordinary workout object,
// the same shape as the ones you build and save yourself.

import { KINDS } from './timeline.js';
import { uid, formatTime } from './util.js';

export const segment = (name, kind, duration, color = KINDS[kind].color) =>
  ({ type: 'segment', id: uid(), name, kind, duration, color });

export const group = (name, segments, { rounds = 1, sets = 1, restBetweenSets = 0 } = {}) =>
  ({ type: 'group', id: uid(), name, rounds, sets, restBetweenSets, segments });

const workout = (name, blocks, extra = {}) =>
  ({ id: uid(), name, mode: 'intervals', blocks, ...extra });

export function tabata({ work = 20, rest = 10, rounds = 8 } = {}) {
  return workout('Tabata', [
    group('Tabata', [segment('Work', 'work', work), segment('Rest', 'rest', rest)], { rounds }),
  ]);
}

export function emom({ rounds = 10, interval = 60 } = {}) {
  const name = interval === 60 ? `EMOM ${rounds} min` : `Every ${formatTime(interval * 1000)} × ${rounds}`;
  return workout(name, [group('EMOM', [segment('Work', 'work', interval)], { rounds })]);
}

export function amrap({ duration = 720 } = {}) {
  return workout(`AMRAP ${formatTime(duration * 1000)}`, [segment('AMRAP', 'work', duration)]);
}

export function countdown({ duration = 300 } = {}) {
  return workout('Countdown', [segment('Countdown', 'other', duration)]);
}

export function stopwatch() {
  return workout('Stopwatch', [], { mode: 'stopwatch' });
}

// What "New workout" starts from.
export function blankWorkout() {
  return workout('', [
    segment('Warm-up', 'warmup', 180),
    group('Circuit', [segment('Work', 'work', 30), segment('Rest', 'rest', 15)], { rounds: 3 }),
    segment('Cool-down', 'cooldown', 120),
  ]);
}

// Saved on first launch so the list isn't empty. Delete them whenever you like.
export function examples() {
  return [
    workout('Full body circuit', [
      segment('Warm-up', 'warmup', 180),
      group('Circuit', [
        segment('Squats', 'work', 40),
        segment('Rest', 'rest', 20),
        segment('Push-ups', 'work', 40),
        segment('Rest', 'rest', 20),
      ], { rounds: 4, sets: 3, restBetweenSets: 90 }),
      segment('Cool-down', 'cooldown', 180),
    ]),
    // A short workout that exercises every feature. Handy for testing.
    workout('Quick test (2 min)', [
      segment('Warm-up', 'warmup', 10),
      group('Circuit', [
        segment('Squats', 'work', 8),
        segment('Rest', 'rest', 4),
      ], { rounds: 3, sets: 2, restBetweenSets: 8 }),
      segment('Cool-down', 'cooldown', 10),
    ]),
  ];
}
