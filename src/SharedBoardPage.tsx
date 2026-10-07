import { useEffect, useState } from 'react'
import { boardHeading } from './board'
import type { TopBoard } from './board'
import { decodeShare, ShareError } from './sharing'
import { safeHttpsUrl } from './search'
import { Artwork, GridMark } from './Artwork'
import ShareActions from './ShareActions'
import { SiteHeader, SiteFooter, SpotifyIcon } from './SiteChrome'

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', board.theme === 'dark' ? '#171823' : '#f1f1fa')
  }, [board])

  return <div className="page shared-page">
    <SiteHeader />
    <main>
      {!board && !state.error && <p className="shared-loading" role="status">Opening this Top 9…</p>}
      {state.error && <div className="shared-error"><h1>Unable to open this Top 9</h1><p role="alert">{state.error}</p></div>}
      {board && <>
        <section className="shared-intro">
          <p className="shared-label">Shared board</p>
          <h1>{boardHeading(board)}</h1>

        </section>
        <ol className="shared-grid" aria-label="Shared Top 9">
          {board.releases.map((release, index) => {
            const source = release?.sources.find(source => safeHttpsUrl(source.externalUrl))
            const href = safeHttpsUrl(source?.externalUrl)
            return <li key={index}>
              <div className="shared-cover">{release ? <Artwork url={release.artwork?.url} title={release.title} />
                : <div className="cover shared-empty"><GridMark /><span>Empty slot</span></div>}<span className="slot-number">{String(index + 1).padStart(2, '0')}</span></div>
              {release && <><h2 title={release.title}>{release.title}</h2><p className="artist">{release.artists.map(artist => artist.name).join(', ')}{release.releaseYear ? ' · ' + release.releaseYear : ''}</p>
                {source && href && <a className="source-link" href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={'Open ' + release.title + ' on ' + providerLabels[source.provider]}>{source.provider === 'SPOTIFY' && <SpotifyIcon />}{providerLabels[source.provider]} ↗</a>}</>}
            </li>
          })}
        </ol>
        <ShareActions board={board} allowShare={false} />
      </>}
      <div className="shared-return"><a className="secondary-button" href="/">Create your own Top 9</a></div>
    </main>
    <SiteFooter />
  </div>
}

