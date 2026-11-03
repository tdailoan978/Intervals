// Turns timer events into beeps and spoken words.

import * as audio from './audio.js';

// What to say when `step` starts. `prev` is the step before it, if any.
// e.g. "Round 3. Work", "Last round. Squats", "Set 2. Work", "Rest. Set 2 next"
export function phraseFor(step, prev) {
  if (step.setRest) return `Rest. Set ${step.set + 1} next`;
  const parts = [];
  const newRound = step.rounds && (prev?.round !== step.round || prev?.set !== step.set);
  if (newRound && step.sets > 1 && step.set > 1 && step.round === 1) parts.push(`Set ${step.set}`);
  else if (newRound && step.rounds > 1) parts.push(step.round === step.rounds ? 'Last round' : `Round ${step.round}`);
  parts.push(step.name);
  return parts.join('. ');
}

export function playCues(events, timeline, { sound = true, voice = true } = {}) {
  const words = [];
  for (const e of events) {
    if (e.type === 'count') {
      if (sound) audio.play('count');
    } else if (e.type === 'step') {
      if (sound) audio.play('go');
      words.push(phraseFor(e.step, timeline.steps[e.index - 1]));
    } else if (e.type === 'halfway') {
      words.push('Halfway');
    } else if (e.type === 'done') {
      if (sound) audio.play('done');
      words.push('Workout complete');
    }
  }
  if (voice && words.length) audio.say(words.join('. '));
}
