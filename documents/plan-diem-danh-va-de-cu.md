# Plan: Điểm danh hằng ngày và phiếu đề cử (giai đoạn 1)

Trạng thái: ✅ xong (07/10/2026). Migration `20261007082322_checkin_and_votes` đã lên production, ca kiểm tra SQL và advisors qua. Nhánh `daily-checkin-votes`. Bản thiết kế giao diện (đã duyệt 07/10/2026): https://claude.ai/artifact/V3U92xanZqnKaLSfALznvs

Khác với plan:
- **Lịch sử phiếu không ghi "ngày thứ mấy"** của lần điểm danh. Chỉ ghi "Điểm danh", hoặc "Điểm danh · thưởng chuỗi 7 ngày" khi nhận +3 (`ledgerText`), nên `wallet_ledger` không cần thêm cột.
- **Header ở màn hẹp (dưới `sm`):** nút đổi theme chuyển vào menu điện thoại (`ThemeToggle row`) để chừa chỗ cho nút điểm danh. Thêm nút mà giữ nút theme thì header tràn ngang 7px ở 375px.
- **"Đi điểm danh"** trong hộp đề cử (khi hết phiếu) mở trang `/rewards`, không mở `CheckInCard` ngay trong hộp.
- `RewardError` thêm vào danh sách lỗi dự kiến của Sentry (`src/lib/errorFilter.ts`).
- `private.ledger_post`: cộng phiếu dùng upsert, trừ phiếu dùng `update` (dòng định chèn có số âm vi phạm `check (balance >= 0)` trước khi Postgres xét trùng khóa). Lỗi chung là `insufficient_balance`, client đổi thành `insufficient_tickets`.
- `story_vote_summary` chỉ đếm "phiếu của mình" khi đã đăng nhập (khách không có quyền đọc `story_votes`).
- Phiếu theo kỳ (bảng xếp hạng 7 / 30 ngày, 7 ngày trong thống kê) đếm qua hàm DEFINER `private.vote_ranking`, `private.story_vote_counts` vì `story_votes` chỉ cho chủ đọc.
- `/rewards` thêm vào `PRIVATE` của `api/_lib/html.ts` (bot nhận trang riêng tư, không phải 404).
- Test đăng xuất trong `auth-flow.test.tsx` chỉ tìm link "Đăng nhập" trong header: trang chủ thêm khối "Đề cử tuần" làm `findByRole` trên cả trang chậm, quá thời gian khi chạy song song.

## Context

Web chưa có gì giữ người đọc quay lại mỗi ngày, và truyện hay chỉ nổi lên nhờ lượt đọc, điểm chấm, lượt theo dõi. Người dùng muốn ba việc: giữ người đọc quay lại mỗi ngày, giúp truyện hay và tác giả được chú ý hơn, và chuẩn bị cho việc kiếm tiền sau này.

Chia hai giai đoạn:
- **Giai đoạn 1 (plan này):** điểm danh mỗi ngày để nhận **phiếu đề cử**, dùng phiếu để đề cử truyện, có bảng xếp hạng "Đề cử".
- **Giai đoạn 2 (dự án riêng, sau này):** xu, nạp tiền, chương trả phí hoặc đọc sớm, chia doanh thu cho tác giả.

Mọi lần cộng hoặc trừ phiếu đều ghi vào một **sổ giao dịch chung** có cột loại tài sản. Giai đoạn 2 chỉ cần thêm loại `coin` vào đúng sổ này, không phải làm lại bảng.

Hiện DB chưa có tiền tệ, ví hay cơ chế gamification nào. Mọi thứ trong plan này đều là mới.

## Đã chốt (07/10/2026)

