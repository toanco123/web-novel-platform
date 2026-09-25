import type { ReaderFont, ReaderTone, ReaderWidth } from './useReaderSettings'

/** Class đổi token màu cho vùng đọc (định nghĩa trong src/index.css) */
export const toneClass: Record<ReaderTone, string> = {
  theme: '',
  white: 'reader-tone-white',
  paper: 'reader-tone-paper',
  gray: 'reader-tone-gray',
  black: 'reader-tone-black',
}

export const tones: { value: ReaderTone; label: string }[] = [
  { value: 'theme', label: 'Theo web' },
  { value: 'white', label: 'Trắng' },
  { value: 'paper', label: 'Giấy vàng' },
  { value: 'gray', label: 'Xám' },
  { value: 'black', label: 'Đen' },
]

export const fonts: { value: ReaderFont; label: string; className: string }[] = [
  { value: 'serif', label: 'Có chân', className: 'font-reading' },
  { value: 'sans', label: 'Không chân', className: 'font-sans' },
]

export const widths: { value: ReaderWidth; label: string; maxWidth: string }[] = [
  { value: 'narrow', label: 'Hẹp', maxWidth: '34rem' },
  { value: 'medium', label: 'Vừa', maxWidth: '40rem' },
  { value: 'wide', label: 'Rộng', maxWidth: '48rem' },
]
