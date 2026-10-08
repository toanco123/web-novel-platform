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

test('thẻ dùng bìa nhỏ, lỗi thì thử ảnh gốc; ảnh lớn đầu trang (priority) dùng ảnh gốc', () => {
  const story = {
    slug: 'mua-ha',
    title: 'Mùa Hạ',
    coverUrl: 'https://cdn.test/covers/a.webp',
    coverThumbUrl: 'https://cdn.test/covers/a-thumb.webp',
    author: { slug: 'tac-gia', name: 'Tác giả' },
  }
  const { unmount } = render(<StoryCover story={story} />)
  const image = () => screen.getByRole('img', { name: 'Bìa truyện Mùa Hạ' })
  expect(image()).toHaveAttribute('src', story.coverThumbUrl)
  fireEvent.error(image())
  expect(image()).toHaveAttribute('src', story.coverUrl)
  fireEvent.error(image())
  expect(image().tagName).toBe('DIV')
  unmount()

  render(<StoryCover story={story} priority />)
  expect(image()).toHaveAttribute('src', story.coverUrl)
})
