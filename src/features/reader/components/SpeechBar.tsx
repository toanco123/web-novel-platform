import { LoaderCircle, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SPEECH_RATES, useSpeechSettings } from '../speech/useSpeechSettings'
import type { ChapterSpeech } from '../speech/useChapterSpeech'

const rateLabel = (rate: number) => `${rate.toLocaleString('vi-VN')}×`

/** Thanh điều khiển nghe truyện, nổi ở đáy màn hình khi đang nghe hoặc tạm dừng */
export function SpeechBar({ speech }: { speech: ChapterSpeech }) {
  const rate = useSpeechSettings((s) => s.rate)
  const playing = speech.status === 'playing'
  const preparing = playing && speech.total === 0
  const rates: readonly number[] = SPEECH_RATES
  const nextRate = rates[(rates.indexOf(rate) + 1) % rates.length]

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="region"
        aria-label="Nghe truyện"
        className="pointer-events-auto flex w-full max-w-lg items-center gap-1 rounded-full border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full"
          aria-label="Đoạn trước"
          disabled={speech.paragraph === 0 || preparing}
          onClick={() => speech.skip(-1)}
        >
          <SkipBack />
        </Button>
        <Button
          size="icon-lg"
          className="size-11 rounded-full"
          aria-label={playing ? 'Tạm dừng' : 'Nghe tiếp'}
          onClick={playing ? speech.pause : speech.resume}
        >
          {preparing ? (
            <LoaderCircle className="animate-spin" />
          ) : playing ? (
            <Pause className="fill-current" />
          ) : (
            <Play className="fill-current" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full"
          aria-label="Đoạn sau"
          disabled={preparing || speech.paragraph >= speech.total - 1}
          onClick={() => speech.skip(1)}
        >
          <SkipForward />
        </Button>

        <p className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground sm:text-sm">
          <span className="font-medium text-foreground">Chương {speech.chapter}</span>
          {speech.total > 0 && (
            <span className="tabular-nums">
              {' · '}
              đoạn {speech.paragraph + 1}/{speech.total}
            </span>
          )}
          {!playing && <span> · đã dừng</span>}
        </p>

        <Button
          variant="ghost"
          className="h-10 min-w-12 rounded-full px-2.5 tabular-nums"
          aria-label={`Tốc độ đọc ${rateLabel(rate)}, bấm để đổi sang ${rateLabel(nextRate)}`}
          onClick={() => speech.setRate(nextRate)}
        >
          {rateLabel(rate)}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full text-muted-foreground"
          aria-label="Tắt nghe truyện"
          onClick={speech.stop}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
