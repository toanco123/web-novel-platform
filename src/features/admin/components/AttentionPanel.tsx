import { Card, Statistic } from 'antd'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useTheme } from '@/hooks/useTheme'
import { adminColors } from './adminTheme'

export type AttentionItem = {
  key: string
  title: string
  count: number
  to: string
  actionLabel: string
}

const number = new Intl.NumberFormat('vi-VN')

/**
 * Việc đang tồn của quản trị viên (không theo kỳ). Trạng thái ghi bằng chữ và icon, màu chỉ là
 * phần thêm.
 */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const theme = useTheme((s) => s.theme)
  const colors = adminColors(theme)
  const pending = items.filter((i) => i.count > 0).length

  return (
    <Card
      title="Cần xử lý"
      extra={
        <span className="text-xs text-muted-foreground">
          {pending ? `${pending}/${items.length} mục đang chờ` : 'Không có việc tồn'}
        </span>
      }
    >
      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {items.map((item) => {
          const open = item.count > 0
          const Icon = open ? CircleAlert : CircleCheck
          return (
            <li
              key={item.key}
              className="flex gap-3 rounded-lg border border-border p-3"
              style={open ? { borderLeft: `3px solid ${colors.warn}` } : undefined}
            >
              <Icon
                className="mt-0.5 hidden size-5 shrink-0 sm:block"
                style={{ color: open ? colors.warn : colors.up }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <Statistic
                  title={item.title}
                  value={item.count}
                  formatter={(v) => number.format(Number(v))}
                />
                <p className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-xs">
                  <span className="font-medium text-foreground">{open ? 'Cần xử lý' : 'Ổn'}</span>
                  <Link to={item.to}>{item.actionLabel} →</Link>
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
