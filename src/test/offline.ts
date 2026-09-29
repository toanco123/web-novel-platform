// Tiện ích cho test đọc offline: giả mất mạng, tạo chương giả để lưu thẳng vào kho trên máy
import { act } from '@testing-library/react'
import type { MockInstance } from 'vitest'
import type { ChapterContent } from '@/types/chapter'

let offline: MockInstance | undefined

/** Giả mất mạng: navigator.onLine = false và phát sự kiện offline (TanStack Query, useOnline nghe) */
export function goOffline() {
  offline ??= vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
}

/** Có mạng lại; setup.ts gọi sau mỗi test để onlineManager của TanStack Query không kẹt offline */
export function goOnline() {
  offline?.mockRestore()
  offline = undefined
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
}

/** Chương giả (chương sau là number + 1, tới chương `last`) */
export function fakeChapter(
  slug: string,
  number: number,
  { title = 'Mùa Hạ', last = 1000 }: { title?: string; last?: number } = {},
): ChapterContent {
  return {
    story: {
      slug,
      title,
      author: { slug: 'tac-gia-u1', name: 'Tác giả' },
      status: 'ongoing',
      chapterCount: last,
      coverUrl: null,
    },
    number,
    title: `Chương ${number}`,
    content: `<p>Nội dung chương ${number}.</p>`,
    publishedAt: '2026-09-01T00:00:00.000Z',
    prev: number > 1 ? { number: number - 1, title: `Chương ${number - 1}` } : null,
    next: number < last ? { number: number + 1, title: `Chương ${number + 1}` } : null,
  }
}
