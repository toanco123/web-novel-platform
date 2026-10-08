import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { reportError } from '@/lib/monitoring'

/** Query/mutation lỗi (sau khi đã thử lại) đều qua reportError; lỗi nghiệp vụ, lỗi mạng bị lọc ở đó */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => reportError(error, { queryKey: query.queryKey }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        reportError(error, { mutationKey: mutation.options.mutationKey }),
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/** Bản dùng chung của app: Providers và route loader (router.tsx) cùng dùng (test tạo bản riêng) */
export const queryClient = createQueryClient()
