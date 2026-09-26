# Promo video — MA Legacy Solutions

`ma-legacy-promo.mp4` — 30 s, 1080×1920 (9:16) for TikTok / Instagram Reels / Facebook / WhatsApp Status.
Bahasa Malaysia on-screen text with an original synthesised soundtrack.

| Time | Scene |
|---|---|
| 0–3 s | Hook: lightning + "Masalah elektrik? Litar pintas? Suis trip? Lampu berkelip?" |
| 3–7 s | Logo reveal — *Perkhidmatan Elektrik, Domestik & Industri* |
| 7–14 s | **Domestik**: pendawaian, lampu & kipas, kotak DB & pemutus litar, baik pulih kerosakan |
| 14–21 s | **Industri**: pendawaian 3 fasa, panel & switchboard, pencahayaan kilang, penyelenggaraan berkala |
| 21–25 s | Kenapa pilih kami: selamat & kemas, tepat masa, harga berpatutan, laporan servis |
| 25–30 s | End card: logo + "Hubungi Kami Hari Ini!" |

## Re-rendering

```bash
pip install imageio-ffmpeg numpy scipy   # ffmpeg + audio synth
python3 promo/music.py                   # -> promo/out/music.wav
node promo/render.mjs --phone "01X-XXX XXXX" --line2 "WhatsApp untuk sebut harga"
```

- Edit text/timing in `promo/index.html`; open it with `?play` in a browser for a live preview,
  or `?t=12.5` to see a single moment.
- `node promo/render.mjs --stills 2,5,10` writes PNG stills to `promo/out/` for a quick check.
