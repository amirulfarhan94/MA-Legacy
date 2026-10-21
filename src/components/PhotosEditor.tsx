import { useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ImageOff, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { addPhoto, usePhotoUrls } from '../lib/photos'
import type { DocPhoto } from '../lib/types'
import { buttonClass, Card, CardHeader, Input } from './ui'

/** Work photos on a document: add from the camera or gallery, caption, reorder, remove. */
export default function PhotosEditor({ title, photos, onChange }: { title: string; photos: DocPhoto[]; onChange: (photos: DocPhoto[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const urls = usePhotoUrls(photos.map((p) => p.id))
  // Adding runs for a while; keep the latest list so captions typed meanwhile survive.
  const latest = useRef(photos)
  latest.current = photos

  async function add(files: FileList | null) {
    const list = Array.from(files ?? [])
    if (!list.length) return
    setProgress({ done: 0, total: list.length })
    const failed: string[] = []
    for (const [i, file] of list.entries()) {
      try {
        const id = await addPhoto(file)
        onChange([...latest.current, { id, caption: '' }])
      } catch (e) {
        failed.push(e instanceof Error ? e.message : file.name)
      }
      setProgress({ done: i + 1, total: list.length })
    }
    setProgress(null)
    if (input.current) input.current.value = ''
    if (failed.length) alert(failed.join('\n'))
  }

  const update = (i: number, p: Partial<DocPhoto>) => onChange(photos.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const move = (i: number, by: number) => {
    const next = [...photos]
    const [p] = next.splice(i, 1)
    next.splice(i + by, 0, p)
    onChange(next)
  }

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle="Printed as report pages after the document, 4 per page. Kept on this device."
        action={
          <label className={buttonClass('secondary', 'sm', progress ? 'pointer-events-none opacity-60' : 'cursor-pointer')}>
            {progress ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {progress ? `Adding ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : 'Add photos'}
            <input ref={input} type="file" accept="image/*" multiple className="sr-only" disabled={!!progress} onChange={(e) => add(e.target.files)} />
          </label>
        }
      />
      <div className="p-5">
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--btn-line)] px-4 py-8 text-sm text-stone-500 hover:bg-[var(--item-hover)]"
          >
            <ImagePlus size={22} className="text-gold-700" />
            Take or choose photos of the finished work
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="min-w-0">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--btn-line)] bg-stone-100">
                  {urls[p.id] ? (
                    <img src={urls[p.id]!} alt={p.caption || `Photo ${i + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    urls[p.id] === null && (
                      <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-stone-500">
                        <ImageOff size={18} /> Not on this device
                      </div>
                    )
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[11px] font-semibold tabular-nums text-white">{i + 1}</span>
                  <div className="absolute right-1 top-1 flex gap-1">
                    <PhotoButton label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ChevronLeft size={15} />
                    </PhotoButton>
                    <PhotoButton label="Move later" disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                      <ChevronRight size={15} />
                    </PhotoButton>
                    <PhotoButton label="Remove photo" onClick={() => onChange(photos.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </PhotoButton>
                  </div>
                </div>
                <Input
                  value={p.caption}
                  onChange={(e) => update(i, { caption: e.target.value })}
                  placeholder="Caption (optional)"
                  aria-label={`Caption for photo ${i + 1}`}
                  className="mt-1.5 text-[13px]"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function PhotoButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur disabled:opacity-30"
    >
      {children}
    </button>
  )
}
