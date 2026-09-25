import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { paths } from '@/lib/routes'
import { authErrorMessage, useUpdatePassword } from '../hooks'
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas'
import { FormAlert } from './FormAlert'
import { FormField } from './FormField'
import { PasswordInput } from './PasswordInput'
import { PasswordStrength } from './PasswordStrength'
import { SubmitButton } from './SubmitButton'

export const PASSWORD_UPDATED_NOTICE = 'Đã lưu mật khẩu mới. Đăng nhập lại bằng mật khẩu này.'

export function ResetPasswordForm() {
  const update = useUpdatePassword()
  const navigate = useNavigate()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(({ password }) =>
    update.mutate(password, {
      onSuccess: () =>
        navigate(paths.login(), { replace: true, state: { notice: PASSWORD_UPDATED_NOTICE } }),
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {update.isError && <FormAlert>{authErrorMessage(update.error)}</FormAlert>}
      <FormField
        id="password"
        label="Mật khẩu mới"
        error={errors.password?.message}
        below={<PasswordStrength password={password} />}
      >
        {(c) => <PasswordInput {...c} {...register('password')} autoComplete="new-password" />}
      </FormField>
      <FormField
        id="confirmPassword"
        label="Nhập lại mật khẩu mới"
        error={errors.confirmPassword?.message}
      >
        {(c) => (
          <PasswordInput {...c} {...register('confirmPassword')} autoComplete="new-password" />
        )}
      </FormField>
      <SubmitButton pending={update.isPending} pendingLabel="Đang lưu…">
        Lưu mật khẩu mới
      </SubmitButton>
    </form>
  )
}
