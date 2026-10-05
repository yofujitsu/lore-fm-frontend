import type { Provider, Release, ReleaseType } from './release'
import { safeHttpsUrl } from './search'

export interface TopBoard {
  version: 1
  nickname: string
  theme: 'dark' | 'light'
  releases: (Release | null)[]
}
export const DRAFT_KEY = 'ninefold.board.v1'
export const emptyBoard = (): TopBoard => ({ version: 1, nickname: '', theme: 'dark', releases: Array(9).fill(null) })
export const normalizeNickname = (text: string) => Array.from(text.replace(/\p{Cc}/gu, '')).slice(0, 40).join('')
const slotExists = (index: number) => Number.isInteger(index) && index >= 0 && index < 9

export function addRelease(board: TopBoard, release: Release, target: number | null = null): TopBoard {
  if (board.releases.some(slot => slot?.id === release.id)) return board
  const index = target ?? board.releases.findIndex(slot => slot === null)
  if (!slotExists(index)) return board
  return { ...board, releases: board.releases.map((slot, i) => i === index ? release : slot) }
}
export function removeRelease(board: TopBoard, index: number): TopBoard {
  if (!slotExists(index) || !board.releases[index]) return board
  return { ...board, releases: board.releases.map((slot, i) => i === index ? null : slot) }
}
export function swapSlots(board: TopBoard, from: number, to: number): TopBoard {
  if (!slotExists(from) || !slotExists(to) || from === to || !board.releases[from]) return board
  return { ...board, releases: board.releases.map((slot, i) => i === from ? board.releases[to] : i === to ? board.releases[from] : slot) }
}

const providers: Provider[] = ['SPOTIFY', 'MUSICBRAINZ', 'SOUNDCLOUD', 'YOUTUBE', 'GENIUS']
const types: ReleaseType[] = ['ALBUM', 'EP', 'MIXTAPE', 'SINGLE', 'COMPILATION', 'PLAYLIST', 'VIDEO_RELEASE', 'UNKNOWN']
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 2000): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const size = (value: unknown) => value === null || (Number.isInteger(value) && Number(value) >= 0)
const url = (value: unknown) => typeof value === 'string' && value.length <= 8192 && safeHttpsUrl(value) !== undefined
function validRelease(value: unknown): value is Release {
  if (!object(value) || !text(value.id) || !text(value.title) || !types.includes(value.type as ReleaseType)
    || !(value.releaseYear === null || (Number.isInteger(value.releaseYear) && Number(value.releaseYear) > 0 && Number(value.releaseYear) <= 9999))
    || !Array.isArray(value.artists) || value.artists.length > 100 || !value.artists.every(artist => object(artist) && text(artist.name))
    || !Array.isArray(value.sources) || value.sources.length > 20 || !value.sources.every(source => object(source)
      && providers.includes(source.provider as Provider) && text(source.externalId) && (source.externalUrl === null || url(source.externalUrl)))) return false
  const artwork = value.artwork
  return artwork === null || (object(artwork) && url(artwork.url) && size(artwork.width) && size(artwork.height) && providers.includes(artwork.provider as Provider))
}

export function parseDraft(raw: string): TopBoard {
  if (raw.length > 250000) throw new Error('Saved draft is too large')
  const value: unknown = JSON.parse(raw)
  if (!object(value) || value.version !== 1 || (value.theme !== 'dark' && value.theme !== 'light')
    || typeof value.nickname !== 'string' || value.nickname !== normalizeNickname(value.nickname)
    || !Array.isArray(value.releases) || value.releases.length !== 9
    || !value.releases.every(release => release === null || validRelease(release))) throw new Error('Invalid saved draft')
  const releases = value.releases as (Release | null)[]
  const ids = releases.flatMap(release => release ? [release.id] : [])
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate releases in saved draft')
  return { version: 1, nickname: value.nickname, theme: value.theme as TopBoard['theme'], releases }
}

export function loadDraft(): { board: TopBoard; warning: string | null } {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    return { board: raw === null ? emptyBoard() : parseDraft(raw), warning: null }
  } catch {
    return { board: emptyBoard(), warning: 'Your saved draft could not be restored. You can start a new board.' }
  }
}

