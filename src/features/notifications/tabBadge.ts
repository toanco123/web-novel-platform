// Số thông báo chưa đọc trên tab trình duyệt: tiền tố "(2) " ở tiêu đề và chấm đỏ trên favicon.
import { unreadLabel } from './shared'

const COUNT_PREFIX = /^\((?:\d+|99\+)\)\s+/

/** Bỏ tiền tố "(n) " đã gắn */
export const stripCount = (title: string) => title.replace(COUNT_PREFIX, '')

/** Tiêu đề kèm số chưa đọc; 0 thì là tiêu đề gốc (làm lại nhiều lần vẫn một tiền tố) */
export const withCount = (title: string, count: number) => {
  const base = stripCount(title)
  return count > 0 ? `(${unreadLabel(count)}) ${base}` : base
}

const SIZE = 64
let original: { link: HTMLLinkElement; href: string }[] | null = null
let dotUrl: Promise<string | null> | null = null

/** jsdom (test) không vẽ canvas: bỏ qua thay vì in lỗi "Not implemented" */
const canDraw = () => typeof document !== 'undefined' && !navigator.userAgent.includes('jsdom')

/** Vẽ favicon hiện tại kèm chấm đỏ góc trên phải; null nếu không vẽ được */
function drawDot(): Promise<string | null> {
  dotUrl ??= new Promise((resolve) => {
    const source = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')
    if (!source || !canDraw()) return resolve(null)
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(image, 0, 0, SIZE, SIZE)
        ctx.beginPath()
        ctx.arc(SIZE - 15, 15, 13, 0, Math.PI * 2)
        ctx.fillStyle = '#ef4444'
        ctx.fill()
        ctx.lineWidth = 4
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = source.href
  })
  return dotUrl
}

/** Bật / tắt chấm đỏ trên favicon (tắt thì trả về favicon gốc) */
export async function setFaviconDot(on: boolean) {
  if (typeof document === 'undefined') return
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')]
  if (on) {
    const url = await drawDot()
    if (!url) return
    original ??= links.map((link) => ({ link, href: link.href }))
    for (const link of links) link.href = url
  } else if (original) {
    for (const { link, href } of original) link.href = href
    original = null
  }
}
