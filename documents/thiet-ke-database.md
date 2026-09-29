# Thiết kế database (Supabase)

Schema cho giai đoạn nối backend, suy ra từ hành vi của các `features/*/api.ts` đang chạy mock. SQL nằm ở `supabase/migrations/`. Khi đổi schema thì sửa cả tài liệu này.

- **Project:** `zsbyjxaaxtylgmxybzpf`
- **Dữ liệu:** DB bắt đầu trống, không seed. Thể loại do người dùng tạo bằng nút "Tạo thể loại".
- **Trạng thái (28/09/2026):** đã có schema, RLS, trigger, RPC, storage và kiểu TypeScript. Mọi feature đã nối: mỗi `features/<x>/` có `api.ts` (chọn backend lúc chạy: có `supabase` thì `api.remote.ts`, không thì `api.mock.ts`), `api.remote.ts`, `api.mock.ts` (test tự động, làm UI offline) và `shared.ts` (kiểu, hằng, lớp lỗi dùng chung). Mục 8 ghi cách nối.

## 1. Nguyên tắc

- **Mọi truyện đều có chủ** (`stories.owner_id`). Tác giả chính là hồ sơ (`profiles`) của chủ truyện, nên không có bảng `authors`. `author.slug` của kiểu `Story` là `tac-gia-<owner_id>`.
- **Nội dung tách khỏi số liệu.**
  - `stories` và `chapters` là nội dung tác giả sửa được.
  - `story_stats` là số liệu do trigger/RPC tự ghi: số chương đã xuất bản, chương đầu/mới nhất, lượt đọc, người theo dõi, phân bố sao. Client chỉ đọc được bảng này.
- **Chương được gắn bằng cặp `(story_id, number)`.** Bình luận, báo lỗi và lượt đọc dùng khóa ngoại ghép tới `chapters(story_id, number)` với `on delete cascade on update cascade`. Xóa chương thì các dòng này tự xóa theo.
- **Luật nghiệp vụ đặt ở DB.** Trigger ném lỗi có mã, api chỉ cần map sang thông báo (mục 4).
- **Không lưu email, provider và mật khẩu** ở schema `public`: chúng thuộc `auth.users`.
- **Ngày thống kê** tính theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).

## 2. Sơ đồ quan hệ

```
auth.users 1─1 profiles
profiles 1─n stories 1─1 story_stats
stories n─n genres                      (story_genres, có position = thứ tự tác giả chọn)
stories 1─n chapters                    (unique story_id + number)
chapters(story_id, number) 1─n comments         (chapter_number null = bình luận cả truyện)
                           1─n chapter_reports
                           1─n chapter_views    (mỗi ngày một dòng)
profiles × stories: follows, reading_history, ratings   (khóa chính user_id + story_id)
stories 1─n curated_stories             ("Nổi bật", "Biên tập chọn" trên trang chủ)
contact_messages                        (độc lập, chỉ ghi)
```

## 3. Bảng

