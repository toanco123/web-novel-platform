import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { authErrorMessage, useSession } from '@/features/auth/hooks'
import type { Comment, CommentSort, Score } from '@/types/comment'
import * as api from './api'

export const commentKeys = {
  story: (slug: string) => ['comments', slug] as const,
  /** Mọi thứ tự của danh sách bình luận gốc. chapter = null: bình luận của cả truyện */
  lists: (slug: string, chapter: number | null = null) =>
    ['comments', slug, chapter ?? 'story'] as const,
  list: (slug: string, chapter: number | null = null, sort: CommentSort = 'newest') =>
    [...commentKeys.lists(slug, chapter), sort] as const,
  replies: (slug: string, commentId: string) => ['comments', slug, 'replies', commentId] as const,
  rating: (slug: string) => ['rating', slug] as const,
  myRating: (slug: string, userId: string) => ['rating', slug, 'me', userId] as const,
}

export const useComments = (
  slug: string,
  chapter: number | null = null,
  sort: CommentSort = 'newest',
) =>
  useInfiniteQuery({
    queryKey: commentKeys.list(slug, chapter, sort),
    queryFn: ({ pageParam }) => api.getComments(slug, { chapter, cursor: pageParam, sort }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
    // Đổi thứ tự: giữ danh sách cũ tới khi thứ tự mới về (không nháy khung chờ). Chỉ giữ khi cùng
    // truyện, cùng chương: sang truyện khác thì không hiện bình luận của truyện cũ
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.slice(0, 3).join('|') === commentKeys.lists(slug, chapter).join('|')
        ? previous
        : undefined,
  })

/** Trả lời của một bình luận; chỉ tải khi người đọc mở nhóm trả lời */
export const useReplies = (slug: string, commentId: string, enabled: boolean) =>
  useQuery({
    queryKey: commentKeys.replies(slug, commentId),
    queryFn: () => api.getReplies(commentId),
    enabled,
  })

/** parentId có giá trị: gửi trả lời cho bình luận gốc đó */
export function useAddComment(
  slug: string,
  chapter: number | null = null,
  parentId: string | null = null,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.addComment(slug, content, chapter, parentId),
    // Trả lời: làm mới cả danh sách gốc (số trả lời) và nhóm trả lời của bình luận đó
    onSuccess: () =>
      Promise.all(
        [
          commentKeys.lists(slug, chapter),
          ...(parentId ? [commentKeys.replies(slug, parentId)] : []),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}

export function useReportComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.reportComment,
    // Quản trị viên đang mở trang kiểm duyệt (tab khác) sẽ thấy báo cáo mới khi quay lại
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.story(slug) }),
  })
}

/** Dữ liệu trong cache bình luận của một truyện: trang danh sách gốc, hoặc nhóm trả lời */
type CachedComments = InfiniteData<api.CommentPage> | Comment[] | undefined

/** Đổi một bình luận (theo id) ở mọi danh sách và nhóm trả lời của truyện đang có trong cache */
function patchComment(
  queryClient: QueryClient,
  slug: string,
  id: string,
  patch: (comment: Comment) => Comment,
) {
  const update = (c: Comment) => (c.id === id ? patch(c) : c)
  queryClient.setQueriesData<CachedComments>({ queryKey: commentKeys.story(slug) }, (data) => {
    if (!data) return data
    if (Array.isArray(data)) return data.map(update)
    return { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(update) })) }
  })
}

/**
 * Thích / bỏ thích: đổi tim và số ngay trên cache (không tải lại danh sách, để thứ tự Nổi bật không
 * xáo); lỗi thì trả lại như cũ và báo bằng toast
 */
export function useCommentLike(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ comment, liked }: { comment: Comment; liked: boolean }) =>
      api.setCommentLike(comment.id, liked),
    onMutate: async ({ comment, liked }) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.story(slug) })
      const snapshot = queryClient.getQueriesData<CachedComments>({
        queryKey: commentKeys.story(slug),
      })
      patchComment(queryClient, slug, comment.id, (c) =>
        c.likedByMe === liked
          ? c
          : { ...c, likedByMe: liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) },
      )
      return { snapshot }
    },
    onError: (error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
      toast.error(authErrorMessage(error))
    },
  })
}

/** Sửa bình luận: ghi nội dung mới vào cache, giữ số trả lời và lượt thích đang hiện */
export function useEditComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.editComment(id, content),
    onSuccess: (edited) =>
      patchComment(queryClient, slug, edited.id, (c) => ({
        ...c,
        content: edited.content,
        editedAt: edited.editedAt,
      })),
  })
}

export const useRatingSummary = (slug: string) =>
  useQuery({ queryKey: commentKeys.rating(slug), queryFn: () => api.getRatingSummary(slug) })

export function useMyRating(slug: string) {
  const { data: user } = useSession()
  return useQuery({
    queryKey: commentKeys.myRating(slug, user?.id ?? 'guest'),
    queryFn: () => api.getMyRating(slug),
    enabled: !!user,
  })
}

export function useRateStory(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (score: Score) => api.rateStory(slug, score),
    // Điểm của truyện người dùng đăng tính từ lượt chấm thật, nên làm mới cả thông tin truyện
    onSuccess: () =>
      Promise.all(
        [commentKeys.rating(slug), ['stories']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
