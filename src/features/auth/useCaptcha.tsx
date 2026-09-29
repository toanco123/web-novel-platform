// Captcha Cloudflare Turnstile cho các form gọi Supabase Auth bằng email + mật khẩu (đăng nhập, đăng
// ký, quên mật khẩu, và kiểm tra lại mật khẩu khi đổi mật khẩu / xóa tài khoản). Bật khi có
// VITE_TURNSTILE_SITE_KEY và backend là Supabase; Supabase Auth kiểm tra mã khi bật Captcha ở
// Dashboard (Authentication > Attack Protection). Bản giả và test không có captcha.
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useCallback, useId, useRef, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'

const SITE_KEY = supabase ? import.meta.env.VITE_TURNSTILE_SITE_KEY : undefined

/** Chờ Turnstile tự xác minh tối đa chừng này (thường xong trước khi điền form xong) */
const TOKEN_TIMEOUT_MS = 30_000

/**
 * `element` đặt trong form (chỉ hiện ô xác minh khi Cloudflare cần người dùng bấm). Lúc gửi form gọi
 * `token()` lấy mã (undefined khi không bật captcha; null khi không xác minh được, `element` tự hiện
 * lời báo), gửi xong gọi `reset()` vì mỗi mã chỉ dùng được một lần.
 */
export function useCaptcha() {
  const ref = useRef<TurnstileInstance>(null)
  const id = useId()
  const theme = useTheme((s) => s.theme)
  const [failed, setFailed] = useState(false)
  // Widget báo lỗi (mạng, bị chặn...): lần gửi form đang chờ mã thì dừng luôn, không chờ hết giờ
  const errored = useRef(false)
  const stopWaiting = useRef<(() => void) | null>(null)

  const token = useCallback(async (): Promise<string | undefined | null> => {
    if (!SITE_KEY) return undefined
    setFailed(false)
    try {
      if (errored.current || !ref.current) throw new Error('captcha')
      return await Promise.race([
        ref.current.getResponsePromise(TOKEN_TIMEOUT_MS),
        new Promise<never>((_, reject) => {
          stopWaiting.current = () => reject(new Error('captcha'))
        }),
      ])
    } catch {
      setFailed(true)
      return null
    } finally {
      stopWaiting.current = null
    }
  }, [])

  const reset = useCallback(() => ref.current?.reset(), [])

  const element = SITE_KEY ? (
    <div className="space-y-2">
      <Turnstile
        ref={ref}
        id={`captcha-${id}`}
        siteKey={SITE_KEY}
        onSuccess={() => {
          errored.current = false
          setFailed(false)
        }}
        onError={() => {
          errored.current = true
          stopWaiting.current?.()
        }}
        options={{ appearance: 'interaction-only', language: 'vi', size: 'flexible', theme }}
      />
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Chưa xác minh được bạn không phải robot. Tải lại trang rồi thử lại nhé.
        </p>
      )}
    </div>
  ) : null

  return { element, token, reset }
}
