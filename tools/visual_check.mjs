#!/usr/bin/env node
/**
 * Verificação visual automatizada (opcional): abre o jogo em um Chromium headless (WebGL via
 * SwiftShader), executa giros reais, força cenários (Big Win, Mega Win, Giros Grátis) via ganchos
 * de desenvolvimento e salva capturas em ./screenshots.
 *
 * Requisitos: servidor `npm run dev` rodando (os ganchos só existem em modo dev) e um Chromium:
 *   - npm i -D puppeteer-core @sparticuz/chromium   (chromium via npm, sem download externo)  ou
 *   - CHROME_PATH=/caminho/para/chrome node tools/visual_check.mjs
 *
 * Uso: node tools/visual_check.mjs [http://localhost:5173/]
 */
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const BASE_URL = process.argv[2] ?? 'http://localhost:5173/';
const OUT = path.resolve('screenshots');

async function launch() {
  const puppeteer = require('puppeteer-core');
  let executablePath = process.env.CHROME_PATH;
  let extraArgs = [];
  if (!executablePath) {
    const mod = require('@sparticuz/chromium');
    const chromium = mod.default ?? mod;
    executablePath = await chromium.executablePath();
    extraArgs = chromium.args;
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 600000,
    args: [
      ...extraArgs,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
}

/** Fator de tempo: em máquinas lentas (ex.: SwiftShader) use TIME_FACTOR=3 para esperar mais. */
const TIME_FACTOR = Number(process.env.TIME_FACTOR ?? '1') || 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * TIME_FACTOR));

async function waitForScene(page, key, timeout = 30000) {
  await page.waitForFunction((k) => window.__cassino?.game?.scene?.isActive(k), { timeout }, key);
}

async function waitIdle(page, timeout = 90000 * TIME_FACTOR) {
  await page.waitForFunction(() => window.__jgDebug && !window.__jgDebug.isBusy() && !window.__jgDebug.state().modalOpen, { timeout, polling: 200 });
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('📸', file);
}

async function clickCanvas(page, x, y) {
  // x,y em unidades do jogo → converte para CSS px usando o tamanho do canvas
  const pos = await page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector('canvas');
      const r = canvas.getBoundingClientRect();
      const g = window.__cassino.game;
      return { cx: r.left + (x / g.scale.gameSize.width) * r.width, cy: r.top + (y / g.scale.gameSize.height) * r.height };
    },
    { x, y },
  );
  await page.mouse.click(pos.cx, pos.cy);
}

