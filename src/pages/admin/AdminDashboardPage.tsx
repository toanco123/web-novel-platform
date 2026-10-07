import { Alert, Card, Col, Row, Segmented, Spin, Statistic } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  ADMIN_PERIODS,
  addDays,
  type AdminOverview,
  type AdminOverviewDay,
  type AdminPeriod,
  formatShortDay,
  periodDelta,
} from '@/features/admin/api'
import { AttentionPanel } from '@/features/admin/components/AttentionPanel'
import { DashboardSkeleton } from '@/features/admin/components/DashboardSkeleton'
import { KpiTile } from '@/features/admin/components/KpiTile'
import {
  CategoryBars,
  ChartCard,
  ComparisonLine,
  DailyColumns,
  DailyLine,
} from '@/features/admin/components/OverviewCharts'
import { TopAuthorsTable } from '@/features/admin/components/TopAuthorsTable'
import { TopStoriesTable } from '@/features/admin/components/TopStoriesTable'
import { ViewsCalendar } from '@/features/admin/components/ViewsCalendar'
import { useAdminOverview } from '@/features/admin/hooks'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

const number = new Intl.NumberFormat('vi-VN')
const DEFAULT_PERIOD: AdminPeriod = 30

const parsePeriod = (value: string | null): AdminPeriod =>
  ADMIN_PERIODS.find((p) => String(p) === value) ?? DEFAULT_PERIOD

