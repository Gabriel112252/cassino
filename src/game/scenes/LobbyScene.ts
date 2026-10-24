import Phaser from 'phaser';
import { GAME_REGISTRY, SCENE_KEYS } from '@game/registry';
import { modeFor } from '@game/responsive';
import { getServices } from '@game/services';
import { formatCredits } from '@game/format';
import { APP_CONFIG } from '@config/app.config';
import { TextButton } from '@ui/IconButton';
import { makeTitle, uiStyle } from '@ui/textStyles';

/** Página inicial do cassino: lista os jogos do registro. Preparada para vários jogos. */
export class LobbyScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private resizeHandler?: () => void;

  constructor() {
    super(SCENE_KEYS.lobby);
  }

  create(): void {
    this.tweens.setLagSmooth(2000, 2000);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.build();
    this.resizeHandler = () => {
      this.root.destroy();
      this.build();
    };
    this.scale.on('resize', this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off('resize', this.resizeHandler);
    });
    this.input.on('pointerdown', () => {
      const s = getServices(this);
      s.audio.unlock();
      s.audio.playMusic();
    });
  }

  private build(): void {
    const { width: W, height: H } = this.scale;
    const portrait = modeFor(W, H) === 'portrait';
    this.root = this.add.container(0, 0);
    const bg = this.add.image(W / 2, H / 2, 'jg-bg-dim').setScale(Math.max(W / 1600, H / 900));
    const title = makeTitle(this, W / 2, portrait ? 150 : 110, 'CASSINO DEMO', portrait ? 84 : 96);
    const sub = this.add.text(W / 2, title.y + (portrait ? 70 : 78), APP_CONFIG.demoLabel + '  ·  sem dinheiro real', uiStyle(26, { color: '#ffd978', fontStyle: '800' })).setOrigin(0.5);
    const wallet = getServices(this).wallet;
    const balance = this.add.text(W / 2, sub.y + 44, `Saldo demo: ${formatCredits(wallet.balance)} créditos`, uiStyle(24, { color: '#fff3d6' })).setOrigin(0.5);
    this.root.add([bg, title, sub, balance]);

    const cardW = portrait ? Math.min(W * 0.84, 760) : Math.min(520, (W - 160) / 3);
    const cardH = portrait ? 300 : 560;
    const games = GAME_REGISTRY;
    games.forEach((g, i) => {
      const x = portrait ? W / 2 : W / 2 + (i - (games.length - 1) / 2) * (cardW + 40);
      const y = portrait ? balance.y + 80 + cardH / 2 + i * (cardH + 30) : H * 0.58;
      const card = this.add.container(x, y);
      const bgG = this.add.graphics();
      bgG.fillStyle(0x000000, 0.45);
      bgG.fillRoundedRect(-cardW / 2 + 6, -cardH / 2 + 10, cardW, cardH, 28);
      bgG.fillStyle(g.available ? 0xd9a338 : 0x5a4a3a, 1);
      bgG.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
      bgG.fillStyle(0x1b0e22, 1);
      bgG.fillRoundedRect(-cardW / 2 + 6, -cardH / 2 + 6, cardW - 12, cardH - 12, 24);
      card.add(bgG);
      if (g.available && g.coverTexture) {
        const glow = this.add.image(0, portrait ? -30 : -110, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setAlpha(0.6).setDisplaySize(cardW * 1.1, cardW * 1.1);
        const cover = this.add.image(0, portrait ? -40 : -120, g.coverTexture);
        cover.setScale(Math.min((cardW * 0.8) / cover.width, (portrait ? 150 : 240) / cover.height));
        this.tweens.add({ targets: cover, scale: cover.scale * 1.04, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        card.add([glow, cover]);
      } else {
        const q = this.add.text(0, portrait ? -50 : -120, '?', uiStyle(120, { color: '#5a4a3a', fontStyle: '900' })).setOrigin(0.5);
        card.add(q);
      }
      const name = this.add.text(0, portrait ? 60 : 60, g.title.toUpperCase(), uiStyle(portrait ? 30 : 34, { color: g.available ? '#ffd978' : '#8a7a6a', fontStyle: '900' })).setOrigin(0.5);
      const desc = this.add.text(0, portrait ? 98 : 108, g.subtitle, uiStyle(18, { color: '#d9c8a2', align: 'center', wordWrap: { width: cardW - 60 } })).setOrigin(0.5, 0);
      card.add([name, desc]);
      if (g.available) {
        const btn = new TextButton(this, 0, cardH / 2 - 60, {
          label: 'JOGAR',
          width: 260,
          height: 68,
          variant: 'green',
          fontSize: 28,
          onClick: () => {
            getServices(this).audio.play('click');
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(g.sceneKey));
          },
        });
        card.add(btn);
      } else {
        const soon = this.add.text(0, cardH / 2 - 60, 'EM BREVE', uiStyle(24, { color: '#8a7a6a', fontStyle: '800' })).setOrigin(0.5);
        card.add(soon);
      }
      this.root.add(card);
    });

    const footer = this.add.text(W / 2, H - 40, APP_CONFIG.disclaimer, uiStyle(15, { color: '#a8977a', align: 'center', wordWrap: { width: W * 0.85 } })).setOrigin(0.5, 1);
    this.root.add(footer);
  }
}
