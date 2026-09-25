import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

type ControlProps = {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

type Props = {
  id: string
  label: string
  error?: string
  /** Nội dung đặt cạnh nhãn, vd link "Quên mật khẩu?" */
  labelAside?: ReactNode
  /** Nội dung dưới ô nhập, luôn hiện (vd thanh độ mạnh mật khẩu) */
  below?: ReactNode
  children: (control: ControlProps) => ReactNode
}

export function FormField({ id, label, error, labelAside, below, children }: Props) {
  const errorId = `${id}-error`
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? errorId : undefined })}
      {below}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export const authInputClass = 'h-11 rounded-lg px-3.5 md:text-sm'
