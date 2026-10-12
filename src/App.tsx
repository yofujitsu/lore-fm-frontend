import { useEffect, useState } from 'react'
import type { Release, ReleaseType } from './release'
import { safeHttpsUrl, searchReleases, trimSearchQuery } from './search'
import { addRelease, DRAFT_KEY, loadDraft, swapSlots } from './board'
import type { TopBoard } from './board'
import BoardEditor from './BoardEditor'
import SavedBoards from './SavedBoards'
import { Artwork } from './Artwork'
import { SiteHeader, SiteFooter, SpotifyIcon } from './SiteChrome'
import SharedBoardPage from './SharedBoardPage'
import AnimatedHeading from './AnimatedHeading'

const typeLabels: Record<ReleaseType, string> = {
  ALBUM: 'Album', EP: 'EP', MIXTAPE: 'Mixtape', SINGLE: 'Single',
  COMPILATION: 'Compilation', PLAYLIST: 'Playlist', VIDEO_RELEASE: 'Video', UNKNOWN: 'Release',
}
const providerLabels = { SPOTIFY: 'Spotify', MUSICBRAINZ: 'MusicBrainz', SOUNDCLOUD: 'SoundCloud', YOUTUBE: 'YouTube', GENIUS: 'Genius' }

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
}

function ReleaseCard({ release, added, full, onAdd }: { release: Release; added: boolean; full: boolean; onAdd: () => void }) {
  return <article className="release-card">
    <Artwork url={release.artwork?.url} title={release.title} />
    <div className="release-info">
      <h3>{release.title}</h3><p className="artist">{release.artists.map(artist => artist.name).join(', ')}</p>
      <p className="release-meta">{typeLabels[release.type] ?? 'Release'}{release.releaseYear ? ' · ' + release.releaseYear : ''}</p>
      <div className="source-links">{release.sources.map(source => {
        const href = safeHttpsUrl(source.externalUrl)
        return href && <a key={source.provider + ':' + source.externalId} className="source-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={'Open ' + release.title + ' on ' + providerLabels[source.provider]}>
          {source.provider === 'SPOTIFY' && <SpotifyIcon />}{providerLabels[source.provider]} <span aria-hidden="true">↗</span>
        </a>
      })}</div>
    </div>
    <button className="add-button" type="button" disabled={added || full} onClick={onAdd}
      aria-label={added ? release.title + ' is already in your Top 9' : 'Add ' + release.title + ' to Top 9'}>{added ? '✓' : '+ Add'}</button>
  </article>
}

export default function App() {
  const path = window.location.pathname
  if (path === '/top' || path.startsWith('/top/')) return <SharedBoardPage payload={path.slice(5)} />
  return <EditorApp />
}

