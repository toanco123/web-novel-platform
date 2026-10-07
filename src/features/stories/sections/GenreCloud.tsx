import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/SectionHeading'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/lib/routes'
import { useGenres } from '@/features/genres/hooks'

// Độ rộng các chip giả lúc chờ, cho giống tên thể loại dài ngắn khác nhau
const chipWidths = ['w-20', 'w-24', 'w-16', 'w-28', 'w-20', 'w-16', 'w-24', 'w-20', 'w-28', 'w-16']

export function GenreCloud() {
  const { data, isPending } = useGenres()
  // Chưa có thể loại nào (database mới) thì ẩn cả khối
  if (!isPending && !data?.length) return null

  return (
    <section aria-labelledby="genre-cloud">
      <SectionHeading id="genre-cloud">Thể loại</SectionHeading>
      <div className="flex flex-wrap gap-2" aria-busy={isPending}>
        {isPending
          ? chipWidths.map((w, i) => (
              <Skeleton key={i} className={`h-[2.125rem] rounded-full ${w}`} />
            ))
          : data.map((g) => (
              <Link
                key={g.slug}
                to={paths.genre(g.slug)}
                className="rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                {g.name}
              </Link>
            ))}
      </div>
    </section>
  )
}
