/**
 * Manifesto de assets do Jaguar Gold.
 * Todos os arquivos vivem em public/assets/jaguar-gold/ (originais do pacote de artes) e
 * public/assets/jaguar-gold/generated/ (derivados por tools/prepare_assets.py).
 */
const BASE = 'assets/jaguar-gold/';
const GEN = `${BASE}generated/`;

export const SYMBOL_IDS = ['jaguar', 'mask', 'crown', 'diamond', 'bell', 'clover', 'mango', 'cherries', 'chest', 'wild', 'bonus'] as const;

export function symbolTexture(id: string): string {
  return `sym-${id}`;
}

export function symbolBlurTexture(id: string): string {
  return `sym-${id}-blur`;
}

export interface ImageAsset {
  key: string;
  url: string;
}

export interface SpriteSheetAsset extends ImageAsset {
  frameWidth: number;
  frameHeight: number;
}

export const JG_IMAGES: readonly ImageAsset[] = [
  { key: 'jg-bg', url: `${BASE}backgrounds/jungle_temple_1600x900.png` },
  { key: 'jg-bg-dim', url: `${GEN}backgrounds/jungle_temple_dim.jpg` },
  { key: 'jg-foliage', url: `${BASE}backgrounds/foliage.png` },
  { key: 'jg-logo', url: `${BASE}ui/logo.png` },
  { key: 'jg-frame', url: `${BASE}ui/reel_frame.png` },
  { key: 'jg-frame-tall', url: `${GEN}ui/reel_frame_tall.png` },
  { key: 'jg-spin', url: `${BASE}ui/spin_round.png` },
  { key: 'jg-btn-auto', url: `${BASE}ui/auto_10.png` },
  { key: 'jg-btn-turbo', url: `${BASE}ui/turbo.png` },
  { key: 'jg-btn-minus', url: `${BASE}ui/bet_minus.png` },
  { key: 'jg-btn-plus', url: `${BASE}ui/bet_plus.png` },
  { key: 'jg-btn-help', url: `${BASE}ui/help.png` },
  { key: 'jg-btn-info', url: `${BASE}ui/info.png` },
  { key: 'jg-btn-home', url: `${BASE}ui/home.png` },
  { key: 'jg-btn-settings', url: `${BASE}ui/settings.png` },
  { key: 'jg-btn-sound-on', url: `${BASE}ui/sound_on.png` },
  { key: 'jg-btn-sound-off', url: `${BASE}ui/sound_off.png` },
  { key: 'jg-btn-trophy', url: `${BASE}ui/trophy.png` },
  { key: 'jg-demo-label', url: `${BASE}ui/demo_label.png` },
  { key: 'jg-fx-bigwin', url: `${GEN}effects/big_win.png` },
  { key: 'jg-fx-megawin', url: `${GEN}effects/mega_win.png` },
  { key: 'jg-fx-coins-burst', url: `${GEN}effects/coins_burst.png` },
  { key: 'jg-fx-golden-flare', url: `${GEN}effects/golden_flare.png` },
  { key: 'jg-fx-golden-ring', url: `${GEN}effects/golden_ring.png` },
  { key: 'jg-fx-purple-flare', url: `${GEN}effects/purple_flare.png` },
  { key: 'fx-glow-soft', url: `${GEN}fx/glow_soft.png` },
  { key: 'fx-glow-hard', url: `${GEN}fx/glow_hard.png` },
  { key: 'fx-firefly', url: `${GEN}fx/firefly.png` },
  { key: 'fx-spark', url: `${GEN}fx/spark.png` },
  { key: 'fx-fog', url: `${GEN}fx/fog.png` },
  { key: 'fx-ray', url: `${GEN}fx/ray.png` },
  { key: 'fx-vignette', url: `${GEN}fx/vignette.png` },
  { key: 'fx-coin', url: `${GEN}fx/coin_particle.png` },
  { key: 'fx-gradient-v', url: `${GEN}fx/gradient_v.png` },
  { key: 'fx-white', url: `${GEN}fx/white.png` },
  ...SYMBOL_IDS.map((id) => ({ key: symbolTexture(id), url: `${GEN}symbols/${id}.png` })),
  ...SYMBOL_IDS.map((id) => ({ key: symbolBlurTexture(id), url: `${GEN}symbols/${id}_blur.png` })),
];

export const JG_SPRITESHEETS: readonly SpriteSheetAsset[] = [
  { key: 'jg-coin-sheet', url: `${GEN}coins/coin_sheet.png`, frameWidth: 96, frameHeight: 96 },
  { key: 'jg-mascot-sheet', url: `${GEN}mascot/jaguar_sheet.png`, frameWidth: 300, frameHeight: 240 },
  { key: 'jg-chest-sheet', url: `${GEN}mascot/chest_sheet.png`, frameWidth: 220, frameHeight: 200 },
];

export interface FrameGeometry {
  /** chave da textura da moldura */
  key: string;
  width: number;
  height: number;
  /** limites horizontais [x0, x1] de cada janela, em px da imagem */
  columns: readonly (readonly [number, number])[];
  /** limites verticais [y0, y1] das janelas */
  rowsY: readonly [number, number];
}

/** Geometria da moldura (ui/reel_frame.png, 718x432): janelas dos 3 rolos medidas na imagem. */
export const FRAME_GEOMETRY: FrameGeometry = {
  key: 'jg-frame',
  width: 718,
  height: 432,
  columns: [
    [71, 229],
    [265, 433],
    [470, 627],
  ],
  rowsY: [79, 380],
};

/** Moldura alta (generated/ui/reel_frame_tall.png, 718x550) usada no retrato: células mais altas. */
export const FRAME_GEOMETRY_TALL: FrameGeometry = {
  key: 'jg-frame-tall',
  width: 718,
  height: 550,
  columns: FRAME_GEOMETRY.columns,
  rowsY: [79, 498],
};
