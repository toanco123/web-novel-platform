# Plan: Tạo thể loại & Đăng truyện cho người dùng

## Context
Hiện web chỉ đọc được truyện có sẵn (mảng giả trong `src/mocks/stories.ts`); thể loại là danh sách cố định. Người dùng muốn **tự tạo thể loại** và **tự đăng truyện** (thông tin truyện, ảnh bìa, chương) để người khác đọc.

Đã chốt với người dùng:
- **Thể loại:** user đã đăng nhập tạo được, hiện ngay, hệ thống chặn trùng tên (kể cả khác dấu/hoa thường).
- **Nội dung chương:** vừa soạn từng chương trên web, vừa tải file `.txt` tự tách chương (xem trước rồi mới lưu).
- **Duyệt:** không cần admin. Truyện/chương mới là **bản nháp** chỉ tác giả thấy; bấm **Xuất bản** thì công khai ngay.
- **Ảnh bìa:** tải ảnh lên (không bắt buộc), tự cắt khung 2:3; không có thì dùng bìa chữ tự sinh.

Vẫn giữ quy tắc dự án: làm UI với **dữ liệu giả** (`localStorage`), mọi đọc/ghi đi qua `features/<x>/api.ts`; khi nối Supabase chỉ thay ruột api.
**Trạng thái:** ✅ Hoàn thành cả 3 giai đoạn A, B, C với dữ liệu giả (25/09/2026).

Khác với plan:
- Thêm trang `/the-loai/:slug` (danh sách truyện theo thể loại) để thể loại vừa tạo không dẫn tới trang 404.
- `parseChapters` đặt ở `src/features/studio/parseChapters.ts` (thay vì `src/lib/`) vì dùng giới hạn độ dài chương của khu Sáng tác.
- `HeroShowcase` không cần sửa: banner chỉ hiện truyện đề cử có sẵn, luôn có đánh giá.
- Danh sách gợi ý thể loại tự đóng sau mỗi lần chọn (để không che phần form bên dưới).
- Bổ sung sau (25/09/2026), theo phản hồi "đăng truyện chỉ thấy ở trang tạo thể loại":
  - Header có nút **"Đăng truyện"** (desktop: icon + chữ; tablet: icon; mobile: trong menu trượt).
  - **Mọi** trang thể loại có nút "Đăng truyện {thể loại}", mở form với thể loại đó chọn sẵn (`/sang-tac/truyen-moi?the-loai=slug`; slug không có thật thì bỏ qua). Trang `/the-loai` cũng có nút "Đăng truyện".
- Tiêu đề `h1–h3` dùng số đều hàng (`lining-nums`) vì font Cormorant mặc định cho số "1" trông như chữ "I".
- Bổ sung sau (25/09/2026), theo phản hồi "tạo truyện chưa có chỗ nhập nội dung":
  - Form tạo truyện có phần **Chương 1** (không bắt buộc) và 2 nút **"Lưu nháp"** / **"Đăng truyện"** (xem mục 1.3).
  - Danh sách `/sang-tac` có menu **⋯** cho từng truyện (xem mục 1.2).
  - Tab trang quản lý nằm trên URL (`?muc=`) để link mở đúng tab (xem mục 1.4).

**Chia 3 giai đoạn**, mỗi giai đoạn xong là dùng được:
- **A. Thể loại:** trang `/the-loai` và tạo thể loại.
- **B. Đăng truyện:** khu Sáng tác, tạo/sửa truyện kèm ảnh bìa, soạn chương, xuất bản, hiển thị công khai.
- **C. Nhập file `.txt`:** tự tách chương.

---

## 1. Màn hình & route

| Route | Màn hình | Cần đăng nhập |
|---|---|---|
| `/the-loai` | Tất cả thể loại + nút "Tạo thể loại" | Chỉ khi tạo |
| `/sang-tac` | **Khu Sáng tác**: danh sách truyện của tôi | ✔ |
| `/sang-tac/truyen-moi` | Form đăng truyện mới | ✔ |
| `/sang-tac/truyen/:storyId` | Quản lý một truyện: thông tin, chương, xuất bản | ✔ (chủ truyện) |
| `/sang-tac/truyen/:storyId/chuong-moi` | Soạn chương mới | ✔ |
| `/sang-tac/truyen/:storyId/chuong/:number` | Sửa chương | ✔ |
| `/sang-tac/truyen/:storyId/nhap-file` | Nhập file `.txt` (giai đoạn C) | ✔ |

