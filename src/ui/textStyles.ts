import Phaser from 'phaser';

export const FONT_TITLE = '"Cinzel", "Georgia", serif';
export const FONT_UI = '"Montserrat", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';

export const COLORS = {
  gold: 0xffc83a,
  goldLight: 0xfff0b4,
  goldDark: 0x9a5c08,
  brown: 0x3a1d08,
  purple: 0x2a0f3a,
  purpleDeep: 0x14081e,
  green: 0x37c352,
  red: 0xe2322e,
  white: 0xffffff,
  text: 0xfff3d6,
  textDim: 0xc9b58f,
} as const;

export const COLORS_CSS = {
  gold: '#ffc83a',
  goldLight: '#fff0b4',
  goldDark: '#9a5c08',
  brown: '#3a1d08',
  text: '#fff3d6',
  textDim: '#c9b58f',
  white: '#ffffff',
} as const;

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export function titleStyle(size: number, overrides: TextStyle = {}): TextStyle {
  return {
    fontFamily: FONT_TITLE,
    fontSize: `${size}px`,
    fontStyle: '900',
    color: COLORS_CSS.goldLight,
    stroke: '#4a2606',
    strokeThickness: Math.max(2, Math.round(size * 0.1)),
    shadow: { offsetX: 0, offsetY: Math.round(size * 0.06), color: '#000000', blur: Math.round(size * 0.18), fill: true, stroke: true },
    ...overrides,
  };
}

export function uiStyle(size: number, overrides: TextStyle = {}): TextStyle {
  return {
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    fontStyle: '700',
    color: COLORS_CSS.text,
    ...overrides,
  };
}

export function numberStyle(size: number, overrides: TextStyle = {}): TextStyle {
  return {
    fontFamily: FONT_UI,
    fontSize: `${size}px`,
    fontStyle: '800',
    color: COLORS_CSS.gold,
    stroke: '#2a1404',
    strokeThickness: Math.max(1, Math.round(size * 0.06)),
    shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    ...overrides,
  };
}

/** Aplica um gradiente dourado vertical ao preenchimento de um texto (visual metálico). */
export function applyGoldGradient(text: Phaser.GameObjects.Text, stops: [string, string, string, string] = ['#fff6c8', '#ffd45c', '#f09a16', '#ffe08a']): void {
  const h = Math.max(1, text.height);
  const grad = text.context.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.45, stops[1]);
  grad.addColorStop(0.7, stops[2]);
  grad.addColorStop(1, stops[3]);
  text.setFill(grad);
}

export function makeTitle(scene: Phaser.Scene, x: number, y: number, label: string, size: number, overrides: TextStyle = {}): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, label, titleStyle(size, overrides)).setOrigin(0.5);
  applyGoldGradient(t);
  return t;
}
