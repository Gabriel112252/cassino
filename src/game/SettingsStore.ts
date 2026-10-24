import { APP_CONFIG } from '@config/app.config';
import { createDefaultStorage, type KeyValueStorage } from '@wallet/storage';
import { Emitter } from './core/Emitter';

export interface UserSettings {
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  turbo: boolean;
  tutorialSeen: boolean;
}

const DEFAULTS: UserSettings = {
  musicVolume: 0.55,
  sfxVolume: 0.9,
  musicEnabled: true,
  sfxEnabled: true,
  turbo: false,
  tutorialSeen: false,
};

/** Preferências do jogador persistidas em localStorage (áudio, turbo, tutorial). */
export class SettingsStore {
  readonly events = new Emitter<{ change: UserSettings }>();
  private data: UserSettings;

  constructor(private readonly storage: KeyValueStorage = createDefaultStorage()) {
    this.data = this.load();
  }

  get(): UserSettings {
    return { ...this.data };
  }

  update(patch: Partial<UserSettings>): UserSettings {
    this.data = { ...this.data, ...patch };
    this.data.musicVolume = clamp01(this.data.musicVolume);
    this.data.sfxVolume = clamp01(this.data.sfxVolume);
    try {
      this.storage.set(APP_CONFIG.storage.settings, JSON.stringify(this.data));
    } catch {
      /* best-effort */
    }
    this.events.emit('change', this.get());
    return this.get();
  }

  private load(): UserSettings {
    try {
      const raw = this.storage.get(APP_CONFIG.storage.settings);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return {
        ...DEFAULTS,
        ...parsed,
        musicVolume: clamp01(typeof parsed.musicVolume === 'number' ? parsed.musicVolume : DEFAULTS.musicVolume),
        sfxVolume: clamp01(typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULTS.sfxVolume),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