Giới hạn độ dài lấy từ schema zod (`features/*/schemas.ts`). DB chỉ giữ giới hạn trên và điều kiện không rỗng; mức tối thiểu kiểu "giới thiệu ≥ 30 ký tự" do form kiểm tra.

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `display_name` (1–30), `avatar_url` | Trigger tạo khi có tài khoản mới. Tên lấy lần lượt từ `display_name` của form đăng ký, `full_name`/`name` (Google, Facebook), rồi phần trước @ của email |
| `genres` | `slug` (khóa chính), `name` (2–30), `description` (≤200), `created_by` | `slug` luôn = `slugify(name)` do trigger đặt, nên tạo trùng là lỗi `23505` |
| `stories` | `id`, `owner_id`, `slug` (unique, không đổi), `title` (2–120), `description` (≤3000), `status`, `visibility`, `cover_path`, `search_title` (tự sinh), `created_at`, `updated_at`, `published_at` | `updated_at` = lần sửa gần nhất của tác giả, kể cả sửa chương (sắp xếp khu Sáng tác). `published_at` = lần đầu công khai |
| `story_genres` | `story_id`, `genre_slug`, `position` | Tối đa 5 thể loại (`too_many_genres`) |
| `chapters` | `id`, `story_id`, `number` (1–99999), `title` (≤120), `content` (1–200 000), `status`, `created_at`, `updated_at`, `published_at` | `published_at` = lần đầu xuất bản, ẩn rồi xuất bản lại vẫn giữ mốc cũ. `content` là HTML rút gọn của trình soạn hoặc văn bản thuần kiểu cũ; client giới hạn 100 000 ký tự chữ nhìn thấy, DB cho tới 200 000 vì có thẻ định dạng (`documents/plan-trinh-soan-dinh-dang.md`) |
| `story_stats` | `chapter_count`, `first_chapter_number`, `latest_chapter_number`, `latest_chapter_title`, `last_chapter_at`, `view_count`, `follower_count`, `rating_counts int[5]`, `rating_count`, `rating_sum`, `rating_avg` | Các cột về chương chỉ tính chương đã xuất bản. `rating_*` tự sinh từ `rating_counts`; `rating_avg` = 0 khi chưa có lượt chấm |
| `follows` | `user_id`, `story_id`, `followed_at`, `seen_chapter` | Số chương mới = số chương đã xuất bản có `number > seen_chapter` |
| `reading_history` | `user_id`, `story_id`, `chapter_number`, `chapter_title`, `progress` (0–1), `read_at` | Không có khóa ngoại tới chương, để lịch sử vẫn còn khi chương bị ẩn |
| `ratings` | `user_id`, `story_id`, `score` (1–5) | |
| `comments` | `id`, `story_id`, `chapter_number` (có thể null), `user_id`, `content` (1–1000), `created_at` | Tên và ảnh người viết lấy từ `profiles` theo hồ sơ hiện tại |
| `chapter_reports` | `id`, `story_id`, `chapter_number`, `reporter_id`, `reason`, `note` (≤500, bắt buộc khi `reason='other'`), `status`, `created_at`, `resolved_at` | Unique một phần trên `(reporter_id, story_id, chapter_number, reason)` khi `status='open'`, để gộp báo lỗi trùng |
| `chapter_views` | `story_id`, `chapter_number`, `day`, `views` | Chỉ ghi qua `record_chapter_view` |
| `contact_messages` | `name`, `email`, `topic`, `message` (10–2000), `user_id` | Chỉ insert, không ai đọc được qua API (xem trên Dashboard) |
| `curated_stories` | `list` (`featured` \| `editor_pick`), `story_id`, `position` | Thay `featuredSlugs`/`editorPickSlugs`, sửa qua Dashboard |

**Enum:**
- `story_status`: `ongoing` \| `completed`
- `publication_status`: `draft` \| `published`, dùng chung cho `stories.visibility` và `chapters.status`
- `report_reason`: `typo` \| `missing` \| `order` \| `violation` \| `other`
- `report_status`: `open` \| `resolved`
- `contact_topic`: `general` \| `bug` \| `copyright` \| `partnership`

## 4. Luật nghiệp vụ và mã lỗi

| Mã | Khi nào | Map sang |
|---|---|---|
| `no_published_chapters` | Công khai truyện chưa có chương nào đã xuất bản | `StudioError('no_published_chapters')` |
| `last_published_chapter` | Ẩn hoặc xóa chương công khai cuối cùng của truyện đang công khai | `StudioError('last_published_chapter')` |
| `chapter_number_locked` | Đổi số của chương đã từng xuất bản | `StudioError('chapter_number_locked')` |
| `too_many_genres` | Chọn quá 5 thể loại | `StudioError('too_many_genres')` ("Chọn tối đa 5 thể loại."); form cũng chặn trước |
| `not_found` | RPC không thấy truyện, hoặc truyện không phải của mình | `StudioError('not_found')` |
| `unauthenticated` | Gọi RPC cần đăng nhập khi chưa đăng nhập | `AuthError('unauthenticated')` |
| `rate_limited` | Vượt giới hạn tần suất (bảng dưới) | `AuthError('rate_limited')` qua `limitError()` (`features/auth/shared.ts`) |
| `duplicate_comment` | Gửi lại đúng bình luận vừa gửi (cùng truyện/chương, trong 10 phút) | `AuthError('rate_limited')` "Bạn vừa gửi bình luận này rồi." |
| `forbidden` | Gọi RPC quản trị (`admin_*`) mà không phải quản trị viên | `AdminError` |
| `cannot_ban_self`, `cannot_ban_admin` | Admin tự khóa mình / khóa admin khác | `AdminError` |
| `genre_exists`, `same_genre` | Đổi tên thể loại trùng thể loại khác / gộp thể loại vào chính nó | `AdminError` |
| `story_taken_down` | Tác giả công khai lại truyện đang bị admin gỡ | `StudioError('story_taken_down')` |
| `23505` (unique) | Trùng số chương / trùng thể loại | `chapter_exists` / `GenreExistsError` |
| `42501` | Không có quyền (RLS hoặc grant) | Lỗi chung |

