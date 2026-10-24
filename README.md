# Cassino DEMO — Jaguar Gold

Cassino online **demonstrativo** (créditos fictícios, sem dinheiro real) com o caça-níquel original
**Jaguar Gold**: 3 rolos × 3 linhas, 5 linhas de pagamento, Wild, Bônus com giros grátis e
multiplicador crescente até x10.

Construído como um **jogo HTML5 de verdade** em Phaser 3 + TypeScript: rolos contínuos com máscara,
aceleração, motion blur, paradas escalonadas com impacto elástico, partículas, Big/Mega Win,
mascote animado, áudio sintetizado próprio e layout responsivo (desktop e celular, paisagem e retrato).

> **DEMO — CRÉDITOS FICTÍCIOS.** Não há dinheiro real, depósitos, saques, PIX, cartão, gateways ou prêmios
> resgatáveis. Resultados simulados por sorteio local. Não é um jogo regulamentado nem possui RTP certificado.

| Mesa (paisagem) | Big Win | Giros grátis |
| --- | --- | --- |
| ![mesa](docs/screenshots/jaguar-gold-landscape.jpg) | ![big win](docs/screenshots/jaguar-gold-big-win.jpg) | ![giros grátis](docs/screenshots/jaguar-gold-free-spins.jpg) |

| Linhas vencedoras | Tabela de pagamentos | Celular (retrato) |
| --- | --- | --- |
| ![linhas](docs/screenshots/jaguar-gold-win-lines.jpg) | ![pagamentos](docs/screenshots/jaguar-gold-paytable.jpg) | ![retrato](docs/screenshots/jaguar-gold-portrait.jpg) |

Capturas geradas pela verificação automatizada (`npm run check:visual`) em Chromium headless.

---

## Executar

Requisitos: Node 20+ (testado com Node 22). Python 3 + Pillow/numpy/scipy + ffmpeg só são necessários
para **regenerar** assets/áudio (os arquivos gerados já estão versionados).

```bash
npm install
npm run dev          # http://localhost:5173  (com ganchos de depuração)
npm test             # testes da lógica (Vitest)
npm run build        # typecheck + build de produção em dist/
npm run preview      # serve dist/ em http://localhost:4173
```

Outros scripts:

| script                   | o que faz                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `npm run typecheck`      | `tsc --noEmit`                                                            |
| `npm run rtp`            | imprime o relatório de RTP teórico (enumeração exata + simulação do bônus) |
| `npm run assets:prepare` | regenera `public/assets/jaguar-gold/generated/**` a partir dos PNGs       |
| `npm run assets:audio`   | sintetiza todos os sons/músicas em `public/assets/jaguar-gold/audio/`     |
| `npm run check:visual`   | abre o jogo em Chromium headless, gira, força Big/Mega Win e bônus e salva capturas em `screenshots/` |

Atalhos no jogo: **Espaço** gira / para, **T** alterna o Turbo. `#lobby` na URL abre a página inicial do cassino.
`?fx=low` força o modo de qualidade reduzida (menos névoa/raios) — ativado sozinho em aparelhos com ≤ 2 núcleos.

### Docker / Easypanel

```bash
docker build -t cassino-demo .
docker run --rm -p 8080:80 cassino-demo     # http://localhost:8080
```

O `Dockerfile` é multi-stage (Node 22 → nginx alpine), roda typecheck + testes + build na imagem,
expõe a porta **80**, tem `HEALTHCHECK` em `/healthz` e não precisa de variáveis de ambiente.
No Easypanel: *App → Source: GitHub (este repositório) → Build: Dockerfile → porta 80*.

---

## O jogo

