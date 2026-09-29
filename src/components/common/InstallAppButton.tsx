import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cn } from '@/lib/utils'

/** Nút cài web thành ứng dụng; chỉ hiện khi trình duyệt cho cài */
export function InstallAppButton({ className }: { className?: string }) {
  const { available, install } = useInstallPrompt()
  if (!available) return null
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('rounded-full', className)}
      onClick={() => void install()}
    >
      <Download />
      Cài ứng dụng
    </Button>
  )
}
