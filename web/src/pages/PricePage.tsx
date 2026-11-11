import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Empty, ErrorState, Loading } from '../components/bits'
import { LineChart } from '../components/LineChart'
import { Change, Price, STATUS_HELP, StatusTag, rowStatus } from '../components/price'
import { CONTRACT_ADDRESS } from '../config/chains'
import { METHOD } from '../config/site'
import { regionName } from '../data/regions'
import { useChainNow } from '../lib/clock'
import { fetchFeed, fetchHistory, fetchReports } from '../lib/contract'
import { formatDate, formatRp, plural, sameAddress, sepasarOf, sepasarRange, shortAddress, timeAgo } from '../lib/format'
import { useCommodities } from '../lib/hooks'
import { href } from '../lib/router'
import { useAsync, useInterval } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

export function PricePage({ commodityId, city }: { commodityId: number; city: number }) {
  const now = useChainNow()
  const wallet = useWallet()
  const commodities = useCommodities()
  const key = `${commodityId}:${city}`
  const deployed = !!CONTRACT_ADDRESS
  const knownItem = commodities.data ? commodityId < commodities.data.length : undefined
  const ready = deployed && knownItem === true

  const feed = useAsync(ready ? `feed:${key}` : null, () => fetchFeed(commodityId, city))
  const history = useAsync(ready ? `history:${key}` : null, () => fetchHistory(commodityId, city))
  const reports = useAsync(ready ? `reports:${key}` : null, () => fetchReports(commodityId, city, 40))
  useInterval(() => {
    feed.reload()
    reports.reload()
  }, ready ? 30_000 : null)

  // Reports that arrive after the page first loads are animated in.
  const [seen, setSeen] = useState<Set<number> | null>(null)
  if (reports.data && seen === null) setSeen(new Set(reports.data.map((r) => r.id)))

  const item = commodities.data?.[commodityId]
  useEffect(() => {
    if (item) document.title = `${item.name} in ${regionName(city)} · Pasaran`
  }, [item, city])

  const back = (
    <a className="back" href={href.city(city)}>
      <ArrowLeft size={16} aria-hidden="true" /> Prices in {regionName(city)}
    </a>
  )

  if (!deployed) {
    return (
      <div className="wrap page">
        {back}
        <Empty title="Prices will appear here once Pasaran is live." />
      </div>
    )
  }
  if (knownItem === false) {
    return (
      <div className="wrap page">
        {back}
        <Empty title="That item is not in the catalogue.">
          <a className="btn btn--secondary" href={href.city(city)}>
            See every item in {regionName(city)}
          </a>
        </Empty>
      </div>
    )
  }
  if (!item || !feed.data) {
    return (
      <div className="wrap page">
        {back}
        {feed.error !== undefined ? (
          <ErrorState error={feed.error} onRetry={feed.reload} />
        ) : commodities.error !== undefined ? (
          <ErrorState error={commodities.error} onRetry={commodities.reload} />
        ) : (
          <Loading />
        )}
      </div>
    )
  }

  const row = feed.data
  const status = rowStatus(row)
  const points = history.data ?? []
  const current = row.price ? { sepasar: sepasarOf(now), price: row.price } : undefined
  const hasChart = points.length + (current ? 1 : 0) >= 2

  return (
    <div className="wrap page">
      {back}

      <div className="detail">
        <div>
          <p className="label">{regionName(city)}</p>
          <h1 className="detail__name">{item.name}</h1>
          <p className="detail__sub">
            {item.english ? `${item.english}, ` : ''}per {item.unit}
          </p>

          <div className="detail__actions">
            {item.active ? (
              <a className="btn btn--primary" href={href.report(commodityId, city)}>
                Report this price
              </a>
            ) : (
              <p className="note">Reports for this item are paused.</p>
            )}
            <a className="btn btn--secondary" href={href.compare(commodityId)}>
              Compare across places
            </a>
          </div>
        </div>

        <div className="big-tag">
          <span className="label">Reference price</span>
          <Price value={row.price} unit={item.unit} />
          <div className="big-tag__row">
            <StatusTag status={status} />
            {row.price > 0 && <Change row={row} long />}
          </div>
          <div className="big-tag__facts">
            <p>{STATUS_HELP[status]}</p>
            {row.reporters > 0 && (
              <p>
                Median of <strong>{plural(row.reporters, 'reporter')}</strong>, newest {timeAgo(row.updatedAt, now)}.
              </p>
            )}
            {status === 'stale' && (
              <p>
                Last known <strong>{formatRp(row.lastKnownPrice)}</strong> on {formatDate(row.lastKnownAt)}.
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section__title">
          Price by sepasar
        </h2>
        {history.error !== undefined && !history.data ? (
          <ErrorState error={history.error} onRetry={history.reload} />
        ) : !history.data ? (
          <Loading label="Reading the price history…" />
        ) : !hasChart ? (
          <Empty title="Not enough history for a chart yet.">
            <p>
              Each sepasar lasts {METHOD.sepasarDays} days. When one ends, its closing median is kept as a point here.
            </p>
          </Empty>
        ) : (
          <div className="chart">
            <LineChart points={points} current={current} title={`${item.name} in ${regionName(city)}`} />
            <div className="chart__legend">
              <span className="chart__key">Closing median of each sepasar</span>
              {current && <span className="chart__key chart__key--now">Today’s reference</span>}
            </div>
            <details className="disclosure">
              <summary>Show the figures as a table</summary>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Sepasar</th>
                    <th scope="col" className="num">
                      Median
                    </th>
                    <th scope="col" className="num">
                      Reporters
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map((p) => (
                    <tr key={p.sepasar}>
                      <td>{sepasarRange(p.sepasar)}</td>
                      <td className="num">{formatRp(p.median)}</td>
                      <td className="num">{p.reporters}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="section__title">
          Latest reports
        </h2>
        <p className="hint" style={{ marginBottom: 'var(--s3)' }}>
          Only each wallet’s newest report from the last {METHOD.windowDays} days counts toward the price.
        </p>
        {reports.error !== undefined && !reports.data && <ErrorState error={reports.error} onRetry={reports.reload} />}
        {!reports.data && reports.error === undefined && <Loading label="Reading reports…" />}
        {reports.data && reports.data.length === 0 && (
          <Empty title="No reports yet.">
            <p>Be the first to say what {item.name.toLowerCase()} costs in {regionName(city)}.</p>
          </Empty>
        )}
        {reports.data && reports.data.length > 0 && (
          <ul className="reports">
            {reports.data.map((r) => {
              const classes = [r.counted ? '' : 'is-replaced', seen && !seen.has(r.id) ? 'is-new' : '']
                .filter(Boolean)
                .join(' ')
              return (
                <li key={r.id} className={classes || undefined}>
                  <Price value={r.price} />
                  <div className="reports__where">
                    <div>{r.hidden ? <em>Market name hidden by a moderator</em> : r.market || 'Market not given'}</div>
                    <div className="reports__who">
                      <span className="mono">{shortAddress(r.reporter)}</span>
                      {sameAddress(r.reporter, wallet.active?.account) && ' (you)'} · {timeAgo(r.time, now)}
                    </div>
                  </div>
                  <span className={r.counted ? 'reports__counts is-counted' : 'reports__counts is-not'}>
                    {r.counted ? 'Counts' : 'Not counted'}
                    <span className="sr-only">
                      {r.counted ? ' toward the price' : ': replaced by a newer report from this wallet, or too old'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
