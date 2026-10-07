import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { User } from '@/types/user'
import { authErrorMessage, useChangePassword } from '../hooks'
import { changePasswordSchema, type ChangePasswordValues } from '../schemas'
import { useCaptcha } from '../useCaptcha'
import { FormAlert } from './FormAlert'
import { FormField } from './FormField'
import { PasswordInput } from './PasswordInput'
import { PasswordStrength } from './PasswordStrength'
import { SubmitButton } from './SubmitButton'

const providerName = { google: 'Google', facebook: 'Facebook', apple: 'Apple' } as const

export function ChangePasswordForm({ user }: { user: User }) {
  const change = useChangePassword()
  const captcha = useCaptcha()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  })
  const password = useWatch({ control, name: 'password' })

  if (user.provider !== 'email') {
    return (
      <p className="text-sm text-muted-foreground">
        Bạn đăng nhập bằng {providerName[user.provider]}, nên tài khoản không có mật khẩu riêng.
      </p>
    )
  }

  const onSubmit = handleSubmit(async ({ currentPassword, password }) => {
    const captchaToken = await captcha.token()
    if (captchaToken === null) return
    change.mutate(
      { currentPassword, newPassword: password, captchaToken },
      { onSuccess: () => reset(), onSettled: captcha.reset },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {change.isError && <FormAlert>{authErrorMessage(change.error)}</FormAlert>}
      {change.isSuccess && <FormAlert variant="success">Đã đổi mật khẩu.</FormAlert>}
      <FormField
        id="currentPassword"
        label="Mật khẩu hiện tại"
        error={errors.currentPassword?.message}
      >
        {(c) => (
          <PasswordInput {...c} {...register('currentPassword')} autoComplete="current-password" />
        )}
      </FormField>
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
      {captcha.element}
      <div className="sm:w-48">
        <SubmitButton pending={change.isPending || isSubmitting} pendingLabel="Đang lưu…">
          Đổi mật khẩu
        </SubmitButton>
      </div>
    </form>
  )
}
