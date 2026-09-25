import { ALargeSmall, ArrowLeft, Headphones, House, ListOrdered } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterContent } from '@/types/chapter'
import { ReaderChapterIndex } from './ReaderChapterIndex'
import { ReaderSettingsPanel } from './ReaderSettingsPanel'

export type ReaderPanel = 'index' | 'settings'

type Props = {
  chapter: ChapterContent
  visible: boolean
  /** Bảng đang mở (mục lục / cài đặt); trang đọc giữ state để nút ở chỗ khác cũng mở được */
  open: ReaderPanel | null
  setOpen: (panel: ReaderPanel | null) => void
  /** Nút nghe truyện; bỏ trống khi trình duyệt không hỗ trợ đọc to */
  listen?: { active: boolean; onClick: () => void }
}

export function ReaderToolbar({ chapter, visible, open, setOpen, listen }: Props) {
  const { story } = chapter
  const wide = useMediaQuery('(min-width: 768px)')

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl transition-transform duration-300 supports-[backdrop-filter]:bg-background/70',
          !visible && open === null && '-translate-y-full',
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-2 sm:gap-2 sm:px-4">
          <Button variant="ghost" size="icon-lg" asChild>
            <Link to={paths.story(story.slug)} aria-label={`Về trang truyện ${story.title}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-lg" className="hidden sm:inline-flex" asChild>
            <Link to={paths.home} aria-label="Trang chủ">
              <House />
            </Link>
          </Button>

          <div className="min-w-0 flex-1 px-1 leading-tight">
            <p className="truncate text-sm font-medium">{story.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              Chương {chapter.number}
              <span className="hidden sm:inline">: {chapter.title}</span>
            </p>
          </div>

          {listen && (
            <Button
              variant="ghost"
              className={cn('h-10 gap-2 rounded-full px-3', listen.active && 'text-primary')}
              aria-label="Nghe truyện"
              aria-pressed={listen.active}
              onClick={listen.onClick}
            >
              <Headphones />
              <span className="hidden md:inline">Nghe</span>
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-10 gap-2 rounded-full px-3"
            aria-label="Mục lục"
            aria-haspopup="dialog"
            onClick={() => setOpen('index')}
          >
            <ListOrdered />
            <span className="hidden md:inline">Mục lục</span>
          </Button>
          <Button
            variant="ghost"
            className="h-10 gap-2 rounded-full px-3"
            aria-label="Cài đặt đọc"
            aria-haspopup="dialog"
            onClick={() => setOpen('settings')}
          >
            <ALargeSmall className="size-5" />
            <span className="hidden md:inline">Cài đặt</span>
          </Button>
        </div>
      </header>

      <Sheet open={open === 'index'} onOpenChange={(o) => setOpen(o ? 'index' : null)}>
        {/* Không tự focus ô "Số chương": trên điện thoại sẽ bật bàn phím che mục lục */}
        <SheetContent
          side="right"
          className="w-[88vw] gap-0 sm:max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="pr-12">
            <SheetTitle className="font-heading text-2xl">Mục lục</SheetTitle>
            <SheetDescription className="line-clamp-2">{story.title}</SheetDescription>
          </SheetHeader>
          <ReaderChapterIndex
            slug={story.slug}
            current={chapter.number}
            max={story.chapterCount}
            onNavigate={() => setOpen(null)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={open === 'settings'} onOpenChange={(o) => setOpen(o ? 'settings' : null)}>
        {/* Lớp phủ trong suốt để vừa chỉnh vừa thấy chữ thay đổi phía sau */}
        <SheetContent
          side={wide ? 'right' : 'bottom'}
          overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none"
          className={cn(
            wide ? 'w-96 sm:max-w-sm' : 'max-h-[75svh] rounded-t-2xl',
            'overflow-y-auto',
          )}
        >
          <SheetHeader className="pr-12">
            <SheetTitle className="font-heading text-2xl">Cài đặt đọc</SheetTitle>
            <SheetDescription>Áp dụng ngay và được nhớ cho lần đọc sau.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <ReaderSettingsPanel />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
