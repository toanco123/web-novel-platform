// Route loader tải trước dữ liệu công khai (plan-toi-uu-tai-trang-dot-3.md mục 1)
import { QueryClient } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { RouterContextProvider } from 'react-router'
import { chapterKeys } from '@/features/chapters/hooks'
import { storyKeys } from '@/features/stories/hooks'
import { renderApp } from '@/test/renderApp'
import { onUrlChange, rankingLoader, searchLoader, storyLoader } from './loaders'
import { routerContext } from './routerContext'

const slow = { timeout: 4000 }
const SLUG = 'mong-hoa-luc'
const args = (client: QueryClient, url: string, params: Record<string, string> = {}) => ({
  params,
  request: new Request(`http://localhost${url}`),
  context: routerContext(client),
})
const started = (client: QueryClient, queryKey: readonly unknown[]) =>
  client.getQueryCache().find({ queryKey, exact: true }) !== undefined

beforeEach(() => localStorage.clear())

test('trang truyện: tải trước thông tin truyện, đúng trang mục lục theo URL, truyện liên quan', () => {
  const client = new QueryClient()
  expect(storyLoader(args(client, `/story/${SLUG}?page=2&sort=newest`, { slug: SLUG }))).toBeNull()
  expect(started(client, storyKeys.detail(SLUG))).toBe(true)
  expect(started(client, chapterKeys.list(SLUG, 2, 'desc'))).toBe(true)
  expect(started(client, storyKeys.related(SLUG))).toBe(true)
})

test('xếp hạng và tìm kiếm đọc tham số như trang; tìm kiếm trống thì không tải gì', () => {
  const client = new QueryClient()
  rankingLoader(args(client, '/ranking?by=votes&period=all'))
  expect(started(client, storyKeys.ranking('votes', 'all'))).toBe(true)
  rankingLoader(args(client, '/ranking?by=khong-co'))
  expect(started(client, storyKeys.ranking('views', 'week'))).toBe(true)

  searchLoader(args(client, '/search?q=%20m%E1%BB%99ng%20&page=3'))
  expect(started(client, storyKeys.search('mộng', 3))).toBe(true)
  const before = client.getQueryCache().getAll().length
  searchLoader(args(client, '/search'))
  expect(client.getQueryCache().getAll()).toHaveLength(before)
})

test('router thiếu QueryClient trong context: loader bỏ qua, không làm hỏng trang', () => {
  const missing = { ...args(new QueryClient(), `/story/${SLUG}`, { slug: SLUG }) }
  missing.context = new RouterContextProvider()
  expect(storyLoader(missing)).toBeNull()
})

test('chỉ chạy lại loader khi đổi đường dẫn hoặc tham số', () => {
  const url = (path: string) => new URL(`http://localhost${path}`)
  const check = (from: string, to: string) =>
    onUrlChange({ currentUrl: url(from), nextUrl: url(to) } as Parameters<typeof onUrlChange>[0])
  expect(check('/story/a', '/story/a')).toBe(false)
  expect(check('/story/a', '/story/a?page=2')).toBe(true)
  expect(check('/story/a', '/story/b')).toBe(true)
})

test('mở trang truyện: loader và hook dùng chung một query, không tải trùng', async () => {
  const { client } = renderApp(`/story/${SLUG}?page=2`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Mộng Hoa Lục' }, slow)).toBeVisible()
  const cache = client.getQueryCache()
  expect(cache.findAll({ queryKey: ['stories', 'detail', SLUG] })).toHaveLength(1)
  expect(cache.findAll({ queryKey: ['chapters', SLUG, 'list'] })).toHaveLength(1)
  expect(cache.find({ queryKey: chapterKeys.list(SLUG, 2, 'asc'), exact: true })).toBeDefined()
})
