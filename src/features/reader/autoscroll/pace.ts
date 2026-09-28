// Tốc độ tự động cuộn: 1× là đọc kịp WORDS_PER_MINUTE chữ/phút với bố cục đang hiển thị
import { countWords, WORDS_PER_MINUTE } from '../text'
import { AUTO_SCROLL_SPEEDS } from './useAutoScrollSettings'

/** Ước lượng khi chưa đo được bố cục: khoảng 10 chữ mỗi dòng */
export const estimatedPixelsPerWord = (fontSize: number, lineHeight: number) =>
  (fontSize * lineHeight) / 10

/**
 * Số px ứng với một chữ của chương, đo từ bố cục thật: chiều cao từ đầu đoạn đầu tới cuối đoạn
 * cuối chia cho số chữ. Nhờ vậy tốc độ tự theo cỡ chữ, giãn dòng và độ rộng màn hình.
 * Không đo được (chưa có bố cục, chương rỗng) thì trả `fallback`.
 */
export function pixelsPerWord(article: HTMLElement | null, fallback: number) {
  const paragraphs = article?.querySelectorAll<HTMLElement>('[data-paragraph]')
  if (!paragraphs?.length) return fallback
  const height =
    paragraphs[paragraphs.length - 1].getBoundingClientRect().bottom -
    paragraphs[0].getBoundingClientRect().top
  const words = countWords(Array.from(paragraphs, (p) => p.textContent ?? '').join(' '))
  return height > 0 && words > 0 ? height / words : fallback
}

/** Số px mỗi giây để đọc kịp ở tốc độ `speed` */
export const pixelsPerSecond = (pxPerWord: number, speed: number) =>
  (pxPerWord * WORDS_PER_MINUTE * speed) / 60

/** Tốc độ liền trước (-1) / liền sau (+1) trong AUTO_SCROLL_SPEEDS, dừng ở hai đầu */
export function stepSpeed(speed: number, delta: 1 | -1) {
  const speeds: readonly number[] = AUTO_SCROLL_SPEEDS
  const index = speeds.includes(speed) ? speeds.indexOf(speed) : speeds.indexOf(1)
  return speeds[Math.min(speeds.length - 1, Math.max(0, index + delta))]
}
