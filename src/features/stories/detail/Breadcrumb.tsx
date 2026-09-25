import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'

type Crumb = { label: string; to?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[#f4e7ed]/70">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
            <li className="min-w-0">
              {item.to ? (
                <Link to={item.to} className="hover:text-[#f4e7ed] hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="line-clamp-1 text-[#f4e7ed]">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
