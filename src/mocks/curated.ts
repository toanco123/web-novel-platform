// Truyện chọn tay cho trang chủ ở bản giả (bản thật: bảng curated_stories). Quản trị viên ghi
// (features/admin), trang chủ đọc (features/stories). Lưu id truyện theo đúng thứ tự hiển thị.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { CuratedList } from '@/types/story'

const KEY = 'mock-curated'

type Store = Partial<Record<CuratedList, string[]>>

export const loadCurated = (list: CuratedList) => readMock<Store>(KEY, {})[list] ?? []

export function saveCurated(list: CuratedList, storyIds: string[]) {
  writeMock(KEY, { ...readMock<Store>(KEY, {}), [list]: storyIds })
}
