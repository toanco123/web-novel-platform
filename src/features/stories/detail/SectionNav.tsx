import { useEffect, useRef } from 'react'
import { Container } from '@/components/common/Container'
import { useActiveSection } from '@/hooks/useActiveSection'
import { cn } from '@/lib/utils'

type Item = { id: string; label: string; count?: number }

/** Thanh mục lục dính ngay dưới header, tô sáng section đang xem */
export function SectionNav({ items }: { items: Item[] }) {
  const active = useActiveSection(items.map((i) => i.id))
  const listRef = useRef<HTMLUListElement>(null)

  // Trên mobile thanh cuộn ngang: kéo mục đang xem vào vùng nhìn thấy
  useEffect(() => {
    const list = listRef.current
    const link = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!list || !link) return
    const left = link.offsetLeft
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: left - 16, behavior: 'smooth' })
    }
  }, [active])

  return (
    <nav
      aria-label="Mục lục trang"
      className="sticky top-16 z-30 border-b bg-background/85 backdrop-blur-xl lg:top-28"
    >
      <Container>
        <ul ref={listRef} className="relative -mx-1 scrollbar-none flex gap-1 overflow-x-auto py-2">
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={active === item.id ? 'location' : undefined}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors',
                  active === item.id
                    ? 'bg-primary/12 text-primary ring-1 ring-primary/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums opacity-70">{item.count}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  )
}
