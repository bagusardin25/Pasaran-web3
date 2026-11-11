import { useEffect, useRef } from 'react'
import { Footer, Header, Notices, ThumbBar } from './components/Chrome'
import { WalletDialog } from './components/WalletDialog'
import { syncClock } from './lib/clock'
import { href, useRoute } from './lib/router'
import type { Route } from './lib/router'
import { WalletProvider } from './lib/wallet'
import { About } from './pages/About'
import { Board } from './pages/Board'
import { Builders } from './pages/Builders'
import { Compare } from './pages/Compare'
import { Me } from './pages/Me'
import { PricePage } from './pages/PricePage'
import { ReportPage } from './pages/ReportPage'
import { Reporters } from './pages/Reporters'

const TITLES: Record<Route['name'], string> = {
  board: 'Pasaran — staple food prices from the people who buy them',
  price: 'Price · Pasaran',
  report: 'Report a price · Pasaran',
  compare: 'Compare across places · Pasaran',
  reporters: 'Reporters · Pasaran',
  me: 'My reports · Pasaran',
  builders: 'For builders · Pasaran',
  about: 'How it works · Pasaran',
  notfound: 'Page not found · Pasaran',
}

function NotFound() {
  return (
    <div className="wrap page page--narrow">
      <div className="state state--empty">
        <h1 className="state__title">Nothing on this shelf</h1>
        <p>That page does not exist. The prices are this way.</p>
        <a className="btn btn--primary" href={href.board}>
          Back to the board
        </a>
      </div>
    </div>
  )
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'board':
      return <Board key={route.city ?? 'default'} city={route.city} />
    case 'price':
      return <PricePage key={`${route.commodityId}:${route.city}`} commodityId={route.commodityId} city={route.city} />
    case 'report':
      return <ReportPage key={`${route.commodityId}:${route.city}`} commodityId={route.commodityId} city={route.city} />
    case 'compare':
      return <Compare commodityId={route.commodityId} />
    case 'reporters':
      return <Reporters />
    case 'me':
      return <Me />
    case 'builders':
      return <Builders />
    case 'about':
      return <About />
    case 'notfound':
      return <NotFound />
  }
}

/** Where "Report a price" should lead from here: prefilled with the item and place on screen. */
function reportLink(route: Route): string {
  if (route.name === 'price') return href.report(route.commodityId, route.city)
  if (route.name === 'board' && route.city) return href.report(undefined, route.city)
  return href.report()
}

export default function App() {
  const route = useRoute()
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)
  const routeKey = window.location.hash

  useEffect(() => {
    void syncClock()
    const id = window.setInterval(() => void syncClock(), 5 * 60_000)
    return () => window.clearInterval(id)
  }, [])

  // On navigation, start at the top and hand focus to the new page for keyboard and screen-reader users.
  useEffect(() => {
    document.title = TITLES[route.name]
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  const report = reportLink(route)

  return (
    <WalletProvider>
      <a
        className="skip-link"
        href={href.board}
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Skip to content
      </a>
      <Header route={route} reportHref={report} />
      <Notices />
      <main id="main" ref={main} tabIndex={-1}>
        <Page route={route} />
      </main>
      {(route.name === 'board' || route.name === 'price') && <ThumbBar to={report} />}
      <Footer />
      <WalletDialog />
    </WalletProvider>
  )
}
