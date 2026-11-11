import { CONTRACT_ADDRESS } from '../config/chains'
import { fetchActiveRegions, fetchCommodities } from './contract'
import { rememberedCity } from './prefs'
import { useAsync } from './useAsync'

/** Where the app opens when nobody has picked a city yet and no city has reports. */
export const DEFAULT_CITY = 3171 // Kota Jakarta Selatan

export function useCommodities() {
  return useAsync(CONTRACT_ADDRESS ? 'commodities' : null, fetchCommodities)
}

export function useActiveRegions() {
  return useAsync(CONTRACT_ADDRESS ? 'regions' : null, fetchActiveRegions)
}

/**
 * The city to show: the one in the link, else the one last opened on this device, else the
 * busiest city on the board, else the default. Undefined while that is still being worked out.
 */
export function resolveCity(
  fromRoute: number | undefined,
  active: { data?: Array<{ code: number; reports: number }>; loading: boolean; error: unknown },
): number | undefined {
  if (fromRoute) return fromRoute
  const remembered = rememberedCity()
  if (remembered) return remembered
  if (!CONTRACT_ADDRESS) return DEFAULT_CITY
  if (active.data) {
    const busiest = [...active.data].sort((a, b) => b.reports - a.reports)[0]
    return busiest?.code ?? DEFAULT_CITY
  }
  if (active.error !== undefined) return DEFAULT_CITY
  return undefined
}
