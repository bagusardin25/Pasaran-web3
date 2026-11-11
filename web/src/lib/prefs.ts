// Per-device conveniences. Storage can be unavailable (private windows, blocked site data),
// so every access is guarded and the app works without it.

const CITY_KEY = 'pasaran.city'

export function rememberedCity(): number | undefined {
  try {
    const value = Number(localStorage.getItem(CITY_KEY))
    return Number.isInteger(value) && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

export function rememberCity(code: number) {
  try {
    localStorage.setItem(CITY_KEY, String(code))
  } catch {
    // Not remembered this time.
  }
}
