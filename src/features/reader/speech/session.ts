// Lõi nghe truyện dùng chung cho web (useChapterSpeech) và app (speechPlayer, chép nguyên file này):
// đọc lần lượt từng đoạn của chương bằng một "engine" (giọng của máy hoặc Giọng AI), hết chương thì
// tự sang chương sau, Giọng AI lỗi thì giọng của máy đọc tiếp từ đúng đoạn đó. Không phụ thuộc
// React / React Native, không import gì để app chép được nguyên văn.

export type SpeechStatus = 'idle' | 'playing' | 'paused'

export type SpeechState = {
  status: SpeechStatus
  slug: string | null
  /** Chương đang đọc */
  chapter: number | null
  /** Chỉ số đoạn đang đọc trong chương (cùng cách đánh số `data-paragraph` của trang đọc) */
  paragraph: number
  /** Tổng số đoạn của chương đang đọc (0 khi chưa tải xong) */
  total: number
}

export const IDLE_SPEECH: SpeechState = {
  status: 'idle',
  slug: null,
  chapter: null,
  paragraph: 0,
  total: 0,
}

/** Chương đã tách thành đơn vị đọc: `blockTexts(parseContent(content))` */
export type SpeechChapter = {
  number: number
  title: string
  paragraphs: string[]
  /** Số chương sau (null: hết truyện) */
  next: number | null
}

export type SpeakJob = {
  slug: string
  chapter: number
  /** Chỉ số đoạn trong chương */
  index: number
  total: number
  text: string
  /** Tên chương đọc trước đoạn này (chỉ có khi bắt đầu nghe từ đầu chương) */
  title: string | null
  next: number | null
}

export type SpeechEngine = {
  /** Đọc một đoạn; xong thì resolve. Giọng AI lỗi thì reject. Bị hủy (signal) thì không cần resolve */
  speak: (job: SpeakJob, signal: AbortSignal) => Promise<void>
  /** Im ngay */
  cancel: () => void
  /** Có thì tạm dừng giữ nguyên vị trí; không có thì tạm dừng = dừng hẳn, nghe tiếp đọc lại cả đoạn */
  pause?: () => void
  resume?: () => void
  /** Có thì đổi tốc độ ngay khi đang đọc; không có thì đọc lại đoạn hiện tại */
  setRate?: (rate: number) => void
}

export type SpeechSessionOptions = {
  loadChapter: (slug: string, chapter: number) => Promise<SpeechChapter | null>
  /** Giọng của máy (null: máy không hỗ trợ) */
  device: SpeechEngine | null
  ai?: SpeechEngine | null
  /** Người nghe đang chọn Giọng AI và dùng được (đã đăng nhập...) */
  useAi?: () => boolean
  autoNext: () => boolean
  onState: (state: SpeechState) => void
  /** Giọng đọc tự sang chương sau: trang đọc chuyển theo */
  onAdvance: (slug: string, next: number) => void
  /** Giọng AI lỗi; `continued`: giọng của máy đã đọc tiếp, false: không có giọng máy nên dừng */
  onFallback?: (error: unknown, continued: boolean) => void
  /** Chờ một nhịp sau khi hủy rồi mới đọc (Chrome hay bỏ qua câu nói ngay sau cancel()) */
  settleMs?: number
}

export type SpeechSession = ReturnType<typeof createSpeechSession>

export const chapterTitleText = (number: number, title: string) => `Chương ${number}. ${title}.`

