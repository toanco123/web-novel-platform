import type { Author, Genre, Story } from '@/types/story'

export const genres: Genre[] = [
  { slug: 'ngon-tinh', name: 'Ngôn tình' },
  { slug: 'co-dai', name: 'Cổ đại' },
  { slug: 'hien-dai', name: 'Hiện đại' },
  { slug: 'tong-tai', name: 'Tổng tài' },
  { slug: 'xuyen-khong', name: 'Xuyên không' },
  { slug: 'trong-sinh', name: 'Trọng sinh' },
  { slug: 'cung-dau', name: 'Cung đấu' },
  { slug: 'huyen-huyen', name: 'Huyền huyễn' },
  { slug: 'dien-van', name: 'Điền văn' },
  { slug: 'sung', name: 'Sủng' },
  { slug: 'nguoc', name: 'Ngược' },
  { slug: 'hai-huoc', name: 'Hài hước' },
]

const g = (...slugs: string[]) => slugs.map((s) => genres.find((x) => x.slug === s)!)
const a = (slug: string, name: string): Author => ({ slug, name })

const HOUR = 3600 * 1000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()

type Seed = Omit<
  Story,
  | 'id'
  | 'coverUrl'
  | 'firstChapterNumber'
  | 'latestChapter'
  | 'createdAt'
  | 'updatedAt'
  | 'ownerId'
  | 'visibility'
> & {
  latestTitle: string
  createdDaysAgo: number
  updatedHoursAgo: number
}

