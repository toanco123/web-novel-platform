import { ScrollRestoration } from 'react-router'

/**
 * Mọi lần mở trang mới (gõ URL, F5) đều có location.key = "default", nên ScrollRestoration
 * mặc định có thể cuộn trang mới tới vị trí của một trang khác đã mở trong cùng tab.
 * Với lần mở đầu tiên thì dùng pathname làm key để tránh điều đó.
 */
export function AppScrollRestoration() {
  return (
    <ScrollRestoration
      getKey={(location) => (location.key === 'default' ? location.pathname : location.key)}
    />
  )
}
