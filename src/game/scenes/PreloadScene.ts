import Phaser from 'phaser';
import { JG_IMAGES, JG_SPRITESHEETS } from '@games/jaguar-gold/assets';
import { SCENE_KEYS } from '@game/registry';
import { getServices } from '@game/services';
import { APP_CONFIG } from '@config/app.config';
import { uiStyle } from '@ui/textStyles';

/** Tela de carregamento com barra dourada; imagens via Phaser e áudio via Howler em paralelo. */
export class PreloadScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private imageProgress = 0;
  private audioDone = false;

  constructor() {
    super(SCENE_KEYS.preload);
  }

  preload(): void {
    this.tweens.setLagSmooth(2000, 2000);
    const { width, height } = this.scale;
    const bg = this.add.image(width / 2, height / 2, 'jg-bg-dim');
    bg.setScale(Math.max(width / 1600, height / 900));
    const glow = this.add.image(width / 2, height * 0.4, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setAlpha(0.5).setDisplaySize(900, 900);
    this.tweens.add({ targets: glow, alpha: 0.25, scale: '*=1.1', duration: 1200, yoyo: true, repeat: -1 });
    const logo = this.add.image(width / 2, height * 0.4, 'jg-logo').setScale(Math.min(1.1, width / 1200));
    this.tweens.add({ targets: logo, scale: logo.scale * 1.04, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.bar = this.add.graphics();
    this.percentText = this.add.text(width / 2, height * 0.64, 'Carregando… 0%', uiStyle(26, { color: '#fff3d6' })).setOrigin(0.5);
    this.add.text(width / 2, height * 0.72, APP_CONFIG.demoLabel, uiStyle(22, { color: '#ffd978', fontStyle: '800' })).setOrigin(0.5);
    this.add.text(width / 2, height * 0.76, 'Sem dinheiro real · Sem depósitos · Sem saques', uiStyle(18, { color: '#d9c8a2' })).setOrigin(0.5);

    for (const img of JG_IMAGES) {
      if (!this.textures.exists(img.key)) this.load.image(img.key, img.url);
    }
    for (const sheet of JG_SPRITESHEETS) {
      this.load.spritesheet(sheet.key, sheet.url, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    }

    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => {
      this.imageProgress = v;
      this.drawBar();
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn('[preload] falha ao carregar', file.key, file.src);
    });

    const services = getServices(this);
    void services.audio.load().then(() => {
      this.audioDone = true;
      this.drawBar();
      this.tryStart();
    });
  }

  create(): void {
    this.tryStart();
  }

  private started = false;

  private tryStart(): void {
    if (this.started || !this.audioDone || !this.load.isReady() || this.imageProgress < 1) return;
    this.started = true;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const target = hash.includes('lobby') ? SCENE_KEYS.lobby : SCENE_KEYS.jaguarGold;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(target));
  }

  private drawBar(): void {
    const { width, height } = this.scale;
    const progress = this.imageProgress * 0.85 + (this.audioDone ? 0.15 : 0);
    const w = Math.min(640, width * 0.7);
    const h = 26;
    const x = width / 2 - w / 2;
    const y = height * 0.58;
    const g = this.bar;
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 15);
    g.fillStyle(0x3a1d4a, 1);
    g.fillRoundedRect(x, y, w, h, 13);
    g.fillStyle(0xf3b63c, 1);
    g.fillRoundedRect(x, y, Math.max(26, w * progress), h, 13);
    g.fillStyle(0xfff4c2, 0.5);
    g.fillRoundedRect(x + 6, y + 4, Math.max(14, w * progress - 12), 8, 4);
    this.percentText.setText(`Carregando… ${Math.round(progress * 100)}%`);
  }
}
