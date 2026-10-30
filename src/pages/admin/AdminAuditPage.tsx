import { Alert, Card, Grid, Input, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import {
  AUDIT_GROUPS,
  type AdminAuditEntry,
  type AdminAuditGroup,
  auditActionLabels,
  auditDetailText,
  auditGroupLabels,
} from '@/features/admin/api'
import { TableEmpty } from '@/features/admin/components/TableEmpty'
import { ClearFilters, FilterSelect } from '@/features/admin/components/TableFilters'
import { readTableParams, tablePagination } from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminAuditLog } from '@/features/admin/hooks'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')

// Màu nhãn theo mức tác động: đỏ cho thao tác xóa/khóa/gỡ, xanh cho khôi phục/duyệt, còn lại mặc định
const actionColor = (action: string) => {
  if (/(\.ban|\.takedown|\.delete|\.reject)$/.test(action)) return 'red'
  if (/(\.unban|\.restore|\.approve)$/.test(action)) return 'green'
  return 'default'
}

export default function AdminAuditPage() {
  const { params, page, update } = useFilterParams()
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  const q = params.get('q') ?? ''
  // Giá trị khác trên URL (?group=) coi như không lọc
  const group: AdminAuditGroup | undefined = AUDIT_GROUPS.find((g) => g === params.get('group'))
  const actorId = params.get('actor') ?? undefined
  const { pageSize } = readTableParams(params, [])
  const { data, isPending, isFetching, isError, isPlaceholderData } = useAdminAuditLog({
    q,
    group,
    actorId,
    page,
    pageSize,
  })

  return (
    <div className="space-y-6">
      <title>{`Nhật ký · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Nhật ký thao tác</h1>
        {data && <p className="text-sm text-muted-foreground">{number.format(data.total)} dòng</p>}
      </div>
      <p className="text-sm text-muted-foreground">
        Mọi thao tác ghi của quản trị viên (khóa tài khoản, gỡ hay duyệt truyện, xóa bình luận, sửa
        thể loại...) được ghi tự động: ai làm, lúc nào, với đối tượng nào. Chỉ để xem, không sửa hay
        xóa được. Tên người làm và tên đối tượng là tên lúc thao tác.
      </p>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo người làm hoặc đối tượng"
            aria-label="Tìm nhật ký"
            allowClear
            className="max-w-xs"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <FilterSelect
            label="Nhóm thao tác"
            value={group}
            onChange={(value) => update({ group: value })}
            options={AUDIT_GROUPS.map((g) => ({ value: g, label: auditGroupLabels[g] }))}
          />
          {actorId && <Tag>Chỉ thao tác của một người</Tag>}
          <ClearFilters params={params} keys={['q', 'group', 'actor']} update={update} />
        </div>
        {isError ? (
          <Alert type="error" showIcon title="Không tải được nhật ký." />
        ) : (
          <Table<AdminAuditEntry>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: (
                <TableEmpty loading={isPending || isPlaceholderData}>
                  {q || group || actorId
                    ? 'Không có dòng nhật ký nào khớp bộ lọc'
                    : 'Chưa có thao tác nào được ghi'}
                </TableEmpty>
              ),
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            columns={[
              {
                title: 'Thời gian',
                dataIndex: 'createdAt',
                fixed: pinFirst ? 'left' : undefined,
                width: 150,
                render: (v: string) => <span title={formatDate(v)}>{formatRelativeTime(v)}</span>,
              },
              {
                title: 'Người làm',
                key: 'actor',
                width: 170,
                render: (_, e) =>
                  e.actorId ? (
                    <Link
                      to={paths.adminAudit(e.actorId)}
                      title={`Xem thao tác của ${e.actorName}`}
                      className="block truncate"
                    >
                      {e.actorName || 'Không tên'}
                    </Link>
                  ) : (
                    <span className="block truncate" title="Tài khoản đã bị xóa">
                      {e.actorName || 'Không tên'}{' '}
                      <span className="text-xs text-muted-foreground">(đã xóa)</span>
                    </span>
                  ),
              },
              {
                title: 'Thao tác',
                dataIndex: 'action',
                width: 220,
                render: (a: string) => (
                  <Tag color={actionColor(a)}>{auditActionLabels[a] ?? a}</Tag>
                ),
              },
              {
                title: 'Đối tượng',
                dataIndex: 'targetLabel',
                width: 220,
                ellipsis: true,
                render: (label: string, e) => <span title={label}>{label || e.targetId}</span>,
              },
              {
                title: 'Chi tiết',
                key: 'details',
                width: 360,
                ellipsis: true,
                render: (_, e) => {
                  const text = auditDetailText(e)
                  return <span title={text}>{text || '–'}</span>
                },
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
