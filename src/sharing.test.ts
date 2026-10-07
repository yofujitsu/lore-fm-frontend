import { describe, expect, it, vi } from 'vitest'
import { addRelease, emptyBoard } from './board'
import { decodeShare, encodeShare, createShareUrl, MAX_SHARE_PAYLOAD } from './sharing'
import type { Release } from './release'

const release: Release = { id: 'spotify:123', title: 'Écho & Æ 🎵', artists: [{ name: 'Björk' }, { name: 'Guest' }],
  releaseYear: 2024, type: 'EP', artwork: { url: 'https://i.scdn.co/image/test', width: 640, height: 640, provider: 'SPOTIFY' },
  sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'https://open.spotify.com/album/123' }] }
const pack = async (value: unknown) => {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))
  const stream = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(bytes); controller.close() } }).pipeThrough(new CompressionStream('gzip'))
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
  return btoa(Array.from(compressed, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
const compact = { v: 1, n: 'music person', t: 'dark', r: [
  { i: 'spotify:123', t: 'Écho', a: ['Björk'], y: 2024, k: 'ALBUM', c: null, s: [['SPOTIFY', '123', 'https://open.spotify.com/album/123']] },
  ...Array(8).fill(null),
] }

describe('versioned shared board', () => {
  it('roundtrips Unicode, holes, metadata and theme without an API request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      const board = { ...addRelease(emptyBoard(), release, 7), nickname: 'night 🎵', theme: 'light' as const }
      const encoded = await encodeShare(board)
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(encoded.length).toBeLessThan(1000)
      const decoded = await decodeShare(encoded)
      expect(decoded).toEqual({ ...board, releases: board.releases.map(item => item && ({
        ...item, artwork: item.artwork && { ...item.artwork, width: null, height: null },
      })) })
      expect(fetch).not.toHaveBeenCalled()
      expect(await createShareUrl(board, 'https://ninefold.example')).toBe('https://ninefold.example/top/' + encoded)
    } finally { vi.unstubAllGlobals() }
  })
  it('rejects corrupt encoding, unsupported versions and non-string themes', async () => {
    for (const payload of ['', 'not+base64', 'abc', 'A'.repeat(MAX_SHARE_PAYLOAD + 1),
      await pack({ ...compact, v: 2 }), await pack({ ...compact, t: ['dark'] }), await pack({ ...compact, r: [] })]) {
      await expect(decodeShare(payload)).rejects.toThrow()
    }
  })
  it('rejects unsafe URLs and malformed release metadata', async () => {
    for (const item of [
      { ...compact.r[0], c: ['javascript:alert(1)', 'SPOTIFY'] },
      { ...compact.r[0], s: [['SPOTIFY', '123', 'javascript:alert(1)']] },
      { ...compact.r[0], a: [{}] },
      { ...compact.r[0], k: 'UNKNOWN_TYPE' },
    ]) await expect(decodeShare(await pack({ ...compact, r: [item, ...Array(8).fill(null)] }))).rejects.toThrow()
  })
  it('sanitizes control characters while preserving visible text', async () => {
    const value = { ...compact, n: 'mu\u0000sic', r: [{ ...compact.r[0], t: 'É\u0000cho', a: ['Bj\nörk'] }, ...Array(8).fill(null)] }
    const board = await decodeShare(await pack(value))
    expect(board.nickname).toBe('music')
    expect(board.releases[0]?.title).toBe('Écho')
    expect(board.releases[0]?.artists[0].name).toBe('Björk')
  })
  it('bounds decompression before parsing even a very compressible payload', async () => {
    const bomb = await pack('x'.repeat(100000))
    expect(bomb.length).toBeLessThan(1000)
    await expect(decodeShare(bomb)).rejects.toThrow(/too large/i)
  })
  it('rejects empty boards and excessive metadata when creating a link', async () => {
    await expect(encodeShare(emptyBoard())).rejects.toThrow(/release/i)
    const board = addRelease(emptyBoard(), { ...release, artists: Array.from({ length: 100 }, (_, i) => ({ name: ('🎵' + i).repeat(300) })) })
    await expect(encodeShare(board)).rejects.toThrow(/too large/i)
  })
})


it('roundtrips the board name and accepts old links without it', async () => {
  const board = { ...addRelease(emptyBoard(), release), name: 'my goth era 🎵' }
  expect((await decodeShare(await encodeShare(board))).name).toBe(board.name)
  expect((await decodeShare(await pack(compact))).name).toBeUndefined()
  for (const b of [null, 123, 'x'.repeat(41)]) await expect(decodeShare(await pack({ ...compact, b }))).rejects.toThrow()
})