- **Điểm danh bằng nút bấm**, không tự cộng khi đăng nhập: phiên Supabase giữ rất lâu nên người dùng hầu như không đăng nhập lại mỗi ngày. Phải đăng nhập mới điểm danh được.
- **Ngày tính theo giờ Việt Nam** (`Asia/Ho_Chi_Minh`) và do DB quyết định, như các bộ đếm theo ngày đang có. Đổi giờ máy không gian lận được.
- **Phần thưởng:** ngày thường +1 phiếu. Ngày thứ 7, 14, 21… của chuỗi liên tiếp +3 phiếu (chu kỳ 7 ngày, tối đa 9 phiếu / tuần). Lỡ một ngày thì chuỗi về 1.
- **Phiếu không hết hạn và không đổi ra tiền.** Phiếu và xu sau này là hai loại tách hẳn. Việc giai đoạn 2 có tặng thêm "xu khóa" khi điểm danh hay không sẽ quyết sau, không ảnh hưởng plan này.
- **Đề cử:** một lần đề cử dùng 1 phiếu hoặc nhiều hơn, cho truyện đang công khai và không phải của chính mình. Đã đề cử thì không rút lại.
- **Chống tạo nhiều tài khoản để dồn phiếu:** tài khoản phải được tạo ít nhất **3 ngày** mới được đề cử. Điểm danh vẫn tính từ ngày đầu, nên phiếu tích lại chứ không mất. Đăng ký đã có captcha Turnstile.
- **Bảng xếp hạng:** thêm tiêu chí "Đề cử" (7 ngày / 30 ngày / mọi lúc, cùng cửa sổ trượt với "Đọc nhiều").

Ngoài phạm vi:
- Bù điểm danh ngày lỡ.
- Nhắc điểm danh bằng thông báo đẩy hoặc email (chưa có pg_cron).
- Huy hiệu, cấp độ, EXP.
- Nhiệm vụ hằng ngày (đọc N chương, bình luận…).
- Trang quản trị cho đề cử (quản trị viên tra bằng SQL khi cần).
- Giao diện app di động. RPC dùng được cho app, nhưng app làm sau và ghi vào `dong-bo-web.md`.
- Mọi thứ của giai đoạn 2.

## 1. Luật điểm danh

| Việc | Luật |
|---|---|
| Điểm danh (`checkIn()`) | Một lần / người / ngày (giờ Việt Nam). Lần thứ hai trong ngày → `already_checked_in` |
| Chuỗi (`streak`) | Hôm qua có điểm danh thì `streak` = chuỗi của hôm qua + 1, không thì 1 |
| Thưởng | `streak % 7 = 0` → `CHECKIN_BONUS_REWARD` (3), ngược lại `CHECKIN_REWARD` (1) |
| Chuỗi hiện tại (để hiển thị) | Có điểm danh hôm nay hoặc hôm qua thì là chuỗi của lần gần nhất, không thì 0 |
| Ô trong chu kỳ 7 ngày | Ngày thứ `((streak - 1) % 7) + 1`. Giao diện vẽ 7 ô, ô 7 là ô quà |

Hằng số đặt ở `features/rewards/shared.ts` (`CHECKIN_REWARD`, `CHECKIN_BONUS_REWARD`, `CHECKIN_CYCLE = 7`, `VOTE_MIN_ACCOUNT_AGE_DAYS = 3`). DB viết cứng cùng giá trị. Ca kiểm tra SQL và test bản giả giữ hai bên khớp nhau.

## 2. Luật đề cử

| Việc | Luật / mã lỗi |
|---|---|
| Đề cử (`voteStory(slug, amount)`) | `amount` là số nguyên 1–1000, sai thì `invalid_amount` |
| Truyện | Phải đang công khai và có ≥ 1 chương đã xuất bản, không thì `not_found` |
| Truyện của mình | Bị chặn: `own_story` |
| Tuổi tài khoản | `profiles.created_at` phải cách hiện tại ≥ 3 ngày, không thì `account_too_new` |
| Số dư | Không đủ phiếu → `insufficient_tickets`. Số dư không bao giờ âm (ràng buộc ở DB) |
| Kết quả | Trừ phiếu, ghi sổ, ghi `story_votes`, cộng `story_stats.vote_count`, tất cả trong một transaction |

Truyện bị ẩn hoặc gỡ thì phiếu đã đề cử vẫn nằm trong sổ nhưng truyện rời bảng xếp hạng (bảng xếp hạng chỉ lấy truyện công khai). Truyện bị xóa thì `story_votes` xóa theo, còn dòng sổ giữ lại với `story_id = null`.

## 3. Dữ liệu

### Kiểu (`features/rewards/shared.ts`)

