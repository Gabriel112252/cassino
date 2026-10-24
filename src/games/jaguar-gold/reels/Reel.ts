import Phaser from 'phaser';
import { symbolBlurTexture, symbolTexture } from '../assets';
import type { ReelWindow } from '../layout';

export interface ReelTimings {
  /** ms para atingir a velocidade máxima */
  accelMs: number;
  /** velocidade máxima em linhas (símbolos) por segundo */
  maxSpeedRows: number;
  /** duração aproximada da desaceleração até a parada (s) */
  decelSec: number;
  /** quanto o rolo "passa" da posição final antes de voltar (em linhas) */
  overshootRows: number;
  /** duração do retorno elástico (ms) */
  bounceMs: number;
  /** acima desta velocidade (linhas/s) os símbolos ficam com motion blur */
  blurSpeedRows: number;
  /** recuo de antecipação antes de acelerar (em linhas) */
  nudgeRows: number;
  nudgeMs: number;
}

export const REEL_TIMINGS_NORMAL: ReelTimings = {
  accelMs: 340,
  maxSpeedRows: 22,
  decelSec: 0.58,
  overshootRows: 0.17,
  bounceMs: 260,
  blurSpeedRows: 9,
  nudgeRows: 0.14,
  nudgeMs: 120,
};

export const REEL_TIMINGS_TURBO: ReelTimings = {
  accelMs: 150,
  maxSpeedRows: 32,
  decelSec: 0.28,
  overshootRows: 0.12,
  bounceMs: 140,
  blurSpeedRows: 10,
  nudgeRows: 0.08,
  nudgeMs: 60,
};

type ReelState = 'idle' | 'nudge' | 'accel' | 'spin' | 'landing' | 'bounce';

const VISIBLE = 3;
const BUFFER = 1;
const TOTAL = VISIBLE + 2 * BUFFER;

/**
 * Um rolo contínuo: uma tira de sprites dentro de um container mascarado que rola para baixo.
 *
 * Fluxo de um giro: nudge (recuo) → aceleração → giro em velocidade constante (símbolos cosméticos
 * entram pelo topo) → landing (desaceleração física exata até os símbolos do RESULTADO ficarem nas
 * três linhas visíveis, passando um pouco da posição) → bounce (retorno elástico) → idle.
 *
 * O resultado nunca é "trocado" no final: ele entra pelo topo como qualquer outro símbolo.
 */
