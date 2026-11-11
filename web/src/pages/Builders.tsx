import { CopyButton, Empty } from '../components/bits'
import { chain, CONTRACT_ADDRESS, explorerAddressUrl } from '../config/chains'
import { METHOD } from '../config/site'
import { formatRp } from '../lib/format'
import { useCommodities } from '../lib/hooks'

const SOLIDITY = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPasaran {
    function priceOf(uint8 commodityId, uint16 regionCode)
        external
        view
        returns (uint256 price, uint256 reporters, uint256 updatedAt, bool confirmed);
}

contract RiceQuote {
    IPasaran public immutable pasaran;

    error NotConfirmed(uint256 reporters);
    error TooOld(uint256 updatedAt);

    constructor(IPasaran pasaran_) {
        pasaran = pasaran_;
    }

    /// Medium-grade rice (item 0) in Kota Bandung (3273), in rupiah per kg.
    function riceInBandung() external view returns (uint256) {
        (uint256 price, uint256 reporters, uint256 updatedAt, bool confirmed) =
            pasaran.priceOf(0, 3273);
        if (!confirmed) revert NotConfirmed(reporters);       // fewer than 3 wallets
        if (block.timestamp - updatedAt > 3 days) revert TooOld(updatedAt);
        return price;
    }
}`

const VIEM = `import { createPublicClient, http, parseAbi } from 'viem'

const client = createPublicClient({ transport: http('https://rpc.botchain.ai') })

const [price, reporters, updatedAt, confirmed] = await client.readContract({
  address: '${CONTRACT_ADDRESS ?? '0x…'}',
  abi: parseAbi([
    'function priceOf(uint8 commodityId, uint16 regionCode) view returns (uint256, uint256, uint256, bool)',
  ]),
  functionName: 'priceOf',
  args: [0, 3273], // Beras medium, Kota Bandung
})`

function Code({ code, label }: { code: string; label: string }) {
  return (
    <div className="code">
      <div className="code__copy">
        <CopyButton text={code} label={`Copy ${label}`} />
      </div>
      <pre tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Builders() {
  const commodities = useCommodities()
  const explorer = CONTRACT_ADDRESS ? explorerAddressUrl(CONTRACT_ADDRESS) : undefined

  return (
    <div className="wrap page">
      <h1 className="page__title">For builders</h1>
      <p className="page__lead">
        Every reference price on this board can be read by another contract on {chain.name} in one call, with no key
        and no fee beyond gas.
      </p>

      <div className="prose">
        <h2>The contract</h2>
        {CONTRACT_ADDRESS ? (
          <dl className="kv">
            <div>
              <dt>Address</dt>
              <dd className="mono">
                {explorer ? (
                  <a href={explorer} target="_blank" rel="noreferrer">
                    {CONTRACT_ADDRESS}
                  </a>
                ) : (
                  CONTRACT_ADDRESS
                )}
              </dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>
                {chain.name}, chain ID {chain.id}
              </dd>
            </div>
          </dl>
        ) : (
          <Empty title={`Not deployed on ${chain.name} yet.`} />
        )}

        <h2>One function</h2>
        <p>
          <code>priceOf(uint8 commodityId, uint16 regionCode)</code> returns four values:
        </p>
        <dl className="kv">
          <div>
            <dt>
              <code>price</code>
            </dt>
            <dd>
              Median in whole rupiah per unit of the reports made in the last {METHOD.windowDays} days, one per wallet. 0
              when there are none.
            </dd>
          </div>
          <div>
            <dt>
              <code>reporters</code>
            </dt>
            <dd>How many distinct wallets that median rests on, at most {METHOD.boardSize}.</dd>
          </div>
          <div>
            <dt>
              <code>updatedAt</code>
            </dt>
            <dd>Unix time of the newest report counted.</dd>
          </div>
          <div>
            <dt>
              <code>confirmed</code>
            </dt>
            <dd>True when at least {METHOD.confirmAt} wallets reported.</dd>
          </div>
        </dl>

        <h2>Use it carefully</h2>
        <ul>
          <li>
            Always check <code>confirmed</code> and how old <code>updatedAt</code> is before using <code>price</code>.
          </li>
          <li>
            This is community data. New wallets are easy to make and nothing is staked, so a place with few reporters can
            be pushed around.
          </li>
          <li>
            <strong>Do not settle funds on it alone.</strong> Use it for quotes, displays and soft limits, or combine it
            with other sources.
          </li>
        </ul>

        <h2>Example: Solidity</h2>
        <Code code={SOLIDITY} label="Solidity example" />

        <h2>Example: reading it off-chain with viem</h2>
        <Code code={VIEM} label="viem example" />

        <h2>Item ids</h2>
        {commodities.data ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col" className="num">
                  Id
                </th>
                <th scope="col">Item</th>
                <th scope="col">Unit</th>
                <th scope="col" className="num">
                  Accepted range
                </th>
              </tr>
            </thead>
            <tbody>
              {commodities.data.map((c) => (
                <tr key={c.id}>
                  <td className="num">{c.id}</td>
                  <th scope="row">
                    {c.name}
                    {c.english && <div className="hint">{c.english}</div>}
                    {!c.active && <div className="hint">Paused</div>}
                  </th>
                  <td>{c.unit}</td>
                  <td className="num">
                    {formatRp(c.minPrice)} – {formatRp(c.maxPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hint">The list appears once the contract is reachable.</p>
        )}

        <h2>Region codes</h2>
        <p>
          Regions are four-digit Indonesian regency and city codes from the Kemendagri scheme: two digits for the
          province, two for the regency or city, with cities starting at 71. Kota Bandung is <code>3273</code>, Kota
          Surabaya <code>3578</code>, Kota Jakarta Selatan <code>3171</code>. The contract checks that a code is well
          formed; it does not keep a list of names.
        </p>
      </div>
    </div>
  )
}
