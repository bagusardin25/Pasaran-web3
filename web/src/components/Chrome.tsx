import { Wallet } from 'lucide-react'
import { chain, CONTRACT_ADDRESS, explorerAddressUrl, NETWORK } from '../config/chains'
import { SITE } from '../config/site'
import { shortAddress } from '../lib/format'
import { href } from '../lib/router'
import type { Route } from '../lib/router'
import { useWallet } from '../lib/wallet'
import { Mark } from './bits'

const NAV: Array<{ label: string; to: string; match: Route['name'][] }> = [
  { label: 'Prices', to: href.board, match: ['board', 'price'] },
  { label: 'Compare', to: href.compare(), match: ['compare'] },
  { label: 'Reporters', to: href.reporters, match: ['reporters', 'me'] },
  { label: 'For builders', to: href.builders, match: ['builders'] },
  { label: 'How it works', to: href.about, match: ['about'] },
]

function WalletButton() {
  const wallet = useWallet()
  if (!wallet.active) {
    return (
      <button type="button" className="wallet-chip" onClick={wallet.openDialog}>
        <Wallet size={16} aria-hidden="true" />
        Connect
      </button>
    )
  }
  return (
    <button
      type="button"
      className="wallet-chip"
      onClick={wallet.openDialog}
      aria-label={`Wallet ${wallet.active.account}${wallet.wrongChain ? ', wrong network' : ''}. Open wallet details.`}
    >
      <span className={wallet.wrongChain ? 'wallet-chip__dot is-warn' : 'wallet-chip__dot'} aria-hidden="true" />
      <span className="mono">{shortAddress(wallet.active.account)}</span>
    </button>
  )
}

export function Header({ route, reportHref }: { route: Route; reportHref: string }) {
  return (
    <header className="stall">
      <div className="stall__top">
      <div className="wrap stall__bar">
        <a className="brand" href={href.board} aria-label="Pasaran, price board">
          <Mark />
          <span className="brand__name">Pasaran</span>
        </a>
        <nav className="stall__nav" aria-label="Main">
          {NAV.map((item) => (
            <a key={item.to} href={item.to} aria-current={item.match.includes(route.name) ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="stall__actions">
          {route.name !== 'report' && (
            <a className="btn btn--primary btn--small stall__report" href={reportHref}>
              Report a price
            </a>
          )}
          <WalletButton />
        </div>
      </div>
      </div>
      <div className="awning" aria-hidden="true" />
    </header>
  )
}

/** Banners for the two situations that stop the app from working. */
export function Notices() {
  const wallet = useWallet()
  return (
    <>
      {!CONTRACT_ADDRESS && (
        <div className="banner" role="status">
          <div className="wrap">
            Pasaran has not been deployed on {chain.name} yet. Prices will appear here once the contract is live.
          </div>
        </div>
      )}
      {wallet.wrongChain && (
        <div className="banner banner--warn" role="status">
          <div className="wrap banner__row">
            <span>Your wallet is on another network. Pasaran lives on {chain.name}.</span>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => void wallet.switchChain()}>
              Switch to {chain.name}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** On phones, the report button stays where a thumb can reach it. */
export function ThumbBar({ to }: { to: string }) {
  return (
    <div className="thumb-bar">
      <a className="btn btn--primary" href={to}>
        Report a price
      </a>
    </div>
  )
}

export function Footer() {
  const contractUrl = CONTRACT_ADDRESS ? explorerAddressUrl(CONTRACT_ADDRESS) : undefined
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div className="site-footer__about">
          <a className="brand" href={href.board} aria-label="Pasaran, price board">
            <Mark size={26} />
            <span className="brand__name">Pasaran</span>
          </a>
          <p>
            Community reference prices for staple food in Indonesia, worked out on-chain from what residents report. Not
            official statistics and not price advice.
          </p>
        </div>

        <div>
          <h2 className="footer-heading">Built on BOT Chain</h2>
          <ul className="footer-links">
            <li>
              <a href={SITE.botchainUrl} target="_blank" rel="noreferrer">
                botchain.ai
              </a>
            </li>
            <li>
              <a href={SITE.botchainScanUrl} target="_blank" rel="noreferrer">
                scan.botchain.ai
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="footer-heading">Contract</h2>
          <ul className="footer-links">
            <li>
              {CONTRACT_ADDRESS ? (
                contractUrl ? (
                  <a className="mono" href={contractUrl} target="_blank" rel="noreferrer" title={CONTRACT_ADDRESS}>
                    {shortAddress(CONTRACT_ADDRESS)}
                  </a>
                ) : (
                  <span className="mono" title={CONTRACT_ADDRESS}>
                    {shortAddress(CONTRACT_ADDRESS)}
                  </span>
                )
              ) : (
                <span>Not deployed yet</span>
              )}
            </li>
            <li>
              {chain.name}
              {NETWORK !== 'local' && <>&nbsp;· chain ID {chain.id}</>}
            </li>
            <li>
              <a href={href.builders}>Read prices from your contract</a>
            </li>
          </ul>
        </div>

        {SITE.xUrl && (
          <div>
            <h2 className="footer-heading">Follow</h2>
            <ul className="footer-links">
              <li>
                <a href={SITE.xUrl} target="_blank" rel="noreferrer">
                  Pasaran on X
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
      <div className="wrap">
        <p className="colophon">
          No token and no fees beyond gas. Every report is public and permanent. Region names follow the Kemendagri
          regional codes.
        </p>
      </div>
    </footer>
  )
}
