import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { normalizeNickname, removeRelease } from './board'
import type { TopBoard } from './board'
import { Artwork } from './Artwork'
import ShareActions from './ShareActions'

interface Props {
  board: TopBoard
  selected: number | null
  onSelect: (index: number | null) => void
  onChange: (board: TopBoard) => void
  onSwap: (from: number, to: number) => void
  warning: string | null
  saved: boolean
  announcement: string
  canUndo: boolean
  onUndo: () => void
  onClear: () => void
}

export default function BoardEditor({ board, selected, onSelect, onChange, onSwap, warning, saved, announcement, canUndo, onUndo, onClear }: Props) {
  const [confirmClear, setConfirmClear] = useState(false)
  const clearButton = useRef<HTMLButtonElement | null>(null)
  const undoButton = useRef<HTMLButtonElement | null>(null)
  const slots = useRef<(HTMLButtonElement | null)[]>([])
  const restoreFocus = useRef(false)
  const [moveSource, setMoveSource] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const drag = useRef<{ from: number; x: number; y: number; pointerId: number; active: boolean } | null>(null)
  const handles = useRef<(HTMLButtonElement | null)[]>([])
  const focusTarget = useRef<number | null>(null)
  const count = board.releases.filter(Boolean).length

  useEffect(() => {
    if (focusTarget.current !== null) {
      handles.current[focusTarget.current]?.focus()
      focusTarget.current = null
    }
    if (restoreFocus.current) {
      if (canUndo) undoButton.current?.focus()
      else slots.current[board.releases.findIndex(Boolean) < 0 ? 0 : board.releases.findIndex(Boolean)]?.focus()
      restoreFocus.current = false
    }
  }, [board, canUndo])

  useEffect(() => {
    if (count === 0 && confirmClear) {
      setConfirmClear(false)
      undoButton.current?.focus()
    }
  }, [count, confirmClear])

  function move(from: number, to: number) {
    if (to < 0 || to > 8 || from === to) return
    focusTarget.current = to
    onSwap(from, to)
    setMoveSource(null)
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, from: number) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }
    if (event.key in steps) { event.preventDefault(); move(from, from + steps[event.key]) }
    if (event.key === 'Escape') { setMoveSource(null); onSelect(null) }
  }
  function slotAt(x: number, y: number) {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-board-slot]')
    return element ? Number(element.dataset.boardSlot) : null
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>, from: number) {
    if (event.button !== 0 || event.isPrimary === false) return
    suppressClick.current = false
    drag.current = { from, x: event.clientX, y: event.clientY, pointerId: event.pointerId, active: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) {
      current.active = true
      setDragging(current.from)
    }
    if (current.active) setDropTarget(slotAt(event.clientX, event.clientY))
  }
  const suppressClick = useRef(false)
  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    if (current.active) {
      suppressClick.current = true
      const to = slotAt(event.clientX, event.clientY)
      if (to !== null) move(current.from, to)
    }
    drag.current = null
    setDragging(null)
    setDropTarget(null)
  }

  return <section className="board-section" aria-labelledby="board-title">
    <div className="section-heading">
      <h2 id="board-title" className="sr-only">Your era</h2>
      <div className="board-identity" role="group" aria-label="Board heading">
        <label className="sr-only" htmlFor="nickname">Nickname (optional)</label>
        <input id="nickname" type="text" value={board.nickname} maxLength={80} placeholder="someone" autoComplete="off"
          size={Math.max(7, Array.from(board.nickname).length)} aria-describedby="nickname-hint"
          onChange={event => onChange({ ...board, nickname: normalizeNickname(event.target.value) })} />
        <span aria-hidden="true">’s</span>
        <label className="sr-only" htmlFor="board-name-input">Board name (optional)</label>
        <input id="board-name-input" type="text" value={board.name ?? ''} maxLength={80} placeholder="Top 9" autoComplete="off"
          size={Math.max(5, Array.from(board.name ?? '').length)} aria-describedby="board-name-hint"
          onChange={event => onChange({ ...board, name: normalizeNickname(event.target.value) })} />
        <span id="nickname-hint" className="sr-only">Up to 40 characters.</span>
        <span id="board-name-hint" className="sr-only">Up to 40 characters.</span>
      </div>
      <span className="board-count">{count} / 9</span>
    </div>
    <div className="board-toolbar">
      <ShareActions board={board} />
    <div className="board-tools" role="group" aria-label="Board actions">
      <button className="secondary-button" type="button" aria-label="Undo last change" disabled={!canUndo} ref={undoButton}
        onClick={() => { setMoveSource(null); setConfirmClear(false); restoreFocus.current = true; onUndo() }}><span aria-hidden="true">↶</span> Undo</button>
      <button className="secondary-button" type="button" disabled={count === 0} ref={clearButton}
        onClick={() => setConfirmClear(true)}>Clear board</button>
    </div>
    </div>
    {confirmClear && <div className="clear-confirmation" role="group" aria-labelledby="clear-board-question">
      <p id="clear-board-question">Clear board confirmation</p>
      <p>Clear all nine slots? Your board name, nickname and theme will stay the same.</p>
      <div className="board-tools">
        <button className="secondary-button" type="button" autoFocus aria-label="Cancel clear"
          onClick={() => { setConfirmClear(false); clearButton.current?.focus() }}>Cancel</button>
        <button className="secondary-button" type="button" onClick={() => {
          setConfirmClear(false); setMoveSource(null); restoreFocus.current = true; onClear()
        }}>Clear slots</button>
      </div>
    </div>}
    <div className="board-canvas">
    <ol className="top-grid" aria-label="Nine release slots">
      {board.releases.map((release, index) => <li key={index} data-board-slot={index}
        className={'board-slot' + (selected === index ? ' is-selected' : '') + (dragging === index ? ' is-dragging' : '') + (dragging !== null && dropTarget === index ? ' is-drop-target' : '')}>
        <button type="button" className="slot-select" ref={node => { slots.current[index] = node }} aria-label={'Select slot ' + (index + 1) + ': ' + (release?.title ?? 'Empty')}
          aria-pressed={selected === index} onClick={() => {
            if (moveSource !== null) { move(moveSource, index); setMoveSource(null) }
            else onSelect(selected === index ? null : index)
          }}>
          {release ? <><Artwork url={release.artwork?.url} title={release.title} /><span className="slot-caption"><strong title={release.title}>{release.title}</strong><span title={release.artists.map(artist => artist.name).join(', ')}>{release.artists.map(artist => artist.name).join(', ')}</span></span></>
            : <span className="empty-slot"><span aria-hidden="true">+</span><span>{String(index + 1).padStart(2, '0')}</span></span>}
        </button>
        <div className="slot-controls">{release ? <>
          <button type="button" className="move-handle" ref={node => { handles.current[index] = node }} aria-label={'Move ' + release.title + ' from slot ' + (index + 1)}
            aria-describedby="move-hint" aria-pressed={moveSource === index} onKeyDown={event => keyboard(event, index)}
            onPointerDown={event => pointerDown(event, index)} onPointerMove={pointerMove} onPointerUp={pointerUp}
            onPointerCancel={() => { drag.current = null; setDragging(null); setDropTarget(null) }}
            onClick={event => {
              // Ignore the click from the completed drag; new pointer gestures and keyboard clicks remain usable.
              if (suppressClick.current && event.detail > 0) { suppressClick.current = false; return }
              suppressClick.current = false
              setMoveSource(moveSource === index ? null : index)
            }}><span aria-hidden="true">↕</span><span className="control-label"> Move</span></button>
          <button type="button" className="remove-button" aria-label={'Remove ' + release.title + ' from slot ' + (index + 1)}
            onClick={event => {
              event.currentTarget.closest('[data-board-slot]')?.querySelector<HTMLButtonElement>('.slot-select')?.focus()
              onChange(removeRelease(board, index)); setMoveSource(null)
            }}><span aria-hidden="true">×</span></button>
        </> : <span className="empty-slot-note" aria-hidden="true" />}</div>
      </li>)}
    </ol>
    </div>
    <div className="board-notes">
    <p id="move-hint" className="board-hint">Drag Move to reorder. Arrow keys work too.</p>
    <div className="board-feedback" role="status" aria-live="polite">
      {moveSource !== null ? 'Choose a destination for ' + board.releases[moveSource]?.title + '.'
        : selected !== null ? 'Slot ' + (selected + 1) + ' selected. Choose a release from search.'
        : count === 9 ? 'Your board is full. Select a slot to replace a release.' : ''}
      {selected !== null && <button className="text-button" type="button" onClick={() => onSelect(null)}>Cancel selection</button>}
      <span className="sr-only">{announcement}</span>
    </div>
    {warning ? <p className="storage-warning" role="alert">{warning}</p>
      : <p className="save-note"><span aria-hidden="true">{saved ? '✓' : '◌'}</span> {saved ? 'Saved in this browser.' : 'Autosaves in this browser.'}</p>}
    </div>
  </section>
}