| Item               | Valor                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Grade              | 3 rolos × 3 linhas, tiras (strips) de 36 posições por rolo                                |
| Linhas             | 5 — meio, topo, base, diagonal descendente, diagonal ascendente                           |
| Apostas            | 5, 10, 20, 50, 100 e 200 créditos por giro (aposta por linha = total ÷ 5)                 |
| Símbolos           | Jaguar, Máscara ancestral, Coroa, Diamante, Sino, Trevo, Manga, Cerejas, Baú, WILD, BÔNUS |
| Wild               | substitui qualquer símbolo exceto o Bônus; 3 Wilds pagam o prêmio máximo (300× linha)     |
| Bônus (scatter)    | 3 em qualquer posição: 2× a aposta total + **10 giros grátis**                            |
| Giros grátis       | multiplicador começa em x2, +1 a cada giro vencedor até **x10**; reaciona com +5 giros    |
| Big Win / Mega Win | a partir de 10× / 30× a aposta total                                                      |
| Saldo inicial      | 1.000 créditos fictícios (persistidos em `localStorage`, com botão de reinício)           |
| RTP teórico        | ≈ 95,7 % (jogo base 82,1 % + bônus) — ver `npm run rtp`; **não certificado**              |

Experiência do jogador: botão GIRAR luminoso (vira PARAR durante o giro), controle de aposta, AUTO 10,
modo TURBO, painel de créditos com contador animado, último prêmio, histórico de giros, tabela de
pagamentos e regras, configurações de áudio (música e efeitos com volume), tutorial na primeira execução,
indicador permanente **DEMO — CRÉDITOS FICTÍCIOS**.

### Mecânica dos rolos (`src/games/jaguar-gold/reels/`)

Cada rolo é um `Container` com uma tira de sprites (3 visíveis + 2 de folga) dentro de uma
`GeometryMask`. O giro é uma máquina de estados por frame:

1. **nudge** — o rolo recua levemente (tween) ao apertar GIRAR;
2. **accel** — acelera até ~22 linhas/s; acima de 9 linhas/s os sprites trocam para as texturas com
   *motion blur* vertical (geradas por `tools/prepare_assets.py`);
3. **spin** — velocidade constante; símbolos cosméticos entram pelo topo;
4. **landing** — desaceleração física exata (`v² = 2·a·d`) até que os 3 símbolos do **resultado**
   (calculado antes da animação) entrem pelo topo e parem nas linhas visíveis, passando um pouco;
5. **bounce** — retorno elástico (`Back.easeOut`), som de parada, tremor da câmera no último rolo.

Os rolos param da esquerda para a direita; se 2 Bônus já estão na tela, o último rolo gira mais tempo
com brilho e som de **antecipação**. Tocar em PARAR encurta o giro sem alterar o resultado.

### Regras de segurança da lógica (`src/game/core/`, cobertas por testes)

- RNG (`CryptoRng`, Web Crypto com *rejection sampling*) vive só na lógica; a cena apenas reproduz.
- O resultado é calculado **antes** da animação e a animação reproduz exatamente esse grid.
- A aposta é debitada **uma vez** por rodada (idempotência por `roundId`), o prêmio creditado uma vez.
- Não há giros concorrentes (`GameSession` é uma máquina de estados `idle → spinning → idle`).
- O saldo nunca fica negativo; giros grátis não debitam e travam a aposta.
- Nada lê saldo, histórico ou perfil para influenciar o sorteio (teste: mesma semente ⇒ mesmo resultado).

Robustez em tempo de execução (`src/main.ts`): quadros de até 2 s contam como tempo real (sem "câmera lenta"
em aparelhos fracos), tweens e timers compartilham o mesmo relógio, e um *watchdog* religa o laço do Phaser
se alguma exceção inesperada o interromper — a tela nunca fica congelada.

---

## Estrutura

