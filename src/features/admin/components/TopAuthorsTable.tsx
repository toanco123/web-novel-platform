import { Card, Empty, Table } from 'antd'
import { Link } from 'react-router'
import { paths } from '@/lib/routes'
import type { AdminOverview } from '../shared'

const number = new Intl.NumberFormat('vi-VN')

/** Tác giả (chủ truyện + bút danh) nhiều lượt đọc nhất trong kỳ */
export function TopAuthorsTable({
  authors,
  period,
}: {
  authors: AdminOverview['topAuthors']
  period: number
}) {
  return (
    <Card title={`Tác giả nổi bật · ${period} ngày`} className="h-full">
      {authors.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt đọc trong kỳ này" />
      ) : (
        <Table
          rowKey="key"
          size="middle"
          pagination={false}
          dataSource={authors}
          scroll={{ x: 520 }}
          columns={[
            {
              title: '#',
              key: 'rank',
              width: 48,
              render: (_, a) => authors.indexOf(a) + 1,
            },
            {
              title: 'Tác giả',
              dataIndex: 'name',
              render: (name: string, a) =>
                a.ownerId ? <Link to={paths.adminStories(a.ownerId)}>{name}</Link> : name,
            },
            {
              title: 'Truyện công khai',
              dataIndex: 'stories',
              align: 'right',
              render: (v: number) => number.format(v),
            },
            {
              title: 'Lượt đọc trong kỳ',
              dataIndex: 'views',
              align: 'right',
              render: (v: number) => number.format(v),
            },
            {
              title: 'Lượt theo dõi',
              dataIndex: 'followers',
              align: 'right',
              render: (v: number) => number.format(v),
            },
          ]}
        />
      )}
    </Card>
  )
}
