import { Alert, Button, Card, Grid, Input, Modal, Segmented, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  ADMIN_VOTE_STORY_SORTS,
  ADMIN_VOTE_USER_SORTS,
  type AdminLedgerEntry,
  type AdminVoteStory,
  type AdminVoteUser,
  VOTE_CONCENTRATED_MIN_TOTAL,
  VOTE_CONCENTRATED_SHARE,
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
import { useAdminUserLedger, useAdminVoteStories, useAdminVoteUsers } from '@/features/admin/hooks'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const percent = (share: number) => `${Math.round(share * 100)}%`

type Target = { id: string; name: string }

export default function AdminVotesPage() {
  const { params, update } = useFilterParams()
  const view = params.get('view') === 'users' ? 'users' : 'stories'
  // Người đang xem sổ phiếu (hộp thoại dùng chung cho cả hai tab)
  const [target, setTarget] = useState<Target | null>(null)

  return (
    <div className="space-y-6">
      <title>{`Phiếu đề cử · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Phiếu đề cử</h1>
        <Segmented
          value={view}
          // Cột sắp xếp của hai tab khác nhau: đổi tab thì bỏ hết tham số của tab cũ
          onChange={(value) =>
            update({
              view: value === 'users' ? 'users' : null,
              q: null,
              sort: null,
              order: null,
              flag: null,
              size: null,
            })
          }
          options={[
            { label: 'Theo truyện', value: 'stories' },
            { label: 'Theo người dùng', value: 'users' },
          ]}
          aria-label="Xem phiếu theo"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Chỉ để xem. Truyện bị đánh dấu "Tập trung" khi có từ {VOTE_CONCENTRATED_MIN_TOTAL} phiếu mà
        một người chiếm từ {percent(VOTE_CONCENTRATED_SHARE)}: có thể là một người lập nhiều tài
        khoản để dồn phiếu. Xử lý vi phạm bằng khóa tài khoản ở trang Người dùng.
      </p>
      {view === 'users' ? (
        <VoteUsersTable onOpenLedger={setTarget} />
      ) : (
        <VoteStoriesTable onOpenLedger={setTarget} />
      )}
      <LedgerModal target={target} onClose={() => setTarget(null)} />
    </div>
  )
}

function useColumnPins() {
  const screens = Grid.useBreakpoint()
  // Màn hẹp không ghim cột đầu, nếu không nó chiếm hết chiều ngang và che các cột khác
  return { pinFirst: screens.md ?? false, pinActions: screens.lg ?? false }
}

function VoteStoriesTable({ onOpenLedger }: { onOpenLedger: (target: Target) => void }) {
  const { params, page, update } = useFilterParams()
  const { pinFirst } = useColumnPins()
  const q = params.get('q') ?? ''
  const concentrated = params.get('flag') === 'concentrated'
  const { sort, order, pageSize } = readTableParams(params, ADMIN_VOTE_STORY_SORTS)
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminVoteStories({
    q,
    concentrated,
    sort,
    order,
    page,
    pageSize,
  })
  // Mặc định: nhiều phiếu nhất trước
  const active = { sort: sort ?? ('total' as const), order }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input.Search
          key={q}
          defaultValue={q}
          placeholder="Tìm theo tên truyện hoặc tác giả"
          aria-label="Tìm truyện"
          allowClear
          className="max-w-xs"
          onSearch={(value) => update({ q: value.trim() })}
        />
        <FilterSelect
          label="Dấu hiệu"
          value={concentrated ? 'concentrated' : undefined}
          onChange={(value) => update({ flag: value })}
          options={[{ value: 'concentrated', label: 'Tập trung' }]}
        />
        <ClearFilters params={params} keys={['q', 'flag']} update={update} />
      </div>
      {isError ? (
        <Alert type="error" showIcon title="Không tải được danh sách phiếu." />
      ) : (
        <Table<AdminVoteStory>
          rowKey="id"
          loading={isPending || isFetching}
          dataSource={data?.items}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <TableEmpty loading={isPending || isPlaceholderData}>
                {q || concentrated
                  ? 'Không có truyện nào khớp bộ lọc'
                  : 'Chưa có truyện nào được đề cử'}
              </TableEmpty>
            ),
          }}
          pagination={tablePagination(data, page, pageSize, update)}
          onChange={onTableChange(update)}
          columns={[
            {
              title: 'Truyện',
              ...sortable('title', active),
              fixed: pinFirst ? 'left' : undefined,
              width: pinFirst ? 260 : 210,
              render: (_, s) => (
                <div className="min-w-0">
                  <Link to={paths.story(s.slug)} className="block truncate font-medium">
                    {s.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{s.ownerName}</p>
                </div>
              ),
            },
            {
              title: 'Tổng phiếu',
              ...sortable('total', active),
              width: 130,
              dataIndex: 'totalVotes',
              align: 'right',
              render: (n: number) => number.format(n),
            },
            {
              title: '7 ngày',
              ...sortable('week', active),
              width: 110,
              dataIndex: 'weekVotes',
              align: 'right',
              render: (n: number) => number.format(n),
            },
            {
              title: 'Số người',
              ...sortable('voters', active),
              width: 110,
              dataIndex: 'voterCount',
              align: 'right',
              render: (n: number) => number.format(n),
            },
            {
              title: 'Nhiều nhất',
              ...sortable('share', active),
              width: 260,
              render: (_, s) => (
                <div className="flex flex-wrap items-center gap-2">
                  {s.topVoterId ? (
                    <Button
                      type="link"
                      size="small"
                      className="max-w-36 truncate p-0!"
                      title={`Xem sổ phiếu của ${s.topVoterName}`}
                      onClick={() => onOpenLedger({ id: s.topVoterId ?? '', name: s.topVoterName })}
                    >
                      {s.topVoterName || 'Không tên'}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">Tài khoản đã xóa</span>
                  )}
                  <span className="tabular-nums">{percent(s.topShare)}</span>
                  {s.concentrated && <Tag color="orange">Tập trung</Tag>}
                </div>
              ),
            },
          ]}
        />
      )}
    </Card>
  )
}

function VoteUsersTable({ onOpenLedger }: { onOpenLedger: (target: Target) => void }) {
  const { params, page, update } = useFilterParams()
  const { pinFirst, pinActions } = useColumnPins()
  const q = params.get('q') ?? ''
  const { sort, order, pageSize } = readTableParams(params, ADMIN_VOTE_USER_SORTS)
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminVoteUsers({
    q,
    sort,
    order,
    page,
    pageSize,
  })
  // Mặc định: đề cử nhiều nhất trước
  const active = { sort: sort ?? ('voted' as const), order }

  return (
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
        <ClearFilters params={params} keys={['q']} update={update} />
      </div>
      {isError ? (
        <Alert type="error" showIcon title="Không tải được danh sách người dùng." />
      ) : (
        <Table<AdminVoteUser>
          rowKey="id"
          loading={isPending || isFetching}
          dataSource={data?.items}
          scroll={{ x: 960 }}
          locale={{
            emptyText: (
              <TableEmpty loading={isPending || isPlaceholderData}>
                {q ? 'Không có ai khớp bộ lọc' : 'Chưa ai điểm danh hay đề cử'}
              </TableEmpty>
            ),
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
                <div className="min-w-0">
                  <Link to={paths.adminUserSearch(u.email)} className="block truncate font-medium">
                    {u.displayName || 'Không tên'}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              ),
            },
            {
              title: 'Số dư',
              ...sortable('balance', active),
              width: 110,
              dataIndex: 'balance',
              align: 'right',
              render: (n: number) => number.format(n),
            },
            {
              title: 'Đã đề cử',
              ...sortable('voted', active),
              width: 120,
              dataIndex: 'voted',
              align: 'right',
              render: (n: number) => number.format(n),
            },
            {
              title: 'Điểm danh',
              ...sortable('checkins', active),
              width: 120,
              dataIndex: 'checkinCount',
              align: 'right',
              render: (n: number) => number.format(n),
            },
            {
              title: 'Chuỗi gần nhất',
              ...sortable('streak', active),
              width: 150,
              dataIndex: 'lastStreak',
              align: 'right',
              render: (n: number) => `${n} ngày`,
            },
            {
              title: 'Tham gia',
              ...sortable('created', active),
              width: 130,
              dataIndex: 'createdAt',
              render: (v: string | null) => (v ? formatDate(v) : '–'),
            },
            {
              title: 'Sổ phiếu',
              key: 'ledger',
              width: 120,
              fixed: pinActions ? 'right' : undefined,
              render: (_, u) => (
                <Button
                  size="small"
                  aria-label={`Xem sổ phiếu của ${u.displayName}`}
                  onClick={() => onOpenLedger({ id: u.id, name: u.displayName })}
                >
                  Xem sổ
                </Button>
              ),
            },
          ]}
        />
      )}
    </Card>
  )
}

function LedgerModal({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const { data, isPending, isError } = useAdminUserLedger(target?.id ?? null)
  return (
    <Modal
      open={target !== null}
      onCancel={onClose}
      footer={null}
      width={720}
      title={`Sổ phiếu của ${target?.name || 'người dùng'}`}
    >
      <p className="mb-3 text-sm text-muted-foreground">100 giao dịch mới nhất.</p>
      {isError ? (
        <Alert type="error" showIcon title="Không tải được sổ phiếu." />
      ) : (
        <Table<AdminLedgerEntry>
          rowKey="id"
          size="small"
          loading={isPending}
          dataSource={data}
          pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 560 }}
          locale={{ emptyText: <TableEmpty loading={isPending}>Chưa có giao dịch nào</TableEmpty> }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              width: 140,
              render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
            },
            {
              title: 'Nội dung',
              key: 'what',
              render: (_, e) =>
                e.reason === 'checkin' ? (
                  'Điểm danh'
                ) : e.story ? (
                  <>
                    Đề cử <Link to={paths.story(e.story.slug)}>{e.story.title}</Link>
                  </>
                ) : (
                  'Đề cử truyện đã xóa'
                ),
            },
            {
              title: 'Phiếu',
              dataIndex: 'amount',
              width: 90,
              align: 'right',
              render: (n: number) => (
                <span className={n > 0 ? 'text-green-600' : undefined}>
                  {n > 0 ? '+' : ''}
                  {number.format(n)}
                </span>
              ),
            },
            {
              title: 'Số dư',
              dataIndex: 'balanceAfter',
              width: 90,
              align: 'right',
              render: (n: number) => number.format(n),
            },
          ]}
        />
      )}
    </Modal>
  )
}