```ts
type RewardStatus = {
  balance: number           // số phiếu đang có
  today: string             // 'YYYY-MM-DD' theo giờ Việt Nam, do máy chủ trả
  checkedInToday: boolean
  streak: number            // chuỗi hiện tại (mục 1)
  nextReward: number        // số phiếu của lần điểm danh tiếp theo
}
type CheckInResult = { reward: number; streak: number; balance: number }
type LedgerEntry = {
  id: string
  amount: number            // + nhận, − dùng
  reason: 'checkin' | 'vote'
  story: { slug: string; title: string } | null
  balanceAfter: number
  createdAt: string
}
type StoryVoteSummary = { total: number; week: number; mine: number }

type RewardErrorCode =
  | 'already_checked_in' | 'insufficient_tickets' | 'own_story'
  | 'account_too_new' | 'invalid_amount' | 'not_found'
class RewardError extends Error { code: RewardErrorCode }  // câu báo tiếng Việt trong shared.ts
```

### `features/rewards/api` (feature mới, theo 4 file)

| Hàm | Việc |
|---|---|
| `getRewardStatus()` | Trạng thái điểm danh và số dư của người đang đăng nhập |
| `checkIn()` | Điểm danh |
| `getTicketHistory({ page })` | Lịch sử phiếu, mới nhất trước, 20 dòng / trang |
| `getStoryVoteSummary(slug)` | Tổng đề cử của truyện (mọi lúc, 7 ngày) và số phiếu mình đã đề cử. Khách gọi được (`mine = 0`) |
| `voteStory(slug, amount)` | Đề cử |

Hook (`hooks.ts`):
- Query key: `['rewards', userId, 'status']`, `['rewards', userId, 'history', page]`, `['votes', slug, userId]`.
- `useCheckIn` cập nhật status bằng `setQueryData` và invalidate lịch sử.
- `useVoteStory` invalidate status, lịch sử, `['votes', slug]` và `['stories', 'ranking']`.

### Thay đổi feature khác

- `features/stories`: `RankingCriterion` thêm `'votes'`. `getRanking('votes', period)` và hook mới `useTopVotedWeekly()` (top 10, 7 ngày).
- `features/studio`: `StoryStats` thêm `votes: { total: number; week: number }`.

### Database (migration `checkin_and_votes`)

Làm theo skill `db-migration`.

- **Enum:**
  - `public.wallet_currency`: `ticket`. Giai đoạn 2 thêm `coin`.
  - `public.ledger_reason`: `checkin`, `vote`. Giai đoạn 2 thêm `topup`, `unlock_chapter`…
- **`public.wallet_balances`** `(user_id → profiles on delete cascade, currency, balance int not null default 0 check (balance >= 0), updated_at, primary key (user_id, currency))`.
- **`public.wallet_ledger`** `(id bigint identity, user_id → profiles on delete cascade, currency, amount int check (amount <> 0), reason, story_id → stories on delete set null, balance_after int, created_at)`. Index `(user_id, created_at desc)`.
- **`public.daily_checkins`** `(user_id → profiles on delete cascade, day date, streak int check (streak >= 1), reward int, created_at, primary key (user_id, day))`.
- **`public.story_votes`** `(id bigint identity, story_id → stories on delete cascade, user_id → profiles on delete cascade, amount int check (amount between 1 and 1000), created_at)`. Index `(story_id, created_at)` và `(created_at)` cho xếp hạng theo kỳ.
- **`story_stats`** thêm `vote_count bigint not null default 0`.
- **RLS và quyền:**
  - Cả bốn bảng mới đều bật RLS.
  - `wallet_balances`, `wallet_ledger`, `daily_checkins`, `story_votes`: chỉ chủ đọc được (`user_id = (select auth.uid())`), không ai ghi từ client. `revoke all` rồi chỉ `grant select` cho `authenticated`.
  - Ai đề cử truyện nào là thông tin riêng, nên số liệu công khai chỉ đi qua RPC tổng hợp.
- **Hàm ghi sổ `private.ledger_post(user_id, currency, amount, reason, story_id)`** (DEFINER, không ai EXECUTE từ API):
  - `insert … on conflict do update set balance = balance + amount returning balance`. Câu lệnh này khóa dòng nên hai yêu cầu cùng lúc không làm sai số dư.
  - Ràng buộc `check` làm số dư âm thì đổi thành lỗi `insufficient_tickets`.
  - Ghi `wallet_ledger` kèm `balance_after`.
  - Đây là cửa duy nhất làm đổi số dư, và giai đoạn 2 dùng lại nguyên hàm này.