async function layout(page) {
  return page.evaluate(() => window.__jgDebug.layout());
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await launch();
  const errors = [];
  const warnings = [];
  try {
    // ---------------- paisagem 1920x1080
    const page = await browser.newPage();
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error') errors.push(m.text());
      else if (t === 'warning') warnings.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await waitForScene(page, 'JaguarGoldScene');
    // o tutorial abre sozinho na primeira execução; espera ele aparecer e captura
    await page.waitForFunction(() => window.__jgDebug && window.__jgDebug.state().modalOpen, { timeout: 60000 * TIME_FACTOR, polling: 200 });
    await sleep(1200);
    await shot(page, '01-tutorial');
    await page.evaluate(() => {
      window.__jgDebug.closeTutorial();
      window.__jgDebug.closeModal();
    });
    await page.waitForFunction(() => !window.__jgDebug.state().modalOpen, { timeout: 30000 * TIME_FACTOR, polling: 200 });
    const l1 = await layout(page);
    await sleep(600);
    await shot(page, '02-landscape-idle');

    // giro real: captura quadros durante o movimento
    await clickCanvas(page, l1.spin.x, l1.spin.y);
    await sleep(380);
    await shot(page, '03-spin-accelerating');
    await sleep(500);
    await shot(page, '04-spin-blur');
    await sleep(900);
    await shot(page, '05-spin-stopping');
    await waitIdle(page);
    await sleep(400);
    await shot(page, '06-spin-result');

    // Big Win forçado (3 máscaras na linha do meio)
    await page.evaluate(() => window.__jgDebug.forceStops([11, 13, 12]));
    await page.evaluate(() => window.__jgDebug.spin());
    await sleep(4300);
    await shot(page, '07-big-win');
    await page.mouse.click(960, 540);
    await sleep(300);
    await page.mouse.click(960, 540);
    await waitIdle(page);

    // Mega Win forçado (3 jaguares)
    await page.evaluate(() => window.__jgDebug.forceStops([8, 10, 9]));
    await page.evaluate(() => window.__jgDebug.spin());
    await sleep(4800);
    await shot(page, '08-mega-win');
    await page.mouse.click(960, 540);
    await sleep(300);
    await page.mouse.click(960, 540);
    await waitIdle(page);
    await sleep(300);
    await shot(page, '09-after-mega-lines');

    // Giros grátis forçados (3 bônus) — antecipação + splash
    await page.evaluate(() => window.__jgDebug.forceStops([7, 12, 7]));
    await page.evaluate(() => window.__jgDebug.spin());
    await sleep(2400);
    await shot(page, '10-anticipation');
    await sleep(3200);
    await shot(page, '11-free-spins-intro');
    await page.evaluate(() => window.__jgDebug.randomRng());
    await sleep(6500);
    await shot(page, '12-free-spins-running');
    // acelera o restante do bônus (TURBO) para a verificação não demorar
    await page.evaluate(() => window.__jgDebug.setTurbo(true));
    await page.waitForFunction(() => !window.__jgDebug.state().freeSpins.active && !window.__jgDebug.isBusy(), { timeout: 600000 * TIME_FACTOR, polling: 300 });
    await page.evaluate(() => window.__jgDebug.setTurbo(false));
    await sleep(500);
    await shot(page, '13-after-free-spins');

    // modais
    await clickCanvas(page, l1.icons.help.x, l1.icons.help.y);
    await sleep(500);
    await shot(page, '14-paytable');
    await page.keyboard.press('Escape');
    await clickCanvas(page, 40, l1.height / 2); // clique fora fecha
    await sleep(400);
    await clickCanvas(page, l1.icons.settings.x, l1.icons.settings.y);
    await sleep(500);
    await shot(page, '15-settings');
    await clickCanvas(page, 40, l1.height / 2);
    await sleep(400);
    await clickCanvas(page, l1.icons.trophy.x, l1.icons.trophy.y);
    await sleep(500);
    await shot(page, '16-history');
    await clickCanvas(page, 40, l1.height / 2);
    await sleep(300);

    // paisagem estreita (tablet 4:3)
    await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
    await sleep(900);
    await shot(page, '17-landscape-4x3');
    await page.close();

    // ---------------- retrato (celular)
    const mobile = await browser.newPage();
    mobile.on('pageerror', (e) => errors.push(`pageerror(mobile): ${e.message}`));
    mobile.on('console', (m) => {
      if (m.type() === 'error') errors.push(`mobile: ${m.text()}`);
    });
    await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await mobile.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    await waitForScene(mobile, 'JaguarGoldScene');
    await sleep(1800);
    await mobile.evaluate(() => {
      window.__jgDebug.closeTutorial();
      window.__jgDebug.closeModal();
    });
    await sleep(600);
    await shot(mobile, '20-portrait-idle');
    const lm = await layout(mobile);
    await clickCanvas(mobile, lm.spin.x, lm.spin.y);
    await sleep(900);
    await shot(mobile, '21-portrait-spinning');
    await waitIdle(mobile);
    await sleep(300);
    await shot(mobile, '22-portrait-result');
    await clickCanvas(mobile, lm.icons.help.x, lm.icons.help.y);
    await sleep(500);
    await shot(mobile, '23-portrait-paytable');
    await mobile.close();
  } finally {
    await browser.close();
  }
  console.log(`\nerros de console: ${errors.length}`);
  for (const e of errors) console.log('  ✖', e);
  console.log(`avisos: ${warnings.length}`);
  for (const w of warnings.slice(0, 10)) console.log('  ⚠', w);
  if (errors.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
