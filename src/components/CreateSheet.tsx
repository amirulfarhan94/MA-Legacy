import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DOC_META, DOC_TYPES, type DocType } from '../lib/types'
import { DOC_HINT, DOC_ICON } from './nav'
import Overlay from './Overlay'

/** Every document type in one place, from the Create button. With a customer, the new document starts with them filled in. */
export default function CreateSheet({
  open,
  onClose,
  types = DOC_TYPES,
  customerId,
  title = 'Create',
}: {
  open: boolean
  onClose: () => void
  types?: DocType[]
  customerId?: string
  title?: string
}) {
  const nav = useNavigate()
  return (
    <Overlay open={open} onClose={onClose} label={title} placement="sheet" className="max-w-[560px] p-4">
      <div className="mb-3 flex items-center justify-between gap-3 pl-1">
        <h2 className="min-w-0 truncate font-display text-lg font-medium tracking-[-0.01em]">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
        {types.map((t, i) => {
          const Icon = DOC_ICON[t]
          return (
            <button
              key={t}
              type="button"
              data-autofocus={i === 0 || undefined}
              onClick={() => {
                onClose()
                nav(`/d/${DOC_META[t].path}/new${customerId ? `?customer=${customerId}` : ''}`)
              }}
              className="flex min-h-14 min-w-0 items-center gap-3 rounded-[18px] border border-[var(--btn-line)] bg-[var(--btn)] p-2.5 text-left transition-colors hover:border-gold-500"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-700">
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-stone-900">{DOC_META[t].label}</span>
                <span className="block truncate text-xs font-medium text-stone-500">{DOC_HINT[t]}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Overlay>
  )
}
