# Plan: Tối ưu tải trang đợt 3

Trạng thái: ✅ xong (08/10/2026), migration `faster_cards_and_thumbs` đã push lên DB production. Nhánh `faster-loading-3`. App di động không đổi (RPC cũ giữ nguyên).

**Khác so với bản spec đã duyệt** (phát hiện lúc làm):
- **Hàm bọc thay vì thêm cột `card` vào RPC cũ:** `story_ranking_cards`, `related_story_cards`, `search_story_cards`, `library_cards` gọi RPC cũ `with ordinality` rồi nối `story_cards`. Không phải chép lại thân hàm dài (`story_ranking`), RPC cũ giữ nguyên cho app.
- Thẻ từ các hàm bọc chứa mô tả đầy đủ (dòng `story_cards` trọn vẹn); chỉ danh sách đọc thẳng `story_cards` mới dùng `description_short`.
- **Bản bìa nhỏ tạo lúc tải lên trong bản remote** (`makeCoverThumb` + `uploadThumb`), không đổi `prepareCover`; `create_story` / `update_story` giữ nguyên, client ghi `cover_thumb_path` bằng một lệnh update ngay sau đó. Trigger `stories_cover_thumb` bỏ bản nhỏ cũ khi đổi bìa mà không ghi bản nhỏ mới. Tạo / tải bản nhỏ lỗi thì bỏ qua, truyện vẫn lưu với ảnh gốc. `StoryCover`: bản nhỏ lỗi thì thử ảnh gốc rồi mới tới bìa chữ.
- **Vendor chunk không gom Radix:** gom thì JS vào trang tăng 7,3 KB (kéo cả component chỉ trang tải sau dùng).
- `chapterLoader` import động `chapterQuery` và mục lục chương tách sang `chapters/queries.ts`: nếu không, kho đọc offline (IndexedDB) bị kéo vào bundle chính (+5,4 KB).
- Thêm devDependency `playwright-core` cho `scripts/measure-load.mjs` (không tải trình duyệt; dùng Chromium có sẵn trong cache của Playwright).

## Context

Đợt 1 + 2 (`plan-toi-uu-tai-trang.md`, xong 07/10/2026) làm khung trang hiện ngay từ 0,8 s, nhưng FCP/LCP gần như không đổi: dữ liệu chỉ được gọi sau khi tải xong JS chính, rồi chunk của trang, và một số trang còn gọi hai request nối tiếp. Đợt 3 để lại từ đó gồm năm việc. Đây là việc thứ ba trong nhóm "đáng làm, không gấp".

Đã chốt với người dùng (08/10/2026):
- Làm **cả năm việc**: route loader, RPC trả thẳng thẻ truyện, chọn cột thay `select('*')`, ảnh bìa thu nhỏ, tách vendor chunk.
- **Route loader tải trước, không chờ**: loader khởi động query rồi trả về ngay, trang vẫn đọc dữ liệu bằng hook cũ và vẫn có skeleton; bấm link chuyển trang ngay.
- Đo trước / sau bằng cùng cách đo của đợt 1 + 2.
- Thay đổi DB tương thích ngược với app di động (chỉ thêm cột, hàm).

Ngoài phạm vi: server-side rendering, image transformation của Supabase (cần gói trả phí), tự tạo bản nhỏ cho bìa cũ (hiện chỉ có 1 bìa), loader cho trang cần đăng nhập, app di động.

## 1. Route loader

### Nối loader với `queryClient`

- `src/app/routerContext.ts`: `export const queryClientContext = createContext<QueryClient>()` (`createContext` của React Router).
- `router.tsx`: `createBrowserRouter(routes, { getContext: () => new RouterContextProvider(new Map([[queryClientContext, queryClient]])) })`; `queryClient` là bản dùng chung của `app/providers.tsx` (tách ra `app/queryClient.ts` để router và Providers cùng import).
- `routes` vẫn export để test dùng lại; `renderApp` truyền `getContext` với `QueryClient` riêng của từng test.
- Loader lấy `context.get(queryClientContext)`.

### Loader của từng trang

Loader chỉ tải **dữ liệu công khai** (giống nhau với mọi người xem). Mỗi loader gọi `queryClient.prefetchQuery(...)` **không `await`**, rồi `return null`. Không bao giờ ném lỗi: tải trước hỏng thì hook trong trang tự tải lại và báo lỗi trong khối như hiện nay.

| Trang | Tải trước |
|---|---|
| `/` | `featured`, `editorPicks`, `trendingWeekly`, `latestUpdated`, `newReleases`, đề cử tuần |
| `/story/:slug` | `stories.detail(slug)`, `chapters.list(slug, page, order)` theo `?page`, `?sort` |
| `/story/:slug/chapter-:n` | `chapterQuery(queryClient, slug, n)` (giữ kho đọc offline) |
| `/list/:type`, `/genres/:slug` | `stories.browse(filters)` từ `browseParams` |
| `/ranking` | `stories.ranking(by, period)` theo `?by`, `?period` |
| `/search` | `stories.search(q, page)` theo `?q`, `?page` |

