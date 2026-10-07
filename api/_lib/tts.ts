// Giọng AI: trả địa chỉ file âm thanh của từng đoạn trong chương, tạo các đoạn còn thiếu mà người
// nghe cần tới (Google Cloud TTS → Cloudflare R2), trừ hạn mức trước khi tạo. Chữ luôn lấy từ chương
// công khai trong DB, không nhận chữ từ client. Plan: documents/plan-giong-ai.md
import { chapterTitleText } from '../../src/features/reader/speech/session.js'
import { isTtsVoice } from '../../src/lib/ttsVoices.js'
import { blockTexts, parseContent } from './richText.js'
import { clipHash, clipKey, countChars, ttsParts } from './ttsText.js'

/** Số đoạn tạo mới tối đa mỗi request (giữ thời gian chạy của hàm ngắn) */
export const MAX_GENERATE = 4
/** Số phần gọi Google cùng lúc */
const CONCURRENCY = 3

export type TtsRequest = {
  slug: string
  chapter: number
  voice: string
  /** Số đoạn client đếm được; khác số đoạn trên DB (chương đã bị sửa) thì báo content_changed */
  total?: number
  /** Chỉ số các đoạn cần tạo nếu chưa có */
  generate: number[]
  /** Tạo cả tên chương (đọc trước đoạn đầu) */
  title: boolean
}

export type TtsManifest = {
  total: number
  /** Địa chỉ các phần của tên chương; null: chưa có. Chỉ có khi request hỏi `title` */
  title: string[] | null
  /** Mỗi đoạn: địa chỉ các phần theo thứ tự ([] khi đoạn không có chữ); null: chưa có */
  paragraphs: (string[] | null)[]
}

export type TtsErrorCode =
  | 'invalid_input'
  | 'unauthenticated'
  | 'not_found'
  | 'content_changed'
  | 'tts_daily_quota'
  | 'tts_month_quota'
  | 'tts_unavailable'

type NewClip = { hash: string; chars: number; bytes: number }

export type TtsDeps = {
  /** Id người đăng nhập theo access token; không hợp lệ thì null */
  verifyUser: (token: string) => Promise<string | null>
  loadChapter: (
    slug: string,
    chapter: number,
  ) => Promise<{ number: number; title: string; content: string } | null>
  /** Các hash đã có file */
  lookup: (voice: string, hashes: string[]) => Promise<string[]>
  /** Giữ trước số ký tự; vượt mức thì ném lỗi có `code` tts_daily_quota / tts_month_quota */
  reserve: (userId: string, chars: number) => Promise<void>
  commit: (userId: string, voice: string, clips: NewClip[], refund: number) => Promise<void>
  synthesize: (text: string, voice: string) => Promise<Uint8Array<ArrayBuffer>>
  upload: (key: string, bytes: Uint8Array<ArrayBuffer>) => Promise<void>
  publicUrl: (key: string) => string
}

const STATUS: Record<TtsErrorCode, number> = {
  invalid_input: 400,
  unauthenticated: 401,
  not_found: 404,
  content_changed: 409,
  tts_daily_quota: 429,
  tts_month_quota: 429,
  tts_unavailable: 503,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export const errorResponse = (code: TtsErrorCode) => json({ code }, STATUS[code])

const isIndex = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0

/** Kiểm tra body; sai thì null */
export function parseTtsRequest(body: unknown): TtsRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const ok =
    typeof b.slug === 'string' &&
    /^[a-z0-9-]{1,200}$/.test(b.slug) &&
    isIndex(b.chapter) &&
    isTtsVoice(b.voice) &&
    (b.total === undefined || isIndex(b.total)) &&
    Array.isArray(b.generate) &&
    b.generate.length <= MAX_GENERATE &&
    b.generate.every(isIndex) &&
    (b.title === undefined || typeof b.title === 'boolean')
  if (!ok) return null
  return {
    slug: b.slug as string,
    chapter: b.chapter as number,
    voice: b.voice as string,
    total: b.total as number | undefined,
    generate: [...new Set(b.generate as number[])],
    title: (b.title as boolean | undefined) ?? false,
  }
}

