import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ByteCount, Empty, TxStatus } from '../components/bits'
import { CityPicker } from '../components/CityPicker'
import { Price, StatusTag, rowStatus } from '../components/price'
import { chain, CONTRACT_ADDRESS } from '../config/chains'
import { DEVIATION_WARNING, METHOD } from '../config/site'
import { regionName } from '../data/regions'
import { useChainNow } from '../lib/clock'
import { fetchFeed, fetchNextReportTime, prepare } from '../lib/contract'
import { byteLength, formatDateTime, formatDigits, formatPercent, formatRp, parseRupiah, plural } from '../lib/format'
import { resolveCity, useActiveRegions, useCommodities } from '../lib/hooks'
import { rememberCity } from '../lib/prefs'
import { href } from '../lib/router'
import { useTx } from '../lib/tx'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

type Sent = { commodityId: number; city: number; price: number }

export function ReportPage({ commodityId: routeItem, city: routeCity }: { commodityId?: number; city?: number }) {
  const now = useChainNow()
  const wallet = useWallet()
  const tx = useTx()
  const commodities = useCommodities()
  const active = useActiveRegions()
  const priceHelp = useId()
  const marketHelp = useId()

  const [pickedCity, setCity] = useState<number | undefined>(routeCity)
  const [commodityId, setCommodityId] = useState<number>(routeItem ?? 0)
  const [priceText, setPriceText] = useState('')
  const [market, setMarket] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirmingFar, setConfirmingFar] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)

  // Until someone picks a city, use the one this device or the board would show.
  const city = pickedCity ?? resolveCity(routeCity, active)

  const items = (commodities.data ?? []).filter((c) => c.active)
  const item = commodities.data?.[commodityId]
  const pair = city !== undefined && item ? `${commodityId}:${city}` : null

  const feed = useAsync(pair && CONTRACT_ADDRESS ? `feed:${pair}` : null, () => fetchFeed(commodityId, city as number))
  const account = wallet.active?.account
  const cooldown = useAsync(pair && account && CONTRACT_ADDRESS ? `next:${pair}:${account}` : null, () =>
    fetchNextReportTime(account!, commodityId, city as number),
  )
  const waitUntil = cooldown.data && cooldown.data > now ? cooldown.data : 0

  const price = parseRupiah(priceText)
  const marketBytes = byteLength(market.trim())
  const priceError =
    price === undefined
      ? 'Enter the price in rupiah.'
      : item && (price < item.minPrice || price > item.maxPrice)
        ? `That is outside the sensible range for ${item.name.toLowerCase()} (${formatRp(item.minPrice)} to ${formatRp(item.maxPrice)} per ${item.unit}). Check for a missing or extra zero.`
        : undefined
  const marketError = marketBytes > METHOD.marketBytes ? 'The market name can be at most 40 bytes.' : undefined

  const reference = feed.data && feed.data.price > 0 ? feed.data.price : 0
  const deviation = price && reference ? (price - reference) / reference : 0
  const far = Math.abs(deviation) > DEVIATION_WARNING

  const send = async () => {
    if (city === undefined || price === undefined) return
    const result = await tx.run((from) => prepare.report(from, commodityId, city, price, market.trim()))
    if (result) {
      rememberCity(city)
      setSent({ commodityId, city, price })
      setConfirmingFar(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (priceError || marketError) {
      document.getElementById(priceError ? 'report-price' : 'report-market')?.focus()
      return
    }
    if (tx.busy || waitUntil) return
    if (far && !confirmingFar) {
      setConfirmingFar(true)
      return
    }
    await send()
  }

  const startAnother = () => {
    setSent(null)
    setPriceText('')
    setMarket('')
    setTouched(false)
    tx.reset()
    window.setTimeout(() => document.getElementById('report-item')?.focus(), 0)
  }

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="wrap page page--narrow">
        <h1 className="page__title">Report a price</h1>
        <Empty title={`Reporting opens once Pasaran is live on ${chain.name}.`} />
      </div>
    )
  }

  if (sent) {
    const sentItem = commodities.data?.[sent.commodityId]
    const row = feed.data
    return (
      <div className="wrap page page--narrow">
        <h1 className="page__title">Report a price</h1>
        <div className="success" style={{ marginTop: 'var(--s6)' }} role="status">
          <h2 className="success__title">
            <CheckCircle2 size={24} aria-hidden="true" /> Your price is on the board
          </h2>
          <p>
            You reported <strong>{formatRp(sent.price)}</strong> per {sentItem?.unit} for {sentItem?.name} in{' '}
            {regionName(sent.city)}.
          </p>
          {row && row.price > 0 && (
            <p>
              The reference there is now <strong>{formatRp(row.price)}</strong>, from {plural(row.reporters, 'reporter')}
              . <StatusTag status={rowStatus(row)} />
            </p>
          )}
          <TxStatus state={tx.state} done="Recorded on BOT Chain." />
          <div className="state__actions">
            <a className="btn btn--primary" href={href.price(sent.commodityId, sent.city)}>
              See this price
            </a>
            <button type="button" className="btn btn--secondary" onClick={startAnother}>
              Report another item
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wrap page">
      <h1 className="page__title">Report a price</h1>
      <p className="page__lead">
        Tell everyone what you paid or saw on a price tag. A new report from you replaces your earlier one for the same
        item and place.
      </p>

      <div className="report-layout">
        <aside className="reference" aria-label="Current reference for this item">
          <span className="label">Now in {city ? regionName(city) : '…'}</span>
          {feed.data ? (
            <>
              <Price value={feed.data.price} unit={item?.unit} />
              <div>
                <StatusTag status={rowStatus(feed.data)} />
              </div>
              <p className="hint">
                {feed.data.reporters > 0
                  ? `Median of ${plural(feed.data.reporters, 'reporter')} in the last ${METHOD.windowDays} days.`
                  : feed.data.lastKnownAt > 0
                    ? `No recent reports. Last known ${formatRp(feed.data.lastKnownPrice)}.`
                    : 'Nobody has reported this item here yet. Yours would be the first.'}
              </p>
            </>
          ) : (
            <p className="hint">Choose a place and an item to see the current reference.</p>
          )}
          {item && (
            <p className="reference__range">
              Sensible range: {formatRp(item.minPrice)} to {formatRp(item.maxPrice)} per {item.unit}.
            </p>
          )}
        </aside>

        <form className="form" onSubmit={submit} noValidate>
          <CityPicker
            id="report-city"
            label="Regency or city"
            value={city}
            onChange={(code) => {
              setCity(code)
              setConfirmingFar(false)
            }}
            active={active.data}
            disabled={tx.busy}
          />

          <div className="form__group">
            <label htmlFor="report-item">Item</label>
            <select
              id="report-item"
              className="field"
              value={commodityId}
              onChange={(e) => {
                setCommodityId(Number(e.target.value))
                setConfirmingFar(false)
              }}
              disabled={tx.busy || items.length === 0}
            >
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.english ? ` — ${c.english}` : ''} (per {c.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="form__group">
            <label htmlFor="report-price">Price you paid or saw</label>
            <div className={touched && priceError ? 'money is-invalid' : 'money'}>
              <span className="money__affix" aria-hidden="true">
                Rp
              </span>
              <input
                id="report-price"
                inputMode="numeric"
                autoComplete="off"
                value={priceText}
                onChange={(e) => {
                  setPriceText(e.target.value)
                  setConfirmingFar(false)
                }}
                onBlur={() => price !== undefined && setPriceText(price.toLocaleString('id-ID'))}
                placeholder={reference ? `e.g. ${formatDigits(reference)}` : 'Price in rupiah'}
                aria-describedby={priceHelp}
                aria-invalid={touched && !!priceError}
                disabled={tx.busy}
              />
              <span className="money__affix money__affix--unit">per {item?.unit ?? 'unit'}</span>
            </div>
            <p id={priceHelp} className={touched && priceError ? 'hint hint--error' : 'hint'}>
              {touched && priceError
                ? priceError
                : item
                  ? `Whole rupiah per ${item.unit}, for ${item.name.toLowerCase()}${item.english ? ` (${item.english.toLowerCase()})` : ''}.`
                  : 'Whole rupiah.'}
            </p>
          </div>

          <div className="form__group">
            <div className="form__labelrow">
              <label htmlFor="report-market">Market or shop (optional)</label>
              <ByteCount used={marketBytes} max={METHOD.marketBytes} />
            </div>
            <input
              id="report-market"
              className="field"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="e.g. Pasar Induk"
              autoComplete="off"
              aria-describedby={marketHelp}
              aria-invalid={!!marketError}
              disabled={tx.busy}
            />
            <p id={marketHelp} className={marketError ? 'hint hint--error' : 'hint'}>
              {marketError ?? 'Shown next to your report. Name a public market or shop, never a home address.'}
            </p>
          </div>

          {waitUntil > 0 && (
            <div className="note note--warn" role="status">
              <p>
                You already reported this item in {city ? regionName(city) : 'this place'} recently. You can update it
                from {formatDateTime(waitUntil)}.
              </p>
            </div>
          )}

          {confirmingFar && price && reference > 0 && (
            <div className="confirm" role="alert">
              <p>
                {formatRp(price)} is {formatPercent(deviation)} {deviation > 0 ? 'above' : 'below'} the current reference
                of {formatRp(reference)}. Is that the price you saw?
              </p>
              <div className="state__actions">
                <button type="button" className="btn btn--primary" onClick={() => void send()} disabled={tx.busy}>
                  Yes, report {formatRp(price)}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setConfirmingFar(false)
                    document.getElementById('report-price')?.focus()
                  }}
                >
                  Let me check
                </button>
              </div>
            </div>
          )}

          <div className="note">
            <p>
              <strong>Public and permanent.</strong> Your wallet address, the price and the market name are written to{' '}
              {chain.name} and cannot be changed. Report what you actually saw.
            </p>
          </div>

          {!confirmingFar && (
            <div className="form__actions">
              {!account ? (
                <button type="button" className="btn btn--primary" onClick={wallet.openDialog}>
                  Connect wallet to report
                </button>
              ) : (
                <button type="submit" className="btn btn--primary" disabled={tx.busy || waitUntil > 0}>
                  Report price
                </button>
              )}
            </div>
          )}
          <TxStatus state={tx.state} />
        </form>
      </div>
    </div>
  )
}
