import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authInputClass, FormField } from '@/features/auth/components/FormField'
import { SubmitButton } from '@/features/auth/components/SubmitButton'
import { useSession } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import { useSendContactMessage } from '../hooks'
import { CONTACT_MESSAGE_MAX, contactSchema, contactTopics, type ContactValues } from '../schemas'

export function ContactForm() {
  const { data: user } = useSession()
  const send = useSendContactMessage()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    mode: 'onTouched',
    values: {
      name: user?.displayName ?? '',
      email: user?.email ?? '',
      topic: 'general',
      message: '',
    },
    resetOptions: { keepDirtyValues: true },
  })
  const length = useWatch({ control, name: 'message' }).length

  if (send.isSuccess) {
    return (
      <div className="space-y-4">
        <FormAlert variant="success">
          Đã gửi. Cảm ơn bạn! Chúng tôi sẽ trả lời qua email trong vài ngày làm việc.
        </FormAlert>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => {
            reset()
            send.reset()
          }}
        >
          Gửi tin nhắn khác
        </Button>
      </div>
    )
  }

  const onSubmit = handleSubmit((values) => send.mutate(values))

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {send.isError && <FormAlert>Chưa gửi được. Kiểm tra mạng rồi thử lại nhé.</FormAlert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="contact-name" label="Tên của bạn" error={errors.name?.message}>
          {(c) => (
            <Input {...c} {...register('name')} autoComplete="name" className={authInputClass} />
          )}
        </FormField>
        <FormField id="contact-email" label="Email" error={errors.email?.message}>
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
      </div>
      <FormField id="contact-topic" label="Chủ đề" error={errors.topic?.message}>
        {(c) => (
          <Controller
            control={control}
            name="topic"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  {...c}
                  onBlur={field.onBlur}
                  className="w-full rounded-lg px-3.5 data-[size=default]:h-11"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {contactTopics.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      <FormField
        id="contact-message"
        label="Nội dung"
        error={errors.message?.message}
        below={
          !errors.message && (
            <p
              className={cn(
                'text-right text-xs',
                length > CONTACT_MESSAGE_MAX ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {length}/{CONTACT_MESSAGE_MAX}
            </p>
          )
        }
      >
        {(c) => (
          <Textarea
            {...c}
            {...register('message')}
            rows={6}
            placeholder="Bạn muốn góp ý hay báo lỗi gì? Kèm đường dẫn trang nếu có."
            className="min-h-36 resize-y rounded-lg px-3.5 py-3"
          />
        )}
      </FormField>
      <div className="sm:w-48">
        <SubmitButton pending={send.isPending} pendingLabel="Đang gửi…">
          Gửi tin nhắn
        </SubmitButton>
      </div>
    </form>
  )
}