const bearer = (request: Request) =>
  /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? null

/** Chạy `task` cho từng phần tử, tối đa `limit` cùng lúc; trả kết quả theo thứ tự (lỗi thì null) */
async function pool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: (R | null)[] = new Array(items.length).fill(null)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await task(items[i]).catch(() => null)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const codeOf = (error: unknown) =>
  error && typeof error === 'object' && 'code' in error ? String(error.code) : ''

export async function handleTts(request: Request, deps: TtsDeps): Promise<Response> {
  const token = bearer(request)
  if (!token) return errorResponse('unauthenticated')
  const input = parseTtsRequest(await request.json().catch(() => null))
  if (!input) return errorResponse('invalid_input')

  const [userId, chapter] = await Promise.all([
    deps.verifyUser(token),
    deps.loadChapter(input.slug, input.chapter),
  ])
  if (!userId) return errorResponse('unauthenticated')
  if (!chapter) return errorResponse('not_found')

  // Cách tách đoạn giống hệt trang đọc (data-paragraph)
  const paragraphs = blockTexts(parseContent(chapter.content))
  const total = paragraphs.length
  if (input.total !== undefined && input.total !== total) return errorResponse('content_changed')

  const { voice } = input
  const toParts = (text: string) =>
    ttsParts(text).map((part) => ({ text: part, hash: clipHash(voice, part) }))
  const paragraphParts = paragraphs.map(toParts)
  const titleParts = input.title ? toParts(chapterTitleText(chapter.number, chapter.title)) : null

  const allHashes = new Set([...paragraphParts.flat(), ...(titleParts ?? [])].map((p) => p.hash))
  const existing = new Set(allHashes.size ? await deps.lookup(voice, [...allHashes]) : [])

  // Các phần cần tạo: của tên chương và các đoạn được yêu cầu, chưa có file, không trùng nhau
  const missing = new Map<string, string>()
  // Đoạn ngoài chương (tạo sẵn chương sau khi chưa biết số đoạn) thì bỏ qua
  const generate = input.generate.filter((i) => i < total)
  for (const parts of [titleParts ?? [], ...generate.map((i) => paragraphParts[i])]) {
    for (const part of parts) if (!existing.has(part.hash)) missing.set(part.hash, part.text)
  }

  if (missing.size) {
    const jobs = [...missing].map(([hash, text]) => ({ hash, text, chars: countChars(text) }))
    const reserved = jobs.reduce((sum, job) => sum + job.chars, 0)
    try {
      await deps.reserve(userId, reserved)
    } catch (error) {
      const code = codeOf(error)
      if (code === 'tts_daily_quota' || code === 'tts_month_quota') return errorResponse(code)
      throw error
    }
    const created = await pool(jobs, CONCURRENCY, async (job) => {
      const bytes = await deps.synthesize(job.text, voice)
      await deps.upload(clipKey(voice, job.hash), bytes)
      return { hash: job.hash, chars: job.chars, bytes: bytes.byteLength }
    })
    const done = created.filter((clip): clip is NewClip => clip !== null)
    const refund = reserved - done.reduce((sum, clip) => sum + clip.chars, 0)
    await deps.commit(userId, voice, done, refund)
    for (const clip of done) existing.add(clip.hash)
    if (done.length < jobs.length) return errorResponse('tts_unavailable')
  }

  const urls = (parts: { hash: string }[]) =>
    parts.every((p) => existing.has(p.hash))
      ? parts.map((p) => deps.publicUrl(clipKey(voice, p.hash)))
      : null
  return json({
    total,
    title: titleParts ? urls(titleParts) : null,
    paragraphs: paragraphParts.map(urls),
  } satisfies TtsManifest)
}
