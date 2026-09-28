import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { Input } from '@/components/ui/input'
import { useMyStories } from '@/features/studio/hooks'
import { paths } from '@/lib/routes'
import type { User } from '@/types/user'
import { authErrorMessage, useDeleteAccount } from '../hooks'
import { deleteAccountSchema, type DeleteAccountValues } from '../schemas'
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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema(user)),
    mode: 'onTouched',
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(({ password }) =>
    remove.mutate(hasPassword ? password : null, {
      onSuccess: () =>
        navigate(paths.home, {
          replace: true,
          state: { accountDeleted: true } satisfies AccountDeletedState,
        }),
    }),
  )

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
      <div className="sm:w-60">
        <SubmitButton pending={remove.isPending} pendingLabel="Đang xóa…" variant="destructive">
          Xóa tài khoản vĩnh viễn
        </SubmitButton>
      </div>
    </form>
  )
}
