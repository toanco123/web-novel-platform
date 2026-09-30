import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Providers } from '@/app/providers'
import { PwaUpdater } from '@/app/PwaUpdater'
import { removeDefaultSeoTags } from '@/app/defaultSeo'
import { router } from '@/app/router'
import './index.css'

removeDefaultSeoTags()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
      <PwaUpdater />
    </Providers>
  </StrictMode>,
)
