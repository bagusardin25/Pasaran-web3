import type { Address } from 'viem'
import { Empty, ErrorState, Loading } from '../components/bits'
import { Price } from '../components/price'
import { CONTRACT_ADDRESS } from '../config/chains'
import { METHOD } from '../config/site'
import { regionName } from '../data/regions'
import { useChainNow } from '../lib/clock'
import { fetchReporter, fetchReportsBy } from '../lib/contract'
import { formatDateTime, plural, timeAgo } from '../lib/format'
import { useCommodities } from '../lib/hooks'
import { href } from '../lib/router'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

const COOLDOWN = METHOD.cooldownHours * 3600

export function Me() {
  const now = useChainNow()
  const wallet = useWallet()
  const account = wallet.active?.account
  const ready = !!account && !!CONTRACT_ADDRESS
  const commodities = useCommodities()
  const stats = useAsync(ready ? `reporter:${account}` : null, () => fetchReporter(account as Address))
  const reports = useAsync(ready ? `mine:${account}` : null, () => fetchReportsBy(account as Address))

  if (!account) {
    return (
      <div className="wrap page page--narrow">
        <h1 className="page__title">My reports</h1>
        <p className="page__lead">Everything you have reported, and what you can update today.</p>
        <div className="section">
          <Empty title="Connect a wallet to see your reports.">
            <button type="button" className="btn btn--primary" onClick={wallet.openDialog}>
              Connect wallet
            </button>
          </Empty>
        </div>
      </div>
    )
  }

  // Newest first, so the first report seen for an item and place is the latest one.
  const latestFor = new Map<string, number>()
  for (const r of reports.data ?? []) {
    const key = `${r.commodityId}:${r.regionCode}`
    if (!latestFor.has(key)) latestFor.set(key, r.time)
  }

  return (
    <div className="wrap page">
      <div className="me-head">
        <div>
          <h1 className="page__title">My reports</h1>
          <p className="page__lead">
            {stats.data
              ? `${plural(stats.data.reports, 'report')} in ${plural(stats.data.regions, 'place')}.`
              : 'Everything you have reported, and what you can update today.'}
          </p>
        </div>
        <a className="btn btn--primary" href={href.report()}>
          Report a price
        </a>
      </div>

      <div className="section" style={{ marginTop: 'var(--s5)' }}>
        {!CONTRACT_ADDRESS && <Empty title="Your reports will appear here once Pasaran is live." />}
        {reports.loading && !reports.data && CONTRACT_ADDRESS && <Loading />}
        {reports.error !== undefined && !reports.data && <ErrorState error={reports.error} onRetry={reports.reload} />}
        {reports.data && reports.data.length === 0 && (
          <Empty title="You have not reported a price yet.">
            <p>Next time you shop, note one price and add it here. It takes a minute.</p>
            <a className="btn btn--primary" href={href.report()}>
              Report a price
            </a>
          </Empty>
        )}
        {reports.data && reports.data.length > 0 && (
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">Your reports, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Item and place</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col">Reported</th>
                  <th scope="col">Counts?</th>
                  <th scope="col">Update</th>
                </tr>
              </thead>
              <tbody>
                {reports.data.map((r) => {
                  const item = commodities.data?.[r.commodityId]
                  const key = `${r.commodityId}:${r.regionCode}`
                  const isLatest = latestFor.get(key) === r.time
                  const opensAt = r.time + COOLDOWN
                  return (
                    <tr key={r.id}>
                      <th scope="row">
                        <a href={href.price(r.commodityId, r.regionCode)}>{item?.name ?? `Item ${r.commodityId}`}</a>
                        <div className="hint">{regionName(r.regionCode)}</div>
                      </th>
                      <td className="num">
                        <Price value={r.price} unit={item?.unit} />
                      </td>
                      <td className="hint">{timeAgo(r.time, now)}</td>
                      <td className="hint">
                        {r.counted ? 'Yes' : isLatest ? `No, older than ${METHOD.windowDays} days` : 'No, replaced'}
                      </td>
                      <td>
                        {!isLatest ? (
                          <span className="hint">—</span>
                        ) : now >= opensAt ? (
                          <a className="btn btn--secondary btn--small" href={href.report(r.commodityId, r.regionCode)}>
                            Update
                          </a>
                        ) : (
                          <span className="hint">From {formatDateTime(opensAt)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
