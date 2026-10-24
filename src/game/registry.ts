/**
 * Registro de jogos do cassino. A página inicial (LobbyScene) lê daqui; cada jogo registra sua
 * cena principal e metadados. Novos jogos entram como novas pastas em src/games/<id>/.
 */
export interface GameEntry {
  id: string;
  title: string;
  subtitle: string;
  sceneKey: string;
  /** textura (já carregada pela PreloadScene) usada como capa no lobby */
  coverTexture: string;
  available: boolean;
}

export const GAME_REGISTRY: readonly GameEntry[] = [
  {
    id: 'jaguar-gold',
    title: 'Jaguar Gold',
    subtitle: 'Caça-níquel 3x3 · 5 linhas · Giros grátis até x10 · Super prêmio (tela cheia ×10) · Ganhe até 2.500× a aposta',
    sceneKey: 'JaguarGoldScene',
    coverTexture: 'jg-logo',
    available: true,
  },
  {
    id: 'em-breve-1',
    title: 'Em breve',
    subtitle: 'Novo jogo em desenvolvimento',
    sceneKey: '',
    coverTexture: '',
    available: false,
  },
  {
    id: 'em-breve-2',
    title: 'Em breve',
    subtitle: 'Novo jogo em desenvolvimento',
    sceneKey: '',
    coverTexture: '',
    available: false,
  },
];

export const SCENE_KEYS = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  lobby: 'LobbyScene',
  jaguarGold: 'JaguarGoldScene',
} as const;
