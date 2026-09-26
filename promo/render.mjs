// Renders promo/index.html frame-by-frame with headless Chromium and encodes it with ffmpeg.
//
//   node promo/render.mjs                         -> promo/out/ma-legacy-promo.mp4
//   node promo/render.mjs --phone "012-345 6789"  -> adds a contact number to the end card
//   node promo/render.mjs --stills 1,4,10,17,23,28 -> PNG stills only, for checking layout
//
// Needs: playwright (global install is fine), ffmpeg (FFMPEG env var or `pip install imageio-ffmpeg`),
// and promo/out/music.wav from `python3 promo/music.py`.
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = (() => {
  try { return require('playwright') } catch { return require('/opt/node22/lib/node_modules/playwright') }
})()

const dir = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(dir, 'out')
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true])
  return acc
}, []))
const FPS = Number(args.fps || 30)
const OUT = args.out || path.join(outDir, 'ma-legacy-promo.mp4')

const ffmpeg = process.env.FFMPEG || (() => {
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim() } catch { return 'ffmpeg' }
})()

const types = { '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript' }
const server = createServer(async (req, res) => {
  try {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!p.startsWith(dir)) throw new Error('outside')
    const body = await readFile(p.endsWith('/') ? path.join(p, 'index.html') : p)
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }).end(body)
  } catch { res.writeHead(404).end() }
}).listen(0)
const port = server.address().port

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
const qs = new URLSearchParams({ t: '0' })
if (args.phone) qs.set('phone', args.phone)
if (args.line2) qs.set('line2', args.line2)
await page.goto(`http://localhost:${port}/index.html?${qs}`)
await page.evaluate(() => window.ready)
const duration = await page.evaluate(() => window.DURATION)

if (args.stills) {
  for (const t of String(args.stills).split(',').map(Number)) {
    await page.evaluate(t => window.render(t), t)
    await writeFile(path.join(outDir, `still-${String(t).padStart(5, '0')}.png`), await page.screenshot())
  }
} else {
  const frames = Math.round(duration * FPS)
  const video = OUT.replace(/\.mp4$/, '.video.mp4')
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', video], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((ok, fail) => enc.on('close', c => c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`))))
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => window.render(t), f / FPS)
    const buf = await page.screenshot({ type: 'png' })
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r))
    if (f % 90 === 0) process.stdout.write(`frame ${f}/${frames}\n`)
  }
  enc.stdin.end()
  await done
  const music = path.join(outDir, 'music.wav')
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-i', music, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' })
  console.log(`wrote ${OUT}`)
}
await browser.close()
server.close()
