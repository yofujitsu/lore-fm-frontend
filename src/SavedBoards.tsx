import { useRef, useState } from 'react'
import { boardNameKey, loadSavedBoards, MAX_SAVED_BOARDS, normalizeNickname, normalizeBoardName, parseSavedBoards, SAVED_BOARDS_KEY } from './board'
import type { SavedBoard, TopBoard } from './board'

export default function SavedBoards({ board, onLoad }: { board: TopBoard; onLoad: (board: TopBoard) => void }) {
  const [library, setLibrary] = useState(loadSavedBoards)
  const [selected, setSelected] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<'delete' | 'reset' | null>(null)
  const select = useRef<HTMLSelectElement | null>(null)
  const nameInput = useRef<HTMLInputElement | null>(null)
  const current = library.boards.find(entry => entry.id === selected)

  async function lockedWrite(operation: () => boolean) {
    try {
      if (!navigator.locks) throw new Error('Storage locks unavailable')
      return await navigator.locks.request(SAVED_BOARDS_KEY, operation)
    } catch { setMessage(''); setError('Saved boards require a current browser and a secure connection. Your snapshots have been kept.'); return false }
  }
  async function persist(boards: SavedBoard[], success: string) {
    return lockedWrite(() => {
      try {
        const latest = loadSavedBoards()
        if (latest.unreadable || JSON.stringify(latest.boards) !== JSON.stringify(library.boards)) {
          setLibrary(latest); setSelected(''); setConfirmation(null); setMessage('')
          setError('Saved boards changed in another tab or could not be read. Check the library and try again.')
          return false
        }
        const raw = JSON.stringify({ version: 1, boards })
        const checked = parseSavedBoards(raw)
        window.localStorage.setItem(SAVED_BOARDS_KEY, raw)
        setLibrary({ boards: checked, unreadable: false })
        setError(''); setMessage(success); setConfirmation(null)
        return true
      } catch { setMessage(''); setError('Your saved boards could not be saved. Existing snapshots have been kept.'); return false }
    })
  }
  async function save(rename = false) {
    const normalized = normalizeBoardName(name)
    if (!normalized) { setError('Enter a board name.'); return }
    if (library.boards.some(entry => (!rename || entry.id !== selected) && boardNameKey(entry.name) === boardNameKey(normalized))) {
      setError('A board with this name already exists. Choose another name.'); return
    }
    if (rename && current) {
      if (await persist(library.boards.map(entry => entry.id === selected ? { ...entry, name: normalized } : entry), 'Board renamed.')) setName(normalized)
    } else {
      if (library.boards.length >= MAX_SAVED_BOARDS) { setError('You can save up to 20 boards. Delete one to make room.'); return }
      if (!crypto.randomUUID) { setError('Saved boards require a secure connection. Use HTTPS or localhost.'); return }
      const entry = { id: crypto.randomUUID(), name: normalized, board }
      if (await persist([...library.boards, entry], 'Board saved.')) { setSelected(entry.id); setName(normalized) }
    }
  }
  async function confirm() {
    if (confirmation === 'delete' && current) {
      if (!await persist(library.boards.filter(entry => entry.id !== selected), 'Saved board deleted. Your current draft is unchanged.')) return
      setSelected(''); setName(''); select.current?.focus()
    } else if (confirmation === 'reset') {
      if (!await lockedWrite(() => {
        try {
          const latest = loadSavedBoards()
          if (!latest.unreadable) {
            setLibrary(latest); setConfirmation(null); setError('The saved library has changed. Its current snapshots have been kept.'); return false
          }
          window.localStorage.removeItem(SAVED_BOARDS_KEY)
          setLibrary({ boards: [], unreadable: false }); setSelected(''); setName(''); setError(''); setMessage('Saved boards reset. Your current draft is unchanged.')
          nameInput.current?.focus()
          return true
        } catch { setError('Saved boards could not be reset. Please try again.'); return false }
      })) return
    }
    setConfirmation(null)
  }

  return <details className="saved-boards">
    <summary>Saved boards <span>{library.boards.length} / {MAX_SAVED_BOARDS}</span></summary>
    <p className="board-hint">Keep named snapshots on this browser. Edits save to your draft; use Update to replace a snapshot.</p>
    <div className="filter-field">
      <label className="search-label" htmlFor="saved-board">Saved board</label>
      <select id="saved-board" value={selected} ref={select} disabled={library.unreadable || !library.boards.length} onChange={event => {
        setSelected(event.target.value); setName(library.boards.find(entry => entry.id === event.target.value)?.name ?? '')
        setConfirmation(null); setError(''); setMessage('')
      }}><option value="">Choose a board</option>{library.boards.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
    </div>
    <div className="filter-field">
      <label className="search-label" htmlFor="board-name">Board name</label>
      <input id="board-name" value={name} ref={nameInput} maxLength={80} placeholder="Favorites, late nights…" autoComplete="off"
        onChange={event => { setName(normalizeNickname(event.target.value)); setConfirmation(null); setError(''); setMessage('') }} />
    </div>
    <div className="board-tools">
      <button className="secondary-button" type="button" disabled={library.unreadable} onClick={() => save()}>Save new board</button>
      <button className="secondary-button" type="button" disabled={!current} onClick={() => { onLoad(current!.board); setMessage('Saved board loaded.'); setError(''); setConfirmation(null) }}>Load board</button>
      <button className="secondary-button" type="button" disabled={!current} onClick={() => {
        persist(library.boards.map(entry => entry.id === selected ? { ...entry, board } : entry), 'Saved board updated.')
      }}>Update saved board</button>
      <button className="secondary-button" type="button" disabled={!current} onClick={() => save(true)}>Rename board</button>
      <button className="secondary-button" type="button" disabled={!current} onClick={() => setConfirmation('delete')}>Delete board</button>
    </div>
    {library.unreadable && <><p className="storage-warning" role="alert">Your saved boards could not be restored. The stored data has been kept. Reset the library to start again.</p>
      <button className="secondary-button" type="button" onClick={() => setConfirmation('reset')}>Reset saved boards</button></>}
    {confirmation && <div className="clear-confirmation" role="group" aria-labelledby="saved-board-confirmation">
      <p id="saved-board-confirmation">{confirmation === 'delete' ? 'Delete “' + current?.name + '”?' : 'Reset saved boards?'}</p>
      <p>{confirmation === 'delete' ? 'This removes the saved snapshot.' : 'This removes the unreadable library.'} Your current draft will stay the same.</p>
      <div className="board-tools">
        <button className="secondary-button" type="button" autoFocus aria-label={confirmation === 'delete' ? 'Cancel deletion' : 'Cancel reset'}
          onClick={() => { setConfirmation(null); nameInput.current?.focus() }}>Cancel</button>
        <button className="secondary-button" type="button" onClick={confirm}>{confirmation === 'delete' ? 'Delete saved board' : 'Reset library'}</button>
      </div>
    </div>}
    {error && <p className="storage-warning" role="alert">{error}</p>}
    {message && <p className="action-message" role="status">{message}</p>}
  </details>
}
