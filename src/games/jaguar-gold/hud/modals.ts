import Phaser from 'phaser';
import type { SlotMathConfig } from '@game/core/types';
import { formatCredits, formatTime } from '@game/format';
import type { SettingsStore } from '@game/SettingsStore';
import { APP_CONFIG } from '@config/app.config';
import { Modal } from '@ui/Modal';
import { TextButton } from '@ui/IconButton';
import { Slider } from '@ui/Slider';
import { applyGoldGradient, numberStyle, uiStyle } from '@ui/textStyles';
import type { DemoWallet } from '@wallet/DemoWallet';
import { symbolTexture } from '../assets';

// ---------------------------------------------------------------- Pagamentos / Regras

export class PaytableModal extends Modal {
  constructor(scene: Phaser.Scene, config: SlotMathConfig) {
    const portrait = scene.scale.height > scene.scale.width;
    super(scene, { title: 'TABELA DE PAGAMENTOS', width: portrait ? 1000 : 1040, height: portrait ? 1400 : 760 });
    if (portrait) this.buildPortrait(scene, config);
    else this.buildLandscape(scene, config);
  }

  private symbolRows(scene: Phaser.Scene, config: SlotMathConfig, left: number, top: number, colW: number, rowH: number, icon: number, nameSize: number, paySize: number): number {
    const symbols = config.symbols.filter((s) => s.kind !== 'scatter');
    symbols.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = left + col * colW;
      const y = top + row * rowH;
      const img = scene.add.image(x + icon / 2, y + rowH / 2 - 4, symbolTexture(s.id)).setDisplaySize(icon, icon);
      const name = scene.add.text(x + icon + 14, y + rowH * 0.1, s.name.toUpperCase(), uiStyle(nameSize, { color: '#d9c8a2' }));
      const pays = Object.entries(s.pays)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([count, mult]) => `${count}x = ${mult}`)
        .join('   ');
      const value = scene.add.text(x + icon + 14, y + rowH * 0.1 + nameSize + 6, pays, numberStyle(paySize));
      applyGoldGradient(value);
      this.content.add([img, name, value]);
    });
    return top + Math.ceil(symbols.length / 2) * rowH;
  }

  private paylineIcons(scene: Phaser.Scene, config: SlotMathConfig, x0: number, y0: number, cell: number, gap: number): void {
    config.paylines.forEach((line, i) => {
      const g = scene.add.graphics();
      const bx = x0 + i * (cell * 3 + 8 + gap);
      const by = y0;
      g.fillStyle(0x2d1a36, 1);
      g.fillRoundedRect(bx, by, cell * 3 + 8, cell * 3 + 8, 6);
      g.lineStyle(1, 0x7a5a2a, 0.6);
      for (let r = 0; r < 3; r += 1)
        for (let c = 0; c < 3; c += 1) g.strokeRect(bx + 4 + c * cell, by + 4 + r * cell, cell, cell);
      g.lineStyle(Math.max(3, cell * 0.2), [0xffc83a, 0x5ee0ff, 0xff6ad5, 0x7dff8f, 0xff9a3c][i % 5], 1);
      g.beginPath();
      line.forEach((row, reel) => {
        const px = bx + 4 + reel * cell + cell / 2;
        const py = by + 4 + row * cell + cell / 2;
        if (reel === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.strokePath();
      const label = scene.add.text(bx + (cell * 3 + 8) / 2, by + cell * 3 + 14, `${i + 1}`, uiStyle(Math.round(cell * 0.8), { color: '#d9c8a2' })).setOrigin(0.5, 0);
      this.content.add([g, label]);
    });
  }

  private rulesText(config: SlotMathConfig): string {
    return [
      '• As linhas pagam da esquerda para a direita com símbolos iguais consecutivos.',
      '• Só o maior prêmio de cada linha é pago; linhas diferentes são somadas.',
      `• GIROS GRÁTIS: multiplicador inicia em x${config.freeSpins.startMultiplier} e sobe +${config.freeSpins.multiplierStep} a cada giro vencedor (até x${config.freeSpins.maxMultiplier}).`,
      `• BIG WIN a partir de ${config.winTiers.big}x a aposta; MEGA WIN a partir de ${config.winTiers.mega}x.`,
      '• Resultados sorteados localmente antes da animação; probabilidades fixas.',
      `• ${APP_CONFIG.disclaimer}`,
    ].join('\n');
  }

  private buildLandscape(scene: Phaser.Scene, config: SlotMathConfig): void {
    const W = 1040;
    const left = -W / 2 + 40;
    const top = -760 / 2 + 110;
    const bottom = this.symbolRows(scene, config, left, top, 296, 84, 72, 16, 21);
    this.paragraph(left, bottom + 2, `Prêmios em múltiplos da aposta POR LINHA (aposta total ÷ ${config.paylines.length}). WILD substitui todos os símbolos, exceto o BÔNUS.`, 560, 18, '#d9c8a2');

    const rx = left + 610;
    const scatter = config.symbols.find((s) => s.kind === 'scatter');
    if (scatter) {
      const icon = scene.add.image(rx + 40, top + 40, symbolTexture(scatter.id)).setDisplaySize(84, 84);
      const t1 = scene.add.text(rx + 96, top + 6, 'BÔNUS (scatter)', uiStyle(20, { color: '#ffd978', fontStyle: '800' }));
      const fs = config.freeSpins;
      const t2 = scene.add.text(rx + 96, top + 34, `${fs.triggerCount} em qualquer posição = ${scatter.pays[3]}x a aposta total\n+ ${fs.spinsAwarded} GIROS GRÁTIS (reaciona: +${fs.retriggerSpins})`, uiStyle(16, { color: '#fff3d6', lineSpacing: 4 }));
      this.content.add([icon, t1, t2]);
    }
    const linesTitle = scene.add.text(rx, top + 110, `${config.paylines.length} LINHAS DE PAGAMENTO`, uiStyle(20, { color: '#ffd978', fontStyle: '800' }));
    this.content.add(linesTitle);
    this.paylineIcons(scene, config, rx, top + 146, 20, 8);
    this.paragraph(rx, top + 240, this.rulesText(config), 380, 15, '#fff3d6');
  }

  private buildPortrait(scene: Phaser.Scene, config: SlotMathConfig): void {
    const W = 1000;
    const H = 1400;
    const left = -W / 2 + 36;
    let y = -H / 2 + 110;
    const scatter = config.symbols.find((s) => s.kind === 'scatter');
    y = this.symbolRows(scene, config, left, y, 468, 118, 92, 20, 30);
    this.paragraph(left, y + 6, `Prêmios em múltiplos da aposta POR LINHA (aposta total ÷ ${config.paylines.length}). WILD substitui todos os símbolos, exceto o BÔNUS.`, W - 72, 22, '#d9c8a2');
    y += 92;
    if (scatter) {
      const icon = scene.add.image(left + 50, y + 50, symbolTexture(scatter.id)).setDisplaySize(100, 100);
      const t1 = scene.add.text(left + 116, y + 4, 'BÔNUS (scatter)', uiStyle(26, { color: '#ffd978', fontStyle: '800' }));
      const fs = config.freeSpins;
      const t2 = scene.add.text(left + 116, y + 40, `${fs.triggerCount} em qualquer posição = ${scatter.pays[3]}x a aposta total\n+ ${fs.spinsAwarded} GIROS GRÁTIS (reaciona: +${fs.retriggerSpins})`, uiStyle(21, { color: '#fff3d6', lineSpacing: 6 }));
      this.content.add([icon, t1, t2]);
      y += 120;
    }
    const linesTitle = scene.add.text(left, y, `${config.paylines.length} LINHAS DE PAGAMENTO`, uiStyle(26, { color: '#ffd978', fontStyle: '800' }));
    this.content.add(linesTitle);
    y += 44;
    this.paylineIcons(scene, config, left + 10, y, 34, 50);
    y += 34 * 3 + 8 + 50;
    this.paragraph(left, y, this.rulesText(config), W - 72, 21, '#fff3d6');
  }
}

// ---------------------------------------------------------------- Histórico

export class HistoryModal extends Modal {
  constructor(scene: Phaser.Scene, wallet: DemoWallet, onClear: () => void) {
    super(scene, { title: 'HISTÓRICO DE GIROS', width: 900, height: 740 });
    const left = -450 + 40;
    const top = -370 + 108;
    const spins = wallet.spins.slice(0, 14);

    const totalBet = wallet.spins.reduce((a, s) => a + (s.freeSpin ? 0 : s.bet), 0);
    const totalWin = wallet.spins.reduce((a, s) => a + s.win, 0);
    const best = wallet.spins.reduce((a, s) => Math.max(a, s.win), 0);
    const summary = scene.add.text(
      left,
      top,
      `Últimos ${wallet.spins.length} giros  ·  Apostado: ${formatCredits(totalBet)}  ·  Ganho: ${formatCredits(totalWin)}  ·  Maior prêmio: ${formatCredits(best)}`,
      uiStyle(17, { color: '#d9c8a2' }),
    );
    this.content.add(summary);

    const headers = ['HORA', 'APOSTA', 'PRÊMIO', 'TIPO'];
    const colX = [left, left + 150, left + 320, left + 520];
    headers.forEach((h, i) => this.content.add(scene.add.text(colX[i], top + 40, h, uiStyle(16, { color: '#ffd978', fontStyle: '800' }))));

    if (spins.length === 0) {
      this.content.add(scene.add.text(0, top + 140, 'Nenhum giro ainda. Boa sorte!', uiStyle(24, { color: '#fff3d6' })).setOrigin(0.5));
    }
    spins.forEach((s, i) => {
      const y = top + 72 + i * 34;
      const bg = scene.add.rectangle(0, y + 14, 820, 32, i % 2 === 0 ? 0x2d1a36 : 0x1b0e22, 0.6);
      const time = scene.add.text(colX[0], y, formatTime(s.at), uiStyle(18));
      const bet = scene.add.text(colX[1], y, s.freeSpin ? 'grátis' : formatCredits(s.bet), uiStyle(18));
      const win = scene.add.text(colX[2], y, formatCredits(s.win), uiStyle(18, { color: s.win > 0 ? '#7dff8f' : '#d9c8a2', fontStyle: '800' }));
      const tags: string[] = [];
      if (s.freeSpin) tags.push(`giro grátis x${s.multiplier}`);
      if (s.triggeredFreeSpins) tags.push('BÔNUS!');
      if (!s.freeSpin && !s.triggeredFreeSpins) tags.push(s.win > 0 ? 'vitória' : '—');
      const type = scene.add.text(colX[3], y, tags.join(' · '), uiStyle(18, { color: s.triggeredFreeSpins ? '#ffd978' : '#fff3d6' }));
      this.content.add([bg, time, bet, win, type]);
    });

    const clearBtn = new TextButton(scene, 0, 370 - 56, { label: 'LIMPAR HISTÓRICO', width: 320, height: 60, variant: 'dark', fontSize: 22, onClick: () => { onClear(); void this.close(); } });
    this.content.add(clearBtn);
  }
}

// ---------------------------------------------------------------- Configurações

export interface SettingsActions {
  onResetCredits: () => void;
  onShowTutorial: () => void;
  onTurbo: (on: boolean) => void;
}

export class SettingsModal extends Modal {
  constructor(scene: Phaser.Scene, settings: SettingsStore, actions: SettingsActions) {
    super(scene, { title: 'CONFIGURAÇÕES', width: 760, height: 640 });
    const s = settings.get();
    const left = -380 + 50;
    let y = -320 + 120;

    const row = (label: string) => {
      const t = scene.add.text(left, y, label, uiStyle(22, { color: '#ffd978', fontStyle: '800' }));
      this.content.add(t);
    };

    row('MÚSICA');
    const musicToggle = new TextButton(scene, 300, y + 14, { label: s.musicEnabled ? 'LIGADA' : 'DESLIGADA', width: 180, height: 50, variant: s.musicEnabled ? 'green' : 'dark', fontSize: 20, onClick: () => {
      const cur = settings.get().musicEnabled;
      settings.update({ musicEnabled: !cur });
      void this.close();
      new SettingsModal(scene, settings, actions);
    } });
    const musicSlider = new Slider(scene, 0, y + 54, 420, s.musicVolume, (v) => settings.update({ musicVolume: v }));
    this.content.add([musicToggle, musicSlider]);
    y += 110;

    row('EFEITOS SONOROS');
    const sfxToggle = new TextButton(scene, 300, y + 14, { label: s.sfxEnabled ? 'LIGADOS' : 'DESLIGADOS', width: 180, height: 50, variant: s.sfxEnabled ? 'green' : 'dark', fontSize: 20, onClick: () => {
      const cur = settings.get().sfxEnabled;
      settings.update({ sfxEnabled: !cur });
      void this.close();
      new SettingsModal(scene, settings, actions);
    } });
    const sfxSlider = new Slider(scene, 0, y + 54, 420, s.sfxVolume, (v) => settings.update({ sfxVolume: v }));
    this.content.add([sfxToggle, sfxSlider]);
    y += 110;

    row('MODO TURBO (giros mais rápidos)');
    const turboToggle = new TextButton(scene, 300, y + 14, { label: s.turbo ? 'LIGADO' : 'DESLIGADO', width: 180, height: 50, variant: s.turbo ? 'green' : 'dark', fontSize: 20, onClick: () => {
      const next = !settings.get().turbo;
      actions.onTurbo(next);
      void this.close();
      new SettingsModal(scene, settings, actions);
    } });
    this.content.add(turboToggle);
    y += 90;

    const reset = new TextButton(scene, -150, y + 20, { label: 'REINICIAR CRÉDITOS', width: 300, height: 60, variant: 'gold', fontSize: 20, onClick: () => { void this.close(); actions.onResetCredits(); } });
    const tut = new TextButton(scene, 170, y + 20, { label: 'REVER TUTORIAL', width: 280, height: 60, variant: 'dark', fontSize: 20, onClick: () => { void this.close(); actions.onShowTutorial(); } });
    this.content.add([reset, tut]);
    y += 70;
    this.paragraph(left, y + 10, `Versão ${APP_CONFIG.version} · ${APP_CONFIG.demoLabel}. Saldo inicial de ${formatCredits(APP_CONFIG.initialBalance)} créditos fictícios.`, 660, 15, '#d9c8a2');
  }
}

// ---------------------------------------------------------------- Confirmação / mensagem

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export class ConfirmModal extends Modal {
  constructor(scene: Phaser.Scene, opts: ConfirmOptions) {
    super(scene, { title: opts.title, width: 720, height: 380, closeOnBackdrop: false, showClose: false });
    const msg = scene.add.text(0, -40, opts.message, uiStyle(24, { color: '#fff3d6', align: 'center', wordWrap: { width: 620 }, lineSpacing: 6 })).setOrigin(0.5);
    this.content.add(msg);
    const hasCancel = opts.cancelLabel !== undefined;
    const confirm = new TextButton(scene, hasCancel ? 150 : 0, 110, { label: opts.confirmLabel ?? 'OK', width: 260, height: 64, variant: 'gold', fontSize: 22, onClick: () => { void this.close().then(() => opts.onConfirm?.()); } });
    this.content.add(confirm);
    if (hasCancel) {
      const cancel = new TextButton(scene, -150, 110, { label: opts.cancelLabel ?? 'CANCELAR', width: 260, height: 64, variant: 'dark', fontSize: 22, onClick: () => { void this.close().then(() => opts.onCancel?.()); } });
      this.content.add(cancel);
    }
  }
}

// ---------------------------------------------------------------- Tutorial

export class TutorialModal extends Modal {
  private step = 0;
  private readonly steps: { title: string; text: string; icon: string }[] = [
    { title: 'BEM-VINDO AO JAGUAR GOLD', text: 'Este é um cassino DEMONSTRATIVO: você joga com 1.000 créditos fictícios. Não há dinheiro real, depósitos ou saques — é só diversão.', icon: 'sym-jaguar' },
    { title: 'ESCOLHA A APOSTA E GIRE', text: 'Use − e + para ajustar a aposta por giro. Toque no botão dourado para GIRAR; toque de novo durante o giro para parar mais rápido. AUTO joga 10 giros seguidos e TURBO acelera tudo.', icon: 'jg-spin' },
    { title: 'LINHAS, WILD E BÔNUS', text: '5 linhas de pagamento (3 horizontais + 2 diagonais). O WILD substitui qualquer símbolo. 3 BÔNUS em qualquer posição liberam 10 GIROS GRÁTIS com multiplicador crescente até x10. Consulte a tabela em "?".', icon: 'sym-bonus' },
  ];
  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private icon!: Phaser.GameObjects.Image;
  private nextBtn!: TextButton;
  private dots: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, onDone: () => void) {
    super(scene, { title: 'TUTORIAL', width: 820, height: 520, closeOnBackdrop: false, onClose: onDone });
    this.icon = scene.add.image(-250, 0, 'sym-jaguar').setDisplaySize(190, 190);
    this.titleText = scene.add.text(-120, -110, '', uiStyle(26, { color: '#ffd978', fontStyle: '900', wordWrap: { width: 470 } }));
    this.bodyText = scene.add.text(-120, -60, '', uiStyle(21, { color: '#fff3d6', wordWrap: { width: 470 }, lineSpacing: 6 }));
    this.nextBtn = new TextButton(scene, 230, 190, { label: 'PRÓXIMO', width: 220, height: 60, variant: 'gold', fontSize: 22, onClick: () => this.advance() });
    const skip = new TextButton(scene, -230, 190, { label: 'PULAR', width: 180, height: 60, variant: 'dark', fontSize: 20, onClick: () => void this.close() });
    this.content.add([this.icon, this.titleText, this.bodyText, this.nextBtn, skip]);
    this.steps.forEach((_, i) => {
      const dot = scene.add.circle(-20 + i * 24, 190, 7, 0xffc83a, i === 0 ? 1 : 0.3);
      this.dots.push(dot);
      this.content.add(dot);
    });
    this.render();
  }

  private render(): void {
    const s = this.steps[this.step];
    this.titleText.setText(s.title);
    this.bodyText.setText(s.text);
    this.icon.setTexture(s.icon).setDisplaySize(190, 190);
    this.nextBtn.setLabel(this.step === this.steps.length - 1 ? 'COMEÇAR' : 'PRÓXIMO');
    this.dots.forEach((d, i) => d.setAlpha(i === this.step ? 1 : 0.3));
    this.scene.tweens.add({ targets: [this.icon], scale: { from: this.icon.scale * 0.8, to: this.icon.scale }, duration: 300, ease: 'Back.easeOut' });
  }

  private advance(): void {
    if (this.step >= this.steps.length - 1) {
      void this.close();
      return;
    }
    this.step += 1;
    this.render();
  }
}
