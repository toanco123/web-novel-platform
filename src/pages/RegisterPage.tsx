import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { AuthFooterLink, AuthHeading } from '@/features/auth/components/AuthHeading'
import { RedirectIfSignedIn } from '@/features/auth/components/RedirectIfSignedIn'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { useAuthRedirect } from '@/features/auth/useAuthRedirect'
import { paths } from '@/lib/routes'

export default function RegisterPage() {
  const { next } = useAuthRedirect()

  return (
    <RedirectIfSignedIn>
      <title>{`Tạo tài khoản | ${SITE_NAME}`}</title>
      <AuthHeading title="Tạo tài khoản">
        Lưu truyện vào tủ, nhớ chương đang đọc và bình luận cùng mọi người.
      </AuthHeading>
      <RegisterForm />
      <AuthFooterLink>
        Đã có tài khoản?{' '}
        <Link
          to={paths.login(next)}
          className="font-medium text-rose-gold underline-offset-4 hover:underline"
        >
          Đăng nhập
        </Link>
      </AuthFooterLink>
    </RedirectIfSignedIn>
  )
}
