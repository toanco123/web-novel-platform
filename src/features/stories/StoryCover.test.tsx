import { fireEvent, render, screen } from '@testing-library/react'
import { StoryCover } from './StoryCover'

test('ảnh bìa không tải được (offline, ảnh bị xóa) thì dùng bìa chữ tự sinh', () => {
  const story = {
    slug: 'mua-ha',
    title: 'Mùa Hạ',
    coverUrl: 'https://x.supabase.co/storage/v1/object/public/covers/a.jpg',
    author: { slug: 'tac-gia', name: 'Tác giả' },
  }
  render(<StoryCover story={story} />)
  const image = screen.getByRole('img', { name: 'Bìa truyện Mùa Hạ' })
  expect(image.tagName).toBe('IMG')
  fireEvent.error(image)
  expect(screen.getByRole('img', { name: 'Bìa truyện Mùa Hạ' }).tagName).toBe('DIV')
})
