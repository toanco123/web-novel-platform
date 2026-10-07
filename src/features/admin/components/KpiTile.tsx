import { Card } from 'antd'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import type { PeriodDelta } from '../shared'
import { adminColors } from './adminTheme'
import { Sparkline } from './Sparkline'

const number = new Intl.NumberFormat('vi-VN')
const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${number.format(Math.abs(n))}`

/**
 * Ô số liệu trong kỳ: số, thay đổi so với kỳ trước (mũi tên + chữ, không chỉ dựa vào màu) và biểu
 * đồ mini theo ngày. `hero`: ô chính của trang, số cỡ lớn.
 */
export function KpiTile({
  title,
  value,
  delta,
  compareLabel,
  spark,
  hero = false,
}: {
  title: string
  value: number
  delta: PeriodDelta
  /** vd "so với 30 ngày trước" */
  compareLabel: string
  spark: number[]
  hero?: boolean
}) {
  const theme = useTheme((s) => s.theme)
  const colors = adminColors(theme)

  return (
    <Card size={hero ? 'default' : 'small'} className="h-full">
      <div className="flex h-full flex-col">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p
          className={cn(
            'mt-1 font-sans leading-none font-semibold text-foreground',
            hero ? 'text-5xl' : 'text-2xl',
          )}
        >
          {number.format(value)}
        </p>
        <DeltaLine delta={delta} compareLabel={compareLabel} colors={colors} />
        <Sparkline
          values={spark}
          color={colors.series}
          className={cn('mt-auto w-full pt-3', hero ? 'h-20' : 'h-10')}
        />
      </div>
    </Card>
  )
}

function DeltaLine({
  delta,
  compareLabel,
  colors,
}: {
  delta: PeriodDelta
  compareLabel: string
  colors: ReturnType<typeof adminColors>
}) {
  const view = (() => {
    switch (delta.kind) {
      case 'none':
        return { mark: '—', text: 'chưa có số liệu', sr: '', color: undefined }
      case 'new':
        return { mark: '▲', text: `mới (${signed(delta.diff)})`, sr: 'tăng', color: colors.up }
      case 'flat':
        return { mark: '≈', text: 'không đổi', sr: '', color: undefined }
      default: {
        const up = delta.kind === 'up'
        return {
          mark: up ? '▲' : '▼',
          text: `${percent.format(Math.abs(delta.pct))}% (${signed(delta.diff)})`,
          sr: up ? 'tăng' : 'giảm',
          color: up ? colors.up : colors.down,
        }
      }
    }
  })()

  return (
    <p
      className="mt-2 text-xs text-muted-foreground"
      title="Kỳ này tính cả hôm nay (chưa hết ngày)"
    >
      <span className="font-medium" style={{ color: view.color }}>
        <span aria-hidden>{view.mark} </span>
        {view.sr && <span className="sr-only">{view.sr} </span>}
        {view.text}
      </span>{' '}
      {compareLabel}
    </p>
  )
}
