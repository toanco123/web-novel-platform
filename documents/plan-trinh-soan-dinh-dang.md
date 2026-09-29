# Plan: Thanh định dạng trong trình soạn chương

## Context
Ô "Nội dung chương" (trình soạn chương và phần "Chương đầu tiên" của form tạo truyện) là textarea văn bản thuần. Người dùng muốn một thanh công cụ như các trình soạn quen thuộc để tự định dạng đoạn văn của mình, và định dạng đó hiện ra cho người đọc.

Đã chốt với người dùng (29/09/2026):
- **Đợt 1 (plan này):** đủ thanh như ảnh mẫu, **trừ chèn ảnh**.
- **Đợt 2 (sau):** chèn ảnh vào chương (cần bucket Storage, giới hạn dung lượng, dọn ảnh khi xóa chương/tài khoản).
- Cách làm: trình soạn trực quan bằng **Tiptap**, lưu **HTML rút gọn**; trang đọc tự phân tích và dựng bằng React, không render HTML thô.

**Trạng thái:** ✅ Xong đợt 1 (29/09/2026). Đợt 2 (chèn ảnh) chưa làm.

---

## 1. Thanh công cụ
Thứ tự: Hoàn tác · Làm lại | Kiểu khối (Đoạn văn / Tiêu đề lớn / Tiêu đề nhỏ) | Đậm · Nghiêng · Gạch chân · Gạch ngang | Chọn tất cả · Xóa định dạng | Căn giữa | Danh sách chấm (● ○ ■) · Danh sách số (1. a. i. I.).

- Nút shadcn (`Button`, `DropdownMenu`, `Tooltip`), dùng token màu nên đúng cả hai theme. Nút bật/tắt có `aria-pressed`, dropdown có nhãn đọc được.
- Thanh dính trên đầu ô khi cuộn chương dài; ở màn hình hẹp cuộn ngang bên trong thanh.
- Phím tắt mặc định của Tiptap (Ctrl+B/I/U/Z, Ctrl+Shift+Z...).
- Dán từ Word/web: schema chỉ giữ các định dạng trên, còn lại bỏ.
- Danh sách **một cấp**: mục danh sách chỉ chứa đoạn văn (`paragraph+`, cần `+` để bọc nhiều đoạn đang chọn thành danh sách), không lồng danh sách. Trang đọc nối các đoạn trong một mục bằng xuống dòng.
- Ô soạn là `role="textbox"` `aria-multiline`, gắn nhãn bằng `aria-labelledby` (test vẫn tìm bằng `getByLabelText`).
- Tiptap chỉ được import trong `features/studio` nên chỉ nằm trong chunk các trang Sáng tác.

## 2. Định dạng lưu trữ
Chương mới lưu HTML rút gọn, chỉ gồm:
- Khối: `<p>`, `<h2>`, `<h3>` (có thể `style="text-align: center"`), `<ul>`/`<ol>` (có thể `data-style="circle|square"` / `"lower-alpha|lower-roman|upper-roman"`), `<li><p>…</p></li>`.
- Trong dòng: `<strong>`, `<em>`, `<u>`, `<s>`, `<br>`.

Quy tắc:
- Nội dung **bắt đầu bằng thẻ khối** (`<p`, `<h2`, `<h3`, `<ul`, `<ol`) là HTML; ngược lại là **văn bản thuần kiểu cũ** (đoạn cách nhau bằng dòng trống). Chương cũ, chương nhập từ `.txt` và nhập hàng loạt vẫn là văn bản thuần, không cần chuyển đổi.
- Trước khi lưu, nội dung được **dựng lại từ mô hình đã lọc** (`normalizeContent`), nên HTML trong DB luôn chỉ có các thẻ/thuộc tính trên. Nội dung chỉ có một đoạn không định dạng vẫn lưu dạng HTML (đơn giản, nhất quán).
- Mở chương văn bản thuần trong trình soạn: chuyển sang `<p>` (xuống dòng đơn → `<br>`); lưu lại thì thành HTML.
- Giới hạn: 100 – 100.000 ký tự tính trên **chữ nhìn thấy**; bản lưu tối đa 200.000 ký tự (`CONTENT_STORED_MAX`). DB nới `chapters.content` từ `between 1 and 100000` lên `between 1 and 200000` (migration mới).

