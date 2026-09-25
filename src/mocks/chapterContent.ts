// Nội dung chương giả cho truyện có sẵn: ghép câu mẫu theo seed (slug + số chương) để mỗi lần mở giống nhau
import { pick, seededRandom } from '@/lib/seededRandom'

const narration = [
  'Gió đêm lùa qua khe cửa, mang theo mùi hoa quế thoang thoảng từ khu vườn phía sau.',
  'Nàng đứng lặng dưới hiên rất lâu, nhìn những giọt mưa nối nhau rơi xuống bậc đá xanh.',
  'Ánh đèn lồng đỏ lay động, in bóng hai người lên bức tường vôi đã cũ.',
  'Trong thư phòng chỉ còn tiếng bút lông lướt trên giấy, đều đặn như nhịp thở.',
  'Hắn không nói gì, chỉ lặng lẽ khoác chiếc áo choàng lên vai nàng.',
  'Phố xá về khuya vắng tanh, chỉ còn tiếng rao bánh giò lẫn trong màn sương mỏng.',
  'Chén trà trên bàn đã nguội từ lúc nào, mặt nước phẳng lặng soi bóng ngọn nến.',
  'Nàng khẽ cắn môi, cố giấu đi sự bối rối đang dâng lên trong lòng.',
  'Bức thư được gấp làm tư, nét chữ bên trong vẫn nắn nót như năm nào.',
  'Tiếng chuông chùa xa xa vọng lại, trầm và dài, như gõ vào một nỗi nhớ cũ.',
  'Hắn quay đi, nhưng bước chân chậm lại khi nghe nàng gọi tên mình.',
  'Cơn mưa đầu mùa đến bất chợt, xóa nhòa dấu chân trên con đường lát sỏi.',
  'Trong gương đồng, gương mặt nàng vẫn còn vương chút ửng hồng chưa kịp tan.',
  'Mọi người trong yến tiệc đều nâng chén, chỉ có hắn nhìn về phía cửa sổ.',
  'Nàng nhớ lại buổi chiều năm ấy, khi cả hai còn chưa biết thế nào là chia xa.',
  'Chiếc trâm ngọc nằm yên trong hộp gấm, lạnh và sáng như ánh trăng.',
  'Hắn cười, nụ cười hiếm hoi khiến đôi mắt vốn lạnh lùng bỗng trở nên dịu dàng.',
  'Bên ngoài, tuyết bắt đầu rơi, phủ trắng mái ngói và những cành mai chưa nở.',
  'Nàng đếm từng nhịp tim của mình, chờ đợi một câu trả lời mà nàng đã biết trước.',
  'Không ai trong phủ dám nhắc lại chuyện đêm hôm đó.',
  'Ngọn nến lụi dần, để lại một vệt khói mảnh bay lên trần nhà.',
  'Hắn đặt tay lên chuôi kiếm, nhưng rồi lại buông ra, như thể đã đổi ý.',
  'Mùi mực tàu hòa với mùi gỗ đàn hương tạo nên một thứ hương rất riêng của căn phòng.',
  'Nàng biết, từ giây phút này, mọi thứ sẽ không còn như trước nữa.',
  'Người hầu gái rón rén bưng khay trà vào, rồi lại rón rén lui ra.',
  'Tiếng vó ngựa dồn dập ngoài cổng thành phá tan bầu không khí yên tĩnh.',
  'Hắn im lặng rất lâu, lâu đến mức nàng tưởng hắn sẽ không bao giờ lên tiếng.',
  'Một chiếc lá phong đỏ rơi xuống mặt hồ, xoay vài vòng rồi trôi đi mất.',
]

const dialogue = [
  '— Nàng còn định trốn tránh ta đến bao giờ?',
  '— Chuyện năm đó, ta chưa từng trách chàng.',
  '— Trời trở lạnh rồi, nàng nên vào trong đi.',
  '— Nếu có kiếp sau, ta mong mình gặp nhau sớm hơn một chút.',
  '— Đừng hỏi nữa. Có những chuyện, biết rồi lại chẳng vui gì.',
  '— Ta hứa với nàng, lần này sẽ không để nàng phải đợi nữa.',
  '— Người đâu, chuẩn bị xe ngựa. Ta phải vào cung ngay đêm nay.',
  '— Nàng nghĩ ta không nhìn ra sao? Đôi mắt nàng chưa bao giờ biết nói dối.',
  '— Chỉ là một giấc mộng thôi mà. Tỉnh dậy rồi sẽ quên.',
  '— Ngày mai, dù có chuyện gì xảy ra, nàng cũng phải sống thật tốt.',
]

/** Đoạn văn cách nhau bằng dòng trống; đoạn đầu luôn là lời kể (để làm chữ hoa đầu chương) */
export function mockChapterContent(slug: string, number: number): string {
  const rand = seededRandom(`${slug}#${number}`)
  const count = 16 + Math.floor(rand() * 12)
  return Array.from({ length: count }, (_, i) => {
    if (i > 0 && rand() < 0.3) return pick(rand, dialogue)
    // Bốc câu không lặp trong cùng một đoạn
    const pool = [...narration]
    const sentences = 2 + Math.floor(rand() * 3)
    return Array.from(
      { length: sentences },
      () => pool.splice(Math.floor(rand() * pool.length), 1)[0],
    ).join(' ')
  }).join('\n\n')
}
