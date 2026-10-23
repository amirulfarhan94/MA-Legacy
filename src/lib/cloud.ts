import { useEffect, useState } from 'react'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

/**
 * Firebase, used for split payment application links: the owner signs in with email and
 * password, the app posts an "offer" for a customer, and the customer fills it in on their own
 * phone through an unguessable link. Everything else in the app still lives on this device.
 *
 * The SDK loads only when something here is used. Test builds set VITE_FIREBASE_EMULATOR to talk
 * to the local Firebase emulators instead of the real project. Access rules: firestore.rules.
 */

// A web config is public by design; the sign-in and the security rules protect the data.
const firebaseConfig = {
  apiKey: 'AIzaSyDIfn0v4TANwXyX2IPjno4ffvH3fEwu0qs',
  authDomain: 'ma-legacy.firebaseapp.com',
  projectId: 'ma-legacy',
  storageBucket: 'ma-legacy.firebasestorage.app',
  messagingSenderId: '480789358125',
  appId: '1:480789358125:web:64e694cadf76b215fe7aa4',
}

const APPLICATIONS = 'applications'
/** How long a customer has to fill in a link. */
export const APPLICATION_DAYS = 14
/** Set once the owner has signed in, so the SDK loads at start-up only on their devices. */
const SIGNED_IN_KEY = 'ma-legacy-cloud'

interface Cloud {
  auth: Auth
  db: Firestore
  au: typeof import('firebase/auth')
  fs: typeof import('firebase/firestore')
}

let cloudPromise: Promise<Cloud> | undefined

export function cloud(): Promise<Cloud> {
  cloudPromise ??= (async () => {
    const [{ initializeApp }, au, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const app = initializeApp(firebaseConfig)
    const auth = au.initializeAuth(app, { persistence: [au.indexedDBLocalPersistence, au.browserLocalPersistence] })
    // On the owner's devices Firestore keeps its own copy in IndexedDB, so synced changes made
    // offline survive a reload and go up once the device is back online.
    const db = fs.initializeFirestore(app, {
      localCache: flag.get() ? fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) : fs.memoryLocalCache(),
    })
    const emulator = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined
    if (emulator) {
      au.connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true })
      fs.connectFirestoreEmulator(db, emulator, 8080)
    }
    return { auth, db, au, fs }
  })()
  return cloudPromise
}

// ---------------------------------------------------------------- owner sign-in

export interface CloudUser {
  uid: string
  email: string
}

const flag = {
  get: () => {
    try {
      return localStorage.getItem(SIGNED_IN_KEY) === '1'
    } catch {
      return false
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(SIGNED_IN_KEY, '1')
      else localStorage.removeItem(SIGNED_IN_KEY)
    } catch {
      /* storage blocked */
    }
  },
}

/**
 * The signed-in owner: undefined while checking, null when signed out. Pass `load` to check
 * even on a device that never signed in (the Settings card does).
 */
export function useCloudUser(load = false): CloudUser | null | undefined {
  const [user, setUser] = useState<CloudUser | null | undefined>(() => (load || flag.get() ? undefined : null))
  useEffect(() => {
    if (!load && !flag.get()) return
    let stop: (() => void) | undefined
    let live = true
    cloud().then(({ auth, au }) => {
      if (!live) return
      stop = au.onAuthStateChanged(auth, (u) => {
        flag.set(!!u)
        setUser(u ? { uid: u.uid, email: u.email ?? '' } : null)
      })
    })
    return () => {
      live = false
      stop?.()
    }
  }, [load])
  return user
}

const SIGN_IN_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account is disabled.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection.',
}

export async function signIn(email: string, password: string): Promise<void> {
  const { auth, au } = await cloud()
  try {
    await au.signInWithEmailAndPassword(auth, email.trim(), password)
    flag.set(true)
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    throw new Error(SIGN_IN_ERRORS[code] ?? 'Could not sign in. Try again.')
  }
}

export async function signOut(): Promise<void> {
  const { auth, au } = await cloud()
  await au.signOut(auth)
  flag.set(false)
}

// ---------------------------------------------------------------- application links