## 3. Mô-đun `features/chapters/richText.ts` (hàm thuần)
- `parseContent(content): Block[]` — nhận cả HTML lẫn văn bản thuần. Block: `{ type: 'paragraph' | 'heading', level?, align?, inlines }` hoặc `{ type: 'list', ordered, style?, items: Inline[][] }`. Inline: `{ text, bold?, italic?, underline?, strike? }` (`\n` cho `<br>`).
  - Dùng `DOMParser` (không gắn vào trang, không chạy script); thẻ lạ bị bỏ nhưng giữ chữ bên trong (`<script>`, `<style>` bỏ cả chữ); thuộc tính ngoài danh sách bị bỏ; danh sách lồng được làm phẳng.
- `blockTexts(blocks): string[]` — chữ của từng đơn vị đọc (đoạn, tiêu đề, **từng mục danh sách**) theo thứ tự; dùng cho nghe truyện.
- `contentText(content): string` — toàn bộ chữ (đếm chữ, đếm ký tự, kiểm tra độ dài).
- `serializeBlocks(blocks): string` / `normalizeContent(content)` — HTML chuẩn để lưu; `toEditorHtml(content)` — HTML cho trình soạn.

## 4. Trang đọc
- `ChapterArticle` dựng từ `parseContent`: mỗi đoạn, tiêu đề và mục danh sách có `data-paragraph` đánh số liên tục (tiến độ, lưu vị trí, tô đoạn đang nghe, tự cuộn giữ nguyên cách làm).
- Tiêu đề trong chương hiển thị `h2`/`h3` (cuộn liên tục, khi tên chương là `h2`: `h3`/`h4`).
- Chữ hoa đầu chương chỉ khi khối đầu là đoạn văn bắt đầu bằng chữ cái.
- Nghe truyện dùng `blockTexts(parseContent(content))` thay cho `toParagraphs`.
- Đếm chữ (trang đọc, bảng chương, ô soạn, trang nhập) dùng `contentText`.

## 5. Không đổi
Bình luận vẫn văn bản thuần. Nhập chương từ `.txt` và nhập hàng loạt giữ nguyên (văn bản thuần vẫn hợp lệ).

## 6. Kiểm thử
- Test đơn vị `richText`: văn bản cũ, HTML đủ khối, XSS (`<script>`, `onerror`, `javascript:`, `style` lạ), danh sách lồng, chuẩn hóa ổn định (normalize 2 lần như 1).
- Test tích hợp: soạn chương có chữ đậm → lưu → trang đọc có `<strong>`; chương văn bản thuần cũ hiển thị như trước.
- Cập nhật test đang gõ vào textarea.

## 7. Tiến độ
Ghi chú khi làm:
- Tiptap 3 (`@tiptap/react`, `starter-kit`, `extension-list`, `extension-text-align`, `extensions`); cấu hình schema ở `features/studio/editor/extensions.ts`, thanh công cụ `EditorToolbar.tsx`, ô soạn `ChapterContentEditor.tsx` (form nối qua `useController`).
- Chuẩn hóa nằm trong schema zod (`features/studio/schemas.ts`): `handleSubmit` nhận HTML đã làm sạch.
- Test: jsdom mất ký tự khi gõ từng phím vào ProseMirror, nên test viết vào trình soạn bằng `writeInEditor` (`src/test/helpers.ts`: bấm vào ô rồi dán). `src/test/setup.ts` stub `Range.getClientRects`/`getBoundingClientRect` và `document.elementFromPoint`.
- Kiểm tra UI (375/768/1440, hai theme): thanh dùng `contain: inline-size` để không đẩy rộng cột form ở 375px (cuộn ngang bên trong thanh); nút đang bật tô `bg-primary/15 text-primary` (nền accent quá mờ trên nền tối); tooltip ghi ⌘ trên máy Apple (Ctrl+B trên macOS là phím di chuyển con trỏ); tiêu đề trong chương ở trang đọc dùng `font-bold` để nổi hơn chữ Literata.
- Migration `20260929030514_chapter_content_rich_text.sql` đã push; thêm ca kiểm tra độ dài vào `supabase/checks/rls_and_rules.sql`.

- [x] `richText.ts` + test
- [x] Trình soạn Tiptap + thanh công cụ, nối vào `ChapterFields`
- [x] Schema / đếm chữ theo chữ nhìn thấy, chuẩn hóa khi lưu
- [x] Trang đọc + nghe truyện
- [x] Migration nới giới hạn, sinh lại kiểu, cập nhật `thiet-ke-database.md`
- [x] Cập nhật test, CLAUDE.md, kiểm tra UI 375/768/1440 và hai theme
