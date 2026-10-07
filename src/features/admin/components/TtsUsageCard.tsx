import { Card, Progress } from 'antd'
import { useTheme } from '@/hooks/useTheme'
import { useAdminTtsUsage } from '../hooks'
import { adminColors } from './adminTheme'
import { Sparkline } from './Sparkline'

const number = new Intl.NumberFormat('vi-VN')
const megabytes = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
/** Từ mức này (% mức chặn của tháng) thì tô màu cảnh báo */
const WARN_PERCENT = 80

/**
 * Hạn mức Giọng AI của tháng: số ký tự đã gửi Google so với mức chặn (90% phần miễn phí), số người đã
 * tạo âm thanh, số file đã lưu trên R2. Plan: documents/plan-giong-ai.md
 */
export function TtsUsageCard() {
  const { data, isError } = useAdminTtsUsage()
  const theme = useTheme((s) => s.theme)
  const colors = adminColors(theme)

  if (isError) return null
  if (!data) return <Card title="Giọng AI tháng này" size="small" loading />

  const percent = data.cap ? Math.min(100, Math.round((data.chars / data.cap) * 100)) : 0
  const warn = percent >= WARN_PERCENT

  return (
    <Card title="Giọng AI tháng này" size="small">
      {data.cap === null ? (
        <p className="text-sm text-muted-foreground">Tháng này chưa ai tạo âm thanh Giọng AI.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{number.format(data.chars)}</span>
            <span className="text-muted-foreground">
              {' '}
              / {number.format(data.cap)} ký tự (mức chặn)
            </span>
          </p>
          <Progress
            percent={percent}
            showInfo
            strokeColor={warn ? colors.warn : colors.series}
            aria-label="Đã dùng hạn mức Giọng AI tháng này"
          />
          {warn && (
            <p className="text-xs" style={{ color: colors.warn }}>
              Sắp hết hạn mức: hết thì chỉ nghe được các đoạn đã có sẵn âm thanh.
            </p>
          )}
        </div>
      )}
      <Sparkline
        values={data.days.map((d) => d.chars)}
        color={colors.series}
        className="mt-3 h-8 w-full"
      />
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Người đã tạo</dt>
          <dd className="font-semibold tabular-nums">{number.format(data.users)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">File mới / tổng</dt>
          <dd className="font-semibold tabular-nums">
            {number.format(data.clipsThisMonth)} / {number.format(data.clips)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dung lượng R2</dt>
          <dd className="font-semibold tabular-nums">
            {megabytes.format(data.bytes / 1024 / 1024)} MB
          </dd>
        </div>
      </dl>
    </Card>
  )
}
