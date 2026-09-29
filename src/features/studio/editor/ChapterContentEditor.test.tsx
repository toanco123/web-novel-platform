import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { writeInEditor } from '@/test/helpers'
import { ChapterContentEditor } from './ChapterContentEditor'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <TooltipProvider>
      <span id="c-label">Nội dung</span>
      <ChapterContentEditor
        id="c"
        labelId="c-label"
        value={value}
        onChange={setValue}
        onBlur={() => {}}
      />
      <output data-testid="value">{value}</output>
      {/* Như form bị đặt lại khi khôi phục bản nháp */}
      <button type="button" onClick={() => setValue('<p>Bản nháp <em>khôi phục</em></p>')}>
        Khôi phục
      </button>
    </TooltipProvider>
  )
}

const value = () => screen.getByTestId('value').textContent

function setup(initial?: string) {
  const user = userEvent.setup()
  render(<Harness initial={initial} />)
  return { user, box: screen.getByRole('textbox', { name: 'Nội dung' }) }
}

test('dán văn bản thành các đoạn; chọn tất cả rồi bấm Đậm, Căn giữa', async () => {
  const { user, box } = setup()
  await writeInEditor(user, box, 'Đoạn một\n\nĐoạn hai')
  expect(value()).toBe('<p>Đoạn một</p><p>Đoạn hai</p>')

  await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
  const bold = screen.getByRole('button', { name: 'Đậm' })
  expect(bold).toHaveAttribute('aria-pressed', 'false')
  await user.click(bold)
  expect(bold).toHaveAttribute('aria-pressed', 'true')
  expect(value()).toBe('<p><strong>Đoạn một</strong></p><p><strong>Đoạn hai</strong></p>')

  await user.click(screen.getByRole('button', { name: 'Căn giữa' }))
  expect(value()).toContain('<p style="text-align: center;"><strong>Đoạn một</strong></p>')

  await user.click(screen.getByRole('button', { name: 'Xóa định dạng' }))
  expect(value()).toBe('<p>Đoạn một</p><p>Đoạn hai</p>')

  await user.click(screen.getByRole('button', { name: 'Hoàn tác' }))
  expect(value()).toContain('<strong>Đoạn một</strong>')
})

test('đổi kiểu đoạn thành tiêu đề và tạo danh sách số kiểu La Mã', async () => {
  const { user, box } = setup('<p>Tựa</p><p>Mục</p>')
  await user.click(box)

  // Con trỏ ở đầu nội dung: đoạn "Tựa"
  await user.click(screen.getByRole('button', { name: 'Kiểu đoạn: Đoạn văn' }))
  await user.click(await screen.findByRole('menuitemradio', { name: 'Tiêu đề lớn' }))
  expect(value()).toBe('<h2>Tựa</h2><p>Mục</p>')
  expect(screen.getByRole('button', { name: 'Kiểu đoạn: Tiêu đề lớn' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
  await user.click(screen.getByRole('button', { name: 'Kiểu danh sách số' }))
  await user.click(await screen.findByRole('menuitemradio', { name: /Số La Mã thường/ }))
  expect(value()).toBe('<ol data-style="lower-roman"><li><p>Tựa</p></li><li><p>Mục</p></li></ol>')
  expect(screen.getByRole('button', { name: 'Danh sách số' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('mở chương văn bản thuần cũ và nhận giá trị đặt lại từ ngoài (khôi phục nháp)', async () => {
  const { user, box } = setup('Dòng một\ndòng hai\n\nĐoạn <hai>')
  expect(box.innerHTML).toContain('Dòng một<br')
  expect(box).toHaveTextContent('Đoạn <hai>')

  await user.click(screen.getByRole('button', { name: 'Khôi phục' }))
  expect(box.querySelector('em')).toHaveTextContent('khôi phục')
})
