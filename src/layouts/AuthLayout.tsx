import { ArrowLeft } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { SiteLogo } from '@/components/common/SiteLogo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { coverPalette } from '@/features/stories/coverPalette'
import { useFeaturedStories } from '@/features/stories/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppScrollRestoration } from '@/components/common/AppScrollRestoration'

// Vị trí 3 bìa xếp quạt: trái, phải, giữa (bìa giữa nằm trên cùng)
const fan = [
  'left-0 top-10 -rotate-12',
  'right-0 top-10 rotate-12',
  'left-1/2 top-0 -translate-x-1/2 z-10',
]

export function AuthLayout() {
  return (
    <div className="grid min-h-svh bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ShowcasePanel />
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between gap-3 px-4 md:px-8">
          <SiteLogo className="lg:invisible" />
          <div className="flex items-center gap-1">
            <Link
              to={paths.home}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Về trang chủ
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 justify-center px-4 pt-6 pb-16 md:items-center md:px-8 md:pt-0">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
      <AppScrollRestoration />
    </div>
  )
}

function ShowcasePanel() {
  const { data } = useFeaturedStories()
  const stories = data?.slice(0, 3) ?? []
  const quoted = stories[2] ?? stories[0]
  const p = coverPalette(quoted?.slug ?? '')

  return (
    <aside
      aria-hidden
      className="relative isolate hidden flex-col justify-between overflow-hidden p-10 text-[#f4e7ed] lg:flex"
      style={{ background: `linear-gradient(160deg, ${p.from}, #1a0f1d 70%)` }}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_45%,rgb(255_61_139/0.22),transparent_70%)]" />
      <SiteLogo className="text-[#d9a68f]" />

      <div className="relative mx-auto h-[22rem] w-full max-w-md">
        {stories.map((s, i) => (
          <div
            key={s.slug}
            className={cn(
              'absolute w-44 overflow-hidden rounded-lg shadow-[0_30px_60px_-15px_rgb(0_0_0/0.7)] ring-1 ring-white/10 xl:w-48',
              fan[i],
            )}
          >
            <StoryCover story={s} />
          </div>
        ))}
      </div>

      {quoted && (
        <figure className="max-w-md">
          <blockquote className="font-heading text-2xl leading-snug text-balance italic">
            “{quoted.description.split('. ')[0]}.”
          </blockquote>
          <figcaption className="mt-3 text-sm text-[#d9a68f]">
            {quoted.title}, {quoted.author.name}
          </figcaption>
        </figure>
      )}
    </aside>
  )
}
