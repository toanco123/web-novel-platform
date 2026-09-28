import { Alert, Card, Col, Empty, Row, Segmented, Skeleton, Statistic, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  ADMIN_PERIODS,
  type AdminOverview,
  type AdminPeriod,
  formatShortDay,
} from '@/features/admin/api'
import {
  CategoryBars,
  ChartCard,
  DailyColumns,
  DailyLine,
} from '@/features/admin/components/OverviewCharts'
import { useAdminOverview } from '@/features/admin/hooks'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const DEFAULT_PERIOD: AdminPeriod = 30

const parsePeriod = (value: string | null): AdminPeriod =>
  ADMIN_PERIODS.find((p) => String(p) === value) ?? DEFAULT_PERIOD

export default function AdminDashboardPage() {
  const [params, setParams] = useSearchParams()
  const period = parsePeriod(params.get('ky'))
  const { data, isPending, isError } = useAdminOverview(period)

  const setPeriod = (value: AdminPeriod) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === DEFAULT_PERIOD) next.delete('ky')
        else next.set('ky', String(value))
        return next
      },
      { replace: true },
    )

  return (
    <div className="space-y-6">
      <title>{`Tổng quan · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Tổng quan</h1>
        <Segmented<AdminPeriod>
          value={period}
          onChange={setPeriod}
          options={ADMIN_PERIODS.map((p) => ({ label: `${p} ngày`, value: p }))}
          aria-label="Kỳ thống kê"
        />
      </div>

      {isError ? (
        <Alert type="error" showIcon title="Không tải được số liệu. Thử tải lại trang." />
      ) : isPending ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Overview data={data} period={period} />
      )}
    </div>
  )
}

function Overview({ data, period }: { data: AdminOverview; period: AdminPeriod }) {
  const { totals, days } = data
  const [content, setContent] = useState<'stories' | 'chapters'>('chapters')
  const series = (pick: (d: AdminOverview['days'][number]) => number) =>
    days.map((d) => ({ day: d.day, value: pick(d) }))
  const rows = (pick: (d: AdminOverview['days'][number]) => number) =>
    days.map((d) => ({ key: d.day, label: formatShortDay(d.day), value: pick(d) }))
  const pickContent = (d: AdminOverview['days'][number]) =>
    content === 'stories' ? d.stories : d.chapters
  const contentName = content === 'stories' ? 'Truyện mới' : 'Chương mới xuất bản'

  const tiles = [
    {
      title: 'Người dùng',
      value: totals.users,
      hint: `+${number.format(totals.newUsers)} trong kỳ`,
    },
    {
      title: 'Truyện công khai',
      value: totals.publishedStories,
      hint: `${number.format(totals.draftStories)} bản nháp`,
    },
    { title: 'Chương đã xuất bản', value: totals.publishedChapters },
    {
      title: 'Lượt đọc',
      value: totals.views,
      hint: `${number.format(totals.viewsInPeriod)} trong kỳ`,
    },
    { title: 'Bình luận', value: totals.comments },
    { title: 'Báo lỗi đang mở', value: totals.openReports },
  ]

  return (
    <>
      <Row gutter={[16, 16]}>
        {tiles.map((t) => (
          <Col key={t.title} xs={12} md={8} xl={4}>
            <Card size="small" className="h-full">
              <Statistic
                title={t.title}
                value={t.value}
                formatter={(v) => number.format(Number(v))}
              />
              {t.hint && <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCard
            title={`Người dùng mới · ${period} ngày`}
            valueLabel="Người dùng mới"
            rows={rows((d) => d.signups)}
          >
            <DailyColumns data={series((d) => d.signups)} name="Người dùng mới" />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title={`Lượt đọc · ${period} ngày`}
            valueLabel="Lượt đọc"
            rows={rows((d) => d.views)}
          >
            <DailyLine data={series((d) => d.views)} name="Lượt đọc" />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title={`${contentName} · ${period} ngày`}
            valueLabel={contentName}
            rows={rows(pickContent)}
            toolbar={
              <Segmented
                size="small"
                value={content}
                onChange={setContent}
                options={[
                  { label: 'Chương mới', value: 'chapters' },
                  { label: 'Truyện mới', value: 'stories' },
                ]}
                aria-label="Loại nội dung mới"
              />
            }
          >
            <DailyColumns data={series(pickContent)} name={contentName} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Truyện công khai theo thể loại"
            valueLabel="Số truyện"
            rows={data.genres.map((g) => ({ key: g.name, label: g.name, value: g.stories }))}
            emptyText="Chưa có truyện công khai nào"
          >
            <CategoryBars
              data={data.genres.map((g) => ({ label: g.name, value: g.stories }))}
              name="Số truyện"
            />
          </ChartCard>
        </Col>
      </Row>

      <Card title="Truyện nhiều lượt đọc nhất">
        {data.topStories.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt đọc nào" />
        ) : (
          <Table
            rowKey="id"
            size="middle"
            pagination={false}
            dataSource={data.topStories}
            scroll={{ x: 640 }}
            columns={[
              { title: '#', key: 'rank', width: 48, render: (_, __, i) => i + 1 },
              {
                title: 'Truyện',
                dataIndex: 'title',
                render: (title: string, s) =>
                  s.visibility === 'published' ? (
                    <Link to={paths.story(s.slug)}>{title}</Link>
                  ) : (
                    <>
                      {title} <Tag>Nháp</Tag>
                    </>
                  ),
              },
              { title: 'Tác giả', dataIndex: 'authorName' },
              {
                title: 'Lượt đọc',
                dataIndex: 'views',
                align: 'right',
                render: (v: number) => number.format(v),
              },
              {
                title: 'Theo dõi',
                dataIndex: 'followers',
                align: 'right',
                render: (v: number) => number.format(v),
              },
              {
                title: 'Đánh giá',
                key: 'rating',
                align: 'right',
                render: (_, s) =>
                  s.ratingCount
                    ? `${s.ratingAvg.toFixed(1)} (${number.format(s.ratingCount)})`
                    : '–',
              },
            ]}
          />
        )}
      </Card>
    </>
  )
}
