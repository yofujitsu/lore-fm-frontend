import { boardHeading } from './board'
import type { TopBoard } from './board'
import { safeHttpsUrl } from './search'

function loadCover(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.decoding = 'async'
    const timer = window.setTimeout(() => finish(null), 5000)
    function finish(result: HTMLImageElement | null) {
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(result)
    }
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null)
    image.onerror = () => finish(null)
    image.src = url
  })
}

export async function exportPng(board: TopBoard): Promise<{ blob: Blob; missingCovers: number }> {
  if (!board.releases.some(Boolean)) throw new Error('Add at least one release before exporting.')
  const canvas = document.createElement('canvas')
  canvas.width = 1440
  canvas.height = 1980
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('PNG export is unavailable in this browser.')
  const palette = board.theme === 'light'
    ? { background: '#f1f1fa', text: '#242238', muted: '#646077', accent: '#6750a8', surface: '#fdfcff', line: '#d9d5e8' }
    : { background: '#171823', text: '#f4f2ff', muted: '#b2b3cd', accent: '#c1adff', surface: '#212332', line: '#3e4059' }
  const logos = Promise.all(['/brand/spotify.svg', '/brand/musicbrainz.svg'].map(loadCover))
  const covers = await Promise.all(board.releases.map(release => {
    const url = safeHttpsUrl(release?.artwork?.url)
    return url ? loadCover(url) : null
  }))
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'left'
  ctx.fillStyle = palette.text
  ctx.font = '700 54px sans-serif'
  ctx.fillText('ninefold', 125, 97)
  ctx.fillStyle = palette.accent
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) ctx.fillRect(72 + column * 14, 61 + row * 14, 11, 11)
  ctx.fillStyle = palette.accent
  const heading = boardHeading(board)
  let fontSize = 42
  ctx.font = '600 ' + fontSize + 'px sans-serif'
  while (ctx.measureText(heading).width > 1296 && fontSize > 22) {
    ctx.font = '600 ' + --fontSize + 'px sans-serif'
  }
  ctx.fillText(fitCaption(heading, 1296), 72, 173)
  function fitCaption(text: string, maximum = 420) {
    if (ctx!.measureText(text).width <= maximum) return text
    const characters = Array.from(new Intl.Segmenter().segment(text), part => part.segment)
    let low = 0, high = characters.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (ctx!.measureText(characters.slice(0, middle).join('') + '…').width <= maximum) low = middle
      else high = middle - 1
    }
    return characters.slice(0, low).join('') + '…'
  }
  let missingCovers = 0
  for (let index = 0; index < 9; index++) {
    const x = 72 + (index % 3) * 438
    const y = 240 + Math.floor(index / 3) * 518
    const image = covers[index]
    ctx.fillStyle = palette.surface
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, 420, 420, 8)
    ctx.clip()
    ctx.fillRect(x, y, 420, 420)
    if (image) {
      const scale = Math.min(420 / image.naturalWidth, 420 / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      ctx.drawImage(image, x + (420 - width) / 2, y + (420 - height) / 2, width, height)
    } else {
      if (board.releases[index]) missingCovers += 1
      ctx.strokeStyle = palette.line
      ctx.lineWidth = 2
      ctx.strokeRect(x + 1, y + 1, 418, 418)
      ctx.fillStyle = palette.accent
      for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) ctx.fillRect(x + 153 + column * 41, y + 146 + row * 41, 32, 32)
      ctx.textAlign = 'center'
      ctx.fillStyle = palette.muted
      ctx.font = '400 17px sans-serif'
      ctx.fillText(board.releases[index] ? 'NO ARTWORK' : 'Empty slot', x + 210, y + 295)
      ctx.textAlign = 'left'
    }
    ctx.restore()
    const release = board.releases[index]
    if (release) {
      ctx.fillStyle = palette.text
      ctx.font = '600 32px sans-serif'
      ctx.fillText(fitCaption(release.title), x, y + 456)
      ctx.fillStyle = palette.muted
      ctx.font = '400 26px sans-serif'
      ctx.fillText(fitCaption(release.artists.map(artist => artist.name).join(', ') || 'Unknown artist'), x, y + 488)
    }
  }
  const [spotifyLogo, musicbrainzLogo] = await logos
  ctx.fillStyle = palette.muted
  ctx.font = '400 24px sans-serif'
  ctx.fillText('ninefold', 72, 1878)
  ctx.font = '400 22px sans-serif'
  ctx.fillText('Powered by', 460, 1878)
  if (spotifyLogo) ctx.drawImage(spotifyLogo, 585, 1857, 26, 26)
  ctx.fillText('Spotify', 621, 1878)
  ctx.fillText('&', 708, 1878)
  if (musicbrainzLogo) ctx.drawImage(musicbrainzLogo, 738, 1855, 26, 29)
  ctx.fillText('MusicBrainz', 774, 1878)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed. Please try again.')), 'image/png')
  })
  return { blob, missingCovers }
}

export function downloadPng(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'ninefold-top9.png'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