- Tách `queryOptions` của các query trên ra khỏi hook (`storyQueries`, `chapterQueries` trong `features/<x>/queries.ts` hoặc trong `hooks.ts`), hook và loader dùng chung để key và `queryFn` luôn khớp.
- Mỗi route có `shouldRevalidate: ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname || currentUrl.search !== nextUrl.search`.
- Tủ truyện, tài khoản, Sáng tác, Quản trị không có loader.
- Loader khai báo thẳng trên route, không nằm trong `lazy`: nếu để trong `lazy` thì loader chỉ chạy sau khi tải xong chunk của trang, mất tác dụng. File loader chỉ import `queryOptions` và api (đã có trong bundle chính vì header dùng tìm kiếm), không kéo thêm component vào bundle chính; kiểm tra bằng dung lượng JS vào trang ở mục 3.

## 2. Dữ liệu (migration `faster_cards_and_thumbs`)

### RPC trả thẳng thẻ truyện

- `story_ranking`, `related_stories`, `search_stories`, `get_library`: thêm cột `card` (kiểu `public.story_cards`, PostgREST trả object JSON). Cột cũ giữ nguyên tên và thứ tự (app di động vẫn đọc). Đổi kiểu trả về nên drop rồi tạo lại, cấp lại quyền.
- `card` theo đúng quyền xem hiện nay: lấy từ view `story_cards` (`security_invoker`) trong hàm INVOKER; hàm nào đang là DEFINER thì lớp vỏ `public` (INVOKER) nối `story_cards` sau khi gọi phần DEFINER, để RLS của người gọi áp dụng. Truyện người gọi không thấy được thì bỏ dòng đó (như `storiesByIds` lọc qua RLS hiện nay).
- RPC mới `curated_story_cards(p_list)` (INVOKER): thẻ truyện chọn tay theo `position`, chỉ truyện công khai.
- `search_stories` phân trang ở ngoài hàm (`.range()`), nên thẻ được dựng cho mọi truyện khớp từ khóa; với số truyện hiện có là không đáng kể. Khi số truyện lớn thì chuyển sang tham số `p_limit`, `p_offset`.
- Bản remote đọc thẻ từ `card` (`toStory(row.card)`), bỏ `storiesByIds` ở: xếp hạng, truyện liên quan, tìm kiếm, gợi ý tìm kiếm, banner / đề cử trang chủ, tủ truyện.

### Chọn cột

- `story_cards` thêm `description_short` (`left(description, 300)`), cột mới ở cuối view.
- `cards.remote.ts`: `CARD_COLUMNS` liệt kê cột cần cho thẻ, mô tả lấy `description:description_short`; `storyBySlug` (trang chi tiết) vẫn lấy mô tả đầy đủ.
- `useStory` lấy placeholder từ cache danh sách nên phần mô tả có thể hiện bản rút gọn trong lúc chờ bản đầy đủ.

### Ảnh bìa thu nhỏ

- `src/lib/image.ts`: `prepareCover(file)` trả `{ cover, thumb }`: bản gốc 480×720 như cũ, bản nhỏ **320×480** (webp 0,8).
- Storage: bản nhỏ lưu cạnh bản gốc, tên `{uuid}-thumb.webp`. `stories.cover_thumb_path` (null: chưa có bản nhỏ); chủ truyện được ghi cột này (grant insert / update như `cover_path`).
- `story_cards` thêm `cover_thumb_path`; `Story.coverThumbUrl` (null thì dùng `coverUrl`).
- `StoryCover`: mặc định dùng bản nhỏ; `priority` (banner trang chủ, đầu trang truyện) dùng bản gốc.
- Hạn mức ảnh (`private.image_upload_allowed`): file `-thumb` không tính vào 30 / ngày và 300 đang lưu **chỉ khi** đã có file gốc cùng tên (bỏ `-thumb`) của chính người đó; policy truyền `name` vào hàm.
- Đổi bìa, bỏ bìa, xóa truyện: xóa cả hai file. Xóa tài khoản đã xóa cả thư mục `{uid}/`.
- Bản giả: bìa là data URL, `coverThumbUrl` = data URL của bản nhỏ (hoặc của bìa với dữ liệu cũ).

## 3. Vendor chunk

- `vite.config.ts`: `build.rolldownOptions.output.codeSplitting.groups` gom thư viện ít đổi mà trang nào cũng tải từ đầu: `react`, `react-dom`, `scheduler`, `react-router`, `@tanstack/*`, `@supabase/*`, `radix-ui` / `@radix-ui/*`.
- Ant Design, `@ant-design/plots`, Tiptap giữ trong chunk riêng của khu Quản trị, Sáng tác.
- Kiểm tra: build hai lần, chỉ sửa code app ở giữa, tên file vendor chunk giữ nguyên; tổng JS tải lúc vào trang (theo `modulepreload` của `index.html`) không tăng.

