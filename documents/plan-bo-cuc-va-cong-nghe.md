# Plan: Web đọc truyện chữ — Bố cục & Công nghệ

## Context
Dự án mới từ đầu (thư mục `web-truyen` đang trống). Mục tiêu: web đọc **truyện chữ** (kiểu TruyenFull/Wattpad), làm **UI trước** bằng React + Tailwind với dữ liệu giả (mock), sau đó nối **Supabase** làm backend.
Phạm vi giai đoạn đầu: đọc truyện, đăng nhập, tủ truyện + lịch sử đọc, bình luận/đánh giá. **Chưa có trang Admin** (nội dung nhập qua Supabase Dashboard / SQL seed).

---

## 1. Công nghệ sử dụng

| Mảng | Lựa chọn | Lý do |
|---|---|---|
| Build tool | **Vite** + **React 19** + **TypeScript** | Nhanh, nhẹ, SPA như bạn chọn |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Không cần config file, hỗ trợ dark mode dễ |
| UI component | **shadcn/ui** (Radix) + **lucide-react** (icon) | Copy component vào code, tự sửa được, không bị khóa thư viện |
| Routing | **React Router v8** (data router, lazy route) | Chuẩn cho SPA |
| Gọi dữ liệu / cache | **TanStack Query** | Cache, loading/error, phân trang, infinite scroll |
| State client | **Zustand** (+ persist localStorage) | Lưu cài đặt đọc: font, cỡ chữ, màu nền, theme |
| Form | **react-hook-form** + **zod** | Đăng nhập, đăng ký, bình luận |
| SEO cơ bản | Thẻ `<title>`/`<meta>` native của React 19 | SPA SEO hạn chế — chấp nhận, có thể thêm prerender sau |
| Backend | **Supabase**: Postgres, Auth (email + Google), Storage (ảnh bìa), RLS | Không phải tự viết server |
| Chất lượng code | oxlint + Prettier, Vitest + Testing Library | |
| Deploy | **Vercel** (nối repo GitHub, push `main` tự deploy) | `vercel.json` rewrite mọi route về `index.html` |

---

## 2. Bố cục chung (Layout)

```
┌──────────────────────────────────────────────────────┐
│ HEADER: Logo | Thể loại ▾ | Danh sách ▾ | 🔍 Tìm kiếm │
│                               | 🌙 Theme | Avatar/Login│
├──────────────────────────────────────────────────────┤
│                                                      │
│                  NỘI DUNG TRANG                      │
│        (container max-w-6xl, grid 2 cột trên PC)     │
│                                                      │
├──────────────────────────────────────────────────────┤
│ FOOTER: Giới thiệu | Liên hệ | Điều khoản | Thể loại │
└──────────────────────────────────────────────────────┘
Mobile: header thu gọn → nút ☰ mở Drawer menu, ô tìm kiếm thành icon.
```

Có 2 layout:
- **MainLayout**: header + footer — dùng cho mọi trang trừ trang đọc.
- **ReaderLayout**: tối giản, thanh công cụ tự ẩn khi cuộn — dùng cho trang đọc chương.

---

## 3. Các trang & bố cục từng trang

### 3.1 Trang chủ `/`
```
[ Banner / Truyện đề cử (carousel) ]
┌────────────────────────────┬─────────────────┐
│ Truyện HOT (grid ảnh bìa)  │ Đang đọc dở     │ ← chỉ khi đã login
│                            │ (tiếp tục đọc)  │
│ Mới cập nhật (bảng: tên,   ├─────────────────┤
│  thể loại, chương mới,     │ Bảng xếp hạng   │
│  thời gian)                │ Ngày/Tuần/Tháng │
│                            ├─────────────────┤
│ Truyện đã hoàn thành       │ Thể loại (tag)  │
└────────────────────────────┴─────────────────┘
```

### 3.2 Chi tiết truyện `/truyen/:slug`
```
┌──────────┬───────────────────────────────────┐
│ Ảnh bìa  │ Tên truyện                        │
│          │ Tác giả · Thể loại · Trạng thái   │
│          │ ★ 4.5 (120 lượt) · 👁 lượt xem     │
│          │ [Đọc từ đầu] [Đọc tiếp] [+Tủ truyện]│
└──────────┴───────────────────────────────────┘
Tabs: [Giới thiệu] [Danh sách chương] [Bình luận]
- Giới thiệu: mô tả (thu gọn/mở rộng)
- Danh sách chương: phân trang 50 chương/trang, sắp xếp tăng/giảm
- Bình luận + đánh giá sao
Sidebar: Truyện cùng tác giả, Truyện cùng thể loại
```

