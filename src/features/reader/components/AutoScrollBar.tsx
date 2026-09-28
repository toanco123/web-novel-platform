import { ChevronRight, Minus, Pause, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AutoScroll } from '../autoscroll/useAutoScroll'
import { AUTO_SCROLL_SPEEDS } from '../autoscroll/useAutoScrollSettings'
import { rateLabel } from '../readerOptions'
import { FloatingBar } from './FloatingBar'

type Props = {
  autoScroll: AutoScroll
  /** Chương đang đọc */
  chapter: number
  /** Chương sau để cuộn tiếp khi hết chương; null khi không còn (hoặc đang cuộn liên tục) */
  next: number | null
  onNext: () => void
}

/** Thanh điều khiển tự động cuộn, nổi ở đáy màn hình, cùng kiểu với thanh nghe truyện */
export function AutoScrollBar({ autoScroll, chapter, next, onNext }: Props) {
  const { status, atEnd, speed } = autoScroll
  const running = status === 'running'

  return (
    <FloatingBar label="Tự động cuộn">
      {atEnd ? (
        <>
          <p role="status" className="min-w-0 flex-1 truncate px-3 text-sm">
            {next ? (
              <span className="font-medium">Hết chương {chapter}</span>
            ) : (
              'Đã tới chương mới nhất'
            )}
          </p>
          {next && (
            <Button className="h-10 rounded-full px-4" onClick={onNext}>
              Chương sau
              <ChevronRight />
            </Button>
          )}
        </>
      ) : (
        <>
          <Button
            size="icon-lg"
            className="size-11 rounded-full"
            aria-label={running ? 'Tạm dừng' : 'Cuộn tiếp'}
            onClick={running ? autoScroll.pause : autoScroll.resume}
          >
            {running ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </Button>
          <p className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground sm:text-sm">
            <span className="font-medium text-foreground">Chương {chapter}</span>
            {/* Màn hẹp chỉ ghi số chương; nút tạm dừng/cuộn tiếp đã cho biết trạng thái */}
            <span className="hidden sm:inline">{running ? ' · tự cuộn' : ' · đã dừng'}</span>
          </p>
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label="Chậm hơn"
            disabled={speed <= AUTO_SCROLL_SPEEDS[0]}
            onClick={autoScroll.slower}
          >
            <Minus />
          </Button>
          <output aria-live="polite" className="min-w-10 text-center text-sm tabular-nums">
            <span className="sr-only">Tốc độ </span>
            {rateLabel(speed)}
          </output>
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label="Nhanh hơn"
            disabled={speed >= AUTO_SCROLL_SPEEDS[AUTO_SCROLL_SPEEDS.length - 1]}
            onClick={autoScroll.faster}
          >
            <Plus />
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="icon-lg"
        className="rounded-full text-muted-foreground"
        aria-label="Tắt tự động cuộn"
        onClick={autoScroll.stop}
      >
        <X />
      </Button>
    </FloatingBar>
  )
}
