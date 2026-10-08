// Các khối trang chủ với dữ liệu thật (Supabase): danh sách có thể rỗng (database mới, tuần chưa ai
// đọc) hoặc ngắn lại khi tải lại, điều dữ liệu giả không bao giờ gặp.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { Story } from '@/types/story'
import { EditorPicks } from './EditorPicks'
import { GenreCloud } from './GenreCloud'
import { HeroShowcase } from './HeroShowcase'
import { LatestUpdates } from './LatestUpdates'
import { NewReleases } from './NewReleases'
import { TrendingWeekly } from './TrendingWeekly'

const data = vi.hoisted(() => ({ stories: [] as Story[] }))

vi.mock('../hooks', () => {
  const loaded = <T,>(value: T) => ({ data: value, isPending: false, isError: false })
  return {
    useFeaturedStories: () => loaded(data.stories),
    useEditorPicks: () => loaded(data.stories),
    useLatestUpdated: () => loaded(data.stories),
    useNewReleases: () => loaded(data.stories),
    useTrendingWeekly: () => loaded(data.stories.map((story) => ({ story, value: 1 }))),
  }
})
vi.mock('@/features/genres/hooks', () => ({
  useGenres: () => ({ data: [], isPending: false, isError: false }),
}))
// Nút theo dõi cần phiên đăng nhập và tủ truyện, không liên quan tới các test này
vi.mock('@/features/library/components/FollowButton', () => ({ FollowButton: () => null }))

const story = (n: number): Story => ({
  id: `id-${n}`,
  slug: `truyen-${n}`,
  title: `Truyện ${n}`,
  author: { slug: 'tac-gia-1', name: 'Tác giả' },
  genres: [],
  status: 'ongoing',
  description: '',
  coverUrl: null,
  chapterCount: 1,
  viewCount: 0,
  ratingAvg: 0,
  ratingCount: 0,
  firstChapterNumber: 1,
  latestChapter: { number: 1, title: '' },
  nextChapter: null,
  ownerId: 'u1',
  visibility: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

test('truyện nổi bật ít đi khi đang ở slide cuối: hiện slide cuối mới, không vỡ trang', async () => {
  data.stories = [1, 2, 3, 4].map(story)
  const user = userEvent.setup()
  const { rerender } = render(<HeroShowcase />, { wrapper: MemoryRouter })
  await user.click(screen.getByRole('tab', { name: 'Truyện 4' }))
  expect(screen.getByLabelText('4 / 4')).toBeInTheDocument()

  // Tải lại sau khi truyện thứ 4 bị ẩn
  data.stories = data.stories.slice(0, 3)
  rerender(<HeroShowcase />)
  expect(screen.getByLabelText('3 / 3')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Truyện 3' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Truyện 3' })).toHaveAttribute('aria-selected', 'true')
})

test('chưa có truyện, tuần chưa ai đọc: khối trưng bày ẩn đi, khối danh sách báo trống', () => {
  data.stories = []
  render(
    <>
      <HeroShowcase />
      <EditorPicks />
      <LatestUpdates />
      <NewReleases />
      <TrendingWeekly />
      <GenreCloud />
    </>,
    { wrapper: MemoryRouter },
  )
  expect(screen.queryByRole('heading', { name: 'Truyện đề cử' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Truyện mới ra' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mới cập nhật' })).toBeInTheDocument()
  expect(screen.getByText('Chưa có truyện nào được đăng.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Top tuần' })).toBeInTheDocument()
  expect(screen.getByText('Tuần này chưa có lượt đọc nào.')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Thể loại' })).not.toBeInTheDocument()
  expect(screen.queryAllByRole('list')).toHaveLength(0)
})
