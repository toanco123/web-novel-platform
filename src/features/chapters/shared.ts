// Phần dùng chung của hai backend chương (api.mock.ts, api.remote.ts)

/** Đoạn cuối URL trang đọc "chapter-12" → 12; không đúng dạng thì null (router không nhận tham số
 * nằm giữa đoạn nên trang đọc và route loader tự tách) */
export function parseChapterSegment(segment: string) {
  const match = /^chapter-(\d{1,6})$/.exec(segment)
  return match ? Number(match[1]) : null
}

/** Trang mục lục và thứ tự của trang chi tiết truyện từ `?page`, `?sort` */
export function parseChapterListParams(params: URLSearchParams) {
  return {
    page: Math.max(1, Number(params.get('page')) || 1),
    order: params.get('sort') === 'newest' ? ('desc' as const) : ('asc' as const),
  }
}

/** Số chương mỗi trang mục lục (trang chi tiết truyện, mục lục trong trang đọc) */
export const CHAPTERS_PER_PAGE = 50
