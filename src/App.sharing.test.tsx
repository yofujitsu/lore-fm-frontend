import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import ShareActions from './ShareActions'
import { addRelease, DRAFT_KEY, emptyBoard } from './board'
import * as sharing from './sharing'
import { exportPng, downloadPng } from './png'
import type { Release } from './release'
vi.mock('./png', () => ({ exportPng: vi.fn(), downloadPng: vi.fn() }))

const release: Release = { id: 'spotify:123', title: 'Cold Visions', artists: [{ name: 'Bladee' }], releaseYear: 2024, type: 'ALBUM',
  artwork: null, sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'https://open.spotify.com/album/123' }] }
const board = { ...addRelease(emptyBoard(), release, 5), nickname: 'guest 🎵', theme: 'light' as const }

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(exportPng).mockReset()
  vi.mocked(downloadPng).mockReset()
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); localStorage.clear() })

describe('shared view', () => {
  it('opens a self-contained readonly board without reading or overwriting the viewer draft', async () => {
    const own = JSON.stringify({ ...emptyBoard(), nickname: 'my draft' })
    localStorage.setItem(DRAFT_KEY, own)
    const read = vi.spyOn(Storage.prototype, 'getItem')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    window.history.replaceState(null, '', '/top/' + await sharing.encodeShare(board))
    render(<App />)
    expect(await screen.findByRole('heading', { name: "guest 🎵's Top 9" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Cold Visions on Spotify' })).toHaveAttribute('href', release.sources[0].externalUrl)
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Move|Remove|Select slot|Share board/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('heading', { name: "guest 🎵's Top 9" })).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('link', { name: 'Create your own Top 9' })).toHaveAttribute('href', '/')
  })
  it('shows a recoverable invalid-link error without falling back to the draft', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(board))
    window.history.replaceState(null, '', '/top/invalid')
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This share link is invalid')
    expect(screen.queryByRole('textbox', { name: 'Nickname (optional)' })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('share and export actions', () => {
  it('creates a link, copies it and retains a manual-copy field when clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('private-clipboard-error'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<ShareActions board={board} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share board' }))
    const field = await screen.findByRole('textbox', { name: 'Share link' })
    expect((field as HTMLInputElement).value).toMatch(/\/top\/[A-Za-z0-9_-]+$/)
    expect(field).toHaveAttribute('readonly')
    expect(screen.getByText('Link ready. Copy it below.')).toBeInTheDocument()
    expect(screen.queryByText('private-clipboard-error')).not.toBeInTheDocument()
    writeText.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText('Link copied. Ready to share.')).toBeInTheDocument()
  })
  it('discards a link generated for a board that changes while compression is pending', async () => {
    let finish!: (value: string) => void
    vi.spyOn(sharing, 'createShareUrl').mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const view = render(<ShareActions board={board} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share board' }))
    view.rerender(<ShareActions board={{ ...board, nickname: 'changed' }} />)
    await act(async () => finish('https://ninefold.example/top/stale'))
    expect(screen.queryByRole('textbox', { name: 'Share link' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share board' })).toBeEnabled()
  })
  it('exports a PNG and reports missing covers', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    vi.mocked(exportPng).mockResolvedValue({ blob, missingCovers: 1 })
    render(<ShareActions board={board} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    expect(await screen.findByText('PNG exported with 1 unavailable cover.')).toBeInTheDocument()
    expect(downloadPng).toHaveBeenCalledWith(blob)
  })
  it('keeps export failures safe and allows retry', async () => {
    vi.mocked(exportPng).mockRejectedValue(new Error('private-image-error'))
    render(<ShareActions board={board} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG export failed. Please try again.')
    expect(screen.queryByText('private-image-error')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled())
  })
  it('disables publishing actions on an empty board', () => {
    render(<ShareActions board={emptyBoard()} />)
    expect(screen.getByRole('button', { name: 'Share board' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
  })
})

