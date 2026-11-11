import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'board'; city?: number }
  | { name: 'price'; commodityId: number; city: number }
  | { name: 'report'; commodityId?: number; city?: number }
  | { name: 'compare'; commodityId?: number }
  | { name: 'reporters' }
  | { name: 'me' }
  | { name: 'builders' }
  | { name: 'about' }
  | { name: 'notfound' }

/** Hash routes, so the app deploys as static files with no server rewrites. */
export const href = {
  board: '#/',
  city: (code: number) => `#/city/${code}`,
  price: (commodityId: number, city: number) => `#/price/${commodityId}/${city}`,
  report: (commodityId?: number, city?: number) => {
    const q = new URLSearchParams()
    if (commodityId !== undefined) q.set('item', String(commodityId))
    if (city !== undefined) q.set('city', String(city))
    const s = q.toString()
    return s ? `#/report?${s}` : '#/report'
  },
  compare: (commodityId?: number) => (commodityId === undefined ? '#/compare' : `#/compare/${commodityId}`),
  reporters: '#/reporters',
  me: '#/me',
  builders: '#/builders',
  about: '#/about',
} as const

const int = (s: string | null | undefined, max: number): number | undefined => {
  if (!s || !/^\d{1,5}$/.test(s)) return undefined
  const n = Number(s)
  return n <= max ? n : undefined
}

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(query)
  const [head, a, b] = parts

  if (parts.length === 0) return { name: 'board' }
  if (head === 'city' && parts.length === 2) {
    const city = int(a, 9999)
    return city ? { name: 'board', city } : { name: 'notfound' }
  }
  if (head === 'price' && parts.length === 3) {
    const commodityId = int(a, 255)
    const city = int(b, 9999)
    return commodityId !== undefined && city ? { name: 'price', commodityId, city } : { name: 'notfound' }
  }
  if (head === 'report' && parts.length === 1) {
    return { name: 'report', commodityId: int(params.get('item'), 255), city: int(params.get('city'), 9999) }
  }
  if (head === 'compare' && parts.length <= 2) {
    if (parts.length === 1) return { name: 'compare' }
    const commodityId = int(a, 255)
    return commodityId !== undefined ? { name: 'compare', commodityId } : { name: 'notfound' }
  }
  if (parts.length === 1 && (head === 'reporters' || head === 'me' || head === 'builders' || head === 'about')) {
    return { name: head }
  }
  return { name: 'notfound' }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return useMemo(() => parse(hash), [hash])
}

export function navigate(to: string) {
  window.location.hash = to
}

/** Absolute link to a route, for copying and sharing. */
export function absoluteUrl(to: string): string {
  return `${window.location.origin}${window.location.pathname}${to}`
}
