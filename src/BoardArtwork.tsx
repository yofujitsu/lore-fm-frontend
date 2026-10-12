import { useLayoutEffect, useRef, useState } from 'react'
import { Artwork } from './Artwork'
import type { Release } from './release'

export default function BoardArtwork({ release, index }: { release: Release | null; index: number }) {
  const previous = useRef(release)
  const [departing, setDeparting] = useState<Release | null>(null)
  const [revision, setRevision] = useState(0)

  useLayoutEffect(() => {
    const old = previous.current
    previous.current = release
    if (old?.id === release?.id) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setDeparting(reduced ? null : old)
    if (reduced) return
    setRevision(value => value + 1)
    if (!old) return
    // The draft changes immediately; retain only an inaccessible visual until the fade finishes.
    const timer = window.setTimeout(() => setDeparting(null), 500)
    return () => window.clearTimeout(timer)
  }, [release?.id])

  return <div className="slot-visual">
    <div key={'cover-' + revision} className={'slot-content' + (release && revision ? ' is-entering' : '')}>
      {release ? <Artwork url={release.artwork?.url} title={release.title} />
        : <span className="empty-slot"><span aria-hidden="true">+</span><span>{String(index + 1).padStart(2, '0')}</span></span>}
    </div>
    {departing && <div key={'departure-' + revision} className="slot-departure" aria-hidden="true">
      <Artwork url={departing.artwork?.url} title={departing.title} />
    </div>}
    {revision > 0 && <span key={'glint-' + revision} className="slot-glint" aria-hidden="true" />}
  </div>
}
