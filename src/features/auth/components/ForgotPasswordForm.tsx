import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { authErrorMessage, useSendPasswordReset } from '../hooks'
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas'
import { FormAlert } from './FormAlert'
import { authInputClass, FormField } from './FormField'
import { SubmitButton } from './SubmitButton'

export function ForgotPasswordForm() {
  const send = useSendPasswordReset()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  })

  if (send.isSuccess) {
    return (
      <FormAlert variant="success">
        Nếu email này đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu trong vài phút. Nhớ kiểm
        tra cả thư mục Spam.
      </FormAlert>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(({ email }) => send.mutate(email))}
      noValidate
      className="space-y-5"
    >
      {send.isError && <FormAlert>{authErrorMessage(send.error)}</FormAlert>}
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
      <SubmitButton pending={send.isPending} pendingLabel="Đang gửi…">
        Gửi link đặt lại
      </SubmitButton>
    </form>
  )
}
