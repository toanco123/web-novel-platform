import { splitForSpeech } from './splitForSpeech'

test('tách theo dấu kết câu, giữ dấu và ngoặc kép đi kèm', () => {
  expect(splitForSpeech('Trời mưa. Nàng đứng dưới hiên! “Chàng về rồi sao?” Hắn gật đầu…')).toEqual(
    ['Trời mưa.', 'Nàng đứng dưới hiên!', '“Chàng về rồi sao?”', 'Hắn gật đầu…'],
  )
})

test('câu không có dấu kết câu vẫn được giữ', () => {
  expect(splitForSpeech('— Ngày mai gặp lại')).toEqual(['— Ngày mai gặp lại'])
  expect(splitForSpeech('   ')).toEqual([])
})

test('câu dài được cắt ở dấu phẩy, không phần nào vượt giới hạn', () => {
  const long = Array.from({ length: 12 }, (_, i) => `vế câu thứ ${i + 1} khá dài một chút`).join(
    ', ',
  )
  const chunks = splitForSpeech(`${long}.`, 80)
  expect(chunks.length).toBeGreaterThan(1)
  expect(chunks.every((c) => c.length <= 80)).toBe(true)
  expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(`${long}.`)
})

test('vế câu không có dấu phẩy thì cắt theo từ', () => {
  const words = Array.from({ length: 60 }, () => 'chữ').join(' ')
  const chunks = splitForSpeech(words, 50)
  expect(chunks.every((c) => c.length <= 50)).toBe(true)
  expect(chunks.join(' ')).toBe(words)
})
