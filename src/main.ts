import Phaser from 'phaser';
// fontes empacotadas no build (funcionam offline / dentro do Docker)
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-900.css';
import { AudioManager } from '@audio/AudioManager';
import { APP_CONFIG } from '@config/app.config';
import { SettingsStore } from '@game/SettingsStore';
import { computeGameSize, currentViewport } from '@game/responsive';
import { BootScene } from '@game/scenes/BootScene';
import { LobbyScene } from '@game/scenes/LobbyScene';
import { PreloadScene } from '@game/scenes/PreloadScene';
import { SERVICES_KEY, type Services } from '@game/services';
import { JaguarGoldScene } from '@games/jaguar-gold/JaguarGoldScene';
import { DemoWallet } from '@wallet/DemoWallet';

/**
 * Ponto de entrada. Cria os serviços compartilhados (configurações, áudio, carteira fictícia),
 * instancia o Phaser com renderização WebGL (fallback Canvas) e cuida da escala responsiva.
 */
function bootstrap(): void {
  const settings = new SettingsStore();
  const audio = new AudioManager(settings);
  const wallet = new DemoWallet({ storageKey: APP_CONFIG.storage.wallet, initialBalance: APP_CONFIG.initialBalance });
  const services: Services = { settings, audio, wallet };

  const vp = currentViewport();
  const size = computeGameSize(vp.width, vp.height);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#120a1a',
    width: size.width,
    height: size.height,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance',
      pixelArt: false,
      roundPixels: false,
    },
    // min:0.5 → quadros de até 2 s contam como tempo real (sem "câmera lenta" em aparelhos fracos);
    // panicMax:0 → sem período de aquecimento com delta fixo após o boot/retomada.
    fps: { target: 60, min: 0.5, smoothStep: true, panicMax: 0, forceSetTimeOut: false },
    input: { activePointers: 2, touch: { capture: true } },
    disableContextMenu: true,
    scene: [BootScene, PreloadScene, LobbyScene, JaguarGoldScene],
    callbacks: {
      preBoot: (g) => {
        g.registry.set(SERVICES_KEY, services);
      },
    },
  });

  // escala responsiva: a resolução lógica acompanha a proporção da janela (sem letterbox)
  let pending = 0;
  const applySize = () => {
    const v = currentViewport();
    const s = computeGameSize(v.width, v.height);
    if (s.width !== game.scale.gameSize.width || s.height !== game.scale.gameSize.height) {
      game.scale.resize(s.width, s.height);
    } else {
      game.scale.refresh();
    }
  };
  const scheduleResize = () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(applySize, 80);
  };
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  window.visualViewport?.addEventListener('resize', scheduleResize);

  installLoopWatchdog(game);

  document.getElementById('boot-note')?.classList.add('hidden');
  (window as unknown as { __cassino: { game: Phaser.Game; services: Services } }).__cassino = { game, services };
}

/**
 * Rede de segurança: uma exceção não tratada dentro de um callback do Phaser (tween, timer,
 * update) interrompe o requestAnimationFrame e congela o jogo. Aqui o erro é registrado e,
 * se o laço parou, ele é religado — o jogador nunca fica com a tela travada.
 */
function installLoopWatchdog(game: Phaser.Game): void {
  type Raf = { callback: (time: number) => void; isRunning: boolean; stop(): void; start(cb: (t: number) => void, force: boolean, target: number): void };
  const restart = () => {
    const loop = game.loop as Phaser.Core.TimeStep & { raf: Raf; forceSetTimeOut: boolean; _target: number };
    const raf = loop.raf;
    const cb = raf.callback;
    if (!loop.running || !cb) return;
    raf.stop();
    loop.resetDelta();
    raf.start(cb, loop.forceSetTimeOut, loop._target);
  };
  let lastFrame = -1;
  window.addEventListener('error', (ev) => {
    console.error('[cassino] erro não tratado', ev.error ?? ev.message);
    const frame = game.loop.frame;
    window.setTimeout(() => {
      if (game.loop.running && game.loop.frame === frame && document.visibilityState === 'visible') restart();
    }, 250);
  });
  window.addEventListener('unhandledrejection', (ev) => console.error('[cassino] promessa rejeitada', ev.reason));
  // verificação periódica (ex.: erro engolido por outro listener)
  window.setInterval(() => {
    if (document.visibilityState !== 'visible' || !game.loop.running) return;
    if (game.loop.frame === lastFrame) restart();
    lastFrame = game.loop.frame;
  }, 4000);
}

bootstrap();
