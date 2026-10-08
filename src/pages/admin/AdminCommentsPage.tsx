import { Alert, App, Button, Card, Grid, Input, Popconfirm, Segmented, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  ADMIN_COMMENT_SORTS,
  type AdminComment,
  type AdminCommentQuery,
  adminErrorMessage,
} from '@/features/admin/api'
import { TableEmpty } from '@/features/admin/components/TableEmpty'
import { ClearFilters, FilterSelect } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import {
  useAdminComments,
  useDeleteAdminComment,
  useDismissCommentReports,
} from '@/features/admin/hooks'
import { commentReportReasons } from '@/features/comments/schemas'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const reasonLabel = (reason: string) =>
  commentReportReasons.find((r) => r.value === reason)?.label ?? reason
const KINDS = ['root', 'reply'] as const

export default function AdminCommentsPage() {
  const { params, page, update } = useFilterParams()
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  // Giá trị khác trên URL (?view=, ?kind=) coi như mặc định
  const view: AdminCommentQuery['view'] = params.get('view') === 'all' ? 'all' : 'reported'
  const q = params.get('q') ?? ''
  const kind = KINDS.find((k) => k === params.get('kind'))
  const { sort, order, pageSize } = readTableParams(params, ADMIN_COMMENT_SORTS)
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminComments({
    view,
    q,
    kind,
    sort,
    order,
    page,
    pageSize,
  })
  // Mặc định: bị báo cáo gần nhất trước (chế độ "Bị báo cáo"), mới viết trước (chế độ "Tất cả")
  const active = { sort: sort ?? (view === 'reported' ? 'reported' : 'created'), order }
  const dismiss = useDismissCommentReports()
  const remove = useDeleteAdminComment()
  const { message } = App.useApp()

  const onDismiss = (c: AdminComment) =>
    dismiss.mutate(c.id, {
      onSuccess: () => void message.success('Đã bỏ qua báo cáo, bình luận giữ nguyên.'),
      onError: (error) => void message.error(adminErrorMessage(error)),
    })
  const onDelete = (c: AdminComment) =>
    remove.mutate(c.id, {
      onSuccess: () => void message.success('Đã xóa bình luận.'),
      onError: (error) => void message.error(adminErrorMessage(error)),
    })

  return (
    <div className="space-y-6">
      <title>{`Bình luận · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Bình luận</h1>
        {data && (
          <p className="text-sm text-muted-foreground">{number.format(data.total)} bình luận</p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Bình luận người đọc báo cáo là vi phạm. Xóa bình luận thì các trả lời của nó cũng bị xóa; bỏ
        qua thì bình luận giữ nguyên.
      </p>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            value={view}
            onChange={(value) => update({ view: value === 'all' ? 'all' : null })}
            options={[
              { label: 'Bị báo cáo', value: 'reported' },
              { label: 'Tất cả', value: 'all' },
            ]}
            aria-label="Lọc bình luận"
          />
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo nội dung hoặc người viết"
            aria-label="Tìm bình luận"
            allowClear
            className="max-w-xs"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <FilterSelect
            label="Loại"
            value={kind}
            onChange={(value) => update({ kind: value })}
            className="w-40"
            options={[
              { value: 'root', label: 'Bình luận gốc' },
              { value: 'reply', label: 'Trả lời' },
            ]}
          />
          <ClearFilters params={params} keys={['q', 'kind']} update={update} />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được bình luận." />
        ) : (
          <Table<AdminComment>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1100 }}
            locale={{
              emptyText: (
                <TableEmpty loading={isPending || isPlaceholderData}>
                  {q || kind
                    ? 'Không có bình luận nào khớp'
                    : view === 'reported'
                      ? 'Không có bình luận nào đang bị báo cáo'
                      : 'Chưa có bình luận'}
                </TableEmpty>
              ),
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Bình luận',
                key: 'content',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 270 : 220,
                render: (_, c) => (
                  <div className="min-w-0">
                    <p className="break-words whitespace-pre-line">{c.content}</p>
                    {c.editedAt && (
                      <p
                        className="mt-1 text-xs text-muted-foreground"
                        title={`Sửa lúc ${formatDate(c.editedAt)}`}
                      >
                        (đã sửa)
                      </p>
                    )}
                    {(c.isReply || c.replyCount > 0) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.isReply ? 'Là một trả lời' : `${number.format(c.replyCount)} trả lời`}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                title: 'Người viết',
                key: 'author',
                width: 150,
                render: (_, c) => (
                  <Link
                    to={paths.adminUserSearch(c.author.displayName)}
                    title={c.author.displayName}
                    className="block truncate"
                  >
                    {c.author.displayName}
                  </Link>
                ),
              },
              {
                title: 'Truyện · chương',
                key: 'target',
                width: 170,
                render: (_, c) =>
                  c.storyPublished ? (
                    <div>
                      <Link to={paths.story(c.storySlug)} className="font-medium">
                        {c.storyTitle}
                      </Link>
                      {c.chapterNumber !== null && (
                        <p className="text-xs">
                          <Link to={paths.chapter(c.storySlug, c.chapterNumber)}>
                            Chương {c.chapterNumber}
                          </Link>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">{c.storyTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.chapterNumber !== null && `Chương ${c.chapterNumber} · `}truyện đang ẩn
                      </p>
                    </div>
                  ),
              },
              {
                title: 'Lúc viết',
                ...sortable('created', active),
                width: 130,
                dataIndex: 'createdAt',
                render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
              },
              {
                title: 'Báo cáo',
                ...sortable('reported', active),
                width: 230,
                render: (_, c) =>
                  c.reports.length === 0 ? (
                    '–'
                  ) : (
                    <ul className="space-y-2">
                      {c.reports.map((r, i) => (
                        <li key={i}>
                          <Tag color={r.reason === 'offensive' ? 'red' : 'orange'}>
                            {reasonLabel(r.reason)}
                          </Tag>
                          {r.note && <p className="mt-1 whitespace-pre-line">{r.note}</p>}
                          <p className="text-xs text-muted-foreground">
                            {r.reporterName} · {formatRelativeTime(r.createdAt)}
                          </p>
                          {/* Bình luận đã sửa sau khi bị báo cáo: cho xem bản bị báo cáo */}
                          {r.contentSnapshot !== null && r.contentSnapshot !== c.content && (
                            <div className="mt-1.5 border-l-2 pl-2 text-xs text-muted-foreground">
                              <p className="font-medium">Nội dung lúc bị báo cáo</p>
                              <p className="break-words whitespace-pre-line">{r.contentSnapshot}</p>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 150,
                fixed: pinActions ? 'right' : undefined,
                className: 'whitespace-nowrap',
                render: (_, c) => (
                  <div className="flex items-center gap-2">
                    {c.reports.length > 0 && (
                      <Button
                        size="small"
                        loading={dismiss.isPending && dismiss.variables === c.id}
                        onClick={() => onDismiss(c)}
                      >
                        Bỏ qua
                      </Button>
                    )}
                    <Popconfirm
                      title="Xóa bình luận này?"
                      description={
                        c.replyCount > 0
                          ? `${number.format(c.replyCount)} trả lời của bình luận này cũng bị xóa.`
                          : 'Bình luận bị xóa vĩnh viễn, không khôi phục được.'
                      }
                      okText="Xóa"
                      okButtonProps={{ danger: true }}
                      cancelText="Hủy"
                      onConfirm={() => onDelete(c)}
                    >
                      <Button
                        size="small"
                        danger
                        loading={remove.isPending && remove.variables === c.id}
                      >
                        Xóa
                      </Button>
                    </Popconfirm>
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
