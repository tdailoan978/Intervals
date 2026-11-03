// Reusable bits of UI: an element builder, bottom sheets, and the number,
// duration and colour inputs used by the builder and presets.

import { formatTime } from './util.js';

// el('button', { class: 'btn', onclick: fn }, 'Label') → <button class="btn">Label</button>
// Children are appended as text or nodes; `html` sets innerHTML (only used for our own icons).
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  node.append(...children.flat().filter((c) => c != null && c !== false));
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  return node;
}

const svg = (body, filled = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const ICONS = {
  more: svg('<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>', true),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  repeat: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
};

// ---------- Bottom sheets ----------

// Opens a sheet and resolves with whatever value `done` was called with
// (null if cancelled, tapped outside, or dismissed).
export function openSheet({ title, message, cancelLabel = 'Cancel' }, build) {
  return new Promise((resolve) => {
    // The title takes focus when the sheet opens so iOS doesn't pop up the keyboard.
    const body = el('div', { class: 'sheet-body' },
      el('h2', { tabIndex: -1, autofocus: true }, title),
      message && el('p', {}, message));
    const dialog = el('dialog', { class: 'sheet' }, body);
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    build(body, done);
    body.append(el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => done(null) }, cancelLabel));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) done(null); });
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });   // Escape key
    document.body.append(dialog);
    dialog.showModal();
  });
}

// actions: [{ label, value, style?: 'primary' | 'danger' }]
export function actionSheet({ title, message, actions }) {
  return openSheet({ title, message }, (body, done) => {
    for (const a of actions) {
      body.append(el('button', {
        type: 'button',
        class: `btn${a.style ? ` btn-${a.style}` : ''}`,
        onclick: () => done(a.value),
      }, a.label));
    }
  });
}

export async function confirmSheet({ title, message, confirm = 'OK', danger = false }) {
  const value = await actionSheet({ title, message, actions: [{ label: confirm, value: true, style: danger ? 'danger' : 'primary' }] });
  return value === true;
}

export const notice = (title, message) => openSheet({ title, message, cancelLabel: 'OK' }, () => {});

// ---------- Inputs ----------

// A time field that fills like a microwave: type 1 3 0 to get 1:30.
// Uses the iPhone number pad, which has no colon key.
export function durationInput(seconds, onChange, { label = 'Duration' } = {}) {
  let value = seconds;
  const input = el('input', {
    class: 'duration', type: 'text', inputMode: 'numeric', autocomplete: 'off',
    'aria-label': label, value: formatTime(value * 1000),
  });
  input.addEventListener('focus', () => setTimeout(() => input.setSelectionRange(0, input.value.length), 0));
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(-4).padStart(3, '0');
    const m = Number(digits.slice(0, -2));
    const s = Number(digits.slice(-2));
    input.value = `${m}:${digits.slice(-2)}`;
    value = m * 60 + s;
    onChange(value);
  });
  // Tidy up on leaving the field, e.g. 0:90 becomes 1:30.
  input.addEventListener('blur', () => { input.value = formatTime(value * 1000); });
  return input;
}

// A whole number with − and + buttons, e.g. rounds or sets.
export function stepper(start, { min = 1, max = 99, label = 'Count' } = {}, onChange) {
  let value = start;
  const input = el('input', {
    type: 'text', inputMode: 'numeric', autocomplete: 'off', 'aria-label': label, value: String(value),
  });
  const set = (n, typed = false) => {
    value = Math.min(max, Math.max(min, n));
    if (!typed) input.value = String(value);
    onChange(value);
  };
  input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
  input.addEventListener('input', () => {
    const n = parseInt(input.value.replace(/\D/g, ''), 10);
    if (!Number.isNaN(n)) set(n, true);
  });
  input.addEventListener('blur', () => { input.value = String(value); });
  return el('div', { class: 'stepper' },
    el('button', { type: 'button', 'aria-label': `Fewer ${label.toLowerCase()}`, onclick: () => set(value - 1) }, '−'),
    input,
    el('button', { type: 'button', 'aria-label': `More ${label.toLowerCase()}`, onclick: () => set(value + 1) }, '+'));
}

// A labelled row: "Rounds ........ [− 8 +]". A div rather than a <label> so
// tapping the text doesn't press the − button.
export const field = (label, control, props = {}) =>
  el('div', { class: 'field', ...props }, el('span', { class: 'field-label' }, label), control);

// A dropdown. options: [[value, label], ...]
export function select(value, options, onChange, { label } = {}) {
  return el('select', {
    class: 'select', 'aria-label': label,
    onchange: (e) => onChange(Number(e.target.value)),
  }, options.map(([v, text]) => el('option', { value: String(v), selected: v === value }, text)));
}

// An on/off switch.
export function toggle(checked, onChange, { label } = {}) {
  return el('label', { class: 'switch' },
    el('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }),
    el('span', { class: 'switch-track', 'aria-hidden': 'true' }));
}

export const PALETTE = [
  '#15803d', '#dc2626', '#facc15', '#2563eb', '#ea580c',
  '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#334155',
];

export function pickColor(current) {
  return openSheet({ title: 'Colour' }, (body, done) => {
    body.append(el('div', { class: 'swatches' }, PALETTE.map((c) => el('button', {
      type: 'button',
      class: c === current ? 'selected' : null,
      style: `--c: ${c}`,
      'aria-label': `Colour ${c}`,
      onclick: () => done(c),
    }))));
  });
}
