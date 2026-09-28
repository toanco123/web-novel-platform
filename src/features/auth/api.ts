// Nơi DUY NHẤT xử lý đăng nhập. Có Supabase thì dùng Supabase Auth (api.remote.ts), không thì dùng
// auth giả trong localStorage (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'
import { parseSocialProviders, SOCIAL_PROVIDERS, type SocialProvider } from './shared'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

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
  signOut,
} = api

/**
 * Nút đăng nhập mạng xã hội được hiện. Supabase: chỉ provider đã bật (VITE_AUTH_PROVIDERS, cần
 * Client ID/Secret trên Dashboard); bản giả: đủ cả hai.
 */
export const socialProviders: SocialProvider[] = supabase
  ? parseSocialProviders(import.meta.env.VITE_AUTH_PROVIDERS)
  : SOCIAL_PROVIDERS
