import { useSyncExternalStore } from 'react'

// Bumped after every confirmed transaction so on-screen data refetches.

let revision = 0
const listeners = new Set<() => void>()

export function bumpRevision() {
  revision += 1
  listeners.forEach((notify) => notify())
}

export function useRevision(): number {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => revision,
  )
}
