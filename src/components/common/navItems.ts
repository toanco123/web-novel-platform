import { paths } from '@/lib/routes'

export const navItems = [
  { to: paths.home, label: 'Trang chủ', end: true },
  { to: paths.completed, label: 'Truyện full' },
  { to: paths.ongoing, label: 'Đang ra' },
  { to: paths.ranking, label: 'Bảng xếp hạng' },
]
