import { useNavigate, useSearchParams } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { useSession } from '@/features/auth/hooks'
import { useGenres } from '@/features/genres/hooks'
import { StoryForm } from '@/features/studio/components/StoryForm'
import { StudioBreadcrumb } from '@/features/studio/components/StudioBreadcrumb'
import { useCreateStory } from '@/features/studio/hooks'
import { paths } from '@/lib/routes'

export default function NewStoryPage() {
  const { data: user } = useSession()
  const create = useCreateStory()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const genres = useGenres()
  // ?the-loai=ngon-tinh (từ nút "Đăng truyện" ở trang thể loại): chọn sẵn nếu thể loại có thật
  const preset = params.get('the-loai')
  const presetGenres = genres.data?.some((g) => g.slug === preset) ? [preset!] : []

  // Chờ danh sách thể loại để form khởi tạo đúng giá trị chọn sẵn
  if (preset && genres.isPending) return <div className="h-96 animate-pulse rounded-xl bg-muted" />

  return (
    <>
      <title>{`Đăng truyện mới | ${SITE_NAME}`}</title>
      <StudioBreadcrumb
        items={[{ label: 'Sáng tác', to: paths.studio }, { label: 'Đăng truyện mới' }]}
      />
      <h1 className="font-heading text-4xl font-semibold">Đăng truyện mới</h1>
      <p className="mt-1 mb-8 max-w-prose text-muted-foreground">
        Điền thông tin truyện và viết luôn chương 1 nếu muốn. "Lưu nháp" để viết tiếp sau, "Đăng
        truyện" để công khai ngay.
      </p>
      <StoryForm
        defaultValues={{
          title: '',
          description: '',
          genreSlugs: presetGenres,
          status: 'ongoing',
          coverUrl: null,
        }}
        authorName={user?.displayName ?? ''}
        firstChapter
        submitLabel="Lưu nháp"
        pendingLabel="Đang lưu…"
        pending={create.isPending}
        error={create.error}
        onSubmit={(story, { chapter, publish, allowLeave }) =>
          create.mutate(
            { story, firstChapter: chapter ? { chapter, publish } : undefined },
            {
              onSuccess: (created) => {
                allowLeave()
                navigate(paths.studioStory(created.id), { replace: true })
              },
            },
          )
        }
      />
    </>
  )
}