- **RPC** (DEFINER ở `private`, lớp vỏ INVOKER ở `public`):

  | Hàm | Ai gọi | Việc |
  |---|---|---|
  | `daily_checkin()` | `authenticated` | Insert `daily_checkins` cho ngày hôm nay (`on conflict do nothing`; không có dòng mới → `already_checked_in`), tính `streak` và thưởng, gọi `ledger_post`. Trả jsonb `CheckInResult` |
  | `reward_status()` | `authenticated` | jsonb `RewardStatus` |
  | `vote_story(p_slug, p_amount)` | `authenticated` | Luật mục 2, trả jsonb `{ balance, total }` |
  | `story_vote_summary(p_slug)` | `anon`, `authenticated` | jsonb `StoryVoteSummary` (truyện không công khai → `not_found`) |

- **`story_ranking`:** thêm nhánh `p_by = 'votes'`.
  - `all`: lấy `story_stats.vote_count`.
  - `week` / `month`: `sum(story_votes.amount)` với `created_at` trong 7 / 30 ngày gần nhất (tính theo giờ Việt Nam như nhánh `views`).
  - Giữ nguyên chữ ký hàm.
- **`studio_story_stats`:** thêm `votes: { total, week }`.
- **`delete_account`:** không phải sửa, vì các bảng mới cascade theo `profiles`.

### Bản giả

- Lưu điểm danh, sổ phiếu và đề cử trong `src/mocks/activity.ts`. Lý do: dữ liệu này được nhiều api dùng chung (rewards, xếp hạng của stories, thống kê của studio).
- Ngày giờ Việt Nam lấy bằng một hàm `vnToday()`. Test đổi ngày bằng `vi.setSystemTime`.
- Tuổi tài khoản lấy ngày tạo của người dùng giả trong `src/mocks/users.ts`. Tài khoản thiếu ngày tạo (kể cả tài khoản demo) thì coi như đủ tuổi.
- Áp đúng luật mục 1 và 2.

## 4. Giao diện

Theo bản thiết kế (link ở đầu file): giao diện tối mặc định, hệ màu và font có sẵn. Biểu tượng chung:
- **Phiếu:** icon `Ticket`.
- **Chuỗi ngày:** icon `Flame` màu `neon`.
- **Quà ngày 7:** bông hoa 5 cánh lấy từ logo "Sách nở hoa" (`RewardBloom`, SVG nội tuyến, cánh `neon`, nhụy `rose-gold`). Dùng ở ô ngày 7, lời chúc sau khi điểm danh hoặc đề cử, và khối mời điểm danh.

- **`CheckInCard`** (`features/rewards/components`):
  - **Tiêu đề:** "Điểm danh hằng ngày" (`font-heading`) + dòng "Đủ 7 ngày liền nhận thêm quà 3 phiếu."
  - **Hai ô số liệu:** "Chuỗi liên tiếp" (số lớn `font-heading` + "ngày") và "Phiếu đề cử" (số `rose-gold` + "phiếu").
  - **7 ô ngày** (lưới 7 cột):
    - Đã nhận: nền `secondary`, vòng `rose-gold` có dấu tick.
    - Hôm nay: viền `neon` + quầng sáng mờ, vòng nét đứt "+1", nhãn "Hôm nay".
    - Chưa tới: vòng "+1" mờ.
    - Ngày 7: nền `wine` + `RewardBloom`, nhãn "+3".
  - **Thanh tiến độ:** "Còn N ngày tới quà +3 phiếu" và "k/7".
  - **Nút:** chưa điểm danh thì nút chính tròn "Điểm danh nhận +N phiếu". Đã điểm danh thì nút khóa "Đã điểm danh, quay lại ngày mai".
  - **Ngay sau khi điểm danh:** khung lời chúc có `RewardBloom` ("+1 phiếu đề cử. Hẹn bạn ngày mai nhé!" / "+3 phiếu: thưởng chuỗi 7 ngày!") + toast.
  - **Cuối thẻ:** "Dùng phiếu để đề cử truyện bạn thích" + link "Phiếu của tôi →" (`/rewards`). Trên trang `/rewards` thì không có link này.
- **Nút điểm danh ở header** (`CheckInButton`), chỉ khi đã đăng nhập, đứng trước nút đổi theme:
  - Icon `CalendarCheck`. Chưa điểm danh thì viền + chấm `neon`, `aria-label` "Điểm danh hằng ngày (chưa điểm danh hôm nay)".
  - Từ màn `sm`: Popover rộng ~420px chứa `CheckInCard`.
  - Dưới `sm`: Sheet trượt từ đáy (bo góc trên, thanh kéo, nút "Đóng").
  - `MobileNav` và `UserMenu` có thêm mục "Phiếu đề cử" (`/rewards`).
