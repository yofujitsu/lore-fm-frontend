import { useEffect, useState } from 'react'
import type { TopBoard } from './board'
import { decodeShare, ShareError } from './sharing'
import { safeHttpsUrl } from './search'
import { Artwork, GridMark } from './Artwork'
import ShareActions from './ShareActions'

const providerLabels = { SPOTIFY: 'Spotify', MUSICBRAINZ: 'MusicBrainz', SOUNDCLOUD: 'SoundCloud', YOUTUBE: 'YouTube', GENIUS: 'Genius' }

export default function SharedBoardPage({ payload }: { payload: string }) {
  const [state, setState] = useState<{ board: TopBoard | null; error: string | null }>({ board: null, error: null })
  useEffect(() => {
    let current = true
    setState({ board: null, error: null })
    decodeShare(payload).then(board => { if (current) setState({ board, error: null }) })
      .catch(error => { if (current) setState({ board: null, error: error instanceof ShareError ? error.message : 'This share link could not be opened.' }) })
    return () => { current = false }
  }, [payload])
  const board = state.board
  useEffect(() => {
    if (!board) return
    document.documentElement.dataset.theme = board.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', board.theme === 'dark' ? '#111410' : '#f5f5eb')
  }, [board])

  return <div className="page shared-page">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Ninefold home"><GridMark />ninefold<span className="brand-dot">®</span></a>
      <span className="header-note">NINE RELEASES. ONE TASTE.</span>
    </header>
    <main>
      {!board && !state.error && <p className="shared-loading" role="status">Opening this Top 9…</p>}
      {state.error && <div className="shared-error"><h1>Unable to open this Top 9</h1><p role="alert">{state.error}</p></div>}
      {board && <>
        <section className="shared-intro">
          <p className="eyebrow"><span />A LITTLE RECORD OF YOU.</p>
          <h1>{board.nickname ? board.nickname + "'s Top 9" : 'Nine releases. One taste.'}</h1>
          <p className="intro">The records that stay with you.</p>
        </section>
        <ol className="shared-grid" aria-label="Shared Top 9">
          {board.releases.map((release, index) => {
            const source = release?.sources.find(source => safeHttpsUrl(source.externalUrl))
            const href = safeHttpsUrl(source?.externalUrl)
            return <li key={index}>
              <div className="shared-cover">{release ? <Artwork url={release.artwork?.url} title={release.title} />
                : <div className="cover shared-empty"><GridMark /><span>AN OPEN SLOT</span></div>}<span className="slot-number">{String(index + 1).padStart(2, '0')}</span></div>
              {release && <><h2>{release.title}</h2><p className="artist">{release.artists.map(artist => artist.name).join(', ')}{release.releaseYear ? ' · ' + release.releaseYear : ''}</p>
                {source && href && <a className="source-link" href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={'Open ' + release.title + ' on ' + providerLabels[source.provider]}>{providerLabels[source.provider]} ↗</a>}</>}
            </li>
          })}
        </ol>
        <ShareActions board={board} allowShare={false} />
      </>}
      <div className="shared-return"><a className="secondary-button" href="/">Create your own Top 9</a></div>
    </main>
    <footer><span>ninefold <span className="footer-year">© 2026</span></span><p>Nine releases. One you.</p><span className="footer-note">MADE FOR MUSIC PEOPLE.</span></footer>
  </div>
}

