import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ChapterContent } from '@/types/chapter'
import { ChapterArticle } from './ChapterArticle'

const chapter = (content: string): ChapterContent => ({
  story: {
    slug: 'truyen',
    title: 'Truyện',
    author: { slug: 'tac-gia', name: 'Tác giả' },
    status: 'ongoing',
    chapterCount: 1,
    coverUrl: null,
  },
  number: 1,
  title: 'Mở đầu',
  content,
  publishedAt: '2026-09-29T00:00:00Z',
  prev: null,
  next: null,
})

test('hiển thị tiêu đề, danh sách, định dạng chữ; mỗi đơn vị đọc có data-paragraph liên tục', () => {
  const { container } = render(
    <MemoryRouter>
      <ChapterArticle
        activeParagraph={2}
        chapter={chapter(
          '<h2>Phần một</h2><p style="text-align: center">***</p>' +
            '<ol data-style="lower-alpha"><li><p><em>Một</em></p></li><li><p>Hai</p></li></ol>' +
            '<p>Chữ <u>gạch</u><img src=x onerror="alert(1)"></p>',
        )}
      />
    </MemoryRouter>,
  )
  // Tên chương là h1 nên tiêu đề trong chương là h2
  expect(screen.getByRole('heading', { level: 2, name: 'Phần một' })).toHaveAttribute(
    'data-paragraph',
    '0',
  )
  const units = Array.from(container.querySelectorAll('[data-paragraph]'))
  expect(units.map((u) => [u.tagName, u.textContent])).toEqual([
    ['H2', 'Phần một'],
    ['P', '***'],
    ['LI', 'Một'],
    ['LI', 'Hai'],
    ['P', 'Chữ gạch'],
  ])
  expect(units[1]).toHaveClass('text-center')
  expect(units[2]).toHaveClass('bg-primary/10')
  expect(units[2].closest('ol')).toHaveClass('list-[lower-alpha]')
  expect(units[2].querySelector('em')).toHaveTextContent('Một')
  expect(container.querySelector('img')).toBeNull()
  // Không có chữ hoa đầu chương khi khối đầu là tiêu đề
  expect(units[0].parentElement!.className).not.toContain('first-letter')
})

test('chương văn bản thuần cũ giữ nguyên cách hiển thị', () => {
  const { container } = render(
    <MemoryRouter>
      <ChapterArticle chapter={chapter('Đoạn một\ndòng hai\n\nĐoạn <b>hai</b>')} />
    </MemoryRouter>,
  )
  const units = container.querySelectorAll('[data-paragraph]')
  expect(units).toHaveLength(2)
  expect(units[0].textContent).toBe('Đoạn một\ndòng hai')
  expect(units[1].textContent).toBe('Đoạn <b>hai</b>')
  expect(container.querySelector('b')).toBeNull()
})
