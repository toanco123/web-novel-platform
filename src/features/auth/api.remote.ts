// Đăng nhập bằng Supabase Auth. Hồ sơ công khai (tên, ảnh) nằm ở bảng profiles, do trigger tạo khi
// đăng ký (tên lấy từ options.data.display_name); email và provider lấy từ phiên đăng nhập.
import { isAuthApiError, type Session } from '@supabase/supabase-js'
import { unwrap } from '@/lib/dbError'
import {
  imagePathFromUrl,
  isDataUrl,
  publicImageUrl,
  removeImage,
  uploadImage,
} from '@/lib/imageUpload'
import { paths } from '@/lib/routes'
import { db } from '@/lib/supabase'
import type { User } from '@/types/user'
import { safeNext } from './safeNext'
import { AuthError, type SignUpResult, type SocialProvider, unauthenticated } from './shared'

type Profile = { id: string; displayName: string; avatarUrl: string | null }

// Hồ sơ của người đang đăng nhập, giữ lại để mỗi lần requireUser() không phải hỏi lại máy chủ.
// Xóa khi đăng nhập/đăng xuất/sửa hồ sơ.
let cachedProfile: Profile | null = null

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const origin = () => window.location.origin

/** Lỗi của Supabase Auth → AuthError với thông báo tiếng Việt; lỗi mạng giữ nguyên */
function authError(error: unknown): unknown {
  if (!isAuthApiError(error)) return error
  switch (error.code) {
    case 'invalid_credentials':
      return new AuthError('invalid_credentials', 'Email hoặc mật khẩu không đúng.')
    case 'user_already_exists':
    case 'email_exists':
      return new AuthError(
        'email_taken',
        'Email này đã được đăng ký. Đăng nhập hoặc dùng email khác.',
      )
    case 'weak_password':
      return new AuthError(
        'weak_password',
        'Mật khẩu quá yếu: cần ít nhất 8 ký tự, có cả chữ và số.',
      )
    case 'same_password':
      return new AuthError('same_password', 'Mật khẩu mới phải khác mật khẩu hiện tại.')
    case 'email_address_invalid':
      return new AuthError('invalid_email', 'Email này không dùng được. Thử một email khác.')
    case 'email_not_confirmed':
      return new AuthError(
        'email_not_confirmed',
        'Email chưa được xác nhận. Mở thư xác nhận trong hộp thư rồi thử lại.',
      )
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AuthError('rate_limited', 'Bạn thao tác hơi nhanh. Đợi một lát rồi thử lại.')
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
      return unauthenticated()
    default:
      return new AuthError('unknown', 'Có lỗi xảy ra. Thử lại sau ít phút.')
  }
}

async function loadProfile(userId: string): Promise<Profile> {
  if (cachedProfile?.id === userId) return cachedProfile
  const row = unwrap(
    await db().from('profiles').select('id, display_name, avatar_url').eq('id', userId).single(),
  )
  cachedProfile = { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url }
  return cachedProfile
}

function toUser(session: Session, profile: Profile): User {
  const provider = session.user.app_metadata.provider
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    provider: provider === 'google' || provider === 'facebook' ? provider : 'email',
    // app_metadata chỉ sửa được bằng quyền quản trị DB (cách cấp: thiet-ke-database.md)
    isAdmin: session.user.app_metadata.role === 'admin',
  }
}

async function userOf(session: Session) {
  return toUser(session, await loadProfile(session.user.id))
}

export async function getSession(): Promise<User | null> {
  // Đọc phiên đã lưu trên máy (tự làm mới token khi cần), không gọi máy chủ nếu còn hạn
  const { data } = await db().auth.getSession()
  if (!data.session) {
    cachedProfile = null
    return null
  }
  return userOf(data.session)
}

/** Dùng trong các api khác cho thao tác cần đăng nhập (tủ truyện, bình luận...) */
export async function requireUser(): Promise<User> {
  const user = await getSession()
  if (!user) throw unauthenticated()
  return user
}

/** Id người đang đăng nhập; null nếu là khách. Không tải hồ sơ nên nhanh hơn getSession */
export async function getUserId(): Promise<string | null> {
  const { data } = await db().auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Báo khi phiên đổi ngoài các hàm ở đây (tab khác, link trong email, hết hạn).
 * Callback của supabase-js phải ngắn và không gọi lại Supabase ngay, nên chỉ hẹn chạy onChange sau.
 */
export function onAuthStateChange(onChange: () => void): () => void {
  const { data } = db().auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
    cachedProfile = null
    setTimeout(onChange, 0)
  })
  return () => data.subscription.unsubscribe()
}

/**
 * Trang /auth/callback (sau khi đăng nhập Google/Facebook hoặc bấm link xác nhận email).
 * supabase-js tự đổi ?code= trên URL lấy phiên khi khởi tạo; getSession đợi bước đó xong.
 */
