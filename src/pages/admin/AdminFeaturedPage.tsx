import { Alert, App, Button, Card, Select, Skeleton, Tag } from 'antd'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { CURATED_LIMITS, type CuratedStory, adminErrorMessage } from '@/features/admin/api'
import { useAdminStories, useCuratedStories, useSetCuratedStories } from '@/features/admin/hooks'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { paths } from '@/lib/routes'
import type { CuratedList } from '@/types/story'

const LISTS: { list: CuratedList; title: string; place: string; fallback: string }[] = [
  {
    list: 'featured',
    title: 'Banner nổi bật',
    place: 'Banner lớn ở đầu trang chủ, lần lượt theo thứ tự dưới đây.',
    fallback: 'Trang chủ đang tự lấy các truyện nhiều lượt đọc nhất.',
  },
  {
    list: 'editor_pick',
    title: 'Truyện đề cử',
    place: 'Hàng "Truyện đề cử" trên trang chủ, từ trái sang phải.',
    fallback: 'Trang chủ đang tự lấy các truyện được chấm điểm cao nhất.',
  },
]

export default function AdminFeaturedPage() {
  return (
    <div className="space-y-6">
      <title>{`Trang chủ · Quản trị | ${SITE_NAME}`}</title>
      <h1 className="font-heading text-3xl font-semibold">Trang chủ</h1>
      <p className="text-sm text-muted-foreground">
        Chọn truyện hiện ở banner và hàng đề cử của trang chủ. Danh sách nào để trống thì trang chủ
        tự chọn cho danh sách đó.
      </p>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {LISTS.map((props) => (
          <CuratedCard key={props.list} {...props} />
        ))}
      </div>
    </div>
  )
}

function CuratedCard({ list, title, place, fallback }: (typeof LISTS)[number]) {
  const limit = CURATED_LIMITS[list]
  const saved = useCuratedStories(list)
  const save = useSetCuratedStories()
  const { message } = App.useApp()
  // Danh sách đang sửa, chưa lưu; null: đang hiện đúng bản đã lưu
  const [draft, setDraft] = useState<CuratedStory[] | null>(null)
  const items = draft ?? saved.data ?? []
  const full = items.length >= limit

  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 250)
  const found = useAdminStories({ q, visibility: 'published', sort: 'views', page: 1 })
  const picked = new Set(items.map((s) => s.id))
  const options = (found.data?.items ?? [])
    .filter((s) => s.publishedCount > 0 && !picked.has(s.id))
    .map((s) => ({ value: s.id, label: s.title, story: s }))

  const move = (index: number, by: -1 | 1) => {
    const next = [...items]
    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    setDraft(next)
  }
  const submit = () =>
    save.mutate(
      { list, storyIds: items.map((s) => s.id) },
      {
        onSuccess: () => {
          setDraft(null)
          void message.success(`Đã lưu ${title}.`)
        },
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )

  return (
    <section aria-label={title} className="min-w-0">
      <Card
        title={title}
        extra={
          <span className="text-sm text-muted-foreground">
            {items.length}/{limit} truyện
          </span>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">{place}</p>
        {/* antd đặt margin: 0 cho Select và thắng class Tailwind, nên khoảng cách nằm ở thẻ bọc */}
        <div className="mb-4">
          <Select
            className="w-full"
            aria-label={`Thêm truyện vào ${title}`}
            // Mỗi lần tìm chỉ có tối đa một trang kết quả: không cần danh sách ảo
            virtual={false}
            showSearch={{ filterOption: false, onSearch: setSearch }}
            value={null}
            disabled={full || saved.isPending || saved.isError}
            placeholder={full ? `Đã đủ ${limit} truyện` : 'Tìm truyện công khai để thêm'}
            notFoundContent={found.isFetching ? 'Đang tìm…' : 'Không có truyện công khai nào khớp'}
            options={options}
            optionRender={(option) => (
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate">{option.data.story.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {option.data.story.ownerName}
                </span>
              </span>
            )}
            onSelect={(_, option) => {
              const { id, slug, title: storyTitle, ownerName } = option.story
              setDraft([
                ...items,
                { id, slug, title: storyTitle, authorName: ownerName, isPublic: true },
              ])
              setSearch('')
            }}
          />
        </div>

        {saved.isError ? (
          <Alert type="error" showIcon title="Không tải được danh sách." />
        ) : saved.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Chưa chọn truyện nào. {fallback}
          </p>
        ) : (
          <ol className="divide-y divide-border rounded-lg border border-border">
            {items.map((story, index) => (
              <li key={story.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {story.isPublic ? (
                    <Link to={paths.story(story.slug)} className="block truncate font-medium">
                      {story.title}
                    </Link>
                  ) : (
                    <p className="flex items-center gap-2">
                      <span className="truncate font-medium">{story.title}</span>
                      <Tag color="orange" className="shrink-0">
                        Đang ẩn
                      </Tag>
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{story.authorName}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="small"
                    icon={<ArrowUp className="size-3.5" aria-hidden />}
                    aria-label={`Đưa "${story.title}" lên`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <Button
                    size="small"
                    icon={<ArrowDown className="size-3.5" aria-hidden />}
                    aria-label={`Đưa "${story.title}" xuống`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<X className="size-3.5" aria-hidden />}
                    aria-label={`Bỏ "${story.title}"`}
                    onClick={() => setDraft(items.filter((s) => s.id !== story.id))}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
        {items.some((s) => !s.isPublic) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Truyện đang ẩn không lên trang chủ cho tới khi được công khai lại.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {draft && (
            <Button onClick={() => setDraft(null)} disabled={save.isPending}>
              Hoàn tác
            </Button>
          )}
          <Button type="primary" disabled={!draft} loading={save.isPending} onClick={submit}>
            Lưu
          </Button>
        </div>
      </Card>
    </section>
  )
}
