import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { explorerTxUrl } from '../config/chains'
import { describeError } from '../lib/errors'
import type { TxState } from '../lib/tx'

/** The Pasaran mark: a price tag on a string. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand__mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M4 3.5c3 0 5 2 6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M9.5 9.2 16 6l12.2 12.2a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L6 16l3.5-6.8Z"
        fill="#f2801d"
        stroke="#121417"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="11.5" cy="11.5" r="1.9" fill="#ffffff" stroke="#121417" strokeWidth="1.6" />
      <path d="M15 19.5h6.5M17 23h4" stroke="#121417" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Loading({ label = 'Reading prices from BOT Chain…' }: { label?: string }) {
  return (
    <p className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p>{describeError(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      {children}
    </div>
  )
}

const PHASE_TEXT: Partial<Record<TxState['phase'], string>> = {
  preparing: 'Checking the report with the contract…',
  wallet: 'Confirm in your wallet…',
  mining: 'Writing to BOT Chain…',
}

/** Live progress of a transaction, announced to screen readers. */
export function TxStatus({ state, done }: { state: TxState; done?: string }) {
  if (state.phase === 'idle') return null
  const txUrl = state.hash ? explorerTxUrl(state.hash) : undefined

  if (state.phase === 'error') {
    return (
      <p className="tx tx--error" role="alert">
        {state.error}
      </p>
    )
  }
  return (
    <p className={state.phase === 'done' ? 'tx tx--done' : 'tx'} role="status">
      {state.phase === 'done' ? <Check size={16} aria-hidden="true" /> : <span className="spinner" aria-hidden="true" />}
      <span>{state.phase === 'done' ? (done ?? 'Done.') : PHASE_TEXT[state.phase]}</span>
      {txUrl && (
        <a href={txUrl} target="_blank" rel="noreferrer">
          View transaction
        </a>
      )}
    </p>
  )
}

/** Copies text and confirms it for a moment. */
export function CopyButton({
  text,
  label,
  className = 'btn btn--secondary btn--small',
}: {
  text: string
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this:', text)
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}

/** Counts UTF-8 bytes against the contract's limit. */
export function ByteCount({ id, used, max }: { id?: string; used: number; max: number }) {
  const over = used > max
  return (
    <span id={id} className={over ? 'count is-over' : 'count'}>
      {used} / {max}
      {over && <span className="sr-only"> — too long</span>}
    </span>
  )
}
