import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

/**
 * Nút đổi giao diện sáng / tối. `row`: dòng có chữ trong menu điện thoại (header ở màn hẹp nhường
 * chỗ cho nút điểm danh nên không có nút icon).
 */
export function ThemeToggle({ row = false, className }: { row?: boolean; className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'
  const icon = theme === 'dark' ? <Sun /> : <Moon />
  if (row) {
    return (
      <Button variant="outline" onClick={toggleTheme} className={cn('h-10 rounded-lg', className)}>
        {icon}
        {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={className}
    >
      {icon}
    </Button>
  )
}