- Các route `/sang-tac/*` bọc trong `RequireAuth`: chưa đăng nhập thì chuyển tới `paths.login(trang hiện tại)`. Truyện không phải của mình thì hiện `NotFound`.
- **Lối vào:**
  - Menu avatar (desktop và mobile) thêm mục **"Sáng tác"**.
  - Dropdown "Thể loại" ở header thêm dòng "Xem tất cả thể loại" trỏ tới `/the-loai`.
  - Footer thêm link "Đăng truyện".

### 1.1 Trang Thể loại `/the-loai`
```
Thể loại                                  [+ Tạo thể loại]
[ô lọc nhanh: "Tìm thể loại…"]
┌────────────┐┌────────────┐┌────────────┐┌────────────┐
│ Ngôn tình  ││ Cổ đại     ││ Điền văn   ││ Hệ thống   │
│ 124 truyện ││ 80 truyện  ││ 12 truyện  ││ 0 truyện · │
│ mô tả ngắn ││            ││            ││ do Linh tạo│
└────────────┘└────────────┘└────────────┘└────────────┘
```
- Lưới 2 cột trên mobile, 3 trên tablet, 4 trên desktop. Mỗi thẻ gồm tên, số truyện đã xuất bản, mô tả; thể loại do người dùng tạo thì ghi thêm "do {tên} tạo".
- **Hộp thoại "Tạo thể loại"** (`ui/dialog`):
  - Trường: Tên (2–30 ký tự) và Mô tả (không bắt buộc, ≤ 200 ký tự).
  - Trùng tên thì báo: "Thể loại **Ngôn tình** đã có." kèm link tới thể loại đó.
  - Chưa đăng nhập mà bấm nút thì chuyển sang trang đăng nhập.

### 1.2 Khu Sáng tác `/sang-tac`
```
Sáng tác của bạn                          [+ Đăng truyện mới]
┌───────┬──────────────────────────────┬──────────┬─────────┐
│ bìa   │ Tên truyện                   │ Đã xuất  │ Sửa lần │
│       │ 12 chương (3 bản nháp)       │ bản / Nháp│ cuối   │
└───────┴──────────────────────────────┴──────────┴─────────┘
```
- Mỗi dòng dẫn tới trang quản lý. Trên mobile, mỗi truyện là một thẻ.
- Nút **⋯** cuối mỗi dòng (nằm ngoài link của dòng):
  - "Sửa thông tin" mở trang quản lý ở tab Thông tin truyện (`paths.studioStory(id, 'thong-tin')`).
  - "Viết chương mới".
  - "Xóa truyện" mở cùng `DeleteStoryDialog` (phải gõ đúng tên); xóa xong ở lại danh sách và báo "Đã xóa truyện “…”".
- Chưa có truyện: "Bạn chưa đăng truyện nào. Bắt đầu với truyện đầu tiên." kèm nút.

### 1.3 Form truyện (tạo mới và sửa dùng chung `StoryForm`)
- **Tên truyện** (2–120 ký tự).
- **Đường dẫn** tự sinh từ tên (`slugify`), hiện dạng `…/truyen/ten-truyen`; nếu trùng thì thêm `-2`, `-3`.
- **Giới thiệu** (30–3000 ký tự, có bộ đếm).
- **Thể loại** (chọn 1–5) qua `GenrePicker`:
  - Ô tìm kèm danh sách gợi ý; các thể loại đã chọn hiện thành thẻ, có nút ✕ để bỏ.
  - Gõ tên chưa có thì hiện dòng **"Tạo thể loại “…”"**, tạo ngay tại chỗ.
- **Tình trạng:** Đang ra / Đã hoàn thành.
- **Ảnh bìa** (`CoverUpload`):
  - Kéo-thả hoặc chọn file JPG/PNG/WebP ≤ 2 MB.
  - Tự cắt giữa khung 2:3, thu về 480×720 WebP, xem trước ngay.
  - Có nút "Đổi ảnh" và "Bỏ ảnh"; chưa có ảnh thì xem trước bằng bìa chữ tự sinh.
- **Chương 1** (chỉ khi tạo truyện, không bắt buộc): tiêu đề + nội dung, dùng chung ô soạn `ChapterFields` với trình soạn chương.
  - Để trống nội dung thì chỉ tạo truyện (thêm chương hoặc nhập file .txt sau). Đã viết thì nội dung phải ≥ 100 ký tự; có tiêu đề mà không có nội dung thì báo lỗi.
  - **"Lưu nháp"**: truyện (và chương 1 nếu có) là bản nháp.
  - **"Đăng truyện"**: xuất bản chương 1 và công khai truyện luôn; chưa viết chương 1 thì báo lỗi ở ô nội dung.
  - Rời trang khi đã gõ nội dung chương 1 thì hỏi lại (`useUnsavedChangesPrompt`).
  - `createStory(input, { chapter, publish })` ghi chương trước rồi mới ghi truyện, để bộ nhớ đầy thì không sinh truyện rỗng.
