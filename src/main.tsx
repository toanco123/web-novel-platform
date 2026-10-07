import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Providers } from '@/app/providers'
import { DeferredPwaUpdater } from '@/app/PwaUpdater'
import { removeServerSeoTags } from '@/app/defaultSeo'
import { router } from '@/app/router'
import './index.css'

removeServerSeoTags()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
      <DeferredPwaUpdater />
    </Providers>
  </StrictMode>,
)