### 3.3 Trang đọc chương `/truyen/:slug/chuong-:number` (quan trọng nhất)
```
[ Thanh trên: ← Tên truyện | Chương 12: Tiêu đề | ⚙ Cài đặt ]
[ ‹ Chương trước ]  [ Chọn chương ▾ ]  [ Chương sau › ]

        Nội dung chương (max-w-3xl, căn giữa,
        line-height rộng, font serif tùy chọn)

[ ‹ Chương trước ]  [ Danh sách ]  [ Chương sau › ]
[ Bình luận chương ]
```
- **Panel cài đặt đọc**: font (serif/sans), cỡ chữ, giãn dòng, độ rộng khung, màu nền (trắng / vàng giấy / xám / đen).
- Phím tắt ← → chuyển chương; thanh tiến độ đọc trên cùng.
- Tự lưu **lịch sử đọc** (chương + vị trí cuộn).

**Đã làm UI (25/09/2026)**, dữ liệu giả:
- Route `truyen/:slug/:chapter` dưới `ReaderLayout` (React Router không nhận tham số giữa đoạn kiểu `chuong-:number`, nên `ChapterReaderPage` tự tách số chương; sai dạng thì báo "Đường dẫn chương không hợp lệ").
- Thanh công cụ trên cùng: ← về trang truyện, trang chủ, tên truyện + chương, nút **Mục lục** và **Cài đặt**. Thanh tự ẩn khi cuộn xuống, hiện lại khi cuộn lên hoặc tới đầu/cuối trang; chạm vào vùng chữ để ẩn/hiện (tiện trên điện thoại). Có thanh tiến độ đọc mỏng ở mép trên.
- Đầu chương: tên truyện, "Chương N", tiêu đề, ngày đăng, số chữ, thời gian đọc ước tính. Thanh chuyển chương nằm ở đầu và cuối chương. Chữ cái đầu chương viết hoa lớn, bỏ qua khi đoạn đầu là lời thoại.
- Cuối chương: thẻ "Đọc tiếp chương N + tiêu đề". Nếu hết chương thì báo "đã đọc hết truyện" hoặc "đã tới chương mới nhất" (kèm nút Thêm vào tủ truyện).
- **Mục lục** (Sheet): mở sẵn trang 50 chương có chương đang đọc và cuộn tới chương đó; có chọn khoảng chương và ô "đi tới chương".
- **Cài đặt đọc** (Sheet bên phải trên màn rộng, trượt từ dưới lên trên điện thoại; lớp phủ trong suốt để thấy chữ đổi ngay). Gồm:
  - Màu nền: Theo web / Trắng / Giấy vàng / Xám / Đen.
  - Phông: Literata (có chân) / Be Vietnam Pro (không chân).
  - Cỡ chữ 15–28px, giãn dòng 1.5–2.3, độ rộng khung Hẹp / Vừa / Rộng.
  - Lưu ở Zustand key `reader-settings`.
- Phím ← → chuyển chương (không kích hoạt khi đang gõ hoặc đang mở hộp thoại). Chương kế được tải trước.
- Bổ sung (25/09/2026, chi tiết ở `plan-trang-con-thieu-va-tinh-nang-doc.md`): lịch sử đọc + "Đọc tiếp" (nhớ vị trí cuộn), bình luận theo chương, báo lỗi chương, nghe truyện (Web Speech API), chế độ cuộn liên tục.

**Khi nối API thật**, chỉ thay ruột `getChapter(slug, number)` trong `features/chapters/api.ts`. Hàm phải trả về `ChapterContent` (`src/types/chapter.ts`):
- `story`: `{ slug, title, author, status, chapterCount }`.
- `number`, `title`, `content`. `content` là văn bản thuần, các đoạn cách nhau bằng dòng trống.
- `publishedAt`.
- `prev` / `next`: `{ number, title } | null`, lấy theo **thứ tự chương đã xuất bản** (không phải number ± 1, vì chương nháp bị ẩn).
- Trả về `null` khi không có truyện hoặc chương.

