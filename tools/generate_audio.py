#!/usr/bin/env python3
"""Gera TODOS os sons do Jaguar Gold proceduralmente (síntese com numpy) e codifica em OGG + MP3 via ffmpeg.

Saída: public/assets/jaguar-gold/audio/<nome>.ogg e .mp3 (os .wav intermediários são apagados).

Os sons são originais, criados por síntese (sem samples de terceiros). Licença: mesma do projeto.
Dependências: numpy, ffmpeg (com libvorbis e libmp3lame).
Uso: python3 tools/generate_audio.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'jaguar-gold' / 'audio'
rng = np.random.default_rng(20261023)


# ---------------------------------------------------------------- utilidades

def t(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur)) / SR


def env_adsr(n: int, a: float, d: float, s: float, r: float, sustain_level: float = 0.7) -> np.ndarray:
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, max(1, a_n)),
        np.linspace(1, sustain_level, max(1, d_n)),
        np.full(s_n, sustain_level),
        np.linspace(sustain_level, 0, max(1, r_n)),
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def exp_decay(n: int, tau: float) -> np.ndarray:
    return np.exp(-np.arange(n) / (tau * SR))


def sine(freq: float, dur: float, phase: float = 0.0) -> np.ndarray:
    return np.sin(2 * np.pi * freq * t(dur) + phase)


def saw(freq: float, dur: float) -> np.ndarray:
    x = (freq * t(dur)) % 1.0
    return 2 * x - 1


def tri(freq: float, dur: float) -> np.ndarray:
    return 2 * np.abs(saw(freq, dur)) - 1


def noise(dur: float) -> np.ndarray:
    return rng.uniform(-1, 1, int(SR * dur))


def lowpass_fast(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Versão vetorizada (via FFT) para sinais longos como a música."""
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    gain = 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec * gain, n)