- **Trang `/rewards` "Phiếu đề cử"** (`paths.rewards`, bọc `RequireAuth`, `noindex`):
  - Tiêu đề + một câu giới thiệu.
  - Hàng 2 khối (`flex-wrap`, xếp chồng trên điện thoại): `CheckInCard` và "Cách nhận và dùng phiếu". Khối sau gồm 3 dòng có icon: điểm danh +1, đủ 7 ngày +3, đề cử truyện → bảng Đề cử tuần; cuối khối có ghi chú "Phiếu không hết hạn và không đổi ra tiền. Tài khoản tạo đủ 3 ngày mới đề cử được."
  - "Lịch sử phiếu": bảng 4 cột (Thời gian, Nội dung, Thay đổi, Số dư), cuộn ngang trên điện thoại.
    - Thay đổi `+N` màu `neon`, `−N` màu chữ thường; chấm màu đầu dòng.
    - "Đề cử *Tên truyện*" có link tới truyện.
    - Phân trang `?page=` (`Pagination` chung). Trạng thái rỗng: "Chưa có giao dịch nào. Điểm danh để nhận phiếu đầu tiên."
- **Nút "Đề cử" ở trang truyện** (`VoteButton` trong `StoryHero`, cạnh `FollowButton`):
  - Nút ghi "Đề cử" + số đề cử 7 ngày. Truyện của mình: không hiện. Khách bấm thì sang đăng nhập (`paths.login(current)`).
  - Bấm mở Dialog (dưới `sm`: Sheet từ đáy) "Đề cử truyện":
    - Dòng truyện: bìa nhỏ, tên, "Tuần này N phiếu", "Bạn đã đề cử k phiếu" nếu có.
    - "Chọn số phiếu" + "Bạn có N phiếu".
    - Bộ tăng giảm (− số lớn +), nút chọn nhanh 1 / 5 / 10 / Tất cả (nút quá số dư thì mờ).
    - Nút "Đề cử N phiếu" + dòng "Phiếu đã đề cử không rút lại được."
  - **Đề cử xong:** `RewardBloom` + "Đã đề cử N phiếu", "Cảm ơn bạn đã ủng hộ tác giả. Bạn còn M phiếu.", hai nút "Đề cử thêm" / "Xem Đề cử tuần" (`/ranking?by=votes`).
  - **Hết phiếu:** "Bạn chưa có phiếu" + "Đi điểm danh" (mở `CheckInCard`).
  - **`account_too_new`:** báo "Tài khoản cần tạo đủ 3 ngày mới đề cử được."
- **Bảng xếp hạng `/ranking`:** thêm tiêu chí "Đề cử" (`?by=votes`, gợi ý "Xếp theo số phiếu đề cử độc giả dành cho truyện trong kỳ."), đứng sau "Đọc nhiều". Cột giá trị hiện "N phiếu".
- **Trang chủ, khối "Đề cử tuần"** (`TopVotedWeekly`) ở cột phải, dưới "Top tuần":
  - Tiêu đề có icon phiếu, link "Xem tất cả" → `/ranking?by=votes`.
  - Top 6: hạng `font-heading` (hạng 1 `neon`, 2–3 `rose-gold`, còn lại chữ phụ), bìa nhỏ, tên + thể loại, số phiếu.
  - Cuối khối là ô mời điểm danh (`RewardBloom` + nút "Điểm danh hôm nay"). Khách thì nút sang đăng nhập; đã điểm danh hôm nay thì ẩn ô này.
  - Trạng thái rỗng (DB thật bắt đầu trống): "Chưa có truyện nào được đề cử tuần này", vẫn có ô mời điểm danh.
- **Khu Sáng tác, tab Thống kê:** thêm ô "Đề cử" (tổng + 7 ngày).
- Kiểm tra giao diện ở 375 / 768 / 1440px, cả hai theme. Giao diện sáng dùng token của theme sáng (bản thiết kế chỉ vẽ theme tối). Header ở màn 375px phải đủ chỗ cho icon mới, không tràn ngang.

## 5. Chuẩn bị cho giai đoạn 2

