import Phaser from 'phaser';
import { detectQuality } from '@game/quality';
import type { Layout } from '../layout';

/**
 * Cenário vivo: fundo com respiração lenta, vinheta, névoa em camadas, vaga-lumes,
 * raios de luz do templo e tochas pulsando. Tudo reposicionado no relayout.
 */
export class AmbientFx {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly vignette: Phaser.GameObjects.Image;
  private readonly fogs: Phaser.GameObjects.Image[] = [];
  private readonly rays: Phaser.GameObjects.Image[] = [];
  private readonly torches: Phaser.GameObjects.Image[] = [];
  private readonly fireflies: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly bonusTint: Phaser.GameObjects.Rectangle;
  private readonly bonusFlare: Phaser.GameObjects.Image;
  private fogSpeeds: number[] = [];
  private width = 1920;
  private height = 1080;
  private bonusMode = false;

  constructor(private readonly scene: Phaser.Scene, layout: Layout) {
    const low = detectQuality() === 'low';
    this.bg = scene.add.image(0, 0, 'jg-bg').setDepth(0);
    scene.tweens.add({ targets: this.bg, scale: '*=1.035', duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.vignette = scene.add.image(0, 0, 'fx-vignette').setDepth(3).setAlpha(0.6);

    for (let i = 0; i < (low ? 2 : 4); i += 1) {
      const fog = scene.add
        .image(0, 0, 'fx-fog')
        .setDepth(2)
        .setBlendMode(Phaser.BlendModes.SCREEN)
        .setTint(0xcbb7ff)
        .setAlpha(0.1 + i * 0.03);
      this.fogs.push(fog);
      this.fogSpeeds.push((i % 2 === 0 ? 1 : -1) * (6 + i * 4));
    }

    for (let i = 0; i < (low ? 0 : 5); i += 1) {
      const ray = scene.add.image(0, 0, 'fx-ray').setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setAlpha(0.07);
      ray.setOrigin(0.5, 0);
      this.rays.push(ray);
      scene.tweens.add({
        targets: ray,
        angle: { from: -14 + i * 6, to: -8 + i * 6 },
        alpha: { from: 0.05, to: 0.12 },
        duration: 5000 + i * 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    for (let i = 0; i < 2; i += 1) {
      const torch = scene.add.image(0, 0, 'fx-glow-soft').setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a2e).setAlpha(0.3);
      this.torches.push(torch);
      scene.tweens.add({
        targets: torch,
        alpha: { from: 0.22, to: 0.42 },
        scale: { from: 0.95, to: 1.08 },
        duration: 380 + i * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.fireflies = scene.add.particles(0, 0, 'fx-firefly', {
      x: { min: 0, max: 1920 },
      y: { min: 0, max: 1080 },
      lifespan: { min: 4000, max: 7000 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -22, max: -4 },
      scale: { start: 0.8, end: 0.2 },
      // brilho que pulsa: alpha sobe e desce ao longo da vida da partícula
      alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.9 },
      tint: [0xfff4a0, 0xc8ff6e, 0xffd36e],
      frequency: low ? 700 : 260,
      blendMode: Phaser.BlendModes.ADD,
      emitting: true,
    });
    this.fireflies.setDepth(4);

    this.bonusTint = scene.add.rectangle(0, 0, 10, 10, 0x6a2fb0, 0).setOrigin(0).setDepth(3).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.bonusFlare = scene.add.image(0, 0, 'jg-fx-purple-flare').setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);

    this.layout(layout);
  }

  layout(l: Layout): void {
    this.width = l.width;
    this.height = l.height;
    this.bg.setPosition(l.bg.x, l.bg.y).setScale(l.bg.scale);
    this.vignette.setPosition(l.width / 2, l.height / 2).setDisplaySize(l.width, l.height);
    this.fogs.forEach((fog, i) => {
      fog.setPosition(((i + 0.5) * l.width) / this.fogs.length, l.height * (0.55 + (i % 2) * 0.25));
      fog.setDisplaySize(l.width * 0.9, l.height * 0.4);
    });
    this.rays.forEach((ray, i) => {
      ray.setPosition(l.width * (0.3 + i * 0.1), -20);
      ray.setDisplaySize(l.width * 0.12, l.height * 1.2);
    });
    this.torches[0].setPosition(l.width * 0.07, l.height * 0.74).setDisplaySize(l.width * 0.22, l.width * 0.22);
    this.torches[1].setPosition(l.width * 0.93, l.height * 0.74).setDisplaySize(l.width * 0.22, l.width * 0.22);
    this.fireflies.updateConfig({ x: { min: 0, max: l.width }, y: { min: l.height * 0.2, max: l.height } });
    this.bonusTint.setSize(l.width, l.height).setDisplaySize(l.width, l.height);
    this.bonusFlare.setPosition(l.frame.x, l.frame.y).setDisplaySize(l.frame.width * 1.5, l.frame.height * 1.9);
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.fogs.forEach((fog, i) => {
      fog.x += this.fogSpeeds[i] * dt;
      const half = fog.displayWidth / 2;
      if (fog.x > this.width + half) fog.x = -half;
      if (fog.x < -half) fog.x = this.width + half;
    });
  }

  /** Atmosfera dos giros grátis: tom roxo e flare pulsante atrás da moldura. */
  setBonusMode(on: boolean): void {
    if (this.bonusMode === on) return;
    this.bonusMode = on;
    this.scene.tweens.add({ targets: this.bonusTint, fillAlpha: on ? 0.35 : 0, duration: 800 });
    this.scene.tweens.killTweensOf(this.bonusFlare);
    if (on) {
      this.bonusFlare.setAlpha(0);
      this.scene.tweens.add({ targets: this.bonusFlare, alpha: { from: 0.35, to: 0.7 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      for (const fog of this.fogs) fog.setTint(0xd59bff);
    } else {
      this.scene.tweens.add({ targets: this.bonusFlare, alpha: 0, duration: 600 });
      for (const fog of this.fogs) fog.setTint(0xcbb7ff);
    }
  }

  /** Flash de luz branca (entrada no bônus / mega win). */
  flash(duration = 450, color = 0xffffff): void {
    const rect = this.scene.add.rectangle(0, 0, this.width, this.height, color, 1).setOrigin(0).setDepth(900).setAlpha(0.9);
    this.scene.tweens.add({ targets: rect, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => rect.destroy() });
  }
}
