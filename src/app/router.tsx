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
      { path: 'story/:slug', lazy: page(() => import('@/pages/StoryDetailPage')) },
      { path: 'genres', lazy: page(() => import('@/pages/GenresPage')) },
      { path: 'genres/:slug', lazy: page(() => import('@/pages/GenreStoriesPage')) },
      { path: 'list/:type', lazy: page(() => import('@/pages/BrowsePage')) },
      { path: 'ranking', lazy: page(() => import('@/pages/RankingPage')) },
      { path: 'search', lazy: page(() => import('@/pages/SearchPage')) },
      { path: 'library', lazy: page(() => import('@/pages/LibraryPage')) },
      { path: 'account', lazy: page(() => import('@/pages/AccountPage')) },
      { path: 'about', lazy: page(() => import('@/pages/info/AboutPage')) },
      { path: 'contact', lazy: page(() => import('@/pages/info/ContactPage')) },
      { path: 'terms', lazy: page(() => import('@/pages/info/TermsPage')) },
      { path: 'privacy', lazy: page(() => import('@/pages/info/PrivacyPage')) },
      {
        path: 'studio',
        lazy: page(() => import('@/pages/studio/StudioShell')),
        children: [
          { index: true, lazy: page(() => import('@/pages/studio/StudioPage')) },
          { path: 'new-story', lazy: page(() => import('@/pages/studio/NewStoryPage')) },
          { path: 'story/:storyId', lazy: page(() => import('@/pages/studio/ManageStoryPage')) },
          {
            path: 'story/:storyId/new-chapter',
            lazy: page(() => import('@/pages/studio/ChapterEditorPage')),
          },
          {
            path: 'story/:storyId/chapter/:number',
            lazy: page(() => import('@/pages/studio/ChapterEditorPage')),
          },
          {
            path: 'story/:storyId/import',
            lazy: page(() => import('@/pages/studio/ImportChaptersPage')),
          },
        ],
      },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
  {
    // Trang quản trị dùng Ant Design, nằm ở chunk riêng nên không làm nặng các trang đọc
    path: 'admin',
    lazy: page(() => import('@/pages/admin/AdminShell')),
    HydrateFallback: PageLoader,
    children: [
      { index: true, lazy: page(() => import('@/pages/admin/AdminDashboardPage')) },
      { path: 'users', lazy: page(() => import('@/pages/admin/AdminUsersPage')) },
      { path: 'stories', lazy: page(() => import('@/pages/admin/AdminStoriesPage')) },
      { path: 'inbox', lazy: page(() => import('@/pages/admin/AdminInboxPage')) },
      { path: 'reports', lazy: page(() => import('@/pages/admin/AdminReportsPage')) },
      { path: 'genres', lazy: page(() => import('@/pages/admin/AdminGenresPage')) },
    ],
  },
  {
    Component: ReaderLayout,
    HydrateFallback: PageLoader,
    children: [
      // Đoạn cuối có dạng "chapter-12"; trang tự tách số chương
      { path: 'story/:slug/:chapter', lazy: page(() => import('@/pages/ChapterReaderPage')) },
    ],
  },
  {
    Component: AuthLayout,
    HydrateFallback: PageLoader,
    children: [
      { path: 'login', lazy: page(() => import('@/pages/LoginPage')) },
      { path: 'register', lazy: page(() => import('@/pages/RegisterPage')) },
      { path: 'forgot-password', lazy: page(() => import('@/pages/ForgotPasswordPage')) },
      { path: 'reset-password', lazy: page(() => import('@/pages/ResetPasswordPage')) },
      { path: 'auth/callback', lazy: page(() => import('@/pages/AuthCallbackPage')) },
    ],
  },
]

export const router = createBrowserRouter(routes)