const seeds: Seed[] = [
  {
    slug: 'truong-an-khong-tuyet',
    title: 'Trường An Không Tuyết',
    author: a('diep-thanh-y', 'Diệp Thanh Y'),
    genres: g('ngon-tinh', 'co-dai', 'cung-dau'),
    status: 'ongoing',
    description:
      'Năm Trường An không có tuyết, Thẩm Chiêu Ninh gả vào Đông cung để trả món nợ của cả nhà họ Thẩm. Thái tử lạnh nhạt, hậu cung đầy mưu kế, nàng chỉ định sống sót qua ba năm rồi rời đi. Nhưng người đã cứu nàng trong trận tuyết cuối cùng mười năm trước, hóa ra vẫn đang đứng ngay trước mắt.',
    chapterCount: 412,
    viewCount: 3_840_000,
    ratingAvg: 4.8,
    ratingCount: 12_430,
    latestTitle: 'Đêm trừ tịch',
    createdDaysAgo: 210,
    updatedHoursAgo: 0.4,
  },
  {
    slug: 'chu-tich-anh-da-den-muon',
    title: 'Chủ Tịch, Anh Đã Đến Muộn',
    author: a('mac-ninh', 'Mặc Ninh'),
    genres: g('ngon-tinh', 'hien-dai', 'tong-tai', 'nguoc'),
    status: 'completed',
    description:
      'Ba năm hôn nhân, Lâm Vãn chỉ là cái bóng của một người đã khuất. Ngày cô ký đơn ly hôn cũng là ngày Cố Diễn Chi phát hiện ra sự thật về đêm mưa năm ấy. Lần này, người phải đuổi theo là anh.',
    chapterCount: 186,
    viewCount: 5_120_000,
    ratingAvg: 4.6,
    ratingCount: 20_115,
    latestTitle: 'Ngoại truyện: Mùa hoa sơn chi',
    createdDaysAgo: 400,
    updatedHoursAgo: 72,
  },
  {
    slug: 'xuyen-thanh-nu-phu-doc-ac',
    title: 'Xuyên Thành Nữ Phụ Độc Ác, Tôi Chỉ Muốn Trồng Rau',
    author: a('tieu-man-dau', 'Tiểu Màn Thầu'),
    genres: g('xuyen-khong', 'dien-van', 'hai-huoc', 'sung'),
    status: 'ongoing',
    description:
      'Tỉnh dậy trong thân phận nữ phụ bị cả kinh thành ghét bỏ, Tô Tiểu Mãn quyết định tránh xa nam chính, về quê mở một mảnh vườn. Ai ngờ vị tướng quân lạnh lùng ở nhà bên cứ ba ngày lại sang xin một bó rau.',
    chapterCount: 298,
    viewCount: 2_210_000,
    ratingAvg: 4.7,
    ratingCount: 8_902,
    latestTitle: 'Mùa dưa hấu đầu tiên',
    createdDaysAgo: 150,
    updatedHoursAgo: 1.2,
  },
  {
    slug: 'trong-sinh-chi-dich-nu-phong-hoa',
    title: 'Trọng Sinh Chi Đích Nữ Phong Hoa',
    author: a('van-chi', 'Vân Chi'),
    genres: g('trong-sinh', 'co-dai', 'cung-dau'),
    status: 'completed',
    description:
      'Kiếp trước, nàng tin nhầm thứ muội, mất cả gia tộc. Mở mắt ra lần nữa, Phong Hoa trở về năm mười lăm tuổi, ngay trước ngày yến tiệc định mệnh. Lần này, từng món nợ nàng sẽ đòi lại đủ.',
    chapterCount: 520,
    viewCount: 6_780_000,
    ratingAvg: 4.9,
    ratingCount: 31_200,
    latestTitle: 'Đại kết cục',
    createdDaysAgo: 620,
    updatedHoursAgo: 240,
  },
  {
    slug: 'sau-khi-ly-hon-toi-thanh-anh-hau',
    title: 'Sau Khi Ly Hôn, Tôi Thành Ảnh Hậu',
    author: a('hanh-nhan', 'Hạnh Nhân'),
    genres: g('hien-dai', 'ngon-tinh', 'sung'),
    status: 'ongoing',
    description:
      'Rời khỏi nhà họ Hạ với hai bàn tay trắng, Giang Nguyệt quay lại con đường diễn xuất bị bỏ dở. Ba năm sau, trên thảm đỏ, chồng cũ đứng dưới khán đài vỗ tay cho cô.',
    chapterCount: 164,
    viewCount: 1_430_000,
    ratingAvg: 4.5,
    ratingCount: 5_320,
    latestTitle: 'Buổi thử vai',
    createdDaysAgo: 60,
    updatedHoursAgo: 2.5,
  },
  {
    slug: 'kiem-tien-duyen',
    title: 'Kiếm Tiên Duyên',
    author: a('luc-thuong', 'Lục Thương'),
    genres: g('huyen-huyen', 'ngon-tinh'),
    status: 'ongoing',
    description:
      'Nàng là kiếm linh bị phong ấn nghìn năm trong thanh kiếm gãy. Hắn là đệ tử ngoại môn không ai để mắt. Một người muốn thoát khỏi xiềng xích, một người muốn bước lên đỉnh cao tu tiên giới.',
    chapterCount: 356,
    viewCount: 2_960_000,
    ratingAvg: 4.6,
    ratingCount: 9_870,
    latestTitle: 'Kiếm trủng',
    createdDaysAgo: 300,
    updatedHoursAgo: 4,
  },
  {
    slug: 'nguoi-thua-ke-bi-bo-roi',
    title: 'Người Thừa Kế Bị Bỏ Rơi',
    author: a('mac-ninh', 'Mặc Ninh'),
    genres: g('hien-dai', 'tong-tai', 'trong-sinh'),
    status: 'ongoing',
    description:
      'Bị đuổi khỏi nhà vào đúng ngày sinh nhật mười tám tuổi, Tống Dao mới biết mình là con gái thật bị tráo đổi. Cô không cần ai nhận lại, chỉ cần lấy về những gì vốn thuộc về mình.',
    chapterCount: 88,
    viewCount: 640_000,
    ratingAvg: 4.3,
    ratingCount: 2_100,
    latestTitle: 'Tiệc đính hôn',
    createdDaysAgo: 12,
    updatedHoursAgo: 0.1,
  },
  {
    slug: 'hoa-no-nam-ay',
    title: 'Hoa Nở Năm Ấy',
    author: a('diep-thanh-y', 'Diệp Thanh Y'),
    genres: g('hien-dai', 'ngon-tinh', 'nguoc'),
    status: 'completed',
    description:
      'Mối tình đầu năm mười bảy tuổi kết thúc bằng một lá thư không gửi. Mười năm sau, họ gặp lại trong phòng bệnh, cô là bác sĩ điều trị, còn anh là người bệnh không còn nhiều thời gian.',
    chapterCount: 72,
    viewCount: 1_890_000,
    ratingAvg: 4.8,
    ratingCount: 11_040,
    latestTitle: 'Lá thư thứ một trăm',
    createdDaysAgo: 500,
    updatedHoursAgo: 800,
  },
  {
    slug: 'phu-nhan-lai-bo-tron-roi',
    title: 'Phu Nhân Lại Bỏ Trốn Rồi',
    author: a('tieu-man-dau', 'Tiểu Màn Thầu'),
    genres: g('co-dai', 'hai-huoc', 'sung'),
    status: 'ongoing',
    description:
      'Gả cho Nhiếp chính vương nổi tiếng tàn nhẫn, việc đầu tiên Khương Đào làm là thu dọn tay nải. Lần thứ bảy bị bắt về, vương gia chỉ thở dài bảo người chuẩn bị thêm một chiếc xe ngựa.',
    chapterCount: 132,
    viewCount: 980_000,
    ratingAvg: 4.6,
    ratingCount: 4_210,
    latestTitle: 'Lần bỏ trốn thứ tám',
    createdDaysAgo: 20,
    updatedHoursAgo: 6,
  },
  {
    slug: 'mong-hoa-luc',
    title: 'Mộng Hoa Lục',
    author: a('van-chi', 'Vân Chi'),
    genres: g('co-dai', 'huyen-huyen', 'ngon-tinh'),
    status: 'ongoing',
    description:
      'Mỗi đêm, tiểu thư nhà họ Bạch đều mơ thấy cùng một người đàn ông đứng dưới gốc hoa lê. Đến khi y thật sự bước vào phủ với thân phận thầy dạy đàn, những giấc mơ bắt đầu thành sự thật.',
    chapterCount: 45,
    viewCount: 210_000,
    ratingAvg: 4.4,
    ratingCount: 870,
    latestTitle: 'Khúc đàn thứ ba',
    createdDaysAgo: 5,
    updatedHoursAgo: 3,
  },
  {
    slug: 'co-vo-hop-dong-cua-giam-doc',
    title: 'Cô Vợ Hợp Đồng Của Giám Đốc',
    author: a('hanh-nhan', 'Hạnh Nhân'),
    genres: g('hien-dai', 'tong-tai', 'sung'),
    status: 'completed',
    description:
      'Một bản hợp đồng hôn nhân một năm, điều khoản thứ nhất: không được yêu nhau. Đến tháng thứ mười một, người muốn xé hợp đồng lại là anh.',
    chapterCount: 240,
    viewCount: 4_310_000,
    ratingAvg: 4.5,
    ratingCount: 16_780,
    latestTitle: 'Ngoại truyện: Tuần trăng mật',
    createdDaysAgo: 700,
    updatedHoursAgo: 1500,
  },
  {
    slug: 'thap-nien-tam-muoi-lam-giau',
    title: 'Thập Niên Tám Mươi Làm Giàu Nuôi Con',
    author: a('luc-thuong', 'Lục Thương'),
    genres: g('xuyen-khong', 'dien-van', 'trong-sinh'),
    status: 'ongoing',
    description:
      'Xuyên về năm 1983, thành mẹ đơn thân của hai đứa nhỏ gầy gò, Chu Mai bắt đầu từ gánh bánh bao đầu ngõ. Bán hàng, mở tiệm, xây nhà, nuôi con, còn chuyện tái hôn thì để sau hẵng tính.',
    chapterCount: 61,
    viewCount: 330_000,
    ratingAvg: 4.7,
    ratingCount: 1_450,
    latestTitle: 'Cửa tiệm đầu tiên',
    createdDaysAgo: 8,
    updatedHoursAgo: 0.8,
  },
  {
    slug: 'dong-cung-co-mot-ke-ngoc',
    title: 'Đông Cung Có Một Kẻ Ngốc',
    author: a('diep-thanh-y', 'Diệp Thanh Y'),
    genres: g('co-dai', 'cung-dau', 'hai-huoc'),
    status: 'ongoing',
    description:
      'Cả kinh thành đều biết Thái tử phi là một kẻ ngốc. Chỉ có Thái tử biết, kẻ ngốc ấy đã âm thầm đổi ba bát thuốc độc của hắn.',
    chapterCount: 27,
    viewCount: 150_000,
    ratingAvg: 4.5,
    ratingCount: 610,
    latestTitle: 'Bát canh sen',
    createdDaysAgo: 3,
    updatedHoursAgo: 9,
  },
  {
    slug: 'gio-thoi-qua-ngo-nho',
    title: 'Gió Thổi Qua Ngõ Nhỏ',
    author: a('mac-ninh', 'Mặc Ninh'),
    genres: g('hien-dai', 'ngon-tinh'),
    status: 'ongoing',
    description:
      'Một tiệm sách cũ ở cuối ngõ, một cô chủ ít nói và một vị khách ngày nào cũng đến lúc năm giờ chiều nhưng chưa từng mua cuốn nào.',
    chapterCount: 19,
    viewCount: 90_000,
    ratingAvg: 4.6,
    ratingCount: 320,
    latestTitle: 'Cuốn sách không có tên',
    createdDaysAgo: 2,
    updatedHoursAgo: 12,
  },
]

export const stories: Story[] = seeds.map(
  ({ latestTitle, createdDaysAgo, updatedHoursAgo, ...s }, i) => ({
    ...s,
    id: String(i + 1),
    coverUrl: null,
    ownerId: null,
    visibility: 'published' as const,
    firstChapterNumber: 1,
    latestChapter: { number: s.chapterCount, title: latestTitle },
    createdAt: ago(createdDaysAgo * 24),
    updatedAt: ago(updatedHoursAgo),
  }),
)

// Danh sách chọn tay (sau này là cột/bảng riêng trên Supabase)
export const featuredSlugs = [
  'truong-an-khong-tuyet',
  'xuyen-thanh-nu-phu-doc-ac',
  'sau-khi-ly-hon-toi-thanh-anh-hau',
  'kiem-tien-duyen',
]
export const editorPickSlugs = [
  'trong-sinh-chi-dich-nu-phong-hoa',
  'hoa-no-nam-ay',
  'phu-nhan-lai-bo-tron-roi',
  'chu-tich-anh-da-den-muon',
  'thap-nien-tam-muoi-lam-giau',
  'mong-hoa-luc',
  'kiem-tien-duyen',
  'co-vo-hop-dong-cua-giam-doc',
]
