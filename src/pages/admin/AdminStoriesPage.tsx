import { Alert, Card, Grid, Input, Segmented, Select, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { ADMIN_PAGE_SIZE, type AdminStory, type AdminStorySort } from '@/features/admin/api'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminStories } from '@/features/admin/hooks'
import { formatDate } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { StoryVisibility } from '@/types/story'

const number = new Intl.NumberFormat('vi-VN')

// Giá trị hợp lệ trên URL (?visibility=, ?sort=); giá trị khác coi như mặc định
const VISIBILITIES: StoryVisibility[] = ['published', 'draft']
const SORTS: AdminStorySort[] = ['views', 'created']
const pick = <T extends string>(options: T[], value: string | null) =>
  options.find((o) => o === value)

export default function AdminStoriesPage() {
  const { params, page, update } = useFilterParams()
  // Màn hẹp không ghim cột đầu, nếu không nó chiếm hết chiều ngang và che các cột khác
  const pinFirst = Grid.useBreakpoint().md ?? false
  const q = params.get('q') ?? ''
  const visibility = pick(VISIBILITIES, params.get('visibility'))
  const sort = pick(SORTS, params.get('sort'))
  const ownerId = params.get('owner') ?? undefined
  const { data, isPending, isFetching, isError } = useAdminStories({
    q,
    visibility,
    ownerId,
    sort: sort ?? 'updated',
    page,
  })
  const ownerName = ownerId && data?.items[0]?.ownerName

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
            ]}
            aria-label="Lọc theo hiển thị"
          />
          <Select
            value={sort ?? ''}
            onChange={(value) => update({ sort: value })}
            className="w-44"
            aria-label="Sắp xếp"
            options={[
              { label: 'Mới cập nhật', value: '' },
              { label: 'Nhiều lượt đọc', value: 'views' },
              { label: 'Mới tạo', value: 'created' },
            ]}
          />
          {ownerId && (
            <Tag closable onClose={() => update({ owner: null })} closeIcon aria-live="polite">
              Tác giả: {ownerName || 'đã chọn'}
            </Tag>
          )}
        </div>

        {isError ? (
          <Alert type="error" showIcon title="Không tải được danh sách truyện." />
        ) : (
          <Table<AdminStory>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1180 }}
            locale={{ emptyText: 'Không có truyện nào khớp bộ lọc' }}
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
                title: 'Truyện',
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
                className: 'whitespace-nowrap',
                dataIndex: 'ownerName',
                render: (name: string, s) =>
                  s.ownerId ? <Link to={paths.adminStories(s.ownerId)}>{name}</Link> : name,
              },
              {
                title: 'Hiển thị',
                className: 'whitespace-nowrap',
                dataIndex: 'visibility',
                render: (v: StoryVisibility) =>
                  v === 'published' ? <Tag color="green">Công khai</Tag> : <Tag>Nháp</Tag>,
              },
              {
                title: 'Tiến độ',
                className: 'whitespace-nowrap',
                dataIndex: 'status',
                render: (v: AdminStory['status']) => (v === 'completed' ? 'Hoàn thành' : 'Đang ra'),
              },
              {
                title: 'Chương',
                className: 'whitespace-nowrap',
                key: 'chapters',
                align: 'right',
                render: (_, s) => (
                  <span title="Đã xuất bản / tổng số chương">
                    {number.format(s.publishedCount)}/{number.format(s.chapterCount)}
                  </span>
                ),
              },
              {
                title: 'Lượt đọc',
                className: 'whitespace-nowrap',
                dataIndex: 'views',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Theo dõi',
                className: 'whitespace-nowrap',
                dataIndex: 'followers',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Đánh giá',
                className: 'whitespace-nowrap',
                key: 'rating',
                align: 'right',
                render: (_, s) =>
                  s.ratingCount
                    ? `${s.ratingAvg.toFixed(1)} (${number.format(s.ratingCount)})`
                    : '–',
              },
              {
                title: 'Bình luận',
                className: 'whitespace-nowrap',
                dataIndex: 'comments',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Báo lỗi mở',
                className: 'whitespace-nowrap',
                dataIndex: 'openReports',
                align: 'right',
                render: (n: number) => (n > 0 ? <Tag color="orange">{n}</Tag> : 0),
              },
              {
                title: 'Cập nhật',
                className: 'whitespace-nowrap',
                dataIndex: 'updatedAt',
                render: (v: string) => formatDate(v),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