export function createSpeechSession(options: SpeechSessionOptions) {
  const { device, ai = null, settleMs = 60 } = options
  let state = IDLE_SPEECH
  // Mã lượt phát: mỗi lần phát/dừng tăng lên, lượt cũ tự bỏ qua
  let run = 0
  let controller: AbortController | null = null
  // Engine đang đọc đoạn hiện tại
  let current: SpeechEngine | null = null
  // Đang tạm dừng giữ nguyên vị trí (engine có pause)
  let pausedInPlace = false
  // Giọng AI đã lỗi trong phiên nghe này: đọc tiếp bằng giọng của máy tới khi tắt hẳn
  let aiOff = false

  const emit = (patch: Partial<SpeechState>) => {
    state = { ...state, ...patch }
    options.onState(state)
  }

  const pickEngine = () => (ai && !aiOff && options.useAi?.() ? ai : device)

  const halt = () => {
    run++
    controller?.abort()
    controller = null
    current = null
    pausedInPlace = false
    device?.cancel()
    ai?.cancel()
  }

  async function play(slug: string, chapter: number, from: number) {
    halt()
    const id = run
    const signal = (controller = new AbortController()).signal
    // Sang chương khác thì chưa biết số đoạn (thanh điều khiển hiện "đang chuẩn bị")
    const sameChapter = state.slug === slug && state.chapter === chapter
    emit({
      status: 'playing',
      slug,
      chapter,
      paragraph: from,
      total: sameChapter ? state.total : 0,
    })
    const [data] = await Promise.all([
      options.loadChapter(slug, chapter).catch(() => null),
      new Promise((r) => setTimeout(r, settleMs)),
    ])
    if (id !== run) return
    if (!data) {
      emit(IDLE_SPEECH)
      return
    }
    const total = data.paragraphs.length
    for (let i = from; i < total; i++) {
      if (id !== run) return
      emit({ status: 'playing', slug, chapter, paragraph: i, total })
      const job: SpeakJob = {
        slug,
        chapter,
        index: i,
        total,
        text: data.paragraphs[i],
        title: i === 0 && from === 0 ? chapterTitleText(data.number, data.title) : null,
        next: data.next,
      }
      const engine = pickEngine()
      if (!engine) {
        emit(IDLE_SPEECH)
        return
      }
      current = engine
      try {
        await engine.speak(job, signal)
      } catch (error) {
        if (id !== run) return
        // Chỉ Giọng AI mới reject: chuyển sang giọng của máy, đọc lại đúng đoạn này
        aiOff = true
        options.onFallback?.(error, device !== null)
        if (!device) {
          halt()
          emit(IDLE_SPEECH)
          return
        }
        current = device
        await device.speak(job, signal)
      }
    }
    if (id !== run) return
    if (options.autoNext() && data.next !== null) {
      options.onAdvance(slug, data.next)
      void play(slug, data.next, 0)
    } else {
      halt()
      emit(IDLE_SPEECH)
    }
  }

  return {
    getState: () => state,
    start: (slug: string, chapter: number, paragraph = 0) => {
      if (state.status === 'idle') aiOff = false
      void play(slug, chapter, paragraph)
    },
    pause: () => {
      if (state.status !== 'playing') return
      if (current?.pause) {
        current.pause()
        pausedInPlace = true
      } else {
        halt()
      }
      emit({ status: 'paused' })
    },
    resume: () => {
      const { slug, chapter, paragraph } = state
      if (pausedInPlace && current?.resume) {
        pausedInPlace = false
        current.resume()
        emit({ status: 'playing' })
      } else if (slug !== null && chapter !== null) {
        void play(slug, chapter, paragraph)
      }
    },
    stop: () => {
      halt()
      aiOff = false
      emit(IDLE_SPEECH)
    },
    /** Nhảy tới đoạn trước (-1) / sau (+1) */
    skip: (delta: number) => {
      const { slug, chapter, paragraph, total } = state
      if (slug === null || chapter === null) return
      const last = Math.max(0, total - 1)
      void play(slug, chapter, Math.min(last, Math.max(0, paragraph + delta)))
    },
    /** Gọi sau khi đã lưu tốc độ mới vào cài đặt (engine đọc tốc độ từ cài đặt) */
    setRate: (rate: number) => {
      const { status, slug, chapter, paragraph } = state
      if (status !== 'playing' || slug === null || chapter === null) return
      if (current?.setRate) current.setRate(rate)
      else void play(slug, chapter, paragraph)
    },
    /** Im ngay, không đổi trạng thái (rời trang đọc) */
    halt,
  }
}
