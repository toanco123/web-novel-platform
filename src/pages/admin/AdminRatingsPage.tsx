import { Alert, App, Button, Card, Grid, Input, Popconfirm, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  ADMIN_RATING_SORTS,
  type AdminRating,
  type AdminRatingQuery,
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
import { useAdminRatings, useDeleteAdminRating } from '@/features/admin/hooks'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const SCORES = [1, 2, 3, 4, 5] as const
const average = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

export default function AdminRatingsPage() {
  const { params, page, update } = useFilterParams()
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  const q = params.get('q') ?? ''
  // Giá trị khác 1–5 trên URL coi như không lọc
  const score: AdminRatingQuery['score'] = SCORES.find((s) => String(s) === params.get('score'))
  const userId = params.get('user') ?? undefined
  const { sort, order, pageSize } = readTableParams(params, ADMIN_RATING_SORTS)
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminRatings({
    q,
    score,
    userId,
    sort,
    order,
    page,
    pageSize,
  })
  // Mặc định: mới chấm trước
  const active = { sort: sort ?? ('time' as const), order }
  const remove = useDeleteAdminRating()
  const { message } = App.useApp()

  const onDelete = (r: AdminRating) =>
    remove.mutate(
      { userId: r.userId, storyId: r.storyId },
      {
        onSuccess: () => void message.success('Đã xóa điểm chấm.'),
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Điểm chấm · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Điểm chấm</h1>
        {data && <p className="text-sm text-muted-foreground">{number.format(data.total)} điểm</p>}
      </div>
      <p className="text-sm text-muted-foreground">
        Điểm 1–5 sao người đọc chấm cho truyện. Cột "Đã chấm" cho biết người đó chấm bao nhiêu
        truyện và trung bình bao nhiêu sao: nhiều điểm 1 sao hàng loạt hay nhiều tài khoản mới cùng
        chấm 5 sao một truyện là dấu hiệu spam. Xóa điểm thì điểm trung bình của truyện tính lại
        ngay.
      </p>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo truyện hoặc người chấm"
            aria-label="Tìm điểm chấm"
            allowClear
            className="max-w-xs"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <FilterSelect
            label="Điểm"
            value={score ? String(score) : undefined}
            onChange={(value) => update({ score: value })}
            options={SCORES.map((s) => ({ value: String(s), label: `${s} sao` }))}
            className="w-32"
          />
          {userId && <Tag>Chỉ điểm của một người</Tag>}
          <ClearFilters params={params} keys={['q', 'score', 'user']} update={update} />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được danh sách điểm chấm." />
        ) : (
          <Table<AdminRating>
            rowKey={(r) => `${r.userId}:${r.storyId}`}
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: (
                <TableEmpty loading={isPending || isPlaceholderData}>
                  {q || score || userId
                    ? 'Không có điểm chấm nào khớp bộ lọc'
                    : 'Chưa có ai chấm điểm'}
                </TableEmpty>
              ),
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Người chấm',
                ...sortable('user', active),
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 240 : 200,
                render: (_, r) => (
                  <div className="min-w-0">
                    <Link
                      to={paths.adminUserSearch(r.userEmail)}
                      className="block truncate font-medium"
                    >
                      {r.userName || 'Không tên'}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{r.userEmail}</p>
                  </div>
                ),
              },
              {
                title: 'Truyện',
                ...sortable('story', active),
                width: 240,
                render: (_, r) => (
                  <Link to={paths.story(r.storySlug)} className="block truncate">
                    {r.storyTitle}
                  </Link>
                ),
              },
              {
                title: 'Điểm',
                ...sortable('score', active),
                width: 100,
                dataIndex: 'score',
                render: (s: number) => (
                  <Tag color={s <= 2 ? 'red' : s === 3 ? 'default' : 'green'}>{s} sao</Tag>
                ),
              },
              {
                title: 'Lúc chấm',
                ...sortable('time', active),
                width: 140,
                dataIndex: 'createdAt',
                render: (v: string | null) =>
                  v ? <span title={formatDate(v)}>{formatRelativeTime(v)}</span> : '–',
              },
              {
                title: 'Đã chấm',
                ...sortable('count', active),
                width: 120,
                dataIndex: 'userRatingCount',
                align: 'right',
                render: (n: number, r) => (
                  <Link
                    to={paths.adminRatings(r.userId)}
                    aria-label={`${n} điểm chấm của ${r.userName}`}
                  >
                    {number.format(n)}
                  </Link>
                ),
              },
              {
                title: 'Trung bình',
                ...sortable('avg', active),
                width: 130,
                dataIndex: 'userRatingAvg',
                align: 'right',
                render: (n: number) => `${average.format(n)} sao`,
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 100,
                fixed: pinActions ? 'right' : undefined,
                render: (_, r) => (
                  <Popconfirm
                    title="Xóa điểm chấm này?"
                    description="Điểm bị xóa vĩnh viễn, người chấm có thể chấm lại."
                    okText="Xóa"
                    okButtonProps={{ danger: true }}
                    cancelText="Hủy"
                    onConfirm={() => onDelete(r)}
                  >
                    <Button
                      size="small"
                      danger
                      loading={
                        remove.isPending &&
                        remove.variables?.userId === r.userId &&
                        remove.variables.storyId === r.storyId
                      }
                    >
                      Xóa
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
