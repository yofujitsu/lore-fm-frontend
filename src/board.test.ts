import { describe, expect, it } from 'vitest'
import { addRelease, emptyBoard, normalizeNickname, parseDraft, removeRelease, swapSlots, parseSavedBoards, normalizeBoardName } from './board'
import type { Release } from './release'

const release = (id = 'spotify:123'): Release => ({
  id, title: 'Cold Visions', artists: [{ name: 'Bladee' }], releaseYear: 2024, type: 'ALBUM',
  artwork: null, sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'https://open.spotify.com/album/123' }],
})

describe('Top 9 draft', () => {
  it('fills empty slots, refuses duplicates and stops at nine', () => {
    const original = emptyBoard()
    let board = addRelease(original, release())
    expect(board.releases[0]?.id).toBe('spotify:123')
    expect(original.releases.every(slot => slot === null)).toBe(true)
    expect(addRelease(board, release())).toBe(board)
    for (let i = 1; i < 9; i++) board = addRelease(board, release('spotify:' + i))
    expect(addRelease(board, release('spotify:extra'))).toBe(board)
    expect(board.releases).toHaveLength(9)
  })
  it('replaces a selected slot and removes without shifting other slots', () => {
    const board = addRelease(addRelease(emptyBoard(), release()), release('spotify:second'))
    const replaced = addRelease(board, release('spotify:replacement'), 0)
    expect(replaced.releases[0]?.id).toBe('spotify:replacement')
    expect(replaced.releases[1]?.id).toBe('spotify:second')
    expect(addRelease(replaced, release('spotify:second'), 0)).toBe(replaced)
    const removed = removeRelease(replaced, 0)
    expect(removed.releases[0]).toBeNull()
    expect(removed.releases[1]?.id).toBe('spotify:second')
  })
  it('swaps occupied and empty slots without mutating the original', () => {
    const board = addRelease(addRelease(emptyBoard(), release()), release('spotify:second'))
    expect(swapSlots(board, 0, 1).releases.slice(0, 2).map(slot => slot?.id)).toEqual(['spotify:second', 'spotify:123'])
    const moved = swapSlots(board, 0, 8)
    expect(moved.releases[0]).toBeNull()
    expect(moved.releases[8]?.id).toBe('spotify:123')
    expect(board.releases[0]?.id).toBe('spotify:123')
    expect(swapSlots(board, 0, 9)).toBe(board)
    expect(addRelease(board, release('bad-target'), -1)).toBe(board)
  })
  it('limits nicknames by Unicode characters and removes control characters', () => {
    expect(normalizeNickname('a\u0000b\nc')).toBe('abc')
    expect(normalizeNickname('🎵'.repeat(41))).toBe('🎵'.repeat(40))
  })
  it('restores a complete versioned draft including theme and nickname', () => {
    const board = { ...addRelease(emptyBoard(), release()), nickname: 'music person', theme: 'light' as const }
    expect(parseDraft(JSON.stringify(board))).toEqual(board)
  })
  it('rejects corrupt, unsupported, oversize and malformed release data', () => {
    const board = addRelease(emptyBoard(), release())
    for (const value of ['oops', JSON.stringify({ ...board, version: 2 }), JSON.stringify({ ...board, releases: [] }),
      JSON.stringify({ ...board, theme: 'unknown' }), JSON.stringify({ ...board, theme: ['light'] }), JSON.stringify({ ...board, nickname: 'x'.repeat(41) }),
      JSON.stringify({ ...board, releases: [{ ...release(), artists: [{}] }, ...Array(8).fill(null)] }),
      JSON.stringify({ ...board, releases: [{ ...release(), artwork: { url: 'javascript:alert(1)', width: 100, height: 100, provider: 'SPOTIFY' } }, ...Array(8).fill(null)] }),
      JSON.stringify({ ...board, releases: [{ ...release(), sources: [{ provider: 'SPOTIFY', externalId: '123', externalUrl: 'javascript:alert(1)' }] }, ...Array(8).fill(null)] }),
      JSON.stringify({ ...board, releases: [release(), release(), ...Array(7).fill(null)] }), ' '.repeat(250001)]) {
      expect(() => parseDraft(value)).toThrow()
    }
  })
})


describe('Named boards', () => {
  it('restores snapshots and rejects corrupt, duplicate, unsafe and oversized libraries', () => {
    const entry = { id: 'saved-1', name: 'Favorites', board: addRelease(emptyBoard(), release()) }
    const encode = (boards: unknown[], version = 1) => JSON.stringify({ version, boards })
    expect(parseSavedBoards(encode([entry]))).toEqual([entry])
    for (const raw of ['broken', encode([entry], 2), encode([{ ...entry, name: ' ' }]),
      encode([{ ...entry, name: 'x'.repeat(41) }]), encode([entry, { ...entry, name: 'Other' }]),
      encode([entry, { ...entry, id: 'saved-2', name: 'FAVORITES' }]),
      encode([{ ...entry, board: { ...entry.board, releases: [] } }]),
      encode([{ ...entry, board: { ...entry.board, releases: [{ ...release(), artwork: { url: 'javascript:alert(1)' } }, ...Array(8).fill(null)] } }]),
      encode(Array.from({ length: 21 }, (_, i) => ({ ...entry, id: 'id-' + i, name: 'Board ' + i }))), ' '.repeat(2000001)]) {
      expect(() => parseSavedBoards(raw)).toThrow()
    }
    expect(normalizeBoardName('  abc\u0000  ')).toBe('abc')
    expect(normalizeBoardName('🎵'.repeat(41))).toBe('🎵'.repeat(40))
  })
})

it('preserves an optional board name, accepts legacy drafts and rejects invalid names', () => {
  const board = { ...emptyBoard(), name: 'my goth era 🎵' }
  expect(parseDraft(JSON.stringify(board))).toEqual(board)
  expect(parseDraft(JSON.stringify(emptyBoard()))).toEqual(emptyBoard())
  for (const name of [null, 123, 'x'.repeat(41), 'bad\u0000name']) {
    expect(() => parseDraft(JSON.stringify({ ...board, name }))).toThrow()
  }
})
