import type { ReactNode } from 'react'

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-heading text-4xl font-semibold">{title}</h1>
      {children && <p className="mt-2 text-muted-foreground">{children}</p>}
    </div>
  )
}

export function AuthFooterLink({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-center text-sm text-muted-foreground">{children}</p>
}
