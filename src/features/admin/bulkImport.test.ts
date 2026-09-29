import { getStoriesByAuthor, getStory } from '@/features/stories/api'
import * as studio from '@/features/studio/api'
import { signInAs } from '@/test/helpers'
import {
  type BulkStoryDraft,
  draftErrors,
  importStory,
  readStoryFile,
  titleFromFileName,
} from './bulkImport'

beforeEach(() => localStorage.clear())

const body = (n: number) => `Nội dung chương ${n}. `.repeat(12)
const txt = (name: string, text: string) => new File([text], name, { type: 'text/plain' })

test('tên file thành tên truyện', () => {
  expect(titleFromFileName('Chi_Pheo  -  Nam Cao.TXT')).toBe('Chi Pheo - Nam Cao')
})

test('đọc file: tách chương, lời mở đầu thành giới thiệu', async () => {
  const draft = await readStoryFile(
    txt(
      'Mùa hạ.txt',
      `Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.\n\nChương 1: Gặp lại\n${body(1)}\n\nChương 2: Chia xa\n${body(2)}\n\nChương 3: Ngắn\nquá ngắn`,
    ),
    'k1',
  )
  expect(draft).toMatchObject({
    title: 'Mùa hạ',
    description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
    status: 'completed',
  })
  expect(draft.chapters.map((c) => c.title)).toEqual(['Gặp lại', 'Chia xa', 'Ngắn'])
  expect(draft.warnings.some((w) => w.includes('trước chương đầu tiên'))).toBe(false)
  // Thiếu thể loại thì chưa nhập được; chương quá ngắn chỉ bị bỏ qua
  expect(draftErrors(draft)).toEqual({ genreSlugs: 'Chọn ít nhất 1 thể loại' })
})

test('nhập một truyện: tạo, thêm chương, công khai với tên tác giả gốc', async () => {
  signInAs('demo')
  const draft: BulkStoryDraft = {
    key: 'k1',
    fileName: 'chi-pheo.txt',
    title: 'Chí Phèo',
    authorName: 'Nam Cao',
    genreSlugs: ['hien-dai'],
    status: 'completed',
    description: 'Truyện ngắn nổi tiếng về người nông dân bị tha hóa.',
    chapters: [
      { sourceNumber: 1, title: 'Một', content: body(1), problem: null },
      { sourceNumber: 2, title: 'Hai', content: 'ngắn', problem: 'Quá ngắn' },
      { sourceNumber: 3, title: 'Ba', content: body(3), problem: null },
    ],
    warnings: [],
  }
  const result = await importStory(draft)
  expect(result).toMatchObject({ slug: 'chi-pheo', chapters: 2, skipped: 1 })

  const story = await getStory('chi-pheo')
  expect(story).toMatchObject({
    visibility: 'published',
    chapterCount: 2,
    author: { name: 'Nam Cao' },
  })
  expect((await studio.getMyStory(result.id))?.authorName).toBe('Nam Cao')

  // Truyện khác của cùng tài khoản nhưng khác bút danh không phải "cùng tác giả"
  await importStory({ ...draft, key: 'k2', title: 'Lão Hạc', authorName: 'Nam Cao' })
  await importStory({ ...draft, key: 'k3', title: 'Vợ Nhặt', authorName: 'Kim Lân' })
  const same = await getStoriesByAuthor(story!.author.slug, 'chi-pheo')
  expect(same.map((s) => s.title)).toEqual(['Lão Hạc'])
})