export async function completeAuthRedirect(): Promise<User | null> {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  if (params.get('error') || hash.get('error')) {
    throw new AuthError(
      'unknown',
      'Đăng nhập không thành công hoặc link đã hết hạn. Thử đăng nhập lại.',
    )
  }
  return getSession()
}

export async function signInWithPassword(input: { email: string; password: string }) {
  cachedProfile = null
  const { data, error } = await db().auth.signInWithPassword({
    email: normalizeEmail(input.email),
    password: input.password,
  })
  if (error) throw authError(error)
  return userOf(data.session)
}

export async function signUp(input: {
  displayName: string
  email: string
  password: string
}): Promise<SignUpResult> {
  cachedProfile = null
  const { data, error } = await db().auth.signUp({
    email: normalizeEmail(input.email),
    password: input.password,
    options: {
      data: { display_name: input.displayName.trim() },
      emailRedirectTo: `${origin()}${paths.authCallback}`,
    },
  })
  if (error) throw authError(error)
  // Khi bật xác nhận email, email đã đăng ký không báo lỗi (chống dò email) mà trả về user không có
  // identity nào
  if (data.user && data.user.identities?.length === 0) {
    throw new AuthError('email_taken', 'Email này đã được đăng ký. Đăng nhập hoặc dùng email khác.')
  }
  if (!data.session) return { user: null, needsEmailConfirmation: true }
  return { user: await userOf(data.session), needsEmailConfirmation: false }
}

/** Chuyển sang trang đăng nhập của Google/Facebook; quay về /auth/callback kèm ?next= hiện tại */
export async function signInWithProvider(provider: SocialProvider): Promise<User> {
  const next = safeNext(new URLSearchParams(window.location.search).get('next'))
  const { error } = await db().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin()}${paths.authCallback}?next=${encodeURIComponent(next)}`,
    },
  })
  if (error) throw authError(error)
  // Trình duyệt đang rời trang: giữ nút ở trạng thái chờ tới lúc chuyển xong
  return new Promise<User>(() => {})
}

/** Không báo email có tồn tại hay không (Supabase cũng không báo) */
export async function sendPasswordReset(email: string) {
  const { error } = await db().auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${origin()}${paths.resetPassword}`,
  })
  if (error) throw authError(error)
}

/**
 * Đặt mật khẩu mới từ link trong email (link mở ra phiên tạm của người dùng đó). Xong thì đăng xuất
 * khỏi mọi thiết bị để người dùng đăng nhập lại bằng mật khẩu mới.
 */
export async function updatePassword(password: string) {
  const { data } = await db().auth.getSession()
  if (!data.session) {
    throw new AuthError(
      'unauthenticated',
      'Link đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Gửi lại link mới nhé.',
    )
  }
  const { error } = await db().auth.updateUser({ password })
  if (error) throw authError(error)
  cachedProfile = null
  await db().auth.signOut()
}

/** Tên và ảnh hiện tại của nhiều người dùng */
export async function getProfiles(ids: string[]) {
  const rows = ids.length
    ? unwrap(await db().from('profiles').select('id, display_name, avatar_url').in('id', ids))
    : []
  return new Map(
    rows.map((r) => [r.id, { id: r.id, displayName: r.display_name, avatarUrl: r.avatar_url }]),
  )
}

/** avatarUrl: data URL (ảnh mới chọn) thì upload lên bucket avatars; null thì bỏ ảnh */
export async function updateProfile(input: { displayName: string; avatarUrl: string | null }) {
  const current = await requireUser()
  const displayName = input.displayName.trim()
  let avatarUrl = input.avatarUrl
  let uploaded: string | null = null
  if (isDataUrl(avatarUrl)) {
    uploaded = await uploadImage('avatars', current.id, avatarUrl)
    avatarUrl = publicImageUrl('avatars', uploaded)
  }
  const { error } = await db()
    .from('profiles')
    .update({ display_name: displayName, avatar_url: avatarUrl })
    .eq('id', current.id)
  if (error) {
    await removeImage('avatars', uploaded)
    throw error
  }
  if (avatarUrl !== current.avatarUrl) {
    await removeImage('avatars', imagePathFromUrl('avatars', current.avatarUrl))
  }
  cachedProfile = null
  return { ...current, displayName, avatarUrl }
}

/** Kiểm tra mật khẩu hiện tại bằng cách đăng nhập lại, rồi mới đổi */
export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const user = await requireUser()
  const { error: checkError } = await db().auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  })
  if (checkError) {
    throw isAuthApiError(checkError) && checkError.code === 'invalid_credentials'
      ? new AuthError('invalid_credentials', 'Mật khẩu hiện tại không đúng.')
      : authError(checkError)
  }
  const { error } = await db().auth.updateUser({ password: input.newPassword })
  if (error) throw authError(error)
}

/** Chỉ đăng xuất trên máy này */
export async function signOut() {
  cachedProfile = null
  const { error } = await db().auth.signOut({ scope: 'local' })
  if (error) throw authError(error)
}
