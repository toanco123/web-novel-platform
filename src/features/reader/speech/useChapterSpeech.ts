import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSession } from '@/features/auth/hooks'
import { useFetchChapter } from '@/features/chapters/hooks'
import { blockTexts, parseContent } from '@/features/chapters/richText'
import { fetchClips, TtsError, ttsFallbackMessage } from '@/features/tts/api'
import { reportError } from '@/lib/monitoring'
import { isTtsVoice } from '@/lib/ttsVoices'
import { createClipQueue } from './clipQueue'
import { createCloudEngine } from './cloudEngine'
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

/** Giọng AI dùng được: đã đăng nhập, đang chọn một giọng AI, trình duyệt phát được âm thanh */
export function useAiVoiceReady() {
  const { data: user } = useSession()
  const aiVoice = useSpeechSettings((s) => s.aiVoice)
  return !!user && isTtsVoice(aiVoice) && typeof Audio !== 'undefined'
}

/**
 * Đọc to chương (lõi ở `session.ts`) bằng Giọng AI hoặc giọng của máy: đọc lần lượt từng đoạn, hết
 * chương thì gọi onAdvance(chương sau) để trang đọc chuyển theo, rồi đọc tiếp. Giọng AI lỗi thì
 * giọng của máy đọc tiếp và báo bằng toast.
 */
export function useChapterSpeech(slug: string, onAdvance: (next: number) => void): ChapterSpeech {
  const aiReady = useAiVoiceReady()
  const supported = speechSupported() || aiReady
  const fetchChapter = useFetchChapter()
  const { voiceURI, update } = useSpeechSettings()
  const { all: voices } = useVoices()
  const [state, setState] = useState<SpeechState>(IDLE_SPEECH)
  // Giá trị mới nhất cho phiên đọc đang chạy dở
  const latest = useRef({ voice: pickVoice(voices, voiceURI), onAdvance, fetchChapter, aiReady })
  useEffect(() => {
    latest.current = { voice: pickVoice(voices, voiceURI), onAdvance, fetchChapter, aiReady }
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
      ai: createCloudEngine({
        queue: createClipQueue({ fetchClips, error: (code) => new TtsError(code) }),
        voice: () => useSpeechSettings.getState().aiVoice,
        rate: () => useSpeechSettings.getState().rate,
        autoNext: () => useSpeechSettings.getState().autoNext,
        error: (code) => new TtsError(code),
      }),
      useAi: () => latest.current.aiReady,
      autoNext: () => useSpeechSettings.getState().autoNext,
      onState: setState,
      onAdvance: (_slug, next) => latest.current.onAdvance(next),
      onFallback: (error, continued) => {
        reportError(error)
        toast(ttsFallbackMessage(error, continued))
      },
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
