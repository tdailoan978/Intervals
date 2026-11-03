// Workout builder: name, a list of segments and repeat groups, rounds and sets.

import { KINDS, buildTimeline } from '../timeline.js';
import { segment, group, blankWorkout } from '../presets.js';
import { formatTime, withNewIds } from '../util.js';
import * as store from '../store.js';
import { el, ICONS, actionSheet, confirmSheet, durationInput, stepper, field, pickColor } from '../ui.js';

const EDITABLE_KINDS = ['work', 'rest', 'warmup', 'cooldown', 'other'];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export class EditorScreen {
  constructor(root, { onClose }) {
    this.root = root;
    this.onClose = onClose;
    const $ = (id) => root.querySelector(`#${id}`);
    this.titleEl = $('editor-title');
    this.nameInput = $('editor-name');
    this.totalEl = $('editor-total');
    this.blocksEl = $('editor-blocks');
    this.errorEl = $('editor-error');
    this.deleteBtn = $('editor-delete');

    $('editor-cancel').addEventListener('click', () => this.cancel());
    $('editor-save').addEventListener('click', () => this.save());
    $('editor-add-seg').addEventListener('click', () => this.addSegment(this.w.blocks));
    $('editor-add-group').addEventListener('click', () => this.addGroup());
    this.deleteBtn.addEventListener('click', () => this.remove());
    this.nameInput.addEventListener('input', () => { this.w.name = this.nameInput.value; });
  }

  // workout: null for a brand-new one. isNew: true when it isn't in the saved list yet.
  open(workout = null, { isNew = !workout } = {}) {
    this.isNew = isNew;
    this.w = workout ? structuredClone(workout) : blankWorkout();
    this.initial = JSON.stringify(this.w);
    this.titleEl.textContent = isNew ? 'New workout' : 'Edit workout';
    this.nameInput.value = this.w.name;
    this.deleteBtn.hidden = isNew;
    this.errorEl.hidden = true;
    this.render();
    this.root.hidden = false;
    window.scrollTo(0, 0);
  }

  close() {
    this.root.hidden = true;
    this.onClose();
  }

  async cancel() {
    if (JSON.stringify(this.w) !== this.initial) {
      const ok = await confirmSheet({ title: 'Discard changes?', confirm: 'Discard', danger: true });
      if (!ok) return;
    }
    this.close();
  }

  save() {
    this.w.name = this.nameInput.value.trim() || 'My workout';
    if (!buildTimeline(this.w, { getReady: 0 })) {
      this.errorEl.textContent = 'Add at least one segment with a time above 0:00.';
      this.errorEl.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    store.upsertWorkout(this.w);
    this.close();
  }

  async remove() {
    const ok = await confirmSheet({
      title: `Delete “${this.w.name || 'this workout'}”?`, message: 'This can’t be undone.', confirm: 'Delete', danger: true,
    });
    if (!ok) return;
    store.deleteWorkout(this.w.id);
    this.close();
  }

  // ---------- Rendering ----------

  render() {
    this.liveUpdates = [];
    this.blocksEl.replaceChildren(...this.w.blocks.map((b, i) =>
      b.type === 'group' ? this.groupCard(b, i) : this.segmentCard(b, this.w.blocks, i)));
    this.updateTotals();
  }

  // Refresh the total times without rebuilding inputs (keeps the keyboard open).
  updateTotals() {
    const tl = buildTimeline(this.w, { getReady: 0 });
    this.totalEl.textContent = tl
      ? `${formatTime(tl.work)} total  ·  ${plural(tl.steps.length, 'interval')}`
      : 'No intervals yet';
    if (tl) this.errorEl.hidden = true;
    this.liveUpdates.forEach((fn) => fn());
  }

  segmentCard(seg, list, i) {
    const card = el('div', { class: 'seg-card' });
    const paint = () => card.style.setProperty('--c', seg.color);
    paint();

    const swatch = el('button', {
      type: 'button', class: 'swatch', 'aria-label': 'Change colour',
      onclick: async () => {
        const c = await pickColor(seg.color);
        if (c) { seg.color = c; paint(); }
      },
    });
    const name = el('input', {
      type: 'text', class: 'seg-name', value: seg.name, placeholder: KINDS[seg.kind]?.label || 'Name',
      'aria-label': 'Segment name', enterKeyHint: 'done', autocomplete: 'off',
      oninput: (e) => { seg.name = e.target.value; },
    });
    const kind = el('select', {
      class: 'kind', 'aria-label': 'Segment type',
      onchange: (e) => this.changeKind(seg, e.target.value),
    }, EDITABLE_KINDS.map((k) => el('option', { value: k, selected: k === seg.kind }, KINDS[k].label)));
    const duration = durationInput(seg.duration, (v) => { seg.duration = v; this.updateTotals(); }, { label: 'Segment time' });
    const more = el('button', {
      type: 'button', class: 'icon-plain', 'aria-label': 'Segment options', html: ICONS.more,
      onclick: () => this.itemMenu(list, i, seg.name || 'Segment'),
    });

    card.append(
      el('div', { class: 'seg-row' }, swatch, name, more),
      el('div', { class: 'seg-row' }, kind, duration),
    );
    return card;
  }

  groupCard(g, i) {
    const summary = el('p', { class: 'group-summary' });
    const restField = field('Rest between sets',
      durationInput(g.restBetweenSets, (v) => { g.restBetweenSets = v; this.updateTotals(); }, { label: 'Rest between sets' }),
      { hidden: g.sets < 2 });

    this.liveUpdates.push(() => {
      const tl = buildTimeline({ blocks: [g] }, { getReady: 0 });
      summary.textContent = tl
        ? `${plural(g.rounds, 'round')} × ${plural(g.sets, 'set')} = ${formatTime(tl.work)}`
        : 'Add a segment to this group';
    });

    return el('div', { class: 'group-card' },
      el('div', { class: 'group-head' },
        el('span', { class: 'group-icon', html: ICONS.repeat }),
        el('input', {
          type: 'text', class: 'group-name', value: g.name, placeholder: 'Group name',
          'aria-label': 'Group name', enterKeyHint: 'done', autocomplete: 'off',
          oninput: (e) => { g.name = e.target.value; },
        }),
        el('button', {
          type: 'button', class: 'icon-plain', 'aria-label': 'Group options', html: ICONS.more,
          onclick: () => this.itemMenu(this.w.blocks, i, g.name || 'Group'),
        })),
      el('div', { class: 'group-settings' },
        field('Rounds', stepper(g.rounds, { min: 1, max: 99, label: 'Rounds' }, (v) => { g.rounds = v; this.updateTotals(); })),
        field('Sets', stepper(g.sets, { min: 1, max: 20, label: 'Sets' }, (v) => {
          g.sets = v;
          restField.hidden = v < 2;
          this.updateTotals();
        })),
        restField),
      summary,
      el('div', { class: 'group-segs' }, g.segments.map((s, j) => this.segmentCard(s, g.segments, j))),
      el('button', { type: 'button', class: 'btn btn-add', onclick: () => this.addSegment(g.segments) }, '+ Add segment to group'));
  }

  // ---------- Editing ----------

  changeKind(seg, kind) {
    const old = KINDS[seg.kind] || KINDS.other;
    // Follow the new type's colour and name unless you've customised them.
    if (seg.color === old.color) seg.color = KINDS[kind].color;
    if (!seg.name || seg.name === old.label) seg.name = KINDS[kind].label;
    seg.kind = kind;
    this.render();
  }

  addSegment(list) {
    const kind = list.at(-1)?.kind === 'work' ? 'rest' : 'work';
    list.push(segment(KINDS[kind].label, kind, kind === 'work' ? 30 : 15));
    this.render();
  }

  addGroup() {
    this.w.blocks.push(group('Circuit', [segment('Work', 'work', 30), segment('Rest', 'rest', 15)], { rounds: 3 }));
    this.render();
    this.blocksEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async itemMenu(list, i, label) {
    const actions = [];
    if (i > 0) actions.push({ label: 'Move up', value: 'up' });
    if (i < list.length - 1) actions.push({ label: 'Move down', value: 'down' });
    actions.push({ label: 'Duplicate', value: 'duplicate' }, { label: 'Delete', value: 'delete', style: 'danger' });

    const action = await actionSheet({ title: label, actions });
    if (action === 'up' || action === 'down') {
      const j = action === 'up' ? i - 1 : i + 1;
      [list[i], list[j]] = [list[j], list[i]];
    } else if (action === 'duplicate') {
      list.splice(i + 1, 0, withNewIds(list[i]));
    } else if (action === 'delete') {
      if (list[i].type === 'group') {
        const ok = await confirmSheet({ title: `Delete “${label}”?`, message: 'This removes the group and all its segments.', confirm: 'Delete', danger: true });
        if (!ok) return;
      }
      list.splice(i, 1);
    } else {
      return;
    }
    this.render();
  }
}
