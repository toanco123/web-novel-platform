import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { AuthFooterLink, AuthHeading } from '@/features/auth/components/AuthHeading'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { paths } from '@/lib/routes'

export default function ForgotPasswordPage() {
  return (
    <>
      <title>{`Quên mật khẩu | ${SITE_NAME}`}</title>
      <AuthHeading title="Quên mật khẩu">
        Nhập email bạn dùng để đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
      </AuthHeading>
      <ForgotPasswordForm />
      <AuthFooterLink>
        Nhớ ra rồi?{' '}
        <Link
          to={paths.login()}
          className="font-medium text-rose-gold underline-offset-4 hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </AuthFooterLink>
    </>
  )
}
