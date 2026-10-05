import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const release = {
  id: 'spotify:123', title: 'Cold Visions', artists: [{ name: 'Bladee' }],
  releaseYear: 2024, type: 'ALBUM', artwork: null,
  sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'https://open.spotify.com/album/123' }],
}
const response = (title = 'Cold Visions') => ({ ok: true, json: async () => ({ query: title, results: [{ ...release, title }] }) })
const tick = async (ms = 400) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const input = () => screen.getByRole('searchbox', { name: 'Release title or artist' })

describe('release search', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response())) })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('treats Unicode whitespace and separator suffixes consistently with the API', async () => {
    render(<App />)
    for (const query of ['\u00a0\u00a0', '\u202f\u202f', '\u0085\u0085', 'a\u001c']) {
      fireEvent.change(input(), { target: { value: query } })
      await tick()
      expect(fetch).not.toHaveBeenCalled()
    }
    fireEvent.change(input(), { target: { value: '\u0085Björk\u00a0' } })
    await tick()
    expect(fetch).toHaveBeenCalledWith('/api/v1/releases/search?q=Bj%C3%B6rk', expect.anything())
  })
  it('debounces valid Unicode queries and displays mapped release metadata', async () => {
    render(<App />)
    fireEvent.change(input(), { target: { value: 'a' } })
    await tick()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(input(), { target: { value: 'Björk & Æ' } })
    await tick(399)
    expect(fetch).not.toHaveBeenCalled()
    await tick(1)
    expect(fetch).toHaveBeenCalledWith('/api/v1/releases/search?q=Bj%C3%B6rk%20%26%20%C3%86', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    expect(screen.getByText('Bladee')).toBeInTheDocument()
    expect(screen.getByLabelText('Artwork unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Cold Visions on Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/album/123')
  })

  it('distinguishes empty results from network errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'empty', results: [] }) } as Response)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('private-provider-secret'))
    render(<App />)
    fireEvent.change(input(), { target: { value: 'empty' } })
    await tick()
    expect(screen.getByText('No releases found. Try another title or artist.')).toBeInTheDocument()
    fireEvent.change(input(), { target: { value: 'error' } })
    await tick()
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed. Please try again.')
    expect(screen.queryByText('private-provider-secret')).not.toBeInTheDocument()
  })

  it('keeps the newer response when an older request completes late', async () => {
    let resolveOld!: (value: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    vi.mocked(fetch).mockResolvedValueOnce(response('New release') as Response)
    render(<App />)
    fireEvent.change(input(), { target: { value: 'old' } })
    await tick()
    const oldSignal = vi.mocked(fetch).mock.calls[0][1]?.signal
    fireEvent.change(input(), { target: { value: 'new' } })
    await tick()
    expect(oldSignal?.aborted).toBe(true)
    expect(screen.getByRole('heading', { name: 'New release' })).toBeInTheDocument()
    await act(async () => { resolveOld(response('Old release') as Response) })
    expect(screen.queryByRole('heading', { name: 'Old release' })).not.toBeInTheDocument()
  })

  it('clears results and aborts requests on clear and unmount', async () => {
    const view = render(<App />)
    fireEvent.change(input(), { target: { value: 'test' } })
    await tick()
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
    fireEvent.change(input(), { target: { value: '' } })
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Cold Visions' })).not.toBeInTheDocument()
    fireEvent.change(input(), { target: { value: 'second' } })
    await tick()
    const secondSignal = vi.mocked(fetch).mock.calls[1][1]?.signal
    view.unmount()
    expect(secondSignal?.aborted).toBe(true)
  })

  it('does not render executable source URLs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'unsafe', results: [{ ...release, sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'javascript:alert(1)' }] }] }) } as Response)
    render(<App />)
    fireEvent.change(input(), { target: { value: 'unsafe' } })
    await tick()
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open/ })).not.toBeInTheDocument()
  })
})
