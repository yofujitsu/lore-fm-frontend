import { useEffect, useState } from 'react'

const prompts = ['albums to dance to.', 'singles that made you.', 'albums in your goth era.', 'EPs for your next era.', 'releases from anime soundtracks.', 'albums that built your lore.', 'singles for music nerds.']

export default function AnimatedHeading() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [typing, setTyping] = useState({ index: 0, length: prompts[0].length, deleting: false })
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const changed = () => setReduced(media.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    if (reduced) return
    const complete = typing.length === prompts[typing.index].length
    const delay = typing.deleting ? 28 : complete ? 2200 : 55
    const timer = window.setTimeout(() => setTyping(current => {
      if (current.deleting) return current.length === 0
        ? { index: (current.index + 1) % prompts.length, length: 0, deleting: false }
        : { ...current, length: current.length - 1 }
      return current.length === prompts[current.index].length
        ? { ...current, deleting: true } : { ...current, length: current.length + 1 }
    }), delay)
    return () => window.clearTimeout(timer)
  }, [typing, reduced])
  return <div className="hero-heading">
    <h1 id="hero-title" aria-label="Pick your top 9 albums, EPs or singles.">
      <span aria-hidden="true">Pick your top 9<span className="typed-line">{reduced ? prompts[0] : prompts[typing.index].slice(0, typing.length)}<span className="typing-cursor" /></span></span>
    </h1>
  </div>
}
