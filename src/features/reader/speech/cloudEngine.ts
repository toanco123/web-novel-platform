import type { TtsErrorCode } from '@/features/tts/shared'
import type { ClipQueue } from './clipQueue'
import type { SpeechEngine } from './session'
import { SILENT_AUDIO } from './silentAudio'

type CloudEngineOptions = {
  queue: ClipQueue
  /** Giọng AI đang chọn (id trong TTS_VOICES) */
  voice: () => string | null
  rate: () => number
  autoNext: () => boolean
  error: (code: TtsErrorCode) => Error
}

/** Còn bấy nhiêu đoạn nữa là hết chương thì tạo trước chương sau */
const WARM_NEXT_BEFORE_END = 3

/**
 * Giọng AI trên web: phát lần lượt các file MP3 của đoạn bằng một phần tử <audio> dùng chung (iOS
 * Safari chỉ cho phát tiếp trên phần tử đã được mở khóa bằng một lần bấm, xem prime). Tạm dừng giữ
 * nguyên vị trí, đổi tốc độ áp dụng ngay (playbackRate, giữ cao độ giọng).
 */
export function createCloudEngine(options: CloudEngineOptions): SpeechEngine {
  let audio: HTMLAudioElement | null = null
  // Phần tử thứ hai chỉ để tải trước file kế tiếp
  let preloader: HTMLAudioElement | null = null
  let preloaded: string | null = null
  const element = () => (audio ??= new Audio())

  const applyRate = (a: HTMLAudioElement) => {
    a.defaultPlaybackRate = options.rate()
    a.playbackRate = options.rate()
  }

  const preload = (url: string | null) => {
    if (!url || url === preloaded) return
    preloaded = url
    preloader ??= new Audio()
    preloader.preload = 'auto'
    preloader.src = url
  }

  function playUrl(url: string, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const a = element()
      const cleanup = () => {
        a.onended = null
        a.onerror = null
        signal.removeEventListener('abort', onAbort)
      }
      const onAbort = () => {
        cleanup()
        resolve()
      }
      const fail = () => {
        cleanup()
        reject(options.error('network'))
      }
      a.onended = () => {
        cleanup()
        resolve()
      }
      a.onerror = fail
      signal.addEventListener('abort', onAbort)
      a.src = url
      applyRate(a)
      a.play().catch(() => {
        if (!signal.aborted) fail()
      })
    })
  }

  return {
    async speak(job, signal) {
      const voice = options.voice()
      if (!voice) throw options.error('unknown')
      const { title, parts } = await options.queue.clips({
        voice,
        slug: job.slug,
        chapter: job.chapter,
        index: job.index,
        total: job.total,
        title: job.title !== null,
      })
      if (signal.aborted) return
      if (
        job.next !== null &&
        job.index >= job.total - WARM_NEXT_BEFORE_END &&
        options.autoNext()
      ) {
        options.queue.warm(voice, job.slug, job.next)
      }
      const urls = [...title, ...parts]
      for (let k = 0; k < urls.length; k++) {
        if (signal.aborted) return
        preload(urls[k + 1] ?? options.queue.peek(voice, job.slug, job.chapter, job.index + 1))
        await playUrl(urls[k], signal)
      }
    },
    cancel: () => audio?.pause(),
    prime: () => {
      const a = element()
      a.src = SILENT_AUDIO
      a.play().catch(() => {})
    },
    pause: () => audio?.pause(),
    resume: () => {
      audio?.play().catch(() => {})
    },
    setRate: () => {
      if (audio) applyRate(audio)
    },
  }
}
