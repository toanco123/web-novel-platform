// Tải về đọc offline (người đọc bấm): tải từng đợt chương vào kho trên máy và ghim lại. Tiến độ
// nằm ở store Zustand (không persist) nên đóng hộp thoại hay chuyển trang vẫn thấy; đóng tab thì
// dừng, bấm tải lại chỉ lấy phần còn thiếu.
import { toast } from 'sonner'
import { create } from 'zustand'
import { getChapterRange } from '@/features/chapters/api'
import { formatBytes } from '@/lib/format'
import { isNetworkError } from '@/lib/network'
import { OfflineStorageFullError, pinChapters, saveChapters, walkSaved } from './store'

/** Số chương mỗi đợt tải */
export const DOWNLOAD_BATCH = 20

export type Download = {
  status: 'running' | 'done' | 'cancelled' | 'failed'
  /** Số chương trong khoảng đã có trên máy (kể cả chương có sẵn trước lượt tải) */
  done: number
  total: number
  /** Dung lượng vừa tải */
  bytes: number
  error?: string
}

export const useDownloads = create<{ bySlug: Record<string, Download> }>(() => ({ bySlug: {} }))

const update = (slug: string, download: Download) =>
  useDownloads.setState((s) => ({ bySlug: { ...s.bySlug, [slug]: download } }))

const controllers = new Map<string, AbortController>()
const encoder = new TextEncoder()

export function cancelDownload(slug: string) {
  controllers.get(slug)?.abort()
}

type Request = {
  slug: string
  title: string
  /** Chương bắt đầu (chương đang đọc, chỗ đọc dở hoặc chương đầu) */
  from: number
  /** Số chương cần có trên máy tính từ `from` */
  total: number
  /** Sau mỗi đợt và khi xong (làm mới danh sách "Đã lưu") */
  onChange?: () => void
}

/**
 * Tải `total` chương từ chương `from`: đoạn đầu đã có trên máy được ghim tại chỗ và tính vào số
 * chương; phần còn lại tải từng đợt DOWNLOAD_BATCH chương. Mỗi truyện một lượt tải cùng lúc.
 */
export async function downloadChapters({ slug, title, from, total, onChange }: Request) {
  if (controllers.has(slug)) return
  const controller = new AbortController()
  controllers.set(slug, controller)
  let done = 0
  let bytes = 0
  update(slug, { status: 'running', done, total, bytes })
  try {
    const { saved, missing } = await walkSaved(slug, from, total)
    await pinChapters(slug, saved)
    done = saved.length
    update(slug, { status: 'running', done, total, bytes })
    let next = missing
    while (next !== null && done < total && !controller.signal.aborted) {
      const chapters = await getChapterRange(slug, next, Math.min(DOWNLOAD_BATCH, total - done))
      if (chapters.length === 0) break
      await saveChapters(chapters, { pinned: true })
      done += chapters.length
      bytes += chapters.reduce((sum, c) => sum + encoder.encode(c.content).length, 0)
      next = chapters.at(-1)!.next?.number ?? null
      update(slug, { status: 'running', done, total, bytes })
      onChange?.()
    }
    if (controller.signal.aborted) {
      update(slug, { status: 'cancelled', done, total, bytes })
    } else {
      update(slug, { status: 'done', done, total, bytes })
      toast.success(`Đã tải ${done} chương "${title}"`, {
        description: `${formatBytes(bytes)} · đọc được cả khi không có mạng`,
      })
    }
  } catch (error) {
    const message =
      error instanceof OfflineStorageFullError
        ? `Bộ nhớ máy đầy, đã tải được ${done} chương.`
        : isNetworkError(error)
          ? `Mất mạng, đã tải được ${done} chương. Có mạng lại thì bấm tải tiếp.`
          : `Không tải được, đã tải được ${done} chương. Thử lại sau.`
    update(slug, { status: 'failed', done, total, bytes, error: message })
    toast.error(message)
  } finally {
    controllers.delete(slug)
    onChange?.()
  }
}
