import { Link } from 'react-router'
import { InfoPage } from '@/components/common/InfoPage'
import { ContactForm } from '@/features/feedback/components/ContactForm'
import { paths } from '@/lib/routes'

export default function ContactPage() {
  return (
    <InfoPage
      title="Liên hệ"
      description="Góp ý, báo lỗi, bản quyền hay hợp tác: gửi cho chúng tôi ở đây."
    >
      <p>
        Gặp lỗi trong một chương cụ thể? Dùng nút <strong>Báo lỗi chương</strong> ở cuối chương để
        tác giả nhận được ngay. Với câu hỏi khác, điền form dưới đây. Xem thêm{' '}
        <Link to={paths.terms}>điều khoản</Link> về bản quyền nội dung.
      </p>
      <div className="mt-8 rounded-xl border bg-card/40 p-5 sm:p-6">
        <ContactForm />
      </div>
    </InfoPage>
  )
}
