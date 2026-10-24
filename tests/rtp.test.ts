import { describe, expect, it } from 'vitest';
import { SlotEngine } from '@game/core/SlotEngine';
import { computeRtpReport } from '@game/core/analysis';
import { JAGUAR_GOLD_INFO, JAGUAR_GOLD_MATH } from '@games/jaguar-gold/math.config';

/**
 * Relatório de RTP teórico do Jaguar Gold.
 * Jogo base: enumeração EXATA das 36^3 combinações. Giros grátis: simulação com RNG semeado.
 * Isto NÃO é uma certificação: é apenas a verificação de que a configuração está dentro da faixa
 * pretendida para uma demonstração (RTP total ~ 92–97%, frequência de prêmio ~ 20–35%).
 */
describe('RTP teórico (demo, não certificado)', () => {
  const engine = new SlotEngine(JAGUAR_GOLD_MATH);
  const report = computeRtpReport(engine, 20000);

  it('imprime o relatório', () => {
    const b = report.base;
    const f = report.freeSpins;
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '=== Jaguar Gold — RTP teórico (demo) ===',
        `combinações enumeradas : ${b.combinations}`,
        `RTP jogo base          : ${(b.rtp * 100).toFixed(2)}%`,
        `frequência de prêmio   : ${(b.hitFrequency * 100).toFixed(2)}%`,
        `P(acionar bônus)       : 1 em ${(1 / b.triggerProbability).toFixed(0)} giros`,
        `P(tela cheia ×10)      : 1 em ${(1 / b.fullScreenProbability).toFixed(0)} giros`,
        `P(big / mega / super)  : 1 em ${(1 / b.tierProbability.big).toFixed(0)} / 1 em ${(1 / b.tierProbability.mega).toFixed(0)} / 1 em ${(1 / b.tierProbability.super).toFixed(0)}`,
        `maior prêmio base      : ${b.maxWinMultiple.toFixed(1)}x a aposta (teto da rodada: ${JAGUAR_GOLD_MATH.maxWinMultiple}x)`,
        `EV do bônus            : ${f.expectedMultiple.toFixed(2)}x a aposta (média ${f.averageSpins.toFixed(1)} giros, mult. final médio ${f.averageMultiplierAtEnd.toFixed(2)})`,
        `RTP TOTAL              : ${(report.totalRtp * 100).toFixed(2)}%`,
        '',
      ].join('\n'),
    );
    expect(report.base.combinations).toBe(36 ** 3);
  });

  it('RTP total fica na faixa pretendida para a demonstração', () => {
    expect(report.totalRtp).toBeGreaterThan(0.9);
    expect(report.totalRtp).toBeLessThan(0.98);
  });

  it('frequência de prêmio e bônus são razoáveis', () => {
    expect(report.base.hitFrequency).toBeGreaterThan(0.18);
    expect(report.base.hitFrequency).toBeLessThan(0.4);
    expect(1 / report.base.triggerProbability).toBeGreaterThan(100);
    expect(1 / report.base.triggerProbability).toBeLessThan(400);
  });

  it('a tela cheia (super prêmio) existe e é rara', () => {
    expect(report.base.fullScreenProbability).toBeGreaterThan(0);
    expect(1 / report.base.fullScreenProbability).toBeGreaterThan(1000);
    expect(1 / report.base.fullScreenProbability).toBeLessThan(10000);
  });

  it('os números divulgados ao jogador batem com a matemática (tolerância)', () => {
    const b = report.base;
    const info = JAGUAR_GOLD_INFO;
    expect(Math.abs(report.totalRtp * 100 - info.rtpPercent)).toBeLessThan(1.5);
    expect(Math.abs(b.hitFrequency * 100 - info.hitFrequencyPercent)).toBeLessThan(2);
    expect(Math.abs(1 / b.triggerProbability - info.bonusOneIn) / info.bonusOneIn).toBeLessThan(0.1);
    expect(Math.abs(1 / b.fullScreenProbability - info.fullScreenOneIn) / info.fullScreenOneIn).toBeLessThan(0.1);
    expect(Math.abs(1 / b.tierProbability.super - info.superOneIn) / info.superOneIn).toBeLessThan(0.1);
    expect(Math.abs(1 / b.tierProbability.big - info.bigOneIn) / info.bigOneIn).toBeLessThan(0.1);
    expect(Math.abs(1 / b.tierProbability.mega - info.megaOneIn) / info.megaOneIn).toBeLessThan(0.1);
    expect(b.maxWinMultiple).toBe(info.maxBaseWinMultiple);
    expect(info.maxWinMultiple).toBe(JAGUAR_GOLD_MATH.maxWinMultiple);
  });
});
