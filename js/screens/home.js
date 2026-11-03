// Home screen: quick presets at the top, your saved workouts below.

import * as presets from '../presets.js';
import { KINDS, buildTimeline } from '../timeline.js';
import { formatTime } from '../util.js';
import * as store from '../store.js';
import { el, ICONS, openSheet, actionSheet, confirmSheet, durationInput, stepper, field } from '../ui.js';

const fmt = (seconds) => formatTime(seconds * 1000);

const QUICK = [
  {
    key: 'tabata', name: 'Tabata', color: KINDS.work.color, make: presets.tabata,
    defaults: { work: 20, rest: 10, rounds: 8 },
    fields: [['work', 'Work', 'duration'], ['rest', 'Rest', 'duration'], ['rounds', 'Rounds', 'count']],
    describe: (o) => `${fmt(o.work)} / ${fmt(o.rest)} × ${o.rounds}`,
  },
  {
    key: 'emom', name: 'EMOM', color: '#0891b2', make: presets.emom,
    defaults: { rounds: 10, interval: 60 },
    fields: [['interval', 'Every', 'duration'], ['rounds', 'Rounds', 'count']],
    describe: (o) => `${o.rounds} × ${fmt(o.interval)}`,
  },
  {
    key: 'amrap', name: 'AMRAP', color: KINDS.warmup.color, make: presets.amrap,
    defaults: { duration: 720 },
    fields: [['duration', 'Time cap', 'duration']],
    describe: (o) => fmt(o.duration),
  },
  {
    key: 'countdown', name: 'Countdown', color: KINDS.other.color, make: presets.countdown,
    defaults: { duration: 300 },
    fields: [['duration', 'Time', 'duration']],
    describe: (o) => fmt(o.duration),
  },
  {
    key: 'stopwatch', name: 'Stopwatch', color: '#334155', make: presets.stopwatch,
    defaults: {}, fields: [],
    describe: () => 'Counts up',
  },
];

function summary(workout) {
  const tl = buildTimeline(workout, { getReady: 0 });
  if (!tl) return { meta: 'Empty', color: '#334155' };
  const n = tl.steps.length;
  const color = (tl.steps.find((s) => s.kind === 'work') || tl.steps[0]).color;
  return { meta: `${formatTime(tl.work)} · ${n} interval${n === 1 ? '' : 's'}`, color };
}

export class HomeScreen {
  constructor(root, { onStart, onEdit }) {
    this.root = root;
    this.onStart = onStart;
    this.onEdit = onEdit;
    this.reordering = false;
    this.presetGrid = root.querySelector('#preset-grid');
    this.listEl = root.querySelector('#workout-list');
    this.emptyEl = root.querySelector('#workout-empty');
    this.reorderBtn = root.querySelector('#reorder-toggle');
    this.reorderBtn.addEventListener('click', () => { this.reordering = !this.reordering; this.renderList(); });
    root.querySelector('#new-workout').addEventListener('click', () => this.onEdit(null));
  }

  render() {
    this.renderPresets();
    this.renderList();
  }

  presetOptions(q) {
    return { ...q.defaults, ...store.loadPresetOptions()[q.key] };
  }

  renderPresets() {
    this.presetGrid.replaceChildren(...QUICK.map((q) => el('button', {
      class: 'preset', style: `--card-color: ${q.color}`, onclick: () => this.openPreset(q),
    },
    el('span', { class: 'preset-name' }, q.name),
    el('span', { class: 'preset-desc' }, q.describe(this.presetOptions(q))))));
  }

  async openPreset(q) {
    if (!q.fields.length) return this.onStart(q.make());
    const opts = this.presetOptions(q);

    const choice = await openSheet({ title: q.name }, (body, done) => {
      const total = el('p', { class: 'sheet-total' });
      const update = () => {
        const tl = buildTimeline(q.make(opts), { getReady: 0 });
        total.textContent = tl ? `Total ${formatTime(tl.work)}` : 'Set a time above 0:00';
      };
      for (const [key, label, type] of q.fields) {
        const onChange = (v) => { opts[key] = v; update(); };
        body.append(field(label, type === 'duration'
          ? durationInput(opts[key], onChange, { label })
          : stepper(opts[key], { min: 1, max: 99, label }, onChange)));
      }
      body.append(total,
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => done('start') }, 'Start'),
        el('button', { type: 'button', class: 'btn', onclick: () => done('save') }, 'Save as my workout…'));
      update();
    });
    if (!choice) return;

    store.savePresetOptions({ ...store.loadPresetOptions(), [q.key]: opts });
    this.renderPresets();
    const workout = q.make(opts);
    if (!buildTimeline(workout, { getReady: 0 })) return;
    if (choice === 'start') this.onStart(workout);
    else this.onEdit(workout, { isNew: true });
  }

  renderList() {
    const list = store.loadWorkouts() || [];
    if (list.length < 2) this.reordering = false;
    this.reorderBtn.hidden = list.length < 2;
    this.reorderBtn.textContent = this.reordering ? 'Done' : 'Reorder';
    this.emptyEl.hidden = list.length > 0;
    this.listEl.classList.toggle('is-reordering', this.reordering);
    this.listEl.replaceChildren(...list.map((w, i) => this.card(w, i, list.length)));
  }

  card(w, i, count) {
    const { meta, color } = summary(w);
    const side = this.reordering
      ? [
        el('button', { class: 'icon-plain', 'aria-label': `Move ${w.name} up`, disabled: i === 0, html: ICONS.up,
          onclick: () => { store.moveWorkout(w.id, -1); this.renderList(); } }),
        el('button', { class: 'icon-plain', 'aria-label': `Move ${w.name} down`, disabled: i === count - 1, html: ICONS.down,
          onclick: () => { store.moveWorkout(w.id, 1); this.renderList(); } }),
      ]
      : el('button', { class: 'icon-plain', 'aria-label': `Options for ${w.name}`, html: ICONS.more, onclick: () => this.menu(w) });

    return el('div', { class: 'card wcard', style: `--card-color: ${color}` },
      el('button', { class: 'wcard-main', disabled: this.reordering, onclick: () => this.onStart(w) },
        el('span', { class: 'card-name' }, w.name),
        el('span', { class: 'card-meta' }, meta)),
      el('div', { class: 'wcard-side' }, side));
  }

  async menu(w) {
    const action = await actionSheet({
      title: w.name,
      actions: [
        { label: 'Start', value: 'start', style: 'primary' },
        { label: 'Edit', value: 'edit' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: 'Delete', value: 'delete', style: 'danger' },
      ],
    });
    if (action === 'start') this.onStart(w);
    else if (action === 'edit') this.onEdit(w);
    else if (action === 'duplicate') { store.duplicateWorkout(w.id); this.renderList(); }
    else if (action === 'delete') {
      const ok = await confirmSheet({ title: `Delete “${w.name}”?`, message: 'This can’t be undone.', confirm: 'Delete', danger: true });
      if (ok) { store.deleteWorkout(w.id); this.renderList(); }
    }
  }
}