export class Reel {
  readonly container: Phaser.GameObjects.Container;
  readonly sprites: Phaser.GameObjects.Image[] = [];
  readonly glows: Phaser.GameObjects.Image[] = [];
  private symbols: string[] = [];
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private scrollRows = 0;
  private speedRows = 0;
  private state: ReelState = 'idle';
  private rowH = 100;
  private symbolSize = 90;
  private feed: string[] = [];
  private landing: { remaining: number; accel: number; overshoot: number } | null = null;
  private blurOn = false;
  private timings: ReelTimings = REEL_TIMINGS_NORMAL;
  private pendingStop: { result: string[]; extraRows: number } | null = null;
  private stopListeners: (() => void)[] = [];
  private nudgeTween?: Phaser.Tweens.Tween;
  private bounceTween?: Phaser.Tweens.Tween;
  private readonly cosmeticPool: string[];
  private baseScale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly index: number,
    strip: readonly string[],
    initial: string[],
    depth: number,
  ) {
    this.cosmeticPool = [...strip];
    this.container = scene.add.container(0, 0).setDepth(depth);
    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
    this.container.setMask(this.maskGraphics.createGeometryMask());

    for (let row = 0; row < VISIBLE; row += 1) {
      const glow = scene.add.image(0, 0, 'jg-fx-golden-flare').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.glows.push(glow);
      this.container.add(glow);
    }
    this.symbols = [this.randomCosmetic(), ...initial.slice(0, VISIBLE), this.randomCosmetic()];
    while (this.symbols.length < TOTAL) this.symbols.push(this.randomCosmetic());
    for (let i = 0; i < TOTAL; i += 1) {
      const sprite = scene.add.image(0, 0, symbolTexture(this.symbols[i]));
      this.sprites.push(sprite);
      this.container.add(sprite);
    }
  }

  // ------------------------------------------------------------------ layout

  layout(win: ReelWindow): void {
    this.container.setPosition(win.x, win.top);
    this.rowH = win.rowH;
    this.symbolSize = win.symbolSize;
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(win.x - win.width / 2 + 1, win.top + 1, win.width - 2, win.height - 2);
    this.baseScale = this.symbolSize / 256;
    for (let row = 0; row < VISIBLE; row += 1) {
      this.glows[row].setPosition(0, (row + 0.5) * this.rowH).setDisplaySize(this.rowH * 1.55, this.rowH * 1.55);
    }
    this.applySpriteSizes();
    this.positionSprites();
  }

  get rowHeight(): number {
    return this.rowH;
  }

  get symbolBaseScale(): number {
    return this.baseScale;
  }

  /** Posição (no mundo) do centro de uma linha visível. */
  rowCenter(row: number): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y + (row + 0.5) * this.rowH };
  }

  getSymbolSprite(row: number): Phaser.GameObjects.Image {
    return this.sprites[row + BUFFER];
  }

  getSymbol(row: number): string {
    return this.symbols[row + BUFFER];
  }

  get visibleSymbols(): string[] {
    return this.symbols.slice(BUFFER, BUFFER + VISIBLE);
  }

  // ------------------------------------------------------------------ controle

  get isSpinning(): boolean {
    return this.state !== 'idle';
  }

  setTimings(t: ReelTimings): void {
    this.timings = t;
  }

  onStopped(listener: () => void): void {
    this.stopListeners.push(listener);
  }

  /** Inicia o giro (recuo + aceleração). */
  spin(): void {
    if (this.state !== 'idle') return;
    this.landing = null;
    this.feed = [];
    this.pendingStop = null;
    this.state = 'nudge';
    this.speedRows = 0;
    this.nudgeTween?.stop();
    this.nudgeTween = this.scene.tweens.add({
      targets: this,
      scrollRows: -this.timings.nudgeRows,
      duration: this.timings.nudgeMs,
      ease: 'Sine.easeOut',
      onUpdate: () => this.positionSprites(),
      onComplete: () => {
        if (this.state === 'nudge') {
          this.state = 'accel';
          if (this.pendingStop) {
            const p = this.pendingStop;
            this.pendingStop = null;
            this.beginLanding(p.result, p.extraRows);
          }
        }
      },
    });
  }

  /**
   * Pede a parada com um resultado definido (3 símbolos, de cima para baixo).
   * `extraRows` alonga a desaceleração (usado para escalonar ou antecipar).
   */
  stop(result: string[], extraRows = 0): void {
    if (this.state === 'idle' || this.state === 'landing' || this.state === 'bounce') return;
    if (this.state === 'nudge') {
      this.pendingStop = { result, extraRows };
      return;
    }
    this.beginLanding(result, extraRows);
  }

  private beginLanding(result: string[], extraRows: number): void {
    const v = Math.max(this.speedRows, this.timings.maxSpeedRows * 0.6);
    this.speedRows = v;
    const desired = (v * this.timings.decelSec) / 2 + extraRows;
    const n = Math.max(4, Math.round(desired + this.scrollRows));
    const overshoot = this.timings.overshootRows;
    const remaining = n - this.scrollRows + overshoot;
    const pads = n - 4;
    this.feed = [];
    for (let i = 0; i < pads; i += 1) this.feed.push(this.randomCosmetic());
    this.feed.push(result[2], result[1], result[0], this.randomCosmetic());
    this.landing = { remaining, accel: (v * v) / (2 * remaining), overshoot };
    this.state = 'landing';
  }

  /** Avanço por frame; chamado pela cena. */
  update(deltaMs: number): void {
    if (this.state === 'idle' || this.state === 'nudge' || this.state === 'bounce') return;
    // mesmo teto do TimeStep do Phaser (fps.min = 0.5): rolos, tweens e timers avançam no mesmo relógio
    const dt = Math.min(deltaMs, 2000) / 1000;
    const t = this.timings;

    if (this.state === 'accel') {
      this.speedRows = Math.min(t.maxSpeedRows, this.speedRows + (t.maxSpeedRows / (t.accelMs / 1000)) * dt);
      if (this.speedRows >= t.maxSpeedRows) this.state = 'spin';
      this.advance(this.speedRows * dt);
    } else if (this.state === 'spin') {
      this.advance(this.speedRows * dt);
    } else if (this.state === 'landing' && this.landing) {
      const l = this.landing;
      this.speedRows = Math.max(1.6, Math.sqrt(2 * l.accel * l.remaining));
      const step = Math.min(l.remaining, this.speedRows * dt);
      l.remaining -= step;
      this.advance(step);
      if (l.remaining <= 1e-6) this.land();
    }

    const wantBlur = this.speedRows > t.blurSpeedRows && (this.state === 'spin' || this.state === 'accel' || this.state === 'landing');
    if (wantBlur !== this.blurOn) this.setBlur(wantBlur);
  }

  private advance(rows: number): void {
    this.scrollRows += rows;
    while (this.scrollRows >= 1) {
      this.scrollRows -= 1;
      this.shift();
    }
    this.positionSprites();
  }

  private shift(): void {
    const next = this.feed.length > 0 ? (this.feed.shift() as string) : this.randomCosmetic();
    this.symbols.pop();
    this.symbols.unshift(next);
    const sprite = this.sprites.pop() as Phaser.GameObjects.Image;
    this.sprites.unshift(sprite);
    sprite.setTexture(this.blurOn ? symbolBlurTexture(next) : symbolTexture(next));
    this.applySpriteSize(sprite);
  }

  private land(): void {
    const l = this.landing as { overshoot: number };
    this.landing = null;
    this.scrollRows = l.overshoot;
    this.speedRows = 0;
    this.setBlur(false);
    this.positionSprites();
    this.state = 'bounce';
    this.bounceTween?.stop();
    this.bounceTween = this.scene.tweens.add({
      targets: this,
      scrollRows: 0,
      duration: this.timings.bounceMs,
      ease: Phaser.Math.Easing.Back.Out,
      onUpdate: () => this.positionSprites(),
      onComplete: () => {
        this.scrollRows = 0;
        this.positionSprites();
        this.state = 'idle';
        for (const fn of this.stopListeners) fn();
      },
    });
  }

  /** Para imediatamente (usado ao sair da cena). */
  reset(): void {
    this.nudgeTween?.stop();
    this.bounceTween?.stop();
    this.landing = null;
    this.feed = [];
    this.scrollRows = 0;
    this.speedRows = 0;
    this.state = 'idle';
    this.setBlur(false);
    this.positionSprites();
  }

  // ------------------------------------------------------------------ visual

  private setBlur(on: boolean): void {
    this.blurOn = on;
    for (let i = 0; i < TOTAL; i += 1) {
      const id = this.symbols[i];
      this.sprites[i].setTexture(on ? symbolBlurTexture(id) : symbolTexture(id));
      this.applySpriteSize(this.sprites[i]);
    }
  }

  private applySpriteSizes(): void {
    for (const s of this.sprites) this.applySpriteSize(s);
  }

  private applySpriteSize(sprite: Phaser.GameObjects.Image): void {
    // texturas normais 256x256; blur 256x320 (mesma escala → rastro vertical)
    sprite.setScale(this.baseScale);
  }

  private positionSprites(): void {
    for (let i = 0; i < TOTAL; i += 1) {
      this.sprites[i].setPosition(0, (i - BUFFER + 0.5 + this.scrollRows) * this.rowH);
    }
  }

  private randomCosmetic(): string {
    return this.cosmeticPool[Math.floor(Math.random() * this.cosmeticPool.length)];
  }

  /** Brilho atrás de uma linha (0..1). */
  setRowGlow(row: number, alpha: number): void {
    this.glows[row].setAlpha(alpha);
  }

  /** Escurece/restaura os símbolos de uma linha (apresentação de vitórias). */
  setRowDim(row: number, dim: boolean): void {
    const sprite = this.getSymbolSprite(row);
    if (dim) sprite.setTint(0x6b6a80);
    else sprite.clearTint();
  }

  clearPresentation(): void {
    for (let row = 0; row < VISIBLE; row += 1) {
      this.setRowGlow(row, 0);
      this.setRowDim(row, false);
      const s = this.getSymbolSprite(row);
      s.setScale(this.baseScale);
      s.setAngle(0);
    }
  }

  destroy(): void {
    this.nudgeTween?.stop();
    this.bounceTween?.stop();
    this.container.destroy();
    this.maskGraphics.destroy();
  }
}
