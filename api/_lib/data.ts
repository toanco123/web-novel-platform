// Đọc dữ liệu công khai từ Supabase qua REST bằng anon key (RLS vẫn áp dụng, như người xem chưa
// đăng nhập). Không dùng supabase-js để hàm nhẹ và khởi động nhanh.
import type { PageData, StoryInfo } from './page.js'
import type { SitemapEntry } from './sitemap.js'

const TIMEOUT_MS = 4000
/** Số dòng mỗi lần đọc và số lần đọc tối đa khi liệt kê truyện cho sitemap (tối đa 45.000 truyện) */
const PAGE_SIZE = 1000
const MAX_PAGES = 45

type Config = { url: string; key: string }

/** Cấu hình lấy từ biến môi trường của Vercel (cùng biến với bản build của app); thiếu thì null */
export function supabaseConfig(env: Record<string, string | undefined> = process.env) {
  const url = env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const key = env.VITE_SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

/** Ném lỗi khi chưa cấu hình, Supabase báo lỗi hoặc quá thời gian */
async function rest<T>(config: Config | null, query: string): Promise<T[]> {
  if (!config) throw new Error('Chưa cấu hình Supabase')
  const response = await fetch(`${config.url}/rest/v1/${query}`, {
    headers: { apikey: config.key, authorization: `Bearer ${config.key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Supabase trả mã ${response.status}`)
  return (await response.json()) as T[]
}

type StoryRow = {
  slug: string
  title: string
  description: string | null
  author_name: string | null
  cover_path: string | null
  genres: { name: string }[] | null
  rating_avg: number | string | null
  rating_count: number | null
}

/** Truyện công khai: đã xuất bản và có ít nhất một chương (như publicStoryCards của app) */
const PUBLIC_STORIES = 'visibility=eq.published&chapter_count=gt.0'

// slug đã qua matchRoute (chỉ chữ thường, số, gạch nối) nên ghép thẳng vào query được
export function supabaseData(config = supabaseConfig()): PageData {
  return {
    async story(slug) {
      const [row] = await rest<StoryRow>(
        config,
        `story_cards?select=slug,title,description,author_name,cover_path,genres,rating_avg,rating_count&slug=eq.${slug}&${PUBLIC_STORIES}&limit=1`,
      )
      if (!row) return null
      return {
        slug: row.slug,
        title: row.title,
        description: row.description ?? '',
        authorName: row.author_name ?? '',
        coverUrl: row.cover_path
          ? `${config!.url}/storage/v1/object/public/covers/${row.cover_path}`
          : null,
        genres: (row.genres ?? []).map((g) => g.name),
        ratingAvg: Number(row.rating_avg ?? 0),
        ratingCount: row.rating_count ?? 0,
      } satisfies StoryInfo
    },
    async chapter(slug, number) {
      const [row] = await rest<{ title: string | null }>(
        config,
        `chapters?select=title,stories!inner(slug)&stories.slug=eq.${slug}&number=eq.${number}&status=eq.published&limit=1`,
      )
      return row ? { title: row.title ?? '' } : null
    },
    async genre(slug) {
      const [row] = await rest<{ slug: string; name: string; description: string | null }>(
        config,
        `genre_cards?select=slug,name,description&slug=eq.${slug}&limit=1`,
      )
      return row ?? null
    },
  }
}

/** Trang thể loại (có truyện) và trang truyện công khai cho sitemap */
export async function sitemapEntries(config = supabaseConfig()): Promise<SitemapEntry[]> {
  const genres = await rest<{ slug: string }>(
    config,
    `genre_cards?select=slug&story_count=gt.0&order=slug&limit=${PAGE_SIZE}`,
  )
  const stories: { slug: string; updated_at: string | null }[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await rest<{ slug: string; updated_at: string | null }>(
      config,
      `story_cards?select=slug,updated_at&${PUBLIC_STORIES}&order=updated_at.desc,id&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    )
    stories.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return [
    ...genres.map((g) => ({ path: `/genres/${g.slug}` })),
    ...stories.map((s) => ({ path: `/story/${s.slug}`, lastmod: s.updated_at })),
  ]
}

// ── Giọng AI (api/tts) ──────────────────────────────────────────────────

/** Cấu hình quyền service_role (chỉ dùng ở hàm Vercel, không bao giờ lộ ra client); thiếu thì null */
export function serviceConfig(env: Record<string, string | undefined> = process.env) {
  const url = env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

/** Khóa mới (`sb_secret_…`) không phải JWT nên chỉ gửi ở header apikey */
const authHeaders = (key: string): Record<string, string> =>
  key.startsWith('sb_') ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` }

/** Lỗi của RPC: `code` là mã nghiệp vụ (message của lỗi P0001) hoặc SQLSTATE */
export class RpcError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.name = 'RpcError'
    this.code = code
  }
}

/** Gọi RPC (POST /rest/v1/rpc/<fn>) */
export async function rpc<T>(config: Config, fn: string, args: Record<string, unknown>) {
  const response = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...authHeaders(config.key), 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string
      message?: string
    } | null
    throw new RpcError(
      body?.code === 'P0001' && body.message
        ? body.message
        : (body?.code ?? `http_${response.status}`),
    )
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

/** Id người đăng nhập từ access token của Supabase Auth; token sai, hết hạn hoặc bị khóa thì null */
export async function fetchUserId(config: Config | null, token: string) {
  if (!config) throw new Error('Chưa cấu hình Supabase')
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) throw new Error(`Supabase Auth trả mã ${response.status}`)
  const user = (await response.json()) as { id?: string; banned_until?: string | null }
  if (!user.id) return null
  if (user.banned_until && new Date(user.banned_until) > new Date()) return null
  return user.id
}

/** Chương đã xuất bản của truyện công khai (anon key: RLS như khách xem); slug đã được kiểm tra */
export async function publicChapter(config: Config | null, slug: string, number: number) {
  const [row] = await rest<{ number: number; title: string | null; content: string }>(
    config,
    `chapters?select=number,title,content,stories!inner(slug)&stories.slug=eq.${slug}&number=eq.${number}&status=eq.published&limit=1`,
  )
  return row ? { number: row.number, title: row.title ?? '', content: row.content } : null
}
