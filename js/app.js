// App entry point: wires the screens together.

import * as presets from './presets.js';
import * as store from './store.js';
import { HomeScreen } from './screens/home.js';
import { EditorScreen } from './screens/editor.js';
import { RunScreen } from './screens/run.js';
import { SettingsScreen } from './screens/settings.js';

// One shared settings object; the Settings screen updates it in place.
const settings = store.loadSettings();

const screens = {
  home: document.getElementById('screen-home'),
  editor: document.getElementById('screen-editor'),
  settings: document.getElementById('screen-settings'),
};

function show(name) {
  for (const [key, screen] of Object.entries(screens)) screen.hidden = key !== name;
  window.scrollTo(0, 0);
}

const backHome = () => { home.render(); show('home'); };

const run = new RunScreen(document.getElementById('screen-run'), { onExit: backHome });
const editor = new EditorScreen(screens.editor, { onClose: backHome });
const settingsScreen = new SettingsScreen(screens.settings, {
  settings, onClose: backHome, onDataChanged: () => home.render(),
});

const home = new HomeScreen(screens.home, {
  onStart: (workout) => startWorkout(workout),
  onEdit: (workout, options) => { show('editor'); editor.open(workout, options); },
});

document.getElementById('open-settings').addEventListener('click', () => { show('settings'); settingsScreen.open(); });

function startWorkout(workout, saved = null) {
  if (run.open(workout, settings, saved)) show(null);
}

// First launch on this device: add a couple of example workouts.
if (store.loadWorkouts() === null) store.saveWorkouts(presets.examples());
home.render();

// If iOS closed the app mid-workout, pick up where we left off.
const active = store.loadActiveRun();
if (active?.workout && active.engine?.status !== 'done') {
  startWorkout(active.workout, active.engine);
}

// Offline support: the service worker keeps a copy of the app on the device.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
// Ask the browser not to clear our saved data when space runs low.
navigator.storage?.persist?.().catch(() => {});
