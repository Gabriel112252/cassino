import { Howl, Howler } from 'howler';
import type { SettingsStore, UserSettings } from '@game/SettingsStore';
import { AUDIO_BASE, SOUNDS, type SoundDef } from './sounds';

export interface PlayOptions {
  volume?: number;
  rate?: number;
  /** se true, para instâncias anteriores do mesmo som antes de tocar */
  solo?: boolean;
}

/**
 * Gerenciador de áudio (Howler.js / Web Audio).
 *
 * - Respeita o autoplay dos navegadores: nada toca antes de `unlock()` (chamado no primeiro toque).
 * - Música e efeitos têm volumes e mute independentes, persistidos em SettingsStore.
 * - Se algum arquivo falhar ao carregar, o jogo continua (sem som para aquela chave).
 */
export class AudioManager {
  private readonly howls = new Map<string, Howl>();
  private readonly defs = new Map<string, SoundDef>();
  private readonly loops = new Map<string, number>();
  private unlocked = false;
  private settings: UserSettings;
  private musicRequested = false;

  constructor(store: SettingsStore) {
    this.settings = store.get();
    store.events.on('change', (s) => this.applySettings(s));
  }

  /** Cria os Howls e devolve quando tudo carregou (ou quando o tempo limite estourar). */
  load(timeoutMs = 15000): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const def of SOUNDS) {
      this.defs.set(def.key, def);
      const howl = new Howl({
        src: [`${AUDIO_BASE}${def.file}.ogg`, `${AUDIO_BASE}${def.file}.mp3`],
        loop: !!def.loop,
        volume: this.volumeFor(def),
        preload: true,
        html5: false,
      });
      this.howls.set(def.key, howl);
      pending.push(
        new Promise<void>((resolve) => {
          if (howl.state() === 'loaded') resolve();
          howl.once('load', () => resolve());
          howl.once('loaderror', (_id, err) => {
            console.warn(`[audio] falha ao carregar "${def.key}"`, err);
            resolve();
          });
        }),
      );
    }
    const all = Promise.all(pending).then(() => undefined);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    return Promise.race([all, timeout]);
  }

  /** Deve ser chamado a partir de um gesto do usuário (pointerdown). */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const ctx = Howler.ctx;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    } catch {
      /* ignore */
    }
    if (this.musicRequested) this.playMusic();
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  // ------------------------------------------------------------------ música

  playMusic(): void {
    this.musicRequested = true;
    if (!this.unlocked) return;
    const howl = this.howls.get('music');
    if (!howl || !this.settings.musicEnabled) return;
    if (howl.playing()) return;
    const id = howl.play();
    howl.fade(0, this.volumeFor(this.defs.get('music')), 1500, id);
  }

  stopMusic(): void {
    this.musicRequested = false;
    const howl = this.howls.get('music');
    if (howl && howl.playing()) {
      howl.fade(howl.volume() as number, 0, 600);
      setTimeout(() => howl.stop(), 650);
    }
  }

  /** Abaixa temporariamente a música (ex.: durante Big Win). */
  duckMusic(factor: number, ms = 300): void {
    const howl = this.howls.get('music');
    const def = this.defs.get('music');
    if (!howl || !def || !howl.playing()) return;
    howl.fade(howl.volume() as number, this.volumeFor(def) * factor, ms);
  }

  // ------------------------------------------------------------------ efeitos

  play(key: string, options: PlayOptions = {}): number | null {
    if (!this.unlocked || !this.settings.sfxEnabled) return null;
    const howl = this.howls.get(key);
    const def = this.defs.get(key);
    if (!howl || !def) return null;
    if (options.solo) howl.stop();
    const id = howl.play();
    howl.volume(this.volumeFor(def) * (options.volume ?? 1), id);
    if (options.rate) howl.rate(options.rate, id);
    if (def.loop) this.loops.set(key, id);
    return id;
  }

  stop(key: string, fadeMs = 0): void {
    const howl = this.howls.get(key);
    if (!howl) return;
    const id = this.loops.get(key);
    if (fadeMs > 0 && howl.playing(id)) {
      howl.fade(howl.volume(id as number) as number, 0, fadeMs, id);
      setTimeout(() => howl.stop(id), fadeMs + 20);
    } else {
      howl.stop(id);
    }
    this.loops.delete(key);
  }

  stopAllSfx(): void {
    for (const [key, howl] of this.howls) {
      if (!this.defs.get(key)?.music) howl.stop();
    }
    this.loops.clear();
  }

  // ------------------------------------------------------------------ settings

  private applySettings(s: UserSettings): void {
    const musicWasEnabled = this.settings.musicEnabled;
    this.settings = s;
    for (const [key, howl] of this.howls) {
      const def = this.defs.get(key);
      if (!def) continue;
      howl.volume(this.volumeFor(def));
    }
    if (!s.musicEnabled && musicWasEnabled) {
      const howl = this.howls.get('music');
      howl?.stop();
    } else if (s.musicEnabled && !musicWasEnabled && this.musicRequested) {
      this.playMusic();
    }
    if (!s.sfxEnabled) this.stopAllSfx();
  }

  private volumeFor(def: SoundDef | undefined): number {
    if (!def) return 0;
    const base = def.volume ?? 1;
    return def.music ? base * this.settings.musicVolume : base * this.settings.sfxVolume;
  }
}