/** What the customer sees and agrees to, written by the owner when the link is made. */
export interface ApplicationOffer {
  ownerUid: string
  status: 'open' | 'submitted'
  createdAt: string
  expiresAt: string
  /** Local id of the invoice, to find it again when the application comes back. */
  invoiceId: string
  invoiceNo: string
  agreementNo: string
  quotationNo: string
  company: { name: string; regNo: string; phone: string; email: string; address: string }
  workDescription: string
  premisesAddress: string
  plannedWorkDate: string
  currency: string
  total: number
  payments: { seq: number; pct: number; amount: number; dueDate: string }[]
  bank: { name: string; accountNo: string }
  /** Suggested answers, from the customer record. */
  prefill: { name: string; phone: string; email: string }
  applicant?: Applicant
  submittedAt?: unknown
}

/** What the customer sends back. Images are JPEG/PNG data URLs, kept small. */
export interface Applicant {
  name: string
  icNo: string
  phone: string
  email: string
  address: string
  icFront: string
  icBack: string
  signature: string
  /** When they ticked the agreement and data consent boxes (ISO, their clock). */
  consentAt: string
}

export type Application = ApplicationOffer & { token: string }

/** A link token nobody can guess: 128 random bits, as 22 URL-safe characters. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Customer links go to Firebase Hosting (short, no GitHub name); index.html turns /a/<token> into #/apply/<token>. */
const APPLY_ORIGIN = 'https://ma-legacy.web.app'

export function applicationUrl(token: string): string {
  if (import.meta.env.VITE_FIREBASE_EMULATOR) return `${location.origin}${location.pathname}#/apply/${token}`
  return `${APPLY_ORIGIN}/a/${token}`
}

export async function createApplication(offer: Omit<ApplicationOffer, 'ownerUid' | 'status'>): Promise<string> {
  const { auth, db, fs } = await cloud()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in first (Settings → Online account).')
  const token = newToken()
  await fs.setDoc(fs.doc(db, APPLICATIONS, token), { ...offer, ownerUid: uid, status: 'open' })
  return token
}

/** For the customer: the offer behind a link, or null when it is used, cancelled or never existed. */
export async function openApplication(token: string): Promise<Application | null> {
  const { db, fs } = await cloud()
  try {
    const snap = await fs.getDoc(fs.doc(db, APPLICATIONS, token))
    if (!snap.exists()) return null
    return { ...(snap.data() as ApplicationOffer), token }
  } catch (e) {
    // The rules refuse links that are no longer open (and ones that never existed).
    if ((e as { code?: string }).code === 'permission-denied') return null
    throw e
  }
}

export async function submitApplication(token: string, applicant: Applicant): Promise<void> {
  const { db, fs } = await cloud()
  await fs.updateDoc(fs.doc(db, APPLICATIONS, token), { status: 'submitted', applicant, submittedAt: fs.serverTimestamp() })
}

/** For the owner: one application, live. null once it is deleted. */
export function watchApplication(token: string, onChange: (a: Application | null) => void): () => void {
  let stop: (() => void) | undefined
  let live = true
  cloud().then(({ db, fs }) => {
    if (!live) return
    stop = fs.onSnapshot(
      fs.doc(db, APPLICATIONS, token),
      (snap) => onChange(snap.exists() ? { ...(snap.data() as ApplicationOffer), token } : null),
      () => onChange(null),
    )
  })
  return () => {
    live = false
    stop?.()
  }
}

/** For the owner: applications customers have sent back and that are waiting for review. */
export function watchSubmitted(uid: string, onChange: (list: Application[]) => void): () => void {
  let stop: (() => void) | undefined
  let live = true
  cloud().then(({ db, fs }) => {
    if (!live) return
    const q = fs.query(fs.collection(db, APPLICATIONS), fs.where('ownerUid', '==', uid), fs.where('status', '==', 'submitted'))
    stop = fs.onSnapshot(
      q,
      (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as ApplicationOffer), token: d.id }))),
      () => onChange([]),
    )
  })
  return () => {
    live = false
    stop?.()
  }
}

/** Removes an application from the cloud (after approving or rejecting it, or to cancel a link). */
export async function deleteApplication(token: string): Promise<void> {
  const { db, fs } = await cloud()
  await fs.deleteDoc(fs.doc(db, APPLICATIONS, token))
}