```
src/
  main.ts                      bootstrap do Phaser (WebGL, fallback Canvas), escala responsiva
  config/app.config.ts         saldo inicial, chaves de storage, textos de aviso
  game/
    core/                      lógica pura (sem Phaser): tipos, RNG, avaliação de linhas, engine,
                               sessão (carteira + engine), análise de RTP
    scenes/                    Boot, Preload (barra dourada), Lobby (página inicial multi-jogos)
    registry.ts                registro de jogos do cassino
    responsive.ts              resolução lógica por orientação (lado menor = 1080)
    SettingsStore.ts           preferências (áudio, turbo, tutorial) em localStorage
  games/jaguar-gold/
    math.config.ts             símbolos, prêmios, tiras, linhas, bônus, apostas
    assets.ts                  manifesto de imagens/spritesheets + geometria da moldura
    layout.ts                  posições de tudo em paisagem e retrato
    JaguarGoldScene.ts         cena principal (orquestra rodada, HUD, apresentações)
    reels/                     Reel (rolo contínuo) e ReelSet (escalonamento/antecipação)
    presentation/              AmbientFx, WinPresenter, BigWinOverlay, FreeSpinsPresenter, Mascot
    hud/                       Hud (placas, botões) e modais (pagamentos, histórico, config, tutorial)
  audio/                       AudioManager (Howler.js / Web Audio) + manifesto de sons
  wallet/                      DemoWallet (créditos fictícios) + storage
  ui/                          componentes Phaser: botões, placas, modal, slider, contador, estilos
tests/                         Vitest: avaliação, sessão, carteira, RTP
tools/                         prepare_assets.py, generate_audio.py, visual_check.mjs
public/assets/jaguar-gold/     PNGs do pacote de artes + generated/ + audio/
deploy/nginx.conf              servidor estático de produção
```

A interface do jogo é 100 % Phaser (WebGL); o HTML/CSS serve só para a página externa e o viewport.

---

## Assets e licenças

- **Imagens** (`public/assets/jaguar-gold/{symbols,ui,backgrounds,effects,animation}`): ilustrações
  originais geradas por IA para este projeto fictício (pacote *Jaguar Gold*), recortadas de pranchas de
  referência (`docs/reference/`). As pranchas **não** são usadas como tela do jogo; cada elemento é um
  asset individual. `tools/prepare_assets.py` normaliza os símbolos (256×256), gera as variantes com
  motion blur, extrai os quadros de moedas/jaguar/baú das tiras e cria as texturas procedurais de efeitos.
- **Áudio** (`public/assets/jaguar-gold/audio/`): 100 % sintetizado por `tools/generate_audio.py`
  (numpy/scipy → ogg + mp3). Nenhuma amostra de terceiros.
- **Fontes**: Cinzel e Montserrat (Google Fonts, licença SIL OFL) carregadas via `@fontsource`
  (empacotadas no build — funcionam offline).
- **Código**: Phaser 3 (MIT), Howler.js (MIT), Vite, Vitest. GSAP não foi necessário: todas as animações
  usam o sistema de tweens/timelines do próprio Phaser.

Nenhum asset, marca ou código proprietário de outros jogos foi utilizado.

---

## Verificação visual automatizada

`tools/visual_check.mjs` abre o jogo em um Chromium headless (WebGL via SwiftShader), fecha o tutorial,
executa um giro real, força Big Win, Mega Win e os giros grátis através dos ganchos de depuração
(`window.__jgDebug`, disponíveis em `vite dev` ou em builds com `VITE_DEBUG_HOOKS=1`), abre os modais e
captura também o layout de celular (retrato). As capturas vão para `screenshots/`.

```bash
npm run dev &                                   # servidor em 5173
CHROME_PATH=/caminho/para/chrome npm run check:visual
# máquinas sem GPU (muito lentas): TIME_FACTOR=1.5 CHROME_PATH=... npm run check:visual
```

---

## Limitações conhecidas

- Os quadros do mascote e do baú vêm de tiras ilustrativas sem registro perfeito; o mascote usa um
  medalhão com máscara circular e animações por tween para disfarçar a diferença entre quadros.
- O fundo 1600×900 foi ampliado a partir do pacote; em telas 4K pode perder nitidez.
- O áudio é sintetizado proceduralmente (sem orquestra real) — funcional e coerente, mas simples.
- O RTP é apenas teórico/simulado para uma demonstração; o jogo não é regulamentado.
- Não existe backend: saldo, histórico e preferências vivem no `localStorage` do navegador.

## Próximos passos sugeridos

- Página inicial com mais jogos (o `GAME_REGISTRY` e a `LobbyScene` já estão preparados).
- Backend opcional para ranking/estatísticas de demonstração (sem dinheiro real).
- Spritesheets dedicados para o mascote e o baú.
