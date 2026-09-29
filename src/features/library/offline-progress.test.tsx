import { screen } from '@testing-library/react'
import { getSavedChapter } from '@/features/offline/store'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { registerUser } from '@/test/helpers'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getStoryProgress } from './api'

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
})

test('mất mạng vẫn ghi lịch sử đọc khi chuyển chương', async () => {
  await registerUser()
  const { user, router } = renderApp(`${base}/chapter-12`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })
  await expect.poll(() => getSavedChapter(slug, 13), { timeout: 3000 }).not.toBeNull()

  goOffline()
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chapter-13`)
  await expect.poll(async () => (await getStoryProgress(slug))?.chapter, { timeout: 3000 }).toBe(13)
})
