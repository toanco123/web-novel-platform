import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { ADMIN_STORY_SORTS, type AdminStory, adminErrorMessage } from '@/features/admin/api'
import { ClearFilters, FilterSelect } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminStories, useSetStoryTakedown } from '@/features/admin/hooks'
import { formatDate } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { StoryStatus, StoryVisibility } from '@/types/story'

const number = new Intl.NumberFormat('vi-VN')

// Giá trị hợp lệ trên URL (?visibility=, ?status=); giá trị khác coi như không lọc
const VISIBILITIES = ['published', 'draft', 'takedown'] as const
const STATUSES: StoryStatus[] = ['ongoing', 'completed']
const pick = <T extends string>(options: readonly T[], value: string | null) =>
  options.find((o) => o === value)

export default function AdminStoriesPage() {
  const { params, page, update } = useFilterParams()
  // Màn hẹp không ghim cột đầu, nếu không nó chiếm hết chiều ngang và che các cột khác
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  const q = params.get('q') ?? ''
  const visibility = pick(VISIBILITIES, params.get('visibility'))
  const status = pick(STATUSES, params.get('status'))
  const hasReports = params.get('reports') === 'open'
  const ownerId = params.get('owner') ?? undefined
  const { sort, order, pageSize } = readTableParams(params, ADMIN_STORY_SORTS)
  const { data, isPending, isFetching, isError } = useAdminStories({
    q,
    visibility,
    status,
    hasReports,
    ownerId,
    sort,
    order,
    page,
    pageSize,
  })
  // Mặc định: mới cập nhật trước
  const active = { sort: sort ?? ('updated' as const), order }
  const ownerName = ownerId && data?.items[0]?.ownerName
  const takedown = useSetStoryTakedown()
  const { message } = App.useApp()
  // Truyện đang mở hộp thoại gỡ và lý do đang nhập
  const [removing, setRemoving] = useState<AdminStory | null>(null)
  const [reason, setReason] = useState('')

  const submitTakedown = (story: AdminStory, text: string | null) =>
    takedown.mutate(
      { storyId: story.id, reason: text },
      {
        onSuccess: () => {
          setRemoving(null)
          void message.success(
            text ? `Đã gỡ "${story.title}".` : `Đã khôi phục "${story.title}" (vẫn là nháp).`,
          )
        },
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Truyện · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Truyện</h1>
        {data && (
          <p className="text-sm text-muted-foreground">{number.format(data.total)} truyện</p>
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
            value={visibility ?? ''}
            onChange={(value) => update({ visibility: value })}
            options={[
              { label: 'Tất cả', value: '' },
              { label: 'Công khai', value: 'published' },
              { label: 'Nháp', value: 'draft' },
              { label: 'Bị gỡ', value: 'takedown' },
            ]}
            aria-label="Lọc theo hiển thị"
          />
          <FilterSelect
            label="Tiến độ"
            value={status}
            onChange={(value) => update({ status: value })}
            className="w-36"
            options={[
              { value: 'ongoing', label: 'Đang ra' },
              { value: 'completed', label: 'Hoàn thành' },
            ]}
          />
          <Checkbox
            checked={hasReports}
            onChange={(e) => update({ reports: e.target.checked ? 'open' : null })}
          >
            Có báo lỗi đang mở
          </Checkbox>
          {ownerId && (
            <Tag closable onClose={() => update({ owner: null })} closeIcon aria-live="polite">
              Tác giả: {ownerName || 'đã chọn'}
            </Tag>
          )}
          <ClearFilters
            params={params}
            keys={['q', 'visibility', 'status', 'reports', 'owner']}
            update={update}
          />
        </div>

        {isError ? (
          <Alert type="error" showIcon title="Không tải được danh sách truyện." />
        ) : (
          <Table<AdminStory>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1640 }}
            locale={{ emptyText: 'Không có truyện nào khớp bộ lọc' }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Truyện',
                ...sortable('title', active),
                dataIndex: 'title',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 260 : 180,
                render: (title: string, s) =>
                  s.visibility === 'published' && s.publishedCount > 0 ? (
                    <Link to={paths.story(s.slug)} className="font-medium">
                      {title}
                    </Link>
                  ) : (
                    <span className="font-medium">{title}</span>
                  ),
              },
              {
                title: 'Tác giả',
                width: 160,
                dataIndex: 'ownerName',
                render: (name: string, s) =>
                  s.ownerId ? (
                    <Link
                      to={paths.adminStories(s.ownerId)}
                      title={name}
                      className="block truncate"
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  ),
              },
              {
                title: 'Hiển thị',
                width: 110,
                dataIndex: 'visibility',
                render: (v: StoryVisibility, s) =>
                  s.takedown ? (
                    <Tooltip title={`Lý do: ${s.takedown.reason}`}>
                      <Tag color="red">Bị gỡ</Tag>
                    </Tooltip>
                  ) : v === 'published' ? (
                    <Tag color="green">Công khai</Tag>
                  ) : (
                    <Tag>Nháp</Tag>
                  ),
              },
              {
                title: 'Tiến độ',
                width: 115,
                dataIndex: 'status',
                render: (v: AdminStory['status']) => (v === 'completed' ? 'Hoàn thành' : 'Đang ra'),
              },
              {
                title: 'Chương',
                ...sortable('chapters', active),
                width: 115,
                align: 'right',
                render: (_, s) => (
                  <span title="Đã xuất bản / tổng số chương">
                    {number.format(s.publishedCount)}/{number.format(s.chapterCount)}
                  </span>
                ),
              },
              {
                title: 'Lượt đọc',
                ...sortable('views', active),
                width: 125,
                dataIndex: 'views',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Theo dõi',
                ...sortable('followers', active),
                width: 120,
                dataIndex: 'followers',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Đánh giá',
                ...sortable('rating', active),
                width: 135,
                align: 'right',
                render: (_, s) =>
                  s.ratingCount
                    ? `${s.ratingAvg.toFixed(1)} (${number.format(s.ratingCount)})`
                    : '–',
              },
              {
                title: 'Bình luận',
                ...sortable('comments', active),
                width: 125,
                dataIndex: 'comments',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Báo lỗi mở',
                ...sortable('reports', active),
                width: 135,
                dataIndex: 'openReports',
                align: 'right',
                render: (n: number) => (n > 0 ? <Tag color="orange">{n}</Tag> : 0),
              },
              {
                title: 'Ngày tạo',
                ...sortable('created', active),
                width: 125,
                dataIndex: 'createdAt',
                render: (v: string) => formatDate(v),
              },
              {
                title: 'Cập nhật',
                ...sortable('updated', active),
                width: 125,
                dataIndex: 'updatedAt',
                render: (v: string) => formatDate(v),
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 120,
                fixed: pinActions ? 'right' : undefined,
                className: 'whitespace-nowrap',
                // Truyện có sẵn của bản giả (không có chủ) không gỡ được
                render: (_, s) =>
                  !s.ownerId ? null : s.takedown ? (
                    <Popconfirm
                      title={`Khôi phục "${s.title}"?`}
                      description="Truyện vẫn là nháp; tác giả tự xuất bản lại."
                      okText="Khôi phục"
                      cancelText="Hủy"
                      onConfirm={() => submitTakedown(s, null)}
                    >
                      <Button
                        size="small"
                        loading={takedown.isPending && takedown.variables?.storyId === s.id}
                      >
                        Khôi phục
                      </Button>
                    </Popconfirm>
                  ) : (
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setReason('')
                        setRemoving(s)
                      }}
                    >
                      Gỡ
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!removing}
        title={removing && `Gỡ truyện "${removing.title}"`}
        okText="Gỡ truyện"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: takedown.isPending }}
        cancelText="Hủy"
        onOk={() => removing && submitTakedown(removing, reason)}
        onCancel={() => setRemoving(null)}
        destroyOnHidden
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Truyện về nháp và tác giả không tự công khai lại được cho tới khi bạn khôi phục. Tác giả
          thấy lý do này trong khu Sáng tác.
        </p>
        <label htmlFor="takedown-reason" className="mb-1 block text-sm font-medium">
          Lý do gỡ
        </label>
        <Input.TextArea
          id="takedown-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          showCount
          autoSize={{ minRows: 3 }}
          placeholder="Ví dụ: Đăng lại truyện của tác giả khác khi chưa được phép."
        />
      </Modal>
    </div>
  )
}
