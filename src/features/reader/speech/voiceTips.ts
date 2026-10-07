// Gợi ý cách có giọng của máy đọc tiếng Việt hay hơn, theo thiết bị đang dùng. Logic thuần để app di
// động chép nguyên (app truyền 'ios' / 'android' thay cho user agent).

export function voiceTips(userAgent: string): string[] {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod|^ios$/.test(ua)) {
    return [
      'iPhone, iPad: vào Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt, tải giọng Linh (Nâng cao) rồi mở lại trang.',
    ]
  }
  if (ua.includes('android')) {
    return [
      'Android: vào Cài đặt → Hệ thống → Ngôn ngữ → Chuyển văn bản sang lời nói, chọn công cụ của Google (hoặc Samsung) và tải dữ liệu giọng tiếng Việt.',
    ]
  }
  if (ua.includes('edg/')) {
    return [
      'Chọn giọng Microsoft HoaiMy hoặc NamMinh "Online (Natural)" trong nhóm Giọng của máy: đọc tự nhiên và miễn phí.',
    ]
  }
  const tips = [
    'Mở trang bằng trình duyệt Microsoft Edge để có giọng HoaiMy, NamMinh đọc tự nhiên, miễn phí.',
  ]
  if (ua.includes('macintosh')) {
    tips.push(
      'macOS: vào Cài đặt hệ thống → Trợ năng → Nội dung được đọc → Giọng hệ thống → Quản lý giọng, tải giọng Linh.',
    )
  }
  return tips
}
