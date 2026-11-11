import { useEffect, useState, useSyncExternalStore } from 'react'
import { publicClient } from './client'

// Ages ("3 h ago") and the 14-day window are measured against the chain's clock, not the
// device's. They normally agree; a wrong device clock or a local test chain would not.

let offset = 0 // chain time minus device time, in seconds
const listeners = new Set<() => void>()
let syncing: Promise<void> | null = null

export function syncClock(): Promise<void> {
  if (syncing) return syncing
  syncing = publicClient
    .getBlock({ blockTag: 'latest' })
    .then((block) => {
      const next = Number(block.timestamp) - Date.now() / 1000
      // Blocks arrive every second or so; only a real gap is worth correcting for.
      if (Math.abs(next - offset) > 90) {
        offset = next
        listeners.forEach((notify) => notify())
      }
    })
    .catch(() => {
      // Without the chain, the device clock is the best guess.
    })
    .finally(() => {
      syncing = null
    })
  return syncing
}

export const chainNow = (): number => Math.floor(Date.now() / 1000 + offset)

/** The chain's current time in seconds, refreshed every `everyMs`. */
export function useChainNow(everyMs = 30_000): number {
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => offset,
  )
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return chainNow()
}
