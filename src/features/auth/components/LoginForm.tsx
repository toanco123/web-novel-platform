import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Input } from '@/components/ui/input'
import { paths } from '@/lib/routes'
import { authErrorMessage, useSignIn } from '../hooks'
import { loginSchema, type LoginValues } from '../schemas'
import { useAuthRedirect } from '../useAuthRedirect'
import { AuthDivider } from './AuthDivider'
import { FormAlert } from './FormAlert'
import { authInputClass, FormField } from './FormField'
import { PasswordInput } from './PasswordInput'
import { SocialButtons } from './SocialButtons'
import { SubmitButton } from './SubmitButton'

export function LoginForm() {
  const { goNext } = useAuthRedirect()
  const signIn = useSignIn()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => signIn.mutate(values, { onSuccess: goNext }))

  return (
    <div className="space-y-6">
      <SocialButtons verb="Đăng nhập" onSuccess={goNext} disabled={signIn.isPending} />
      <AuthDivider />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {signIn.isError && <FormAlert>{authErrorMessage(signIn.error)}</FormAlert>}
        <FormField id="email" label="Email" error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
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
          labelAside={
            <Link
              to={paths.forgotPassword}
              className="text-sm text-rose-gold underline-offset-4 hover:underline"
            >
              Quên mật khẩu?
            </Link>
          }
        >
          {(control) => (
            <PasswordInput {...control} {...register('password')} autoComplete="current-password" />
          )}
        </FormField>
        <SubmitButton pending={signIn.isPending} pendingLabel="Đang đăng nhập…">
          Đăng nhập
        </SubmitButton>
      </form>
    </div>
  )
}
