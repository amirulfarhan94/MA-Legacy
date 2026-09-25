import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((l) => l())
  })
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** "Install app" entry for the sidebar: native prompt on Chrome/Edge/Android, instructions on iOS Safari. */
export function InstallButton() {
  const [, force] = useState(0)
  const [iosHelp, setIosHelp] = useState(false)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  if (isStandalone()) return null
  const ios = isIOS()
  if (!deferredPrompt && !ios) return null

  return (
    <div className="px-3 pb-2">
      <button
        onClick={async () => {
          if (deferredPrompt) {
            await deferredPrompt.prompt()
            await deferredPrompt.userChoice
            deferredPrompt = null
            force((n) => n + 1)
          } else {
            setIosHelp((v) => !v)
          }
        }}
        className="flex w-full items-center gap-3 rounded-lg border border-gold-600/40 px-3 py-2 text-sm text-gold-300 hover:bg-gold-600/15"
      >
        <Download size={16} /> Install app
      </button>
      {iosHelp && (
        <p className="mt-2 px-1 text-xs leading-relaxed text-stone-400">
          In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.
        </p>
      )}
    </div>
  )
}

/** Toasts for "new version available" and "ready to work offline". */
export function PwaStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Pick up new versions for people who keep the app open all day.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    // All records live in this browser; ask it not to evict them under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 5000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="no-print fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-6">
      <div className="flex-1">
        {needRefresh ? (
          <>
            <div className="font-medium">A new version is available</div>
            <div className="text-xs text-stone-500">Save any open form first, then update.</div>
          </>
        ) : (
          <div className="font-medium">App ready to work offline</div>
        )}
      </div>
      {needRefresh && (
        <button
          onClick={() => updateServiceWorker(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gold-600 px-3 text-xs font-medium text-white hover:bg-gold-700"
        >
          <RefreshCw size={14} /> Update
        </button>
      )}
      <button
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
        className="rounded p-1 text-stone-400 hover:bg-stone-100"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}
