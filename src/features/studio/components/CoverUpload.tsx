import { ImageUp, LoaderCircle } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { StoryCover } from '@/features/stories/StoryCover'
import { prepareCover } from '@/lib/image'
import { cn } from '@/lib/utils'
import { studioErrorMessage } from '../errors'

type Props = {
  value: string | null
  onChange: (value: string | null) => void
  /** Để xem trước bìa chữ tự sinh khi chưa có ảnh */
  preview: { slug: string; title: string; authorName: string }
}

export function CoverUpload({ value, onChange, preview }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setPending(true)
    try {
      onChange(await prepareCover(file))
    } catch (e) {
      setError(studioErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
        <StoryCover
          story={{
            slug: preview.slug,
            title: preview.title,
            coverUrl: value,
            author: { slug: '', name: preview.authorName },
          }}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <label
          htmlFor="cover-input"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors hover:border-primary/60 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/40',
            dragging && 'border-primary bg-primary/5',
          )}
        >
          {pending ? (
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <ImageUp className="size-6 text-muted-foreground" aria-hidden />
          )}
          <span>
            {pending ? 'Đang xử lý ảnh…' : 'Kéo ảnh vào đây hoặc '}
            {!pending && <span className="font-medium text-rose-gold underline">chọn ảnh</span>}
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG hoặc WebP, tối đa 2 MB. Ảnh được cắt giữa theo khung 2:3.
          </span>
          <input
            id="cover-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              void handleFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Bỏ ảnh, dùng bìa chữ tự sinh
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