export default function AdminDashboardPage() {
  const [params, setParams] = useSearchParams()
  const period = parsePeriod(params.get('period'))
  const { data, isPending, isError, isPlaceholderData } = useAdminOverview(period)

  const setPeriod = (value: AdminPeriod) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === DEFAULT_PERIOD) next.delete('period')
        else next.set('period', String(value))
        return next
      },
      { replace: true },
    )

  return (
    <div className="space-y-6">
      <title>{`Tổng quan · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Tổng quan</h1>
          {data && <p className="mt-1 text-sm text-muted-foreground">{compareRange(data)}</p>}
        </div>
        <div className="flex items-center gap-3">
          {/* Đổi kỳ: số cũ vẫn hiện (mờ đi) trong lúc tải số của kỳ mới */}
          {isPlaceholderData && <Spin size="small" aria-label="Đang tải số liệu" />}
          <Segmented<AdminPeriod>
            value={period}
            onChange={setPeriod}
            options={ADMIN_PERIODS.map((p) => ({ label: `${p} ngày`, value: p }))}
            aria-label="Kỳ thống kê"
          />
        </div>
      </div>

      {isError ? (
        <Alert type="error" showIcon title="Không tải được số liệu. Thử tải lại trang." />
      ) : isPending ? (
        <DashboardSkeleton />
      ) : (
        <div
          aria-busy={isPlaceholderData}
          className={cn('space-y-6 transition-opacity', isPlaceholderData && 'opacity-60')}
        >
          {/* Nhãn kỳ theo số liệu đang hiện (số cũ khi đang tải kỳ mới), không theo nút vừa chọn */}
          <Overview
            data={data}
            period={isPlaceholderData ? parsePeriod(String(data.days.length)) : period}
          />
        </div>
      )}
    </div>
  )
}

/** "Kỳ này 8/9–7/10, so với 9/8–7/9" */
function compareRange({ days }: AdminOverview) {
  const first = days[0].day
  const last = days.at(-1)!.day
  const prevFirst = addDays(first, -days.length)
  const prevLast = addDays(first, -1)
  const range = (a: string, b: string) => `${formatShortDay(a)}–${formatShortDay(b)}`
  return `Kỳ này ${range(first, last)}, so với ${range(prevFirst, prevLast)}`
}

type Pick = (d: AdminOverviewDay) => number

function Overview({ data, period }: { data: AdminOverview; period: AdminPeriod }) {
  const { totals, days, current, previous } = data
  const [content, setContent] = useState<'stories' | 'chapters'>('chapters')
  const [community, setCommunity] = useState<'comments' | 'follows'>('comments')
  const [genreMetric, setGenreMetric] = useState<'views' | 'stories'>('views')

  const series = (pick: Pick) => days.map((d) => ({ day: d.day, value: pick(d) }))
  const rows = (pick: Pick) =>
    days.map((d) => ({ key: d.day, label: formatShortDay(d.day), values: [pick(d)] }))
  const compareLabel = `so với ${period} ngày trước`
  const kpi = (key: keyof AdminOverview['current'], title: string, hero = false) => (
    <KpiTile
      title={title}
      value={current[key]}
      delta={periodDelta(current[key], previous[key])}
      compareLabel={compareLabel}
      spark={days.map((d) => d[key])}
      hero={hero}
    />
  )

  const pickContent: Pick = (d) => (content === 'stories' ? d.stories : d.chapters)
  const contentName = content === 'stories' ? 'Truyện mới' : 'Chương mới xuất bản'
  const pickCommunity: Pick = (d) => (community === 'comments' ? d.comments : d.follows)
  const communityName = community === 'comments' ? 'Bình luận mới' : 'Lượt theo dõi mới'
  const genreRows =
    genreMetric === 'views'
      ? data.genreViews.map((g) => ({ label: g.name, value: g.views }))
      : data.genres.map((g) => ({ label: g.name, value: g.stories }))
  const genreName = genreMetric === 'views' ? 'Lượt đọc trong kỳ' : 'Số truyện'

  return (
    <>
      <AttentionPanel
        items={[
          {
            key: 'reviews',
            title: 'Truyện chờ duyệt',
            count: totals.pendingReviews,
            to: paths.adminReviews,
            actionLabel: 'Mở hàng chờ',
          },
          {
            key: 'reports',
            title: 'Báo lỗi đang mở',
            count: totals.openReports,
            to: paths.adminReports,
            actionLabel: 'Xem báo lỗi',
          },
          {
            key: 'comments',
            title: 'Bình luận bị báo cáo',
            count: totals.reportedComments,
            to: paths.adminComments,
            actionLabel: 'Mở kiểm duyệt',
          },
          {
            key: 'inbox',
            title: 'Tin nhắn chưa xử lý',
            count: totals.unhandledMessages,
            to: paths.adminInbox,
            actionLabel: 'Mở hộp thư',
          },
        ]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          {kpi('views', 'Lượt đọc trong kỳ', true)}
        </Col>
        <Col xs={24} lg={14}>
          <Row gutter={[16, 16]} className="h-full">
            <Col xs={12}>{kpi('signups', 'Người dùng mới')}</Col>
            <Col xs={12}>{kpi('comments', 'Bình luận mới')}</Col>
            <Col xs={12}>{kpi('follows', 'Lượt theo dõi mới')}</Col>
            <Col xs={12}>{kpi('chapters', 'Chương mới')}</Col>
          </Row>
        </Col>
      </Row>

      <Section title="Người đọc">
        <Col xs={24} xl={15}>
          <ChartCard
            title={`Lượt đọc · ${period} ngày`}
            valueLabels={['Kỳ này', 'Kỳ trước']}
            rows={days.map((d) => ({
              key: d.day,
              label: formatShortDay(d.day),
              values: [d.views, d.viewsPrev],
            }))}
          >
            <ComparisonLine
              data={days.map((d) => ({
                day: d.day,
                prevDay: addDays(d.day, -period),
                current: d.views,
                previous: d.viewsPrev,
              }))}
              currentName="Kỳ này"
              previousName="Kỳ trước"
            />
          </ChartCard>
        </Col>
        <Col xs={24} xl={9}>
          <ChartCard
            title="Lịch đọc · 12 tuần"
            valueLabels={['Lượt đọc']}
            rows={data.calendar.map((d) => ({
              key: d.day,
              label: formatShortDay(d.day),
              values: [d.views],
            }))}
            emptyText="Chưa có lượt đọc nào trong 12 tuần qua"
          >
            <ViewsCalendar data={data.calendar} />
          </ChartCard>
        </Col>
      </Section>

      <Section title="Cộng đồng & nội dung">
        <Col xs={24} lg={12}>
          <ChartCard
            title={`${communityName} · ${period} ngày`}
            valueLabels={[communityName]}
            rows={rows(pickCommunity)}
            toolbar={
              <Segmented
                size="small"
                value={community}
                onChange={setCommunity}
                options={[
                  { label: 'Bình luận', value: 'comments' },
                  { label: 'Theo dõi', value: 'follows' },
                ]}
                aria-label="Loại hoạt động cộng đồng"
              />
            }
          >
            <DailyColumns data={series(pickCommunity)} name={communityName} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title={`${contentName} · ${period} ngày`}
            valueLabels={[contentName]}
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
            title={`Người dùng mới · ${period} ngày`}
            valueLabels={['Người dùng mới']}
            rows={rows((d) => d.signups)}
          >
            <DailyLine data={series((d) => d.signups)} name="Người dùng mới" />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard
            title="Thể loại"
            valueLabels={[genreName]}
            rows={genreRows.map((g) => ({ key: g.label, label: g.label, values: [g.value] }))}
            emptyText={
              genreMetric === 'views'
                ? 'Chưa có lượt đọc trong kỳ này'
                : 'Chưa có truyện công khai nào'
            }
            toolbar={
              <div className="space-y-1">
                <Segmented
                  size="small"
                  value={genreMetric}
                  onChange={setGenreMetric}
                  options={[
                    { label: 'Lượt đọc trong kỳ', value: 'views' },
                    { label: 'Số truyện', value: 'stories' },
                  ]}
                  aria-label="Số liệu theo thể loại"
                />
                {genreMetric === 'views' && (
                  <p className="text-xs text-muted-foreground">
                    Truyện nhiều thể loại được tính vào từng thể loại.
                  </p>
                )}
              </div>
            }
          >
            <CategoryBars data={genreRows} name={genreName} />
          </ChartCard>
        </Col>
      </Section>

      <Section title="Bảng xếp hạng">
        {/* Hai bảng nhiều cột: chỉ đặt cạnh nhau ở màn rất rộng */}
        <Col xs={24} xxl={14}>
          <TopStoriesTable stories={data.topStories} />
        </Col>
        <Col xs={24} xxl={10}>
          <TopAuthorsTable authors={data.topAuthors} period={period} />
        </Col>
      </Section>

      <Card title="Toàn hệ thống" size="small">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StockStat
            title="Người dùng"
            value={totals.users}
            hint={`+${number.format(totals.newUsers)} trong kỳ`}
          />
          <StockStat
            title="Truyện công khai"
            value={totals.publishedStories}
            hint={`${number.format(totals.draftStories)} bản nháp`}
          />
          <StockStat title="Chương đã xuất bản" value={totals.publishedChapters} />
          <StockStat title="Lượt đọc toàn thời gian" value={totals.views} />
          <StockStat
            title="Tài khoản bị khóa"
            value={totals.bannedUsers}
            hint="Xem người dùng"
            to={paths.adminUsers}
          />
        </div>
      </Card>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <Row gutter={[16, 16]}>{children}</Row>
    </section>
  )
}

function StockStat({
  title,
  value,
  hint,
  to,
}: {
  title: string
  value: number
  hint?: string
  to?: string
}) {
  return (
    <div>
      <Statistic title={title} value={value} formatter={(v) => number.format(Number(v))} />
      {to ? (
        <Link to={to} className="mt-1 inline-block text-xs">
          {hint} →
        </Link>
      ) : (
        hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
