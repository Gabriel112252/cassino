import Phaser from 'phaser';
import { COLORS, uiStyle } from './textStyles';

export interface IconButtonOptions {
  texture: string;
  /** largura desejada em unidades do jogo (altura proporcional) */
  width: number;
  onClick: () => void;
  /** texto sobreposto (ex.: contador do AUTO) */
  label?: string;
  labelSize?: number;
  /** brilho de "ativo" (ex.: TURBO ligado) */
  activeGlow?: boolean;
  tooltip?: string;
}

/**
 * Botão de imagem com estados animados: hover (brilho), pressionado (escala), desabilitado e ativo.
 * Usa um glow aditivo atrás da imagem para destacar o estado ativo sem precisar de texturas extras.
 */
export class IconButton extends Phaser.GameObjects.Container {
  readonly image: Phaser.GameObjects.Image;
  readonly glow: Phaser.GameObjects.Image;
  readonly label?: Phaser.GameObjects.Text;
  private baseScale = 1;
  private enabledState = true;
  private activeState = false;
  private glowTween?: Phaser.Tweens.Tween;
  private readonly onClick: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, options: IconButtonOptions) {
    super(scene, x, y);
    this.onClick = options.onClick;

    this.glow = scene.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.gold).setAlpha(0);
    this.image = scene.add.image(0, 0, options.texture);
    this.baseScale = options.width / this.image.width;
    this.image.setScale(this.baseScale);
    this.glow.setDisplaySize(options.width * 1.9, this.image.displayHeight * 2.2);
    this.add([this.glow, this.image]);

    if (options.label !== undefined) {
      this.label = scene.add
        .text(0, 0, options.label, uiStyle(options.labelSize ?? 28, { color: '#ffffff', stroke: '#2a1404', strokeThickness: 4 }))
        .setOrigin(0.5);
      this.add(this.label);
    }

    const hit = new Phaser.Geom.Rectangle(-this.image.displayWidth / 2, -this.image.displayHeight / 2, this.image.displayWidth, this.image.displayHeight);
    this.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';

    this.on('pointerover', () => this.enabledState && this.hover(true));
    this.on('pointerout', () => this.hover(false));
    this.on('pointerdown', () => {
      if (!this.enabledState) return;
      this.scene.tweens.add({ targets: this.image, scale: this.baseScale * 0.92, duration: 70, ease: 'Quad.easeOut' });
    });
    this.on('pointerup', () => {
      if (!this.enabledState) return;
      this.scene.tweens.add({ targets: this.image, scale: this.baseScale * 1.04, duration: 110, ease: 'Back.easeOut', yoyo: true, onComplete: () => this.image.setScale(this.baseScale) });
      this.onClick();
    });
    this.on('pointerupoutside', () => this.image.setScale(this.baseScale));

    scene.add.existing(this);
  }

  private hover(on: boolean): void {
    if (this.activeState) return;
    this.scene.tweens.add({ targets: this.glow, alpha: on ? 0.45 : 0, duration: 120 });
  }

  setEnabled(enabled: boolean): this {
    this.enabledState = enabled;
    this.image.setAlpha(enabled ? 1 : 0.5);
    this.image.setTint(enabled ? 0xffffff : 0x9a9a9a);
    if (this.label) this.label.setAlpha(enabled ? 1 : 0.6);
    return this;
  }

  get isEnabled(): boolean {
    return this.enabledState;
  }

  setHighlighted(active: boolean): this {
    this.activeState = active;
    this.glowTween?.stop();
    this.glowTween = undefined;
    if (active) {
      this.glow.setAlpha(0.7);
      this.glowTween = this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.75, to: 0.3 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.image.setTint(0xffffff);
    } else {
      this.glow.setAlpha(0);
    }
    return this;
  }

  setLabel(text: string): this {
    this.label?.setText(text);
    return this;
  }

  /** Redimensiona o botão (usado no relayout responsivo). */
  resize(width: number): this {
    this.baseScale = width / this.image.width;
    this.image.setScale(this.baseScale);
    this.glow.setDisplaySize(width * 1.9, this.image.displayHeight * 2.2);
    const hit = this.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    if (hit) hit.setTo(-this.image.displayWidth / 2, -this.image.displayHeight / 2, this.image.displayWidth, this.image.displayHeight);
    return this;
  }
}

export interface TextButtonOptions {
  label: string;
  width: number;
  height?: number;
  onClick: () => void;
  variant?: 'gold' | 'dark' | 'green';
  fontSize?: number;
}

/** Botão desenhado por código (pílula dourada ou escura) para modais e diálogos. */
export class TextButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly opts: Required<Omit<TextButtonOptions, 'onClick'>> & { onClick: () => void };

  constructor(scene: Phaser.Scene, x: number, y: number, options: TextButtonOptions) {
    super(scene, x, y);
    this.opts = { height: 72, variant: 'gold', fontSize: 28, ...options };
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, this.opts.label, uiStyle(this.opts.fontSize, { color: this.opts.variant === 'gold' ? '#3a1d08' : '#fff3d6', fontStyle: '800' }))
      .setOrigin(0.5);
    this.add([this.bg, this.text]);
    this.draw(false);
    // Container com setSize: o teste de clique soma displayOrigin (metade do tamanho), portanto a
    // área precisa ser (0, 0, w, h) para cobrir exatamente o botão desenhado centrado na origem.
    this.setSize(this.opts.width, this.opts.height);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.opts.width, this.opts.height), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerover', () => this.draw(true));
    this.on('pointerout', () => this.draw(false));
    this.on('pointerdown', () => this.setScale(0.96));
    this.on('pointerup', () => {
      this.setScale(1);
      this.opts.onClick();
    });
    this.on('pointerupoutside', () => this.setScale(1));
    scene.add.existing(this);
  }

  private draw(hover: boolean): void {
    const { width, height, variant } = this.opts;
    const g = this.bg;
    g.clear();
    const r = height / 2;
    if (variant === 'gold') {
      g.fillStyle(hover ? 0xffe27a : 0xf3b63c, 1);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, r);
      g.lineStyle(4, 0x8a4f06, 1);
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, r);
      g.fillStyle(0xfff4c2, 0.55);
      g.fillRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, height * 0.32, r);
    } else if (variant === 'green') {
      g.fillStyle(hover ? 0x4ad66a : 0x2f9f45, 1);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, r);
      g.lineStyle(4, 0xd9a338, 1);
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, r);
    } else {
      g.fillStyle(hover ? 0x4a2a5a : 0x2a1636, 1);
      g.fillRoundedRect(-width / 2, -height / 2, width, height, r);
      g.lineStyle(3, 0xc8923a, 1);
      g.strokeRoundedRect(-width / 2, -height / 2, width, height, r);
    }
  }

  setLabel(label: string): this {
    this.text.setText(label);
    return this;
  }
}
