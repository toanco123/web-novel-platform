// Nơi DUY NHẤT xử lý đăng nhập. Có Supabase thì dùng Supabase Auth (api.remote.ts), không thì dùng
// auth giả trong localStorage (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
import * as mock from './api.mock'
import * as remote from './api.remote'
import {
  parseSocialProviders,
  SOCIAL_PROVIDERS,
  type SocialProvider,
  unauthenticated,
} from './shared'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const {
  getSession,
  requireUser,
  getUserId,
  onAuthStateChange,
  completeAuthRedirect,
  signInWithPassword,
  signUp,
  signInWithProvider,
  sendPasswordReset,
  updatePassword,
  getProfiles,
  updateProfile,
  changePassword,
  deleteAccount,
  signOut,
} = api

/** Id người đang đăng nhập (như requireUser nhưng không tải hồ sơ); khách thì AuthError */
export async function requireUserId() {
  const userId = await getUserId()
  if (!userId) throw unauthenticated()
  return userId
}

/**
 * Nút đăng nhập mạng xã hội được hiện. Supabase: chỉ provider đã bật (VITE_AUTH_PROVIDERS, cần
 * Client ID/Secret trên Dashboard); bản giả: đủ cả hai.
 */
export const socialProviders: SocialProvider[] = __USE_MOCK__
  ? SOCIAL_PROVIDERS
  : parseSocialProviders(import.meta.env.VITE_AUTH_PROVIDERS)
