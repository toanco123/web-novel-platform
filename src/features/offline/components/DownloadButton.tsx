import { useQueryClient } from '@tanstack/react-query'
import { Download as DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChapterCountFrom } from '@/features/chapters/hooks'
import { useOnline } from '@/hooks/useOnline'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cancelDownload, type Download, downloadChapters, useDownloads } from '../downloads'
import { offlineKeys, useSavedChapters } from '../hooks'

type Props = {
  slug: string
  title: string
  /** Tải từ chương này */
  from: number
  className?: string
}

/** Nút "Tải về đọc offline" + hộp thoại chọn số chương, xem tiến độ, hủy */
export function DownloadButton({ slug, title, from, className }: Props) {
  const online = useOnline()
  const [open, setOpen] = useState(false)
  const download = useDownloads((s) => s.bySlug[slug])
  const running = download?.status === 'running'

  return (
    <>
      <Button
        variant="outline"
        className={cn('rounded-full', className)}
        disabled={!online && !running}
        onClick={() => setOpen(true)}
      >
        <DownloadIcon />
        {running ? `Đang tải ${download.done}/${download.total}` : 'Tải về đọc offline'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tải về đọc offline</DialogTitle>
            <DialogDescription>
              Tải từ chương {from}. Chương tải về được giữ trên máy tới khi bạn xóa trong Tủ truyện,
              mục Đã lưu.
            </DialogDescription>
          </DialogHeader>
          {open && <DownloadPanel slug={slug} title={title} from={from} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function DownloadPanel({ slug, title, from }: Omit<Props, 'className'>) {
  const queryClient = useQueryClient()
  const download = useDownloads((s) => s.bySlug[slug])
  const remaining = useChapterCountFrom(slug, from)
  const saved = useSavedChapters(slug)
  const have = saved.data?.filter((c) => c.number >= from).length ?? 0

  if (download?.status === 'running') {
    const percent = download.total ? Math.round((download.done / download.total) * 100) : 0
    return (
      <div className="space-y-4">
        <div
          role="progressbar"
          aria-label="Tiến độ tải"
          aria-valuemin={0}
          aria-valuemax={download.total}
          aria-valuenow={download.done}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Đang tải {download.done}/{download.total} chương. Có thể đóng hộp thoại, việc tải vẫn tiếp
          tục.
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => cancelDownload(slug)}>
          Hủy tải
        </Button>
      </div>
    )
  }

  const start = (total: number) =>
    void downloadChapters({
      slug,
      title,
      from,
      total,
      onChange: () => void queryClient.invalidateQueries({ queryKey: offlineKeys.all }),
    })
  const total = remaining.data

  return (
    <div className="space-y-4">
      {download && <DownloadResult download={download} />}
      {have > 0 && (
        <p className="text-sm text-muted-foreground">
          Đã có {have} chương từ chương {from} trên máy.
        </p>
      )}
      {remaining.isError ? (
        <p className="text-sm text-destructive">Không lấy được số chương. Thử lại sau.</p>
      ) : total === undefined ? (
        <div className="h-10 animate-pulse rounded-full bg-muted" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">Không còn chương nào để tải.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {[20, 50]
            .filter((n) => n < total)
            .map((n) => (
              <Button key={n} variant="outline" className="rounded-full" onClick={() => start(n)}>
                {n} chương
              </Button>
            ))}
          <Button className="rounded-full" onClick={() => start(total)}>
            Toàn bộ {total} chương
          </Button>
        </div>
      )}
    </div>
  )
}

function DownloadResult({ download }: { download: Download }) {
  const text =
    download.status === 'done'
      ? `Đã tải ${download.done} chương · ${formatBytes(download.bytes)}.`
      : download.status === 'cancelled'
        ? `Đã hủy, giữ ${download.done} chương đã tải.`
        : download.error
  return (
    <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
      {text}
    </p>
  )
}
