import { Alert, App, Button, Card, Form, Input, Table } from 'antd'
import { SITE_NAME } from '@/config/site'
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  type AdminAuditEntry,
  adminErrorMessage,
  type AnnouncementInput,
  auditDetailText,
  isInternalLink,
} from '@/features/admin/api'
import { TableEmpty } from '@/features/admin/components/TableEmpty'
import { readTableParams, tablePagination } from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminAuditLog, useAdminUsers, useSendAdminAnnouncement } from '@/features/admin/hooks'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'
import { formatDate, formatRelativeTime } from '@/lib/format'

const number = new Intl.NumberFormat('vi-VN')
const EMPTY: AnnouncementInput = { title: '', body: '', link: '' }

export default function AdminAnnouncementsPage() {
  const [form] = Form.useForm<AnnouncementInput>()
  const { message, modal } = App.useApp()
  const send = useSendAdminAnnouncement()
  // Số người sẽ nhận = số tài khoản (chỉ lấy tổng)
  const { data: users } = useAdminUsers({ page: 1, pageSize: 10 })
  const values = Form.useWatch([], form) ?? EMPTY

  const doSend = (input: AnnouncementInput) =>
    send.mutate(input, {
      onSuccess: (count) => {
        void message.success(`Đã gửi thông báo cho ${number.format(count)} người.`)
        form.resetFields()
      },
      onError: (error) => void message.error(adminErrorMessage(error)),
    })

  // Kiểm tra form trước, rồi mới hỏi xác nhận (nêu rõ số người nhận)
  const onSend = async () => {
    let input: AnnouncementInput
    try {
      input = await form.validateFields()
    } catch {
      return
    }
    modal.confirm({
      title: `Gửi cho ${users ? number.format(users.total) : 'mọi'} người?`,
      content: 'Thông báo gửi đi không thu hồi được.',
      okText: 'Gửi',
      cancelText: 'Hủy',
      onOk: () =>
        doSend({ title: input.title ?? '', body: input.body ?? '', link: input.link ?? '' }),
    })
  }

  return (
    <div className="space-y-6">
      <title>{`Thông báo chung · Quản trị | ${SITE_NAME}`}</title>
      <h1 className="font-heading text-3xl font-semibold">Thông báo chung</h1>
      <p className="text-sm text-muted-foreground">
        Gửi một tin tới hộp thông báo của mọi tài khoản (bảo trì, đổi quy định...). Thông báo đã gửi
        không thu hồi hay sửa được; người nhận tự xóa dòng của mình. Mỗi lần gửi được ghi vào nhật
        ký.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Soạn thông báo">
          <Form form={form} layout="vertical" requiredMark={false} initialValues={EMPTY}>
            <Form.Item
              name="title"
              label="Tiêu đề"
              rules={[
                { required: true, whitespace: true, message: 'Nhập tiêu đề.' },
                { max: ANNOUNCEMENT_TITLE_MAX, message: `Tối đa ${ANNOUNCEMENT_TITLE_MAX} ký tự.` },
              ]}
            >
              <Input maxLength={ANNOUNCEMENT_TITLE_MAX + 20} showCount />
            </Form.Item>
            <Form.Item
              name="body"
              label="Nội dung (không bắt buộc)"
              rules={[
                { max: ANNOUNCEMENT_BODY_MAX, message: `Tối đa ${ANNOUNCEMENT_BODY_MAX} ký tự.` },
              ]}
            >
              <Input.TextArea rows={4} maxLength={ANNOUNCEMENT_BODY_MAX + 20} showCount />
            </Form.Item>
            <Form.Item
              name="link"
              label="Đường dẫn khi bấm vào (không bắt buộc)"
              extra="Đường dẫn trong web, bắt đầu bằng /, vd /about hoặc /ranking."
              rules={[
                {
                  validator: (_, value: string | undefined) =>
                    isInternalLink((value ?? '').trim())
                      ? Promise.resolve()
                      : Promise.reject(new Error('Chỉ nhận đường dẫn trong web, bắt đầu bằng /.')),
                },
              ]}
            >
              <Input placeholder="/about" />
            </Form.Item>
            <Button type="primary" loading={send.isPending} onClick={() => void onSend()}>
              Gửi thông báo
            </Button>
          </Form>
        </Card>
        <Card title="Xem trước">
          <p className="mb-3 text-sm text-muted-foreground">
            Người nhận sẽ thấy dòng này trong hộp thông báo.
          </p>
          <ul className="rounded-2xl border p-2">
            <NotificationItem
              notification={{
                id: 'preview',
                type: 'announcement',
                title: values.title?.trim() || 'Tiêu đề thông báo',
                body: values.body?.trim() ?? '',
                link: null,
                createdAt: new Date().toISOString(),
                read: false,
              }}
            />
          </ul>
        </Card>
      </div>
      <SentHistory />
    </div>
  )
}

/** Các lần đã gửi: đọc từ nhật ký admin (nhóm `announcement`) */
function SentHistory() {
  const { params, page, update } = useFilterParams()
  const { pageSize } = readTableParams(params, [])
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminAuditLog({
    group: 'announcement',
    page,
    pageSize,
  })

  return (
    <Card title="Đã gửi">
      {isError ? (
        <Alert type="error" showIcon title="Không tải được danh sách đã gửi." />
      ) : (
        <Table<AdminAuditEntry>
          rowKey="id"
          loading={isPending || isFetching}
          dataSource={data?.items}
          scroll={{ x: 700 }}
          locale={{
            emptyText: (
              <TableEmpty loading={isPending || isPlaceholderData}>
                Chưa gửi thông báo chung nào
              </TableEmpty>
            ),
          }}
          pagination={tablePagination(data, page, pageSize, update)}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              width: 140,
              render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
            },
            { title: 'Tiêu đề', dataIndex: 'targetLabel', width: 240, ellipsis: true },
            {
              title: 'Người gửi',
              dataIndex: 'actorName',
              width: 160,
              ellipsis: true,
            },
            {
              title: 'Chi tiết',
              key: 'detail',
              render: (_, e) => auditDetailText(e) || '–',
            },
          ]}
        />
      )}
    </Card>
  )
}
