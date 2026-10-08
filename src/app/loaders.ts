// Route loader của các trang công khai (plan documents/plan-toi-uu-tai-trang-dot-3.md mục 1): tải
// trước dữ liệu song song với chunk JS của trang, KHÔNG chờ. Trang vẫn đọc bằng hook cũ (cùng
// queryOptions) và vẫn có skeleton; tải trước hỏng thì hook tự tải lại và báo lỗi trong khối đó.
// Chỉ dữ liệu công khai (giống nhau với mọi người xem); trang cần đăng nhập không có loader.
import type { FetchQueryOptions, QueryClient } from '@tanstack/react-query'
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router'
import { parseChapterListParams, parseChapterSegment } from '@/features/chapters/api'
import { chapterListQuery } from '@/features/chapters/queries'
import { genresQuery } from '@/features/genres/hooks'
import { parseRankingParams } from '@/features/stories/api'
import { browseFilters, LIST_FILTERS } from '@/features/stories/browseParams'
import { storyQueries } from '@/features/stories/hooks'
import { queryClientContext } from './routerContext'

type Args = Pick<LoaderFunctionArgs, 'params' | 'request' | 'context'>

/** Bắt đầu tải các query (không chờ); prefetchQuery không ném lỗi và bỏ qua dữ liệu còn mới */
function prefetch(
  client: QueryClient | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mỗi query một kiểu dữ liệu
  ...queries: FetchQueryOptions<any, any, any, any>[]
) {
  if (client) for (const query of queries) void client.prefetchQuery(query)
  return null
}

/** Router tạo thiếu getContext thì bỏ qua tải trước (loader không bao giờ làm hỏng trang) */
function clientOf(context: Args['context']) {
  try {
    return context.get(queryClientContext)
  } catch {
    return null
  }
}
const searchOf = (request: Request) => new URL(request.url).searchParams

export const homeLoader = ({ context }: Args) =>
  prefetch(
    clientOf(context),
    storyQueries.featured(),
    storyQueries.editorPicks(),
    storyQueries.trendingWeekly(),
    storyQueries.latestUpdated(),
    storyQueries.newReleases(),
    storyQueries.ranking('votes', 'week'),
    genresQuery(),
  )

export const storyLoader = ({ params, request, context }: Args) => {
  const slug = params.slug ?? ''
  const { page, order } = parseChapterListParams(searchOf(request))
  return prefetch(
    clientOf(context),
    storyQueries.detail(slug),
    chapterListQuery(slug, page, order),
    storyQueries.related(slug),
  )
}

/**
 * chapterQuery đọc qua kho offline (IndexedDB): import động để kho này vẫn chỉ nằm trong chunk của
 * trang đọc, không vào bundle chính. Không chờ: chunk này trang đọc cũng cần nên tải song song.
 */
export const chapterLoader = ({ params, context }: Args) => {
  const number = parseChapterSegment(params.chapter ?? '')
  const client = clientOf(context)
  if (number === null || !client) return null
  void import('@/features/chapters/hooks').then(({ chapterQuery }) =>
    prefetch(client, chapterQuery(client, params.slug ?? '', number)),
  )
  return null
}

export const listLoader = ({ params, request, context }: Args) => {
  const fixed = LIST_FILTERS[params.type ?? '']
  if (!fixed) return null
  return prefetch(
    clientOf(context),
    storyQueries.browse(browseFilters(searchOf(request), fixed)),
    genresQuery(),
  )
}

export const genreLoader = ({ params, request, context }: Args) =>
  prefetch(
    clientOf(context),
    storyQueries.browse(browseFilters(searchOf(request), { genre: params.slug ?? '' })),
    genresQuery(),
  )

export const rankingLoader = ({ request, context }: Args) => {
  const { by, period } = parseRankingParams(searchOf(request))
  return prefetch(clientOf(context), storyQueries.ranking(by, period))
}

export const searchLoader = ({ request, context }: Args) => {
  const params = searchOf(request)
  const q = (params.get('q') ?? '').trim()
  if (!q) return null
  const page = Math.max(1, Number(params.get('page')) || 1)
  return prefetch(clientOf(context), storyQueries.search(q, page))
}

/**
 * Chỉ chạy lại loader khi đổi đường dẫn hoặc tham số tìm kiếm; thao tác khác trong trang (gửi bình
 * luận, theo dõi…) đã có cache của TanStack Query lo
 */
export const onUrlChange = ({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) =>
  currentUrl.pathname !== nextUrl.pathname || currentUrl.search !== nextUrl.search
