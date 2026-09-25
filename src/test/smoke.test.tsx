import { screen } from '@testing-library/react'
import { renderApp } from './renderApp'

test('trang chủ hiển thị các khối chính', async () => {
  renderApp('/')
  expect(await screen.findByRole('heading', { name: 'Truyện đề cử' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mới cập nhật' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Top tuần' })).toBeInTheDocument()
  // Dữ liệu mock được tải qua api.ts
  expect(await screen.findByRole('tab', { name: 'Trường An Không Tuyết' })).toBeInTheDocument()
})

test('đường dẫn không tồn tại hiển thị trang 404', async () => {
  renderApp('/khong-co-trang-nay')
  expect(await screen.findByText('Trang bạn tìm không tồn tại.')).toBeInTheDocument()
})
