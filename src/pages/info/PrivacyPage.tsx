import { Link } from 'react-router'
import { InfoNote, InfoPage } from '@/components/common/InfoPage'
import { paths } from '@/lib/routes'

export default function PrivacyPage() {
  return (
    <InfoPage path={paths.privacy} updatedAt="2026-10-07">
      <InfoNote>
        Bản thử nghiệm hiện lưu mọi dữ liệu (tài khoản, tủ truyện, lịch sử đọc, bình luận) ngay trên
        trình duyệt của bạn, chưa gửi lên máy chủ. Xóa dữ liệu trình duyệt là mất các dữ liệu này.
      </InfoNote>

      <h2>Dữ liệu chúng tôi thu thập</h2>
      <ul>
        <li>
          <strong>Tài khoản:</strong> email, tên hiển thị, ảnh đại diện (nếu bạn tải lên). Mật khẩu
          được mã hóa khi có máy chủ thật.
        </li>
        <li>
          <strong>Hoạt động đọc:</strong> truyện bạn theo dõi, chương đang đọc dở, lượt đọc chương
          (dùng để xếp hạng, không gắn với tên bạn khi hiển thị).
        </li>
        <li>
          <strong>Nội dung bạn tạo:</strong> truyện, chương, bình luận, điểm đánh giá, báo lỗi.
        </li>
        <li>
          <strong>Cài đặt đọc:</strong> phông chữ, cỡ chữ, màu nền, giọng đọc. Phần này chỉ lưu trên
          trình duyệt.
        </li>
        <li>
          <strong>Thông tin lỗi kỹ thuật:</strong> khi web gặp lỗi, thông tin về lỗi (trang đang mở,
          trình duyệt, mã tài khoản) được gửi tới dịch vụ theo dõi lỗi Sentry để chúng tôi sửa.
          Không kèm email, tên hay nội dung bạn nhập.
        </li>
      </ul>

      <h2>Chúng tôi dùng dữ liệu để</h2>
      <ul>
        <li>Giữ bạn đăng nhập và đồng bộ tủ truyện, lịch sử đọc giữa các thiết bị.</li>
        <li>Báo chương mới cho truyện bạn theo dõi.</li>
        <li>Tính bảng xếp hạng và thống kê lượt đọc cho tác giả (dạng số tổng).</li>
        <li>Xử lý báo lỗi và góp ý bạn gửi.</li>
      </ul>
      <p>
        Chúng tôi <strong>không bán</strong> dữ liệu cá nhân và không chia sẻ cho bên thứ ba để
        quảng cáo.
      </p>

      <h2>Quyền của bạn</h2>
      <ul>
        <li>
          Sửa tên, ảnh đại diện, mật khẩu trong trang <Link to={paths.account}>Tài khoản</Link>.
        </li>
        <li>
          Xóa từng mục hoặc toàn bộ lịch sử đọc trong{' '}
          <Link to={paths.readingHistory}>Tủ truyện</Link>.
        </li>
        <li>
          Tự xóa tài khoản cùng toàn bộ dữ liệu liên quan (truyện đã đăng, bình luận, tủ truyện) ở
          cuối trang <Link to={paths.account}>Tài khoản</Link>. Việc xóa có hiệu lực ngay và không
          khôi phục được.
        </li>
      </ul>

      <h2>Lưu trữ trên trình duyệt</h2>
      <p>
        Trang dùng bộ nhớ của trình duyệt (localStorage) để nhớ phiên đăng nhập, giao diện sáng/tối
        và cài đặt đọc. Trang không dùng cookie quảng cáo.
      </p>
    </InfoPage>
  )
}
