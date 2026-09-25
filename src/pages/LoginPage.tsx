import { Link, useLocation } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { AuthFooterLink, AuthHeading } from '@/features/auth/components/AuthHeading'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { RedirectIfSignedIn } from '@/features/auth/components/RedirectIfSignedIn'
import { useAuthRedirect } from '@/features/auth/useAuthRedirect'
import { paths } from '@/lib/routes'

export default function LoginPage() {
  const { next } = useAuthRedirect()
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  return (
    <RedirectIfSignedIn>
      <title>{`Đăng nhập | ${SITE_NAME}`}</title>
      <AuthHeading title="Đăng nhập">
        Đọc tiếp truyện bạn đang theo dõi, trên mọi thiết bị.
      </AuthHeading>
      {notice && (
        <div className="mb-6">
          <FormAlert variant="success">{notice}</FormAlert>
        </div>
      )}
      <LoginForm />
      <AuthFooterLink>
        Chưa có tài khoản?{' '}
        <Link
          to={paths.register(next)}
          className="font-medium text-rose-gold underline-offset-4 hover:underline"
        >
          Tạo tài khoản
        </Link>
      </AuthFooterLink>
    </RedirectIfSignedIn>
  )
}
