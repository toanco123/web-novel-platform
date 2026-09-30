import { type PageSeo, seoTags } from '@/lib/seo'
import { SITE_URL } from '@/lib/siteUrl'

/**
 * Thẻ <title>, description, canonical và Open Graph của một trang (React 19 tự đưa lên <head>).
 * Bot không chạy JS nhận cùng bộ thẻ này từ hàm api/meta.
 */
export function Seo(seo: PageSeo) {
  return (
    <>
      <title>{seo.title}</title>
      {seoTags(seo, SITE_URL).map(({ tag: Tag, attrs }) => (
        <Tag key={attrs.name ?? attrs.property ?? attrs.rel} {...attrs} />
      ))}
    </>
  )
}

/** Cho khung của cả một khu riêng tư (đăng nhập, Sáng tác, Quản trị): trang bên trong tự đặt <title> */
export const NoIndex = () => <meta name="robots" content="noindex" />
