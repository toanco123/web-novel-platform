import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '@/components/common/Pagination'
import { SectionError } from '@/components/common/SectionHeading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGenres } from '@/features/genres/hooks'
import { cn } from '@/lib/utils'
import type { BrowseFilters } from './api'
import {
  browseSearch,
  lengthOptions,
  parseBrowseParams,
  sortOptions,
  statusOptions,
} from './browseParams'
import { useBrowseStories } from './hooks'
import { StoryCard, StoryCardSkeleton } from './StoryCard'

const ALL = 'tat-ca'

type Props = {
  /** Bộ lọc cố định theo trang (vd /danh-sach/hoan-thanh, /the-loai/:slug); không hiện ô chọn */
  fixed: Pick<BrowseFilters, 'status' | 'genre'>
  /** Câu báo khi không có truyện nào (chưa lọc gì) */
  emptyMessage?: string
  /** Nội dung thêm khi không có truyện nào và chưa lọc gì (vd nút đăng truyện) */
  emptyAction?: ReactNode
}

/** Lưới truyện có bộ lọc + phân trang; mọi lựa chọn nằm trên URL */
export function StoryBrowser({
  fixed,
  emptyMessage = 'Chưa có truyện nào ở đây.',
  emptyAction,
}: Props) {
  const [params, setParams] = useSearchParams()
  const chosen = parseBrowseParams(params)
  const filters: BrowseFilters = { ...chosen, ...definedOnly(fixed) }
  const { data, isPending, isError, isPlaceholderData } = useBrowseStories(filters)
  const { data: genres } = useGenres()

  const hasChoice = !!(
    (!fixed.status && chosen.status) ||
    (!fixed.genre && chosen.genre) ||
    chosen.length
  )
  /** Đổi một bộ lọc thì quay về trang 1; giữ nguyên vị trí cuộn để thanh lọc không nhảy */
  const update = (patch: Partial<BrowseFilters>) =>
    setParams(browseSearch({ ...chosen, ...patch, page: 1 }), { preventScrollReset: true })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {!fixed.genre && (
          <FilterSelect
            label="Thể loại"
            value={chosen.genre}
            options={(genres ?? []).map((g) => ({ value: g.slug, label: g.name }))}
            onChange={(genre) => update({ genre })}
          />
        )}
        {!fixed.status && (
          <FilterSelect
            label="Trạng thái"
            value={chosen.status}
            options={statusOptions}
            onChange={(status) => update({ status })}
          />
        )}
        <FilterSelect
          label="Độ dài"
          value={chosen.length}
          options={lengthOptions}
          onChange={(length) => update({ length })}
        />
        <FilterSelect
          label="Sắp xếp"
          value={chosen.sort}
          options={sortOptions}
          onChange={(sort) => update({ sort: sort ?? 'updated' })}
          allowAll={false}
        />
        {hasChoice && (
          <Link
            to={{ search: browseSearch({ sort: chosen.sort }) }}
            preventScrollReset
            className="px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Xóa bộ lọc
          </Link>
        )}
        {data && (
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {data.total} truyện
          </p>
        )}
      </div>

      <div className="mt-6">
        {isError ? (
          <SectionError />
        ) : data?.total === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              {hasChoice ? 'Không có truyện nào khớp bộ lọc.' : emptyMessage}
            </p>
            {!hasChoice && emptyAction}
          </div>
        ) : (
          <ul
            aria-busy={isPending || isPlaceholderData}
            className={cn(
              'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
              isPlaceholderData && 'opacity-60 transition-opacity',
            )}
          >
            {isPending
              ? Array.from({ length: 12 }, (_, i) => (
                  <li key={i}>
                    <StoryCardSkeleton />
                  </li>
                ))
              : data.items.map((s) => (
                  <li key={s.slug}>
                    <StoryCard story={s} />
                  </li>
                ))}
          </ul>
        )}
        {data && (
          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            searchFor={(page) => browseSearch({ ...chosen, page })}
            label="Phân trang danh sách truyện"
            className="mt-10"
          />
        )}
      </div>
    </div>
  )
}

const definedOnly = <T extends object>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  allowAll = true,
}: {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (value: T | undefined) => void
  /** Có lựa chọn "Tất cả" (bỏ lọc) */
  allowAll?: boolean
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : (v as T))}>
      <SelectTrigger aria-label={label} className="rounded-full px-3.5 data-[size=default]:h-9">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-80">
        {allowAll && <SelectItem value={ALL}>Tất cả</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
