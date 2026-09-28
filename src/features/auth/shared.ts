// Phần dùng chung của hai backend đăng nhập (api.mock.ts, api.remote.ts)
import type { AuthProvider, User } from '@/types/user'

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'unauthenticated'
  | 'weak_password'
  | 'same_password'
  | 'invalid_email'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'unknown'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

export const unauthenticated = () =>
  new AuthError('unauthenticated', 'Bạn cần đăng nhập để làm việc này.')

/** Bật xác nhận email thì đăng ký xong chưa có phiên: user = null, needsEmailConfirmation = true */
export type SignUpResult = { user: User | null; needsEmailConfirmation: boolean }

export type SocialProvider = Exclude<AuthProvider, 'email'>

export const SOCIAL_PROVIDERS: SocialProvider[] = ['google', 'facebook']

/** 'google, facebook' → ['google', 'facebook'] (bỏ giá trị không hỗ trợ) */
export const parseSocialProviders = (value: string | undefined): SocialProvider[] => {
  const names = (value ?? '').split(',').map((s) => s.trim())
  return SOCIAL_PROVIDERS.filter((p) => names.includes(p))
}