def bandpass_fast(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    gain = (1 / np.sqrt(1 + (lo / np.maximum(freqs, 1)) ** 4)) * (1 / np.sqrt(1 + (freqs / hi) ** 4))
    return np.fft.irfft(spec * gain, n)


def normalize(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def mix(*parts: tuple[np.ndarray, float, float]) -> np.ndarray:
    """mix((signal, start_seconds, gain), ...) → soma alinhada."""
    end = max(int(s * SR) + len(sig) for sig, s, _ in parts)
    out = np.zeros(end)
    for sig, s, g in parts:
        i = int(s * SR)
        out[i:i + len(sig)] += sig * g
    return out


def delay_fx(x: np.ndarray, time: float, feedback: float, wet: float) -> np.ndarray:
    d = int(time * SR)
    y = x.copy()
    for start in range(d, len(y), d):  # processa em blocos do tamanho do delay (vetorizado)
        end = min(len(y), start + d)
        y[start:end] += y[start - d:start - d + (end - start)] * feedback
    return x * (1 - wet) + y * wet


def ping(freq: float, dur: float, partials=(1, 2.76, 5.4), tau: float = 0.12) -> np.ndarray:
    """Som metálico curto (moeda/sino)."""
    out = np.zeros(int(SR * dur))
    for k, p in enumerate(partials):
        out += sine(freq * p, dur) * exp_decay(len(out), tau / (k + 1)) * (0.6 ** k)
    return out


def write_wav(path: Path, data: np.ndarray, stereo_width: float = 0.0) -> None:
    data = np.clip(data, -1, 1)
    if stereo_width > 0:
        # pseudo-estéreo leve: pequeno atraso em um canal
        d = int(0.0006 * SR)
        left = data
        right = np.concatenate([np.zeros(d), data[:-d]]) if d < len(data) else data
        frames = np.stack([left * 1.0, right * (1 - stereo_width * 0.1)], axis=1)
        channels = 2
    else:
        frames = data[:, None]
        channels = 1
    pcm = (frames * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav: Path) -> None:
    ogg = wav.with_suffix('.ogg')
    mp3 = wav.with_suffix('.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libvorbis', '-q:a', '4', str(ogg)], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k', str(mp3)], check=True)
    wav.unlink()


# ---------------------------------------------------------------- sons

def sfx_click() -> np.ndarray:
    n = int(SR * 0.06)
    x = sine(1900, 0.06) * exp_decay(n, 0.008) + noise(0.06) * exp_decay(n, 0.004) * 0.5
    return normalize(x, 0.6)


def sfx_spin_start() -> np.ndarray:
    dur = 0.55
    n = int(SR * dur)
    # whoosh: ruído com banda subindo
    nz = noise(dur)
    sweep = np.zeros(n)
    chunk = 2048
    for i in range(0, n, chunk):
        f = 300 + 2600 * (i / n) ** 1.3
        seg = nz[i:i + chunk]
        sweep[i:i + chunk] = bandpass_fast(seg, f * 0.6, f * 1.6)
    sweep *= env_adsr(n, 0.05, 0.1, 0.3, 0.7, 0.8)
    clunk = sine(90, 0.2) * exp_decay(int(SR * 0.2), 0.05) + sine(140, 0.2) * exp_decay(int(SR * 0.2), 0.03) * 0.5
    x = mix((sweep, 0, 0.8), (clunk, 0, 0.9))
    return normalize(x, 0.75)


def sfx_reel_loop() -> np.ndarray:
    dur = 1.0
    n = int(SR * dur)
    x = np.zeros(n)
    rate = 26
    period = SR // rate
    for i in range(0, n, period):
        amp = 0.6 + 0.4 * rng.random()
        ln = int(SR * 0.012)
        tick = (sine(1200 + rng.uniform(-150, 150), 0.012) * 0.6 + noise(0.012) * 0.4) * exp_decay(ln, 0.0025) * amp
        end = min(n, i + ln)
        x[i:end] += tick[:end - i]
    hum = (sine(85, dur) * 0.6 + sine(170, dur) * 0.25) * 0.5
    x = x * 0.9 + hum * 0.35
    # garante loop sem clique: janela curta nas pontas
    fade = int(SR * 0.004)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return normalize(x, 0.55)


def sfx_reel_stop() -> np.ndarray:
    dur = 0.32
    n = int(SR * dur)
    f = 150 * np.exp(-t(dur) * 14) + 55
    thud = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_decay(n, 0.07)
    click = noise(dur) * exp_decay(n, 0.006) * 0.9
    metal = ping(2300, dur, tau=0.05) * 0.35
    x = mix((thud, 0, 1.0), (click, 0, 0.7), (metal, 0.005, 1.0))
    return normalize(x, 0.9)


def sfx_win_line() -> np.ndarray:
    notes = [1046.5, 1318.5, 1568.0, 2093.0]
    parts = []
    for i, f in enumerate(notes):
        parts.append((ping(f, 0.5, partials=(1, 2.0, 3.0), tau=0.18), i * 0.07, 0.8))
    x = mix(*parts)
    return normalize(delay_fx(x, 0.12, 0.3, 0.25), 0.8)


def sfx_win_small() -> np.ndarray:
    notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    parts = [(ping(f, 0.7, partials=(1, 2.0, 4.0), tau=0.22), i * 0.08, 0.8) for i, f in enumerate(notes)]
    x = mix(*parts)
    return normalize(delay_fx(x, 0.15, 0.3, 0.3), 0.85)


def sfx_coins() -> np.ndarray:
    parts = []
    for i in range(16):
        f = rng.uniform(2800, 6200)
        parts.append((ping(f, 0.35, partials=(1, 1.58, 2.9), tau=0.07), i * 0.055 + rng.uniform(0, 0.02), 0.5 + 0.3 * rng.random()))
    x = mix(*parts)
    return normalize(x, 0.8)


def sfx_count_loop() -> np.ndarray:
    dur = 1.0
    n = int(SR * dur)
    x = np.zeros(n)
    rate = 22
    period = SR // rate
    for i in range(0, n, period):
        ln = int(SR * 0.03)
        tick = ping(2600 + rng.uniform(-200, 200), 0.03, partials=(1, 2.4), tau=0.012)
        end = min(n, i + ln)
        x[i:end] += tick[:end - i]
    fade = int(SR * 0.003)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return normalize(x, 0.45)


def brass(freq: float, dur: float, vib: float = 5.5) -> np.ndarray:
    tt = t(dur)
    f = freq * (1 + 0.006 * np.sin(2 * np.pi * vib * tt))
    phase = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(phase) + 0.5 * np.sin(2 * phase) + 0.3 * np.sin(3 * phase) + 0.18 * np.sin(4 * phase)) / 2.0
    x = lowpass_fast(x, 1800 + freq)
    return x * env_adsr(len(x), 0.03, 0.15, 0.6, 0.35, 0.75)


def crash(dur: float = 1.8) -> np.ndarray:
    n = int(SR * dur)
    return bandpass_fast(noise(dur), 3000, 12000) * exp_decay(n, 0.45)


def sfx_big_win() -> np.ndarray:
    chords = [[261.6, 329.6, 392.0], [349.2, 440.0, 523.3], [392.0, 493.9, 587.3], [523.3, 659.3, 784.0]]
    parts = []
    tpos = 0.0
    for ci, ch in enumerate(chords):
        d = 0.42 if ci < 3 else 1.6
        for f in ch:
            parts.append((brass(f, d), tpos, 0.35))
            parts.append((brass(f * 2, d), tpos, 0.12))
        tpos += d * 0.92
    parts.append((crash(), 0.0, 0.3))
    arp = [1046.5, 1318.5, 1568.0, 2093.0, 2637.0]
    for i, f in enumerate(arp):
        parts.append((ping(f, 0.6, partials=(1, 2.0, 3.0), tau=0.2), 1.25 + i * 0.09, 0.4))
    x = mix(*parts)
    return normalize(delay_fx(x, 0.2, 0.25, 0.25), 0.9)


def sfx_mega_win() -> np.ndarray:
    chords = [[261.6, 329.6, 392.0, 523.3], [293.7, 370.0, 440.0, 587.3], [329.6, 415.3, 493.9, 659.3], [349.2, 440.0, 523.3, 698.5], [392.0, 493.9, 587.3, 784.0]]
    parts = []
    tpos = 0.0
    for ci, ch in enumerate(chords):
        d = 0.38 if ci < 4 else 2.4
        for f in ch:
            parts.append((brass(f, d), tpos, 0.3))
            parts.append((brass(f / 2, d), tpos, 0.2))
            parts.append((brass(f * 2, d), tpos, 0.1))
        tpos += d * 0.9
    parts.append((crash(2.2), 0.0, 0.35))
    parts.append((crash(2.2), tpos - 0.2, 0.3))
    for i in range(18):
        f = rng.uniform(1800, 5200)
        parts.append((ping(f, 0.5, partials=(1, 2.1, 3.3), tau=0.15), 1.4 + i * 0.07, 0.35))
    x = mix(*parts)
    return normalize(delay_fx(x, 0.22, 0.3, 0.3), 0.92)


def sfx_bonus_enter() -> np.ndarray:
    dur = 2.8
    n = int(SR * dur)
    # riser: ruído filtrado subindo + seno subindo
    nz = noise(1.3)
    riser = np.zeros(len(nz))
    chunk = 2048
    m = len(nz)
    for i in range(0, m, chunk):
        f = 400 + 5000 * (i / m) ** 2
        riser[i:i + chunk] = bandpass_fast(nz[i:i + chunk], f * 0.7, f * 1.5)
    riser *= np.linspace(0.1, 1, m) ** 1.5
    tt = t(1.3)
    sw = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (tt / 1.3 * 2)) / SR) * np.linspace(0.2, 1, len(tt))
    # gongo
    gong = np.zeros(int(SR * 1.8))
    for k, p in enumerate([1, 1.5, 2.2, 3.1, 4.3, 5.9]):
        gong += sine(110 * p, 1.8) * exp_decay(len(gong), 0.9 / (k + 1) + 0.15) * (0.7 ** k)
    gong *= env_adsr(len(gong), 0.004, 0.2, 1.5, 0.1, 0.8)
    shimmer = [(ping(f, 0.8, partials=(1, 2.0, 3.0), tau=0.25), 1.3 + i * 0.1, 0.3) for i, f in enumerate([1568, 1975.5, 2349.3, 3136])]
    x = mix((riser, 0, 0.5), (sw, 0, 0.35), (gong, 1.25, 1.0), *shimmer)
    x = x[:n] if len(x) > n else x
    return normalize(delay_fx(x, 0.25, 0.3, 0.3), 0.9)


