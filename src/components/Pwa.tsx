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

const IOS_HELP = 'In Safari, tap the Share button, then Add to Home Screen.'

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

  const prompt = async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    force((n) => n + 1)
    return true
  }

  return (
    <>
      <div className="full-only">
        <button
          type="button"
          onClick={async () => (await prompt()) || setIosHelp((v) => !v)}
          className="flex h-10 w-full items-center gap-2.5 rounded-full border border-gold-400/50 px-3.5 text-sm font-semibold text-gold-700 hover:bg-gold-50"
        >
          <Download size={16} /> Install app
        </button>
        {iosHelp && <p className="mt-2 px-1 text-xs leading-relaxed text-stone-500">{IOS_HELP}</p>}
      </div>
      <button type="button" onClick={async () => (await prompt()) || alert(IOS_HELP)} className="side-item rail-only text-gold-700" title="Install app" aria-label="Install app">
        <Download size={18} strokeWidth={1.7} />
      </button>
    </>
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
    <div className="glass-strong no-print fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-[20px] px-4 py-3 text-sm sm:left-auto sm:right-6">
      <div className="flex-1">
        {needRefresh ? (
          <>
            <div className="font-semibold">A new version is available</div>
            <div className="text-xs text-stone-500">Save any open form first, then update.</div>
          </>
        ) : (
          <div className="font-semibold">App ready to work offline</div>
        )}
      </div>
      {needRefresh && (
        <button
          onClick={() => updateServiceWorker(true)}
          className="btn-gold inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold"
        >
          <RefreshCw size={14} /> Update
        </button>
      )}
      <button
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
        className="rounded-full p-1 text-stone-400 hover:bg-stone-100"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}
