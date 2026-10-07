import { Card, Empty, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { paths } from '@/lib/routes'
import type { AdminOverview } from '../shared'

const number = new Intl.NumberFormat('vi-VN')

/** Truyện nhiều lượt đọc nhất (toàn thời gian, tối đa 10) */
export function TopStoriesTable({ stories }: { stories: AdminOverview['topStories'] }) {
  return (
    <Card title="Truyện nhiều lượt đọc nhất" className="h-full">
      {stories.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt đọc nào" />
      ) : (
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={stories}
          scroll={{ x: 640 }}
          columns={[
            // Hạng theo lượt đọc, giữ nguyên khi bấm sắp xếp theo cột khác
            {
              title: '#',
              key: 'rank',
              width: 48,
              render: (_, s) => stories.indexOf(s) + 1,
            },
            {
              title: 'Truyện',
              dataIndex: 'title',
              render: (title: string, s) =>
                s.visibility === 'published' ? (
                  <Link to={paths.story(s.slug)}>{title}</Link>
                ) : (
                  <>
                    {title} <Tag>Nháp</Tag>
                  </>
                ),
            },
            { title: 'Tác giả', dataIndex: 'authorName' },
            {
              title: 'Lượt đọc',
              dataIndex: 'views',
              align: 'right',
              // Chỉ 10 dòng, có sẵn ở trình duyệt nên sắp xếp ngay tại chỗ
              sorter: (a, b) => a.views - b.views,
              defaultSortOrder: 'descend',
              sortDirections: ['descend', 'ascend'],
              render: (v: number) => number.format(v),
            },
            {
              title: 'Theo dõi',
              dataIndex: 'followers',
              align: 'right',
              sorter: (a, b) => a.followers - b.followers,
              sortDirections: ['descend', 'ascend'],
              render: (v: number) => number.format(v),
            },
            {
              title: 'Đánh giá',
              key: 'rating',
              align: 'right',
              sorter: (a, b) => a.ratingAvg - b.ratingAvg || a.ratingCount - b.ratingCount,
              sortDirections: ['descend', 'ascend'],
              render: (_, s) =>
                s.ratingCount ? `${s.ratingAvg.toFixed(1)} (${number.format(s.ratingCount)})` : '–',
            },
          ]}
        />
      )}
    </Card>
  )
}
