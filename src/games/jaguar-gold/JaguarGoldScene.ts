import Phaser from 'phaser';
import { GameSession, type RoundOutcome } from '@game/core/GameSession';
import { CryptoRng, FixedStopsRng } from '@game/core/rng';
import { SlotEngine } from '@game/core/SlotEngine';
import { formatCredits } from '@game/format';
import { SCENE_KEYS } from '@game/registry';
import { modeFor } from '@game/responsive';
import { getServices, type Services } from '@game/services';
import { APP_CONFIG } from '@config/app.config';
import { JAGUAR_GOLD_MATH, JAGUAR_GOLD_SYMBOLS } from './math.config';
import { computeLayout, type Layout } from './layout';
import { ReelSet, SCHEDULE_NORMAL, SCHEDULE_TURBO } from './reels/ReelSet';
import { AmbientFx } from './presentation/AmbientFx';
import { Mascot } from './presentation/Mascot';
import { WinPresenter } from './presentation/WinPresenter';
import { BigWinOverlay } from './presentation/BigWinOverlay';
import { FreeSpinsPresenter } from './presentation/FreeSpinsPresenter';
import { Hud } from './hud/Hud';
import { ConfirmModal, HistoryModal, PaytableModal, SettingsModal, TutorialModal } from './hud/modals';

const DEPTH = {
  frameShadow: 8,
  frame: 10,
  reels: 12,
  reelShade: 14,
  winLines: 16,
  anticipation: 15,
  hud: 20,
  mascot: 22,
  modal: 500,
  bigWin: 600,
  splash: 650,
} as const;

/**
 * Cena principal do Jaguar Gold. Só REPRODUZ resultados: a matemática fica em GameSession/SlotEngine.
 */
export class JaguarGoldScene extends Phaser.Scene {
  private services!: Services;
  private session!: GameSession;
  private layoutData!: Layout;
  private ambient!: AmbientFx;
  private mascot!: Mascot;
  private reelSet!: ReelSet;
  private winPresenter!: WinPresenter;
  private bigWin!: BigWinOverlay;
  private fsPresenter!: FreeSpinsPresenter;
  private hud!: Hud;
  private frame!: Phaser.GameObjects.Image;
  private frameShadow!: Phaser.GameObjects.Image;
  private frameGlow!: Phaser.GameObjects.Image;
  private reelShades!: Phaser.GameObjects.Graphics;
  private anticipationGlow!: Phaser.GameObjects.Image;
  private busy = false;
  private autoRemaining = 0;
  private turbo = false;
  private modalOpen = false;
  private activeModal?: { close(): Promise<void> };
  private resizeHandler?: () => void;

  constructor() {
    super(SCENE_KEYS.jaguarGold);
  }

