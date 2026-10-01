// Phần dùng chung của các bảng quản trị: đọc ?sort=&order=&size= trên URL, cấu hình phân trang, cột
// sắp xếp được và ô lọc. Lọc, sắp xếp và phân trang đều do máy chủ làm (bảng chỉ hiện một trang).
import { Button, Select, type TablePaginationConfig, type TableProps } from 'antd'
import type { Page } from '@/types/page'
import { ADMIN_PAGE_SIZE, ADMIN_PAGE_SIZES, adminPageSize, type SortOrder } from '../shared'

type Update = (changes: Record<string, string | null>) => void

const number = new Intl.NumberFormat('vi-VN')

/**
 * Cột sắp xếp, chiều và số dòng mỗi trang đọc từ URL. Giá trị lạ coi như không có. Không kèm
 * ?order= thì giảm dần (link cũ ?sort=views vẫn đúng).
 */
export function readTableParams<S extends string>(params: URLSearchParams, sorts: readonly S[]) {
  const sort = sorts.find((s) => s === params.get('sort'))
  const order: SortOrder | undefined = sort && params.get('order') === 'asc' ? 'asc' : undefined
  return { sort, order, pageSize: adminPageSize(Number(params.get('size'))) }
}

/**
 * Thuộc tính của một cột sắp xếp được. `active`: cột và chiều đang áp dụng (kể cả mặc định của
 * bảng, để tiêu đề cột luôn cho biết bảng đang xếp theo gì).
 */
export const sortable = <S extends string>(field: S, active: { sort: S; order?: SortOrder }) => ({
  key: field,
  sorter: true,
  sortDirections: ['descend', 'ascend'] as ('descend' | 'ascend')[],
  sortOrder:
    active.sort === field
      ? active.order === 'asc'
        ? ('ascend' as const)
        : ('descend' as const)
      : null,
})

/**
 * onChange của bảng: bấm tiêu đề cột thì ghi ?sort=&order= (giảm dần không cần ghi order); bấm lần
 * thứ ba thì bỏ sắp xếp, về mặc định của bảng.
 */
export const onTableChange =
  <T,>(update: Update): TableProps<T>['onChange'] =>
  (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const { columnKey, order } = Array.isArray(sorter) ? sorter[0] : sorter
    update(
      order
        ? { sort: String(columnKey), order: order === 'ascend' ? 'asc' : null }
        : { sort: null, order: null },
    )
  }

/** Phân trang: chọn được số dòng, ghi "1–20 trong 47" */
export function tablePagination(
  data: Page<unknown> | undefined,
  page: number,
  pageSize: number,
  update: Update,
): TablePaginationConfig {
  const total = data?.total ?? 0
  return {
    current: data?.page ?? page,
    total,
    pageSize,
    // Ít hơn lựa chọn nhỏ nhất thì không có gì để chuyển trang hay đổi số dòng
    hideOnSinglePage: total <= ADMIN_PAGE_SIZES[0],
    showSizeChanger: {
      // Chỉ có vài lựa chọn: không cần danh sách ảo
      virtual: false,
      'aria-label': 'Số dòng mỗi trang',
    },
    pageSizeOptions: ADMIN_PAGE_SIZES,
    showTotal: (count, [from, to]) => `${from}–${to} trong ${number.format(count)}`,
    onChange: (nextPage, nextSize) =>
      nextSize === pageSize
        ? update({ page: String(nextPage) })
        : // Đổi số dòng thì về trang 1 (update tự bỏ ?page=)
          update({ size: nextSize === ADMIN_PAGE_SIZE ? null : String(nextSize) }),
  }
}

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
