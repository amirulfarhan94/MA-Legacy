"""Synthesises the 30 s soundtrack for the promo (no samples, fully original).

    python3 promo/music.py   -> promo/out/music.wav

120 BPM, one bar = 2 s. Cues line up with the scene cuts in index.html:
  0.15 / 1.35 s lightning zaps, 2-3 s riser, 3 s impact + beat drop,
  whooshes into 7 / 14 / 21 s, riser + impact at 25 s, final chord from 29 s.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(3)

L = np.zeros(N)
R = np.zeros(N)


def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(pan, 0))
    R[i:i + len(sig)] += sig * gain * (1 + min(pan, 0))


def filt(sig, kind, freq, order=2):
    return sosfilt(butter(order, freq, btype=kind, fs=SR, output='sos'), sig)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(freq, t):
    return 2 * ((freq * t) % 1.0) - 1


# ---------- drums ----------
def kick():
    t = t_arr(0.45)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + 0.3 * np.exp(-t * 200) * rng.standard_normal(len(t)) * 0.3


def clap():
    t = t_arr(0.3)
    n = rng.standard_normal(len(t))
    env = np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) % 0.011) * 300) * (t < 0.035)
    return filt(n, 'bandpass', [900, 3500]) * env


def hat(open_=False):
    t = t_arr(0.25 if open_ else 0.06)
    return filt(rng.standard_normal(len(t)), 'highpass', 7000) * np.exp(-t * (18 if open_ else 70))


# ---------- tonal ----------
def pluck(freq, dur=0.4, bright=4000):
    t = t_arr(dur)
    s = saw(freq, t) + 0.6 * saw(freq * 1.005, t)
    s = filt(s, 'lowpass', bright)
    return s * np.exp(-t * 7) * np.minimum(1, t * 400)


def pad(freqs, dur):
    t = t_arr(dur)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.12, 0, 0.12):
            s += saw(f * 2 ** (det / 12), t + rng.random())
    s = filt(s / (len(freqs) * 3), 'lowpass', 1800)
    env = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.3)
    return s * env


def bass(freq, dur):
    t = t_arr(dur)
    s = 0.8 * np.sin(2 * np.pi * freq * t) + 0.35 * filt(saw(freq, t), 'lowpass', 600)
    return s * np.minimum(1, t * 300) * np.exp(-t * 3.5)


# ---------- fx ----------
def zap(dur=0.7):
    t = t_arr(dur)
    n = rng.standard_normal(len(t))
    crack = filt(n, 'highpass', 1500) * np.exp(-t * 18)
    crackle = n * (rng.random(len(t)) > 0.985) * np.exp(-t * 5) * 2
    buzz = np.sign(np.sin(2 * np.pi * 100 * t)) * 0.25 * np.exp(-t * 6)  # 50 Hz mains hum, rectified
    boom = np.sin(2 * np.pi * (40 + 60 * np.exp(-t * 20)) * t) * np.exp(-t * 6)
    return crack + crackle + filt(buzz, 'lowpass', 2500) + 0.8 * boom


def hum_flicker(dur=0.32):
    t = t_arr(dur)
    gate = np.array([1, 0, 1, 0.2, 1, 0, 1, 1])[np.minimum((t / 0.04).astype(int), 7)]
    s = filt(np.sign(np.sin(2 * np.pi * 100 * t)) + 0.3 * rng.standard_normal(len(t)), 'bandpass', [100, 3000])
    return s * gate * np.exp(-t * 4) * 0.5


def riser(dur):
    t = t_arr(dur)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    blk = 512
    zi = np.zeros((1, 2))
    for i in range(0, len(t), blk):
        f = 400 * (20 ** (i / len(t)))  # sweep the band up; carry filter state to avoid clicks
        sos = butter(1, [f * 0.7, min(f * 1.4, 18000)], btype='bandpass', fs=SR, output='sos')
        out[i:i + blk], zi = sosfilt(sos, n[i:i + blk], zi=zi)
    tone = np.sin(2 * np.pi * np.cumsum(200 * (4 ** (t / dur))) / SR) * 0.3
    return (out + tone) * (t / dur) ** 2


def whoosh(dur=0.6):
    t = t_arr(dur)
    env = np.sin(np.pi * t / dur) ** 2
    return filt(rng.standard_normal(len(t)), 'bandpass', [600, 5000]) * env * 0.6


def impact():
    t = t_arr(2.0)
    sub = np.sin(2 * np.pi * (35 + 80 * np.exp(-t * 12)) * t) * np.exp(-t * 2.2)
    crash = filt(rng.standard_normal(len(t)), 'highpass', 3000) * np.exp(-t * 2.5) * 0.4
    return sub + crash


# ---------- arrangement ----------
# Am - F - C - G, one chord per bar
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]

# intro (0-3 s)
add(pad([midi(45), midi(52)], 3.0), 0.0, 0.25)
add(zap(), 0.15, 0.55, -0.3)
add(zap(), 1.35, 0.55, 0.3)
for st in (0.35, 0.95, 1.55):
    add(hum_flicker(), st, 0.35)
add(riser(1.0), 2.0, 0.5)

add(impact(), 3.0, 0.9)
add(impact(), 25.0, 0.9)
add(riser(1.0), 24.0, 0.45)
for w in (6.6, 13.6, 20.6):
    add(whoosh(), w, 0.5)

# groove 3 s - 29 s
beat_end = 29.0
b = 3.0
k = kick()
sidechain = np.ones(N)
while b < beat_end - 1e-6:
    beat_idx = int(round((b - 3.0) / BEAT))
    add(k, b, 0.9)
    i = int(b * SR)
    duck = 1 - 0.55 * np.exp(-t_arr(0.25) * 14)
    sidechain[i:i + len(duck)] = np.minimum(sidechain[i:i + len(duck)], duck[: max(0, N - i)])
    if beat_idx % 2 == 1:
        add(clap(), b, 0.45)
    add(hat(), b + BEAT / 2, 0.22, 0.3)
    if b >= 7.0:
        add(hat(), b + BEAT / 4, 0.1, -0.3)
        add(hat(), b + 3 * BEAT / 4, 0.1, -0.3)
    if beat_idx % 8 == 7:
        add(hat(True), b + BEAT / 2, 0.15)
    b += BEAT

# harmony: bass 8ths + pads + plucks, bars from 3 s
bar = 3.0
bar_idx = 0
Lb, Rb = L.copy(), R.copy()
L[:] = 0
R[:] = 0
while bar < beat_end - 1e-6:
    root, notes = CHORDS[bar_idx % 4]
    add(pad([midi(n) for n in notes], 2.0), bar, 0.28)
    for e in range(8):
        add(bass(midi(root - 24 + (12 if e % 4 == 3 else 0)), 0.24), bar + e * 0.25, 0.42)
    if bar >= 7.0:  # arpeggio lead
        seq = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12]
        for e in range(8):
            n = seq[e % 4] + (12 if bar >= 21 and e % 4 == 2 else 0)
            add(pluck(midi(n), 0.35, 3500 if bar < 21 else 6000), bar + e * 0.25, 0.13, 0.4 if e % 2 else -0.4)
    bar += 2.0
    bar_idx += 1
L *= sidechain
R *= sidechain
L += Lb
R += Rb

# final chord ring-out
add(pad([midi(n) for n in (45, 57, 60, 64, 69)], 1.0), 29.0, 0.35)
add(impact()[: int(1.0 * SR)], 29.0, 0.35)

# ---------- master ----------
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 1.3)
fade = np.ones(N)
fn = int(0.5 * SR)
fade[-fn:] = np.linspace(1, 0, fn)
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) / 0.89

os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), 'out', 'music.wav')
with wave.open(path, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', path)
