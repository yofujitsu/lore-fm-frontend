import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('types changing prompts and lets the reader pause them', async () => {
  vi.useFakeTimers()
  const view = render(<App />)
  const line = () => view.container.querySelector('.typed-line')?.textContent
  expect(line()).toContain('albums to dance to.')
  for (let step = 0; step < 120; step++) await act(async () => { await vi.advanceTimersByTimeAsync(50) })
  expect(line()).toContain('singles that made you.')
  fireEvent.click(screen.getByRole('button', { name: 'Pause headline animation' }))
  const paused = line()
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(line()).toBe(paused)
  expect(screen.getByRole('button', { name: 'Resume headline animation' })).toBeInTheDocument()
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
