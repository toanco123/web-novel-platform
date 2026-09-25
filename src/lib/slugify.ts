/**
 * "Ngôn Tình Đô Thị!" → "ngon-tinh-do-thi"
 * Dùng cho đường dẫn và để so trùng tên (không phân biệt dấu, hoa thường, khoảng trắng).
 */
export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