## 4. Đo đạc

- Lưu script đo vào `scripts/measure-load.mjs` (Playwright + CDP): Slow 4G, CPU chậm 4 lần, khổ điện thoại; đo trang chủ, chi tiết truyện, trang đọc, mỗi trang 3 lần, lấy trung vị FCP, LCP, thời điểm request dữ liệu đầu tiên.
- So sánh bằng `vite preview` trên máy: bản `main` hiện tại và bản mới, cùng gọi Supabase thật. Sau khi deploy đo thêm trên production.
- Ghi kết quả vào mục "Kết quả đo" cuối plan này.

## 5. Kiểm tra

- **Loader** (test luồng): mở trang truyện thì `getStory` và trang mục lục gọi đúng một lần (loader và hook không tải trùng); đổi `?page` thì loader chạy lại, thao tác khác thì không; tải trước lỗi thì khối đó vẫn báo lỗi như cũ.
- **Bản remote** (client giả): các hàm ở mục 2 đọc từ `card`, chỉ một request; danh sách chọn `CARD_COLUMNS` và `description_short`; tải bìa tạo hai file, đổi / bỏ bìa xóa cả hai.
- **Ảnh**: `prepareCover` trả bản gốc và bản nhỏ đúng kích thước (giả `createImageBitmap` và canvas).
- **SQL**: `card` không trả truyện người gọi không thấy (nháp, bị gỡ); `curated_story_cards` đúng thứ tự, bỏ truyện không công khai; `description_short` ≤ 300 ký tự; chỉ chủ truyện ghi `cover_thumb_path`; hạn mức ảnh không đếm `-thumb` có file gốc, vẫn đếm `-thumb` không có file gốc.
- Toàn bộ test, lint, build; giao diện 375 / 768 / 1440px, cả hai theme (ảnh bìa ở thẻ, danh sách, banner, đầu trang truyện).

## 6. Các bước

1. Tách `queryOptions`, context router, loader cho từng trang + test (chỉ frontend).
2. Vendor chunk + kiểm tra tên file ổn định.
3. Script đo, đo bản `main` hiện tại (mốc so sánh).
4. Migration (cột `card`, `curated_story_cards`, `description_short`, `cover_thumb_path`, hạn mức ảnh), ca kiểm tra SQL, thử trong transaction; push (hỏi người dùng), advisors, sinh kiểu.
5. Bản remote: đọc `card`, `CARD_COLUMNS`; ảnh thu nhỏ (`image.ts`, tải / xóa ảnh, `StoryCover`) + test.
6. Đo lại, cập nhật `thiet-ke-database.md`, `CLAUDE.md`, lộ trình, `plan-toi-uu-tai-trang.md`; ghi chú app di động; kiểm tra giao diện; toàn bộ test, lint, build; commit, gộp vào `main`.

## Kết quả đo

`vite preview` trên máy, cùng gọi Supabase thật, Slow 4G (độ trễ 150 ms, 1,6 Mbps), CPU chậm 4 lần, khổ điện thoại, trung vị 3 lần (08/10/2026). "Dữ liệu" là lúc request Supabase đầu tiên bắt đầu.

| Trang | Dữ liệu (`main` → mới) | LCP (`main` → mới) | FCP (`main` → mới) |
|---|---|---|---|
| Trang chủ | 2,73 → 2,15 s | ~3,96 → ~3,98 s (dao động 3,3–4,8 s) | 2,19 → 2,2 s |
| Chi tiết truyện | 3,11 → 2,14 s | 3,66 → 3,20 s | 2,21 → 2,19 s |
| Trang đọc | 3,37 → 2,55 s | 4,09 → 3,51 s | 4,09 → 3,51 s |
| Xếp hạng | 2,37 → 2,14 s | 2,46 → 2,49 s | 2,17 → 2,19 s |

- Dữ liệu bắt đầu tải sớm hơn 0,2–1 s ở mọi trang (route loader). LCP trang truyện, trang đọc giảm 0,45–0,6 s. Trang chủ: LCP dao động mạnh giữa các lần đo, trung bình gần như không đổi; nút thắt là chạy JS trên CPU chậm, không còn là mạng.
- FCP trang chủ / truyện không đổi: đó là lúc khung trang tĩnh hiện (đợt 1), không phụ thuộc dữ liệu.
- JS vào trang (gzip, `scripts/entry-js-size.mjs`): `main` 261,6 KB → mới 262,6 KB (loader +3 KB, vendor chunk −2 KB). Vendor chunk giữ nguyên tên file khi chỉ đổi code app (đã kiểm tra bằng hai lần build).
- Ảnh bìa nhỏ: chưa đo được trên dữ liệu thật (production mới có 1 bìa, là bìa cũ chưa có bản nhỏ); mỗi thẻ có bìa nhẹ đi từ khoảng 81 KB xuống 15–20 KB khi tác giả tải bìa mới.
