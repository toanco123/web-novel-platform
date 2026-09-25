// Tập trung mọi đường dẫn để không viết URL cứng rải rác trong component
export const paths = {
  home: '/',
  story: (slug: string) => `/truyen/${slug}`,
  chapter: (slug: string, number: number) => `/truyen/${slug}/chuong-${number}`,
  genre: (slug: string) => `/the-loai/${slug}`,
  latest: '/danh-sach/moi-cap-nhat',
  completed: '/danh-sach/hoan-thanh',
  ongoing: '/danh-sach/dang-ra',
  ranking: '/bang-xep-hang',
  search: (q?: string) => (q ? `/tim-kiem?q=${encodeURIComponent(q)}` : '/tim-kiem'),
  login: (next?: string) => withNext('/dang-nhap', next),
  register: (next?: string) => withNext('/dang-ky', next),
  forgotPassword: '/quen-mat-khau',
  resetPassword: '/dat-lai-mat-khau',
  account: '/tai-khoan',
  genres: '/the-loai',
  studio: '/sang-tac',
  /** genre: chọn sẵn thể loại trong form đăng truyện */
  studioNewStory: (genre?: string) =>
    genre ? `/sang-tac/truyen-moi?the-loai=${encodeURIComponent(genre)}` : '/sang-tac/truyen-moi',
  /** tab: mở sẵn tab của trang quản lý truyện (mặc định tab Chương) */
  studioStory: (id: string, tab?: 'thong-ke' | 'bao-loi' | 'thong-tin') =>
    tab ? `/sang-tac/truyen/${id}?muc=${tab}` : `/sang-tac/truyen/${id}`,
  studioNewChapter: (id: string) => `/sang-tac/truyen/${id}/chuong-moi`,
  studioChapter: (id: string, number: number) => `/sang-tac/truyen/${id}/chuong/${number}`,
  studioImport: (id: string) => `/sang-tac/truyen/${id}/nhap-file`,
  library: '/tu-truyen',
  readingHistory: '/tu-truyen?muc=lich-su',
  about: '/gioi-thieu',
  contact: '/lien-he',
  terms: '/dieu-khoan',
  privacy: '/bao-mat',
}

function withNext(path: string, next?: string) {
  return next && next !== '/' ? `${path}?next=${encodeURIComponent(next)}` : path
}
