import { Alert, App, Button, Card, Grid, Segmented, Table, Tag, Typography } from 'antd'
import { SITE_NAME } from '@/config/site'
import {
  ADMIN_PAGE_SIZE,
  type AdminContactMessage,
  type AdminMessageStatus,
} from '@/features/admin/api'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminMessages, useSetMessageHandled } from '@/features/admin/hooks'
import { contactTopics } from '@/features/feedback/schemas'
import { formatDate, formatRelativeTime } from '@/lib/format'

const number = new Intl.NumberFormat('vi-VN')
const STATUSES: AdminMessageStatus[] = ['open', 'handled', 'all']
const topicLabel = (topic: string) => contactTopics.find((t) => t.value === topic)?.label ?? topic

export default function AdminInboxPage() {
  const { params, page, update } = useFilterParams()
  const pinFirst = Grid.useBreakpoint().md ?? false
  const status = STATUSES.find((s) => s === params.get('status')) ?? 'open'
  const { data, isPending, isFetching, isError } = useAdminMessages({ status, page })
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
        <Segmented
          className="mb-4"
          value={status}
          onChange={(value) => update({ status: value === 'open' ? null : value })}
          options={[
            { label: 'Chưa xử lý', value: 'open' },
            { label: 'Đã xử lý', value: 'handled' },
            { label: 'Tất cả', value: 'all' },
          ]}
          aria-label="Lọc tin nhắn"
        />
        {isError ? (
          <Alert type="error" showIcon title="Không tải được hộp thư." />
        ) : (
          <Table<AdminContactMessage>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 900 }}
            locale={{
              emptyText:
                status === 'open' ? 'Không còn tin nhắn nào cần xử lý' : 'Chưa có tin nhắn',
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
                title: 'Người gửi',
                key: 'sender',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 220 : 170,
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
                className: 'whitespace-nowrap',
                render: (topic: string) => <Tag>{topicLabel(topic)}</Tag>,
              },
              {
                title: 'Nội dung',
                dataIndex: 'message',
                width: 380,
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
                className: 'whitespace-nowrap',
                render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
              },
              {
                title: 'Trạng thái',
                key: 'status',
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
