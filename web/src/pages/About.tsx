import { StatusTag } from '../components/price'
import { chain } from '../config/chains'
import { METHOD, SITE } from '../config/site'
import { formatRp } from '../lib/format'
import { useCommodities } from '../lib/hooks'
import { href } from '../lib/router'

const STEPS = [
  {
    title: 'You report',
    text: 'The price you paid or saw on a tag, for one item, in your regency or city.',
  },
  {
    title: 'One vote each',
    text: `Each wallet's newest report counts once. Reporting again replaces your old one; you can update every ${METHOD.cooldownHours} hours.`,
  },
  {
    title: 'Median of 14 days',
    text: `The contract takes the middle value of the last ${METHOD.windowDays} days of reports. One wild price cannot drag it.`,
  },
  {
    title: 'History by sepasar',
    text: `When a ${METHOD.sepasarDays}-day sepasar ends, its closing median is kept. That is how the charts build themselves.`,
  },
]

export function About() {
  const commodities = useCommodities()

  return (
    <div className="wrap page">
      <h1 className="page__title">How the prices are worked out</h1>
      <p className="page__lead">
        Pasaran is a price board written by the people who shop. Every number on it is calculated by a smart contract on{' '}
        {chain.name} from reports anyone can check.
      </p>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="steps__no" aria-hidden="true">
              {i + 1}
            </span>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="prose">
        <h2>What the labels mean</h2>
        <dl className="kv">
          <div>
            <dt>
              <StatusTag status="confirmed" />
            </dt>
            <dd>{METHOD.confirmAt} or more different wallets reported it in the last {METHOD.windowDays} days.</dd>
          </div>
          <div>
            <dt>
              <StatusTag status="provisional" />
            </dt>
            <dd>Only one or two reported it. Treat it as a hint.</dd>
          </div>
          <div>
            <dt>
              <StatusTag status="stale" />
            </dt>
            <dd>Nobody reported it in the last {METHOD.windowDays} days. The last known price and its date are shown.</dd>
          </div>
        </dl>

        <h2>The fine print</h2>
        <ul>
          <li>An even number of reports gives the average of the two middle ones, rounded down to the rupiah.</li>
          <li>At most the {METHOD.boardSize} most recent reporters count for one item in one place.</li>
          <li>
            Change arrows compare today’s reference with the closing median of the last sepasar on record. ▲ means
            dearer, ▼ cheaper.
          </li>
          <li>
            Sepasars here are plain {METHOD.sepasarDays}-day periods counted from 1 January 1970; the app does not name
            them Legi, Pahing, Pon, Wage or Kliwon.
          </li>
        </ul>

        <h2>Sensible ranges</h2>
        <p>
          Each item accepts prices only within a wide range, to catch a missing or extra zero. The contract owner can move
          a range as prices change, and every change is recorded on-chain. Nobody, including the owner, can edit or delete
          a report or set a price.
        </p>
        {commodities.data && (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="num">
                  Accepted range
                </th>
              </tr>
            </thead>
            <tbody>
              {commodities.data.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name}
                    {c.english && <div className="hint">{c.english}</div>}
                  </th>
                  <td className="num">
                    {formatRp(c.minPrice)} – {formatRp(c.maxPrice)} per {c.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>What Pasaran is not</h2>
        <ul>
          <li>
            <strong>It is a community reference.</strong> It is not official government data and not advice on what to
            pay.
          </li>
          <li>
            <strong>Few reporters, weak price.</strong> A place where one or two people report can be moved easily. That
            is why the label and the number of reporters are always shown.
          </li>
          <li>
            <strong>Not an oracle for money.</strong> Wallets are cheap to create and nothing is staked, so do not settle
            funds on these prices alone. <a href={href.builders}>Builders</a> get the same warning.
          </li>
          <li>
            <strong>Public and permanent.</strong> Every report shows the wallet, the price, the time and the market name
            given. Keep personal details out of it.
          </li>
        </ul>

        <h2>Places</h2>
        <p>
          Places are Indonesian regencies and cities, identified by their Kemendagri regional codes. The pickers list a
          starting set of large cities and regencies; the contract accepts any well-formed code.
        </p>

        <h2>Built on BOT Chain</h2>
        <p>
          Pasaran runs on {chain.name}, an EVM-compatible layer 1. See <a href={SITE.botchainUrl}>botchain.ai</a> and
          the explorer at <a href={SITE.botchainScanUrl}>scan.botchain.ai</a>, where every report can be looked up.
        </p>
      </div>
    </div>
  )
}
