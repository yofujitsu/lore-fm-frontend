import type { SearchResponse } from './release'

export async function searchReleases(query: string, signal: AbortSignal): Promise<SearchResponse> {
  const response = await fetch('/api/v1/releases/search?q=' + encodeURIComponent(query), { signal })
  if (!response.ok) throw new Error('Search request failed')
  const data: SearchResponse = await response.json()
  if (!Array.isArray(data.results)) throw new Error('Invalid search response')
  return data
}

export function safeHttpsUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function trimSearchQuery(value: string): string {
  return value.replace(/^[\p{White_Space}\u001c-\u001f\ufeff]+|[\p{White_Space}\u001c-\u001f\ufeff]+$/gu, '')
}