Lỗi nghiệp vụ nằm trong `error.message` (mã `P0001`). Các luật tự chạy khác:
- **Chương:**
  - Chương xuất bản lần đầu thì tự đặt `published_at`.
  - Mọi thay đổi chương đều tính lại `story_stats` và cập nhật `stories.updated_at`.
- **Theo dõi:** khi theo dõi, `seen_chapter` = max(chương mới nhất, chương đã đọc tới). Ghi `reading_history` tới chương xa hơn thì mốc này được nâng lên.
- **Số liệu:** theo dõi/bỏ theo dõi và chấm/đổi/xóa điểm tự cập nhật `story_stats`.
- **Báo lỗi:** đổi trạng thái sang `resolved` thì đặt `resolved_at`.

**Giới hạn tần suất** (trigger `before insert`, migration `rate_limits_and_account_deletion`; bản giả làm giống ở `src/mocks/rateLimit.ts`):

| Việc | Giới hạn |
|---|---|
| Lượt đọc | 1 lượt / người / chương / ngày. Người đăng nhập tính theo id, khách theo hash IP (`private.chapter_view_log`, tự dọn sau 2 ngày) |
| Bình luận | 3 / phút và 30 / giờ mỗi người; không gửi lại nội dung vừa gửi trong 10 phút |
| Tin nhắn liên hệ | 3 / giờ mỗi email, 5 / giờ mỗi IP |
| Báo lỗi chương | 10 / giờ mỗi người |
| Tạo thể loại | 10 / ngày mỗi người |

IP chỉ lưu dạng hash SHA-256 kèm bí mật ngẫu nhiên (`private.secrets`), không lưu IP gốc.

## 5. RLS và quyền

Mọi bảng đều bật RLS, và grant được ghi rõ cho `anon`/`authenticated`. Lý do: từ 30/10/2026, bảng mới không còn tự lộ ra Data API.

| Bảng | Ai đọc được | Ai ghi được |
|---|---|---|
| `profiles` | mọi người | chủ sửa `display_name`, `avatar_url` |
| `genres` | mọi người | người đã đăng nhập thêm mới (`name`, `description`) |
| `stories` | truyện công khai, cộng truyện nháp của chính mình | chủ truyện. Insert được: `slug, title, description, status, cover_path`. Update được: `title, description, status, visibility, cover_path` |
| `story_genres`, `story_stats`, `chapter_views`, `curated_stories` | ai thấy truyện thì thấy | `story_genres`: chủ truyện. Ba bảng còn lại: không ai ghi từ client |
| `chapters` | chương đã xuất bản của truyện công khai; chủ truyện thấy cả nháp | chủ truyện. Insert được: `story_id, number, title, content, status`. Update được: `number, title, content, status` |
| `follows`, `reading_history`, `ratings` | chỉ chủ | chỉ chủ |
| `comments` | ai thấy truyện thì thấy | viết: người đã đăng nhập, vào truyện công khai hoặc chương đã xuất bản. Xóa: chính người viết |
| `chapter_reports` | người gửi và chủ truyện | gửi: người đã đăng nhập, cho chương đã xuất bản. Đổi trạng thái: chủ truyện. Sửa ghi chú (khi báo lại): người gửi |
| `contact_messages` | không ai | `anon` và `authenticated` insert |

**Quy tắc khi viết migration mới:**
- Luôn `revoke all … from anon, authenticated` rồi mới `grant` đúng quyền. Grant theo cột chỉ có tác dụng khi không có quyền mức bảng.
- Policy dùng `(select auth.uid())` và ghi rõ `to anon` / `to authenticated`.
- Hàm `security definer` đặt ở schema `private` (không lộ ra API) và luôn có `set search_path = ''`.
  - Hàm quyền cao mà khách cũng cần gọi (hiện chỉ có `record_chapter_view`) chia làm hai: `public.record_chapter_view` là lớp vỏ `security invoker`, gọi sang `private.record_chapter_view` (definer).
  - `anon`/`authenticated` có USAGE trên `private`, nhưng chỉ được EXECUTE đúng hàm đó.
  - Các RPC quản trị (`admin_overview`, `admin_users`, `admin_stories`) cũng làm như vậy (cần đọc `auth.users` và truyện nháp của mọi người); chỉ `authenticated` được EXECUTE, và hàm ở `private` tự kiểm tra `private.is_admin()`.
