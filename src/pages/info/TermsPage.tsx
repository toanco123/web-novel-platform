import { Link } from 'react-router'
import { InfoNote, InfoPage } from '@/components/common/InfoPage'
import { SITE_NAME } from '@/config/site'
import { paths } from '@/lib/routes'

export default function TermsPage() {
  return (
    <InfoPage
      title="Điều khoản sử dụng"
      description={`Những điều bạn đồng ý khi đọc, bình luận và đăng truyện trên ${SITE_NAME}.`}
      updatedAt="2026-09-25"
    >
      <InfoNote>
        Đây là bản thử nghiệm. Nội dung điều khoản có thể thay đổi trước khi trang chính thức hoạt
        động; khi có thay đổi quan trọng chúng tôi sẽ thông báo trên trang.
      </InfoNote>

      <h2>1. Tài khoản</h2>
      <ul>
        <li>Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động dưới tài khoản của mình.</li>
        <li>Tên hiển thị không được mạo danh người khác hoặc chứa từ ngữ xúc phạm.</li>
        <li>Mỗi người nên dùng một tài khoản; tài khoản dùng để phá hoại có thể bị khóa.</li>
      </ul>

      <h2>2. Nội dung bạn đăng</h2>
      <ul>
        <li>
          Truyện bạn đăng phải do bạn sáng tác, hoặc bạn đã được tác giả/người giữ bản quyền cho
          phép đăng lại. Bản quyền truyện vẫn thuộc về bạn.
        </li>
        <li>
          Khi xuất bản, bạn cho phép {SITE_NAME} hiển thị truyện cho người đọc trên trang. Bạn có
          thể ẩn hoặc xóa truyện bất cứ lúc nào trong khu Sáng tác.
        </li>
        <li>
          Không đăng nội dung vi phạm pháp luật Việt Nam, kích động bạo lực, thù ghét, khiêu dâm
          liên quan tới trẻ vị thành niên, hoặc xâm phạm đời tư người khác.
        </li>
      </ul>

      <h2>3. Bình luận và đánh giá</h2>
      <p>
        Hãy tôn trọng tác giả và bạn đọc khác. Bình luận spam, quảng cáo, tiết lộ nội dung (spoil)
        không cảnh báo hoặc công kích cá nhân có thể bị gỡ.
      </p>

      <h2>4. Gỡ nội dung</h2>
      <p>
        Nếu bạn là người giữ bản quyền và thấy truyện bị đăng lại trái phép, hãy{' '}
        <Link to={paths.contact}>liên hệ</Link> kèm đường dẫn và bằng chứng. Chúng tôi sẽ xem xét và
        gỡ nội dung vi phạm.
      </p>

      <h2>5. Giới hạn trách nhiệm</h2>
      <p>
        Truyện do người dùng đăng thể hiện quan điểm của tác giả, không phải của {SITE_NAME}. Trang
        được cung cấp theo hiện trạng; chúng tôi cố gắng giữ trang ổn định nhưng không cam kết không
        bao giờ gián đoạn.
      </p>

      <h2>6. Thay đổi điều khoản</h2>
      <p>
        Khi điều khoản thay đổi, ngày cập nhật ở đầu trang sẽ đổi theo. Tiếp tục sử dụng trang sau
        ngày đó nghĩa là bạn đồng ý với điều khoản mới.
      </p>
    </InfoPage>
  )
}
