import { LoaderCircle } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { AuthHeading } from '@/features/auth/components/AuthHeading'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authErrorMessage, useCompleteAuthRedirect } from '@/features/auth/hooks'
import { useAuthRedirect } from '@/features/auth/useAuthRedirect'
import { paths } from '@/lib/routes'

/** Đích quay về sau khi đăng nhập Google/Facebook hoặc bấm link xác nhận email */
export default function AuthCallbackPage() {
  const { next } = useAuthRedirect()
  const { data: user, isPending, error } = useCompleteAuthRedirect()

  if (user) return <Navigate to={next} replace />

  return (
    <>
      <title>{`Đang đăng nhập | ${SITE_NAME}`}</title>
      <AuthHeading title="Đang đăng nhập" />
      {isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Đang hoàn tất, chờ một chút nhé…
        </p>
      ) : (
        <div className="space-y-6">
          <FormAlert>
            {error
              ? authErrorMessage(error)
              : 'Link đăng nhập đã hết hạn hoặc đã được dùng. Thử đăng nhập lại nhé.'}
          </FormAlert>
          <Link
            to={paths.login(next)}
            className="inline-block font-medium text-rose-gold underline-offset-4 hover:underline"
          >
            Về trang đăng nhập
          </Link>
        </div>
      )}
    </>
  )
}
