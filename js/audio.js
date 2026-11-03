// Beeps generated with the Web Audio API (no sound files), and spoken cues
// with the Web Speech API.
//
// iOS only allows audio to start from a tap, so unlock() must be called from
// a tap handler (the run screen does this on every button press).
//
// The app uses iOS's default audio mode, so beeps mix with music you're
// playing from another app, but the silent switch mutes them.

let ctx = null;

export function unlock() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') ctx.resume();
    // iOS needs a sound to actually start playing inside the tap; this one is silent.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // No Web Audio: the timer still works, just silently.
  }
}

function tone(freq, duration, { delay = 0, volume = 0.6, type = 'triangle' } = {}) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Quick fade in and out so the beep doesn't click.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

const SOUNDS = {
  // Each of the last few seconds of a segment
  count: () => tone(880, 0.15),
  // A new segment starts: higher and longer
  go: () => tone(1320, 0.5, { volume: 0.7 }),
  // Workout finished: a rising three-note chime
  done: () => {
    tone(660, 0.2);
    tone(880, 0.2, { delay: 0.2 });
    tone(1320, 0.8, { delay: 0.4, volume: 0.7 });
  },
};

export function play(name) {
  if (!ctx) return;
  // iOS can suspend audio after a phone call or a trip to the background.
  if (ctx.state !== 'running') ctx.resume();
  SOUNDS[name]();
}

export function say(text) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  // Drop anything still being said so cues never lag behind the timer.
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-US';
  utterance.rate = 1.05;
  synth.speak(utterance);
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