- **Quản trị viên** = `auth.users.raw_app_meta_data.role = 'admin'` (có trong JWT, người dùng không tự sửa được). Cách cấp quyền ở mục 10.
- Sau mỗi migration chạy `supabase db advisors --linked`. Không được còn cảnh báo mức WARN; "unused index" (INFO) khi DB còn ít dữ liệu thì bỏ qua được.

## 6. View và RPC

**View** (`security_invoker`, nên RLS của bảng gốc vẫn áp dụng):
- **`story_cards`**: map ra kiểu `Story`. `created_at` = lần đầu công khai, `updated_at` = lần xuất bản chương gần nhất.
  - Danh sách công khai phải lọc thêm `visibility = 'published'` và `chapter_count > 0`, vì chủ truyện còn thấy cả truyện nháp của mình.
- **`studio_stories`**: map ra kiểu `MyStory`, chỉ gồm truyện của người đang đăng nhập.
- **`genre_cards`**: thể loại kèm `story_count` (số truyện công khai).

**RPC:**

| Hàm | Ai gọi được | Việc |
|---|---|---|
| `create_story(title, description, status, genres[], cover_path?, first_chapter?, publish?)` | đã đăng nhập | Tạo truyện, thể loại và chương đầu trong một transaction; trả về dòng `studio_stories`. `first_chapter` = `{"number"?, "title", "content"}`. Slug trùng thì thêm `-2`, `-3`… |
| `update_story(id, title, description, status, genres[], cover_path?)` | đã đăng nhập | Sửa truyện và thay thể loại cùng lúc |
| `studio_story_stats(story_id)` | chủ truyện | jsonb giống kiểu `StoryStats` |
| `record_chapter_view(slug, number)` | mọi người | +1 lượt đọc (bỏ qua chủ truyện, chương chưa xuất bản và lượt lặp lại trong ngày) |
| `delete_account()` | đã đăng nhập | Xóa tài khoản của chính người gọi; khóa ngoại cascade xóa hồ sơ, truyện, chương, bình luận, tủ truyện... |
| `save_reading_progress(slug, chapter, chapter_title, progress?)` | đã đăng nhập | Ghi chỗ đang đọc. Không truyền `progress` thì giữ vị trí cũ nếu vẫn chương đó |
| `merge_guest_history(entries)` | đã đăng nhập | Gộp lịch sử lúc còn là khách. `entries` giống mảng `ReadingProgress` |
| `get_library()`, `library_update_count()` | đã đăng nhập | Truyện đang theo dõi kèm số chương mới, và số truyện có chương mới |
| `report_chapter(slug, chapter, reason, note)` | đã đăng nhập | Báo lỗi chương; báo lại cùng lý do thì chỉ cập nhật ghi chú |
| `search_stories(q)` | mọi người | `(story_id, score, view_count)`, chấm điểm như `matchScore` |
| `story_ranking(by, period, limit)` | mọi người | `(story_id, value)`. `by`: `views` \| `rating` \| `follows`; `period`: `week` \| `month` \| `all` |
| `related_stories(slug, limit)` | mọi người | `(story_id, overlap)` |
| `slugify(text)` | mọi người | Giống `src/lib/slugify.ts` |
| `admin_overview(days)` | quản trị viên | jsonb giống kiểu `AdminOverview`: tổng số, chuỗi theo ngày (người dùng mới, lượt đọc, truyện mới, chương mới; giờ Việt Nam), truyện theo thể loại, top 10 lượt đọc |
| `admin_users(query?)` | quản trị viên | Mọi tài khoản kèm email, provider, lần đăng nhập cuối, số truyện/bình luận/theo dõi; tìm tên/email không dấu |
| `admin_stories(query?, visibility?, owner_id?, sort?)` | quản trị viên | Mọi truyện, cả nháp, kèm trạng thái gỡ. `sort`: `updated` \| `views` \| `created` |
| `admin_contact_messages(status?)`, `admin_set_contact_handled(id, handled)` | quản trị viên | Hộp thư liên hệ (`status`: `open` \| `handled`) |
| `admin_reports(status?)`, `admin_set_report_status(id, status)` | quản trị viên | Báo lỗi chương của mọi truyện |
| `admin_set_user_banned(user_id, banned)` | quản trị viên | `auth.users.banned_until = 'infinity'` / `null`; khóa thì xóa `auth.sessions` |
| `admin_set_story_takedown(story_id, reason)` | quản trị viên | Gỡ truyện: về nháp + `taken_down_at`, `takedown_reason`; `reason` rỗng là khôi phục |
| `admin_update_genre(slug, name, description)`, `admin_delete_genre(slug)`, `admin_merge_genres(from, into)` | quản trị viên | Sửa (slug đổi theo tên), xóa, gộp thể loại |

