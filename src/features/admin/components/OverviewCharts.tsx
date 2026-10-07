// Biểu đồ của trang Tổng quan (@ant-design/plots, vẽ bằng G2). Biểu đồ một chuỗi số liệu dùng màu
// --chart-1; biểu đồ so sánh hai kỳ dùng kiểu nhấn mạnh (kỳ này màu chính, kỳ trước xám nét đứt).
// Mỗi thẻ có chế độ xem bảng (đọc được số chính xác, dùng được với trình đọc màn hình).
import { Bar, Column, Line } from '@ant-design/plots'
import { Card, Empty, Segmented, Table } from 'antd'
import { type ReactNode, useState } from 'react'
import { type Theme, useTheme } from '@/hooks/useTheme'
import { formatLongDay, formatShortDay } from '../shared'
import { adminColors } from './adminTheme'

const number = new Intl.NumberFormat('vi-VN')

export type ChartRow = { key: string; label: string; values: number[] }

/** Thẻ biểu đồ: tiêu đề, nút đổi Biểu đồ/Bảng, trạng thái rỗng khi mọi giá trị bằng 0 */
export function ChartCard({
  title,
  valueLabels,
  rows,
  emptyText = 'Chưa có dữ liệu trong kỳ này',
  toolbar,
  children,
}: {
  title: string
  /** Tên các cột số trong bảng (theo thứ tự của rows[].values) */
  valueLabels: string[]
  rows: ChartRow[]
  emptyText?: string
  /** Nút chọn phía trên biểu đồ (vd đổi loại số liệu), hiện cả khi rỗng */
  toolbar?: ReactNode
  children: ReactNode
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const empty = rows.every((r) => r.values.every((v) => v === 0))

  return (
    <Card
      title={title}
      extra={
        !empty && (
          <Segmented
            size="small"
            value={view}
            onChange={setView}
            options={[
              { label: 'Biểu đồ', value: 'chart' },
              { label: 'Bảng', value: 'table' },
            ]}
            aria-label={`Cách xem: ${title}`}
          />
        )
      }
      className="h-full"
      styles={{ body: { minHeight: 300 } }}
    >
      {toolbar && <div className="mb-3">{toolbar}</div>}
      {empty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} className="py-12" />
      ) : view === 'chart' ? (
        <div role="img" aria-label={`Biểu đồ ${title.toLowerCase()}`}>
          {children}
        </div>
      ) : (
        <Table<ChartRow>
          size="small"
          rowKey="key"
          dataSource={rows}
          pagination={false}
          scroll={{ y: 260 }}
          columns={[
            { title: 'Mục', dataIndex: 'label' },
            ...valueLabels.map((label, i) => ({
              title: label,
              key: label,
              align: 'right' as const,
              render: (_: unknown, row: ChartRow) => number.format(row.values[i]),
            })),
          ]}
        />
      )}
    </Card>
  )
}

/** Theme G2 theo theme của web; nền trong suốt để ăn theo màu thẻ */
function chartTheme(theme: Theme) {
  return {
    type: theme === 'dark' ? 'classicDark' : 'classic',
    color: adminColors(theme).series,
    view: { viewFill: 'transparent' },
  }
}

type Day = { day: string; value: number }

function dayAxis(count: number) {
  return {
    x: {
      title: false,
      labelFormatter: formatShortDay,
      labelAutoHide: true,
      labelAutoRotate: false,
      // 90 ngày: chỉ ghi nhãn cách quãng cho đỡ dày
      tickFilter: (_: unknown, i: number) => count <= 31 || i % 7 === 0,
    },
    y: countAxis,
  }
}

// Số đếm nên chỉ ghi vạch ở số nguyên (không có "0,5 người dùng")
const countAxis = {
  title: false,
  labelFormatter: (v: number) => number.format(v),
  tickCount: 5,
  tickFilter: (v: number) => Number.isInteger(v),
}

const dayTooltip = (name: string) => ({
  title: (d: Day) => formatLongDay(d.day),
  items: [{ channel: 'y', name, valueFormatter: (v: number) => number.format(v) }],
})