- Lưu xong thì chuyển sang trang quản lý.
- Bố cục desktop: form bên trái, cột xem trước bên phải (bìa + `StoryCard` như người đọc sẽ thấy). Mobile: một cột.

### 1.4 Quản lý truyện `/sang-tac/truyen/:storyId`
```
[bìa] Tên truyện   [Nháp]            [Xem trang truyện] [Xuất bản truyện]
Thông tin | Chương (12)                                  (tabs)
── Chương ──  [+ Viết chương mới] [Nhập từ file .txt]
 1  Gặp lại                 Đã xuất bản   25/09   [Sửa] [⋯]
 2  Mưa đầu mùa             Nháp          25/09   [Sửa] [⋯]  ⋯: Xuất bản/Ẩn, Xóa
── Vùng nguy hiểm ──  [Ẩn truyện] [Xóa truyện]
```
- **Tab "Thông tin":** `StoryForm` để sửa. **Tab "Chương":** danh sách chương kèm trạng thái.
- Tab đang mở nằm trên URL: `?muc=thong-ke|bao-loi|thong-tin` (tab Chương thì không có tham số), đổi tab dùng `replace`.
- **Quy tắc xuất bản:**
  - Truyện chỉ xuất bản được khi có **≥ 1 chương đã xuất bản**; nút bị khóa kèm lý do.
  - Truyện đang công khai thì không được ẩn hoặc xóa chương đã xuất bản cuối cùng, phải ẩn truyện trước.
- **Thao tác phá hủy** (xóa chương, xóa truyện) hỏi xác nhận bằng dialog. Xóa truyện phải gõ đúng tên truyện.
- **Xem trước:** chủ truyện mở được `/truyen/:slug` kể cả khi truyện còn nháp; đầu trang có dải "Bản nháp, chỉ bạn thấy trang này".

### 1.5 Soạn chương
- Tiêu đề chương (không bắt buộc, ≤ 120 ký tự) và nội dung là `textarea` lớn tự giãn, các đoạn cách nhau bằng dòng trống.
- Nội dung phải có ≥ 100 ký tự và ≤ 100.000 ký tự; hiện số chữ và số ký tự.
- **Tự lưu nháp soạn thảo** vào trình duyệt mỗi 5 giây ("Đã lưu nháp lúc 10:42"). Mở lại trang thì hỏi "Khôi phục bản đang viết dở?".
- Nút "Lưu nháp", "Xuất bản chương", "Hủy". Rời trang khi còn thay đổi chưa lưu thì hỏi lại (`useBlocker` của React Router + `beforeunload`).
- Số chương tự gán là số tiếp theo; sửa chương giữ nguyên số.
- Nội dung luôn hiển thị dạng **văn bản thuần** (không render HTML) nên không có nguy cơ chèn mã.

### 1.6 Nhập file `.txt` (giai đoạn C)
1. **Chọn file:** chỉ nhận `.txt` UTF-8, ≤ 2 MB. Nếu phát hiện ký tự lỗi `�` thì báo "File không phải mã UTF-8. Mở file bằng Notepad → Lưu thành → chọn UTF-8 rồi thử lại."
2. **Tự tách chương** theo dòng tiêu đề:
   - Nhận các dạng `Chương 12: Tiêu đề`, `CHƯƠNG 12 - Tiêu đề`, `Chuong 12. Tiêu đề`, `Chương 12`; xử lý được xuống dòng CRLF và ký tự BOM.
   - Số chương trong file chỉ để tách, khi lưu sẽ đánh số tiếp nối sau số chương hiện có.
3. **Bảng xem trước:** số chương, tiêu đề, số ký tự, câu mở đầu. Hiện cảnh báo nếu:
   - Không tìm thấy tiêu đề nào (toàn bộ file sẽ thành 1 chương).
   - Có đoạn văn trước chương đầu (đoạn này sẽ bị bỏ qua).
   - Số chương nhảy cóc hoặc lặp.
   - Có chương quá ngắn hoặc quá dài.
4. Checkbox "Xuất bản ngay các chương này" (mặc định: lưu nháp), rồi bấm **"Thêm N chương"**.

