import { renderHook } from '@testing-library/react'
import { goOffline, goOnline } from '@/test/offline'
import { useOnline } from './useOnline'

test('theo sự kiện online/offline của trình duyệt', () => {
  const { result } = renderHook(() => useOnline())
  expect(result.current).toBe(true)
  goOffline()
  expect(result.current).toBe(false)
  goOnline()
  expect(result.current).toBe(true)
})
