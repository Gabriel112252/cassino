import Phaser from 'phaser';
import { formatCredits } from '@game/format';
import { applyGoldGradient, titleStyle, uiStyle } from '@ui/textStyles';
import type { AudioManager } from '@audio/AudioManager';
import type { AmbientFx } from './AmbientFx';

/**
 * Telas dos giros grátis: entrada (flash + baú abrindo + título), reacionamento e resumo final.
 * Todas fecham com toque ou após alguns segundos.
 */
export class FreeSpinsPresenter {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioManager,
    private readonly ambient: AmbientFx,
    private readonly depth: number,
  ) {
    if (!scene.anims.exists('jg-chest-open')) {
      scene.anims.create({
        key: 'jg-chest-open',
        frames: scene.anims.generateFrameNumbers('jg-chest-sheet', { frames: [0, 1, 2, 3, 4] }),
        frameRate: 9,
        repeat: 0,
      });
    }
  }

  showIntro(spins: number): Promise<void> {
    this.ambient.flash(600);
    this.audio.duckMusic(0.3);
    this.audio.play('bonusEnter');
    this.scene.cameras.main.shake(300, 0.005);
    return this.splash({
      title: 'GIROS GRÁTIS',
      subtitle: `${spins} GIROS COM MULTIPLICADOR CRESCENTE`,
      detail: 'Cada giro vencedor aumenta o multiplicador (até x10)',
      chest: true,
      autoCloseMs: 3200,
    });
  }

  showRetrigger(extra: number, remaining: number): Promise<void> {
    this.ambient.flash(350);
    this.audio.play('bonusEnter', { volume: 0.7 });
    return this.splash({
      title: `+${extra} GIROS`,
      subtitle: `${remaining} GIROS GRÁTIS RESTANTES`,
      detail: '',
      chest: true,
      autoCloseMs: 2200,
    });
  }

  showOutro(total: number, spinsPlayed: number): Promise<void> {
    this.audio.play(total > 0 ? 'winSmall' : 'click');
    return this.splash({
      title: 'FIM DOS GIROS GRÁTIS',
      subtitle: `TOTAL: ${formatCredits(total)}`,
      detail: `${spinsPlayed} giros jogados · créditos fictícios (demo)`,
      chest: false,
      autoCloseMs: 3200,
    }).then(() => this.audio.duckMusic(1, 800));
  }

  private splash(opts: { title: string; subtitle: string; detail: string; chest: boolean; autoCloseMs: number }): Promise<void> {
    const scene = this.scene;
    const { width: W, height: H } = scene.scale;
    const c = scene.add.container(0, 0).setDepth(this.depth);
    const tweens: Phaser.Tweens.Tween[] = [];
    const backdrop = scene.add.rectangle(0, 0, W, H, 0x12061e, 0.78).setOrigin(0).setInteractive();
    const flare = scene.add.image(W / 2, H * 0.45, 'jg-fx-purple-flare').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(W * 0.9, H * 0.9).setAlpha(0.9);
    tweens.push(scene.tweens.add({ targets: flare, scale: '*=1.12', alpha: 0.6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    const ring = scene.add.image(W / 2, H * 0.45, 'jg-fx-golden-ring').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(Math.min(W, H) * 0.7, Math.min(W, H) * 0.78).setAlpha(0.8);
    tweens.push(scene.tweens.add({ targets: ring, angle: 360, duration: 14000, repeat: -1 }));

    const titleSize = Math.round(Math.min(120, W * 0.085));
    const title = scene.add.text(W / 2, H * 0.32, opts.title, titleStyle(titleSize)).setOrigin(0.5).setScale(0);
    applyGoldGradient(title);
    const subtitle = scene.add.text(W / 2, H * 0.32 + titleSize * 0.95, opts.subtitle, uiStyle(Math.round(titleSize * 0.36), { color: '#fff3d6', stroke: '#2a1404', strokeThickness: 6, fontStyle: '800', align: 'center', wordWrap: { width: W * 0.85 } })).setOrigin(0.5).setAlpha(0);
    const detail = scene.add.text(W / 2, H * 0.32 + titleSize * 1.5, opts.detail, uiStyle(Math.round(titleSize * 0.24), { color: '#d9c8a2', align: 'center', wordWrap: { width: W * 0.8 } })).setOrigin(0.5).setAlpha(0);
    c.add([backdrop, flare, ring, title, subtitle, detail]);

    const timers: Phaser.Time.TimerEvent[] = [];
    if (opts.chest) {
      const chest = scene.add.sprite(W / 2, H * 0.62, 'jg-chest-sheet', 0);
      const chestScale = Math.min(2.2, (H * 0.26) / chest.height);
      chest.setScale(chestScale * 0.6).setAlpha(0);
      c.add(chest);
      tweens.push(
        scene.tweens.add({
          targets: chest,
          alpha: 1,
          scale: chestScale,
          duration: 500,
          ease: 'Back.easeOut',
          delay: 150,
          onComplete: () => {
            // o painel pode já ter sido fechado (toque/auto) — nunca animar um sprite destruído
            if (chest.active && chest.anims) chest.play('jg-chest-open');
          },
        }),
      );
      const sparks = scene.add.particles(W / 2, H * 0.6, 'fx-spark', {
        speed: { min: 120, max: 420 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 700, max: 1400 },
        scale: { start: 1, end: 0 },
        tint: [0xfff1b0, 0xffc83a, 0xd59bff],
        blendMode: Phaser.BlendModes.ADD,
        gravityY: 500,
        emitting: false,
      });
      c.add(sparks);
      timers.push(scene.time.delayedCall(700, () => { if (sparks.active) sparks.explode(60, W / 2, H * 0.6); }));
    }

    tweens.push(scene.tweens.add({ targets: title, scale: 1, duration: 600, ease: 'Back.easeOut' }));
    tweens.push(scene.tweens.add({ targets: title, scale: 1.04, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 700 }));
    tweens.push(scene.tweens.add({ targets: subtitle, alpha: 1, duration: 400, delay: 350 }));
    tweens.push(scene.tweens.add({ targets: detail, alpha: 1, duration: 400, delay: 600 }));

    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        for (const t of timers) t.remove(false);
        scene.tweens.add({
          targets: c,
          alpha: 0,
          duration: 350,
          onComplete: () => {
            for (const t of tweens) t.stop();
            c.destroy();
            resolve();
          },
        });
      };
      timers.push(scene.time.delayedCall(opts.autoCloseMs, finish));
      timers.push(scene.time.delayedCall(600, () => backdrop.on('pointerup', finish)));
    });
  }
}