## 2. Dữ liệu (api + mock)

**Kiểu dữ liệu:**
- `Genre` thêm `description?`, `createdBy?: { id, displayName } | null`.
- `Story` thêm `ownerId: string | null` (truyện có sẵn là `null`) và `visibility: 'draft' | 'published'`; `latestChapter` đổi thành có thể `null` (truyện chưa có chương công khai).
- `Chapter` mới gồm `{ id, storyId, number, title, content, status: 'draft' | 'published', createdAt, updatedAt }`.

**`src/lib/slugify.ts`:** bỏ dấu tiếng Việt (`đ` → `d`), chữ thường, nối bằng `-`. Dùng cho thể loại, đường dẫn truyện và chống trùng tên.

**`features/genres/api.ts`** (tách khỏi `stories/api.ts`):
- `getGenres()` trả về thể loại có sẵn + do người dùng tạo, kèm `storyCount`.
- `createGenre({ name, description })`: cần đăng nhập. Nếu trùng slug thì ném `GenreExistsError` mang theo thể loại đã có.

**`features/studio/api.ts`** (khu Sáng tác, mọi hàm gọi `requireUser()` và kiểm tra chủ truyện):
- Truyện: `getMyStories`, `getMyStory(id)`, `createStory`, `updateStory`, `publishStory`, `unpublishStory`, `deleteStory`.
- Chương: `getMyChapters(storyId)`, `getMyChapter(storyId, number)`, `saveChapter` (tạo/sửa), `setChapterStatus`, `deleteChapter`, `importChapters(storyId, parsed[], publish)`.

**Đọc công khai** (sửa `stories/api.ts`, `chapters/api.ts`):
- Nguồn truyện = truyện có sẵn + truyện người dùng **đã xuất bản**. `getStory` trả thêm cả truyện nháp nếu người xem là chủ truyện.
- Số chương, chương mới nhất, `updatedAt` tính từ các chương đã xuất bản.
- Truyện mới đăng sẽ tự xuất hiện ở "Mới cập nhật" và "Truyện mới ra" trên trang chủ, ở "Cùng thể loại", và trên trang chi tiết.

**Lưu trữ giả:**
- Các key: `mock-user-genres`, `mock-user-stories`, `mock-chapters:<storyId>` (tách theo truyện để không phải ghi lại toàn bộ khi sửa một chương).
- `writeMock` hiện nuốt lỗi. Thêm `writeMockStrict` ném lỗi khi bộ nhớ trình duyệt đầy (~5 MB), để UI báo: "Bộ nhớ trình duyệt đã đầy. Đây là giới hạn của bản thử nghiệm, sẽ không còn khi nối máy chủ."

**Hook:** query key có `userId` với dữ liệu riêng. Sau khi xuất bản/ẩn/xóa thì invalidate cả key công khai (`['stories']`, `['chapters', slug]`, `['genres']`).

**Hàm thuần có test riêng:**
- `src/lib/parseChapters.ts`: tách chương + cảnh báo.
- `src/lib/image.ts` (`prepareCover`): kiểm tra loại/kích thước file, cắt 2:3 bằng canvas, xuất WebP dạng data URL.

## 3. Hiển thị cần sửa
- **Chỗ dùng `latestChapter`** (`LatestUpdates`, `StoryHero`, `ChapterList`): xử lý trường hợp `null`. Truyện chưa có chương thì ẩn nút đọc và hiện "Chưa có chương nào".
- **Truyện chưa có đánh giá** (`ratingCount = 0`): `StoryHero`, `HeroShowcase`, `RatingSummary` hiện "Chưa có đánh giá" thay vì "0.0".
- **Ảnh bìa:** `StoryCover` đã hỗ trợ `coverUrl`, nên ảnh dạng data URL dùng được ngay.
- **Trang chi tiết:** thêm dải "Bản nháp" khi chủ truyện xem trước. Chủ truyện thấy thêm nút "Quản lý truyện" trỏ tới `/sang-tac/truyen/:id`.

## 4. File chính

**Tạo mới**
- **Trang:** `src/pages/GenresPage.tsx`, `StudioPage.tsx`, `NewStoryPage.tsx`, `ManageStoryPage.tsx`, `ChapterEditorPage.tsx`, `ImportChaptersPage.tsx`.
- **Thể loại** (`src/features/genres/`): `api.ts`, `hooks.ts`, `schemas.ts`, `components/CreateGenreDialog.tsx`, `components/GenrePicker.tsx`.
- **Sáng tác** (`src/features/studio/`):
  - Dữ liệu: `api.ts`, `hooks.ts`, `schemas.ts`.
  - Component: `StoryForm`, `CoverUpload`, `StoryPreview`, `MyStoryList`, `ChapterTable`, `ChapterEditor`, `PublishPanel`, `DeleteStoryDialog`, `ImportPreview`, `useUnsavedChangesPrompt`, `useEditorAutosave`.
