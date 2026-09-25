// Vị trí đọc trong một chương, tính theo phần tử <article data-chapter="N"> (dùng chung cho
// thanh tiến độ, lưu chỗ đọc dở và mở lại chỗ đọc dở, ở cả chế độ từng chương và cuộn liên tục)

export const chapterElement = (number: number) =>
  document.querySelector<HTMLElement>(`[data-chapter="${number}"]`)

export const paragraphElement = (chapter: number, paragraph: number) =>
  document.querySelector<HTMLElement>(`[data-chapter="${chapter}"] [data-paragraph="${paragraph}"]`)

/** Tỉ lệ đã đọc 0–1: 0 khi đầu chương ở mép trên màn hình, 1 khi cuối chương chạm mép dưới */
export function progressOf(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  const scrollable = rect.height - window.innerHeight
  if (scrollable <= 0) return rect.top <= 0 ? 1 : 0
  return Math.min(1, Math.max(0, -rect.top / scrollable))
}

/** Cuộn tới vị trí có tỉ lệ đã đọc = progress */
export function scrollToProgress(el: HTMLElement, progress: number) {
  const rect = el.getBoundingClientRect()
  const scrollable = Math.max(0, rect.height - window.innerHeight)
  window.scrollTo({ top: window.scrollY + rect.top + progress * scrollable })
}

/** Đoạn đầu tiên còn thấy được dưới thanh công cụ (để bắt đầu nghe từ đó) */
export function firstVisibleParagraph(chapter: number, topOffset = 72) {
  const paragraphs = document.querySelectorAll<HTMLElement>(
    `[data-chapter="${chapter}"] [data-paragraph]`,
  )
  for (const p of paragraphs) {
    if (p.getBoundingClientRect().bottom > topOffset) return Number(p.dataset.paragraph)
  }
  return 0
}
