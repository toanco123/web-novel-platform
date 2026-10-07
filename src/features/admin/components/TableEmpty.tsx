import { Skeleton } from 'antd'
import type { ReactNode } from 'react'

/**
 * `locale.emptyText` của bảng quản trị: lúc đang tải lần đầu (hoặc đổi bộ lọc mà dữ liệu cũ rỗng)
 * hiện khung chờ, không hiện "Chưa có…" dưới vòng quay. Tải xong mà rỗng mới hiện chữ thật.
 */
export function TableEmpty({ loading, children }: { loading: boolean; children: ReactNode }) {
  if (loading) return <Skeleton active title={false} paragraph={{ rows: 4 }} className="py-2" />
  return children
}
