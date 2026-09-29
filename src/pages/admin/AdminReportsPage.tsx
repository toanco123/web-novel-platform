import { Alert, App, Button, Card, Grid, Segmented, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { ADMIN_PAGE_SIZE, type AdminReport, type AdminReportQuery } from '@/features/admin/api'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminReports, useSetAdminReportStatus } from '@/features/admin/hooks'
import { reportReasons } from '@/features/feedback/schemas'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const STATUSES: AdminReportQuery['status'][] = ['open', 'resolved', 'all']
const reasonLabel = (reason: string) =>
  reportReasons.find((r) => r.value === reason)?.label ?? reason

export default function AdminReportsPage() {
  const { params, page, update } = useFilterParams()
  const pinFirst = Grid.useBreakpoint().md ?? false
  const status = STATUSES.find((s) => s === params.get('status')) ?? 'open'
  const { data, isPending, isFetching, isError } = useAdminReports({ status, page })
  const setStatus = useSetAdminReportStatus()
  const { message } = App.useApp()

  const toggle = (r: AdminReport) =>
    setStatus.mutate(
      { id: r.id, status: r.status === 'open' ? 'resolved' : 'open' },
      {
        onSuccess: () =>
          void message.success(r.status === 'open' ? 'Đã đánh dấu đã sửa.' : 'Đã mở lại báo lỗi.'),
        onError: () => void message.error('Chưa lưu được. Thử lại nhé.'),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Báo lỗi · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Báo lỗi chương</h1>
        {data && (
          <p className="text-sm text-muted-foreground">{number.format(data.total)} báo lỗi</p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Báo lỗi của mọi truyện. Tác giả cũng thấy báo lỗi của truyện mình trong khu Sáng tác.
      </p>

      <Card>
        <Segmented
          className="mb-4"
          value={status}
          onChange={(value) => update({ status: value === 'open' ? null : value })}
          options={[
            { label: 'Đang mở', value: 'open' },
            { label: 'Đã sửa', value: 'resolved' },
            { label: 'Tất cả', value: 'all' },
          ]}
          aria-label="Lọc báo lỗi"
        />
        {isError ? (
          <Alert type="error" showIcon title="Không tải được báo lỗi." />
        ) : (
          <Table<AdminReport>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 960 }}
            locale={{
              emptyText: status === 'open' ? 'Không có báo lỗi nào đang mở' : 'Chưa có báo lỗi',
            }}
            pagination={{
              current: data?.page ?? page,
              total: data?.total ?? 0,
              pageSize: ADMIN_PAGE_SIZE,
              showSizeChanger: false,
              hideOnSinglePage: true,
              onChange: (p) => update({ page: String(p) }),
            }}
            columns={[
              {
                title: 'Truyện · chương',
                key: 'target',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 260 : 180,
                render: (_, r) => {
                  const chapter = `Chương ${r.chapterNumber}${r.chapterTitle ? `: ${r.chapterTitle}` : ''}`
                  return (
                    <div className="min-w-0">
                      <p className="font-medium">{r.storyTitle}</p>
                      {r.storyPublished ? (
                        <Link to={paths.chapter(r.storySlug, r.chapterNumber)} className="text-xs">
                          {chapter}
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">{chapter} (truyện đang ẩn)</p>
                      )}
                    </div>
                  )
                },
              },
              {
                title: 'Lý do',
                dataIndex: 'reason',
                className: 'whitespace-nowrap',
                render: (reason: string) => (
                  <Tag color={reason === 'violation' ? 'red' : undefined}>
                    {reasonLabel(reason)}
                  </Tag>
                ),
              },
              {
                title: 'Ghi chú',
                dataIndex: 'note',
                width: 280,
                render: (note: string) =>
                  note ? <span className="whitespace-pre-line">{note}</span> : '–',
              },
              {
                title: 'Người báo',
                key: 'reporter',
                className: 'whitespace-nowrap',
                render: (_, r) => r.reporter.displayName,
              },
              {
                title: 'Lúc báo',
                dataIndex: 'createdAt',
                className: 'whitespace-nowrap',
                render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
              },
              {
                title: 'Trạng thái',
                key: 'status',
                className: 'whitespace-nowrap',
                render: (_, r) => (
                  <div className="flex items-center gap-2">
                    {r.status === 'open' ? (
                      <Tag color="orange">Đang mở</Tag>
                    ) : (
                      <Tag color="green">Đã sửa</Tag>
                    )}
                    <Button
                      size="small"
                      loading={setStatus.isPending && setStatus.variables?.id === r.id}
                      onClick={() => toggle(r)}
                    >
                      {r.status === 'open' ? 'Đã sửa' : 'Mở lại'}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
