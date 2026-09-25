import { safeNext } from './safeNext'

test('giữ đường dẫn nội bộ', () => {
  expect(safeNext('/truyen/abc?x=1')).toBe('/truyen/abc?x=1')
})

test.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)'])(
  'chặn %s và quay về trang chủ',
  (value) => {
    expect(safeNext(value)).toBe('/')
  },
)