## 7. Storage

| Bucket | Giới hạn | Đường dẫn | Lưu ở |
|---|---|---|---|
| `covers` | 2 MB, webp/jpeg, công khai | `{user_id}/{uuid}.webp` | `stories.cover_path` (đường dẫn). Đổi ra URL bằng `supabase.storage.from('covers').getPublicUrl(path)` |
| `avatars` | 512 KB, webp/jpeg, công khai | `{user_id}/{uuid}.webp` | `profiles.avatar_url` (URL đầy đủ, vì ảnh Google/Facebook là URL ngoài) |

- Mỗi người chỉ ghi và xóa được trong thư mục `{user_id}/` của mình.
- Tên file ngẫu nhiên nên không lo cache ảnh cũ. Khi đổi ảnh hoặc xóa truyện thì api xóa file cũ.
- `prepareCover`/`prepareAvatar` (`src/lib/image.ts`) giữ nguyên, chỉ đổi đầu ra từ data URL sang Blob để upload.

## 8. Bảng tra khi nối api.ts

**Quy ước chung:**
- `id` truyện lấy từ `story_cards` theo slug. Các RPC phía người đọc nhận thẳng slug.
- Query key vẫn chứa `userId` như hiện tại.
- Map lỗi theo mục 4.
- Tiện ích dùng chung: `unwrap`/`businessCode`/`isUniqueViolation` (`src/lib/dbError.ts`), `loadPage` (`src/lib/dbPage.ts`, phân trang có đếm tổng, kẹp trang như `paginate()`; PostgREST trả lỗi 416 `PGRST103` khi offset vượt tổng nên không unwrap thẳng), `isUuid` (`src/lib/uuid.ts`, id gõ tay trên URL không gửi lên máy chủ), `requireUserId` (`@/features/auth/api`, như `requireUser` nhưng không tải hồ sơ), thẻ truyện ở `features/stories/cards.remote.ts`.
- Cột của view (`story_cards`, `studio_stories`, `genre_cards`) trong `src/types/database.ts` đều có kiểu `| null`, vì Postgres không suy được NOT NULL qua view. Hàm map (`toStory`...) cần gán giá trị mặc định hoặc khẳng định kiểu.

**`toStory(row)` từ `story_cards`:**
- `author = { slug: 'tac-gia-' + owner_id, name: author_name }`
- `coverUrl = cover_path ? getPublicUrl(cover_path) : null`
- `latestChapter = latest_chapter_number ? { number, title: latest_chapter_title } : null`
- Các cột còn lại đổi snake_case sang camelCase.

