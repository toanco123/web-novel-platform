import { createBrowserRouter, type RouteObject } from 'react-router'
import { PageLoader } from '@/components/common/PageLoader'
import { AuthLayout } from '@/layouts/AuthLayout'
import { MainLayout } from '@/layouts/MainLayout'
import { ReaderLayout } from '@/layouts/ReaderLayout'

const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const routes: RouteObject[] = [
  {
    Component: MainLayout,
    HydrateFallback: PageLoader,
    children: [
      { index: true, lazy: page(() => import('@/pages/HomePage')) },
      { path: 'truyen/:slug', lazy: page(() => import('@/pages/StoryDetailPage')) },
      { path: 'the-loai', lazy: page(() => import('@/pages/GenresPage')) },
      { path: 'the-loai/:slug', lazy: page(() => import('@/pages/GenreStoriesPage')) },
      {
        path: 'sang-tac',
        lazy: page(() => import('@/pages/studio/StudioShell')),
        children: [
          { index: true, lazy: page(() => import('@/pages/studio/StudioPage')) },
          { path: 'truyen-moi', lazy: page(() => import('@/pages/studio/NewStoryPage')) },
          { path: 'truyen/:storyId', lazy: page(() => import('@/pages/studio/ManageStoryPage')) },
          {
            path: 'truyen/:storyId/chuong-moi',
            lazy: page(() => import('@/pages/studio/ChapterEditorPage')),
          },
          {
            path: 'truyen/:storyId/chuong/:number',
            lazy: page(() => import('@/pages/studio/ChapterEditorPage')),
          },
          {
            path: 'truyen/:storyId/nhap-file',
            lazy: page(() => import('@/pages/studio/ImportChaptersPage')),
          },
        ],
      },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
  {
    Component: ReaderLayout,
    HydrateFallback: PageLoader,
    children: [
      // Đoạn cuối có dạng "chuong-12"; trang tự tách số chương
      { path: 'truyen/:slug/:chapter', lazy: page(() => import('@/pages/ChapterReaderPage')) },
    ],
  },
  {
    Component: AuthLayout,
    HydrateFallback: PageLoader,
    children: [
      { path: 'dang-nhap', lazy: page(() => import('@/pages/LoginPage')) },
      { path: 'dang-ky', lazy: page(() => import('@/pages/RegisterPage')) },
      { path: 'quen-mat-khau', lazy: page(() => import('@/pages/ForgotPasswordPage')) },
      { path: 'dat-lai-mat-khau', lazy: page(() => import('@/pages/ResetPasswordPage')) },
    ],
  },
]

export const router = createBrowserRouter(routes)
