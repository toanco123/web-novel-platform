import { Alert, App, Button, Card, Grid, Input, Segmented, Table, Tag, Typography } from 'antd'
import { SITE_NAME } from '@/config/site'
import { type AdminContactMessage, type AdminMessageStatus } from '@/features/admin/api'
import { ClearFilters, FilterSelect } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminMessages, useSetMessageHandled } from '@/features/admin/hooks'
import { contactTopics, type ContactTopic } from '@/features/feedback/schemas'
import { formatDate, formatRelativeTime } from '@/lib/format'

const number = new Intl.NumberFormat('vi-VN')
const STATUSES: AdminMessageStatus[] = ['open', 'handled', 'all']
const topicLabel = (topic: string) => contactTopics.find((t) => t.value === topic)?.label ?? topic
// Bảng này chỉ sắp theo lúc gửi
const SORTS = ['created'] as const

export default function AdminInboxPage() {
  const { params, page, update } = useFilterParams()
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  const status = STATUSES.find((s) => s === params.get('status')) ?? 'open'
  const topic = contactTopics.find((t) => t.value === params.get('topic'))?.value
  const q = params.get('q') ?? ''
  const { order, pageSize } = readTableParams(params, SORTS)
  const { data, isPending, isFetching, isError } = useAdminMessages({
    status,
    topic,
    q,
    order,
    page,
    pageSize,
  })
  const setHandled = useSetMessageHandled()
  const { message } = App.useApp()

  const toggle = (m: AdminContactMessage) =>
    setHandled.mutate(
      { id: m.id, handled: !m.handledAt },
      {
        onSuccess: () =>
          void message.success(m.handledAt ? 'Đã chuyển về chưa xử lý.' : 'Đã đánh dấu đã xử lý.'),
        onError: () => void message.error('Chưa lưu được. Thử lại nhé.'),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Hộp thư · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Hộp thư liên hệ</h1>
        {data && (
          <p className="text-sm text-muted-foreground">{number.format(data.total)} tin nhắn</p>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            value={status}
            onChange={(value) => update({ status: value === 'open' ? null : value })}
            options={[
              { label: 'Chưa xử lý', value: 'open' },
              { label: 'Đã xử lý', value: 'handled' },
              { label: 'Tất cả', value: 'all' },
            ]}
            aria-label="Lọc tin nhắn"
          />
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo tên, email, nội dung"
            aria-label="Tìm tin nhắn"
            allowClear
            className="max-w-xs"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <FilterSelect<ContactTopic>
            label="Chủ đề"
            value={topic}
            onChange={(value) => update({ topic: value })}
            options={contactTopics.map((t) => ({ value: t.value, label: t.label }))}
          />
          <ClearFilters params={params} keys={['q', 'topic']} update={update} />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được hộp thư." />
        ) : (
          <Table<AdminContactMessage>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1110 }}
            locale={{
              emptyText:
                q || topic
                  ? 'Không có tin nhắn nào khớp bộ lọc'
                  : status === 'open'
                    ? 'Không còn tin nhắn nào cần xử lý'
                    : 'Chưa có tin nhắn',
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Người gửi',
                key: 'sender',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 230 : 170,
                render: (_, m) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <a href={`mailto:${m.email}`} className="block truncate text-xs">
                      {m.email}
                    </a>
                  </div>
                ),
              },
              {
                title: 'Chủ đề',
                dataIndex: 'topic',
                width: 170,
                render: (topic: string) => <Tag>{topicLabel(topic)}</Tag>,
              },
              {
                title: 'Nội dung',
                dataIndex: 'message',
                width: 370,
                render: (text: string) => (
                  <Typography.Paragraph
                    className="mb-0! whitespace-pre-line"
                    ellipsis={{
                      rows: 2,
                      expandable: 'collapsible',
                      symbol: (open) => (open ? 'Thu gọn' : 'Xem thêm'),
                    }}
                  >
                    {text}
                  </Typography.Paragraph>
                ),
              },
              {
                title: 'Gửi lúc',
                dataIndex: 'createdAt',
                ...sortable('created', { sort: 'created', order }),
                width: 130,
                render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
              },
              {
                title: 'Trạng thái',
                key: 'status',
                width: 210,
                fixed: pinActions ? 'right' : undefined,
                className: 'whitespace-nowrap',
                render: (_, m) => (
                  <div className="flex items-center gap-2">
                    {m.handledAt ? (
                      <Tag color="green">Đã xử lý</Tag>
                    ) : (
                      <Tag color="orange">Chưa xử lý</Tag>
                    )}
                    <Button
                      size="small"
                      loading={setHandled.isPending && setHandled.variables?.id === m.id}
                      onClick={() => toggle(m)}
                    >
                      {m.handledAt ? 'Mở lại' : 'Đã xử lý'}
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
