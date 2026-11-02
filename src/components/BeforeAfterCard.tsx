import { useEffect, useState } from 'react'
import { ImageDown, LoaderCircle, Share2 } from 'lucide-react'
import { BEFORE_AFTER_TYPES, pairCaption, pairPhotos, type PhotoPair } from '../lib/beforeAfter'
import { makeBeforeAfterPost } from '../lib/beforeAfterPost'
import { BRAND } from '../lib/brand'
import { shareFile } from '../lib/pdf'
import { usePhotoUrls } from '../lib/photos'
import type { Document } from '../lib/types'
import { Button, Card, CardHeader, Modal } from './ui'

/** The document's before & after pairs, each one a tap away from a picture to post on social media. */
export default function BeforeAfterCard({ doc }: { doc: Document }) {
  const photos = doc.photos ?? []
  const urls = usePhotoUrls(photos.map((p) => p.id))
  const { pairs } = pairPhotos(photos.filter((p) => urls[p.id] !== null))
  const [busy, setBusy] = useState<string | null>(null)
  const [post, setPost] = useState<{ file: File; url: string; caption: string } | null>(null)

  useEffect(() => () => {
    if (post) URL.revokeObjectURL(post.url)
  }, [post])

  if (!pairs.length || !BEFORE_AFTER_TYPES.includes(doc.type)) return null

  async function make(pair: PhotoPair) {
    const before = urls[pair.before.id]
    const after = urls[pair.after.id]
    if (!before || !after || busy) return
    setBusy(pair.before.id)
    try {
      const caption = pairCaption(pair)
      const file = await makeBeforeAfterPost(before, after, caption)
      setPost({ file, url: URL.createObjectURL(file), caption })
    } catch (e) {
      console.error(e)
      alert('Could not make the picture.')
    } finally {
      setBusy(null)
    }
  }

  const text = post
    ? `${post.caption ? `${post.caption}. ` : ''}${BRAND.name} · ${BRAND.slogan}\nWhatsApp ${BRAND.whatsapp} · ${BRAND.site}`
    : ''

  return (
    <Card>
      <CardHeader title="Before & after" subtitle="Make a picture to post on Facebook, Instagram or WhatsApp status." />
      <ul className="divide-y divide-stone-200">
        {pairs.map((pair, i) => (
          <li key={pair.before.id} className="flex items-center gap-3 px-5 py-3">
            <span className="flex shrink-0 gap-1">
              {[pair.before, pair.after].map((p) => (
                <img key={p.id} src={urls[p.id] ?? undefined} alt="" className="size-11 rounded-lg border border-stone-200 object-cover" />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{pairCaption(pair) || `Pair ${i + 1}`}</span>
            <Button size="sm" onClick={() => make(pair)} disabled={!!busy}>
              {busy === pair.before.id ? <LoaderCircle size={14} className="animate-spin" /> : <ImageDown size={14} />} Post picture
            </Button>
          </li>
        ))}
      </ul>
      <p className="border-t border-stone-200 px-5 py-3 text-xs text-stone-500">
        Ask the customer before posting photos of their home, and leave out house numbers, faces and car plates.
      </p>
      <Modal
        open={!!post}
        onClose={() => setPost(null)}
        title="Before & after picture"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPost(null)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => post && shareFile(post.file, text)}>
              <Share2 size={15} /> Share / save
            </Button>
          </>
        }
      >
        {post && <img src={post.url} alt="Before and after picture" className="mx-auto max-h-[60vh] rounded-xl" />}
      </Modal>
    </Card>
  )
}