  create(): void {
    this.services = getServices(this);
    // tweens e timers no mesmo relógio: sem o "skip" de 33 ms do TweenManager em quadros lentos
    // (mesmo teto de 2 s do TimeStep, fps.min = 0.5)
    this.tweens.setLagSmooth(2000, 2000);
    const engine = new SlotEngine(JAGUAR_GOLD_MATH);
    this.session = new GameSession(engine, this.services.wallet);
    this.turbo = this.services.settings.get().turbo;

    const { width, height } = this.scale;
    this.layoutData = computeLayout(width, height, modeFor(width, height));
    const l = this.layoutData;

    this.ambient = new AmbientFx(this, l);

    // moldura: sombra suave, brilho, imagem
    this.frameShadow = this.add.image(0, 0, 'fx-glow-soft').setTint(0x000000).setAlpha(0.6).setDepth(DEPTH.frameShadow);
    this.frameGlow = this.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc83a).setAlpha(0.18).setDepth(DEPTH.frameShadow);
    this.tweens.add({ targets: this.frameGlow, alpha: { from: 0.14, to: 0.3 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.frame = this.add.image(0, 0, 'jg-frame').setDepth(DEPTH.frame);
    this.reelShades = this.add.graphics().setDepth(DEPTH.reelShade);
    this.anticipationGlow = this.add.image(0, 0, 'fx-glow-soft').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6ad5).setAlpha(0).setDepth(DEPTH.anticipation);

    // rolos
    const initialGrid = engine.resolve(JAGUAR_GOLD_MATH.reelStrips.map((s) => Math.floor(Math.random() * s.length)), JAGUAR_GOLD_MATH.betLevels[0]).grid;
    this.reelSet = new ReelSet(this, JAGUAR_GOLD_MATH.reelStrips, initialGrid, DEPTH.reels, {
      onReelStop: (i, isLast) => this.onReelStop(i, isLast),
      onAnticipationStart: () => this.setAnticipation(true),
      onAnticipationEnd: () => this.setAnticipation(false),
    });

    this.winPresenter = new WinPresenter(this, this.reelSet, l, this.services.audio, JAGUAR_GOLD_MATH.paylines, DEPTH.winLines);
    this.bigWin = new BigWinOverlay(this, this.services.audio, DEPTH.bigWin);
    this.fsPresenter = new FreeSpinsPresenter(this, this.services.audio, this.ambient, DEPTH.splash);
    this.mascot = new Mascot(this, l, DEPTH.mascot);

    this.hud = new Hud(
      this,
      l,
      {
        onSpin: () => this.handleSpinPressed(),
        onBetMinus: () => this.changeBet(-1),
        onBetPlus: () => this.changeBet(1),
        onAuto: () => this.toggleAuto(),
        onTurbo: () => this.setTurbo(!this.turbo),
        onHelp: () => this.openModal(() => new PaytableModal(this, JAGUAR_GOLD_MATH, this.session.bet)),
        onHistory: () => this.openModal(() => new HistoryModal(this, this.services.wallet, () => this.services.wallet.clearHistory())),
        onSound: () => this.toggleSound(),
        onSettings: () => this.openSettings(),
        onHome: () => this.goHome(),
      },
      DEPTH.hud,
    );

    this.applyLayout();
    this.syncHud();
    this.hud.setTurbo(this.turbo);
    this.hud.setSoundOn(this.services.settings.get().musicEnabled || this.services.settings.get().sfxEnabled);

    // eventos
    this.session.events.on('balance', (b) => {
      if (!this.busy) void this.hud.setBalance(b, false);
    });
    this.session.events.on('bet', (b) => {
      this.hud.setBet(b);
      this.hud.setMaxWin(b * JAGUAR_GOLD_MATH.maxWinMultiple);
    });
    this.resizeHandler = () => this.applyLayout();
    this.scale.on('resize', this.resizeHandler);
    this.input.on('pointerdown', () => {
      this.services.audio.unlock();
      this.services.audio.playMusic();
    });
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.modalOpen) this.handleSpinPressed();
    });
    this.input.keyboard?.on('keydown-T', () => this.setTurbo(!this.turbo));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());

    this.mascot.enter();
    this.services.audio.playMusic();
    this.installDevHooks();
    if (!this.services.settings.get().tutorialSeen) {
      this.time.delayedCall(700, () => this.showTutorial());
    }
  }

  override update(_time: number, delta: number): void {
    this.reelSet.update(delta);
    this.ambient.update(delta);
  }

  // ------------------------------------------------------------------ layout

  private applyLayout(): void {
    const { width, height } = this.scale;
    this.layoutData = computeLayout(width, height, modeFor(width, height));
    const l = this.layoutData;
    this.ambient.layout(l);
    if (this.frame.texture.key !== l.frame.key) this.frame.setTexture(l.frame.key);
    this.frame.setPosition(l.frame.x, l.frame.y).setScale(l.frame.scale);
    this.frameGlow.setPosition(l.frame.x, l.frame.y).setDisplaySize(l.frame.width * 1.5, l.frame.height * 1.7);
    this.frameShadow.setPosition(l.frame.x, l.frame.y + l.frame.height * 0.08).setDisplaySize(l.frame.width * 1.25, l.frame.height * 1.45);
    // sombras internas (topo/base) de cada janela — dão profundidade ao cilindro
    this.reelShades.clear();
    for (const w of l.reels) {
      const x = w.x - w.width / 2;
      const h = w.rowH * 0.55;
      this.reelShades.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
      this.reelShades.fillRect(x, w.top, w.width, h);
      this.reelShades.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
      this.reelShades.fillRect(x, w.top + w.height - h, w.width, h);
    }
    const last = l.reels[2];
    this.anticipationGlow.setPosition(last.x, last.top + last.height / 2).setDisplaySize(last.width * 2.2, last.height * 1.6);
    this.reelSet.layout(l.reels);
    this.winPresenter.layout(l);
    this.mascot.layout(l);
    this.hud.layout(l);
  }

  private syncHud(): void {
    void this.hud.setBalance(this.session.balance, false);
    this.hud.setBet(this.session.bet);
    this.hud.setMaxWin(this.session.bet * JAGUAR_GOLD_MATH.maxWinMultiple);
    this.hud.setFreeSpins(this.session.freeSpinsState);
    this.updateBetControls();
    const last = this.services.wallet.spins[0];
    void this.hud.setLastWin(last ? last.win : 0, false);
  }

  private updateBetControls(): void {
    const idx = this.session.betLevelIndex;
    const can = this.session.canChangeBet() && !this.busy;
    this.hud.setBetControlsEnabled(can && idx > 0, can && idx < JAGUAR_GOLD_MATH.betLevels.length - 1);
  }

  // ------------------------------------------------------------------ ações do jogador

  private handleSpinPressed(): void {
    if (this.modalOpen) return;
    if (this.reelSet.isSpinning) {
      this.reelSet.stopNow();
      return;
    }
    if (this.busy || this.bigWin.isActive) return;
    this.services.audio.play('click');
    const check = this.session.canSpin();
    if (!check.ok) {
      if (check.reason === 'insufficient-balance') this.promptReset();
      return;
    }
    void this.runRound();
  }

  private changeBet(direction: 1 | -1): void {
    if (this.busy || this.modalOpen) return;
    const ok = direction > 0 ? this.session.nextBet() : this.session.prevBet();
    if (ok) this.services.audio.play('click');
    this.updateBetControls();
  }

  private toggleAuto(): void {
    if (this.modalOpen) return;
    this.services.audio.play('click');
    if (this.autoRemaining > 0) {
      this.autoRemaining = 0;
      this.hud.setAutoRemaining(0);
      return;
    }
    if (this.session.freeSpinsState.active) return;
    this.autoRemaining = 10;
    this.hud.setAutoRemaining(this.autoRemaining);
    if (!this.busy && !this.reelSet.isSpinning) {
      const check = this.session.canSpin();
      if (check.ok) void this.runRound();
      else {
        this.autoRemaining = 0;
        this.hud.setAutoRemaining(0);
        if (check.reason === 'insufficient-balance') this.promptReset();
      }
    }
  }

  private setTurbo(on: boolean): void {
    this.turbo = on;
    this.services.settings.update({ turbo: on });
    this.hud.setTurbo(on);
    this.services.audio.play('click');
  }

  private toggleSound(): void {
    const s = this.services.settings.get();
    const anyOn = s.musicEnabled || s.sfxEnabled;
    this.services.settings.update({ musicEnabled: !anyOn, sfxEnabled: !anyOn });
    this.hud.setSoundOn(!anyOn);
    if (!anyOn) this.services.audio.play('click');
  }

  private openModal(factory: () => Phaser.GameObjects.Container & { close(): Promise<void>; once(event: string, fn: () => void): unknown }): void {
    if (this.modalOpen) return;
    this.services.audio.play('click');
    this.modalOpen = true;
    const modal = factory();
    this.activeModal = modal;
    modal.once('destroy', () => {
      this.modalOpen = false;
      if (this.activeModal === modal) this.activeModal = undefined;
    });
  }

  private openSettings(): void {
    this.openModal(
      () =>
        new SettingsModal(this, this.services.settings, {
          onResetCredits: () => this.promptReset(),
          onShowTutorial: () => this.showTutorial(),
          onTurbo: (on) => this.setTurbo(on),
        }),
    );
  }

  private showTutorial(): void {
    if (this.modalOpen) return;
    this.modalOpen = true;
    const modal = new TutorialModal(this, () => {
      this.services.settings.update({ tutorialSeen: true });
    });
    this.activeModal = modal;
    modal.once('destroy', () => {
      this.modalOpen = false;
      if (this.activeModal === modal) this.activeModal = undefined;
    });
  }

  private promptReset(): void {
    if (this.modalOpen || this.busy) return;
    this.modalOpen = true;
    const insufficient = !this.services.wallet.canAfford(this.session.bet);
    const modal = new ConfirmModal(this, {
      title: insufficient ? 'CRÉDITOS INSUFICIENTES' : 'REINICIAR CRÉDITOS',
      message: insufficient
        ? `Seus créditos fictícios acabaram ou não cobrem a aposta de ${formatCredits(this.session.bet)}.\nDeseja reiniciar com ${formatCredits(APP_CONFIG.initialBalance)} créditos de demonstração?`
        : `Reiniciar o saldo para ${formatCredits(APP_CONFIG.initialBalance)} créditos fictícios?\n(O histórico é mantido.)`,
      confirmLabel: 'REINICIAR',
      cancelLabel: insufficient ? 'DIMINUIR APOSTA' : 'CANCELAR',
      onConfirm: () => {
        if (this.session.resetCredits()) {
          this.services.audio.play('coins');
          void this.hud.setBalance(this.session.balance, true);
          this.updateBetControls();
        }
      },
      onCancel: () => {
        if (insufficient) {
          while (this.session.betLevelIndex > 0 && !this.services.wallet.canAfford(this.session.bet)) this.session.prevBet();
          this.updateBetControls();
        }
      },
    });
    this.activeModal = modal;
    modal.once('destroy', () => {
      this.modalOpen = false;
      if (this.activeModal === modal) this.activeModal = undefined;
    });
  }

  private goHome(): void {
    if (this.busy || this.reelSet.isSpinning) return;
    this.services.audio.play('click');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENE_KEYS.lobby));
  }

  // ------------------------------------------------------------------ rodada

  private async runRound(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.updateBetControls();
    this.winPresenter.clear();
    let round: RoundOutcome;
    try {
      round = this.session.startSpin();
    } catch (err) {
      console.error(err);
      this.busy = false;
      this.updateBetControls();
      return;
    }

    const audio = this.services.audio;
    const result = round.result;
    const isFree = round.freeSpin;
    const quick = this.turbo;

    this.hud.setSpinning(true);
    this.hud.setLocked(true);
    void this.hud.setBalance(round.balanceAfterDebit, false);
    if (!isFree) void this.hud.setLastWin(0, false);
    audio.play('spinStart');
    audio.play('reelLoop', { solo: true });

    const scattersFirstTwo = countScatters(result.grid, 2);
    const anticipate = scattersFirstTwo >= 2;
    if (anticipate) this.time.delayedCall(quick ? 400 : 1000, () => audio.play('anticipation'));

    try {
      await this.reelSet.spin(result.grid, quick ? SCHEDULE_TURBO : SCHEDULE_NORMAL, anticipate);
    } catch (err) {
      console.error(err);
    }
    audio.stop('reelLoop', 120);
    this.hud.setSpinning(false);

    const total = result.totalWin;
    const bigTier = result.tier === 'big' || result.tier === 'mega' || result.tier === 'super';
    if (total > 0 || result.triggersFreeSpins) {
      if (bigTier) this.mascot.celebrate();
      else if (total >= result.bet * 2) this.mascot.roar();
      this.pulseFrame();
      await this.winPresenter.showAll(result, quick || this.autoRemaining > 0 || isFree);
      if (bigTier) {
        await this.bigWin.show(result.tier, total, { capped: result.capped, fullScreen: !!result.fullScreen });
      }
      audio.play('countLoop', { solo: true });
      await Promise.all([this.hud.setLastWin(total), this.hud.setBalance(round.balanceAfterDebit + total)]);
      audio.stop('countLoop');
    }

    const settlement = this.session.completeSpin(round.roundId);
    void this.hud.setBalance(settlement.balance, false);
    this.hud.setFreeSpins(settlement.freeSpins);

    if (settlement.freeSpinsStarted) {
      this.autoRemaining = 0;
      this.hud.setAutoRemaining(0);
      this.ambient.setBonusMode(true);
      await this.fsPresenter.showIntro(settlement.freeSpins.remaining);
    } else if (settlement.freeSpinsRetriggered) {
      await this.fsPresenter.showRetrigger(JAGUAR_GOLD_MATH.freeSpins.retriggerSpins, settlement.freeSpins.remaining);
    }
    if (settlement.freeSpinsEnded) {
      await this.fsPresenter.showOutro(settlement.freeSpinsTotal, this.services.wallet.spins.filter((s) => s.freeSpin).length);
      this.ambient.setBonusMode(false);
    }

    this.busy = false;
    this.hud.setLocked(settlement.nextIsFreeSpin);
    this.updateBetControls();

    // continuação automática: giros grátis → AUTO
    if (settlement.nextIsFreeSpin) {
      this.time.delayedCall(quick ? 250 : 650, () => {
        if (!this.busy) void this.runRound();
      });
      return;
    }
    if (this.autoRemaining > 0) {
      this.autoRemaining -= 1;
      this.hud.setAutoRemaining(this.autoRemaining);
      if (this.autoRemaining > 0) {
        const check = this.session.canSpin();
        if (check.ok) {
          this.time.delayedCall(quick ? 200 : 500, () => {
            if (!this.busy && this.autoRemaining > 0) void this.runRound();
          });
          return;
        }
        this.autoRemaining = 0;
        this.hud.setAutoRemaining(0);
        if (check.reason === 'insufficient-balance') this.promptReset();
        return;
      }
    }
    if (result.lineWins.length > 1) this.winPresenter.startCycle(result);
    if (!this.services.wallet.canAfford(this.session.bet)) this.time.delayedCall(400, () => this.promptReset());
  }

  private onReelStop(index: number, isLast: boolean): void {
    this.services.audio.play('reelStop', { rate: 0.95 + index * 0.05 });
    if (isLast) {
      this.cameras.main.shake(90, 0.0025);
      this.tweens.add({ targets: this.frame, y: this.frame.y + 6, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  private setAnticipation(on: boolean): void {
    this.tweens.killTweensOf(this.anticipationGlow);
    if (on) {
      this.anticipationGlow.setAlpha(0.3);
      this.tweens.add({ targets: this.anticipationGlow, alpha: { from: 0.35, to: 0.85 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.tweens.add({ targets: this.anticipationGlow, alpha: 0, duration: 200 });
      this.services.audio.stop('anticipation', 150);
    }
  }

  private pulseFrame(): void {
    this.tweens.add({ targets: this.frameGlow, alpha: { from: 0.9, to: 0.2 }, duration: 900, ease: 'Quad.easeOut' });
  }

  /**
   * Ganchos de desenvolvimento/verificação visual: forçar paradas para testar apresentações.
   * Disponíveis em `vite dev` ou em builds feitos com `VITE_DEBUG_HOOKS=1` (usado por tools/visual_check.mjs).
   */
  private installDevHooks(): void {
    if (typeof window === 'undefined') return;
    if (!import.meta.env.DEV && import.meta.env.VITE_DEBUG_HOOKS !== '1') return;
    const w = window as unknown as { __jgDebug?: Record<string, unknown> };
    w.__jgDebug = {
      forceStops: (stops: number[]) => this.session.setRng(new FixedStopsRng(stops)),
      randomRng: () => this.session.setRng(new CryptoRng()),
      spin: () => this.handleSpinPressed(),
      layout: () => this.layoutData,
      isBusy: () => this.busy || this.reelSet.isSpinning,
      state: () => ({ balance: this.session.balance, bet: this.session.bet, freeSpins: this.session.freeSpinsState, modalOpen: this.modalOpen }),
      closeTutorial: () => this.services.settings.update({ tutorialSeen: true }),
      closeModal: () => void this.activeModal?.close(),
      openTutorial: () => this.showTutorial(),
      setTurbo: (on: boolean) => this.setTurbo(on),
    };
  }

  private shutdown(): void {
    if (this.resizeHandler) this.scale.off('resize', this.resizeHandler);
    this.services.audio.stop('reelLoop');
    this.services.audio.stop('countLoop');
    this.winPresenter.clear();
    this.reelSet.destroy();
    this.mascot.destroy();
    this.hud.destroy();
  }
}

function countScatters(grid: string[][], reels: number): number {
  let n = 0;
  for (let r = 0; r < reels; r += 1) for (const id of grid[r]) if (id === JAGUAR_GOLD_SYMBOLS.BONUS) n += 1;
  return n;
}
