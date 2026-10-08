// Đổi dòng của view story_cards sang kiểu Story: chương hẹn giờ sắp ra
import { type StoryCardRow, toStory } from './cards.remote'

vi.mock('@/lib/supabase', () => ({ supabase: null, db: () => ({}) }))

const row = (over: Partial<StoryCardRow> = {}) =>
  ({
    id: 's1',
    slug: 'mua-ha',
    title: 'Mùa Hạ',
    description: '',
    status: 'ongoing',
    visibility: 'published',
    owner_id: 'u1',
    author_name: 'Linh',
    author_key: null,
    cover_path: null,
    genres: [],
    genre_slugs: [],
    chapter_count: 3,
    first_chapter_number: 1,
    latest_chapter_number: 3,
    latest_chapter_title: 'Ba',
    view_count: 0,
    follower_count: 0,
    rating_count: 0,
    rating_avg: 0,
    rating_counts: [0, 0, 0, 0, 0],
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-07T00:00:00Z',
    next_chapter_number: null,
    next_chapter_at: null,
    ...over,
  }) as StoryCardRow

test('chương hẹn giờ sắp ra: có cả số chương và giờ thì mới có nextChapter', () => {
  expect(toStory(row()).nextChapter).toBeNull()
  expect(
    toStory(row({ next_chapter_number: 4, next_chapter_at: '2026-10-08T13:00:00Z' })).nextChapter,
  ).toEqual({ number: 4, at: '2026-10-08T13:00:00Z' })
})
