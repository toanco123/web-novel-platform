import { SITE_NAME } from '@/config/site'
import { AuthHeading } from '@/features/auth/components/AuthHeading'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <>
      <title>{`Đặt lại mật khẩu | ${SITE_NAME}`}</title>
      <AuthHeading title="Đặt mật khẩu mới">Chọn mật khẩu mới cho tài khoản của bạn.</AuthHeading>
      <ResetPasswordForm />
    </>
  )
}
