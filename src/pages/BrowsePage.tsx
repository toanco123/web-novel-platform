import { useParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { NotFound } from '@/components/common/NotFound'
import { SegmentedLinks } from '@/components/common/SegmentedLinks'
import { LIST_FILTERS } from '@/features/stories/browseParams'
import { StoryBrowser } from '@/features/stories/StoryBrowser'
import { paths } from '@/lib/routes'
import { STATIC_PAGES, staticPageSeo } from '@/lib/seo'
import { Seo } from '@/components/common/Seo'

// Tiêu đề và mô tả của từng danh sách nằm ở STATIC_PAGES (dùng chung với thẻ SEO)
// Bộ lọc cố định của từng danh sách ở LIST_FILTERS (dùng chung với route loader)
const lists: Record<string, { to: string; tab: string }> = {
  latest: { to: paths.latest, tab: 'Mới cập nhật' },
  ongoing: { to: paths.ongoing, tab: 'Đang ra' },
  completed: { to: paths.completed, tab: 'Truyện full' },
}

export default function BrowsePage() {
  const { type = '' } = useParams()
  const list = lists[type]
  if (!list) return <NotFound message="Không có danh sách truyện này." />
  const { title, description } = STATIC_PAGES[list.to]

  return (
    <Container className="py-10">
      <Seo {...staticPageSeo(list.to)} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">{title}</h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
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
        {/* Không đặt key: bộ lọc nằm trên URL (link tab không mang theo nên tự bắt đầu lại), giữ
            nguyên component thì đổi tab vẫn thấy lưới cũ mờ đi thay vì nháy khung chờ */}
        <StoryBrowser fixed={LIST_FILTERS[type]} />
      </div>
    </Container>
  )
}
