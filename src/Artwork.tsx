import { useState } from 'react'
import { safeHttpsUrl } from './search'

export function GridMark() {
  return <span className="grid-mark" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>
}

export function Artwork({ url, title }: { url?: string | null; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const cover = safeHttpsUrl(url)
  return <div className="cover">
    {cover && failedUrl !== cover
      ? <img src={cover} alt={title + ' artwork'} loading="lazy" draggable={false} onError={() => setFailedUrl(cover)} />
      : <div className="cover-placeholder" role="img" aria-label="Artwork unavailable"><GridMark /><span>NO ARTWORK</span></div>}
  </div>
}

