import { useEffect, useRef, useState } from 'react'
import type { TopBoard } from './board'
import { createShareUrl, ShareError } from './sharing'
import { downloadPng, exportPng } from './png'

export default function ShareActions({ board, allowShare = true }: { board: TopBoard; allowShare?: boolean }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'share' | 'png' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const currentBoard = useRef(board)
  const mounted = useRef(true)
  currentBoard.current = board
  const empty = !board.releases.some(Boolean)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { setUrl(''); setMessage(''); setError(false) }, [board])
  const current = (snapshot: TopBoard) => mounted.current && currentBoard.current === snapshot

  async function copy(link: string) {
    try {
      if (!navigator.clipboard?.writeText) return false
      await navigator.clipboard.writeText(link)
      return true
    } catch { return false }
  }
  async function share() {
    const snapshot = board
    setBusy('share')
    setMessage('')
    setError(false)
    try {
      const link = await createShareUrl(snapshot)
      if (!current(snapshot)) return
      setUrl(link)
      const copied = await copy(link)
      if (current(snapshot)) setMessage(copied ? 'Link copied. Ready to share.' : 'Link ready. Copy it below.')
    } catch (error) {
      if (current(snapshot)) { setError(true); setMessage(error instanceof ShareError ? error.message : 'Could not create a share link. Please try again.') }
    } finally { if (mounted.current) setBusy(null) }
  }
  async function copyLink() {
    const snapshot = board
    const copied = await copy(url)
    if (current(snapshot)) setMessage(copied ? 'Link copied. Ready to share.' : 'Clipboard unavailable. Select and copy the link below.')
  }
  async function png() {
    setBusy('png')
    setMessage('')
    setError(false)
    try {
      const result = await exportPng(board)
      if (!mounted.current) return
      downloadPng(result.blob)
      setMessage(result.missingCovers ? 'PNG exported with ' + result.missingCovers + ' unavailable cover' + (result.missingCovers === 1 ? '.' : 's.') : 'PNG exported.')
    } catch {
      if (mounted.current) { setError(true); setMessage('PNG export failed. Please try again.') }
    } finally { if (mounted.current) setBusy(null) }
  }

  return <div className="share-actions" aria-busy={busy !== null}>
    <div className="publish-buttons">
      {allowShare && <button className="primary-button" type="button" disabled={empty || busy !== null} onClick={share}>{busy === 'share' ? 'Creating link…' : 'Share board'}</button>}
      <button className="secondary-button" type="button" disabled={empty || busy !== null} onClick={png}>{busy === 'png' ? 'Exporting PNG…' : 'Download PNG'}</button>
    </div>
    {message && <p className={'action-message' + (error ? ' action-error' : '')} role={error ? 'alert' : 'status'}>{message}</p>}
    {url && <div className="share-link-field">
      <label htmlFor="share-link">Share link</label>
      <input id="share-link" aria-label="Share link" readOnly value={url} onFocus={event => event.currentTarget.select()} />
      <div><button className="text-button" type="button" onClick={copyLink}>Copy link</button><a href={url} target="_blank" rel="noopener noreferrer">Open shared board ↗</a></div>
    </div>}
  </div>
}

