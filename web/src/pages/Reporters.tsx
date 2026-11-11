import { Empty, ErrorState, Loading } from '../components/bits'
import { CONTRACT_ADDRESS } from '../config/chains'
import { fetchReporters } from '../lib/contract'
import { sameAddress, shortAddress } from '../lib/format'
import { href } from '../lib/router'
import { useAsync } from '../lib/useAsync'
import { useWallet } from '../lib/wallet'

export function Reporters() {
  const wallet = useWallet()
  const reporters = useAsync(CONTRACT_ADDRESS ? 'reporters' : null, fetchReporters)
  const sorted = [...(reporters.data ?? [])].sort((a, b) => b.reports - a.reports || b.regions - a.regions)

  return (
    <div className="wrap page page--narrow">
      <div className="me-head">
        <div>
          <h1 className="page__title">Reporters</h1>
          <p className="page__lead">The wallets keeping the board current, by number of reports.</p>
        </div>
        <a className="btn btn--secondary" href={href.me}>
          My reports
        </a>
      </div>

      <div className="section" style={{ marginTop: 'var(--s5)' }}>
        {!CONTRACT_ADDRESS && <Empty title="Reporters will appear here once Pasaran is live." />}
        {reporters.loading && !reporters.data && CONTRACT_ADDRESS && <Loading />}
        {reporters.error !== undefined && !reporters.data && (
          <ErrorState error={reporters.error} onRetry={reporters.reload} />
        )}
        {reporters.data && sorted.length === 0 && (
          <Empty title="Nobody has reported a price yet.">
            <a className="btn btn--primary" href={href.report()}>
              Report the first price
            </a>
          </Empty>
        )}
        {sorted.length > 0 && (
          <table className="table">
            <caption className="sr-only">Reporters ranked by reports</caption>
            <thead>
              <tr>
                <th scope="col" className="num">
                  #
                </th>
                <th scope="col">Wallet</th>
                <th scope="col" className="num">
                  Reports
                </th>
                <th scope="col" className="num">
                  Places
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.wallet}>
                  <td className="num">{i + 1}</td>
                  <th scope="row">
                    <span className="mono" title={r.wallet}>
                      {shortAddress(r.wallet)}
                    </span>
                    {sameAddress(r.wallet, wallet.active?.account) && <strong> (you)</strong>}
                  </th>
                  <td className="num">{r.reports}</td>
                  <td className="num">{r.regions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
