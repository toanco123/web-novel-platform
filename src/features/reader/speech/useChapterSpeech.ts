import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetchChapter } from '@/features/chapters/hooks'
import { toParagraphs } from '../text'
import { splitForSpeech } from './splitForSpeech'
import { useSpeechSettings } from './useSpeechSettings'
import { pickVoice, speechSupported, useVoices } from './useVoices'

export type SpeechStatus = 'idle' | 'playing' | 'paused'

export type SpeechState = {
  status: SpeechStatus
  /** Chương đang đọc (có thể khác chương trên URL ở chế độ cuộn liên tục) */
  chapter: number | null
  /** Chỉ số đoạn đang đọc trong chương */
  paragraph: number
  /** Tổng số đoạn của chương đang đọc (0 khi chưa tải xong) */
  total: number
}

export type ChapterSpeech = SpeechState & {
  supported: boolean
  start: (chapter: number, paragraph?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  /** Nhảy tới đoạn trước (-1) / sau (+1) */
  skip: (delta: number) => void
  setRate: (rate: number) => void
}

const IDLE: SpeechState = { status: 'idle', chapter: null, paragraph: 0, total: 0 }
// Chrome đôi khi bỏ qua câu nói ngay sau cancel(); chờ một nhịp trước khi đọc tiếp
const AFTER_CANCEL_MS = 60

/**
 * Đọc to chương bằng Web Speech API: đọc lần lượt từng đoạn (mỗi đoạn tách thành câu ngắn).
 * Tạm dừng = dừng hẳn và nhớ đoạn đang đọc (pause() của trình duyệt chạy không ổn định trên
 * Android). Hết chương thì gọi onAdvance(chương sau) để trang đọc chuyển theo, rồi đọc tiếp.
 */
export function useChapterSpeech(slug: string, onAdvance: (next: number) => void): ChapterSpeech {
  const supported = speechSupported()
  const fetchChapter = useFetchChapter()
  const { rate, voiceURI, autoNext, update } = useSpeechSettings()
  const { all: voices } = useVoices()
  const [state, setState] = useState<SpeechState>(IDLE)
  // Mã lượt phát: mỗi lần phát/dừng tăng lên, callback của lượt cũ tự bỏ qua
  const run = useRef(0)
  // Giá trị mới nhất cho các callback đang chạy dở (utterance.onend)
  const latest = useRef({ rate, voice: pickVoice(voices, voiceURI), autoNext, onAdvance })
  useEffect(() => {
    latest.current = { rate, voice: pickVoice(voices, voiceURI), autoNext, onAdvance }
  })

  const play = useCallback(
    // Hàm có tên để tự gọi lại khi sang chương sau
    async function play(chapter: number, from: number) {
      const id = ++run.current
      speechSynthesis.cancel()
      // Sang chương khác thì chưa biết số đoạn (thanh điều khiển hiện "đang chuẩn bị")
      setState((s) => ({
        status: 'playing',
        chapter,
        paragraph: from,
        total: s.chapter === chapter ? s.total : 0,
      }))
      const [data] = await Promise.all([
        fetchChapter(slug, chapter).catch(() => null),
        new Promise((r) => setTimeout(r, AFTER_CANCEL_MS)),
      ])
      if (id !== run.current) return
      if (!data) {
        setState(IDLE)
        return
      }
      const paragraphs = toParagraphs(data.content)

      const speakParagraph = (i: number) => {
        if (id !== run.current) return
        if (i >= paragraphs.length) {
          if (latest.current.autoNext && data.next) {
            latest.current.onAdvance(data.next.number)
            void play(data.next.number, 0)
          } else {
            setState(IDLE)
          }
          return
        }
        setState({ status: 'playing', chapter, paragraph: i, total: paragraphs.length })
        const chunks = splitForSpeech(paragraphs[i])
        // Bắt đầu từ đầu chương thì đọc tên chương trước
        if (i === 0 && from === 0) chunks.unshift(`Chương ${data.number}. ${data.title}.`)
        let k = 0
        const speakNext = () => {
          if (id !== run.current) return
          if (k >= chunks.length) return speakParagraph(i + 1)
          const utterance = new SpeechSynthesisUtterance(chunks[k++])
          const { rate, voice } = latest.current
          utterance.lang = voice?.lang ?? 'vi-VN'
          utterance.rate = rate
          if (voice) utterance.voice = voice
          utterance.onend = speakNext
          // Lỗi do chính mình dừng thì bỏ qua; lỗi khác thì bỏ câu đó, đọc câu sau
          utterance.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') speakNext()
          }
          speechSynthesis.speak(utterance)
        }
        speakNext()
      }
      speakParagraph(from)
    },
    [fetchChapter, slug],
  )

  const halt = useCallback(() => {
    run.current++
    if (speechSupported()) speechSynthesis.cancel()
  }, [])

  // Rời trang đọc thì im
  useEffect(() => halt, [halt])

  return {
    ...state,
    supported,
    start: (chapter, paragraph = 0) => void play(chapter, paragraph),
    pause: () => {
      halt()
      setState((s) => ({ ...s, status: 'paused' }))
    },
    resume: () => {
      if (state.chapter !== null) void play(state.chapter, state.paragraph)
    },
    stop: () => {
      halt()
      setState(IDLE)
    },
    skip: (delta) => {
      if (state.chapter === null) return
      const last = Math.max(0, state.total - 1)
      void play(state.chapter, Math.min(last, Math.max(0, state.paragraph + delta)))
    },
    setRate: (value) => {
      update({ rate: value })
      latest.current.rate = value
      // Đang đọc thì đọc lại đoạn hiện tại với tốc độ mới
      if (state.status === 'playing' && state.chapter !== null) {
        void play(state.chapter, state.paragraph)
      }
    },
  }
}
