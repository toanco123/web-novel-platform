import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { formatDate } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Container } from './Container'

const pages = [
  { to: paths.about, label: 'Giới thiệu' },
  { to: paths.contact, label: 'Liên hệ' },
  { to: paths.terms, label: 'Điều khoản sử dụng' },
  { to: paths.privacy, label: 'Chính sách bảo mật' },
]

type Props = {
  title: string
  description: string
  /** Ngày cập nhật nội dung (ISO), hiện dưới tiêu đề */
  updatedAt?: string
  children: ReactNode
}

/** Khung chung cho các trang thông tin: menu chuyển trang + nội dung dạng bài viết */
export function InfoPage({ title, description, updatedAt, children }: Props) {
  return (
    <Container className="grid gap-8 py-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
      <title>{`${title} | ${SITE_NAME}`}</title>
      <meta name="description" content={description} />
      {/* Màn hẹp: các nút xuống dòng; màn rộng: cột dính khi cuộn */}
      <nav aria-label="Trang thông tin" className="lg:sticky lg:top-36 lg:self-start">
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {pages.map((p) => (
            <li key={p.to}>
              <NavLink
                to={p.to}
                className={({ isActive }) =>
                  cn(
                    'block rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors lg:rounded-lg',
                    isActive
                      ? 'bg-primary/12 font-medium text-primary ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                {p.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <article className="max-w-prose min-w-0">
        <header>
          <h1 className="font-heading text-4xl leading-tight font-semibold sm:text-5xl">{title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{description}</p>
          {updatedAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Cập nhật ngày <time dateTime={updatedAt}>{formatDate(updatedAt)}</time>
            </p>
          )}
        </header>
        <div className="mt-8 leading-relaxed text-foreground/90 [&_a]:text-rose-gold [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:marker:text-rose-gold">
          {children}
        </div>
      </article>
    </Container>
  )
}

/** Hộp ghi chú nổi bật trong trang thông tin */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-rose-gold/30 bg-rose-gold/5 p-4 text-sm text-foreground/90">
      {children}
    </p>
  )
}
