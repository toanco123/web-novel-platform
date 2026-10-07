// Bản giả của Giọng AI: cần đăng nhập, số đoạn khớp trang đọc, đoạn không chữ không có clip
import { ttsMock } from '@/mocks/tts'
import { registerUser, signOut } from '@/test/helpers'
import { fetchClips } from './api'

const request = {
  slug: 'truong-an-khong-tuyet',
  chapter: 1,
  voice: 'Aoede',
  generate: [0],
  title: true,
}

beforeEach(() => {
  localStorage.clear()
  ttsMock.reset()
})

test('khách thì báo unauthenticated', async () => {
  signOut()
  await expect(fetchClips(request)).rejects.toMatchObject({ code: 'unauthenticated' })
})

test('người đăng nhập nhận manifest đủ số đoạn; sai số đoạn thì content_changed', async () => {
  await registerUser()
  const manifest = await fetchClips(request)
  expect(manifest.total).toBeGreaterThan(0)
  expect(manifest.paragraphs).toHaveLength(manifest.total)
  expect(manifest.title).toHaveLength(1)
  await expect(fetchClips({ ...request, total: manifest.total + 1 })).rejects.toMatchObject({
    code: 'content_changed',
  })
})

test('test ép lỗi được', async () => {
  await registerUser()
  ttsMock.fail = 'tts_month_quota'
  await expect(fetchClips(request)).rejects.toMatchObject({ code: 'tts_month_quota' })
})
