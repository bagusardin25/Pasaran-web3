import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'
import { chain } from '../config/chains'
import { NotDeployedError } from './contract'
import { formatDateTime, formatRp } from './format'

/** What each contract rejection means, in words a reporter can act on. */
function fromRevert(name: string, args: readonly unknown[] | undefined): string | undefined {
  switch (name) {
    case 'TooSoon': {
      const at = Number(args?.[0] ?? 0)
      return `You reported this item here less than 20 hours ago. You can update it from ${formatDateTime(at)}.`
    }
    case 'PriceOutOfRange': {
      const [min, max] = (args ?? []).map(Number)
      return `That price is outside the sensible range for this item (${formatRp(min)} to ${formatRp(max)}). Check for a missing or extra zero.`
    }
    case 'UnknownCommodity':
      return 'That item is not in the catalogue.'
    case 'CommodityInactive':
      return 'Reports for this item are paused.'
    case 'InvalidRegion':
      return 'That is not a valid regency or city code.'
    case 'MarketTooLong':
      return 'The market name can be at most 40 bytes.'
    case 'NotOwner':
      return 'Only the contract owner can do that.'
    default:
      return undefined
  }
}

const CANCELLED = 'You cancelled the request in your wallet.'
const FALLBACK = 'Something went wrong. Please try again.'

export function describeError(err: unknown): string {
  if (err instanceof NotDeployedError) return err.message

  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return CANCELLED

    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      const message = name ? fromRevert(name, revert.data?.args) : undefined
      if (message) return message
    }

    const text = `${err.shortMessage} ${err.message}`.toLowerCase()
    if (text.includes('insufficient funds')) return 'This wallet does not hold enough BOT to pay for gas.'
    if (text.includes('does not match the target chain') || text.includes('chain mismatch')) {
      return `Your wallet is on another network. Switch it to ${chain.name} and try again.`
    }
    if (text.includes('http request failed') || text.includes('failed to fetch') || text.includes('timed out')) {
      return `Could not reach ${chain.name}. Check your connection and try again.`
    }
    return err.shortMessage || FALLBACK
  }

  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 4001) {
    return CANCELLED
  }
  if (err instanceof Error && err.message) return err.message
  return FALLBACK
}