- **Dùng chung:**
  - `src/components/common/RequireAuth.tsx`.
  - `src/lib/slugify.ts`, `parseChapters.ts`, `image.ts`.
  - `src/types/chapter.ts` (thêm `Chapter`), `src/types/story.ts` (thêm trường mới).

**Sửa**
- `src/app/router.tsx` (các route mới), `src/lib/routes.ts` (`paths.genres`, `paths.studio`...).
- `src/lib/mockStorage.ts` (`writeMockStrict`).
- `src/features/stories/api.ts`, `src/features/chapters/api.ts`: gộp truyện người dùng, chuyển `getGenres` sang `features/genres`.
- `Header.tsx`, `UserMenu.tsx`, `Footer.tsx` (lối vào), `StoryHero.tsx`, `LatestUpdates.tsx`, `ChapterList.tsx`, `RatingSummary.tsx`, `HeroShowcase.tsx`.

**Dùng lại:**
- **Form:** `FormField`, `FormAlert`, `SubmitButton`, `authInputClass`, mẫu react-hook-form + zod.
- **Auth:** `requireUser`, `AuthError`, `useSession`, `useCurrentPath`.
- **Truyện:** `StoryCover`, `StoryCard`, `NotFound`, `SectionHeading`, `Container`.
- **shadcn:** `Dialog`, `DropdownMenu`, `Tabs`, `Checkbox`, `Select`, `Textarea`.
- **Tiện ích:** `readMock`/`writeMock`, `formatDate`, `formatRelativeTime`.

## 5. Khi nối Supabase (ghi chú, chưa làm)
- **Bảng:**
  - `genres` (`slug unique`, `created_by`).
  - `stories` thêm `owner_id`, `visibility`, `cover_path`.
  - `chapters` thêm `content`, `status`.
  - `story_genres` giữ nguyên.
- **RLS:**
  - Ai cũng đọc được truyện/chương `published`.
  - Chủ truyện đọc/ghi được truyện và chương của mình.
  - User đã đăng nhập được `insert` thể loại.
- **Ảnh bìa:** lưu ở bucket Storage `covers/{user_id}/{story_id}.webp`; `prepareCover` giữ nguyên, chỉ đổi từ data URL sang upload.
- **Chống trùng thể loại:** unique index trên `slug`, cộng hàm `unaccent` khi so sánh.

## 6. Kiểm tra
- **Test hàm thuần:**
  - `slugify` (có dấu, `đ`, ký tự lạ, khoảng trắng thừa).
  - `parseChapters` (các dạng tiêu đề, CRLF/BOM, đoạn mở đầu, không có tiêu đề, số chương lặp).
  - `createGenre` chặn "ngôn tình" / "Ngôn Tình" / "ngon tinh".
- **Test api:**
  - Truyện nháp không xuất hiện ở `getLatestUpdated`/`getStory` với người lạ, nhưng chủ truyện vẫn thấy.
  - Không xuất bản truyện 0 chương được; không sửa được truyện của người khác.
- **Test luồng** (`renderApp`, `prepareCover` được mock vì jsdom không có canvas):
  - Chưa đăng nhập vào `/sang-tac` thì bị chuyển sang đăng nhập.
  - Tạo thể loại trong dialog, và tạo ngay trong `GenrePicker`.
  - Đăng truyện → viết chương → xuất bản chương → xuất bản truyện → truyện hiện ở "Mới cập nhật" và mở được `/truyen/:slug`.
  - Tạo truyện kèm chương 1 rồi "Đăng truyện" → công khai ngay; bấm khi chưa viết chương 1 thì báo lỗi.
  - Menu ⋯ ở `/sang-tac`: "Sửa thông tin" mở đúng tab, "Xóa truyện" ngay từ danh sách.
  - Nhập file `.txt` → bảng xem trước đúng số chương → "Thêm N chương".
  - Xóa truyện phải gõ đúng tên.
- `npm run build`, `npm run lint` sạch.
- **Kiểm tra bằng Playwright** ở 375px, 768px, 1440px, cả giao diện tối và sáng: đi hết luồng đăng truyện; tải ảnh bìa thật để xem cắt 2:3; không cuộn ngang.
