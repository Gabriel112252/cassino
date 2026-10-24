import type { LayoutMode } from '@game/responsive';
import { FRAME_GEOMETRY, FRAME_GEOMETRY_TALL, type FrameGeometry } from './assets';

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  w: number;
  h: number;
}

export interface Sized extends Point {
  w: number;
}

export interface ReelWindow {
  /** centro horizontal da janela do rolo (coordenadas do mundo) */
  x: number;
  /** topo da janela */
  top: number;
  width: number;
  height: number;
  rowH: number;
  symbolSize: number;
}

export interface Layout {
  mode: LayoutMode;
  width: number;
  height: number;
  bg: { x: number; y: number; scale: number };
  logo: { x: number; y: number; scale: number };
  frame: { key: string; x: number; y: number; scale: number; left: number; top: number; right: number; bottom: number; width: number; height: number };
  reels: ReelWindow[];
  mascot: { x: number; y: number; size: number };
  plaqueLeft: Box;
  plaqueRight: Box;
  credits: Box;
  demoLabel: { x: number; y: number; scale: number };
  lastWin: Box;
  bet: { minus: Sized; plate: Box; plus: Sized };
  spin: { x: number; y: number; size: number };
  auto: Sized;
  turbo: Sized;
  icons: { home: Sized; trophy: Sized; help: Sized; sound: Sized; settings: Sized };
  /** centro da área dos rolos (para textos de vitória) */
  center: Point;
}

