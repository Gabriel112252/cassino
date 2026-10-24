import type Phaser from 'phaser';
import type { AudioManager } from '@audio/AudioManager';
import type { SettingsStore } from './SettingsStore';
import type { DemoWallet } from '@wallet/DemoWallet';

/** Serviços compartilhados entre cenas (criados uma vez em main.ts). */
export interface Services {
  settings: SettingsStore;
  audio: AudioManager;
  wallet: DemoWallet;
}

export const SERVICES_KEY = 'services';

export function getServices(scene: Phaser.Scene): Services {
  const s = scene.registry.get(SERVICES_KEY) as Services | undefined;
  if (!s) throw new Error('serviços não inicializados (registry.services)');
  return s;
}
