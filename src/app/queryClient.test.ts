import { MutationObserver } from '@tanstack/react-query'
import { reportError } from '@/lib/monitoring'
import { createQueryClient } from './queryClient'

vi.mock('@/lib/monitoring', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/monitoring')>()),
  reportError: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

test('query lỗi thì gửi reportError kèm query key', async () => {
  const client = createQueryClient()
  const error = new Error('hỏng')
  await client
    .query({ queryKey: ['stories', 'x'], queryFn: () => Promise.reject(error), retry: false })
    .catch(() => {})
  expect(reportError).toHaveBeenCalledWith(error, { queryKey: ['stories', 'x'] })
})

test('mutation lỗi thì gửi reportError kèm mutation key', async () => {
  const client = createQueryClient()
  const error = new Error('hỏng')
  const observer = new MutationObserver(client, {
    mutationKey: ['rate'],
    mutationFn: () => Promise.reject(error),
  })
  await observer.mutate().catch(() => {})
  expect(reportError).toHaveBeenCalledWith(error, { mutationKey: ['rate'] })
})
