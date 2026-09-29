import { goOffline } from '@/test/offline'
import { isNetworkError } from './network'

test('lỗi fetch của trình duyệt và lỗi supabase-js trả về khi mất mạng là lỗi mạng', () => {
  expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  expect(isNetworkError(new TypeError('Load failed'))).toBe(true)
  expect(
    isNetworkError({
      message: 'TypeError: NetworkError when attempting to fetch resource.',
      code: '',
    }),
  ).toBe(true)
})

test('lỗi máy chủ và lỗi trong code không phải lỗi mạng', () => {
  expect(
    isNetworkError({ code: '57014', message: 'canceling statement due to statement timeout' }),
  ).toBe(false)
  expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
    false,
  )
  expect(isNetworkError(null)).toBe(false)
})

test('máy báo offline thì lỗi nào cũng coi là lỗi mạng', () => {
  goOffline()
  expect(isNetworkError(new Error('bất kỳ'))).toBe(true)
})
