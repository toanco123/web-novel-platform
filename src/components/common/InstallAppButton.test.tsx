import { act, screen } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'

test('trình duyệt cho cài thì hiện nút; bấm thì mở hộp cài của trình duyệt', async () => {
  const { user } = renderApp('/')
  await screen.findByRole('contentinfo', undefined, { timeout: 3000 })
  expect(screen.queryByRole('button', { name: 'Cài ứng dụng' })).toBeNull()

  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  expect(event.defaultPrevented).toBe(true)

  await user.click(await screen.findByRole('button', { name: 'Cài ứng dụng' }))
  expect(prompt).toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Cài ứng dụng' })).toBeNull()
})
