import { parseDraft } from './board'
import type { TopBoard } from './board'
import type { Provider, ReleaseType } from './release'

export const MAX_SHARE_PAYLOAD = 8000
const MAX_JSON_BYTES = 65536
export class ShareError extends Error {}

interface SharedReleaseV1 {
  i: string
  t: string
  a: string[]
  y: number | null
  k: ReleaseType
  c: [string, Provider] | null
  s: [Provider, string, string | null][]
}
interface SharedBoardV1 {
  v: 1
  n: string
  b?: string
  t: TopBoard['theme']
  r: (SharedReleaseV1 | null)[]
}
const tooLarge = () => new ShareError('This board is too large to share.')
const invalid = () => new ShareError('This share link is invalid or corrupted.')
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
function cleanText(value: unknown): string {
  if (typeof value !== 'string') throw invalid()
  return value.replace(/\p{Cc}/gu, '')
}
function stream(bytes: Uint8Array<ArrayBuffer>) {
  return new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(bytes); controller.close() } })
}
async function readLimited(input: ReadableStream<Uint8Array>, maximum: number): Promise<Uint8Array> {
  const reader = input.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maximum) { await reader.cancel(); throw tooLarge() }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

export async function encodeShare(board: TopBoard): Promise<string> {
  if (!board.releases.some(Boolean)) throw new ShareError('Add at least one release before sharing.')
  if (typeof CompressionStream === 'undefined') throw new ShareError('Sharing is unavailable in this browser. Try an up-to-date browser.')
  const snapshot = parseDraft(JSON.stringify(board))
  const dto: SharedBoardV1 = {
    v: 1, n: snapshot.nickname, ...(snapshot.name !== undefined ? { b: snapshot.name } : {}), t: snapshot.theme,
    r: snapshot.releases.map(release => release && ({
      i: release.id, t: release.title, a: release.artists.map(artist => artist.name), y: release.releaseYear, k: release.type,
      c: release.artwork ? [release.artwork.url, release.artwork.provider] : null,
      s: release.sources.map(source => [source.provider, source.externalId, source.externalUrl]),
    })),
  }
  const json = new TextEncoder().encode(JSON.stringify(dto))
  if (json.byteLength > MAX_JSON_BYTES) throw tooLarge()
  const compressed = await readLimited(stream(json).pipeThrough(new CompressionStream('gzip')), 6000)
  const payload = btoa(Array.from(compressed, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  if (payload.length > MAX_SHARE_PAYLOAD) throw tooLarge()
  return payload
}

export async function decodeShare(payload: string): Promise<TopBoard> {
  if (!payload || payload.length > MAX_SHARE_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(payload)) throw invalid()
  if (typeof DecompressionStream === 'undefined') throw new ShareError('This browser cannot open share links. Try an up-to-date browser.')
  try {
    const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - payload.length % 4) % 4))
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    const json = await readLimited(stream(bytes).pipeThrough(new DecompressionStream('gzip')), MAX_JSON_BYTES)
    const dto: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json))
    if (!object(dto)) throw invalid()
    if (dto.v !== 1) throw new ShareError('This share link uses an unsupported version.')
    if (!Array.isArray(dto.r) || dto.r.length !== 9) throw invalid()
    const board = parseDraft(JSON.stringify({
      version: 1, nickname: cleanText(dto.n), ...(dto.b !== undefined ? { name: cleanText(dto.b) } : {}), theme: dto.t,
      releases: dto.r.map(item => {
        if (item === null) return null
        if (!object(item) || !Array.isArray(item.a) || !Array.isArray(item.s)
          || !(item.c === null || (Array.isArray(item.c) && item.c.length === 2))) throw invalid()
        return {
          id: cleanText(item.i), title: cleanText(item.t), artists: item.a.map(name => ({ name: cleanText(name) })),
          releaseYear: item.y, type: item.k,
          artwork: item.c === null ? null : { url: item.c[0], provider: item.c[1], width: null, height: null },
          sources: item.s.map(source => {
            if (!Array.isArray(source) || source.length !== 3) throw invalid()
            return { provider: source[0], externalId: cleanText(source[1]), externalUrl: source[2] }
          }),
        }
      }),
    }))
    if (!board.releases.some(Boolean)) throw invalid()
    return board
  } catch (error) {
    if (error instanceof ShareError) throw error
    throw invalid()
  }
}

export async function createShareUrl(board: TopBoard, origin = window.location.origin): Promise<string> {
  return origin + '/top/' + await encodeShare(board)
}