/** Cột theo ngày (số lượng rời rạc: người dùng mới, truyện mới...) */
export function DailyColumns({ data, name }: { data: Day[]; name: string }) {
  const theme = useTheme((s) => s.theme)
  return (
    <Column
      data={data}
      xField="day"
      yField="value"
      height={260}
      autoFit
      theme={chartTheme(theme)}
      axis={dayAxis(data.length)}
      style={{ radiusTopLeft: 4, radiusTopRight: 4, maxWidth: 28, fill: adminColors(theme).series }}
      tooltip={dayTooltip(name)}
      interaction={{ elementHighlight: { background: true } }}
    />
  )
}

/** Đường theo ngày (lượt đọc), có đường dóng khi rê chuột */
export function DailyLine({ data, name }: { data: Day[]; name: string }) {
  const theme = useTheme((s) => s.theme)
  return (
    <Line
      data={data}
      xField="day"
      yField="value"
      height={260}
      autoFit
      theme={chartTheme(theme)}
      axis={dayAxis(data.length)}
      style={{ lineWidth: 2, stroke: adminColors(theme).series }}
      tooltip={dayTooltip(name)}
      interaction={{ tooltip: { crosshairs: true } }}
    />
  )
}

/** Thanh ngang theo nhóm (truyện theo thể loại), nhiều trước */
export function CategoryBars({
  data,
  name,
}: {
  data: { label: string; value: number }[]
  name: string
}) {
  const theme = useTheme((s) => s.theme)
  return (
    <Bar
      data={data}
      xField="label"
      yField="value"
      height={Math.max(160, data.length * 32)}
      autoFit
      theme={chartTheme(theme)}
      axis={{
        x: { title: false },
        y: countAxis,
      }}
      style={{ radiusTopLeft: 4, radiusTopRight: 4, maxWidth: 20, fill: adminColors(theme).series }}
      tooltip={{
        title: (d: { label: string }) => d.label,
        items: [{ channel: 'y', name, valueFormatter: (v: number) => number.format(v) }],
      }}
    />
  )
}

/**
 * Kỳ này so với kỳ trước trên cùng một trục: kỳ này màu chính, kỳ trước xám nét đứt (nhấn mạnh,
 * không phải hai chuỗi ngang hàng). Có chú giải và nhãn ở cuối mỗi đường nên không chỉ dựa vào màu.
 */
export function ComparisonLine({
  data,
  currentName,
  previousName,
}: {
  /** Mỗi ngày của kỳ này kèm số của ngày tương ứng ở kỳ trước */
  data: { day: string; prevDay: string; current: number; previous: number }[]
  currentName: string
  previousName: string
}) {
  const theme = useTheme((s) => s.theme)
  const colors = adminColors(theme)
  type Point = { day: string; series: string; value: number; date: string }
  const points: Point[] = data.flatMap((d) => [
    { day: d.day, series: previousName, value: d.previous, date: d.prevDay },
    { day: d.day, series: currentName, value: d.current, date: d.day },
  ])
  const isPrevious = (rows: Point[] | Point) =>
    (Array.isArray(rows) ? rows[0]?.series : rows.series) === previousName

  return (
    <Line
      data={points}
      xField="day"
      yField="value"
      colorField="series"
      height={280}
      autoFit
      // Chừa chỗ cho nhãn "Kỳ này"/"Kỳ trước" ở cuối mỗi đường
      paddingRight={64}
      theme={chartTheme(theme)}
      axis={dayAxis(data.length)}
      scale={{
        color: { domain: [currentName, previousName], range: [colors.series, colors.seriesMuted] },
      }}
      style={{
        lineWidth: (rows: Point[]) => (isPrevious(rows) ? 1.5 : 2.5),
        lineDash: (rows: Point[]) => (isPrevious(rows) ? [4, 4] : [0, 0]),
      }}
      legend={{ color: { position: 'top', layout: { justifyContent: 'flex-start' } } }}
      labels={[
        {
          text: 'series',
          selector: 'last',
          position: 'right',
          dx: 6,
          fontSize: 11,
          fill: colors.muted,
          // Hai số cuối gần nhau thì đẩy nhãn ra, không đè lên nhau
          transform: [{ type: 'overlapDodgeY' }],
        },
      ]}
      tooltip={{
        title: (d: Point) => formatLongDay(d.day),
        items: [
          {
            channel: 'y',
            valueFormatter: (v: number) => number.format(v),
          },
        ],
      }}
      interaction={{ tooltip: { crosshairs: true } }}
    />
  )
}
