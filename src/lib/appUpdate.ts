// Bản mới của web đang chờ (service worker mới đã tải xong, chờ kích hoạt). Service worker cũ vẫn
// phục vụ index.html cũ, mà file JS của trang không nằm trong bộ nhớ đệm (khu Sáng tác, Quản trị)
// đã bị xóa khỏi máy chủ sau khi deploy: tải lại trang thường không cứu được, phải kích hoạt bản mới.
let apply: (() => void) | null = null

/** PwaUpdater báo có bản mới (null: không còn) */
export function setPendingUpdate(update: (() => void) | null) {
  apply = update
}

/** Tải lại trang; có bản mới đang chờ thì kích hoạt nó (service worker mới tự tải lại trang) */
export function reloadApp() {
  if (apply) apply()
  else window.location.reload()
}
