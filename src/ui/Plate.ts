import Phaser from 'phaser';
import { COLORS, applyGoldGradient, numberStyle, uiStyle } from './textStyles';

export interface PlateOptions {
  width: number;
  height: number;
  label: string;
  value: string;
  valueSize?: number;
  labelSize?: number;
  /** cor do valor: 'gold' (padrão) ou 'white' */
  valueColor?: 'gold' | 'white' | 'green';
  /** ícone opcional à esquerda (textura) */
  icon?: string;
}

/** Desenha uma placa estilo HUD (fundo escuro, borda dourada, rebaixo) com um rótulo e um valor. */
export function drawPlate(g: Phaser.GameObjects.Graphics, width: number, height: number, radius = 18): void {
  g.clear();
  const x = -width / 2;
  const y = -height / 2;
  // sombra
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(x + 2, y + 5, width, height, radius);
  // borda externa dourada
  g.fillStyle(0xd9a338, 1);
  g.fillRoundedRect(x, y, width, height, radius);
  g.fillStyle(0x7a4406, 1);
  g.fillRoundedRect(x + 3, y + 3, width - 6, height - 6, radius - 2);
  // interior escuro com leve gradiente simulado
  g.fillStyle(0x1b0e22, 1);
  g.fillRoundedRect(x + 6, y + 6, width - 12, height - 12, radius - 4);
  g.fillStyle(0x2d1a36, 1);
  g.fillRoundedRect(x + 6, y + 6, width - 12, (height - 12) * 0.5, { tl: radius - 4, tr: radius - 4, bl: 0, br: 0 });
  // brilho superior
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(x + 10, y + 8, width - 20, 6, 3);
}

