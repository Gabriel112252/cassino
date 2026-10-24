import Phaser from 'phaser';
import { SCENE_KEYS } from '@game/registry';

/**
 * Primeira cena: carrega o mínimo para a tela de carregamento e espera as fontes web
 * (com tempo limite, para nunca travar sem internet).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.load.image('jg-logo', 'assets/jaguar-gold/ui/logo.png');
    this.load.image('fx-glow-soft', 'assets/jaguar-gold/generated/fx/glow_soft.png');
    this.load.image('jg-bg-dim', 'assets/jaguar-gold/generated/backgrounds/jungle_temple_dim.jpg');
  }

  create(): void {
    void waitForFonts(2500).then(() => this.scene.start(SCENE_KEYS.preload));
  }
}

async function waitForFonts(timeoutMs: number): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const fonts = document.fonts;
  const loads = [fonts.load('900 48px "Cinzel"'), fonts.load('700 48px "Cinzel"'), fonts.load('800 32px "Montserrat"'), fonts.load('700 32px "Montserrat"')];
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  try {
    await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
  } catch {
    /* segue com fontes de fallback */
  }
}
