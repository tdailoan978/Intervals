// Settings: timing, sound and voice, keep-awake, and backup.

import * as store from '../store.js';
import * as audio from '../audio.js';
import * as wakelock from '../wakelock.js';
import { el, field, select, toggle, actionSheet, notice } from '../ui.js';

export const APP_VERSION = '1.0';

export class SettingsScreen {
  // settings: the live settings object, changed in place so the rest of the app sees updates.
  constructor(root, { settings, onClose, onDataChanged }) {
    this.root = root;
    this.settings = settings;
    this.onDataChanged = onDataChanged;
    this.body = root.querySelector('#settings-body');
    root.querySelector('#settings-back').addEventListener('click', () => { root.hidden = true; onClose(); });
    this.fileInput = el('input', { type: 'file', hidden: true, onchange: (e) => this.importFile(e.target.files[0]) });
    root.append(this.fileInput);
  }

  open() {
    this.render();
    this.root.hidden = false;
    window.scrollTo(0, 0);
  }

  set(key, value) {
    this.settings[key] = value;
    store.saveSettings(this.settings);
  }

  render() {
    const s = this.settings;
    const section = (title, ...rows) => el('section', { class: 'section' },
      el('h2', { class: 'section-title' }, title),
      el('div', { class: 'settings-group' }, ...rows));
    const note = (text) => el('p', { class: 'settings-note' }, text);

    this.body.replaceChildren(
      section('Timer',
        field('Get ready countdown', select(s.getReady,
          [[0, 'Off'], [3, '3 sec'], [5, '5 sec'], [10, '10 sec'], [15, '15 sec'], [20, '20 sec'], [30, '30 sec']],
          (v) => this.set('getReady', v), { label: 'Get ready countdown' })),
        field('Countdown beeps', select(s.countdown,
          [[0, 'Off'], [3, 'Last 3 sec'], [5, 'Last 5 sec'], [10, 'Last 10 sec']],
          (v) => this.set('countdown', v), { label: 'Countdown beeps' }))),

      section('Sound',
        field('Beeps', toggle(s.sound, (v) => this.set('sound', v), { label: 'Beeps' })),
        field('Voice cues', toggle(s.voice, (v) => this.set('voice', v), { label: 'Voice cues' })),
        el('button', { type: 'button', class: 'btn', onclick: () => this.testSound() }, 'Play test sound'),
        note('Beeps play alongside your music. Your iPhone’s silent mode mutes them, so keep it on ring at the gym.')),

      section('Screen',
        field('Keep screen awake', toggle(s.keepAwake, (v) => this.set('keepAwake', v), { label: 'Keep screen awake' })),
        note(wakelock.supported
          ? 'Stops the screen dimming or locking while a workout is open.'
          : 'This browser can’t keep the screen awake. On iPhone this needs iOS 18.4 or later when opened from the Home Screen. Until then, set Settings → Display & Brightness → Auto-Lock to Never during workouts.')),

      section('Backup',
        el('div', { class: 'add-row' },
          el('button', { type: 'button', class: 'btn', onclick: () => this.exportBackup() }, 'Export'),
          el('button', { type: 'button', class: 'btn', onclick: () => this.fileInput.click() }, 'Import')),
        note('Your workouts are saved only on this device. Export a backup file now and then (save it to Files or iCloud Drive) so you can restore them if the app is ever removed.')),

      el('p', { class: 'about' }, `Intervals ${APP_VERSION}`),
    );
  }

  testSound() {
    audio.unlock();
    if (this.settings.sound) {
      audio.play('count');
      setTimeout(() => audio.play('go'), 600);
    }
    if (this.settings.voice) audio.say('Voice cues are on');
    if (!this.settings.sound && !this.settings.voice) notice('Sound is off', 'Turn on Beeps or Voice cues first.');
  }

  async exportBackup() {
    const name = `intervals-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([JSON.stringify(store.makeBackup(), null, 2)], name, { type: 'application/json' });
    // On iPhone this opens the share sheet, where "Save to Files" stores it.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* cancelled */ }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async importFile(file) {
    this.fileInput.value = '';
    if (!file) return;
    let backup;
    try {
      backup = store.parseBackup(await file.text());
    } catch {
      notice('Can’t import that file', 'Choose a backup file exported from this app.');
      return;
    }
    const n = backup.workouts.length;
    const mode = await actionSheet({
      title: `Import ${n} workout${n === 1 ? '' : 's'}?`,
      actions: [
        { label: 'Add to my workouts', value: 'add', style: 'primary' },
        { label: 'Replace my workouts and settings', value: 'replace', style: 'danger' },
      ],
    });
    if (!mode) return;
    store.restoreBackup(backup, mode);
    if (mode === 'replace') Object.assign(this.settings, store.loadSettings());
    this.render();
    this.onDataChanged();
    notice('Import complete', `${n} workout${n === 1 ? '' : 's'} imported.`);
  }
}
