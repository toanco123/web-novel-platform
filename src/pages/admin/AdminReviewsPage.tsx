import { Alert, App, Button, Card, Grid, Input, Modal, Popconfirm, Segmented, Table } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { type AdminStory, adminErrorMessage, REVIEW_REASON_MAX } from '@/features/admin/api'
import { ClearFilters } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminStories, useReviewStory } from '@/features/admin/hooks'
import { useGenres } from '@/features/genres/hooks'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
// Cột sắp xếp được của hàng chờ (giá trị ?sort= trên URL)
const SORTS = ['submitted', 'title'] as const

/** Hàng chờ duyệt truyện: truyện tác giả gửi duyệt (?status=rejected: truyện đã bị từ chối) */
export default function AdminReviewsPage() {
  const { params, page, update } = useFilterParams()
  // Màn hẹp không ghim cột đầu, nếu không nó chiếm hết chiều ngang và che các cột khác
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  const q = params.get('q') ?? ''
  const status = params.get('status') === 'rejected' ? 'rejected' : 'pending'
  const { sort, order, pageSize } = readTableParams(params, SORTS)
  // Mặc định: gửi trước xếp trước (hàng chờ); không ghi lên URL
  const active = sort ? { sort, order } : { sort: 'submitted' as const, order: 'asc' as const }
  const { data, isPending, isFetching, isError } = useAdminStories({
    q,
    review: status,
    sort: active.sort,
    order: active.order,
    page,
    pageSize,
  })
  const genres = useGenres()
  const genreName = (slug: string) => genres.data?.find((g) => g.slug === slug)?.name ?? slug
  const review = useReviewStory()
  const { message } = App.useApp()
  // Truyện đang mở hộp thoại từ chối và lý do đang nhập
  const [rejecting, setRejecting] = useState<AdminStory | null>(null)
  const [reason, setReason] = useState('')

  const decide = (story: AdminStory, approve: boolean, text?: string) =>
    review.mutate(
      { storyId: story.id, approve, reason: text },
      {
        onSuccess: () => {
          setRejecting(null)
          void message.success(
            approve
              ? `Đã duyệt "${story.title}", truyện đã công khai.`
              : `Đã từ chối "${story.title}".`,
          )
        },
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Duyệt truyện · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Duyệt truyện</h1>
        {data && (
          <p className="text-sm text-muted-foreground">
            {number.format(data.total)} truyện {status === 'pending' ? 'chờ duyệt' : 'bị từ chối'}
          </p>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo tên truyện hoặc tác giả"
            aria-label="Tìm truyện"
            allowClear
            className="max-w-sm"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <Segmented
            value={status}
            onChange={(value) => update({ status: value === 'pending' ? null : value })}
            options={[
              { label: 'Chờ duyệt', value: 'pending' },
              { label: 'Bị từ chối', value: 'rejected' },
            ]}
            aria-label="Lọc theo trạng thái duyệt"
          />
          <ClearFilters params={params} keys={['q']} update={update} />
        </div>

        {isError ? (
          <Alert type="error" showIcon title="Không tải được hàng chờ duyệt." />
        ) : (
          <Table<AdminStory>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: status === 'pending' ? 1000 : 1230 }}
            locale={{
              emptyText:
                status === 'pending'
                  ? 'Không có truyện nào đang chờ duyệt'
                  : 'Chưa từ chối truyện nào',
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Truyện',
                ...sortable('title', active),
                dataIndex: 'title',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 260 : 200,
                render: (title: string, s) => (
                  <div className="min-w-0">
                    <strong className="block truncate font-medium" title={title}>
                      {title}
                    </strong>
                    {/* Quản trị viên chỉ đọc được truyện đang chờ duyệt (truyện bị từ chối là nháp) */}
                    {s.review?.status === 'pending' && (
                      <Link
                        to={paths.story(s.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs"
                        aria-label={`Xem trước ${title} (mở tab mới)`}
                      >
                        Xem trước ↗
                      </Link>
                    )}
                  </div>
                ),
              },
              {
                title: 'Tác giả',
                width: 180,
                render: (_, s) => (
                  <div className="min-w-0">
                    {s.ownerId ? (
                      <Link to={paths.adminStories(s.ownerId)} className="block truncate">
                        {s.ownerName}
                      </Link>
                    ) : (
                      s.ownerName
                    )}
                    {s.authorName && (
                      <span className="block truncate text-xs text-muted-foreground">
                        Bút danh: {s.authorName}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                title: 'Thể loại',
                width: 200,
                render: (_, s) => s.genreSlugs.map(genreName).join(', ') || '–',
              },
              {
                title: 'Chương',
                width: 100,
                align: 'right',
                render: (_, s) => (
                  <span title="Đã xuất bản / tổng số chương">
                    {number.format(s.publishedCount)}/{number.format(s.chapterCount)}
                  </span>
                ),
              },
              {
                title: 'Gửi lúc',
                ...sortable('submitted', active),
                // Mặc định đang tăng dần (gửi trước xếp trước): bấm thì sang giảm dần
                sortDirections: ['ascend', 'descend'],
                width: 140,
                render: (_, s) =>
                  s.review?.submittedAt ? (
                    <span title={formatDate(s.review.submittedAt)}>
                      {formatRelativeTime(s.review.submittedAt)}
                    </span>
                  ) : (
                    '–'
                  ),
              },
              ...(status === 'rejected'
                ? [
                    {
                      title: 'Lý do từ chối',
                      width: 280,
                      render: (_: unknown, s: AdminStory) => s.review?.reason,
                    },
                    {
                      title: 'Từ chối lúc',
                      width: 130,
                      render: (_: unknown, s: AdminStory) =>
                        s.review?.reviewedAt ? formatDate(s.review.reviewedAt) : '–',
                    },
                  ]
                : [
                    {
                      title: 'Thao tác',
                      key: 'actions',
                      width: 180,
                      fixed: pinActions ? ('right' as const) : undefined,
                      className: 'whitespace-nowrap',
                      render: (_: unknown, s: AdminStory) => (
                        <div className="flex gap-2">
                          <Popconfirm
                            title={`Duyệt "${s.title}"?`}
                            description="Truyện công khai ngay sau khi duyệt."
                            okText="Duyệt"
                            cancelText="Hủy"
                            onConfirm={() => decide(s, true)}
                          >
                            <Button
                              size="small"
                              type="primary"
                              loading={review.isPending && review.variables?.storyId === s.id}
                            >
                              Duyệt
                            </Button>
                          </Popconfirm>
                          <Button
                            size="small"
                            danger
                            onClick={() => {
                              setReason('')
                              setRejecting(s)
                            }}
                          >
                            Từ chối
                          </Button>
                        </div>
                      ),
                    },
                  ]),
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!rejecting}
        title={rejecting && `Từ chối truyện "${rejecting.title}"`}
        okText="Từ chối"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: review.isPending }}
        cancelText="Hủy"
        onOk={() => rejecting && decide(rejecting, false, reason)}
        onCancel={() => setRejecting(null)}
        destroyOnHidden
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Truyện vẫn là nháp. Tác giả thấy lý do này trong khu Sáng tác, sửa rồi gửi duyệt lại.
        </p>
        <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium">
          Lý do từ chối
        </label>
        <Input.TextArea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REVIEW_REASON_MAX}
          showCount
          autoSize={{ minRows: 3 }}
          placeholder="Ví dụ: Ảnh bìa có nội dung không phù hợp, đổi ảnh khác rồi gửi lại."
        />
      </Modal>
    </div>
  )
}
