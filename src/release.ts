export type Provider = 'SPOTIFY' | 'MUSICBRAINZ' | 'SOUNDCLOUD' | 'YOUTUBE' | 'GENIUS'
export type ReleaseType = 'ALBUM' | 'EP' | 'MIXTAPE' | 'SINGLE' | 'COMPILATION' | 'PLAYLIST' | 'VIDEO_RELEASE' | 'UNKNOWN'
export interface Release {
  id: string
  title: string
  artists: { name: string }[]
  releaseYear: number | null
  type: ReleaseType
  artwork: { url: string; width: number | null; height: number | null; provider: Provider } | null
  sources: { provider: Provider; externalId: string; externalUrl: string | null }[]
}
export interface SearchResponse { query: string; results: Release[]; partial?: boolean; unavailable?: boolean }
