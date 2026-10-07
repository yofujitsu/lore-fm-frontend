import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import SavedBoards from './SavedBoards'
import { addRelease, emptyBoard, SAVED_BOARDS_KEY } from './board'
import type { Release } from './release'

const release: Release = { id: 'spotify:1', title: 'Record', artists: [{ name: 'Artist' }], type: 'ALBUM', releaseYear: null, artwork: null, sources: [] }
const populated = addRelease(emptyBoard(), release)
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, callback: () => unknown) => callback()) } })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })
const name = (value: string) => fireEvent.change(screen.getByLabelText('Board name'), { target: { value } })
const click = async (value: string) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: value })) }) }
const entries = () => JSON.parse(localStorage.getItem(SAVED_BOARDS_KEY)!).boards

describe('Saved boards', () => {
  it('keeps independent snapshots across reload, updates, renames and confirms deletion', async () => {
    const onLoad = vi.fn()
    const view = render(<SavedBoards board={populated} onLoad={onLoad} />)
    name('Favorites'); await click('Save new board')
    const firstId = entries()[0].id
    view.rerender(<SavedBoards board={{ ...emptyBoard(), nickname: 'Other', theme: 'light' }} onLoad={onLoad} />)
    name('Quiet days'); await click('Save new board')
    expect(entries()).toHaveLength(2)
    expect(entries()[0].board).toEqual(populated)
    view.unmount()
    render(<SavedBoards board={emptyBoard()} onLoad={onLoad} />)
    fireEvent.change(screen.getByLabelText('Saved board'), { target: { value: firstId } })
    await click('Load board')
    expect(onLoad).toHaveBeenLastCalledWith({ ...populated, name: 'Favorites' })
    await click('Update saved board')
    expect(entries()[0].board).toEqual(emptyBoard())
    name('All-time favorites'); await click('Rename board')
    expect(entries()[0].name).toBe('All-time favorites')
    await click('Delete board'); await click('Cancel deletion')
    expect(entries()).toHaveLength(2)
    await click('Delete board'); await click('Delete saved board')
    expect(entries().map((entry: { name: string }) => entry.name)).toEqual(['Quiet days'])
    expect(onLoad).toHaveBeenCalledTimes(1)
  })
  it('rejects duplicate names and preserves existing snapshots when storage fails', async () => {
    render(<SavedBoards board={populated} onLoad={vi.fn()} />)
    name('Favorites'); await click('Save new board')
    const raw = localStorage.getItem(SAVED_BOARDS_KEY)
    name('favorites'); await click('Save new board')
    expect(screen.getByRole('alert')).toHaveTextContent('already exists')
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBe(raw)
    name('Another')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await click('Save new board')
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBe(raw)
    expect(screen.queryByRole('option', { name: 'Another' })).not.toBeInTheDocument()
  })
  it('preserves spaces while typing names and keeps snapshots saved in another tab', async () => {
    render(<SavedBoards board={populated} onLoad={vi.fn()} />)
    name('Late ')
    expect(screen.getByLabelText('Board name')).toHaveValue('Late ')
    name('Late nights'); await click('Save new board')
    const external = [...entries(), { id: 'other-tab', name: 'From another tab', board: emptyBoard() }]
    localStorage.setItem(SAVED_BOARDS_KEY, JSON.stringify({ version: 1, boards: external }))
    name('New snapshot'); await click('Save new board')
    expect(screen.getByRole('alert')).toHaveTextContent('changed in another tab')
    expect(entries()).toEqual(external)
    expect(screen.getByRole('option', { name: 'From another tab' })).toBeInTheDocument()
  })
  it('checks the latest library inside a queued lock before writing from two tabs', async () => {
    const queued: (() => void)[] = []
    vi.mocked(navigator.locks.request).mockImplementation(((_key: string, callback: () => boolean) =>
      new Promise<unknown>(resolve => queued.push(() => resolve(callback())))) as typeof navigator.locks.request)
    const first = render(<SavedBoards board={populated} onLoad={vi.fn()} />)
    const second = render(<SavedBoards board={emptyBoard()} onLoad={vi.fn()} />)
    for (const [view, title] of [[first, 'First tab'], [second, 'Second tab']] as const) {
      fireEvent.click(view.container.querySelector('summary')!)
      fireEvent.change(view.container.querySelector('input')!, { target: { value: title } })
      fireEvent.click(within(view.container).getByRole('button', { name: 'Save new board' }))
    }
    expect(queued).toHaveLength(2)
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBeNull()
    await act(async () => queued[0]())
    await act(async () => queued[1]())
    expect(entries().map((entry: { name: string }) => entry.name)).toEqual(['First tab'])
    expect(within(second.container).getByRole('alert')).toHaveTextContent('changed in another tab')
  })
  it('uses a native lock and preserves data if secure storage locks are unavailable', async () => {
    render(<SavedBoards board={populated} onLoad={vi.fn()} />)
    name('Favorites'); await click('Save new board')
    expect(navigator.locks.request).toHaveBeenCalledWith(SAVED_BOARDS_KEY, expect.any(Function))
    const raw = localStorage.getItem(SAVED_BOARDS_KEY)
    vi.stubGlobal('navigator', {})
    name('Another'); await click('Save new board')
    expect(screen.getByRole('alert')).toHaveTextContent('secure connection')
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBe(raw)
  })
  it('preserves an unreadable library until an explicit confirmed reset', async () => {
    localStorage.setItem(SAVED_BOARDS_KEY, '{broken')
    render(<SavedBoards board={emptyBoard()} onLoad={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be restored')
    expect(screen.getByRole('button', { name: 'Save new board' })).toBeDisabled()
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBe('{broken')
    await click('Reset saved boards'); await click('Cancel reset')
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBe('{broken')
    await click('Reset saved boards'); await click('Reset library')
    expect(localStorage.getItem(SAVED_BOARDS_KEY)).toBeNull()
    name('Fresh start'); await click('Save new board')
    expect(entries()[0].name).toBe('Fresh start')
  })
})