Những phần làm ở giai đoạn 1 mà giai đoạn 2 dùng lại nguyên:
- `wallet_balances` / `wallet_ledger` có cột `currency`. Thêm `coin` vào enum là có ví xu.
- `private.ledger_post` là cửa duy nhất đổi số dư, có khóa dòng và chặn số dư âm. Nạp xu và mở chương chỉ cần gọi hàm này với `reason` mới.
- `balance_after` trong sổ giúp đối soát khi có tiền thật.

Giai đoạn 2 sẽ có plan riêng cho: nạp tiền (cổng thanh toán), chương trả phí / đọc sớm, chia doanh thu cho tác giả, xu khóa (nếu chọn), và trang quản trị giao dịch.

## 6. Kiểm tra

- **Test api bản giả (`features/rewards/api.test.ts`):**
  - Điểm danh lần đầu được +1, chuỗi 1. Điểm danh lần hai trong ngày → `already_checked_in`.
  - Sang ngày mới thì chuỗi 2. Lỡ một ngày thì chuỗi về 1. Ngày 7 và ngày 14 được +3.
  - `getRewardStatus` khi đã lỡ ngày: `streak = 0`.
  - Đề cử: đủ điều kiện thì trừ phiếu và tăng tổng của truyện. Kiểm cả các lỗi `insufficient_tickets`, `own_story`, `account_too_new`, `invalid_amount`, `not_found` (truyện nháp).
  - Lịch sử có `balanceAfter` đúng và phân trang đúng.
  - Khách gọi `checkIn` → `unauthenticated`.
- **Test bản giả của stories và studio:** `getRanking('votes', 'week')` không tính phiếu cũ hơn 7 ngày và bỏ truyện không công khai. `getStoryStats` có `votes`.
- **Test bản remote (`features/rewards/api.remote.test.ts`):** gọi đúng RPC, map jsonb sang kiểu, map mã lỗi sang `RewardError`, lịch sử đọc `wallet_ledger` qua `loadPage`.
- **Test luồng:**
  - Đăng nhập → chấm ở header → điểm danh → toast và số phiếu tăng, chấm biến mất.
  - Trang truyện → "Đề cử" → chọn số → tổng tăng, `/ranking?by=votes` có truyện.
  - Khách bấm "Đề cử" → sang đăng nhập.
  - Trang `/rewards` có lịch sử.
- **`supabase/checks/rls_and_rules.sql`:**
  - Client không insert / update được bốn bảng mới và `story_stats.vote_count`.
  - Người khác không đọc được sổ, số dư, điểm danh, đề cử của mình.
  - Điểm danh hai lần trong ngày → `already_checked_in`.
  - Đề cử các ca lỗi (truyện nháp, truyện của mình, tài khoản mới, thiếu phiếu). Số dư không âm.
  - `anon` gọi được `story_vote_summary` và `story_ranking('votes')`, không gọi được `daily_checkin` / `vote_story`.
  - Xóa truyện thì dòng sổ còn, `story_id = null`.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 7. Các bước

1. `features/rewards`: kiểu, hằng, bản giả (trong `mocks/activity.ts`) và test api.
2. Thêm `votes` cho bản giả của stories (xếp hạng) và studio (thống kê), kèm test.
3. Giao diện: `CheckInCard`, `CheckInButton` ở header, trang `/rewards`, mục trong menu, kèm test luồng.
4. Giao diện: `VoteButton` ở trang truyện, tiêu chí "Đề cử" ở `/ranking`, khối "Đề cử tuần" trên trang chủ, ô "Đề cử" ở thống kê Sáng tác, kèm test luồng.
5. Migration, ca kiểm tra SQL (thử trước bằng transaction rollback), push, advisors, sinh kiểu. Sau đó viết `api.remote.ts` kèm test.
6. Cập nhật `thiet-ke-database.md` (bảng, enum, mã lỗi, RLS, RPC, bảng tra mục 8), `CLAUDE.md`, lộ trình trong `plan-bo-cuc-va-cong-nghe.md`. Kiểm tra giao diện, chạy toàn bộ test, lint, build, rồi gộp vào `main`.

**Thứ tự deploy:** migration chỉ thêm mới. `story_ranking` giữ nguyên chữ ký, còn `studio_story_stats` chỉ thêm trường. Vì vậy frontend cũ không bị ảnh hưởng, có thể push DB trước rồi gộp `main` sau.
