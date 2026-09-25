import { AuthError } from '@/features/auth/api'
import { createGenre, GenreExistsError, getGenres } from './api'

beforeEach(() => localStorage.clear())
const signIn = () => localStorage.setItem('mock-auth-session', JSON.stringify('demo'))

test('chưa đăng nhập thì không tạo được', async () => {
  await expect(createGenre({ name: 'Hệ thống' })).rejects.toBeInstanceOf(AuthError)
})

test.each(['ngôn tình', 'Ngôn Tình', 'ngon tinh', '  NGÔN   TÌNH '])(
  'chặn trùng với thể loại có sẵn: %j',
  async (name) => {
    signIn()
    const error = await createGenre({ name }).catch((e) => e)
    expect(error).toBeInstanceOf(GenreExistsError)
    expect(error.genre.slug).toBe('ngon-tinh')
  },
)

test('tạo mới: chuẩn hóa tên, ghi người tạo, hiện trong danh sách với 0 truyện', async () => {
  signIn()
  const genre = await createGenre({ name: '  hệ   thống ', description: ' Truyện có hệ thống ' })
  expect(genre).toMatchObject({
    slug: 'he-thong',
    name: 'Hệ thống',
    description: 'Truyện có hệ thống',
    createdBy: { id: 'demo', displayName: 'Bạn đọc Demo' },
  })
  const all = await getGenres()
  expect(all.find((g) => g.slug === 'he-thong')).toMatchObject({ storyCount: 0 })
  await expect(createGenre({ name: 'He Thong' })).rejects.toBeInstanceOf(GenreExistsError)
})
