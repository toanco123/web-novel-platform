// Tập trung mọi đường dẫn để không viết URL cứng rải rác trong component
export const paths = {
  home: '/',
  story: (slug: string) => `/story/${slug}`,
  chapter: (slug: string, number: number) => `/story/${slug}/chapter-${number}`,
  genre: (slug: string) => `/genres/${slug}`,
  latest: '/list/latest',
  completed: '/list/completed',
  ongoing: '/list/ongoing',
  ranking: '/ranking',
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : '/search'),
  login: (next?: string) => withNext('/login', next),
  register: (next?: string) => withNext('/register', next),
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  /** Đích quay về sau khi đăng nhập Google/Facebook hoặc bấm link xác nhận email */
  authCallback: '/auth/callback',
  account: '/account',
  genres: '/genres',
  studio: '/studio',
  /** genre: chọn sẵn thể loại trong form đăng truyện */
  studioNewStory: (genre?: string) =>
    genre ? `/studio/new-story?genre=${encodeURIComponent(genre)}` : '/studio/new-story',
  /** tab: mở sẵn tab của trang quản lý truyện (mặc định tab Chương) */
  studioStory: (id: string, tab?: 'stats' | 'reports' | 'info') =>
    tab ? `/studio/story/${id}?tab=${tab}` : `/studio/story/${id}`,
  /** number: điền sẵn số chương (viết bù chương còn trống) */
  studioNewChapter: (id: string, number?: number) =>
    number ? `/studio/story/${id}/new-chapter?number=${number}` : `/studio/story/${id}/new-chapter`,
  studioChapter: (id: string, number: number) => `/studio/story/${id}/chapter/${number}`,
  studioImport: (id: string) => `/studio/story/${id}/import`,
  library: '/library',
  readingHistory: '/library?tab=history',
  /** Tab "Đã lưu" của tủ truyện: chương đọc được khi không có mạng */
  savedChapters: '/library?tab=saved',
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  /** Trang quản trị (chỉ quản trị viên) */
  admin: '/admin',
  adminUsers: '/admin/users',
  /** Trang người dùng đã tìm sẵn theo tên hoặc email */
  adminUserSearch: (q: string) => `/admin/users?q=${encodeURIComponent(q)}`,
  /** ownerId: chỉ hiện truyện của một người dùng */
  adminStories: (ownerId?: string) =>
    ownerId ? `/admin/stories?owner=${encodeURIComponent(ownerId)}` : '/admin/stories',
  adminInbox: '/admin/inbox',
  adminReports: '/admin/reports',
  /** Kiểm duyệt bình luận (mặc định: bình luận đang bị báo cáo) */
  adminComments: '/admin/comments',
  adminGenres: '/admin/genres',
  adminImport: '/admin/import',
  /** Chọn truyện cho banner nổi bật và khối đề cử của trang chủ */
  adminFeatured: '/admin/featured',
}

function withNext(path: string, next?: string) {
  return next && next !== '/' ? `${path}?next=${encodeURIComponent(next)}` : path
}
