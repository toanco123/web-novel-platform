// Bản Supabase của phiên đăng nhập trên client giả: chỉ kiểm phần chạy trên máy (hồ sơ lần trước
// dùng khi mở app lúc offline).
import type * as Remote from './api.remote'

const fake = vi.hoisted(() => ({
  profile: { data: null, error: null } as { data: unknown; error: unknown },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'u1', email: 'linh@gmail.com', app_metadata: {} } } },
      }),
    },
    from: () => {
      const query: Record<string, () => unknown> = {
        select: () => query,
        eq: () => query,
        single: async () => fake.profile,
      }
      return query
    },
  }),
}))

/** Như mở lại trang: module mới, hồ sơ không còn trong bộ nhớ */
async function freshApi(): Promise<typeof Remote> {
  vi.resetModules()
  return import('./api.remote')
}

const offlineError = { message: 'TypeError: Failed to fetch', code: '' }

beforeEach(() => localStorage.clear())

test('mở app lúc offline: dùng hồ sơ đã tải lần trước', async () => {
  fake.profile = { data: { id: 'u1', display_name: 'Linh', avatar_url: null }, error: null }
  expect(await (await freshApi()).getSession()).toMatchObject({ id: 'u1', displayName: 'Linh' })

  fake.profile = { data: null, error: offlineError }
  expect(await (await freshApi()).getSession()).toMatchObject({ id: 'u1', displayName: 'Linh' })
})

test('chưa có hồ sơ lần trước, hoặc lỗi không do mạng: vẫn báo lỗi', async () => {
  fake.profile = { data: null, error: offlineError }
  await expect((await freshApi()).getSession()).rejects.toMatchObject(offlineError)

  localStorage.setItem(
    'auth-profile',
    JSON.stringify({ id: 'u1', displayName: 'Linh', avatarUrl: null }),
  )
  fake.profile = { data: null, error: { code: 'PGRST116', message: 'No rows' } }
  await expect((await freshApi()).getSession()).rejects.toMatchObject({ code: 'PGRST116' })
})
