import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { chain } from '../config/chains'
import { href } from '../lib/router'
import { useWallet } from '../lib/wallet'
import { CopyButton } from './bits'

export function WalletDialog() {
  const wallet = useWallet()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (wallet.dialogOpen && !dialog.open) dialog.showModal()
    if (!wallet.dialogOpen && dialog.open) dialog.close()
  }, [wallet.dialogOpen])

  const { active } = wallet

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="wallet-dialog-title"
      onClose={wallet.closeDialog}
      onClick={(event) => {
        if (event.target === ref.current) wallet.closeDialog()
      }}
    >
      <div className="dialog__body">
        <div className="dialog__head">
          <h2 id="wallet-dialog-title">{active ? 'Your wallet' : 'Connect a wallet'}</h2>
          <button type="button" className="icon-btn" onClick={wallet.closeDialog} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {active ? (
          <>
            <dl className="facts">
              <div>
                <dt>Address</dt>
                <dd className="mono wrap-anywhere">{active.account}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{active.connectorName}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{wallet.wrongChain ? `Not ${chain.name}` : chain.name}</dd>
              </div>
            </dl>

            {wallet.wrongChain && (
              <div className="note note--warn">
                <p>Pasaran lives on {chain.name}. Switch networks to report a price.</p>
                <button type="button" className="btn btn--primary btn--small" onClick={() => void wallet.switchChain()}>
                  Switch to {chain.name}
                </button>
              </div>
            )}
            {wallet.error && (
              <p className="tx tx--error" role="alert">
                {wallet.error}
              </p>
            )}

            <div className="dialog__actions">
              <CopyButton text={active.account} label="Copy address" />
              <a className="btn btn--secondary btn--small" href={href.me} onClick={wallet.closeDialog}>
                My reports
              </a>
              <button
                type="button"
                className="btn btn--quiet btn--small"
                onClick={() => {
                  wallet.disconnect()
                  wallet.closeDialog()
                }}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog__lead">
              Prices are open to everyone. You only need a wallet to report one, and it costs a little BOT for gas.
            </p>

            {wallet.connectors.length > 0 ? (
              <ul className="connectors">
                {wallet.connectors.map((connector) => (
                  <li key={connector.id}>
                    <button
                      type="button"
                      className="connector"
                      onClick={() => void wallet.connect(connector)}
                      disabled={wallet.connecting !== undefined}
                    >
                      {connector.icon ? (
                        <img className="connector__icon" src={connector.icon} alt="" width={28} height={28} />
                      ) : (
                        <span className="connector__icon connector__icon--blank" aria-hidden="true" />
                      )}
                      <span className="connector__name">{connector.name}</span>
                      <span className="connector__hint">
                        {wallet.connecting === connector.id
                          ? 'Waiting for wallet…'
                          : connector.kind === 'dev'
                            ? 'Local test account'
                            : 'Detected'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="note">
                <p>No wallet was found in this browser.</p>
                <p>
                  Install{' '}
                  <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                    MetaMask
                  </a>{' '}
                  or open this page inside{' '}
                  <a href="https://wallet.botchain.ai/" target="_blank" rel="noreferrer">
                    BO Wallet
                  </a>
                  , then come back.
                </p>
              </div>
            )}

            {wallet.error && (
              <p className="tx tx--error" role="alert">
                {wallet.error}
              </p>
            )}
            <p className="dialog__fine">
              Pasaran runs on {chain.name} (chain ID {chain.id}). If your wallet does not know the network yet, it will
              offer to add it.
            </p>
          </>
        )}
      </div>
    </dialog>
  )
}
