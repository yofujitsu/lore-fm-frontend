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

  it('shows partial results with both safe catalog links and clears the notice for the next query', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'partial', partial: true, unavailable: false, results: [{ ...release, sources: [...release.sources,
      { provider: 'MUSICBRAINZ', externalId: 'group', externalUrl: 'https://musicbrainz.org/release-group/group' },
      { provider: 'YOUTUBE', externalId: 'unsafe', externalUrl: 'javascript:alert(1)' }] }] }) } as Response)
    render(<App />)
    fireEvent.change(input(), { target: { value: 'partial' } })
    await tick()
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    expect(screen.getByText('Some sources are temporarily unavailable. Showing available results.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Cold Visions on Spotify' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Cold Visions on MusicBrainz' })).toHaveAttribute('href', 'https://musicbrainz.org/release-group/group')
    expect(screen.queryByRole('link', { name: 'Open Cold Visions on YouTube' })).not.toBeInTheDocument()
    fireEvent.change(input(), { target: { value: 'new search' } })
    expect(screen.queryByText(/Some sources/)).not.toBeInTheDocument()
    await tick()
    expect(screen.queryByText(/Some sources/)).not.toBeInTheDocument()
  })

  it('distinguishes an unavailable catalog and incomplete empty results from a healthy empty search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'down', results: [], unavailable: true, partial: false }) } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'partial', results: [], unavailable: false, partial: true }) } as Response)
    render(<App />)
    fireEvent.change(input(), { target: { value: 'down' } })
    await tick()
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed. Please try again.')
    expect(screen.queryByText(/No releases found/)).not.toBeInTheDocument()
    fireEvent.change(input(), { target: { value: 'partial' } })
    await tick()
    expect(screen.getByText('Some sources are temporarily unavailable. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/No releases found/)).not.toBeInTheDocument()
  })

  it('filters the current results by type and exact known year without changing the board or fetching again', async () => {
    const items = [release, { ...release, id: 'spotify:ep', title: 'Echo', type: 'EP' },
      { ...release, id: 'spotify:single', title: 'Earlier', releaseYear: 2023, type: 'SINGLE' },
      { ...release, id: 'spotify:unknown', title: 'Unknown year', releaseYear: null }]
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'Bladee', results: items }) } as Response)
    render(<App />)
    fireEvent.change(input(), { target: { value: 'Bladee' } })
    await tick()
    fireEvent.change(screen.getByRole('combobox', { name: 'Release type' }), { target: { value: 'EP' } })
    expect(screen.getByRole('heading', { name: 'Echo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cold Visions' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Release year' }), { target: { value: '2023' } })
    expect(screen.getByText('No releases match your filters. Try another type or year.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Release type' }), { target: { value: '' } })
    expect(screen.getByRole('heading', { name: 'Earlier' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Release year' }), { target: { value: '2024' } })
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Echo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unknown year' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('heading', { name: 'Unknown year' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledOnce()
    expect(screen.getByRole('region', { name: 'Your Top 9' })).toHaveTextContent('0 / 9')
  })

  it('validates the year and preserves filters on a new query while retaining partial-source notices', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ query: 'partial', partial: true, results: [release] }) } as Response)
    render(<App />)
    fireEvent.change(input(), { target: { value: 'partial' } })
    await tick()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Release year' }), { target: { value: '20000' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a year from 1 to 9999.')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Release year' }), { target: { value: '2023' } })
    expect(screen.getByText('No releases match your filters. Try another type or year.')).toBeInTheDocument()
    expect(screen.getByText('Some sources are temporarily unavailable.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Release year' }), { target: { value: '2024' } })
    expect(screen.getByRole('heading', { name: 'Cold Visions' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Release type' }), { target: { value: 'EP' } })
    fireEvent.change(input(), { target: { value: 'new query' } })
    await tick()
    expect(screen.getByRole('combobox', { name: 'Release type' })).toHaveValue('EP')
    expect(screen.getByRole('spinbutton', { name: 'Release year' })).toHaveValue(2024)
    expect(screen.queryByRole('heading', { name: 'Cold Visions' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Some sources/)).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
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
