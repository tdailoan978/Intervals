// Timer engine. Elapsed time is always derived from timestamps, never counted
// tick by tick, so throttling, backgrounding or a locked phone can't make it
// drift: on return it simply recalculates.
//
// Date.now() is used rather than performance.now() because on iOS the
// monotonic clock can stop advancing while the device sleeps.

const CUE_GAP_MS = 1500; // a longer gap between updates means we were in the background

export class Engine {
  // countdown: how many seconds at the end of each step get a 'count' cue.
  constructor(timeline, saved = null, { now = () => Date.now(), countdown = 3 } = {}) {
    this.timeline = timeline;
    this.now = now;
    this.countdown = countdown;
    this.status = 'idle';   // idle | running | paused | done
    this.accum = 0;         // ms elapsed before the current running stretch
    this.since = 0;         // timestamp when the current running stretch began
    this.last = null;       // previous update, used to detect cue crossings
    if (saved) ({ status: this.status, accum: this.accum, since: this.since } = saved);
  }

  toJSON() {
    return { status: this.status, accum: this.accum, since: this.since };
  }

  elapsed(t = this.now()) {
    const e = this.status === 'running' ? this.accum + (t - this.since) : this.accum;
    return Math.min(Math.max(e, 0), this.timeline.total);
  }

  start() {
    if (this.status !== 'idle' && this.status !== 'paused') return;
    this.since = this.now();
    this.status = 'running';
  }

  pause() {
    if (this.status !== 'running') return;
    this.accum = this.elapsed();
    this.status = 'paused';
  }

  toggle() {
    this.status === 'running' ? this.pause() : this.start();
  }

  reset() {
    this.status = 'idle';
    this.accum = 0;
    this.last = null;
  }

  seek(ms) {
    if (this.status === 'done') return;
    this.accum = Math.min(Math.max(ms, 0), this.timeline.total);
    if (this.status === 'running') this.since = this.now();
  }

  // Jump to the start of the next step (or the end of the workout).
  skip() {
    const { index, step } = this.snapshot();
    if (!Number.isFinite(step.duration)) return;
    const next = this.timeline.steps[index + 1];
    this.seek(next ? next.start : this.timeline.total);
  }

  // Restart the current step, or go to the previous one if we're near its start.
  back() {
    const { index, step, stepElapsed } = this.snapshot();
    const prev = this.timeline.steps[index - 1];
    this.seek(stepElapsed > 3000 || !prev ? step.start : prev.start);
  }

  indexAt(elapsed) {
    const steps = this.timeline.steps;
    let i = steps.length - 1;
    while (i > 0 && steps[i].start > elapsed) i--;
    return i;
  }

  snapshot(t = this.now()) {
    const { steps, total, prep } = this.timeline;
    const elapsed = this.elapsed(t);
    const index = this.indexAt(elapsed);
    const step = steps[index];
    const stepElapsed = elapsed - step.start;
    return {
      status: this.status,
      elapsed,
      index,
      step,
      next: steps[index + 1] || null,
      stepElapsed,
      stepRemaining: step.duration - stepElapsed,
      totalRemaining: total - Math.max(elapsed, prep),
    };
  }

  // Call once per frame. Returns the current snapshot plus any cues crossed
  // since the previous call. Cues missed while in the background are dropped
  // rather than all played at once on return.
  update(t = this.now()) {
    if (this.status === 'running' && this.elapsed(t) >= this.timeline.total) {
      this.accum = this.timeline.total;
      this.status = 'done';
    }
    const snap = this.snapshot(t);
    const secLeft = Math.ceil(snap.stepRemaining / 1000);
    const prev = this.last;
    const events = [];

    if (prev && t - prev.at < CUE_GAP_MS) {
      if (snap.status === 'done' && prev.status !== 'done') {
        events.push({ type: 'done' });
      } else if (snap.index !== prev.index) {
        events.push({ type: 'step', step: snap.step, index: snap.index });
      } else if (secLeft < prev.secLeft && secLeft >= 1 && secLeft <= this.countdown) {
        events.push({ type: 'count', n: secLeft });
      }
      const half = this.timeline.halfway;
      if (half && snap.status !== 'done' && prev.elapsed < half && snap.elapsed >= half) {
        events.push({ type: 'halfway' });
      }
    }

    this.last = { at: t, index: snap.index, secLeft, elapsed: snap.elapsed, status: snap.status };
    return { snap, events };
  }
}