function EditorApp() {
  const [activeView, setActiveView] = useState<'board' | 'saved'>('board')
  const [loadedBoard, setLoadedBoard] = useState(0)
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Release[]>([])
  const [partial, setPartial] = useState(false)
  const [filterType, setFilterType] = useState<ReleaseType | ''>('')
  const [filterYear, setFilterYear] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'invalid'>('idle')
  const [draft, setDraft] = useState(loadDraft)
  const [previous, setPrevious] = useState<TopBoard | null>(null)
  const [edited, setEdited] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const board = draft.board
  const full = selected === null && board.releases.every(Boolean)
  const validYear = filterYear === '' || /^\d{1,4}$/.test(filterYear) && Number(filterYear) > 0
  const visibleResults = validYear ? results.filter(release => (!filterType || release.type === filterType)
    && (!filterYear || release.releaseYear === Number(filterYear))) : []

  function updateBoard(next: TopBoard) {
    const contentChanged = next.nickname !== board.nickname || next.name !== board.name || next.releases.some((release, index) =>
      release !== board.releases[index] && JSON.stringify(release) !== JSON.stringify(board.releases[index]))
    if (!contentChanged && next.theme === board.theme) return
    if (contentChanged) setPrevious(board)
    setDraft({ board: next, warning: null })
    setAnnouncement('')
    setEdited(true)
  }
  function undoBoard() {
    if (!previous) return
    setDraft({ board: { ...previous, theme: board.theme }, warning: null })
    setPrevious(null)
    setEdited(true)
    setSelected(null)
    setAnnouncement('Last change undone.')
  }
  function clearBoard() {
    if (!board.releases.some(Boolean)) return
    updateBoard({ ...board, releases: Array(9).fill(null) })
    setSelected(null)
    setAnnouncement('All nine slots cleared. You can undo this change.')
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', board.theme === 'dark' ? '#171823' : '#f1f1fa')
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
    setPartial(false)
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
        if (current) { setResults(response.results); setPartial(!!response.partial); setStatus(response.unavailable ? 'error' : 'success') }
      } catch {
        if (current && !controller.signal.aborted) { setResults([]); setStatus('error') }
      }
    }, 400)
    return () => { current = false; window.clearTimeout(timer); controller.abort() }
  }, [input])

  return <div className="page editor-page">
    <SiteHeader theme={board.theme} onThemeChange={theme => updateBoard({ ...board, theme })}>
      <div className="view-tabs" role="tablist" aria-label="Your boards">
        {(['board', 'saved'] as const).map((view, index) => <button key={view} type="button" role="tab" id={view + '-tab'}
          aria-controls={view + '-panel'} aria-selected={activeView === view} tabIndex={activeView === view ? 0 : -1}
          onClick={() => setActiveView(view)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index
            setActiveView(next === 0 ? 'board' : 'saved')
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
          }}>{view === 'board' ? 'Board' : 'Saved boards'}</button>)}
      </div>
    </SiteHeader>
    <main>
      <div className="workspace editor-view" id="board-panel" role="tabpanel" aria-labelledby="board-tab" hidden={activeView !== 'board'}>
        <section className="search-section" aria-labelledby="search-title">
          <div className="hero" aria-labelledby="hero-title">
            <AnimatedHeading />
            <p className="intro">Pick an <strong>era</strong>. Keep the <strong>lore</strong>.<br />Pass it around, <strong>music nerds</strong>.</p>
          </div>
          <div className="section-heading"><h2 id="search-title">Find a release</h2></div>
          <label className="search-label" htmlFor="release-query">Release title or artist</label>
          <div className="search-field">
            <SearchIcon />
            <input id="release-query" type="search" value={input} onChange={event => setInput(event.target.value)} placeholder="Try Cold Visions or Björk"
              autoComplete="off" spellCheck={false} maxLength={400} aria-describedby="search-hint" />
          </div>
          <p id="search-hint" className="sr-only">Type at least 2 characters to search.</p>
          <div className="search-filters" role="group" aria-label="Filter these search results">
            <div className="filter-field"><label className="search-label" htmlFor="release-type">Release type</label>
              <select id="release-type" value={filterType} onChange={event => setFilterType(event.target.value as ReleaseType | '')}>
                <option value="">All types</option>
                {(['ALBUM', 'EP', 'SINGLE'] as const).map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}
              </select>
            </div>
            <div className="filter-field"><label className="search-label" htmlFor="release-year">Release year</label>
              <input id="release-year" type="number" min="1" max="9999" step="1" inputMode="numeric" placeholder="Any year"
                value={filterYear} onChange={event => setFilterYear(event.target.value)} aria-invalid={!validYear}
                aria-describedby={!validYear ? 'filter-year-error' : undefined} />
            </div>
            <div className="filter-footer">
              <button className="text-button" type="button" disabled={!filterType && !filterYear}
                onClick={() => { setFilterType(''); setFilterYear('') }}>Clear filters</button>
            </div>
            {!validYear && <p id="filter-year-error" className="filter-error" role="alert">Enter a year from 1 to 9999.</p>}
          </div>
          {full && <p className="search-hint">All nine slots are filled. Select a board slot to replace a release.</p>}
          <div className="results-area" aria-busy={status === 'loading'}>
            <div className="status" role={status === 'error' || status === 'invalid' ? 'alert' : 'status'} aria-live="polite">
              {status === 'idle' && <p className="idle-state">Search for an album, EP or single.</p>}
              {status === 'loading' && <p className="loading"><span className="spinner" />Searching for releases…</p>}
              {status === 'error' && <p>Search failed. Please try again.</p>}
              {status === 'invalid' && <p>Your search must be no longer than 200 characters.</p>}
              {status === 'success' && validYear && results.length === 0 && <p>{partial ? 'Some sources are temporarily unavailable. Please try again.' : 'No releases found. Try another title or artist.'}</p>}
              {status === 'success' && partial && results.length > 0 && <p>{visibleResults.length > 0
                ? 'Some sources are temporarily unavailable. Showing available results.' : 'Some sources are temporarily unavailable.'}</p>}
              {status === 'success' && validYear && results.length > 0 && visibleResults.length === 0 && <p>No releases match your filters. Try another type or year.</p>}
              {status === 'success' && visibleResults.length > 0 && <p className="results-count">{visibleResults.length} results</p>}
            </div>
            {status === 'success' && visibleResults.length > 0 && <div className="results-grid">{visibleResults.map(release => <ReleaseCard key={release.id}
              release={release} added={board.releases.some(slot => slot?.id === release.id)} full={full} onAdd={() => chooseRelease(release)} />)}</div>}
          </div>
        </section>
        <BoardEditor key={loadedBoard} board={board} selected={selected} onSelect={setSelected} onChange={updateBoard} onSwap={moveRelease}
          warning={saveError ? 'Your draft could not be saved. Keep this tab open to avoid losing your changes.' : draft.warning}
          saved={saved} announcement={announcement} canUndo={previous !== null} onUndo={undoBoard} onClear={clearBoard} />
      </div>
      <div className="saved-view" id="saved-panel" role="tabpanel" aria-labelledby="saved-tab" hidden={activeView !== 'saved'}>
        <SavedBoards board={board} onLoad={next => {
          updateBoard(next)
          setSelected(null)
          setLoadedBoard(value => value + 1)
          setAnnouncement('Saved board loaded.')
          setActiveView('board')
          document.getElementById('board-tab')?.focus()
        }} />
      </div>
    </main>
    <SiteFooter />
  </div>
}
