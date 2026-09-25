import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authInputClass, FormField } from '@/features/auth/components/FormField'
import { SubmitButton } from '@/features/auth/components/SubmitButton'
import { authErrorMessage } from '@/features/auth/hooks'
import { paths } from '@/lib/routes'
import type { Genre } from '@/types/story'
import { GenreExistsError } from '../api'
import { useCreateGenre } from '../hooks'
import { genreSchema, type GenreValues } from '../schemas'

type Props = {
  trigger: ReactNode
  defaultName?: string
  onCreated?: (genre: Genre) => void
}

export function CreateGenreDialog({ trigger, defaultName = '', onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const create = useCreateGenre()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GenreValues>({
    resolver: zodResolver(genreSchema),
    mode: 'onTouched',
    defaultValues: { name: defaultName, description: '' },
  })
  const descriptionLength = useWatch({ control, name: 'description' }).length

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      reset({ name: defaultName, description: '' })
      create.reset()
    }
  }

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (genre) => {
        setOpen(false)
        onCreated?.(genre)
      },
    }),
  )

  const existing = create.error instanceof GenreExistsError ? create.error.genre : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Tạo thể loại</DialogTitle>
          <DialogDescription>
            Thể loại mới hiện ngay cho mọi người và dùng được khi đăng truyện.
          </DialogDescription>
        </DialogHeader>
        <form id="create-genre" onSubmit={onSubmit} noValidate className="space-y-5">
          {existing ? (
            <FormAlert>
              Thể loại <strong>{existing.name}</strong> đã có.{' '}
              <Link to={paths.genre(existing.slug)} className="underline underline-offset-4">
                Xem thể loại này
              </Link>
            </FormAlert>
          ) : (
            create.isError && <FormAlert>{authErrorMessage(create.error)}</FormAlert>
          )}
          <FormField id="genre-name" label="Tên thể loại" error={errors.name?.message}>
            {(c) => (
              <Input
                {...c}
                {...register('name')}
                autoComplete="off"
                placeholder="Ví dụ: Hệ thống"
                className={authInputClass}
              />
            )}
          </FormField>
          <FormField
            id="genre-description"
            label="Mô tả (không bắt buộc)"
            error={errors.description?.message}
            below={
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {descriptionLength}/200
              </p>
            }
          >
            {(c) => (
              <Textarea
                {...c}
                {...register('description')}
                rows={3}
                placeholder="Truyện thuộc thể loại này thường có gì?"
                className="rounded-lg px-3.5 py-3"
              />
            )}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="h-11 rounded-lg">
            Hủy
          </Button>
          {/* Nút gửi nằm ngoài <form> nên gắn bằng thuộc tính form */}
          <div className="sm:w-40">
            <SubmitButton pending={create.isPending} pendingLabel="Đang tạo…" form="create-genre">
              Tạo thể loại
            </SubmitButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