def sfx_anticipation() -> np.ndarray:
    dur = 1.6
    n = int(SR * dur)
    tt = t(dur)
    drone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (tt / dur * 0.8)) / SR) * 0.6
    pulse = (0.55 + 0.45 * np.sign(np.sin(2 * np.pi * (2.5 + 3 * tt / dur) * tt)))
    x = drone * pulse * np.linspace(0.4, 1, n)
    x += bandpass_fast(noise(dur), 800, 4000) * np.linspace(0, 0.35, n) ** 2
    return normalize(x, 0.7)


def music_ambient() -> np.ndarray:
    bpm = 84
    beat = 60 / bpm
    bars = 8
    dur = bars * 4 * beat
    n = int(SR * dur)
    x = np.zeros(n)
    tt = t(dur)
    # drone grave (A1) com respiração lenta
    drone = (sine(55, dur) * 0.5 + sine(110, dur) * 0.3 + sine(165, dur) * 0.12) * (0.75 + 0.25 * np.sin(2 * np.pi * tt / 9.5))
    x += drone * 0.22
    # pad: acordes em quartas/quintas lentamente alternados (Am – Fmaj7 – C – G) por 2 compassos cada
    prog = [[220, 261.6, 329.6, 392.0], [174.6, 220, 261.6, 329.6], [130.8, 196, 261.6, 329.6], [196, 246.9, 293.7, 392.0]]
    chord_len = 2 * 4 * beat
    for ci, ch in enumerate(prog):
        start = int(ci * chord_len * SR)
        ln = int(chord_len * SR)
        env = env_adsr(ln, 1.2, 0.5, chord_len - 2.4, 1.2, 0.8)
        pad = np.zeros(ln)
        for f in ch:
            pad += tri(f, chord_len) * 0.5 + sine(f * 1.003, chord_len) * 0.3
        pad = lowpass_fast(pad, 900)
        x[start:start + ln] += pad * env * 0.05
    # marimba/kalimba: arpejo pentatônico em colcheias
    scale = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5]
    pattern = [0, 2, 4, 6, 4, 2, 5, 3, 0, 2, 4, 5, 3, 6, 4, 1]
    eighth = beat / 2
    steps = int(dur / eighth)
    for s in range(steps):
        if s % 16 in (7, 15):
            continue
        f = scale[pattern[s % len(pattern)]] / (2 if (s // 16) % 2 else 1)
        ln = int(SR * 0.6)
        note = (sine(f, 0.6) * 0.7 + sine(f * 4, 0.6) * 0.15 + sine(f * 10, 0.6) * 0.05) * exp_decay(ln, 0.13)
        i = int(s * eighth * SR)
        end = min(n, i + ln)
        x[i:end] += note[:end - i] * 0.09 * (0.8 + 0.2 * rng.random())
    # tambor tribal: tempos 1 e 3 (e um ghost no 4.5)
    for b in range(bars * 4):
        if b % 4 in (0, 2):
            i = int(b * beat * SR)
            ln = int(SR * 0.35)
            f = 140 * np.exp(-t(0.35) * 18) + 48
            drum = np.sin(2 * np.pi * np.cumsum(f) / SR) * exp_decay(ln, 0.09)
            end = min(n, i + ln)
            x[i:end] += drum[:end - i] * 0.35
    # shaker nos contratempos
    for b in range(bars * 8):
        if b % 2 == 1:
            i = int(b * beat / 2 * SR)
            ln = int(SR * 0.08)
            sh = bandpass_fast(noise(0.08), 4000, 9000) * exp_decay(ln, 0.02)
            end = min(n, i + ln)
            x[i:end] += sh[:end - i] * 0.07
    # pássaros ocasionais
    for _ in range(6):
        i = int(rng.uniform(0, dur - 0.5) * SR)
        d = rng.uniform(0.12, 0.25)
        ln = int(SR * d)
        f0 = rng.uniform(2200, 3400)
        f = f0 * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(12, 20) * t(d)))
        chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_adsr(ln, 0.01, 0.02, d - 0.05, 0.02, 0.8)
        end = min(n, i + ln)
        x[i:end] += chirp[:end - i] * 0.035
    # reverb barato
    x = delay_fx(x, 0.31, 0.28, 0.2)
    x = delay_fx(x, 0.47, 0.2, 0.15)
    # loop sem emenda: a cauda (com reverb) é fundida no início e removida do fim
    cf = int(SR * 0.4)
    head = x[:cf].copy()
    tail = x[-cf:].copy()
    ramp = np.linspace(0, 1, cf)
    x[:cf] = head * ramp + tail * (1 - ramp)
    x = x[:-cf]
    return normalize(x, 0.8)


SOUNDS = {
    'music_ambient': (music_ambient, 0.3),
    'ui_click': (sfx_click, 0.0),
    'spin_start': (sfx_spin_start, 0.1),
    'reel_spin_loop': (sfx_reel_loop, 0.0),
    'reel_stop': (sfx_reel_stop, 0.1),
    'win_line': (sfx_win_line, 0.2),
    'win_small': (sfx_win_small, 0.2),
    'coins': (sfx_coins, 0.3),
    'count_loop': (sfx_count_loop, 0.0),
    'big_win': (sfx_big_win, 0.3),
    'mega_win': (sfx_mega_win, 0.3),
    'bonus_enter': (sfx_bonus_enter, 0.3),
    'anticipation': (sfx_anticipation, 0.2),
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (fn, width) in SOUNDS.items():
        data = fn()
        wav = OUT / f'{name}.wav'
        write_wav(wav, data, stereo_width=width)
        encode(wav)
        print(f'{name:16s} {len(data) / SR:5.2f}s → ogg/mp3')
    return 0


if __name__ == '__main__':
    sys.exit(main())
