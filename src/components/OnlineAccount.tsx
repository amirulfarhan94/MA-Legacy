import { useState } from 'react'
import { Cloud, LoaderCircle, LogOut } from 'lucide-react'
import { signIn, signOut, useCloudUser } from '../lib/cloud'
import { stopSync } from '../lib/sync'
import SyncPanel from './SyncPanel'
import { Button, Card, CardHeader, Field, Input } from './ui'

/** Settings card: sign in to Firebase, for split payment application links and syncing devices. */
export default function OnlineAccount() {
  const user = useCloudUser(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card id="set-online" className="scroll-mt-36">
      <CardHeader
        title="Online account"
        subtitle="Sign in to sync your records across your devices and to send customers a split payment application link (they fill in their details, IC and signature online)."
      />
      <div className="p-5">
        {user === undefined ? (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <LoaderCircle size={15} className="animate-spin" /> Checking…
          </p>
        ) : user ? (
          <div className="flex flex-wrap items-center gap-3">
            <Cloud size={18} className="text-[var(--good)]" />
            <span className="min-w-0 flex-1 text-sm">
              Signed in as <b className="break-all">{user.email}</b>
            </span>
            <Button
              size="sm"
              onClick={() => {
                // Stop listening first, so signing out does not show as a sync error.
                stopSync()
                signOut()
              }}
            >
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        ) : (
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <Button variant="primary" type="submit" disabled={busy || !email || !password}>
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Cloud size={15} />} Sign in
              </Button>
            </div>
          </form>
        )}
      </div>
      {user && <SyncPanel user={user} />}
    </Card>
  )
}
