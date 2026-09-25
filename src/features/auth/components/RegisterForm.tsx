import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { paths } from '@/lib/routes'
import { authErrorMessage, useSignUp } from '../hooks'
import { registerSchema, type RegisterValues } from '../schemas'
import { useAuthRedirect } from '../useAuthRedirect'
import { AuthDivider } from './AuthDivider'
import { FormAlert } from './FormAlert'
import { authInputClass, FormField } from './FormField'
import { PasswordInput } from './PasswordInput'
import { PasswordStrength } from './PasswordStrength'
import { SocialButtons } from './SocialButtons'
import { SubmitButton } from './SubmitButton'

export function RegisterForm() {
  const { goNext } = useAuthRedirect()
  const signUp = useSignUp()
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(({ displayName, email, password }) =>
    signUp.mutate(
      { displayName, email, password },
      {
        onSuccess: (result) => {
          if (result.needsEmailConfirmation) setConfirmEmail(email)
          else goNext()
        },
      },
    ),
  )

  if (confirmEmail) return <CheckEmail email={confirmEmail} />

  return (
    <div className="space-y-6">
      <SocialButtons verb="Đăng ký" onSuccess={goNext} disabled={signUp.isPending} />
      <AuthDivider />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {signUp.isError && <FormAlert>{authErrorMessage(signUp.error)}</FormAlert>}
        <FormField id="displayName" label="Tên hiển thị" error={errors.displayName?.message}>
          {(c) => (
            <Input
              {...c}
              {...register('displayName')}
              autoComplete="name"
              placeholder="Ví dụ: Linh Nguyễn"
              className={authInputClass}
            />
          )}
        </FormField>
        <FormField id="email" label="Email" error={errors.email?.message}>
          {(c) => (
            <Input
              {...c}
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="ten@gmail.com"
              className={authInputClass}
            />
          )}
        </FormField>
        <FormField
          id="password"
          label="Mật khẩu"
          error={errors.password?.message}
          below={<PasswordStrength password={password} />}
        >
          {(c) => <PasswordInput {...c} {...register('password')} autoComplete="new-password" />}
        </FormField>
        <FormField
          id="confirmPassword"
          label="Nhập lại mật khẩu"
          error={errors.confirmPassword?.message}
        >
          {(c) => (
            <PasswordInput {...c} {...register('confirmPassword')} autoComplete="new-password" />
          )}
        </FormField>

        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Controller
              control={control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  onBlur={field.onBlur}
                  aria-invalid={!!errors.acceptTerms}
                  aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <label htmlFor="acceptTerms" className="text-sm leading-snug text-muted-foreground">
              Tôi đồng ý với{' '}
              <Link to={paths.terms} className="text-rose-gold underline-offset-4 hover:underline">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link
                to={paths.privacy}
                className="text-rose-gold underline-offset-4 hover:underline"
              >
                Chính sách bảo mật
              </Link>
            </label>
          </div>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" className="text-sm text-destructive">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <SubmitButton pending={signUp.isPending} pendingLabel="Đang tạo tài khoản…">
          Tạo tài khoản
        </SubmitButton>
      </form>
    </div>
  )
}

function CheckEmail({ email }: { email: string }) {
  return (
    <div className="space-y-4 rounded-xl border bg-card/60 p-6 text-center">
      <MailCheck className="mx-auto size-10 text-rose-gold" aria-hidden />
      <h2 className="font-heading text-2xl font-semibold">Kiểm tra email của bạn</h2>
      <p className="text-sm text-muted-foreground">
        Chúng tôi đã gửi link xác nhận tới <strong className="text-foreground">{email}</strong>. Mở
        email và bấm vào link để kích hoạt tài khoản.
      </p>
    </div>
  )
}
