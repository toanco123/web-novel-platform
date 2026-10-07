import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Providers } from '@/app/providers'
import { DeferredPwaUpdater } from '@/app/PwaUpdater'
import { removeServerSeoTags } from '@/app/defaultSeo'
import { router } from '@/app/router'
import { initMonitoring, rootErrorOptions } from '@/lib/monitoring'
import './index.css'

initMonitoring()
removeServerSeoTags()

createRoot(document.getElementById('root')!, rootErrorOptions()).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
      <DeferredPwaUpdater />
    </Providers>
  </StrictMode>,
)
