import { useParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { NotFound } from '@/components/common/NotFound'
import { SegmentedLinks } from '@/components/common/SegmentedLinks'
import { SITE_NAME } from '@/config/site'
import { StoryBrowser } from '@/features/stories/StoryBrowser'
import { paths } from '@/lib/routes'
import type { StoryStatus } from '@/types/story'

const lists: Record<
  string,
  { to: string; tab: string; title: string; description: string; status?: StoryStatus }
> = {
  'moi-cap-nhat': {
    to: paths.latest,
    tab: 'Mới cập nhật',
    title: 'Truyện mới cập nhật',
    description: 'Truyện vừa có chương mới, xếp theo lần cập nhật gần nhất.',
  },
  'dang-ra': {
    to: paths.ongoing,
    tab: 'Đang ra',
    title: 'Truyện đang ra',
    description: 'Truyện còn đang ra chương mới. Theo dõi để biết ngay khi có chương.',
    status: 'ongoing',
  },
  'hoan-thanh': {
    to: paths.completed,
    tab: 'Truyện full',
    title: 'Truyện full',
    description: 'Truyện đã hoàn thành, đọc một mạch tới chương cuối.',
    status: 'completed',
  },
}

export default function BrowsePage() {
  const { type = '' } = useParams()
  const list = lists[type]
  if (!list) return <NotFound message="Không có danh sách truyện này." />

  return (
    <Container className="py-10">
      <title>{`${list.title} | ${SITE_NAME}`}</title>
      <meta name="description" content={list.description} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">{list.title}</h1>
          <p className="mt-1 text-muted-foreground">{list.description}</p>
        </div>
        <SegmentedLinks
          label="Danh sách truyện"
          items={Object.entries(lists).map(([key, l]) => ({
            key,
            to: l.to,
            label: l.tab,
            active: key === type,
          }))}
        />
      </div>
      <div className="mt-8">
        {/* key: đổi danh sách thì bộ lọc bắt đầu lại */}
        <StoryBrowser key={type} fixed={{ status: list.status }} />
      </div>
    </Container>
  )
}
