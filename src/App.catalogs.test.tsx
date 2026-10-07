import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { encodeShare } from './sharing'
import { addRelease, emptyBoard } from './board'
import type { Release } from './release'
beforeEach(() => { localStorage.clear(); window.history.replaceState(null,'','/'); vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[]})})) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState(null,'','/') })
it('keeps search automatic without a platform menu and links the developer and active catalogs', async () => {
  vi.useFakeTimers(); render(<App />)
  expect(screen.queryByLabelText('Search source')).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Search YouTube'})).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'yofujitsu on GitHub'})).toHaveAttribute('href','https://github.com/yofujitsu')
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by')
  expect(screen.getByRole('link',{name:'Spotify'})).toHaveAttribute('href','https://open.spotify.com/')
  expect(screen.getByRole('link',{name:'MusicBrainz'})).toHaveAttribute('href','https://musicbrainz.org/')
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Bladee'}})
  await act(async()=>{await vi.advanceTimersByTimeAsync(400)})
  expect(fetch).toHaveBeenCalledWith('/api/v1/releases/search?q=Bladee',expect.anything())
})
it('uses the same header and credits on a readonly shared board without old slogans', async () => {
  const release:Release={id:'spotify:123',title:'A record',artists:[{name:'Artist'}],releaseYear:null,type:'ALBUM',artwork:null,sources:[]}
  window.history.replaceState(null,'','/top/'+await encodeShare(addRelease(emptyBoard(),release)))
  render(<App />)
  expect(await screen.findByRole('heading',{name:/^Top 9$/})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'yofujitsu on GitHub'})).toBeInTheDocument()
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by')
  expect(screen.queryByText(/One taste|A LITTLE RECORD|MADE FOR MUSIC PEOPLE/i)).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})