| api.ts | Hàm | Nối vào |
|---|---|---|
| auth | `getSession`, `signIn…`, `signUp`, `sendPasswordReset`, `updatePassword`, `signOut` | `supabase.auth.*` (ánh xạ ở mục 6 `plan-dang-nhap-dang-ky.md`). `User` = user của session (email, `app_metadata.provider`) + `profiles` |
| auth | `getProfiles(ids)` | `profiles.select('id, display_name, avatar_url').in('id', ids)` |
| auth | `updateProfile` | Upload lên `avatars`, rồi `update profiles` |
| auth | `deleteAccount(password)` | Tài khoản email: kiểm tra mật khẩu bằng cách đăng nhập lại. Xóa thư mục `{uid}/` trong `avatars` và `covers` (Storage không tự xóa theo), rồi `rpc('delete_account')` và `auth.signOut({ scope: 'local' })` |
| auth | `changePassword` | `auth.updateUser({ password })`. Kiểm tra mật khẩu cũ bằng cách đăng nhập lại, hoặc bật "Secure password change" |
| stories | `getFeaturedStories`, `getEditorPicks` | `curated_stories` (theo `list`, `position`), rồi `story_cards.in('id', …)`. Chưa có truyện chọn tay nào công khai thì lấy tự động: nổi bật là 4 truyện công khai nhiều lượt đọc nhất (rồi cập nhật gần nhất); biên tập chọn là 8 truyện theo `rating_avg`, `rating_count`, `created_at` giảm dần |
| stories | `getLatestUpdated` / `getNewReleases` | `story_cards` công khai, `order('updated_at' / 'created_at', desc)` |
| stories | `getStory(slug)` | `story_cards.eq('slug', slug).maybeSingle()` (RLS cho chủ truyện thấy cả bản nháp) |
| stories | `getStoriesByAuthor` | `story_cards` công khai `.eq('owner_id', <tách từ author slug>).neq('slug', …)` |
| stories | `getRelatedStories` | `rpc('related_stories')` → `story_cards` |
| stories | `browseStories` | `story_cards` công khai. Thể loại: `.contains('genre_slugs', [slug])`. Độ dài: lọc `chapter_count`. Kèm sắp xếp và `.range()` với `count: 'exact'` |
| stories | `searchStories`, `getSearchSuggestions` | `rpc('search_stories', { p_query }, { count: 'exact' }).order('score', desc).order('view_count', desc).range()` → `story_cards`. Thể loại khớp lấy từ `genre_cards` |
| stories | `getRanking`, `getTrendingWeekly` | `rpc('story_ranking')` → `story_cards` |
| chapters | `getChapterList` | `chapters.select('number, title, published_at, stories!inner(slug)').eq('stories.slug', slug).eq('status', 'published').order('number')` qua `loadPage`. Lọc truyện bằng join nên RLS của `stories` áp dụng |
| chapters | `getChapter` | Chương theo `(stories.slug, number, status = published)`, chạy song song với `storyBySlug`, chương trước (`number <` lớn nhất) và chương sau (`number >` nhỏ nhất), mỗi bên `limit 1` |
| chapters | `recordChapterView` | `rpc('record_chapter_view', { p_slug, p_number })`. Giữ `Set` chống đếm trùng ở client; gọi lỗi thì bỏ khóa khỏi `Set` để lần mở sau thử lại |
| genres | `getGenres` | `genre_cards` |
| genres | `createGenre` | `genres.insert({ name, description }).select()`. Lỗi `23505` thì đọc thể loại có `slug = rpc('slugify', name)` rồi ném `GenreExistsError` |
| studio | `getMyStories`, `getMyStory` | `studio_stories` (`order('updated_at', desc)` / `.eq('id')`) |
| studio | `createStory`, `updateStory` | Upload bìa (nếu có), rồi `rpc('create_story' / 'update_story')` |
| studio | `publishStory`, `unpublishStory`, `deleteStory` | `update stories set visibility` / `delete`, rồi xóa file bìa |
| studio | `getMyChapters`, `getMyChapter`, `saveChapter`, `setChapterStatus`, `deleteChapter` | Thao tác thẳng trên `chapters` (chủ truyện thấy cả nháp). Luật số chương và chương công khai cuối do trigger lo |
| studio | `importChapters` | Một lần `chapters.insert([...])`, đánh số tiếp từ số lớn nhất hiện có |
| studio | `getStoryStats` | `rpc('studio_story_stats')` |
| studio | `getStoryReports` | `chapter_reports.select('*, reporter:profiles(id, display_name)')`, sắp theo `status` (enum: `open` trước), rồi `created_at` giảm dần |
| studio | `setReportStatus` | `update chapter_reports set status` |
| library | `getFollowStatus`, `followStory`, `unfollowStory` | `follows` select / insert `{ story_id }` (bỏ qua lỗi `23505`) / delete |
| library | `getLibrary`, `getLibraryUpdateCount` | `rpc('get_library')` + `story_cards` + `reading_history`; `rpc('library_update_count')` |
| library | `getReadingHistory`, `getStoryProgress` | Đã đăng nhập: `reading_history` (`order('read_at', desc).limit(100)`) → `story_cards`. Khách: localStorage khóa `reading-history-guest` (`features/library/guestHistory.ts`; `src/mocks/activity.ts` chỉ bản giả dùng) |
| library | `saveReadingProgress` | Đã đăng nhập: `rpc('save_reading_progress')`. Khách: localStorage |
| library | gộp lịch sử khách | Lần gọi đầu có session (`getLibrary`, `getLibraryUpdateCount`, các hàm lịch sử): `rpc('merge_guest_history', { p_entries })` một lần, xong thì xóa bản local |
| library | `removeFromHistory`, `clearHistory` | `reading_history.delete()` luôn kèm `.eq('user_id', uid)` (Supabase chặn delete không có điều kiện) |
| comments | `getComments` | `comments.select('*, user:profiles!comments_user_id_fkey(id, display_name, avatar_url)', { count: 'exact' })`, lọc `story_id` và `chapter_number` (`.is(null)` / `.eq`), `order('created_at', desc).range()` |
| comments | `addComment`, `deleteComment` | insert `{ story_id, chapter_number, content }` / delete |
| comments | `getRatingSummary` | `story_cards` (`rating_avg`, `rating_count`, `rating_counts` → `distribution`) |
| comments | `getMyRating`, `rateStory` | `ratings` select / `upsert({ story_id, score }, { onConflict: 'user_id,story_id' })` |
| feedback | `sendContactMessage` | `contact_messages.insert(...)` (không gọi `.select()`) |
| feedback | `reportChapter` | `rpc('report_chapter')` |
| admin | `getAdminOverview` | `rpc('admin_overview', { p_days })` |
| admin | `getAdminUsers`, `getAdminStories`, `getAdminMessages`, `getAdminReports` | `rpc('admin_users' / 'admin_stories' / 'admin_contact_messages' / 'admin_reports', {...}, { count: 'exact' }).range()` qua `loadPage` |
| admin | `setMessageHandled`, `setAdminReportStatus`, `setUserBanned`, `setStoryTakedown`, `updateGenre`, `deleteGenre`, `mergeGenres` | RPC `admin_*` cùng tên (mục 6) |
| admin | nhập truyện hàng loạt | Không có RPC riêng: `features/admin/bulkImport.ts` gọi `createStory` (kèm `p_author_name`) → `importChapters` → `publishStory` của studio |

