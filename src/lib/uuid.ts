/** Chuỗi có dạng uuid. Id gõ tay trên URL không đúng dạng thì không gửi lên máy chủ (lỗi 22P02). */
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
