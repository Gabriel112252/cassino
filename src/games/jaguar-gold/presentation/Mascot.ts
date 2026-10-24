import Phaser from 'phaser';
import type { Layout } from '../layout';

/**
 * Mascote: cabeça do jaguar dentro de um medalhão dourado (máscara circular esconde as bordas
 * irregulares dos quadros recortados). Respira em idle, ruge nas vitórias e faz a entrada animada.
 */
export class Mascot {
  readonly container: Phaser.GameObjects.Container;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly backing: Phaser.GameObjects.Graphics;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;
  private size = 200;
  private breathTween?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene, layout: Layout, depth: number) {
    this.container = scene.add.container(0, 0).setDepth(depth);
    this.glow = scene.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setAlpha(0.35);
    this.backing = scene.add.graphics();
    this.sprite = scene.add.sprite(0, 0, 'jg-mascot-sheet', 4);
    this.ring = scene.add.image(0, 0, 'jg-fx-golden-ring').setBlendMode(Phaser.BlendModes.ADD);
    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 }, false);
    this.sprite.setMask(this.maskGraphics.createGeometryMask());
    this.container.add([this.glow, this.backing, this.sprite, this.ring]);

    if (!scene.anims.exists('jg-mascot-roar')) {
      scene.anims.create({
        key: 'jg-mascot-roar',
        frames: scene.anims.generateFrameNumbers('jg-mascot-sheet', { frames: [0, 1, 2, 3, 4, 4, 4, 3, 2, 1, 0] }),
        frameRate: 12,
        repeat: 0,
      });
    }
    this.layout(layout);
    this.startBreathing();
  }

  layout(l: Layout): void {
    this.size = l.mascot.size;
    this.container.setPosition(l.mascot.x, l.mascot.y);
    const r = this.size / 2;
    this.backing.clear();
    this.backing.fillStyle(0x1b0e22, 1);
    this.backing.fillCircle(0, 0, r);
    this.backing.fillStyle(0x4a2a5a, 0.9);
    this.backing.fillCircle(0, -r * 0.1, r * 0.85);
    this.backing.lineStyle(Math.max(4, r * 0.12), 0xd9a338, 1);
    this.backing.strokeCircle(0, 0, r);
    this.sprite.setDisplaySize(this.size * 1.25, this.size);
    this.sprite.setPosition(this.size * 0.02, this.size * 0.05);
    this.ring.setDisplaySize(this.size * 1.35, this.size * 1.45);
    this.glow.setDisplaySize(this.size * 1.9, this.size * 1.9);
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillCircle(l.mascot.x, l.mascot.y, r - 2);
  }

  private startBreathing(): void {
    this.breathTween?.stop();
    this.container.setScale(1);
    this.breathTween = this.scene.tweens.add({
      targets: this.container,
      scale: { from: 1, to: 1.035 },
      angle: { from: -1.5, to: 1.5 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Entrada: surge do zero com "pop" e flare dourado. */
  enter(): void {
    this.breathTween?.stop();
    this.container.setScale(0).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 650,
      ease: 'Back.easeOut',
      delay: 150,
      onComplete: () => {
        this.roar();
        this.startBreathing();
      },
    });
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.35 }, duration: 900, delay: 300 });
  }

  roar(): void {
    if (!this.sprite.active || !this.sprite.anims) return;
    this.sprite.play('jg-mascot-roar');
    this.scene.tweens.add({ targets: this.ring, scale: '*=1.12', duration: 180, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Comemoração em vitórias grandes: ruge e o anel pulsa forte. */
  celebrate(): void {
    this.roar();
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.35 }, duration: 1200, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.container, scale: { from: 1.18, to: 1 }, duration: 600, ease: 'Elastic.easeOut' });
  }

  destroy(): void {
    this.breathTween?.stop();
    this.container.destroy();
    this.maskGraphics.destroy();
  }
}
