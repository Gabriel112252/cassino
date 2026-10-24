import Phaser from 'phaser';
import type { LineWin, Position, SpinResult } from '@game/core/types';
import { formatCredits } from '@game/format';
import { applyGoldGradient, titleStyle, uiStyle } from '@ui/textStyles';
import type { Layout } from '../layout';
import type { ReelSet } from '../reels/ReelSet';
import type { AudioManager } from '@audio/AudioManager';

const LINE_COLORS = [0xffc83a, 0x5ee0ff, 0xff6ad5, 0x7dff8f, 0xff9a3c];

/**
 * Apresentação das vitórias: linhas de pagamento desenhadas por cima dos rolos, símbolos
 * vencedores com brilho/pulso, partículas douradas e o valor ganho "pipocando" no centro.
 */
export class WinPresenter {
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly coins: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly lineLabel: Phaser.GameObjects.Text;
  private cycleTimer?: Phaser.Time.TimerEvent;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private popup?: Phaser.GameObjects.Container;
  private layoutRef: Layout;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reelSet: ReelSet,
    layout: Layout,
    private readonly audio: AudioManager,
    private readonly paylines: readonly (readonly number[])[],
    depth: number,
  ) {
    this.layoutRef = layout;
    this.lines = scene.add.graphics().setDepth(depth);
    this.sparks = scene.add.particles(0, 0, 'fx-spark', {
      speed: { min: 60, max: 260 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 500, max: 1100 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xfff1b0, 0xffc83a, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 200,
      emitting: false,
    });
    this.sparks.setDepth(depth + 1);
    this.coins = scene.add.particles(0, 0, 'jg-coin-sheet', {
      frame: [0, 1, 2, 3, 4, 5, 6],
      speed: { min: 320, max: 720 },
      angle: { min: 235, max: 305 },
      lifespan: { min: 1200, max: 1900 },
      scale: { start: 0.9, end: 0.5 },
      alpha: { start: 1, end: 0.8 },
      rotate: { min: -180, max: 180 },
      gravityY: 1300,
      emitting: false,
    });
    this.coins.setDepth(depth + 2);
    this.lineLabel = scene.add
      .text(0, 0, '', uiStyle(30, { color: '#fff3d6', stroke: '#2a1404', strokeThickness: 6, fontStyle: '800' }))
      .setOrigin(0.5)
      .setDepth(depth + 3)
      .setAlpha(0);
  }

  layout(l: Layout): void {
    this.layoutRef = l;
  }

  /**
   * Fase 1: mostra TODAS as linhas vencedoras ao mesmo tempo (brilho, pulso, partículas, valor).
   * Resolve ao fim da fase; em seguida o chamador pode iniciar o ciclo linha a linha.
   */
  showAll(result: SpinResult, quick: boolean): Promise<void> {
    this.clear();
    const wins = result.lineWins;
    const winning = new Set<string>();
    for (const w of wins) for (const p of w.positions) winning.add(`${p.reel}:${p.row}`);
    if (result.scatterWin) for (const p of result.scatterWin.positions) winning.add(`${p.reel}:${p.row}`);
    if (winning.size === 0) return Promise.resolve();

    this.dimOthers(winning);
    this.drawLines(wins.map((w) => w.lineIndex));
    this.pulseLinesGraphic();
    for (const key of winning) {
      const [reel, row] = key.split(':').map(Number);
      this.highlightSymbol(reel, row);
      const c = this.reelSet.reels[reel].rowCenter(row);
      this.sparks.explode(quick ? 6 : 14, c.x, c.y);
    }

    if (wins.length > 1) this.audio.play('winSmall');
    else this.audio.play('winLine');
    if (result.totalWin >= result.bet * 3) {
      const c = this.layoutRef.center;
      this.coins.explode(quick ? 10 : 22, c.x, c.y + this.layoutRef.reels[0].height * 0.4);
      this.audio.play('coins', { volume: 0.7 });
    }
    if (result.tier === 'normal') this.showPopup(result.totalWin, quick);

    return new Promise((resolve) => {
      this.scene.time.delayedCall(quick ? 420 : 1150, resolve);
    });
  }

  /** Fase 2: alterna entre as linhas vencedoras até `clear()` ser chamado. */
  startCycle(result: SpinResult): void {
    const wins = result.lineWins;
    if (wins.length <= 1) return;
    let i = 0;
    const step = () => {
      const w = wins[i % wins.length];
      this.drawLines([w.lineIndex]);
      this.pulseLinesGraphic();
      const winning = new Set(w.positions.map((p) => `${p.reel}:${p.row}`));
      this.dimOthers(winning);
      this.killSymbolTweens();
      for (const p of w.positions) this.highlightSymbol(p.reel, p.row);
      this.showLineLabel(w);
      i += 1;
    };
    step();
    this.cycleTimer = this.scene.time.addEvent({ delay: 1100, loop: true, callback: step });
  }

  clear(): void {
    this.cycleTimer?.remove(false);
    this.cycleTimer = undefined;
    this.killSymbolTweens();
    this.scene.tweens.killTweensOf(this.lines);
    this.lines.clear().setAlpha(1);
    this.lineLabel.setAlpha(0);
    this.reelSet.clearPresentation();
    this.popup?.destroy();
    this.popup = undefined;
  }

  // ------------------------------------------------------------------ interno

  private killSymbolTweens(): void {
    for (const t of this.activeTweens) t.stop();
    this.activeTweens = [];
    for (const reel of this.reelSet.reels) {
      for (let row = 0; row < 3; row += 1) {
        reel.getSymbolSprite(row).setScale(reel.symbolBaseScale).setAngle(0);
        reel.setRowGlow(row, 0);
      }
    }
  }

  private dimOthers(winning: Set<string>): void {
    this.reelSet.reels.forEach((reel, r) => {
      for (let row = 0; row < 3; row += 1) reel.setRowDim(row, !winning.has(`${r}:${row}`));
    });
  }

  private highlightSymbol(reel: number, row: number): void {
    const r = this.reelSet.reels[reel];
    const sprite = r.getSymbolSprite(row);
    const base = r.symbolBaseScale;
    r.setRowGlow(row, 0.9);
    this.activeTweens.push(
      this.scene.tweens.add({ targets: sprite, scale: { from: base, to: base * 1.14 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.scene.tweens.add({ targets: sprite, angle: { from: -3, to: 3 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.scene.tweens.add({ targets: r.glows[row], alpha: { from: 0.95, to: 0.45 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    );
  }

  private drawLines(lineIndexes: number[]): void {
    const g = this.lines;
    g.clear();
    const l = this.layoutRef;
    const left = l.reels[0].x - l.reels[0].width / 2 - 8;
    const right = l.reels[2].x + l.reels[2].width / 2 + 8;
    for (const li of lineIndexes) {
      const line = this.paylines[li];
      const color = LINE_COLORS[li % LINE_COLORS.length];
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      pts.push({ x: left, y: this.rowY(0, line[0]) });
      line.forEach((row, reel) => pts.push(this.reelSet.reels[reel].rowCenter(row)));
      pts.push({ x: right, y: this.rowY(2, line[2]) });
      // três traços: sombra escura, cor, núcleo claro
      for (const [width, c, alpha] of [
        [22, 0x1a0a22, 0.55],
        [12, color, 0.95],
        [4, 0xffffff, 0.9],
      ] as const) {
        g.lineStyle(width, c, alpha);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
        g.strokePath();
      }
      // marcadores nas pontas
      g.fillStyle(color, 1);
      g.fillCircle(left, pts[0].y, 11);
      g.fillCircle(right, pts[pts.length - 1].y, 11);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(left, pts[0].y, 5);
      g.fillCircle(right, pts[pts.length - 1].y, 5);
    }
  }

  private rowY(reel: number, row: number): number {
    return this.reelSet.reels[reel].rowCenter(row).y;
  }

  private pulseLinesGraphic(): void {
    this.scene.tweens.killTweensOf(this.lines);
    this.lines.setAlpha(1);
    this.scene.tweens.add({ targets: this.lines, alpha: { from: 1, to: 0.55 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private showLineLabel(w: LineWin): void {
    const l = this.layoutRef;
    this.lineLabel.setText(`LINHA ${w.lineIndex + 1}  ·  ${w.count}x  ·  ${formatCredits(w.amount)}`);
    this.lineLabel.setPosition(l.frame.x, l.reels[0].top - 26 * (l.frame.scale));
    this.lineLabel.setFontSize(Math.round(24 * Math.max(0.8, l.frame.scale)));
    this.scene.tweens.killTweensOf(this.lineLabel);
    this.lineLabel.setAlpha(0).setScale(0.8);
    this.scene.tweens.add({ targets: this.lineLabel, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private showPopup(amount: number, quick: boolean): void {
    this.popup?.destroy();
    const l = this.layoutRef;
    const c = this.scene.add.container(l.center.x, l.center.y).setDepth(this.lines.depth + 4);
    const glow = this.scene.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setAlpha(0.8).setDisplaySize(620, 320);
    const text = this.scene.add.text(0, 0, `+ ${formatCredits(amount)}`, titleStyle(Math.round(92 * Math.max(0.7, l.frame.scale)))).setOrigin(0.5);
    applyGoldGradient(text);
    c.add([glow, text]);
    this.popup = c;
    c.setScale(0.3).setAlpha(0);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: quick ? 180 : 320, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: c,
      y: l.center.y - 70,
      alpha: 0,
      delay: quick ? 500 : 1300,
      duration: quick ? 300 : 500,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.popup === c) this.popup = undefined;
        c.destroy();
      },
    });
  }

  /** Posições vencedoras (para a antecipação do bônus etc.). */
  static positionsOf(result: SpinResult): Position[] {
    const out: Position[] = [];
    for (const w of result.lineWins) out.push(...w.positions);
    if (result.scatterWin) out.push(...result.scatterWin.positions);
    return out;
  }
}
