import type { ReactNode } from 'react'
import { Container } from '@/components/common/Container'
import { RequireAuth } from '@/components/common/RequireAuth'
import { Skeleton } from '@/components/ui/skeleton'
import { SITE_NAME } from '@/config/site'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { DeleteAccountForm } from '@/features/auth/components/DeleteAccountForm'
import { ProfileForm } from '@/features/auth/components/ProfileForm'
import { useSession } from '@/features/auth/hooks'
import { BlockedUsersList } from '@/features/blocks/components/BlockedUsersList'
import { cn } from '@/lib/utils'
import { Seo } from '@/components/common/Seo'

export default function AccountPage() {
  return (
    <RequireAuth fallback={<AccountSkeleton />}>
      <Account />
    </RequireAuth>
  )
}

/** Đang chờ phiên: tiêu đề thật, các khối hồ sơ/mật khẩu/... ở dạng khung chờ */
function AccountSkeleton() {
  return (
    <Container className="max-w-3xl py-10">
      <Seo title={`Tài khoản | ${SITE_NAME}`} noindex />
      <Intro />
      <div className="mt-8 space-y-8" aria-busy aria-label="Đang tải tài khoản">
        {[3, 3, 1, 1].map((fields, i) => (
          <div key={i} className="space-y-4 rounded-xl border bg-card/40 p-5 sm:p-6">
            <Skeleton className="mb-5 h-7 w-40" />
            {Array.from({ length: fields }, (_, j) => (
              <Skeleton key={j} className="h-10" />
            ))}
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        ))}
      </div>
    </Container>
  )
}

function Intro() {
  return (
    <>
      <h1 className="font-heading text-4xl font-semibold">Tài khoản</h1>
      <p className="mt-1 text-muted-foreground">
        Tên và ảnh hiển thị ở bình luận và truyện bạn đăng.
      </p>
    </>
  )
}

function Account() {
  const { data: user } = useSession()
  if (!user) return null

  return (
    <Container className="max-w-3xl py-10">
      <Seo title={`Tài khoản | ${SITE_NAME}`} noindex />
      <Intro />

      <div className="mt-8 space-y-8">
        <Section id="profile-title" title="Hồ sơ">
          <ProfileForm user={user} />
        </Section>
        <Section id="password-title" title="Mật khẩu">
          <ChangePasswordForm user={user} />
        </Section>
        <Section id="blocked-title" title="Người đã chặn">
          <BlockedUsersList />
        </Section>
        <Section id="delete-title" title="Xóa tài khoản" danger>
          <DeleteAccountForm user={user} />
        </Section>
      </div>
    </Container>
  )
}

function Section({
  id,
  title,
  danger = false,
  children,
}: {
  id: string
  title: string
  /** Thao tác không hoàn tác được: viền đỏ */
  danger?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-xl border bg-card/40 p-5 sm:p-6', danger && 'border-destructive/40')}
    >
      <h2 id={id} className="mb-5 font-heading text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}
