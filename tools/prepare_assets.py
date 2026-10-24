#!/usr/bin/env python3
"""Prepara os assets do Jaguar Gold para uso no Phaser.

Entrada : public/assets/jaguar-gold/{symbols,ui,backgrounds,effects,animation}  (PNGs originais do pacote)
Saída   : public/assets/jaguar-gold/generated/**  (assets derivados, prontos para o jogo)

O que é gerado:
  symbols/<id>.png        símbolos normalizados em 256x256 (conteúdo ajustado em ~236px, centralizado, fragmentos soltos removidos)
  symbols/<id>_blur.png   variantes com motion blur vertical (256x320) usadas durante o giro rápido dos rolos
  coins/coin_sheet.png    spritesheet (7 quadros de 96x96) extraído da tira de moedas (fundo removido)
  mascot/jaguar_sheet.png spritesheet (5 quadros de 300x240) do mascote extraído da tira (fundo removido por flood-fill)
  mascot/chest_sheet.png  spritesheet (5 quadros de 220x200) do baú abrindo
  fx/*.png                texturas procedurais (glow, spark, fog, ray, vignette, firefly, coin_particle)
  effects/*.png           títulos/brilhos de vitória sem as faixas escuras de recorte nas bordas
  ui/reel_frame_tall.png  moldura com janelas mais altas (retrato): estica só as faixas sem gemas

Dependências: Pillow, numpy, scipy.
Uso: python3 tools/prepare_assets.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'assets' / 'jaguar-gold'
OUT = SRC / 'generated'

SYMBOLS = {
    'jaguar': 'jaguar.png',
    'mask': 'ancient_mask.png',
    'crown': 'crown.png',
    'diamond': 'diamond.png',
    'bell': 'bell.png',
    'clover': 'clover.png',
    'mango': 'mango.png',
    'cherries': 'cherries.png',
    'chest': 'treasure_chest.png',
    'wild': 'wild.png',
    'bonus': 'bonus.png',
}

SYMBOL_CANVAS = 256
SYMBOL_FIT = 236
BLUR_CANVAS_H = 320
BLUR_SIZE = 44


def ensure(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def keep_largest_component(img: Image.Image, alpha_threshold: int = 30) -> Image.Image:
    """Remove fragmentos soltos (ex.: restos de recorte na borda) mantendo o maior componente de alpha."""
    arr = np.array(img.convert('RGBA'))
    alpha = arr[:, :, 3]
    mask = alpha > alpha_threshold
    labels, n = ndimage.label(mask)
    if n <= 1:
        return Image.fromarray(arr, 'RGBA')
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    keep = int(np.argmax(sizes)) + 1
    # mantém também componentes grandes (> 12% do maior) para não apagar partes legítimas separadas
    big = {i + 1 for i, s in enumerate(sizes) if s >= 0.12 * sizes.max()}
    big.add(keep)
    drop = ~np.isin(labels, list(big))
    arr[drop, 3] = 0
    return Image.fromarray(arr, 'RGBA')


def normalize_symbol(img: Image.Image) -> Image.Image:
    img = keep_largest_component(img)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    scale = SYMBOL_FIT / max(w, h)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SYMBOL_CANVAS, SYMBOL_CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((SYMBOL_CANVAS - img.width) // 2, (SYMBOL_CANVAS - img.height) // 2))
    return canvas


def motion_blur_vertical(img: Image.Image, size: int = BLUR_SIZE) -> Image.Image:
    """Motion blur vertical em espaço pré-multiplicado para evitar franjas escuras."""
    canvas = Image.new('RGBA', (SYMBOL_CANVAS, BLUR_CANVAS_H), (0, 0, 0, 0))
    canvas.alpha_composite(img, (0, (BLUR_CANVAS_H - img.height) // 2))
    arr = np.array(canvas).astype(np.float32) / 255.0
    a = arr[:, :, 3:4]
    pre = arr[:, :, :3] * a
    pre_b = ndimage.uniform_filter1d(pre, size=size, axis=0, mode='constant')
    a_b = ndimage.uniform_filter1d(a, size=size, axis=0, mode='constant')
    # segunda passada menor para suavizar
    pre_b = ndimage.uniform_filter1d(pre_b, size=size // 2, axis=0, mode='constant')
    a_b = ndimage.uniform_filter1d(a_b, size=size // 2, axis=0, mode='constant')
    rgb = np.where(a_b > 1e-4, pre_b / np.maximum(a_b, 1e-4), 0)
    out = np.dstack([np.clip(rgb, 0, 1), np.clip(a_b * 0.92, 0, 1)])
    return Image.fromarray((out * 255).astype(np.uint8), 'RGBA')


def flood_key(img: Image.Image, soft_lo: float = 22, soft_hi: float = 64, candidate: float = 70) -> Image.Image:
    """Remove o fundo escuro conectado às bordas (flood-fill), preservando áreas escuras internas (pintas do jaguar)."""
    rgb = np.array(img.convert('RGB')).astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    cand = dist < candidate
    labels, n = ndimage.label(cand)
    edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    edge_labels.discard(0)
    bg_mask = np.isin(labels, list(edge_labels))
    alpha = np.ones(dist.shape, dtype=np.float32)
    soft = np.clip((dist - soft_lo) / (soft_hi - soft_lo), 0, 1)
    alpha[bg_mask] = soft[bg_mask]
    # suaviza a borda da máscara
    alpha = ndimage.gaussian_filter(alpha, 0.6)
    out = np.dstack([rgb.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def split_columns(img: Image.Image, min_gap: int = 6, min_width: int = 30, alpha_threshold: int = 40):
    """Divide uma tira horizontal em recortes usando colunas vazias (alpha) como separadores."""
    arr = np.array(img)
    cov = (arr[:, :, 3] > alpha_threshold).sum(axis=0)
    runs = []
    start = None
    gap = 0
    for x, v in enumerate(cov):
        if v > 0:
            if start is None:
                start = x
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    runs.append((start, x - gap))
                    start = None
                    gap = 0
    if start is not None:
        runs.append((start, len(cov) - 1))
    return [(a, b) for a, b in runs if b - a >= min_width]


def split_at_valleys(img: Image.Image, n: int, alpha_threshold: int = 60) -> list[Image.Image]:
    """Divide uma tira em n recortes cortando nas colunas de menor cobertura perto de cada divisão esperada."""
    arr = np.array(img)
    cov = (arr[:, :, 3] > alpha_threshold).sum(axis=0).astype(np.float32)
    cov = ndimage.uniform_filter1d(cov, 7)
    step = img.width / n
    cuts = [0]
    for i in range(1, n):
        expected = i * step
        lo, hi = int(expected - step * 0.3), int(expected + step * 0.3)
        cuts.append(lo + int(np.argmin(cov[lo:hi])))
    cuts.append(img.width)
    return [img.crop((cuts[i], 0, cuts[i + 1], img.height)) for i in range(n)]


def build_sheet(frames: list[Image.Image], fw: int, fh: int, fit: int, align: str = 'center') -> Image.Image:
    sheet = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        bbox = f.getbbox()
        if bbox:
            f = f.crop(bbox)
        s = min(fit / max(f.width, f.height), 1.0 if max(f.width, f.height) < fit else fit / max(f.width, f.height))
        s = fit / max(f.width, f.height)
        f = f.resize((max(1, round(f.width * s)), max(1, round(f.height * s))), Image.LANCZOS)
        x = i * fw + (fw - f.width) // 2
        y = (fh - f.height) // 2 if align == 'center' else fh - f.height - 4
        sheet.alpha_composite(f, (x, y))
    return sheet


# ---------- texturas procedurais ----------

def radial_glow(size: int, power: float = 2.2, color=(255, 255, 255)) -> Image.Image:
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    r = np.sqrt((x - c) ** 2 + (y - c) ** 2) / c
    a = np.clip(1 - r, 0, 1) ** power
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[:, :, 0], arr[:, :, 1], arr[:, :, 2] = color
    arr[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def spark(size: int = 64) -> Image.Image:
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    dx, dy = (x - c) / c, (y - c) / c
    r = np.sqrt(dx ** 2 + dy ** 2)
    core = np.clip(1 - r * 1.6, 0, 1) ** 1.5
    ang = np.arctan2(dy, dx)
    rays = (np.abs(np.cos(ang * 2)) ** 14) * np.clip(1 - r, 0, 1) ** 1.2
    a = np.clip(core + rays * 0.9, 0, 1)
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[:, :, :3] = 255
    arr[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def fog(w: int = 512, h: int = 256, seed: int = 7) -> Image.Image:
    rng = np.random.default_rng(seed)
    noise = np.zeros((h, w), dtype=np.float32)
    for octave, amp in [(8, 1.0), (16, 0.5), (32, 0.25), (64, 0.12)]:
        small = rng.random((h // octave + 2, w // octave + 2)).astype(np.float32)
        big = ndimage.zoom(small, octave, order=3)[:h, :w]
        noise += big * amp
    noise /= noise.max()
    # falloff nas bordas para poder usar como sprite flutuante
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    ex = np.clip(1 - np.abs((x - w / 2) / (w / 2)), 0, 1) ** 0.8
    ey = np.clip(1 - np.abs((y - h / 2) / (h / 2)), 0, 1) ** 0.8
    a = np.clip((noise - 0.35) / 0.65, 0, 1) * ex * ey
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, :3] = 255
    arr[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def ray(w: int = 96, h: int = 512) -> Image.Image:
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    ax = np.clip(1 - np.abs((x - w / 2) / (w / 2)), 0, 1) ** 1.8
    ay = np.clip(1 - y / h, 0, 1) ** 1.2 * np.clip(y / (h * 0.08), 0, 1)
    a = ax * ay
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, :3] = 255
    arr[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def vignette(w: int = 512, h: int = 288) -> Image.Image:
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = (x - w / 2) / (w / 2)
    dy = (y - h / 2) / (h / 2)
    r = np.sqrt(dx ** 2 + dy ** 2)
    a = np.clip((r - 0.55) / 0.7, 0, 1) ** 1.6
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def coin_particle(size: int = 48) -> Image.Image:
    img = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size * 4
    d.ellipse([4, 4, s - 4, s - 4], fill=(255, 196, 40, 255), outline=(170, 100, 10, 255), width=10)
    d.ellipse([s * 0.22, s * 0.22, s * 0.78, s * 0.78], outline=(255, 235, 150, 255), width=8)
    d.ellipse([s * 0.3, s * 0.18, s * 0.6, s * 0.42], fill=(255, 245, 200, 180))
    img = img.resize((size, size), Image.LANCZOS)
    return img


def gradient_strip(w: int = 16, h: int = 256) -> Image.Image:
    """Gradiente vertical (branco opaco → transparente) para sombras internas das janelas dos rolos."""
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    y = np.linspace(1, 0, h).astype(np.float32) ** 1.6
    arr[:, :, 3] = (y * 255).astype(np.uint8)[:, None]
    return Image.fromarray(arr, 'RGBA')


def main() -> int:
    if not SRC.exists():
        print(f'Pasta de assets não encontrada: {SRC}', file=sys.stderr)
        return 1
    sym_out = ensure(OUT / 'symbols')
    coins_out = ensure(OUT / 'coins')
    mascot_out = ensure(OUT / 'mascot')
    fx_out = ensure(OUT / 'fx')

    # --- símbolos
    for sid, fname in SYMBOLS.items():
        img = Image.open(SRC / 'symbols' / fname).convert('RGBA')
        norm = normalize_symbol(img)
        norm.save(sym_out / f'{sid}.png', optimize=True)
        motion_blur_vertical(norm).save(sym_out / f'{sid}_blur.png', optimize=True)
        print('símbolo', sid, norm.size)

    # --- moedas (tira ilustrativa → spritesheet)
    coins = Image.open(SRC / 'animation' / 'coins_frames_strip.png').convert('RGB')
    coins = coins.crop((0, 18, coins.width, coins.height))  # remove o título da tira
    keyed = flood_key(coins)
    cols = split_columns(keyed, min_gap=4, min_width=40)
    frames = [keyed.crop((a, 0, b + 1, keyed.height)) for a, b in cols]
    frames = frames[:7]
    sheet = build_sheet(frames, 96, 96, 88)
    sheet.save(coins_out / 'coin_sheet.png', optimize=True)
    print('moedas: quadros =', len(frames), 'sheet', sheet.size)

    # --- mascote (jaguar) — as cabeças se sobrepõem na tira: corta nos "vales" de cobertura e mantém o maior componente
    jag = Image.open(SRC / 'animation' / 'jaguar_frames_strip.png').convert('RGB')
    jag = jag.crop((0, 18, jag.width, jag.height - 5))
    keyed = flood_key(jag, candidate=58)
    frames = [keep_largest_component(f, alpha_threshold=60) for f in split_at_valleys(keyed, 5)]
    sheet = build_sheet(frames, 300, 240, 232, align='bottom')
    sheet.save(mascot_out / 'jaguar_sheet.png', optimize=True)
    print('mascote: quadros =', len(frames), 'sheet', sheet.size)

    # --- baú (bônus)
    chest = Image.open(SRC / 'animation' / 'chest_frames_strip.png').convert('RGB')
    chest = chest.crop((0, 18, chest.width, chest.height))
    keyed = flood_key(chest, candidate=58)
    cols = split_columns(keyed, min_gap=3, min_width=80)
    frames = [keyed.crop((a, 0, b + 1, keyed.height)) for a, b in cols][:5]
    if len(frames) < 5:
        step = keyed.width / 5
        frames = [keyed.crop((round(i * step), 0, round((i + 1) * step), keyed.height)) for i in range(5)]
    sheet = build_sheet(frames, 220, 200, 196, align='bottom')
    sheet.save(mascot_out / 'chest_sheet.png', optimize=True)
    print('baú: quadros =', len(frames), 'sheet', sheet.size)

    # --- efeitos (big win, flares, anel): os recortes trazem faixas escuras/claras nas bordas que
    # aparecem como linhas finas na tela (principalmente com blend aditivo). Corta 10 px por lado
    # e remove o fundo escuro conectado à borda.
    effects_out = ensure(OUT / 'effects')
    for name in ['big_win', 'mega_win', 'coins_burst', 'golden_flare', 'golden_ring', 'purple_flare']:
        fx = Image.open(SRC / 'effects' / f'{name}.png').convert('RGBA')
        fx = fx.crop((10, 6, fx.width - 10, fx.height - 6))
        keyed = flood_key(fx, soft_lo=18, soft_hi=56, candidate=62)
        # mantém a transparência original onde ela já existia e suaviza as 4 bordas (14 px),
        # eliminando qualquer resto de recorte que vire uma linha com blend aditivo
        orig_alpha = np.array(fx)[:, :, 3].astype(np.float32) / 255.0
        arr = np.array(keyed)
        h2, w2 = arr.shape[:2]
        yy, xx = np.mgrid[0:h2, 0:w2].astype(np.float32)
        feather = 14.0
        edge = np.minimum(np.minimum(xx, w2 - 1 - xx), np.minimum(yy, h2 - 1 - yy))
        ramp = np.clip(edge / feather, 0, 1)
        arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * orig_alpha * ramp).astype(np.uint8)
        Image.fromarray(arr, 'RGBA').save(effects_out / f'{name}.png', optimize=True)
        print('efeito', name, fx.size)

    # --- moldura alta (retrato): insere altura nas faixas laterais sem gemas (acima/abaixo das gemas
    # laterais, que ficam em y≈186..254 na imagem original) para não distorcer os ornamentos.
    ui_out = ensure(OUT / 'ui')
    frame = Image.open(SRC / 'ui' / 'reel_frame.png').convert('RGBA')
    fw, fh = frame.size
    extra = 118
    ea, eb = extra // 2, extra - extra // 2
    parts = [
        frame.crop((0, 0, fw, 150)),
        frame.crop((0, 150, fw, 186)).resize((fw, 36 + ea), Image.LANCZOS),
        frame.crop((0, 186, fw, 254)),
        frame.crop((0, 254, fw, 300)).resize((fw, 46 + eb), Image.LANCZOS),
        frame.crop((0, 300, fw, fh)),
    ]
    tall = Image.new('RGBA', (fw, fh + extra), (0, 0, 0, 0))
    yy = 0
    for part in parts:
        tall.paste(part, (0, yy))
        yy += part.size[1]
    tall.save(ui_out / 'reel_frame_tall.png', optimize=True)
    print('moldura alta', tall.size, '(janelas y 79..', 380 + extra, ')')

    # --- fx procedurais
    radial_glow(128, 2.2).save(fx_out / 'glow_soft.png')
    radial_glow(64, 1.4).save(fx_out / 'glow_hard.png')
    radial_glow(32, 2.0).save(fx_out / 'firefly.png')
    spark(64).save(fx_out / 'spark.png')
    fog(512, 256).save(fx_out / 'fog.png')
    ray(96, 512).save(fx_out / 'ray.png')
    vignette(512, 288).save(fx_out / 'vignette.png')
    coin_particle(48).save(fx_out / 'coin_particle.png')
    gradient_strip(16, 256).save(fx_out / 'gradient_v.png')
    # pixel branco para retângulos tintados (mais barato que Graphics em massa)
    Image.new('RGBA', (4, 4), (255, 255, 255, 255)).save(fx_out / 'white.png')
    print('fx ok →', fx_out)

    # --- fundo: versão levemente desfocada/escurecida para modais e para o lobby
    bg = Image.open(SRC / 'backgrounds' / 'jungle_temple_1600x900.png').convert('RGB')
    dark = bg.filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * 0.55))
    dark.save(ensure(OUT / 'backgrounds') / 'jungle_temple_dim.jpg', quality=82)
    print('fundo dim ok')
    return 0


if __name__ == '__main__':
    sys.exit(main())
