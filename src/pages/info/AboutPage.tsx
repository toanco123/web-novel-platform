import { Link } from 'react-router'
import { InfoPage } from '@/components/common/InfoPage'
import { SITE_NAME } from '@/config/site'
import { paths } from '@/lib/routes'

export default function AboutPage() {
  return (
    <InfoPage
      title={`Về ${SITE_NAME}`}
      description="Nơi đọc và đăng truyện chữ tiếng Việt, gọn nhẹ và dễ chịu cho mắt."
    >
      <p>
        {SITE_NAME} là nền tảng đọc truyện chữ: ngôn tình, cổ đại, xuyên không, hiện đại và nhiều
        thể loại khác. Chúng tôi muốn việc đọc truyện dài trên điện thoại hay máy tính đều thoải mái
        như cầm một cuốn sách.
      </p>

      <h2>Bạn có thể làm gì ở đây</h2>
      <ul>
        <li>
          <strong>Đọc miễn phí</strong>, chỉnh phông chữ, cỡ chữ, màu nền giấy; bật cuộn liên tục để
          chương sau tự nối vào.
        </li>
        <li>
          <strong>Nghe truyện</strong> bằng giọng đọc có sẵn trên máy, tự chuyển chương khi hết.
        </li>
        <li>
          <strong>Theo dõi truyện</strong> trong <Link to={paths.library}>tủ truyện</Link> để biết
          ngay khi có chương mới, và đọc tiếp đúng chỗ đang dừng.
        </li>
        <li>
          <strong>Bình luận, chấm điểm</strong> từng truyện và từng chương.
        </li>
      </ul>

      <h2>Dành cho người viết</h2>
      <p>
        Ai có tài khoản cũng có thể <Link to={paths.studio}>đăng truyện</Link>: viết chương trực
        tiếp hoặc nhập từ file, lưu nháp, xuất bản khi sẵn sàng. Khu Sáng tác có thống kê lượt đọc,
        người theo dõi và báo lỗi từ bạn đọc để bạn sửa kịp thời.
      </p>

      <h2>Góp ý</h2>
      <p>
        Trang còn đang được hoàn thiện. Nếu bạn gặp lỗi hoặc muốn có tính năng mới, hãy{' '}
        <Link to={paths.contact}>gửi cho chúng tôi</Link>.
      </p>
    </InfoPage>
  )
}
