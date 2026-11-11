// Development only. Loaded through a dynamic import that production builds drop.
//
// A local Hardhat node signs for its own unlocked accounts, so these wallets hold no keys:
// they ask the node to send from one of its addresses. That makes it possible to report
// prices from several wallets and watch a price become confirmed, without a browser extension.
import { createWalletClient, http } from 'viem'
import type { Address, WalletClient } from 'viem'
import { chain, rpcUrl } from '../config/chains'

export type DevWallet = { id: string; name: string; account: Address; client: WalletClient }

// Account 0 deploys the contract; 1–14 are the sample reporters; 17–19 are left untouched,
// so they can report anything without waiting out a cooldown.
const SLOTS = [
  { index: 0, name: 'Dev wallet · Owner' },
  { index: 17, name: 'Dev wallet · Lestari' },
  { index: 18, name: 'Dev wallet · Made' },
  { index: 19, name: 'Dev wallet · Rahmat' },
]

export async function loadDevWallets(): Promise<DevWallet[]> {
  const client = createWalletClient({ chain, transport: http(rpcUrl) })
  const accounts = await client.getAddresses()
  return SLOTS.filter((slot) => accounts[slot.index]).map((slot) => ({
    id: `dev:${slot.index}`,
    name: slot.name,
    account: accounts[slot.index],
    client,
  }))
}
