import { Alert, App, Button, Card, Grid, Input, Popconfirm, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { ADMIN_USER_SORTS, type AdminUser, adminErrorMessage } from '@/features/admin/api'
import { ClearFilters, FilterSelect } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminUsers, useSetUserBanned } from '@/features/admin/hooks'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { useSession } from '@/features/auth/hooks'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')

const providerNames: Record<string, string> = {
  email: 'Email',
  google: 'Google',
  facebook: 'Facebook',
}

// Giá trị hợp lệ trên URL (?role=, ?status=, ?provider=); giá trị khác coi như không lọc
const ROLES = ['admin', 'member'] as const
const STATUSES = ['active', 'banned'] as const
const pick = <T extends string>(options: readonly T[], value: string | null) =>
  options.find((o) => o === value)

export default function AdminUsersPage() {
  const { params, page, update } = useFilterParams()
  // Màn hẹp không ghim cột đầu, nếu không nó chiếm hết chiều ngang và che các cột khác
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  // Cột thao tác ghim bên phải để nút luôn trong tầm nhìn; màn hẹp thì không đủ chỗ cho hai cột ghim
  const pinActions = screens.lg ?? false
  const q = params.get('q') ?? ''
  const role = pick(ROLES, params.get('role'))
  const status = pick(STATUSES, params.get('status'))
  const provider = pick(Object.keys(providerNames), params.get('provider'))
  const { sort, order, pageSize } = readTableParams(params, ADMIN_USER_SORTS)
  const { data, isPending, isFetching, isError } = useAdminUsers({
    q,
    role,
    status,
    provider,
    sort,
    order,
    page,
    pageSize,
  })
  // Mặc định: mới tham gia trước
  const active = { sort: sort ?? ('created' as const), order }
  const { data: me } = useSession()
  const setBanned = useSetUserBanned()
  const { message } = App.useApp()

  const toggleBan = (u: AdminUser) =>
    setBanned.mutate(
      { userId: u.id, banned: !u.isBanned },
      {
        onSuccess: () =>
          void message.success(
            u.isBanned ? `Đã mở khóa ${u.displayName}.` : `Đã khóa ${u.displayName}.`,
          ),
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Người dùng · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Người dùng</h1>
        {data && (
          <p className="text-sm text-muted-foreground">{number.format(data.total)} tài khoản</p>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo tên hoặc email"
            aria-label="Tìm người dùng"
            allowClear
            className="max-w-xs"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <FilterSelect
            label="Vai trò"
            value={role}
            onChange={(value) => update({ role: value })}
            options={[
              { value: 'admin', label: 'Quản trị viên' },
              { value: 'member', label: 'Tài khoản thường' },
            ]}
          />
          <FilterSelect
            label="Trạng thái"
            value={status}
            onChange={(value) => update({ status: value })}
            options={[
              { value: 'active', label: 'Hoạt động' },
              { value: 'banned', label: 'Đã khóa' },
            ]}
          />
          <FilterSelect
            label="Cách đăng nhập"
            value={provider}
            onChange={(value) => update({ provider: value })}
            options={Object.entries(providerNames).map(([value, label]) => ({ value, label }))}
          />
          <ClearFilters
            params={params}
            keys={['q', 'role', 'status', 'provider']}
            update={update}
          />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được danh sách người dùng." />
        ) : (
          <Table<AdminUser>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1180 }}
            locale={{
              emptyText:
                q || role || status || provider
                  ? 'Không có ai khớp bộ lọc'
                  : 'Chưa có người dùng nào',
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Người dùng',
                ...sortable('name', active),
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 260 : 210,
                render: (_, u) => (
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={u} className="size-9 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {u.displayName}
                        {u.isAdmin && (
                          <Tag color="magenta" className="ml-2!">
                            Quản trị
                          </Tag>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Đăng nhập',
                width: 120,
                dataIndex: 'provider',
                render: (p: string) => <Tag>{providerNames[p] ?? p}</Tag>,
              },
              {
                title: 'Tham gia',
                ...sortable('created', active),
                width: 130,
                dataIndex: 'createdAt',
                render: (v: string | null) => (v ? formatDate(v) : '–'),
              },
              {
                title: 'Đăng nhập cuối',
                ...sortable('lastSignIn', active),
                width: 170,
                dataIndex: 'lastSignInAt',
                render: (v: string | null) =>
                  v ? <span title={formatDate(v)}>{formatRelativeTime(v)}</span> : '–',
              },
              {
                title: 'Truyện',
                ...sortable('stories', active),
                width: 110,
                dataIndex: 'storyCount',
                align: 'right',
                render: (n: number, u) =>
                  n > 0 ? (
                    <Link
                      to={paths.adminStories(u.id)}
                      aria-label={`${n} truyện của ${u.displayName}`}
                    >
                      {number.format(n)}
                    </Link>
                  ) : (
                    0
                  ),
              },
              {
                title: 'Bình luận',
                ...sortable('comments', active),
                width: 125,
                dataIndex: 'commentCount',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Theo dõi',
                ...sortable('follows', active),
                width: 120,
                dataIndex: 'followCount',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Trạng thái',
                key: 'ban',
                width: 200,
                fixed: pinActions ? 'right' : undefined,
                className: 'whitespace-nowrap',
                render: (_, u) => {
                  // Không tự khóa mình, không khóa quản trị viên khác (DB cũng chặn)
                  const locked = u.id === me?.id || (u.isAdmin && !u.isBanned)
                  return (
                    <div className="flex items-center gap-2">
                      {u.isBanned ? (
                        <Tag color="red">Đã khóa</Tag>
                      ) : (
                        <Tag color="green">Hoạt động</Tag>
                      )}
                      {!locked && (
                        <Popconfirm
                          title={
                            u.isBanned ? `Mở khóa ${u.displayName}?` : `Khóa ${u.displayName}?`
                          }
                          description={
                            u.isBanned
                              ? 'Người này đăng nhập lại được.'
                              : 'Người này bị đăng xuất (tối đa sau 1 giờ) và không đăng nhập lại được. Truyện và bình luận vẫn giữ nguyên.'
                          }
                          okText={u.isBanned ? 'Mở khóa' : 'Khóa'}
                          okButtonProps={{ danger: !u.isBanned }}
                          cancelText="Hủy"
                          onConfirm={() => toggleBan(u)}
                        >
                          <Button
                            size="small"
                            danger={!u.isBanned}
                            loading={setBanned.isPending && setBanned.variables?.userId === u.id}
                          >
                            {u.isBanned ? 'Mở khóa' : 'Khóa'}
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  )
                },
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
