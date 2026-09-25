import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link
      to={paths.home}
      className={cn(
        'font-script text-[1.75rem] leading-none whitespace-nowrap text-rose-gold transition-[text-shadow] hover:[text-shadow:0_0_18px_color-mix(in_srgb,var(--neon)_55%,transparent)] sm:text-[2rem]',
        className,
      )}
    >
      {SITE_NAME}
    </Link>
  )
}
