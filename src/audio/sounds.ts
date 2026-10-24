/** Manifesto dos sons do Jaguar Gold (gerados por tools/generate_audio.py). */
export interface SoundDef {
  key: string;
  file: string;
  loop?: boolean;
  /** volume base (0..1), multiplicado pelo volume de SFX/música */
  volume?: number;
  music?: boolean;
}

export const AUDIO_BASE = 'assets/jaguar-gold/audio/';

export const SOUNDS: readonly SoundDef[] = [
  { key: 'music', file: 'music_ambient', loop: true, volume: 1, music: true },
  { key: 'click', file: 'ui_click', volume: 0.6 },
  { key: 'spinStart', file: 'spin_start', volume: 0.8 },
  { key: 'reelLoop', file: 'reel_spin_loop', loop: true, volume: 0.55 },
  { key: 'reelStop', file: 'reel_stop', volume: 0.9 },
  { key: 'winLine', file: 'win_line', volume: 0.8 },
  { key: 'winSmall', file: 'win_small', volume: 0.85 },
  { key: 'coins', file: 'coins', volume: 0.8 },
  { key: 'countLoop', file: 'count_loop', loop: true, volume: 0.5 },
  { key: 'bigWin', file: 'big_win', volume: 1 },
  { key: 'megaWin', file: 'mega_win', volume: 1 },
  { key: 'bonusEnter', file: 'bonus_enter', volume: 1 },
  { key: 'anticipation', file: 'anticipation', volume: 0.8 },
];
