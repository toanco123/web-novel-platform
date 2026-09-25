import { zodResolver } from '@hookform/resolvers/zod'
import { ImageUp, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CoverError, prepareAvatar } from '@/lib/image'
import type { User } from '@/types/user'
import { authErrorMessage, useUpdateProfile } from '../hooks'
import { profileSchema, type ProfileValues } from '../schemas'
import { FormAlert } from './FormAlert'
import { authInputClass, FormField } from './FormField'
import { SubmitButton } from './SubmitButton'
import { UserAvatar } from './UserAvatar'

export function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: { displayName: user.displayName },
  })
  const displayName = useWatch({ control, name: 'displayName' })

  async function handleFile(file: File | undefined) {
    if (!file) return
    setAvatarError(null)
    setProcessing(true)
    try {
      setAvatarUrl(await prepareAvatar(file))
    } catch (e) {
      setAvatarError(e instanceof CoverError ? e.message : 'Không xử lý được ảnh này.')
    } finally {
      setProcessing(false)
    }
  }

  const onSubmit = handleSubmit(({ displayName }) =>
    update.mutate(
      { displayName, avatarUrl },
      { onSuccess: (saved) => reset({ displayName: saved.displayName }) },
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {update.isError && <FormAlert>{authErrorMessage(update.error)}</FormAlert>}
      {update.isSuccess && <FormAlert variant="success">Đã lưu hồ sơ.</FormAlert>}

      <div className="flex flex-wrap items-center gap-5">
        <UserAvatar
          user={{ displayName: displayName || user.displayName, avatarUrl }}
          className="size-20 text-2xl"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-9 rounded-full px-4">
              <label className="cursor-pointer has-focus-visible:ring-3 has-focus-visible:ring-ring/40">
                {processing ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <ImageUp aria-hidden />
                )}
                {processing ? 'Đang xử lý…' : 'Đổi ảnh đại diện'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={processing}
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full px-4 text-muted-foreground"
                onClick={() => setAvatarUrl(null)}
              >
                Bỏ ảnh
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG hoặc WebP, tối đa 2 MB. Ảnh được cắt vuông ở giữa.
          </p>
          {avatarError && (
            <p role="alert" className="text-sm text-destructive">
              {avatarError}
            </p>
          )}
        </div>
      </div>

      <FormField id="displayName" label="Tên hiển thị" error={errors.displayName?.message}>
        {(control) => (
          <Input
            {...control}
            {...register('displayName')}
            autoComplete="nickname"
            className={authInputClass}
          />
        )}
      </FormField>

      <FormField id="email" label="Email">
        {(control) => (
          <Input
            {...control}
            value={user.email}
            readOnly
            className={`${authInputClass} text-muted-foreground`}
          />
        )}
      </FormField>

      <div className="sm:w-48">
        <SubmitButton pending={update.isPending} pendingLabel="Đang lưu…">
          Lưu hồ sơ
        </SubmitButton>
      </div>
    </form>
  )
}
