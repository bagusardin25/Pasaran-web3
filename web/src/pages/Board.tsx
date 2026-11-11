import { useEffect, useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { Empty, ErrorState, Loading } from '../components/bits'
import { CityPicker } from '../components/CityPicker'
import { Change, Price, Sparkline, StatusTag, rowStatus } from '../components/price'
import { CONTRACT_ADDRESS } from '../config/chains'
import { METHOD } from '../config/site'
import { regionName, shortRegionName } from '../data/regions'
import { useChainNow } from '../lib/clock'
import { fetchBoard, fetchStats } from '../lib/contract'
import type { Commodity, Row } from '../lib/contract'
import { formatDate, formatRp, plural, timeAgo } from '../lib/format'
import { resolveCity, useActiveRegions, useCommodities } from '../lib/hooks'
import { rememberCity } from '../lib/prefs'
import { href, navigate } from '../lib/router'
import { useAsync } from '../lib/useAsync'

type Line = { item: Commodity; row: Row }

function updatedText(row: Row, now: number): string {
  const status = rowStatus(row)
  if (status === 'empty') return 'Never reported'
  if (status === 'stale') return `Last report ${formatDate(row.lastKnownAt)}`
  return timeAgo(row.updatedAt, now)
}

function BoardTable({ lines, city, now }: { lines: Line[]; city: number; now: number }) {
  return (
    <table className="table board__table">
      <caption className="sr-only">Reference prices in {regionName(city)}</caption>
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col" className="num">
            Reference price
          </th>
          <th scope="col">vs last sepasar</th>
          <th scope="col">Reporters</th>
          <th scope="col">Updated</th>
          <th scope="col">
            <span className="sr-only">Trend</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map(({ item, row }) => {
          const status = rowStatus(row)
          return (
            <tr key={item.id}>
              <th scope="row">
                <span className="item-name">
                  <a href={href.price(item.id, city)}>{item.name}</a>
                  {item.english && <span className="item-name__en">{item.english}</span>}
                </span>
              </th>
              <td className="num">
                <Price value={row.price} unit={item.unit} />
                {status === 'stale' && (
                  <div className="hint">Last known {formatRp(row.lastKnownPrice)}</div>
                )}
              </td>
              <td>
                <Change row={row} />
              </td>
              <td>
                <div className="board__meta">
                  <StatusTag status={status} />
                  {row.reporters > 0 && <small>{plural(row.reporters, 'reporter')}</small>}
                </div>
              </td>
              <td className="hint">{updatedText(row, now)}</td>
              <td>
                <Sparkline row={row} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function BoardTags({ lines, city, now }: { lines: Line[]; city: number; now: number }) {
  return (
    <ul className="tags" aria-label={`Reference prices in ${regionName(city)}`}>
      {lines.map(({ item, row }) => {
        const status = rowStatus(row)
        return (
          <li key={item.id}>
            <a className="price-tag" href={href.price(item.id, city)}>
              <span className="item-name">
                <span className="item-name__id">{item.name}</span>
                {item.english && <span className="item-name__en">{item.english}</span>}
              </span>
              <span className="price-tag__side">
                <Price value={row.price} unit={item.unit} />
                <Change row={row} />
              </span>
              <span className="price-tag__foot">
                <StatusTag status={status} />
                {row.reporters > 0 && <span>{plural(row.reporters, 'reporter')}</span>}
                <span>{updatedText(row, now)}</span>
                {status === 'stale' && <span>Last known {formatRp(row.lastKnownPrice)}</span>}
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

export function Board({ city: routeCity }: { city?: number }) {
  const now = useChainNow()
  const commodities = useCommodities()
  const active = useActiveRegions()
  const city = resolveCity(routeCity, active)
  const board = useAsync(CONTRACT_ADDRESS && city ? `board:${city}` : null, () => fetchBoard(city as number))
  const stats = useAsync(CONTRACT_ADDRESS ? 'stats' : null, fetchStats)

  useEffect(() => {
    if (routeCity) rememberCity(routeCity)
  }, [routeCity])

  useEffect(() => {
    if (city) document.title = `Staple prices in ${regionName(city)} · Pasaran`
  }, [city])

  const lines: Line[] = useMemo(() => {
    if (!board.data || !commodities.data) return []
    return commodities.data
      .filter((item) => item.active)
      .map((item) => ({ item, row: board.data![item.id] }))
      .filter((line): line is Line => !!line.row)
  }, [board.data, commodities.data])

  const counts = {
    confirmed: lines.filter((l) => rowStatus(l.row) === 'confirmed').length,
    provisional: lines.filter((l) => rowStatus(l.row) === 'provisional').length,
  }
  const newest = Math.max(0, ...lines.map((l) => l.row.updatedAt))
  const nothingHere = lines.length > 0 && lines.every((l) => rowStatus(l.row) === 'empty')
  const others = (active.data ?? []).filter((a) => a.code !== city).sort((a, b) => b.reports - a.reports)

  const pick = (code: number) => {
    rememberCity(code)
    navigate(href.city(code))
  }

  return (
    <div className="wrap page">
      <div className="board-head">
        <h1 className="board-head__title">
          <span>Staple prices in</span>
          {city ? regionName(city) : '…'}
        </h1>
        <CityPicker
          id="board-city"
          label="Show another regency or city"
          value={city}
          onChange={pick}
          active={active.data}
          disabled={!city}
        />
      </div>

      {lines.length > 0 && !nothingHere && (
        <p className="board-summary">
          <span>
            <strong>{counts.confirmed}</strong> of {lines.length} confirmed
          </span>
          <span>
            <strong>{counts.provisional}</strong> provisional
          </span>
          {newest > 0 && <span>Newest report {timeAgo(newest, now)}</span>}
          <span>
            Medians of the last {METHOD.windowDays} days · one wallet, one vote · <a href={href.about}>how it works</a>
          </span>
        </p>
      )}

      {!CONTRACT_ADDRESS && <Empty title="Prices will appear here once Pasaran is live." />}
      {(board.loading || commodities.loading || !city) && !board.data && CONTRACT_ADDRESS && <Loading />}
      {board.error !== undefined && !board.data && <ErrorState error={board.error} onRetry={board.reload} />}
      {commodities.error !== undefined && !commodities.data && (
        <ErrorState error={commodities.error} onRetry={commodities.reload} />
      )}

      {city && nothingHere && (
        <div className="section">
          <Empty title={`Nobody has reported prices in ${regionName(city)} yet.`}>
            <p>Bought rice, eggs or chillies here recently? Your report starts the board for everyone.</p>
            <div className="state__actions">
              <a className="btn btn--primary" href={href.report(undefined, city)}>
                Report the first price
              </a>
            </div>
          </Empty>
        </div>
      )}

      {city && lines.length > 0 && !nothingHere && (
        <div className="board">
          <BoardTable lines={lines} city={city} now={now} />
          <BoardTags lines={lines} city={city} now={now} />
        </div>
      )}

      {others.length > 0 && (
        <section className="section" aria-labelledby="other-cities">
          <h2 id="other-cities" className="section__title">
            Other places with prices
          </h2>
          <ul className="cities">
            {others.map((a) => (
              <li key={a.code}>
                <a href={href.city(a.code)} onClick={() => rememberCity(a.code)}>
                  {shortRegionName(a.code)} <small>{plural(a.reports, 'report')}</small>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.data && stats.data.reports > 0 && (
        <section className="section" aria-label="Pasaran in numbers">
          <dl className="totals">
            <div>
              <dt>{stats.data.reports === 1 ? 'price reported' : 'prices reported'}</dt>
              <dd>{stats.data.reports}</dd>
            </div>
            <div>
              <dt>{stats.data.reporters === 1 ? 'reporter' : 'reporters'}</dt>
              <dd>{stats.data.reporters}</dd>
            </div>
            <div>
              <dt>{stats.data.regions === 1 ? 'regency or city' : 'regencies and cities'}</dt>
              <dd>{stats.data.regions}</dd>
            </div>
            <div>
              <dt>items tracked</dt>
              <dd>{stats.data.commodities}</dd>
            </div>
          </dl>
          <p className="compare-note">
            <a href={href.compare()}>
              Compare one item across places <ArrowRight size={14} aria-hidden="true" style={{ display: 'inline' }} />
            </a>
          </p>
        </section>
      )}
    </div>
  )
}
