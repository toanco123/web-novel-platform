import { Outlet } from 'react-router'
import { AppScrollRestoration } from '@/components/common/AppScrollRestoration'
import { toneClass } from '@/features/reader/readerOptions'
import { useReaderSettings } from '@/features/reader/useReaderSettings'
import { cn } from '@/lib/utils'

/** Layout trang đọc: không header/footer của web, màu nền theo cài đặt đọc */
export function ReaderLayout() {
  const tone = useReaderSettings((s) => s.tone)
  return (
    <div className={cn(toneClass[tone], 'min-h-svh bg-background text-foreground')}>
      <a
        href="#chapter-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chương
      </a>
      <Outlet />
      <AppScrollRestoration />
    </div>
  )
}
