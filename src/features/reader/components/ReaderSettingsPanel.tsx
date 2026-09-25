import { Minus, Plus, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { fonts, toneClass, tones, widths } from '../readerOptions'
import { useSpeechSettings } from '../speech/useSpeechSettings'
import { pickVoice, speechSupported, useVoices } from '../speech/useVoices'
import {
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  READER_DEFAULTS,
  useReaderSettings,
} from '../useReaderSettings'

const segment =
  'h-10 flex-1 rounded-lg border text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40'
const segmentIdle = 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
const segmentActive = 'border-primary bg-primary/10 text-foreground'

/** Chỉnh cách hiển thị chương; thay đổi áp dụng ngay và được nhớ cho lần đọc sau */
export function ReaderSettingsPanel() {
  const settings = useReaderSettings()
  const { update } = settings
  const isDefault = (Object.keys(READER_DEFAULTS) as (keyof typeof READER_DEFAULTS)[]).every(
    (k) => settings[k] === READER_DEFAULTS[k],
  )

  return (
    <div className="space-y-7">
      <Group label="Cách đọc" id="reader-mode">
        <div role="group" aria-labelledby="reader-mode" className="flex gap-2">
          {(
            [
              [false, 'Từng chương'],
              [true, 'Cuộn liên tục'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={settings.continuous === value}
              onClick={() => update({ continuous: value })}
              className={cn(segment, settings.continuous === value ? segmentActive : segmentIdle)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {settings.continuous
            ? 'Đọc gần hết chương thì chương sau tự nối vào bên dưới.'
            : 'Mỗi chương một trang, bấm “Chương sau” hoặc phím → để sang chương mới.'}
        </p>
      </Group>

      <Group label="Màu nền" id="reader-tone">
        <div role="radiogroup" aria-labelledby="reader-tone" className="grid grid-cols-5 gap-2">
          {tones.map((t) => {
            const active = settings.tone === t.value
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ tone: t.value })}
                className="group flex flex-col items-center gap-1.5 rounded-lg outline-none"
              >
                <span
                  className={cn(
                    toneClass[t.value],
                    'grid size-12 place-items-center rounded-full bg-background font-reading text-base text-foreground ring-1 ring-border transition group-focus-visible:ring-3 group-focus-visible:ring-ring/50',
                    active && 'ring-2 ring-primary',
                  )}
                  aria-hidden
                >
                  Aa
                </span>
                <span
                  className={cn('text-xs', active ? 'text-foreground' : 'text-muted-foreground')}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </Group>

      <Group label="Phông chữ" id="reader-font">
        <div role="group" aria-labelledby="reader-font" className="flex gap-2">
          {fonts.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={settings.font === f.value}
              onClick={() => update({ font: f.value })}
              className={cn(
                segment,
                f.className,
                settings.font === f.value ? segmentActive : segmentIdle,
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Group>

      <Group label="Cỡ chữ" id="reader-size">
        <div role="group" aria-labelledby="reader-size" className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            aria-label="Giảm cỡ chữ"
            disabled={settings.fontSize <= FONT_SIZE_RANGE.min}
            onClick={() => update({ fontSize: settings.fontSize - 1 })}
          >
            <Minus />
          </Button>
          <output className="flex-1 text-center text-sm tabular-nums" aria-live="polite">
            {settings.fontSize}px
          </output>
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            aria-label="Tăng cỡ chữ"
            disabled={settings.fontSize >= FONT_SIZE_RANGE.max}
            onClick={() => update({ fontSize: settings.fontSize + 1 })}
          >
            <Plus />
          </Button>
        </div>
      </Group>

      <Group
        label="Giãn dòng"
        id="reader-line"
        value={settings.lineHeight.toFixed(2).replace(/0$/, '')}
      >
        <Slider
          aria-labelledby="reader-line"
          min={LINE_HEIGHT_RANGE.min}
          max={LINE_HEIGHT_RANGE.max}
          step={LINE_HEIGHT_RANGE.step}
          value={[settings.lineHeight]}
          onValueChange={([v]) => update({ lineHeight: v })}
          className="py-2"
        />
      </Group>

      {/* Màn hẹp thì khung chữ luôn chiếm hết chiều ngang, không cần chỉnh */}
      <Group label="Độ rộng khung chữ" id="reader-width" className="hidden md:block">
        <div role="group" aria-labelledby="reader-width" className="flex gap-2">
          {widths.map((w) => (
            <button
              key={w.value}
              type="button"
              aria-pressed={settings.width === w.value}
              onClick={() => update({ width: w.value })}
              className={cn(segment, settings.width === w.value ? segmentActive : segmentIdle)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </Group>

      {speechSupported() && <SpeechSettings />}

      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        disabled={isDefault}
        onClick={settings.reset}
      >
        <RotateCcw />
        Đặt lại mặc định
      </Button>
    </div>
  )
}

/** Giọng đọc và tự chuyển chương cho tính năng nghe truyện */
function SpeechSettings() {
  const { voiceURI, autoNext, update } = useSpeechSettings()
  const { all, vietnamese } = useVoices()
  const current = pickVoice(all, voiceURI)

  return (
    <Group label="Nghe truyện" id="reader-speech">
      <div className="space-y-3" role="group" aria-labelledby="reader-speech">
        {all.length > 0 && (
          <Select value={current?.voiceURI ?? ''} onValueChange={(v) => update({ voiceURI: v })}>
            <SelectTrigger
              aria-label="Giọng đọc"
              className="w-full rounded-lg data-[size=default]:h-10"
            >
              <SelectValue placeholder="Giọng mặc định" />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              {all.map((v) => (
                <SelectItem key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {vietnamese.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Máy bạn chưa có giọng tiếng Việt nên có thể đọc sai dấu. Cài thêm giọng tiếng Việt trong
            cài đặt ngôn ngữ của máy để nghe rõ hơn.
          </p>
        )}
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={autoNext}
            onCheckedChange={(checked) => update({ autoNext: checked === true })}
          />
          Hết chương tự đọc tiếp chương sau
        </label>
      </div>
    </Group>
  )
}

function Group({
  label,
  id,
  value,
  className,
  children,
}: {
  label: string
  id: string
  value?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <p id={id} className="text-sm font-medium">
          {label}
        </p>
        {value && <span className="text-sm text-muted-foreground tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  )
}
