import type { ReactNode } from 'react'
import { Container } from '@/components/common/Container'
import { RequireAuth } from '@/components/common/RequireAuth'
import { SITE_NAME } from '@/config/site'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { ProfileForm } from '@/features/auth/components/ProfileForm'
import { useSession } from '@/features/auth/hooks'

export default function AccountPage() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  )
}

function Account() {
  const { data: user } = useSession()
  if (!user) return null

  return (
    <Container className="max-w-3xl py-10">
      <title>{`Tài khoản | ${SITE_NAME}`}</title>
      <h1 className="font-heading text-4xl font-semibold">Tài khoản</h1>
      <p className="mt-1 text-muted-foreground">
        Tên và ảnh hiển thị ở bình luận và truyện bạn đăng.
      </p>

      <div className="mt-8 space-y-8">
        <Section id="profile-title" title="Hồ sơ">
          <ProfileForm user={user} />
        </Section>
        <Section id="password-title" title="Mật khẩu">
          <ChangePasswordForm user={user} />
        </Section>
      </div>
    </Container>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card/40 p-5 sm:p-6">
      <h2 id={id} className="mb-5 font-heading text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}
