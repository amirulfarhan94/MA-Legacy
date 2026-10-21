import { Component, type ReactNode } from 'react'
import { backupNow } from '../lib/backup'

/**
 * Catches a crash anywhere in the app and shows a way out instead of a blank screen: back up
 * the data (it is still safe on the device) and reload.
 */
export default class ErrorScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="glass-strong w-full max-w-md rounded-[26px] p-6 text-stone-900">
          <h1 className="font-display text-xl">Something went wrong</h1>
          <p className="mt-2 text-sm text-stone-600">
            The app hit an error and stopped this screen. Your data is still saved on this device. Back it up to be safe, then
            reload.
          </p>
          <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-stone-100 p-3 text-xs whitespace-pre-wrap text-stone-600">{error.message}</pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => backupNow()}
              className="inline-flex h-10 items-center rounded-full bg-gold-600 px-4 text-sm font-bold text-white"
            >
              Back up now
            </button>
            <button
              type="button"
              onClick={() => {
                location.hash = '#/'
                location.reload()
              }}
              className="inline-flex h-10 items-center rounded-full border border-[var(--btn-line)] bg-[var(--btn)] px-4 text-sm font-bold"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
