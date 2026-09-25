import { cn } from '@/lib/utils'
import { passwordStrength } from '../schemas'

const levels = {
  1: { label: 'Yếu', color: 'bg-destructive', text: 'text-destructive' },
  2: { label: 'Tạm được', color: 'bg-rose-gold', text: 'text-rose-gold' },
  3: { label: 'Mạnh', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
} as const

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordStrength(password)
  if (score === 0) {
    return <p className="text-xs text-muted-foreground">Ít nhất 8 ký tự, gồm cả chữ và số.</p>
  }
  const level = levels[score]
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn('h-1 flex-1 rounded-full', i <= score ? level.color : 'bg-muted')}
          />
        ))}
      </div>
      <p className={cn('text-xs font-medium', level.text)}>Độ mạnh: {level.label}</p>
    </div>
  )
}