export class Plate extends Phaser.GameObjects.Container {
  readonly bg: Phaser.GameObjects.Graphics;
  readonly labelText: Phaser.GameObjects.Text;
  readonly valueText: Phaser.GameObjects.Text;
  readonly icon?: Phaser.GameObjects.Image;
  private opts: PlateOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PlateOptions) {
    super(scene, x, y);
    this.opts = options;
    this.bg = scene.add.graphics();
    this.labelText = scene.add.text(0, 0, options.label, uiStyle(options.labelSize ?? 20, { color: '#d9c8a2', fontStyle: '700' })).setOrigin(0.5, 0);
    this.valueText = scene.add.text(0, 0, options.value, numberStyle(options.valueSize ?? 40)).setOrigin(0.5, 0.5);
    this.add([this.bg, this.labelText, this.valueText]);
    if (options.icon) {
      this.icon = scene.add.image(0, 0, options.icon);
      this.add(this.icon);
    }
    this.resize(options.width, options.height);
    scene.add.existing(this);
  }

  resize(width: number, height: number): void {
    this.opts.width = width;
    this.opts.height = height;
    drawPlate(this.bg, width, height);
    const hasLabel = this.opts.label.length > 0;
    const labelSize = this.opts.labelSize ?? Math.round(height * 0.2);
    const valueSize = this.opts.valueSize ?? Math.round(height * 0.42);
    this.labelText.setFontSize(labelSize).setPosition(0, -height / 2 + 10);
    this.valueText.setFontSize(valueSize).setPosition(0, hasLabel ? height * 0.18 : 0);
    this.applyValueColor();
    if (this.icon) {
      this.icon.setDisplaySize(height * 0.62, height * 0.62).setPosition(-width / 2 + height * 0.5, 0);
    }
  }

  setValue(value: string): this {
    if (this.valueText.text !== value) {
      this.valueText.setText(value);
      this.applyValueColor();
    }
    return this;
  }

  setLabel(label: string): this {
    this.labelText.setText(label);
    return this;
  }

  /** Pequeno "pulso" ao atualizar o valor. */
  pulse(): void {
    this.scene.tweens.add({ targets: this.valueText, scale: { from: 1.18, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }

  private applyValueColor(): void {
    const color = this.opts.valueColor ?? 'gold';
    if (color === 'gold') applyGoldGradient(this.valueText);
    else if (color === 'green') this.valueText.setColor('#7dff8f');
    else this.valueText.setColor('#fff3d6');
  }
}

/** Placa hexagonal (estilo "GIROS GRÁTIS" / "MULTIPLICADOR") com título e valor grande. */
export class Plaque extends Phaser.GameObjects.Container {
  readonly bg: Phaser.GameObjects.Graphics;
  readonly glow: Phaser.GameObjects.Image;
  readonly titleText: Phaser.GameObjects.Text;
  readonly valueText: Phaser.GameObjects.Text;
  private plaqueW: number;
  private plaqueH: number;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, title: string, value: string) {
    super(scene, x, y);
    this.plaqueW = width;
    this.plaqueH = height;
    this.glow = scene.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.gold).setAlpha(0);
    this.bg = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, title, uiStyle(22, { color: '#ffd978', fontStyle: '800', align: 'center' })).setOrigin(0.5);
    this.valueText = scene.add.text(0, 0, value, numberStyle(54)).setOrigin(0.5);
    this.add([this.glow, this.bg, this.titleText, this.valueText]);
    this.resize(width, height);
    scene.add.existing(this);
  }

  resize(width: number, height: number): void {
    this.plaqueW = width;
    this.plaqueH = height;
    const g = this.bg;
    g.clear();
    const hex = hexPoints(width, height);
    g.fillStyle(0x000000, 0.4);
    g.fillPoints(hex.map((p) => ({ x: p.x + 3, y: p.y + 6 })), true);
    g.fillStyle(0xd9a338, 1);
    g.fillPoints(hex, true);
    g.fillStyle(0x6d3c06, 1);
    g.fillPoints(hexPoints(width - 8, height - 8), true);
    g.fillStyle(0x1b0e22, 1);
    g.fillPoints(hexPoints(width - 16, height - 16), true);
    g.fillStyle(0x3a1d4a, 0.9);
    g.fillPoints(hexPoints(width - 16, height - 16).map((p) => ({ x: p.x, y: Math.min(p.y, 0) })), true);
    g.lineStyle(2, 0xffe08a, 0.35);
    g.strokePoints(hexPoints(width - 22, height - 22), true);
    this.glow.setDisplaySize(width * 1.8, height * 1.8);
    this.titleText.setFontSize(Math.round(height * 0.15)).setPosition(0, -height * 0.22).setWordWrapWidth(width * 0.8);
    this.valueText.setPosition(0, height * 0.14);
    this.fitValue();
    applyGoldGradient(this.valueText);
  }

  setValue(value: string, animate = true): this {
    if (this.valueText.text !== value) {
      this.valueText.setText(value);
      this.fitValue();
      applyGoldGradient(this.valueText);
      if (animate) this.scene.tweens.add({ targets: this.valueText, scale: { from: 1.3, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    }
    return this;
  }

  /** Reduz a fonte do valor quando o texto é largo demais para a placa (ex.: "500.000"). */
  private fitValue(): void {
    const base = Math.round(this.plaqueH * 0.36);
    this.valueText.setFontSize(base);
    const max = this.plaqueW * 0.78;
    if (this.valueText.width > max) this.valueText.setFontSize(Math.max(18, Math.floor((base * max) / this.valueText.width)));
  }

  setTitle(title: string): this {
    this.titleText.setText(title);
    return this;
  }

  setHighlighted(on: boolean): this {
    this.glowTween?.stop();
    this.glowTween = undefined;
    if (on) {
      this.glowTween = this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.75, to: 0.25 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.glow.setAlpha(0);
    }
    return this;
  }

  get plaqueWidth(): number {
    return this.plaqueW;
  }

  get plaqueHeight(): number {
    return this.plaqueH;
  }
}

function hexPoints(width: number, height: number): Phaser.Types.Math.Vector2Like[] {
  const w = width / 2;
  const h = height / 2;
  const cut = Math.min(w, h) * 0.45;
  return [
    { x: -w + cut, y: -h },
    { x: w - cut, y: -h },
    { x: w, y: 0 },
    { x: w - cut, y: h },
    { x: -w + cut, y: h },
    { x: -w, y: 0 },
  ];
}
