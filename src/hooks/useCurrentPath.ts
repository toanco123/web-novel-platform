import { useLocation } from 'react-router'

/** Đường dẫn trang hiện tại (kèm query), để đăng nhập xong quay lại đúng chỗ */
export function useCurrentPath() {
  const { pathname, search } = useLocation()
  return pathname + search
}
