import { useEffect, useState } from 'react'
import type { Release, ReleaseType } from './release'
import { safeHttpsUrl, searchReleases, trimSearchQuery } from './search'
import { addRelease, DRAFT_KEY, loadDraft, swapSlots } from './board'
import type { TopBoard } from './board'
import BoardEditor from './BoardEditor'
import { Artwork, GridMark } from './Artwork'
import SharedBoardPage from './SharedBoardPage'

const typeLabels: Record<ReleaseType, string> = {
  ALBUM: 'Album', EP: 'EP', MIXTAPE: 'Mixtape', SINGLE: 'Single',
  COMPILATION: 'Compilation', PLAYLIST: 'Playlist', VIDEO_RELEASE: 'Video', UNKNOWN: 'Release',
}
const providerLabels = { SPOTIFY: 'Spotify', MUSICBRAINZ: 'MusicBrainz', SOUNDCLOUD: 'SoundCloud', YOUTUBE: 'YouTube', GENIUS: 'Genius' }

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
}

function ReleaseCard({ release, index, added, full, onAdd }: { release: Release; index: number; added: boolean; full: boolean; onAdd: () => void }) {
  const source = release.sources.find(source => safeHttpsUrl(source.externalUrl))
  const href = safeHttpsUrl(source?.externalUrl)
  return <article className="release-card">
    <Artwork url={release.artwork?.url} title={release.title} />
    <div className="release-number">{String(index + 1).padStart(2, '0')} <span>{typeLabels[release.type] ?? 'Release'}{release.releaseYear ? ' · ' + release.releaseYear : ''}</span></div>
    <h3>{release.title}</h3>
    <p className="artist">{release.artists.map(artist => artist.name).join(', ')}</p>
    <div className="release-actions">
      {source && href && <a className="source-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={'Open ' + release.title + ' on ' + providerLabels[source.provider]}>
        {source.provider === 'SPOTIFY' && <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor" /><g fill="none" stroke="#111410" strokeLinecap="round"><path strokeWidth="2" d="M5 9c5-2 9-1 14 1" /><path strokeWidth="1.7" d="M6 12c4-1.5 8-1 12 1" /><path strokeWidth="1.5" d="M7 15c3-1 6-.5 10 1" /></g></svg>}
        {providerLabels[source.provider]} <span aria-hidden="true">↗</span>
      </a>}
      <button className="add-button" type="button" disabled={added || full} onClick={onAdd}
        aria-label={added ? release.title + ' is already in your Top 9' : 'Add ' + release.title + ' to Top 9'}>{added ? '✓ Added' : '+ Add'}</button>
    </div>
  </article>
}

export default function App() {
  const path = window.location.pathname
  if (path === '/top' || path.startsWith('/top/')) return <SharedBoardPage payload={path.slice(5)} />
  return <EditorApp />
}

function EditorApp() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Release[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'invalid'>('idle')
  const [draft, setDraft] = useState(loadDraft)
  const [edited, setEdited] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const board = draft.board
  const full = selected === null && board.releases.every(Boolean)

  function updateBoard(next: TopBoard) {
    if (next === board) return
    setDraft({ board: next, warning: null })
    setEdited(true)
  }
  function chooseRelease(release: Release) {
    const next = addRelease(board, release, selected)
    if (next === board) return
    const slot = next.releases.findIndex(item => item?.id === release.id)
    updateBoard(next)
    setSelected(null)
    setAnnouncement(release.title + ' added to slot ' + (slot + 1) + '.')
  }
  function moveRelease(from: number, to: number) {
    const next = swapSlots(board, from, to)
    if (next === board) return
    updateBoard(next)
    setSelected(null)
    setAnnouncement(board.releases[from]?.title + ' moved to slot ' + (to + 1) + '.')
  }

  useEffect(() => {
    document.documentElement.dataset.theme = board.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', board.theme === 'dark' ? '#111410' : '#f5f5eb')
  }, [board.theme])

  useEffect(() => {
    if (!edited) return
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(board))
      setSaveError(false)
      setSaved(true)
    } catch { setSaveError(true); setSaved(false) }
  }, [board, edited])

  useEffect(() => {
    const query = trimSearchQuery(input)
    const length = Array.from(query).length
    if (length < 2 || length > 200) {
      setResults([])
      setStatus(length > 200 ? 'invalid' : 'idle')
      return
    }
    const controller = new AbortController()
    let current = true
    setResults([])
    setStatus('loading')
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchReleases(query, controller.signal)
        if (current) { setResults(response.results); setStatus('success') }
      } catch {
        if (current && !controller.signal.aborted) { setResults([]); setStatus('error') }
      }
    }, 400)
    return () => { current = false; window.clearTimeout(timer); controller.abort() }
  }, [input])

  return <div className="page">
    <header className="site-header">
      <a className="brand" href="/" aria-label="Ninefold home"><GridMark />ninefold<span className="brand-dot">®</span></a>
      <span className="header-note">A LITTLE RECORD OF YOU.</span>
    </header>
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span />YOUR MUSIC. YOUR STORY.</p>
          <h1 id="hero-title">Nine releases.<br /><em>One taste.</em></h1>
        </div>
        <p className="intro">The records that stay with you.<br />Find them. Arrange them. Make it yours.</p>
      </section>
      <div className="workspace">
        <BoardEditor board={board} selected={selected} onSelect={setSelected} onChange={updateBoard} onSwap={moveRelease}
          warning={saveError ? 'Your draft could not be saved. Keep this tab open to avoid losing your changes.' : draft.warning}
          saved={saved} announcement={announcement} />
        <section className="search-section" aria-labelledby="search-title">
          <div className="section-heading"><h2 id="search-title"><span aria-hidden="true">01</span> Find your release</h2><span className="section-note">START WITH WHAT YOU LOVE</span></div>
          <label className="search-label" htmlFor="release-query">Release title or artist</label>
          <div className="search-field">
            <SearchIcon />
            <input id="release-query" type="search" value={input} onChange={event => setInput(event.target.value)} placeholder="Try Cold Visions or Björk"
              autoComplete="off" spellCheck={false} maxLength={400} aria-describedby="search-hint" />
          </div>
          <p id="search-hint" className="search-hint">Type at least 2 characters to start searching.</p>
          {full && <p className="search-hint">All nine slots are filled. Select a board slot to replace a release.</p>}
          <div className="results-area" aria-busy={status === 'loading'}>
            <div className="status" role={status === 'error' || status === 'invalid' ? 'alert' : 'status'} aria-live="polite">
              {status === 'idle' && <div className="idle-state"><span className="idle-icon"><SearchIcon /></span><h3>Every taste starts somewhere.</h3><p>Think of a favorite record. Find it here.</p></div>}
              {status === 'loading' && <p className="loading"><span className="spinner" />Searching for releases…</p>}
              {status === 'error' && <p>Search failed. Please try again.</p>}
              {status === 'invalid' && <p>Your search must be no longer than 200 characters.</p>}
              {status === 'success' && results.length === 0 && <p>No releases found. Try another title or artist.</p>}
              {status === 'success' && results.length > 0 && <p className="results-count">FOUND: {results.length}</p>}
            </div>
            {status === 'success' && results.length > 0 && <div className="results-grid">{results.map((release, index) => <ReleaseCard key={release.id}
              release={release} index={index} added={board.releases.some(slot => slot?.id === release.id)} full={full} onAdd={() => chooseRelease(release)} />)}</div>}
          </div>
        </section>
      </div>
    </main>
    <footer><span>ninefold <span className="footer-year">© 2026</span></span><p>Nine releases. One you.</p><span className="footer-note">MADE FOR MUSIC PEOPLE.</span></footer>
  </div>
}

