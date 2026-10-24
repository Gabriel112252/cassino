import { APP_CONFIG } from '@config/app.config';

export type LayoutMode = 'landscape' | 'portrait';

export interface GameSize {
  width: number;
  height: number;
  mode: LayoutMode;
}

/**
 * Resolução lógica do jogo em função da janela: a lateral MENOR vale sempre 1080 unidades e a
 * MAIOR acompanha a proporção da tela. Com Scale.FIT, o canvas preenche a janela inteira sem
 * letterbox e com nitidez em telas de alta densidade (o canvas é maior que os CSS px do celular).
 */
export function computeGameSize(windowWidth: number, windowHeight: number): GameSize {
  const w = Math.max(1, windowWidth);
  const h = Math.max(1, windowHeight);
  const { short, minLong, maxLong } = APP_CONFIG.design;
  const aspect = w / h;
  if (aspect >= 1) {
    const width = Math.round(Math.min(maxLong, Math.max(minLong, short * aspect)));
    return { width, height: short, mode: 'landscape' };
  }
  const height = Math.round(Math.min(maxLong, Math.max(minLong, short / aspect)));
  return { width: short, height, mode: 'portrait' };
}

export function currentViewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1920, height: 1080 };
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  return { width, height };
}

export function modeFor(width: number, height: number): LayoutMode {
  return width >= height ? 'landscape' : 'portrait';
}
