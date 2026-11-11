import type { Address } from 'viem'
import { pasaranAbi } from '../config/abi'
import { CONTRACT_ADDRESS, chain } from '../config/chains'
import { METHOD } from '../config/site'
import { englishName, unitLabel } from '../data/commodities'
import { publicClient } from './client'

export type Commodity = {
  id: number
  name: string // Indonesian, as stored on chain
  english: string | undefined
  unit: string
  minPrice: number
  maxPrice: number
  active: boolean
}

export type Row = {
  commodityId: number
  regionCode: number
  price: number
  reporters: number
  updatedAt: number
  confirmed: boolean
  lastKnownPrice: number
  lastKnownAt: number
  previousMedian: number
  previousSepasar: number
  spark: number[]
}

/** confirmed: 3+ reporters in the window · provisional: 1–2 · stale: reports exist, none recent · empty: never reported */
export type Status = 'confirmed' | 'provisional' | 'stale' | 'empty'

export type Point = { sepasar: number; median: number; reporters: number }

export type Report = {
  id: number
  reporter: Address
  price: number
  time: number
  commodityId: number
  regionCode: number
  counted: boolean
  hidden: boolean
  market: string
}

export type Stats = { reports: number; reporters: number; regions: number; feeds: number; commodities: number }

export type Reporter = { wallet: Address; reports: number; regions: number }

export class NotDeployedError extends Error {
  constructor() {
    super(`Pasaran has not been deployed on ${chain.name} yet.`)
    this.name = 'NotDeployedError'
  }
}

function contract() {
  if (!CONTRACT_ADDRESS) throw new NotDeployedError()
  return { address: CONTRACT_ADDRESS, abi: pasaranAbi } as const
}

const PAGE = 50n

export function statusOf(row: Row): Status {
  if (row.reporters >= METHOD.confirmAt) return 'confirmed'
  if (row.reporters > 0) return 'provisional'
  if (row.lastKnownAt > 0) return 'stale'
  return 'empty'
}

type RawRow = {
  commodityId: number
  regionCode: number
  price: number
  reporters: number
  updatedAt: number
  confirmed: boolean
  lastKnownPrice: number
  lastKnownAt: number
  previousMedian: number
  previousSepasar: number
  spark: readonly number[]
}

const toRow = (r: RawRow): Row => ({ ...r, spark: [...r.spark] })

// ───────────────────────────── Reads ─────────────────────────────

export async function fetchCommodities(): Promise<Commodity[]> {
  const items = await publicClient.readContract({ ...contract(), functionName: 'getCommodities' })
  return items.map((c, id) => ({
    id,
    name: c.name,
    english: englishName(c.name),
    unit: unitLabel(c.unit),
    minPrice: c.minPrice,
    maxPrice: c.maxPrice,
    active: c.active,
  }))
}

export async function fetchBoard(regionCode: number): Promise<Row[]> {
  const rows = await publicClient.readContract({ ...contract(), functionName: 'getBoard', args: [regionCode] })
  return rows.map(toRow)
}

export async function fetchFeed(commodityId: number, regionCode: number): Promise<Row> {
  const row = await publicClient.readContract({
    ...contract(),
    functionName: 'getFeed',
    args: [commodityId, regionCode],
  })
  return toRow(row)
}

export async function fetchHistory(commodityId: number, regionCode: number, count = 36): Promise<Point[]> {
  const points = await publicClient.readContract({
    ...contract(),
    functionName: 'history',
    args: [commodityId, regionCode, BigInt(count)],
  })
  return points.map((p) => ({ sepasar: p.sepasar, median: p.median, reporters: p.reporters }))
}

type RawReport = {
  id: number
  reporter: Address
  price: number
  time: number
  commodityId: number
  regionCode: number
  counted: boolean
  hidden: boolean
  market: string
}

const toReport = (r: RawReport): Report => ({ ...r })

/** Newest first, up to `max` reports. */
export async function fetchReports(commodityId: number, regionCode: number, max = 50): Promise<Report[]> {
  const out: Report[] = []
  let cursor = 0n
  do {
    const [page, next] = await publicClient.readContract({
      ...contract(),
      functionName: 'getReports',
      args: [commodityId, regionCode, cursor, PAGE],
    })
    out.push(...page.map(toReport))
    cursor = next
  } while (cursor !== 0n && out.length < max)
  return out.slice(0, max)
}

/** A wallet's reports, newest first, up to `max`. */
export async function fetchReportsBy(wallet: Address, max = 200): Promise<Report[]> {
  const out: Report[] = []
  let cursor = 0n
  do {
    const [page, next] = await publicClient.readContract({
      ...contract(),
      functionName: 'reportsBy',
      args: [wallet, cursor, PAGE],
    })
    out.push(...page.map(toReport))
    cursor = next
  } while (cursor !== 0n && out.length < max)
  return out.slice(0, max)
}

/** One item in every region that has data for it. */
export async function fetchAcross(commodityId: number): Promise<Row[]> {
  const out: Row[] = []
  let cursor = 0n
  do {
    const [rows, next] = await publicClient.readContract({
      ...contract(),
      functionName: 'getAcrossRegions',
      args: [commodityId, cursor, PAGE],
    })
    out.push(...rows.map(toRow))
    cursor = next
  } while (cursor !== 0n)
  return out
}

export async function fetchActiveRegions(): Promise<Array<{ code: number; reports: number }>> {
  const [codes, reports] = await publicClient.readContract({ ...contract(), functionName: 'activeRegions' })
  return codes.map((code, i) => ({ code, reports: reports[i] ?? 0 }))
}

export async function fetchReporters(): Promise<Reporter[]> {
  const out: Reporter[] = []
  let cursor = 0n
  do {
    const [wallets, reports, regions, next] = await publicClient.readContract({
      ...contract(),
      functionName: 'getReporters',
      args: [cursor, PAGE],
    })
    wallets.forEach((wallet, i) => out.push({ wallet, reports: reports[i] ?? 0, regions: regions[i] ?? 0 }))
    cursor = next
  } while (cursor !== 0n)
  return out
}

export async function fetchReporter(wallet: Address): Promise<{ reports: number; regions: number }> {
  const [reports, regions] = await publicClient.readContract({
    ...contract(),
    functionName: 'reporterOf',
    args: [wallet],
  })
  return { reports, regions }
}

/** When this wallet may report the item in the region again, or 0 for now. */
export async function fetchNextReportTime(wallet: Address, commodityId: number, regionCode: number): Promise<number> {
  return publicClient.readContract({
    ...contract(),
    functionName: 'nextReportTime',
    args: [wallet, commodityId, regionCode],
  })
}

export async function fetchStats(): Promise<Stats> {
  const [reports, reporters, regions, feeds, commodities] = await publicClient.readContract({
    ...contract(),
    functionName: 'stats',
  })
  return {
    reports: Number(reports),
    reporters: Number(reporters),
    regions: Number(regions),
    feeds: Number(feeds),
    commodities: Number(commodities),
  }
}

// ───────────────────────────── Writes ─────────────────────────────
//
// Dry-run first: a rule the contract would reject surfaces as a readable error before the
// wallet is asked to sign anything.

export const prepare = {
  report: (account: Address, commodityId: number, regionCode: number, price: number, market: string) =>
    publicClient.simulateContract({
      ...contract(),
      account,
      functionName: 'report',
      args: [commodityId, regionCode, price, market],
    }),
}
