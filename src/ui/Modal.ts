import Phaser from 'phaser';
import { COLORS_CSS, makeTitle, uiStyle } from './textStyles';

export interface ModalOptions {
  title: string;
  width: number;
  height: number;
  closeOnBackdrop?: boolean;
  showClose?: boolean;
  depth?: number;
  onClose?: () => void;
}

/**
 * Base de todos os painéis modais do jogo (pagamentos, histórico, configurações, tutorial...).
 * O conteúdo é desenhado em coordenadas de projeto (width x height) e o painel inteiro é
 * escalado para caber na tela, em qualquer orientação.
 */
export class Modal extends Phaser.GameObjects.Container {
  readonly backdrop: Phaser.GameObjects.Rectangle;
  readonly panel: Phaser.GameObjects.Container;
  readonly content: Phaser.GameObjects.Container;
  protected readonly opts: Required<Omit<ModalOptions, 'onClose'>> & { onClose?: () => void };
  private closing = false;
  private readonly onResize: () => void;

  constructor(scene: Phaser.Scene, options: ModalOptions) {
    super(scene, 0, 0);
    this.opts = { closeOnBackdrop: true, showClose: true, depth: 500, ...options };
    this.setDepth(this.opts.depth);

    const { width: sw, height: sh } = scene.scale;
    this.backdrop = scene.add.rectangle(0, 0, sw, sh, 0x05020a, 0.72).setOrigin(0).setInteractive();
    this.backdrop.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.opts.closeOnBackdrop) void this.close();
    });
    this.backdrop.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());

    this.panel = scene.add.container(0, 0);
    const bg = scene.add.graphics();
    this.drawPanel(bg, this.opts.width, this.opts.height);
    // bloqueia cliques no painel (não fecha ao clicar dentro)
    const blocker = scene.add.rectangle(0, 0, this.opts.width, this.opts.height, 0xffffff, 0.001).setInteractive();
    blocker.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    blocker.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    const title = makeTitle(scene, 0, -this.opts.height / 2 + 46, this.opts.title, 40);
    this.content = scene.add.container(0, 0);
    this.panel.add([blocker, bg, title, this.content]);

    if (this.opts.showClose) {
      const closeBtn = this.makeCloseButton();
      closeBtn.setPosition(this.opts.width / 2 - 38, -this.opts.height / 2 + 38);
      this.panel.add(closeBtn);
    }

    this.add([this.backdrop, this.panel]);
    scene.add.existing(this);

    this.onResize = () => this.layout();
    scene.scale.on('resize', this.onResize);
    this.once('destroy', () => scene.scale.off('resize', this.onResize));
    this.layout();

    this.panel.setAlpha(0).setScale(0.9);
    this.backdrop.setAlpha(0);
    scene.tweens.add({ targets: this.backdrop, alpha: 0.72, duration: 180 });
    scene.tweens.add({ targets: this.panel, alpha: 1, scale: this.fitScale(), duration: 240, ease: 'Back.easeOut' });
  }

  private fitScale(): number {
    const { width: sw, height: sh } = this.scene.scale;
    // no retrato (celular) os painéis podem crescer um pouco para o texto ficar legível
    const maxScale = sh > sw ? 1.18 : 1;
    return Math.min(maxScale, (sw - 40) / this.opts.width, (sh - 40) / this.opts.height);
  }

  layout(): void {
    const { width: sw, height: sh } = this.scene.scale;
    this.backdrop.setSize(sw, sh).setDisplaySize(sw, sh);
    this.panel.setPosition(sw / 2, sh / 2);
    if (!this.closing) this.panel.setScale(this.fitScale());
  }

  private drawPanel(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 26);
    g.fillStyle(0xd9a338, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.fillStyle(0x6d3c06, 1);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 23);
    g.fillStyle(0x1b0e22, 0.98);
    g.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 20);
    // faixa de título
    g.fillStyle(0x3a1d4a, 0.9);
    g.fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, 76, { tl: 20, tr: 20, bl: 0, br: 0 });
    g.lineStyle(2, 0xffe08a, 0.35);
    g.lineBetween(-w / 2 + 30, -h / 2 + 84, w / 2 - 30, -h / 2 + 84);
  }

  private makeCloseButton(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    g.fillStyle(0x7a1f1f, 1);
    g.fillCircle(0, 0, 26);
    g.lineStyle(3, 0xffc83a, 1);
    g.strokeCircle(0, 0, 26);
    g.lineStyle(5, 0xfff3d6, 1);
    g.lineBetween(-9, -9, 9, 9);
    g.lineBetween(-9, 9, 9, -9);
    c.add(g);
    c.setSize(60, 60);
    c.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
    if (c.input) c.input.cursor = 'pointer';
    c.on('pointerover', () => c.setScale(1.1));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      void this.close();
    });
    return c;
  }

  /** Texto auxiliar com quebra automática dentro do painel. */
  protected paragraph(x: number, y: number, text: string, width: number, size = 22, color: string = COLORS_CSS.text): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, text, uiStyle(size, { color, fontStyle: '600', wordWrap: { width }, lineSpacing: 6 })).setOrigin(0, 0);
    this.content.add(t);
    return t;
  }

  close(): Promise<void> {
    if (this.closing) return Promise.resolve();
    this.closing = true;
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this.backdrop, alpha: 0, duration: 160 });
      this.scene.tweens.add({
        targets: this.panel,
        alpha: 0,
        scale: this.panel.scale * 0.92,
        duration: 160,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.opts.onClose?.();
          this.destroy();
          resolve();
        },
      });
    });
  }
}
