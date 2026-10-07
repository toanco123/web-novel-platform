import { Card, Col, Row, Skeleton } from 'antd'

/** Khối chờ choán hết chiều ngang (vùng biểu đồ, biểu đồ mini) */
function Block({ height }: { height: number }) {
  return <Skeleton.Node active className="w-full!" style={{ width: '100%', height }} />
}

/**
 * Trang Tổng quan đang tải lần đầu: dựng theo bố cục thật (khối "Cần xử lý", hàng ô số liệu, hai
 * thẻ biểu đồ) để số liệu hiện ra không làm trang nhảy.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Đang tải số liệu">
      <Card title={<Skeleton.Input active size="small" />}>
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <Skeleton
                active
                title={{ width: '60%' }}
                paragraph={{ rows: 2, width: ['40%', '80%'] }}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card className="h-full">
            <Skeleton
              active
              title={{ width: '40%' }}
              paragraph={{ rows: 2, width: ['30%', '70%'] }}
            />
            <div className="pt-3">
              <Block height={80} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Row gutter={[16, 16]} className="h-full">
            {Array.from({ length: 4 }, (_, i) => (
              <Col key={i} xs={12}>
                <Card size="small" className="h-full">
                  <Skeleton active title={{ width: '50%' }} paragraph={{ rows: 1, width: '80%' }} />
                  <div className="pt-3">
                    <Block height={40} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title={<Skeleton.Input active size="small" />} className="h-full">
            <Block height={260} />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title={<Skeleton.Input active size="small" />} className="h-full">
            <Block height={260} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
