import { useEffect, useRef, useState } from 'react'
import { useFetchChapter } from '@/features/chapters/hooks'
import { blockTexts, parseContent } from '@/features/chapters/richText'
import { createDeviceEngine } from './deviceEngine'
import { createSpeechSession, IDLE_SPEECH, type SpeechSession, type SpeechState } from './session'
import { useSpeechSettings } from './useSpeechSettings'
import { pickVoice, speechSupported, useVoices } from './useVoices'

export type { SpeechState, SpeechStatus } from './session'

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

/**
 * Đọc to chương (lõi ở `session.ts`): đọc lần lượt từng đoạn, hết chương thì gọi onAdvance(chương
 * sau) để trang đọc chuyển theo, rồi đọc tiếp.
 */
export function useChapterSpeech(slug: string, onAdvance: (next: number) => void): ChapterSpeech {
  const supported = speechSupported()
  const fetchChapter = useFetchChapter()
  const { voiceURI, update } = useSpeechSettings()
  const { all: voices } = useVoices()
  const [state, setState] = useState<SpeechState>(IDLE_SPEECH)
  // Giá trị mới nhất cho phiên đọc đang chạy dở
  const latest = useRef({ voice: pickVoice(voices, voiceURI), onAdvance, fetchChapter })
  useEffect(() => {
    latest.current = { voice: pickVoice(voices, voiceURI), onAdvance, fetchChapter }
  })

  // Phiên đọc tạo ở lần dùng đầu (chỉ gọi trong handler / effect)
  const sessionRef = useRef<SpeechSession | null>(null)
  const session = () =>
    (sessionRef.current ??= createSpeechSession({
      loadChapter: async (storySlug, chapter) => {
        const data = await latest.current.fetchChapter(storySlug, chapter)
        if (!data) return null
        return {
          number: data.number,
          title: data.title,
          // Mỗi đoạn, tiêu đề, mục danh sách là một đơn vị đọc, khớp với `data-paragraph` trên trang
          paragraphs: blockTexts(parseContent(data.content)),
          next: data.next?.number ?? null,
        }
      },
      device: speechSupported()
        ? createDeviceEngine(() => ({
            rate: useSpeechSettings.getState().rate,
            voice: latest.current.voice,
          }))
        : null,
      autoNext: () => useSpeechSettings.getState().autoNext,
      onState: setState,
      onAdvance: (_slug, next) => latest.current.onAdvance(next),
    }))

  // Rời trang đọc thì im
  useEffect(() => () => sessionRef.current?.halt(), [])

  return {
    ...state,
    supported,
    start: (chapter, paragraph = 0) => session().start(slug, chapter, paragraph),
    pause: () => session().pause(),
    resume: () => session().resume(),
    stop: () => session().stop(),
    skip: (delta) => session().skip(delta),
    setRate: (value) => {
      update({ rate: value })
      session().setRate(value)
    },
  }
}
