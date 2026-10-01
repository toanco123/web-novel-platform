// Ô lọc và nút "Xóa bộ lọc" của các bảng quản trị (giá trị lọc nằm trên URL)
import { Button, Select } from 'antd'
import { slugify } from '@/lib/slugify'
import type { Update } from './tableParams'

type FilterSelectProps<T extends string> = {
  /** Tên bộ lọc: hiện làm chữ gợi ý khi chưa chọn */
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (value: T | null) => void
  className?: string
}

/** Ô chọn một giá trị lọc, bấm × để bỏ lọc */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className = 'w-44',
}: FilterSelectProps<T>) {
  return (
    <Select<T>
      // id riêng: không để antd tự sinh (môi trường test sinh cùng một id cho mọi phần tử, làm nhãn
      // của hộp thoại trỏ nhầm sang ô này)
      id={`filter-${slugify(label)}`}
      className={className}
      aria-label={label}
      placeholder={label}
      allowClear
      // Danh sách ngắn: không cần danh sách ảo
      virtual={false}
      value={value ?? null}
      options={options}
      onChange={(next) => onChange(next ?? null)}
    />
  )
}

/** Nút "Xóa bộ lọc": chỉ hiện khi có tham số lọc/tìm nào trong `keys` đang đặt trên URL */
export function ClearFilters({
  params,
  keys,
  update,
}: {
  params: URLSearchParams
  keys: string[]
  update: Update
}) {
  if (!keys.some((key) => params.has(key))) return null
  return (
    <Button type="link" onClick={() => update(Object.fromEntries(keys.map((key) => [key, null])))}>
      Xóa bộ lọc
    </Button>
  )
}
