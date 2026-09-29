import { Alert, App, Button, Card, Grid, Input, Popconfirm, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { ADMIN_PAGE_SIZE, type AdminUser, adminErrorMessage } from '@/features/admin/api'
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

export default function AdminUsersPage() {
  const { params, page, update } = useFilterParams()
  // Màn hẹp không ghim cột đầu, nếu không nó chiếm hết chiều ngang và che các cột khác
  const pinFirst = Grid.useBreakpoint().md ?? false
  const q = params.get('q') ?? ''
  const { data, isPending, isFetching, isError } = useAdminUsers({ q, page })
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
        <div className="mb-4 max-w-md">
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo tên hoặc email"
            aria-label="Tìm người dùng"
            allowClear
            onSearch={(value) => update({ q: value.trim() })}
          />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được danh sách người dùng." />
        ) : (
          <Table<AdminUser>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1120 }}
            locale={{ emptyText: q ? 'Không có ai khớp từ khóa' : 'Chưa có người dùng nào' }}
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
                title: 'Người dùng',
                key: 'user',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 280 : 210,
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
                title: 'Đăng nhập bằng',
                className: 'whitespace-nowrap',
                dataIndex: 'provider',
                render: (p: string) => <Tag>{providerNames[p] ?? p}</Tag>,
              },
              {
                title: 'Tham gia',
                className: 'whitespace-nowrap',
                dataIndex: 'createdAt',
                render: (v: string | null) => (v ? formatDate(v) : '–'),
              },
              {
                title: 'Đăng nhập cuối',
                className: 'whitespace-nowrap',
                dataIndex: 'lastSignInAt',
                render: (v: string | null) =>
                  v ? <span title={formatDate(v)}>{formatRelativeTime(v)}</span> : '–',
              },
              {
                title: 'Truyện',
                className: 'whitespace-nowrap',
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
                className: 'whitespace-nowrap',
                dataIndex: 'commentCount',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Theo dõi',
                className: 'whitespace-nowrap',
                dataIndex: 'followCount',
                align: 'right',
                render: (n: number) => number.format(n),
              },
              {
                title: 'Trạng thái',
                key: 'ban',
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
