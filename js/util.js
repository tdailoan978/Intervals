// Small helpers shared across the app.

export const uid = () => Math.random().toString(36).slice(2, 10);

// Deep copy of a workout, group or segment with fresh ids throughout.
export function withNewIds(item) {
  const copy = structuredClone(item);
  const walk = (node) => {
    node.id = uid();
    (node.blocks || node.segments || []).forEach(walk);
  };
  walk(copy);
  return copy;
}

const pad = (n) => String(n).padStart(2, '0');

// Countdowns round up (so a 20s segment shows 0:20 at the start and 0:01 at
// the end); count-up clocks round down.
export function formatTime(ms, { up = false } = {}) {
  if (!Number.isFinite(ms)) return '–';
  const total = Math.max(0, up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Pick black or white text, whichever contrasts more with the background.
export function contrastText(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? '#ffffff' : '#000000';
}
