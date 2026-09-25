import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { paths } from '@/lib/routes'

export function JumpToChapter({ slug, max }: { slug: string; max: number }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > max) {
      setError(`Nhập số chương từ 1 đến ${max}`)
      return
    }
    navigate(paths.chapter(slug, n))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="relative">
      <div className="flex items-center gap-1.5">
        <label htmlFor="jump-chapter" className="sr-only">
          Đi tới chương
        </label>
        <Input
          id="jump-chapter"
          inputMode="numeric"
          placeholder="Số chương"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, ''))
            setError(null)
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'jump-chapter-error' : undefined}
          className="h-9 w-28 rounded-full px-3.5"
        />
        <Button type="submit" variant="secondary" className="h-9 rounded-full px-4">
          Đi tới
        </Button>
      </div>
      {error && (
        <p
          id="jump-chapter-error"
          className="absolute top-full right-0 mt-1 text-xs whitespace-nowrap text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  )
}
