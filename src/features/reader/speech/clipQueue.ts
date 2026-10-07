// Địa chỉ file âm thanh của Giọng AI cho từng đoạn: nhớ manifest của vài chương gần nhất, tạo trước
// các đoạn sắp đọc để không phải chờ, mỗi chương chỉ một request chạy cùng lúc. Logic thuần (không
// import gì) để app di động chép nguyên. Plan: documents/plan-giong-ai.md

type Manifest = {
  total: number
  title: string[] | null
  paragraphs: (string[] | null)[]
}

type ClipRequest = {
  slug: string
  chapter: number
  voice: string
  total?: number
  generate: number[]
  title: boolean
}

export type ClipQueueOptions = {
  fetchClips: (request: ClipRequest) => Promise<Manifest>
  /** Báo lỗi theo mã (TtsError của features/tts) */
  error: (code: 'content_changed' | 'tts_unavailable') => Error
  /** Số đoạn tạo trước sau đoạn đang đọc */
  lookahead?: number
  /** Số đoạn tối đa mỗi request (MAX_GENERATE của api/tts) */
  maxGenerate?: number
  /** Số chương nhớ manifest */
  keep?: number
}

export type ClipTarget = {
  voice: string
  slug: string
  chapter: number
  index: number
  total: number
  title: boolean
}

type Entry = { manifest: Manifest | null; pending: Promise<void> | null }

export function createClipQueue({
  fetchClips,
  error,
  lookahead = 3,
  maxGenerate = 4,
  keep = 4,
}: ClipQueueOptions) {
  const entries = new Map<string, Entry>()
  const keyOf = (voice: string, slug: string, chapter: number) => `${voice}|${slug}|${chapter}`

  const entry = (key: string) => {
    let e = entries.get(key)
    if (!e) {
      e = { manifest: null, pending: null }
      entries.set(key, e)
      // Bỏ chương cũ nhất
      if (entries.size > keep) entries.delete(entries.keys().next().value!)
    }
    return e
  }

  /** Gửi một request cho chương (chờ request đang chạy của chương đó xong trước) */
  function request(e: Entry, req: ClipRequest) {
    const run = async () => {
      const manifest = await fetchClips(req)
      // Tên chương chỉ có khi request hỏi: giữ lại bản đã có
      e.manifest = { ...manifest, title: manifest.title ?? e.manifest?.title ?? null }
    }
    const pending = (e.pending ?? Promise.resolve()).catch(() => {}).then(run)
    e.pending = pending
    void pending
      .catch(() => {})
      .finally(() => {
        if (e.pending === pending) e.pending = null
      })
    return pending
  }

  /** Các đoạn chưa có trong [from, to) */
  const missingIn = (m: Manifest | null, from: number, to: number) => {
    const out: number[] = []
    for (let i = from; i < to && out.length < maxGenerate; i++) {
      if (!m || m.paragraphs[i] === null) out.push(i)
    }
    return out
  }

  return {
    /**
     * Địa chỉ các phần của đoạn (và tên chương khi `title`). Chưa có thì tạo (kèm vài đoạn sau);
     * không tạo được thì ném lỗi của request; chương đã bị sửa thì ném content_changed.
     */
    async clips(t: ClipTarget): Promise<{ title: string[]; parts: string[] }> {
      const e = entry(keyOf(t.voice, t.slug, t.chapter))
      const ready = () => {
        const m = e.manifest
        if (!m) return false
        if (m.total !== t.total) throw error('content_changed')
        return m.paragraphs[t.index] !== null && (!t.title || m.title !== null)
      }
      // Đợi request đang chạy (thường là request tạo trước) rồi xem lại
      if (!ready() && e.pending) await e.pending.catch(() => {})
      if (!ready()) {
        await request(e, {
          slug: t.slug,
          chapter: t.chapter,
          voice: t.voice,
          total: t.total,
          generate: missingIn(e.manifest, t.index, Math.min(t.total, t.index + 1 + lookahead)),
          title: t.title,
        })
        if (!ready()) throw error('tts_unavailable')
      }
      const m = e.manifest!
      // Tạo trước các đoạn sắp tới khi đang rảnh
      const ahead = missingIn(m, t.index + 1, Math.min(t.total, t.index + 1 + lookahead))
      if (ahead.length && !e.pending) {
        void request(e, { ...t, generate: ahead, title: false }).catch(() => {})
      }
      return { title: t.title ? m.title! : [], parts: m.paragraphs[t.index]! }
    },

    /** Địa chỉ phần đầu của đoạn nếu đã biết (để tải trước file) */
    peek(voice: string, slug: string, chapter: number, index: number) {
      return entries.get(keyOf(voice, slug, chapter))?.manifest?.paragraphs[index]?.[0] ?? null
    },

    /** Tạo trước tên chương và hai đoạn đầu của chương sau (sắp hết chương, có tự chuyển chương) */
    warm(voice: string, slug: string, chapter: number) {
      const e = entry(keyOf(voice, slug, chapter))
      if (e.manifest || e.pending) return
      void request(e, { slug, chapter, voice, generate: [0, 1], title: true }).catch(() => {})
    },
  }
}

export type ClipQueue = ReturnType<typeof createClipQueue>
