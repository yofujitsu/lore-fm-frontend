import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('types changing prompts without playback controls', async () => {
  vi.useFakeTimers()
  const view = render(<App />)
  const line = () => view.container.querySelector('.typed-line')?.textContent
  expect(line()).toContain('albums to dance to.')
  for (let step = 0; step < 120; step++) await act(async () => { await vi.advanceTimersByTimeAsync(50) })
  expect(line()).toContain('singles that made you.')
  expect(screen.queryByRole('button', { name: /headline animation/ })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Pick your top 9 albums, EPs or singles.')
})
it('keeps the prompt static when the reader prefers reduced motion', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  const view = render(<App />)
  const initial = view.container.querySelector('.typed-line')?.textContent
  expect(initial).toContain('albums to dance to.')
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(view.container.querySelector('.typed-line')?.textContent).toBe(initial)
  expect(screen.queryByRole('button', { name: 'Pause headline animation' })).not.toBeInTheDocument()
})
