import { useEffect } from 'react'
import { Empty, ErrorState, Loading } from '../components/bits'
import { Price, StatusTag, rowStatus } from '../components/price'
import { CONTRACT_ADDRESS } from '../config/chains'
import { regionName, regionProvince } from '../data/regions'
import { useChainNow } from '../lib/clock'
import { fetchAcross } from '../lib/contract'
import type { Row } from '../lib/contract'
import { formatDate, formatPercent, formatRp, plural, timeAgo } from '../lib/format'
import { useCommodities } from '../lib/hooks'
import { href, navigate } from '../lib/router'
import { useAsync } from '../lib/useAsync'

export function Compare({ commodityId = 0 }: { commodityId?: number }) {
  const now = useChainNow()
  const commodities = useCommodities()
  const item = commodities.data?.[commodityId]
  const across = useAsync(CONTRACT_ADDRESS && item ? `across:${commodityId}` : null, () => fetchAcross(commodityId))

  useEffect(() => {
    if (item) document.title = `${item.name} across places · Pasaran`
  }, [item])

  const priced = (across.data ?? []).filter((r) => r.price > 0).sort((a, b) => a.price - b.price)
  const quiet = (across.data ?? []).filter((r) => r.price === 0).sort((a, b) => b.lastKnownAt - a.lastKnownAt)
  const max = Math.max(1, ...priced.map((r) => r.price))
  const cheapest = priced[0]
  const dearest = priced[priced.length - 1]

  const cell = (r: Row) => (
    <a href={href.price(commodityId, r.regionCode)}>
      {regionName(r.regionCode)}
    </a>
  )

  return (
    <div className="wrap page">
      <h1 className="page__title">Compare across places</h1>
      <p className="page__lead">One item, every regency and city that has reports, cheapest first.</p>

      <div className="form" style={{ marginTop: 'var(--s5)', maxWidth: '28rem' }}>
        <div className="form__group">
          <label htmlFor="compare-item">Item</label>
          <select
            id="compare-item"
            className="field"
            value={commodityId}
            onChange={(e) => navigate(href.compare(Number(e.target.value)))}
            disabled={!commodities.data}
          >
            {(commodities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.english ? ` — ${c.english}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!CONTRACT_ADDRESS && <Empty title="Prices will appear here once Pasaran is live." />}
      {commodities.data && !item && <Empty title="That item is not in the catalogue." />}
      {(commodities.loading || across.loading) && !across.data && CONTRACT_ADDRESS && <Loading />}
      {across.error !== undefined && !across.data && <ErrorState error={across.error} onRetry={across.reload} />}

      {item && across.data && across.data.length === 0 && (
        <div className="section">
          <Empty title={`Nobody has reported ${item.name.toLowerCase()} anywhere yet.`}>
            <a className="btn btn--primary" href={href.report(commodityId)}>
              Report the first price
            </a>
          </Empty>
        </div>
      )}

      {item && priced.length > 0 && (
        <section className="section" aria-labelledby="compare-heading">
          <h2 id="compare-heading" className="section__title">
            {item.name}, per {item.unit}
          </h2>
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">
                {item.name} reference prices by place, cheapest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col">
                    <span className="sr-only">Relative price</span>
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {priced.map((r) => (
                  <tr key={r.regionCode}>
                    <th scope="row">
                      {cell(r)}
                      <div className="hint">{regionProvince(r.regionCode)}</div>
                    </th>
                    <td className="num">
                      <Price value={r.price} />
                    </td>
                    <td>
                      <div className="bar-cell" aria-hidden="true">
                        <div className="bar">
                          <div className="bar__fill" style={{ width: `${(r.price / max) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusTag status={rowStatus(r)} />
                      <div className="hint">{plural(r.reporters, 'reporter')}</div>
                    </td>
                    <td className="hint">{timeAgo(r.updatedAt, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cheapest && dearest && cheapest !== dearest && (
            <p className="compare-note">
              {regionName(dearest.regionCode)} is {formatPercent((dearest.price - cheapest.price) / cheapest.price)} dearer
              than {regionName(cheapest.regionCode)} ({formatRp(dearest.price)} against {formatRp(cheapest.price)}).
              Provisional prices rest on one or two reports, so read them with care.
            </p>
          )}
        </section>
      )}

      {item && quiet.length > 0 && (
        <section className="section" aria-labelledby="quiet-heading">
          <h2 id="quiet-heading" className="section__title">
            No recent reports
          </h2>
          <ul className="cities">
            {quiet.map((r) => (
              <li key={r.regionCode}>
                <a href={href.price(commodityId, r.regionCode)}>
                  {regionName(r.regionCode)}{' '}
                  <small>
                    last {formatRp(r.lastKnownPrice)}, {formatDate(r.lastKnownAt)}
                  </small>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
