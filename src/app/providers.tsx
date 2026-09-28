import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthSync } from '@/features/auth/components/AuthSync'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers({
  children,
  client = queryClient,
}: {
  children: ReactNode
  /** Test truyền client riêng để cache không dính giữa các test */
  client?: QueryClient
}) {
  return (
    <QueryClientProvider client={client}>
      <AuthSync />
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}
