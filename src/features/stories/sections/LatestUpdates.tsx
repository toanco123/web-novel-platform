import { Link } from 'react-router'
import { SectionError, SectionHeading } from '@/components/common/SectionHeading'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import { useLatestUpdated } from '../hooks'

// Số truyện getLatestUpdated trả về mặc định: khung chờ đủ chừng ấy dòng để khối không co giãn
const COUNT = 12

export function LatestUpdates() {
  const { data, isPending, isError } = useLatestUpdated()

  return (
    <section aria-labelledby="latest-updates">
      <SectionHeading id="latest-updates" moreTo={paths.latest}>
        Mới cập nhật
      </SectionHeading>
      {isError ? (
        <SectionError />
      ) : data?.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Chưa có truyện nào được đăng.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card/50">
          {isPending
            ? Array.from({ length: COUNT }, (_, i) => (
                // Cùng lưới và chiều cao dòng chữ với dòng thật (24px tên, 16px thể loại...)
                <li
                  key={i}
                  className="grid gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_6.5rem] sm:items-center"
                >
                  <div>
                    <Skeleton className="my-0.5 h-5 w-2/3" />
                    <Skeleton className="my-0.5 h-3 w-20" />
                  </div>
                  <Skeleton className="my-0.5 h-4 w-32" />
                  <Skeleton className="my-0.5 h-3 w-16 sm:ml-auto" />
                </li>
              ))
            : data.map((s) => (
                <li
                  key={s.slug}
                  className="grid gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_6.5rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      to={paths.story(s.slug)}
                      className="block truncate font-medium hover:text-primary"
                    >
                      {s.title}
                    </Link>
                    {s.genres[0] && (
                      <Link
                        to={paths.genre(s.genres[0].slug)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {s.genres[0].name}
                      </Link>
                    )}
                  </div>
                  {s.latestChapter ? (
                    <Link
                      to={paths.chapter(s.slug, s.latestChapter.number)}
                      className="truncate text-sm text-rose-gold hover:underline"
                    >
                      Chương {s.latestChapter.number}
                      {s.latestChapter.title && `: ${s.latestChapter.title}`}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Chưa có chương</span>
                  )}
                  <time
                    dateTime={s.updatedAt}
                    className="text-xs text-muted-foreground sm:text-right"
                  >
                    {formatRelativeTime(s.updatedAt)}
                  </time>
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
