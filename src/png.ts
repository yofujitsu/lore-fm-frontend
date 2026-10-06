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
    ? { background: '#f5f5eb', text: '#242b1d', muted: '#637153', accent: '#526e24', surface: '#eaf0dd', line: '#d1d9c2' }
    : { background: '#111410', text: '#eeeede', muted: '#939c88', accent: '#d7f676', surface: '#1b2018', line: '#323c2c' }
  const covers = await Promise.all(board.releases.map(release => {
    const url = safeHttpsUrl(release?.artwork?.url)
    return url ? loadCover(url) : null
  }))
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'left'
  ctx.fillStyle = palette.text
  ctx.font = '700 54px sans-serif'
  ctx.fillText('ninefold', 72, 97)
  ctx.fillStyle = palette.accent
  ctx.font = '600 24px sans-serif'
  ctx.fillText('NINE RELEASES. ONE TASTE.', 72, 143)
  if (board.nickname) {
    let fontSize = 34
    do { ctx.font = '400 ' + fontSize + 'px sans-serif'; fontSize -= 1 } while (ctx.measureText(board.nickname).width > 1296 && fontSize > 18)
    ctx.fillStyle = palette.muted
    ctx.fillText(board.nickname, 72, 203)
  }
  function fitCaption(text: string) {
    if (ctx!.measureText(text).width <= 420) return text
    const characters = Array.from(new Intl.Segmenter().segment(text), part => part.segment)
    let low = 0, high = characters.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (ctx!.measureText(characters.slice(0, middle).join('') + '…').width <= 420) low = middle
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
      ctx.fillText(board.releases[index] ? 'NO ARTWORK' : 'AN OPEN SLOT', x + 210, y + 295)
      ctx.textAlign = 'left'
    }
    const release = board.releases[index]
    if (release) {
      ctx.fillStyle = palette.text
      ctx.font = '600 28px sans-serif'
      ctx.fillText(fitCaption(release.title), x, y + 456)
      ctx.fillStyle = palette.muted
      ctx.font = '400 22px sans-serif'
      ctx.fillText(fitCaption(release.artists.map(artist => artist.name).join(', ') || 'Unknown artist'), x, y + 488)
    }
  }
  ctx.fillStyle = palette.muted
  ctx.font = '400 24px sans-serif'
  ctx.fillText('A little record of you.', 72, 1878)
  ctx.textAlign = 'right'
  ctx.font = '600 20px sans-serif'
  ctx.fillText('MADE FOR MUSIC PEOPLE.', 1368, 1878)
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