Với Supabase: 1 query lấy chương `status = 'published'`; chương trước/sau lấy bằng `order by number` + `limit 1` hai phía (hoặc một hàm RPC). Giao diện giữ nguyên.

### 3.4 Danh sách / lọc `/the-loai/:slug`, `/danh-sach/:type` (hot, mới, hoàn thành)
Bộ lọc (thể loại, trạng thái, số chương, sắp xếp) + grid/list truyện + phân trang.

### 3.5 Tìm kiếm `/tim-kiem?q=`
Gợi ý nhanh dạng dropdown ngay ở header (debounce) + trang kết quả đầy đủ.

### 3.6 Tài khoản
- `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`
- `/tu-truyen`: tab **Đang theo dõi** / **Lịch sử đọc**
- `/tai-khoan`: đổi tên, avatar, mật khẩu

### 3.7 Trang 404

---

## 4. Cấu trúc thư mục (feature-based)

```
web-truyen/
├── src/
│   ├── app/            # router.tsx, providers.tsx (QueryClient, Theme, Auth)
│   ├── layouts/        # MainLayout, ReaderLayout
│   ├── pages/          # Home, StoryDetail, Reader, Genre, Search, Library, Auth, NotFound
│   ├── features/
│   │   ├── stories/    # StoryCard, StoryGrid, StoryTable, api + hooks
│   │   ├── chapters/   # ChapterList, ChapterNav, api + hooks
│   │   ├── reader/     # ReaderSettingsPanel, useReaderSettings (zustand)
│   │   ├── auth/       # LoginForm, RegisterForm, useAuth
│   │   ├── library/    # bookmark, reading history
│   │   └── comments/   # CommentList, CommentForm, RatingStars
│   ├── components/
│   │   ├── ui/         # shadcn: button, dialog, tabs, sheet, dropdown...
│   │   └── common/     # Header, Footer, SearchBox, Pagination, Skeleton...
│   ├── lib/            # supabase.ts, utils.ts (cn, slugify, formatTime)
│   ├── mocks/          # dữ liệu giả dùng khi làm UI
│   ├── types/          # Story, Chapter, Genre, Comment...
│   └── index.css       # @import "tailwindcss"; + theme tokens
├── supabase/migrations/  # (giai đoạn BE)
└── .env                  # HOST, PORT (dev server), VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

**Nguyên tắc để chuyển mock → Supabase dễ**: mỗi feature có file `api.ts` là nơi duy nhất lấy dữ liệu. Giai đoạn UI, `api.ts` trả mock; giai đoạn BE chỉ đổi ruột `api.ts` sang gọi Supabase, component không phải sửa.

---

## 5. Phác thảo database Supabase (cho giai đoạn BE)

- `profiles` (id → auth.users, username, avatar_url)
- `authors`, `genres`
- `stories` (slug, title, author_id, cover_url, description, status, view_count, rating_avg, updated_at)
- `story_genres` (story_id, genre_id)
- `chapters` (story_id, number, title, content, created_at) — index (story_id, number)
- `bookmarks` (user_id, story_id)
- `reading_history` (user_id, story_id, chapter_id, scroll_pos, updated_at)
- `comments` (user_id, story_id, chapter_id nullable, content, parent_id)
- `ratings` (user_id, story_id, score 1–5)
- RLS: truyện/chương đọc công khai; bookmark/history/comment/rating chỉ chủ sở hữu được ghi.
- Tìm kiếm: Postgres full-text search (`unaccent` để tìm không dấu).

---

## 6. Lộ trình triển khai

1. **Khởi tạo** ✅ (25/09/2026): Vite 8 + React 19 + TS, Tailwind v4, shadcn/ui (preset Nova, Radix), React Router v8, TanStack Query, Zustand, oxlint/Prettier, Vitest.
2. **Nền UI** ✅ (25/09/2026): theme sáng/tối, MainLayout, Header (menu, search, mobile drawer), Footer, component chung.
3. **Mock data** + các trang: Trang chủ ✅ (25/09/2026) → Chi tiết truyện ✅ (25/09/2026, chi tiết ở `plan-trang-chi-tiet-truyen.md`) → Trang đọc ✅ (25/09/2026, UI + cài đặt đọc + lịch sử đọc) → Thể loại/Danh sách/Bảng xếp hạng ✅ → Tìm kiếm ✅ (25/09/2026, chi tiết ở `plan-trang-con-thieu-va-tinh-nang-doc.md`).
4. **UI tài khoản**: đăng nhập/đăng ký ✅ (25/09/2026, chi tiết ở `plan-dang-nhap-dang-ky.md`), nút tủ truyện + bình luận/đánh giá ✅ (trên trang chi tiết), trang Tủ truyện + lịch sử đọc + báo chương mới ✅, trang Tài khoản ✅, trang thông tin (giới thiệu/liên hệ/điều khoản/bảo mật) ✅ (25/09/2026, vẫn mock).
4c. **Tính năng đọc & tác giả** ✅ (25/09/2026): nghe truyện, cuộn liên tục, bình luận chương, báo lỗi chương, thống kê + báo lỗi trong khu Sáng tác.
4b. **Sáng tác & thể loại** ✅ (25/09/2026, chi tiết ở `plan-sang-tac-va-the-loai.md`): tạo thể loại, đăng truyện, soạn/nhập chương, xuất bản.
5. **Nối Supabase**: tạo schema + RLS + seed, Auth, thay `api.ts` từng feature.
6. Hoàn thiện: skeleton loading, trạng thái lỗi/trống, responsive, meta SEO, deploy ✅ (25/09/2026: Vercel nối repo GitHub, push `main` tự deploy lên https://web-novel-platform-gules.vercel.app).

---

## 7. Kiểm tra (verification)
- `npm run dev` → duyệt tay từng route trên PC và mobile (DevTools / Playwright chụp màn hình ở 375px và 1280px).
- Trang đọc: đổi font/cỡ chữ/nền → reload vẫn giữ; ← → chuyển chương đúng.
- `npm run build` + `npm run lint` + `npm run test` pass.
- Giai đoạn BE: login thật, thêm tủ truyện, kiểm tra RLS (user A không sửa được dữ liệu user B).

---

## 8. Hệ thiết kế (chốt 25/09/2026)

Lấy cảm hứng từ brief "Mộng Truyện" (romance, tông tối), áp cho **truyện chữ**. Chưa làm: VIP Pass, nhãn 18+, widget hỗ trợ; tên web vẫn là "Web Truyện" (đổi ở `src/config/site.ts`).

- **Màu** (token trong `src/index.css`, mặc định giao diện tối):
  - Nền tím mận `#1A0F1D`, bề mặt `#24152A`, chữ `#F4E7ED`
  - Burgundy `#7A1F3D` (`wine`), vàng hồng `#D9A68F` (`rose-gold`), hồng neon `#FF3D8B` (`neon` / `primary`, chỉ cho điểm nhấn và nút chính)
  - Giao diện sáng: nền giấy hồng `#FBF4F6`, chữ `#2A1530`, primary `#B0144F`
- **Font** (đều có bộ tiếng Việt, tự host qua @fontsource):
  - Great Vibes: logo thư pháp (`font-script`)
  - Cormorant Garamond: tiêu đề, số thứ hạng (`font-heading`)
  - Be Vietnam Pro: giao diện, nội dung (`font-sans`)
- **Bìa chữ tự sinh** (`StoryCover`): truyện chưa có ảnh bìa sẽ có bìa màu theo slug + tên truyện chữ serif; `compact` cho bìa nhỏ.
- **Trang chủ** (từ trên xuống): Header kính mờ 2 tầng (logo, tìm kiếm + gợi ý thể loại, đổi theme, đăng nhập / thanh pill điều hướng) → Banner truyện nổi bật (tự chuyển 7s theo thanh tiến độ, dừng khi hover/focus, tắt khi bật giảm chuyển động) → Truyện đề cử (hàng cuộn ngang) → [Mới cập nhật + Truyện mới ra | Top tuần + Thể loại] → Footer.
- **Responsive**: kiểm tra ở 375px, 768px, 1440px, không cuộn ngang. Mobile: menu trượt trái, nút đăng nhập thành icon, banner ẩn bìa lớn.