function frameBox(F: FrameGeometry, x: number, y: number, scale: number): Layout['frame'] {
  const width = F.width * scale;
  const height = F.height * scale;
  return { key: F.key, x, y, scale, width, height, left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

function reelWindows(F: FrameGeometry, frame: Layout['frame']): ReelWindow[] {
  const s = frame.scale;
  const top = frame.top + F.rowsY[0] * s;
  const height = (F.rowsY[1] - F.rowsY[0]) * s;
  const rowH = height / 3;
  return F.columns.map(([x0, x1]) => {
    const width = (x1 - x0) * s;
    return {
      x: frame.left + ((x0 + x1) / 2) * s,
      top,
      width,
      height,
      rowH,
      symbolSize: Math.min(rowH * 0.94, width * 0.86),
    };
  });
}

export function computeLayout(width: number, height: number, mode: LayoutMode): Layout {
  return mode === 'landscape' ? landscape(width, height) : portrait(width, height);
}

function landscape(W: number, H: number): Layout {
  const F = FRAME_GEOMETRY;
  const bgScale = Math.max(W / 1600, H / 900);
  const frameScale = Math.min((W * 0.56) / F.width, (H * 0.6) / F.height);
  const frame = frameBox(F, W / 2, H * 0.505, frameScale);
  const reels = reelWindows(F, frame);
  const iconW = 74;
  const iconY = 58;
  const iconStep = 88;
  const bottomY = H - 100;
  const sideSpace = frame.left; // espaço disponível à esquerda da moldura
  const plaqueW = Math.min(250, Math.max(150, sideSpace * 0.72));
  const plaqueH = plaqueW * 0.66;
  // fator de compactação da barra inferior em janelas estreitas
  const k = Math.min(1, Math.max(0.72, W / 1700));
  const minusX = W / 2 - 400 * k;
  const lastWinW = Math.min(350 * k, minusX - 36 * k - 44);
  return {
    mode: 'landscape',
    width: W,
    height: H,
    bg: { x: W / 2, y: H / 2, scale: bgScale },
    logo: { x: W / 2, y: frame.top - 52, scale: Math.min(1, frame.width / 1100) * 0.95 },
    frame,
    reels,
    mascot: { x: frame.left + 70, y: frame.top - 20, size: Math.min(210, frame.height * 0.36) },
    plaqueLeft: { x: sideSpace / 2, y: frame.y - frame.height * 0.08, w: plaqueW, h: plaqueH },
    plaqueRight: { x: W - sideSpace / 2, y: frame.y - frame.height * 0.08, w: plaqueW, h: plaqueH },
    credits: { x: 240, y: 64, w: 430, h: 96 },
    demoLabel: { x: 170, y: 148, scale: 0.55 },
    lastWin: { x: 24 + lastWinW / 2, y: bottomY, w: lastWinW, h: 92 * k },
    bet: {
      minus: { x: minusX, y: bottomY, w: 72 * k },
      plate: { x: W / 2 - 262 * k, y: bottomY, w: 180 * k, h: 84 * k },
      plus: { x: W / 2 - 124 * k, y: bottomY, w: 76 * k },
    },
    spin: { x: W / 2, y: bottomY - 6, size: 190 * k },
    auto: { x: W / 2 + 230 * k, y: bottomY, w: 220 * k },
    turbo: { x: W / 2 + 468 * k, y: bottomY, w: 226 * k },
    icons: {
      settings: { x: W - 56, y: iconY, w: iconW },
      sound: { x: W - 56 - iconStep, y: iconY, w: iconW },
      help: { x: W - 56 - iconStep * 2, y: iconY, w: iconW },
      trophy: { x: W - 56 - iconStep * 3, y: iconY, w: iconW },
      home: { x: W - 56 - iconStep * 4, y: iconY, w: iconW },
    },
    center: { x: frame.x, y: reels[0].top + reels[0].height / 2 },
  };
}

function portrait(W: number, H: number): Layout {
  const F = FRAME_GEOMETRY_TALL;
  const bgScale = Math.max(W / 1600, H / 900);
  const frameScale = Math.min((W - 36) / F.width, (H * 0.42) / F.height);
  const logoScale = 0.85;
  const logoH = 238 * logoScale;
  const topBar = 110;
  const plaqueH = 110;
  const plaqueW = 300;
  // empilhamento vertical: barra superior → logo → placas → moldura; controles ancorados embaixo
  const logoY = topBar + logoH / 2 + 24;
  const plaqueY = logoY + logoH / 2 + plaqueH / 2 + 10;
  const frameTop = plaqueY + plaqueH / 2 + 30;
  const frame = frameBox(F, W / 2, frameTop + (F.height * frameScale) / 2, frameScale);
  const reels = reelWindows(F, frame);
  const spinY = H - 290;
  const row1Y = Math.min(frame.bottom + 150, spinY - 330);
  const iconW = 76;
  const iconStep = 88;
  return {
    mode: 'portrait',
    width: W,
    height: H,
    bg: { x: W / 2, y: H / 2, scale: bgScale },
    logo: { x: W / 2, y: logoY, scale: logoScale },
    frame,
    reels,
    mascot: { x: frame.left + 62, y: frame.top + 14, size: 124 },
    plaqueLeft: { x: W * 0.3, y: plaqueY, w: plaqueW, h: plaqueH },
    plaqueRight: { x: W * 0.7, y: plaqueY, w: plaqueW, h: plaqueH },
    credits: { x: 230, y: 62, w: 420, h: 92 },
    demoLabel: { x: 180, y: 136, scale: 0.6 },
    lastWin: { x: W * 0.24, y: row1Y, w: 400, h: 92 },
    bet: {
      minus: { x: W * 0.54, y: row1Y, w: 76 },
      plate: { x: W * 0.72, y: row1Y, w: 220, h: 86 },
      plus: { x: W * 0.9, y: row1Y, w: 80 },
    },
    spin: { x: W / 2, y: spinY, size: 230 },
    auto: { x: W * 0.2, y: spinY, w: 270 },
    turbo: { x: W * 0.8, y: spinY, w: 274 },
    icons: {
      settings: { x: W - 56, y: 60, w: iconW },
      sound: { x: W - 56 - iconStep, y: 60, w: iconW },
      help: { x: W - 56 - iconStep * 2, y: 60, w: iconW },
      trophy: { x: W - 56 - iconStep * 3, y: 60, w: iconW },
      home: { x: W - 56 - iconStep * 4, y: 60, w: iconW },
    },
    center: { x: frame.x, y: reels[0].top + reels[0].height / 2 },
  };
}
