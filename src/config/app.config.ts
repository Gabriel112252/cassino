/** Configurações globais do cassino DEMONSTRATIVO. */
export const APP_CONFIG = {
  name: 'Cassino DEMO',
  version: __APP_VERSION__,
  /** saldo inicial de créditos fictícios (em centavos) */
  initialBalance: 1000_00,
  storage: {
    wallet: 'cassino.demo-wallet.v1',
    settings: 'cassino.settings.v1',
    tutorialSeen: 'cassino.tutorial-seen.v1',
  },
  /** tamanho virtual (resolução lógica) — a lateral menor fica sempre em 1080 */
  design: {
    short: 1080,
    minLong: 1080,
    maxLong: 2600,
  },
  demoLabel: 'DEMO — CRÉDITOS FICTÍCIOS',
  disclaimer:
    'Jogo demonstrativo com créditos fictícios. Não há dinheiro real, depósitos, saques ou prêmios resgatáveis. ' +
    'Resultados simulados por sorteio local. Não é um jogo regulamentado nem possui RTP certificado.',
} as const;

declare global {
  // definido em vite.config.ts (define) — versão do package.json
  const __APP_VERSION__: string;
}
