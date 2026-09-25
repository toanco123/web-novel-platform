import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function SubmitButton({
  pending,
  pendingLabel,
  form,
  children,
}: {
  pending: boolean
  pendingLabel: string
  /** id của <form> khi nút nằm ngoài form (vd trong footer của dialog) */
  form?: string
  children: ReactNode
}) {
  return (
    <Button type="submit" form={form} disabled={pending} className="h-11 w-full rounded-lg text-sm">
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  )
}
