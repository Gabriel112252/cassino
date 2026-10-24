import Phaser from 'phaser';
import type { WinTier } from '@game/core/types';
import { CounterText } from '@ui/CounterText';
import { applyGoldGradient, titleStyle, uiStyle } from '@ui/textStyles';
import type { AudioManager } from '@audio/AudioManager';

/**
 * Tela de BIG WIN / MEGA WIN: escurece o jogo, raios girando, título com "pop", contador rolando
 * com som, chuva de moedas, tremor de câmera. Toque para acelerar; fecha sozinha ao terminar.
 */
export class BigWinOverlay {
  private active = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioManager,
    private readonly depth: number,
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  show(tier: WinTier, amount: number): Promise<void> {
    if (tier !== 'big' && tier !== 'mega') return Promise.resolve();
    this.active = true;
    const scene = this.scene;
    const { width: W, height: H } = scene.scale;
    const mega = tier === 'mega';
    const container = scene.add.container(0, 0).setDepth(this.depth);
    const tweens: Phaser.Tweens.Tween[] = [];

    const backdrop = scene.add.rectangle(0, 0, W, H, 0x0a0412, 0.72).setOrigin(0).setInteractive();
    container.add(backdrop);

    // raios girando atrás do título
    const rays = scene.add.container(W / 2, H * 0.42);
    for (let i = 0; i < 10; i += 1) {
      const ray = scene.add.image(0, 0, 'fx-ray').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(mega ? 0xff9ad8 : 0xffd27a).setAlpha(0.35);
      ray.setDisplaySize(140, Math.max(W, H) * 0.7).setAngle(i * 36);
      rays.add(ray);
    }
    container.add(rays);
    tweens.push(scene.tweens.add({ targets: rays, angle: 360, duration: mega ? 9000 : 12000, repeat: -1 }));

    const flare = scene.add.image(W / 2, H * 0.42, 'jg-fx-golden-flare').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(900, 900).setAlpha(0.9);
    container.add(flare);
    tweens.push(scene.tweens.add({ targets: flare, scale: '*=1.15', alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));

    const title = scene.add.image(W / 2, H * 0.36, mega ? 'jg-fx-megawin' : 'jg-fx-bigwin');
    const titleScale = Math.min(1.9, (W * 0.6) / title.width, (H * 0.32) / title.height);
    title.setScale(0);
    container.add(title);
    tweens.push(scene.tweens.add({ targets: title, scale: titleScale, duration: 520, ease: 'Back.easeOut' }));
    tweens.push(scene.tweens.add({ targets: title, scale: titleScale * 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600 }));

    const amountText = scene.add.text(W / 2, H * 0.58, '0,00', titleStyle(Math.round(Math.min(150, W * 0.09)))).setOrigin(0.5);
    container.add(amountText);
    const counter = new CounterText(scene, amountText, 0, () => applyGoldGradient(amountText));
    const hint = scene.add.text(W / 2, H * 0.7, 'toque para continuar', uiStyle(26, { color: '#d9c8a2' })).setOrigin(0.5).setAlpha(0);
    container.add(hint);
    tweens.push(scene.tweens.add({ targets: hint, alpha: 0.9, duration: 500, delay: 1200 }));

    // chuva de moedas (frames da tira de moedas)
    const coins = scene.add.particles(0, 0, 'jg-coin-sheet', {
      frame: [0, 1, 2, 3, 4, 5, 6],
      x: { min: W * 0.15, max: W * 0.85 },
      y: H + 60,
      speedY: { min: -1500, max: -900 },
      speedX: { min: -220, max: 220 },
      lifespan: { min: 1800, max: 2600 },
      scale: { start: 1.0, end: 0.7 },
      rotate: { min: -200, max: 200 },
      gravityY: 1100,
      frequency: mega ? 22 : 45,
      emitting: true,
    });
    container.add(coins);

    this.audio.duckMusic(0.35);
    this.audio.play(mega ? 'megaWin' : 'bigWin');
    this.audio.play('countLoop');
    scene.cameras.main.shake(mega ? 700 : 400, mega ? 0.012 : 0.006);

    const countMs = mega ? 3400 : 2400;
    let finished = false;
    let closeTimer: Phaser.Time.TimerEvent | undefined;
    return new Promise<void>((resolve) => {
      const finish = () => {
        if (finished) return;
        finished = true;
        closeTimer?.remove(false);
        this.audio.stop('countLoop');
        this.audio.duckMusic(1, 600);
        coins.stop();
        scene.tweens.add({
          targets: container,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            for (const t of tweens) t.stop();
            container.destroy();
            this.active = false;
            resolve();
          },
        });
      };
      const onCounted = () => {
        this.audio.stop('countLoop');
        this.audio.play('coins');
        if (finished) return;
        tweens.push(scene.tweens.add({ targets: amountText, scale: { from: 1.25, to: 1 }, duration: 500, ease: 'Elastic.easeOut' }));
        closeTimer = scene.time.delayedCall(mega ? 2600 : 2000, finish);
      };
      void counter.animateTo(amount, countMs, 'Sine.easeOut').then(onCounted);
      backdrop.on('pointerup', () => {
        if (counter.isAnimating) counter.finish();
        else finish();
      });
    });
  }
}