## 9. Quy trình

- **Tạo migration:** `supabase migration new <ten>`, viết SQL, rồi chạy `supabase db push --dry-run` trước khi chạy `supabase db push`.
- **Kiểm tra bảo mật:** sau mỗi migration chạy `supabase db advisors --linked`.
- **Kiểm tra RLS và luật:** `supabase db query --linked -f supabase/checks/rls_and_rules.sql`.
  - Script chạy trong transaction rồi rollback, nên không để lại dữ liệu.
  - Không lỗi nghĩa là mọi kiểm tra đều qua. Khi đổi schema thì thêm ca kiểm tra vào đây.
- **Sinh kiểu TypeScript:** `supabase gen types typescript --linked --schema public > src/types/database.ts`. File này là file sinh ra, đã được bỏ qua trong `.prettierignore`. Client đã dùng `createClient<Database>`.

## 10. Việc còn lại

- ~~Thay ruột các `api.ts` theo mục 8~~ (xong: mọi feature có `api.remote.ts`). Còn chạy thử bản remote trên project thật (test tích hợp với Supabase).
- **Cấu hình Auth trên Dashboard:**
  - Site URL.
  - Redirect URL (`/auth/callback`, `/reset-password`; localhost và domain Vercel).
  - Bật Google/Facebook.
  - Mẫu email tiếng Việt.
- ~~**Chống spam**~~ (xong 28/09/2026: giới hạn ở mục 4). Còn có thể thêm captcha (Cloudflare Turnstile) cho form liên hệ và đăng ký nếu vẫn bị spam.
- **Vai trò quản trị:** trang `/admin` có tổng quan, người dùng (khóa/mở khóa), truyện (gỡ/khôi phục), hộp thư, báo lỗi, thể loại, nhập truyện hàng loạt (plan: `plan-trang-quan-tri.md`, `plan-cong-cu-admin.md`). Còn `curated_stories` (truyện nổi bật) vẫn sửa qua Dashboard.
  - Cấp quyền (chạy trong SQL editor hoặc `supabase db query --linked`), rồi người đó đăng xuất và đăng nhập lại để JWT có vai trò mới:
    `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}' where email = '...';`
  - Thu hồi: `raw_app_meta_data - 'role'`. JWT cũ vẫn còn quyền tới khi hết hạn (mặc định 1 giờ).
- **Hiệu năng:** khi số truyện lớn, thêm prefilter trigram cho `search_stories`; xếp hạng theo kỳ có thể chuyển sang materialized view.
