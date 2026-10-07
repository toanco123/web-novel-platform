import { X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { Container } from '@/components/common/Container'
import { LogoMark } from '@/components/common/LogoMark'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useAppBannerStore, useAppBannerTarget } from './useAppBanner'

/**
 * Banner mời tải app di động, dính đáy màn hình (chỉ trên điện thoại; plan-banner-cai-app.md).
 * Ghi chiều cao vào --app-banner-h để Toaster đẩy toast lên trên banner.
 */
export function AppBanner() {
  const target = useAppBannerTarget()
  const dismiss = useAppBannerStore((s) => s.dismiss)
  const ref = useRef<HTMLDivElement>(null)
  const visible = target !== null

  useLayoutEffect(() => {
    const el = ref.current
    if (!visible || !el) return
    const root = document.documentElement
    const update = () => root.style.setProperty('--app-banner-h', `${el.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--app-banner-h')
    }
  }, [visible])

  if (!target) return null
  return (
    <div
      ref={ref}
      role="region"
      aria-label="Giới thiệu app di động"
      className="sticky bottom-0 z-30 border-t bg-card/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl motion-safe:animate-in motion-safe:slide-in-from-bottom"
    >
      <Container className="flex items-center gap-2.5 px-3">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Đóng"
          onClick={dismiss}
          className="-ml-3 size-10 shrink-0 text-muted-foreground"
        >
          <X />
        </Button>
        {/* Như icon app: luôn nền tối, màu bản tối */}
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1a0f1d] text-[#d9a68f] [--neon:#ff3d8b]">
          <LogoMark className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">App {SITE_NAME}</p>
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            Đọc offline, báo chương mới
          </p>
        </div>
        <Button asChild className="h-10 shrink-0 rounded-full px-3.5">
          <a href={target.url} target="_blank" rel="noopener" onClick={dismiss}>
            Tải app
          </a>
        </Button>
      </Container>
    </div>
  )
}
