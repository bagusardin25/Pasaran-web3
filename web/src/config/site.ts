export const SITE = {
  name: 'Pasaran',
  tagline: 'Staple food prices, reported by the people who buy them',
  /** The project's X profile. Leave empty until the account exists; the footer hides the link. */
  xUrl: '',
  botchainUrl: 'https://botchain.ai',
  botchainScanUrl: 'https://scan.botchain.ai',
} as const

/** The method, as the contract runs it. Kept here so every page explains the same numbers. */
export const METHOD = {
  windowDays: 14,
  cooldownHours: 20,
  sepasarDays: 5,
  boardSize: 15,
  confirmAt: 3,
  marketBytes: 40,
} as const

/** A report this far from the current reference asks "is that right?" before it is sent. */
export const DEVIATION_WARNING = 0.4

export const SEPASAR_SECONDS = METHOD.sepasarDays * 86_400
