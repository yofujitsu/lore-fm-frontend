import type { ReactNode } from 'react'
import type { TopBoard } from './board'
import { GridMark } from './Artwork'
export function SpotifyIcon() { return <img className="provider-icon" src="/brand/spotify.svg" alt="" aria-hidden="true" /> }
export function SiteHeader({ theme, onThemeChange, children }: { theme?: TopBoard['theme']; onThemeChange?: (theme: TopBoard['theme']) => void; children?: ReactNode }) {
  return <header className="site-header">
    <a className="brand" href="/" aria-label="Ninefold home"><GridMark />ninefold</a>
    {children}
    <div className="header-actions">
    <a className="developer-link" href="https://github.com/yofujitsu" target="_blank" rel="noopener noreferrer" aria-label="yofujitsu on GitHub" title="yofujitsu on GitHub">
      <span>made by fj</span>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.09c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.12-1.25-5.12-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.51-1.43.11-2.98 0 0 .94-.3 3.1 1.15a10.81 10.81 0 0 1 5.64 0c2.16-1.46 3.1-1.15 3.1-1.15.62 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z"/></svg>
    </a>
    {theme && onThemeChange && <button className="theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
        {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
          : <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />}
      </svg>
    </button>}
    </div>
  </header>
}
export function SiteFooter() {
  return <footer><span className="footer-brand">ninefold <span className="footer-year">© {new Date().getFullYear()}</span></span>
    <div className="provider-credit"><span>Powered by</span><a href="https://open.spotify.com/" target="_blank" rel="noopener noreferrer"><SpotifyIcon />Spotify</a><span className="credit-join">&</span><a href="https://musicbrainz.org/" target="_blank" rel="noopener noreferrer"><img className="provider-icon" src="/brand/musicbrainz.svg" alt="" aria-hidden="true" />MusicBrainz</a></div>
  </footer>
}
