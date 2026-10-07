import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthSync } from '@/features/auth/components/AuthSync'
import { OfflineSync } from '@/features/library/components/OfflineSync'
import { createQueryClient } from './queryClient'

const queryClient = createQueryClient()

// Banner mời tải app (AppBanner) dính đáy màn hình: đẩy toast lên trên nó. 24px/16px là khoảng
// mặc định của sonner cho màn lớn/điện thoại
const aboveAppBanner = (base: string) => ({ bottom: `calc(${base} + var(--app-banner-h, 0px))` })

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
      <OfflineSync />
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster
        position="bottom-center"
        offset={aboveAppBanner('24px')}
        mobileOffset={aboveAppBanner('16px')}
      />
    </QueryClientProvider>
  )
}
