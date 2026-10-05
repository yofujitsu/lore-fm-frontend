import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addRelease, DRAFT_KEY, emptyBoard, parseDraft } from './board'
import type { Release } from './release'

const release = (id = 'spotify:123', title = 'Cold Visions'): Release => ({
  id, title, artists: [{ name: 'Bladee' }], releaseYear: 2024, type: 'ALBUM', artwork: null,
  sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'https://open.spotify.com/album/123' }],
})
const realElementFromPoint = document.elementFromPoint
const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(400) }) }
const board = () => screen.getByRole('region', { name: 'Your Top 9' })
const search = async () => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Release title or artist' }), { target: { value: 'Bladee' } })
  await tick()
}
const slot = (number: number, title = 'Empty') => within(board()).getByRole('button', { name: `Select slot ${number}: ${title}` })

describe('board editor', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      query: 'Bladee', results: [release(), release('spotify:echo', 'Echo')],
    }) }))
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.elementFromPoint = realElementFromPoint; localStorage.clear() })

  it('adds from search, prevents duplicates and removes from a fixed slot', async () => {
    render(<App />)
    expect(within(board()).getAllByRole('button', { name: /^Select slot/ })).toHaveLength(9)
    await search()
    fireEvent.click(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' }))
    expect(slot(1, 'Cold Visions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cold Visions is already in your Top 9' })).toBeDisabled()
    const remove = within(board()).getByRole('button', { name: 'Remove Cold Visions from slot 1' })
    remove.focus()
    fireEvent.click(remove)
    expect(slot(1)).toBeInTheDocument()
    expect(slot(1)).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' })).toBeEnabled()
  })
  it('replaces a selected slot and moves with the keyboard into an empty slot', async () => {
    render(<App />)
    await search()
    fireEvent.click(slot(8))
    fireEvent.click(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' }))
    expect(slot(8, 'Cold Visions')).toBeInTheDocument()
    fireEvent.click(slot(8, 'Cold Visions'))
    fireEvent.click(screen.getByRole('button', { name: 'Add Echo to Top 9' }))
    expect(slot(8, 'Echo')).toBeInTheDocument()
    fireEvent.keyDown(within(board()).getByRole('button', { name: 'Move Echo from slot 8' }), { key: 'ArrowUp' })
    expect(slot(5, 'Echo')).toBeInTheDocument()
    expect(slot(8)).toBeInTheDocument()
  })
  it('allows the first Move click after dragging into an empty slot', async () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    render(<App />)
    await search()
    fireEvent.click(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' }))
    const handle = within(board()).getByRole('button', { name: 'Move Cold Visions from slot 1' })
    handle.setPointerCapture = vi.fn()
    document.elementFromPoint = vi.fn(() => slot(5).closest('li'))
    fireEvent.pointerDown(handle, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(handle, { clientX: 20, clientY: 20 })
    fireEvent.pointerUp(handle, { clientX: 20, clientY: 20 })
    expect(slot(5, 'Cold Visions')).toBeInTheDocument()
    fireEvent.click(within(board()).getByRole('button', { name: 'Move Cold Visions from slot 5' }))
    expect(within(board()).getByRole('status')).toHaveTextContent('Choose a destination for Cold Visions.')
  })
  it('limits nicknames and restores releases, order and theme after remount', async () => {
    const view = render(<App />)
    await search()
    fireEvent.click(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nickname (optional)' }), { target: { value: '🎵'.repeat(41) } })
    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }))
    fireEvent.keyDown(within(board()).getByRole('button', { name: 'Move Cold Visions from slot 1' }), { key: 'ArrowDown' })
    const saved = parseDraft(localStorage.getItem(DRAFT_KEY)!)
    expect(saved.nickname).toBe('🎵'.repeat(40))
    expect(saved.theme).toBe('light')
    expect(saved.releases[3]?.title).toBe('Cold Visions')
    view.unmount()
    render(<App />)
    expect(slot(4, 'Cold Visions')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nickname (optional)' })).toHaveValue(saved.nickname)
    expect(screen.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('requires selecting a replacement when all nine slots are filled', async () => {
    let full = emptyBoard()
    for (let i = 0; i < 9; i++) full = addRelease(full, release('spotify:' + i, 'Record ' + i))
    localStorage.setItem(DRAFT_KEY, JSON.stringify(full))
    render(<App />)
    await search()
    expect(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' })).toBeDisabled()
    fireEvent.click(slot(5, 'Record 4'))
    expect(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' }))
    expect(slot(5, 'Cold Visions')).toBeInTheDocument()
  })
  it('preserves an unreadable saved draft until the user starts editing', () => {
    localStorage.setItem(DRAFT_KEY, '{"version":2}')
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('Your saved draft could not be restored')
    expect(localStorage.getItem(DRAFT_KEY)).toBe('{"version":2}')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nickname (optional)' }), { target: { value: 'New draft' } })
    expect(parseDraft(localStorage.getItem(DRAFT_KEY)!).nickname).toBe('New draft')
  })
  it('keeps editing usable when browser storage rejects writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private-storage-error') })
    render(<App />)
    await search()
    fireEvent.click(screen.getByRole('button', { name: 'Add Cold Visions to Top 9' }))
    expect(slot(1, 'Cold Visions')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Your draft could not be saved')
    expect(screen.queryByText('private-storage-error')).not.toBeInTheDocument()
  })
})

