import Phaser from 'phaser';
import type { FreeSpinsState } from '@game/core/GameSession';
import { formatCredits } from '@game/format';
import { CounterText } from '@ui/CounterText';
import { IconButton } from '@ui/IconButton';
import { Plaque, Plate } from '@ui/Plate';
import { COLORS, uiStyle } from '@ui/textStyles';
import type { Layout } from '../layout';

export interface HudCallbacks {
  onSpin: () => void;
  onBetMinus: () => void;
  onBetPlus: () => void;
  onAuto: () => void;
  onTurbo: () => void;
  onHelp: () => void;
  onHistory: () => void;
  onSound: () => void;
  onSettings: () => void;
  onHome: () => void;
}

/** Interface do jogo (placas, botões, placas laterais). Renderizada em Phaser, sem HTML. */
export class Hud {
  readonly credits: Plate;
  readonly lastWin: Plate;
  readonly betPlate: Plate;
  readonly plaqueFree: Plaque;
  readonly plaqueMult: Plaque;
  readonly demoLabel: Phaser.GameObjects.Image;
  readonly logo: Phaser.GameObjects.Image;
  readonly spinButton: Phaser.GameObjects.Container;
  readonly spinImage: Phaser.GameObjects.Image;
  readonly spinGlow: Phaser.GameObjects.Image;
  readonly spinLabel: Phaser.GameObjects.Text;
  readonly btnMinus: IconButton;
  readonly btnPlus: IconButton;
  readonly btnAuto: IconButton;
  readonly btnTurbo: IconButton;
  readonly btnHelp: IconButton;
  readonly btnHistory: IconButton;
  readonly btnSound: IconButton;
  readonly btnSettings: IconButton;
  readonly btnHome: IconButton;
  readonly balanceCounter: CounterText;
  readonly lastWinCounter: CounterText;
  private spinEnabled = true;
  private spinning = false;
  private spinTween?: Phaser.Tweens.Tween;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene, layout: Layout, cb: HudCallbacks, depth: number) {
    this.logo = scene.add.image(0, 0, 'jg-logo').setDepth(depth);
    scene.tweens.add({ targets: this.logo, scale: '*=1.02', duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.credits = new Plate(scene, 0, 0, { width: 430, height: 96, label: 'CRÉDITOS (DEMO)', value: '0,00', icon: 'fx-coin' }).setDepth(depth);
    this.balanceCounter = new CounterText(scene, this.credits.valueText, 0);
    this.lastWin = new Plate(scene, 0, 0, { width: 350, height: 92, label: 'ÚLTIMO PRÊMIO', value: '0,00' }).setDepth(depth);
    this.lastWinCounter = new CounterText(scene, this.lastWin.valueText, 0);
    this.betPlate = new Plate(scene, 0, 0, { width: 180, height: 84, label: 'APOSTA', value: '10,00' }).setDepth(depth);
    this.demoLabel = scene.add.image(0, 0, 'jg-demo-label').setDepth(depth);
    scene.tweens.add({ targets: this.demoLabel, alpha: { from: 1, to: 0.8 }, duration: 1400, yoyo: true, repeat: -1 });

    this.plaqueFree = new Plaque(scene, 0, 0, 250, 165, 'GIROS\nGRÁTIS', '—').setDepth(depth);
    this.plaqueMult = new Plaque(scene, 0, 0, 250, 165, 'MULTIPLICADOR\nATÉ x10', 'x1').setDepth(depth);

    // botão GIRAR
    this.spinButton = scene.add.container(0, 0).setDepth(depth + 1);
    this.spinGlow = scene.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(COLORS.gold).setAlpha(0.6);
    this.spinImage = scene.add.image(0, 0, 'jg-spin');
    this.spinLabel = scene.add.text(0, 0, 'GIRAR', uiStyle(30, { color: '#fff3d6', stroke: '#2a1404', strokeThickness: 6, fontStyle: '900' })).setOrigin(0.5);
    this.spinButton.add([this.spinGlow, this.spinImage, this.spinLabel]);
    this.spinButton.setInteractive(new Phaser.Geom.Circle(0, 0, 100), Phaser.Geom.Circle.Contains);
    if (this.spinButton.input) this.spinButton.input.cursor = 'pointer';
    this.spinButton.on('pointerdown', () => {
      if (!this.spinEnabled) return;
      scene.tweens.add({ targets: this.spinImage, scale: this.spinImage.scale * 0.92, duration: 70 });
    });
    this.spinButton.on('pointerup', () => {
      if (!this.spinEnabled) return;
      this.restoreSpinScale();
      cb.onSpin();
    });
    this.spinButton.on('pointerupoutside', () => this.restoreSpinScale());
    this.spinButton.on('pointerover', () => this.spinEnabled && this.spinGlow.setAlpha(0.95));
    this.spinButton.on('pointerout', () => this.spinGlow.setAlpha(0.6));
    this.glowTween = scene.tweens.add({ targets: this.spinGlow, scale: { from: 1, to: 1.12 }, alpha: { from: 0.55, to: 0.85 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.btnMinus = new IconButton(scene, 0, 0, { texture: 'jg-btn-minus', width: 72, onClick: cb.onBetMinus }).setDepth(depth);
    this.btnPlus = new IconButton(scene, 0, 0, { texture: 'jg-btn-plus', width: 76, onClick: cb.onBetPlus }).setDepth(depth);
    this.btnAuto = new IconButton(scene, 0, 0, { texture: 'jg-btn-auto', width: 220, onClick: cb.onAuto, label: '', labelSize: 30 }).setDepth(depth);
    this.btnTurbo = new IconButton(scene, 0, 0, { texture: 'jg-btn-turbo', width: 226, onClick: cb.onTurbo }).setDepth(depth);
    this.btnHelp = new IconButton(scene, 0, 0, { texture: 'jg-btn-help', width: 74, onClick: cb.onHelp }).setDepth(depth);
    this.btnHistory = new IconButton(scene, 0, 0, { texture: 'jg-btn-trophy', width: 74, onClick: cb.onHistory }).setDepth(depth);
    this.btnSound = new IconButton(scene, 0, 0, { texture: 'jg-btn-sound-on', width: 74, onClick: cb.onSound }).setDepth(depth);
    this.btnSettings = new IconButton(scene, 0, 0, { texture: 'jg-btn-settings', width: 74, onClick: cb.onSettings }).setDepth(depth);
    this.btnHome = new IconButton(scene, 0, 0, { texture: 'jg-btn-home', width: 74, onClick: cb.onHome }).setDepth(depth);

    this.layout(layout);
  }

  private restoreSpinScale(): void {
    const target = this.spinImage.getData('baseScale') as number | undefined;
    if (target) this.scene.tweens.add({ targets: this.spinImage, scale: target, duration: 120, ease: 'Back.easeOut' });
  }

  layout(l: Layout): void {
    this.logo.setPosition(l.logo.x, l.logo.y).setScale(l.logo.scale);
    this.credits.setPosition(l.credits.x, l.credits.y);
    this.credits.resize(l.credits.w, l.credits.h);
    this.lastWin.setPosition(l.lastWin.x, l.lastWin.y);
    this.lastWin.resize(l.lastWin.w, l.lastWin.h);
    this.betPlate.setPosition(l.bet.plate.x, l.bet.plate.y);
    this.betPlate.resize(l.bet.plate.w, l.bet.plate.h);
    this.demoLabel.setPosition(l.demoLabel.x, l.demoLabel.y).setScale(l.demoLabel.scale);
    this.plaqueFree.setPosition(l.plaqueLeft.x, l.plaqueLeft.y);
    this.plaqueFree.resize(l.plaqueLeft.w, l.plaqueLeft.h);
    this.plaqueMult.setPosition(l.plaqueRight.x, l.plaqueRight.y);
    this.plaqueMult.resize(l.plaqueRight.w, l.plaqueRight.h);

    this.spinButton.setPosition(l.spin.x, l.spin.y);
    const spinScale = l.spin.size / this.spinImage.width;
    this.spinImage.setScale(spinScale).setData('baseScale', spinScale);
    this.spinGlow.setDisplaySize(l.spin.size * 1.9, l.spin.size * 1.9);
    this.spinLabel.setPosition(0, 0).setFontSize(Math.round(l.spin.size * 0.17)).setStroke('#1d3a12', Math.max(4, Math.round(l.spin.size * 0.05)));
    const hit = this.spinButton.input?.hitArea as Phaser.Geom.Circle | undefined;
    if (hit) hit.setTo(0, 0, l.spin.size * 0.55);

    this.btnMinus.setPosition(l.bet.minus.x, l.bet.minus.y).resize(l.bet.minus.w);
    this.btnPlus.setPosition(l.bet.plus.x, l.bet.plus.y).resize(l.bet.plus.w);
    this.btnAuto.setPosition(l.auto.x, l.auto.y).resize(l.auto.w);
    this.btnTurbo.setPosition(l.turbo.x, l.turbo.y).resize(l.turbo.w);
    this.btnHelp.setPosition(l.icons.help.x, l.icons.help.y).resize(l.icons.help.w);
    this.btnHistory.setPosition(l.icons.trophy.x, l.icons.trophy.y).resize(l.icons.trophy.w);
    this.btnSound.setPosition(l.icons.sound.x, l.icons.sound.y).resize(l.icons.sound.w);
    this.btnSettings.setPosition(l.icons.settings.x, l.icons.settings.y).resize(l.icons.settings.w);
    this.btnHome.setPosition(l.icons.home.x, l.icons.home.y).resize(l.icons.home.w);
    if (this.btnAuto.label) this.btnAuto.label.setPosition(0, -l.auto.w * 0.28).setFontSize(Math.round(l.auto.w * 0.13));
  }

  // ------------------------------------------------------------------ estado

  setBalance(cents: number, animate = true): Promise<void> {
    if (!animate) {
      this.balanceCounter.set(cents);
      return Promise.resolve();
    }
    return this.balanceCounter.animateTo(cents, 900);
  }

  setLastWin(cents: number, animate = true): Promise<void> {
    if (!animate) {
      this.lastWinCounter.set(cents);
      return Promise.resolve();
    }
    this.lastWin.pulse();
    return this.lastWinCounter.animateTo(cents, 700);
  }

  setBet(cents: number): void {
    this.betPlate.setValue(formatCredits(cents));
    this.betPlate.pulse();
  }

  setBetControlsEnabled(canDecrease: boolean, canIncrease: boolean): void {
    this.btnMinus.setEnabled(canDecrease);
    this.btnPlus.setEnabled(canIncrease);
  }

  setFreeSpins(state: FreeSpinsState): void {
    if (state.active) {
      this.plaqueFree.setTitle('GIROS\nGRÁTIS').setValue(String(state.remaining)).setHighlighted(true);
      this.plaqueMult.setTitle('MULTIPLICADOR').setValue(`x${state.multiplier}`).setHighlighted(true);
    } else {
      this.plaqueFree.setTitle('GIROS\nGRÁTIS').setValue('—').setHighlighted(false);
      this.plaqueMult.setTitle('MULTIPLICADOR\nATÉ x10').setValue('x1').setHighlighted(false);
    }
  }

  /** Habilita/desabilita o botão GIRAR (continua clicável como "PARAR" durante o giro). */
  setSpinEnabled(enabled: boolean): void {
    this.spinEnabled = enabled;
    this.spinImage.setAlpha(enabled ? 1 : 0.55);
    this.spinLabel.setAlpha(enabled ? 1 : 0.6);
    if (!enabled) this.spinGlow.setAlpha(0.2);
    else this.spinGlow.setAlpha(0.6);
  }

  setSpinning(spinning: boolean): void {
    if (this.spinning === spinning) return;
    this.spinning = spinning;
    this.spinTween?.stop();
    if (spinning) {
      this.spinLabel.setText('PARAR');
      this.spinTween = this.scene.tweens.add({ targets: this.spinImage, angle: '-=360', duration: 1400, repeat: -1 });
    } else {
      this.spinLabel.setText('GIRAR');
      this.scene.tweens.add({ targets: this.spinImage, angle: 0, duration: 250, ease: 'Quad.easeOut' });
    }
  }

  setAutoRemaining(remaining: number): void {
    this.btnAuto.setLabel(remaining > 0 ? `${remaining}` : '').setHighlighted(remaining > 0);
  }

  setTurbo(on: boolean): void {
    this.btnTurbo.setHighlighted(on);
  }

  setSoundOn(on: boolean): void {
    this.btnSound.image.setTexture(on ? 'jg-btn-sound-on' : 'jg-btn-sound-off');
  }

  /** Durante giros grátis o jogador não aposta nem usa AUTO. */
  setLocked(locked: boolean): void {
    this.btnAuto.setEnabled(!locked);
    this.btnMinus.setEnabled(!locked);
    this.btnPlus.setEnabled(!locked);
  }

  setInteractiveAll(on: boolean): void {
    for (const b of [this.btnHelp, this.btnHistory, this.btnSound, this.btnSettings, this.btnHome, this.btnTurbo]) b.setEnabled(on);
  }

  destroy(): void {
    this.spinTween?.stop();
    this.glowTween?.stop();
  }
}
