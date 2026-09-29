import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { useMyStories } from '@/features/studio/hooks'
import { paths } from '@/lib/routes'
import type { User } from '@/types/user'
import { authErrorMessage, useDeleteAccount } from '../hooks'
import { deleteAccountSchema, type DeleteAccountValues } from '../schemas'
import { useCaptcha } from '../useCaptcha'
import { FormAlert } from './FormAlert'
import { authInputClass, FormField } from './FormField'
import { PasswordInput } from './PasswordInput'
import { SubmitButton } from './SubmitButton'

/** Trạng thái điều hướng về trang chủ sau khi xóa (trang chủ hiện lời báo) */
export type AccountDeletedState = { accountDeleted: true }

export function DeleteAccountForm({ user }: { user: User }) {
  const remove = useDeleteAccount()
  const navigate = useNavigate()
  const { data: stories = [] } = useMyStories()
  const hasPassword = user.provider === 'email'
  // Chỉ tài khoản email phải kiểm tra lại mật khẩu (đăng nhập lại) nên mới cần captcha
  const captcha = useCaptcha()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema(user)),
    mode: 'onTouched',
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async ({ password }) => {
    const captchaToken = hasPassword ? await captcha.token() : undefined
    if (captchaToken === null) return
    remove.mutate(
      { password: hasPassword ? password : null, captchaToken },
      {
        onSuccess: () =>
          navigate(paths.home, {
            replace: true,
            state: { accountDeleted: true } satisfies AccountDeletedState,
          }),
        onSettled: captcha.reset,
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Tài khoản bị xóa vĩnh viễn và{' '}
          <strong className="text-foreground">không khôi phục được</strong>. Cùng bị xóa: hồ sơ,
          bình luận, điểm chấm, tủ truyện, lịch sử đọc và mọi truyện, chương bạn đã đăng.
        </p>
        {stories.length > 0 && (
          <p className="text-destructive">
            Bạn đang có {stories.length} truyện trong khu Sáng tác. Người đọc sẽ không còn đọc được
            các truyện này.
          </p>
        )}
      </div>
      {remove.isError && <FormAlert>{authErrorMessage(remove.error)}</FormAlert>}
      {hasPassword ? (
        <FormField
          id="deletePassword"
          label="Nhập mật khẩu để xác nhận"
          error={errors.password?.message}
        >
          {(c) => (
            <PasswordInput {...c} {...register('password')} autoComplete="current-password" />
          )}
        </FormField>
      ) : (
        <FormField
          id="deleteConfirm"
          label={`Gõ email ${user.email} để xác nhận`}
          error={errors.confirm?.message}
        >
          {(c) => (
            <Input
              {...c}
              {...register('confirm')}
              type="email"
              autoComplete="off"
              className={authInputClass}
            />
          )}
        </FormField>
      )}
      {hasPassword && captcha.element}
      <div className="sm:w-60">
        <SubmitButton
          pending={remove.isPending || isSubmitting}
          pendingLabel="Đang xóa…"
          variant="destructive"
        >
          Xóa tài khoản vĩnh viễn
        </SubmitButton>
      </div>
    </form>
  )
}
