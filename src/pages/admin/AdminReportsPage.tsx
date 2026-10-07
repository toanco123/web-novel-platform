import { Alert, App, Button, Card, Grid, Input, Segmented, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { type AdminReport, type AdminReportQuery } from '@/features/admin/api'
import { TableEmpty } from '@/features/admin/components/TableEmpty'
import { ClearFilters, FilterSelect } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminReports, useSetAdminReportStatus } from '@/features/admin/hooks'
import { reportReasons } from '@/features/feedback/schemas'
import { formatDate, formatRelativeTime } from '@/lib/format'
import type { ReportReason } from '@/types/report'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const STATUSES: AdminReportQuery['status'][] = ['open', 'resolved', 'all']
const reasonLabel = (reason: string) =>
  reportReasons.find((r) => r.value === reason)?.label ?? reason
// Bảng này chỉ sắp theo lúc báo
const SORTS = ['created'] as const

export default function AdminReportsPage() {
  const { params, page, update } = useFilterParams()
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  const status = STATUSES.find((s) => s === params.get('status')) ?? 'open'
  const reason = reportReasons.find((r) => r.value === params.get('reason'))?.value
  const q = params.get('q') ?? ''
  const { order, pageSize } = readTableParams(params, SORTS)
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminReports({
    status,
    reason,
    q,
    order,
    page,
    pageSize,
  })
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            value={status}
            onChange={(value) => update({ status: value === 'open' ? null : value })}
            options={[
              { label: 'Đang mở', value: 'open' },
              { label: 'Đã sửa', value: 'resolved' },
              { label: 'Tất cả', value: 'all' },
            ]}
            aria-label="Lọc báo lỗi"
          />
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo truyện, ghi chú, người báo"
            aria-label="Tìm báo lỗi"
            allowClear
            className="max-w-xs"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <FilterSelect<ReportReason>
            label="Lý do"
            value={reason}
            onChange={(value) => update({ reason: value })}
            className="w-56"
            options={reportReasons}
          />
          <ClearFilters params={params} keys={['q', 'reason']} update={update} />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được báo lỗi." />
        ) : (
          <Table<AdminReport>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1100 }}
            locale={{
              emptyText: (
                <TableEmpty loading={isPending || isPlaceholderData}>
                  {q || reason
                    ? 'Không có báo lỗi nào khớp bộ lọc'
                    : status === 'open'
                      ? 'Không có báo lỗi nào đang mở'
                      : 'Chưa có báo lỗi'}
                </TableEmpty>
              ),
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Truyện · chương',
                key: 'target',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 220 : 180,
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
                width: 210,
                render: (reason: string) => (
                  <Tag color={reason === 'violation' ? 'red' : undefined}>
                    {reasonLabel(reason)}
                  </Tag>
                ),
              },
              {
                title: 'Ghi chú',
                dataIndex: 'note',
                width: 230,
                render: (note: string) =>
                  note ? <span className="whitespace-pre-line">{note}</span> : '–',
              },
              {
                title: 'Người báo',
                key: 'reporter',
                width: 140,
                ellipsis: true,
                render: (_, r) => r.reporter.displayName,
              },
              {
                title: 'Lúc báo',
                dataIndex: 'createdAt',
                ...sortable('created', { sort: 'created', order }),
                width: 130,
                render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
              },
              {
                title: 'Trạng thái',
                key: 'status',
                width: 170,
                fixed: pinActions ? 'right' : undefined,
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
