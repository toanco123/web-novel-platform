// Nút "Cài ứng dụng": Chrome, Edge, Android phát beforeinstallprompt khi web cài được (có manifest,
// service worker). Giữ sự kiện để người đọc tự bấm cài; iOS không có sự kiện này (tự "Thêm vào màn
// hình chính"), đã cài rồi thì trình duyệt cũng không phát nữa.
import { useSyncExternalStore } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

window.addEventListener('beforeinstallprompt', (event) => {
  // Không để trình duyệt tự hiện thanh gợi ý cài: web có nút riêng
  event.preventDefault()
  deferred = event as BeforeInstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInstallPrompt() {
  const available = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  )
  const install = async () => {
    const event = deferred
    if (!event) return
    // Mỗi sự kiện chỉ gọi prompt() được một lần
    deferred = null
    notify()
    await event.prompt()
  }
  return { available, install }
}
