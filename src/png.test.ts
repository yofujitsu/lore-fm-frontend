import { afterEach, describe, expect, it, vi } from 'vitest'
import { addRelease, emptyBoard } from './board'
import { exportPng } from './png'
import type { Release } from './release'

const release: Release = { id: 'spotify:1', title: 'Record', artists: [{ name: 'Artist' }], type: 'ALBUM', releaseYear: null,
  artwork: { url: 'https://example.com/cover.png', width: 800, height: 400, provider: 'SPOTIFY' }, sources: [] }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function canvas() {
  const context = { fillStyle: '', strokeStyle: '', font: '', textAlign: '', lineWidth: 1,
    fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn(), measureText: vi.fn(() => ({ width: 100 })) }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png'], { type: 'image/png' })))
  return context
}
class TestImage {
  crossOrigin = ''
  referrerPolicy = ''
  decoding = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 800
  naturalHeight = 400
  static blocked = false
  set src(_value: string) {
    expect(this.crossOrigin).toBe('anonymous')
    expect(this.referrerPolicy).toBe('no-referrer')
    queueMicrotask(() => TestImage.blocked ? this.onerror?.() : this.onload?.())
  }
}

describe('PNG export', () => {
  it('exports a themed PNG with nickname and artwork contained without cropping', async () => {
    const ctx = canvas()
    TestImage.blocked = false
    vi.stubGlobal('Image', TestImage)
    const board = { ...addRelease(emptyBoard(), release), nickname: 'night 🎵', theme: 'light' as const }
    const result = await exportPng(board)
    expect(result.blob.type).toBe('image/png')
    expect(result.missingCovers).toBe(0)
    expect(ctx.fillText).toHaveBeenCalledWith('night 🎵', expect.any(Number), expect.any(Number))
    expect(ctx.fillText).toHaveBeenCalledWith('ninefold', expect.any(Number), expect.any(Number))
    // 2:1 artwork remains 2:1 inside its square.
    const [, , , width, height] = ctx.drawImage.mock.calls[0]
    expect(width / height).toBe(2)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1440, 1740)
  })
  it('exports placeholders and reports covers blocked by CORS', async () => {
    const ctx = canvas()
    TestImage.blocked = true
    vi.stubGlobal('Image', TestImage)
    const result = await exportPng(addRelease(emptyBoard(), release))
    expect(result.blob.type).toBe('image/png')
    expect(result.missingCovers).toBe(1)
    expect(ctx.drawImage).not.toHaveBeenCalled()
    expect(ctx.fillText).toHaveBeenCalledWith('NO ARTWORK', expect.any(Number), expect.any(Number))
  })
  it('rejects an empty board and a failed encoder with a safe error', async () => {
    await expect(exportPng(emptyBoard())).rejects.toThrow(/release/i)
    canvas()
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(null))
    await expect(exportPng(addRelease(emptyBoard(), { ...release, artwork: null }))).rejects.toThrow(/PNG/i)
  })
})

