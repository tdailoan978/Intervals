// Turns a workout (segments, groups with rounds and sets) into a flat list of
// steps with absolute start times, which is all the engine needs.

export const KINDS = {
  prep:     { label: 'Get ready', color: '#334155' },
  warmup:   { label: 'Warm-up',   color: '#ea580c' },
  work:     { label: 'Work',      color: '#15803d' },
  rest:     { label: 'Rest',      color: '#dc2626' },
  cooldown: { label: 'Cool-down', color: '#2563eb' },
  other:    { label: 'Other',     color: '#7c3aed' },
};

// The longer rest between sets gets its own colour so it stands out from a normal rest.
export const SET_REST_COLOR = '#facc15';

export function buildTimeline(workout, { getReady = 10 } = {}) {
  const steps = [];
  let t = 0;

  const push = (seg, extra = {}) => {
    const duration = seg.duration * 1000;
    if (!(duration > 0)) return;
    const kind = KINDS[seg.kind] ? seg.kind : 'other';
    steps.push({
      name: seg.name || KINDS[kind].label,
      kind,
      color: seg.color || KINDS[kind].color,
      duration,
      start: t,
      round: null, rounds: null, set: null, sets: null,
      ...extra,
    });
    t += duration;
  };

  if (getReady > 0) push({ name: 'Get ready', kind: 'prep', duration: getReady });
  const prep = t;

  if (workout.mode === 'stopwatch') {
    push({ name: workout.name || 'Stopwatch', kind: 'work', color: '#0f172a', duration: Infinity }, { countUp: true });
  } else {
    for (const block of workout.blocks || []) {
      if (block.type !== 'group') { push(block); continue; }
      const rounds = Math.max(1, block.rounds | 0);
      const sets = Math.max(1, block.sets | 0);
      for (let s = 1; s <= sets; s++) {
        for (let r = 1; r <= rounds; r++) {
          for (const seg of block.segments || []) push(seg, { round: r, rounds, set: s, sets });
        }
        if (s < sets && block.restBetweenSets > 0) {
          push({ name: 'Set rest', kind: 'rest', color: SET_REST_COLOR, duration: block.restBetweenSets }, { set: s, sets, setRest: true });
        }
      }
    }
  }

  const work = t - prep;
  if (!(work > 0)) return null;                    // nothing to run
  return {
    steps,
    total: t,
    prep,                                          // ms of get-ready before the workout proper
    work,                                          // ms of actual workout
    halfway: Number.isFinite(work) && work >= 60000 ? prep + work / 2 : null,
  };
}
