// The run screen: big time display, segment info and controls.

import { Engine } from '../engine.js';
import { buildTimeline } from '../timeline.js';
import { formatTime, contrastText } from '../util.js';
import { saveActiveRun, clearActiveRun } from '../store.js';
import * as audio from '../audio.js';
import * as wakelock from '../wakelock.js';
import { playCues, phraseFor } from '../cues.js';

const DONE_COLOR = '#0b0d10';

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2"/></svg>',
};

// Only touch the DOM when a value actually changes; this runs every frame.
function setText(el, value) {
  if (el._v !== value) { el._v = value; el.textContent = value; }
}

function subtitle(step) {
  if (step.setRest) return `Set ${step.set} of ${step.sets} done`;
  const parts = [];
  if (step.rounds > 1) parts.push(`Round ${step.round} of ${step.rounds}`);
  if (step.sets > 1) parts.push(`Set ${step.set} of ${step.sets}`);
  return parts.join('  ·  ');
}

export class RunScreen {
  constructor(root, { onExit }) {
    this.root = root;
    this.onExit = onExit;
    const $ = (id) => root.querySelector(`#${id}`);
    this.el = {
      title: $('run-title'), paused: $('run-paused'),
      name: $('run-name'), sub: $('run-sub'),
      time: $('run-time'), tenths: $('run-tenths'), bar: $('run-bar'), progress: $('run-progress'),
      next: $('run-next'), total: $('run-total'), totalLabel: $('run-total-label'),
      play: $('run-play'), back: $('run-back'), skip: $('run-skip'),
      done: $('run-done'), doneSub: $('run-done-sub'),
    };
    this.dialog = document.getElementById('end-dialog');

    this.el.play.addEventListener('click', () => this.act(() => {
      const starting = this.engine.status === 'idle';
      this.engine.toggle();
      if (this.engine.status === 'paused') audio.stopSpeaking();
      // Speaking inside the tap also unlocks speech on iOS for the rest of the workout.
      if (starting && this.settings.voice) {
        const { step, index } = this.engine.snapshot();
        audio.say(phraseFor(step, this.timeline.steps[index - 1]));
      }
    }));
    this.el.skip.addEventListener('click', () => this.act(() => this.engine.skip()));
    this.el.back.addEventListener('click', () => this.act(() => this.engine.back()));
    $('run-end').addEventListener('click', () => this.requestEnd());
    $('run-restart').addEventListener('click', () => this.act(() => this.engine.reset()));
    $('run-close').addEventListener('click', () => this.close());

    this.dialog.addEventListener('click', (e) => {
      const choice = e.target.closest('button')?.value;
      if (!choice && e.target !== this.dialog) return;   // a tap inside the sheet but not on a button
      this.dialog.close();
      if (choice === 'end') this.close();
      else if (choice === 'restart') this.act(() => this.engine.reset());
    });

    this.loop = this.loop.bind(this);
  }

  // `saved` is an engine state from a previous session (see store.js).
  open(workout, settings, saved = null) {
    this.workout = workout;
    this.settings = settings;
    this.timeline = buildTimeline(workout, settings);
    if (!this.timeline) return false;
    this.engine = new Engine(this.timeline, saved, { countdown: settings.countdown });
    this.shown = {};
    setText(this.el.title, workout.name);
    this.root.hidden = false;
    this.persist();
    cancelAnimationFrame(this.raf);
    this.loop();
    return true;
  }

  close() {
    cancelAnimationFrame(this.raf);
    if (this.dialog.open) this.dialog.close();
    audio.stopSpeaking();
    wakelock.keepAwake(false);
    this.engine = null;
    clearActiveRun();
    this.root.hidden = true;
    this.onExit();
  }

  // Run a user action, then save and redraw immediately. Every action is a
  // tap, so it's also the moment iOS lets us (re)enable audio.
  act(fn) {
    audio.unlock();
    wakelock.refresh();
    fn();
    this.persist();
    this.render();
  }

  persist() {
    if (!this.engine) return;
    if (this.engine.status === 'done') clearActiveRun();
    else saveActiveRun({ workout: this.workout, settings: this.settings, engine: this.engine.toJSON() });
  }

  requestEnd() {
    const s = this.engine.status;
    const started = s === 'running' || s === 'paused' || (s === 'idle' && this.engine.accum > 0);
    if (!started) return this.close();
    this.dialog.showModal();
  }

  loop() {
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  render() {
    if (!this.engine) return;
    const { snap, events } = this.engine.update();
    const { step, status } = snap;
    const shown = this.shown;
    const el = this.el;

    if (events.length) {
      if (events.some((e) => e.type === 'step')) this.flash();
      if (events.some((e) => e.type === 'done')) this.persist();
      playCues(events, this.timeline, this.settings);
    }

    // Colours and labels change only when the step or status changes.
    const colorKey = status === 'done' ? 'done' : snap.index;
    if (shown.colorKey !== colorKey) {
      shown.colorKey = colorKey;
      const bg = status === 'done' ? DONE_COLOR : step.color;
      const fg = contrastText(bg);
      this.root.style.setProperty('--seg', bg);
      this.root.style.setProperty('--fg', fg);
      this.root.style.setProperty('--fg-soft', fg === '#ffffff' ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.14)');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
      setText(el.name, step.name);
      setText(el.sub, subtitle(step));
      el.skip.disabled = !!step.countUp;
      el.progress.hidden = !!step.countUp;
      el.tenths.hidden = !step.countUp;
      setText(el.totalLabel, step.countUp ? 'Elapsed' : 'Total left');
    }

    if (shown.status !== status) {
      shown.status = status;
      // Screen stays on while the workout is open (running or paused), not after it's done.
      wakelock.keepAwake(this.settings.keepAwake && status !== 'done');
      el.play.innerHTML = status === 'running' ? ICONS.pause : ICONS.play;
      el.play.setAttribute('aria-label', status === 'running' ? 'Pause' : 'Start');
      el.paused.hidden = status !== 'paused';
      this.root.classList.toggle('is-paused', status === 'paused');
      el.done.hidden = status !== 'done';
      if (status === 'done') {
        setText(el.doneSub, `${this.workout.name}  ·  ${formatTime(this.timeline.work)}`);
      }
    }

    // Time and progress change every frame.
    const text = step.countUp ? formatTime(snap.stepElapsed, { up: true }) : formatTime(snap.stepRemaining);
    setText(el.time, text);
    el.time.dataset.len = Math.min(text.length, 7);   // CSS sizes the digits to fit
    if (step.countUp) {
      setText(el.tenths, `.${Math.floor(snap.stepElapsed / 100) % 10}`);
    } else {
      const p = Math.min(1, snap.stepElapsed / step.duration);
      el.bar.style.transform = `scaleX(${p})`;
    }

    setText(el.next, snap.next ? `${snap.next.name}  ${snap.next.countUp ? '' : formatTime(snap.next.duration)}`.trim() : 'Finish');
    setText(el.total, step.countUp ? formatTime(snap.stepElapsed, { up: true }) : formatTime(snap.totalRemaining));
  }

  flash() {
    this.root.classList.remove('flash');
    void this.root.offsetWidth; // restart the CSS animation
    this.root.classList.add('flash');
  }
}
