// Keeps the screen on during a workout with the Screen Wake Lock API.
// iOS drops the lock whenever the app goes to the background, so it is
// requested again each time the app becomes visible.

export const supported = 'wakeLock' in navigator;

let wanted = false;
let sentinel = null;
let pending = false;

async function request() {
  if (!supported || !wanted || sentinel || pending || document.visibilityState !== 'visible') return;
  pending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!wanted) { lock.release(); return; }   // turned off while we were waiting
    sentinel = lock;
    lock.addEventListener('release', () => { if (sentinel === lock) sentinel = null; });
  } catch {
    // Refused (e.g. Low Power Mode). The next tap or return to the app tries again.
  } finally {
    pending = false;
  }
}

export function keepAwake(on) {
  wanted = on;
  if (on) request();
  else if (sentinel) { sentinel.release(); sentinel = null; }
}

// Call from taps too: some browsers only grant the lock during a user action.
export const refresh = () => request();

document.addEventListener('visibilitychange', () => request());
