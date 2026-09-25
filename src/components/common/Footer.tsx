import { Link } from 'react-router'
import { SITE_NAME, SITE_TAGLINE } from '@/config/site'
import { useGenres } from '@/features/genres/hooks'
import { paths } from '@/lib/routes'
import { Container } from './Container'
import { SiteLogo } from './SiteLogo'

export function Footer() {
  const { data: genres } = useGenres()

  const columns = [
    {
      title: 'Khám phá',
      links: [
        { to: paths.completed, label: 'Truyện full' },
        { to: paths.ongoing, label: 'Đang ra' },
        { to: paths.ranking, label: 'Bảng xếp hạng' },
        { to: paths.genres, label: 'Tất cả thể loại' },
        { to: paths.studio, label: 'Đăng truyện' },
      ],
    },
    {
      title: 'Thể loại',
      links: (genres ?? []).slice(0, 5).map((g) => ({ to: paths.genre(g.slug), label: g.name })),
    },
    {
      title: 'Thông tin',
      links: [
        { to: paths.about, label: 'Giới thiệu' },
        { to: paths.contact, label: 'Liên hệ' },
        { to: paths.terms, label: 'Điều khoản sử dụng' },
        { to: paths.privacy, label: 'Chính sách bảo mật' },
      ],
    },
  ]

  return (
    <footer className="mt-20 border-t bg-card/40">
      <Container className="grid grid-cols-2 gap-10 py-12 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="col-span-full max-w-xs lg:col-span-1">
          <SiteLogo />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{SITE_TAGLINE}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="mb-3 text-sm font-semibold">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container className="border-t py-5 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SITE_NAME}
      </Container>
    </footer>
  )
}
