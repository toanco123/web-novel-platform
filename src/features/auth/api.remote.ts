// Đăng nhập bằng Supabase Auth. Hồ sơ công khai (tên, ảnh) nằm ở bảng profiles, do trigger tạo khi
// đăng ký (tên lấy từ options.data.display_name); email và provider lấy từ phiên đăng nhập.
import { isAuthApiError, type Session } from '@supabase/supabase-js'
import { unwrap } from '@/lib/dbError'
import {
  imagePathFromUrl,
  isDataUrl,
  publicImageUrl,
  removeImage,
  removeUserImages,
  uploadImage,
} from '@/lib/imageUpload'
import { readMock, writeMock } from '@/lib/mockStorage'
import { isNetworkError } from '@/lib/network'
import { paths } from '@/lib/routes'
import { db } from '@/lib/supabase'
import type { User } from '@/types/user'
import { safeNext } from './safeNext'
import {
  AuthError,
  type SignUpResult,
  type SocialProvider,
  unauthenticated,
  type WithCaptcha,
} from './shared'

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
    case 'user_banned':
      return new AuthError(
        'banned',
        'Tài khoản đã bị khóa do vi phạm quy định. Liên hệ ban quản trị nếu bạn cho rằng đây là nhầm lẫn.',
      )
    case 'captcha_failed':
      return new AuthError(
        'captcha_failed',
        'Chưa xác minh được bạn không phải robot. Tải lại trang rồi thử lại nhé.',
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

/** Hồ sơ lần tải trước (localStorage): mở app lúc offline vẫn nhận ra tài khoản */
const PROFILE_KEY = 'auth-profile'

/** Gọi khi hồ sơ tải lại ở nền khác bản đã lưu (onAuthStateChange đăng ký để làm mới phiên) */
const profileListeners = new Set<() => void>()

async function fetchProfile(userId: string): Promise<Profile> {
  const row = unwrap(
    await db().from('profiles').select('id, display_name, avatar_url').eq('id', userId).single(),
  )
  const profile = { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url }
  cachedProfile = profile
  writeMock(PROFILE_KEY, profile)
  return profile
}

/**
 * Hồ sơ người đang đăng nhập. Có bản lưu trên máy thì trả ngay (giao diện không phải chờ một lượt
 * gọi mạng mỗi lần mở web, không hiện giao diện của khách trước) rồi tải lại ở nền; bản mới khác
 * bản lưu thì báo profileListeners. Tải ở nền lỗi do mạng thì giữ bản lưu, lần sau thử lại.
 */
async function loadProfile(userId: string): Promise<Profile> {
  if (cachedProfile?.id === userId) return cachedProfile
  const saved = readMock<Profile | null>(PROFILE_KEY, null)
  if (saved?.id !== userId) return fetchProfile(userId)
  cachedProfile = saved
  fetchProfile(userId).then(
    (fresh) => {
      if (fresh.displayName !== saved.displayName || fresh.avatarUrl !== saved.avatarUrl) {
        profileListeners.forEach((notify) => notify())
      }
    },
    (error) => {
      if (cachedProfile === saved) cachedProfile = null
      // Lỗi không do mạng (vd hồ sơ không còn): bỏ bản lưu, làm mới phiên để báo lỗi như thường
      if (!isNetworkError(error)) {
        writeMock(PROFILE_KEY, null)
        profileListeners.forEach((notify) => notify())
      }
    },
  )
  return saved
}

function toUser(session: Session, profile: Profile): User {
  const provider = session.user.app_metadata.provider
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    provider:
      provider === 'google' || provider === 'facebook' || provider === 'apple' ? provider : 'email',
    // app_metadata chỉ sửa được bằng quyền quản trị DB (cách cấp: thiet-ke-database.md)
    isAdmin: session.user.app_metadata.role === 'admin',
  }
}

async function userOf(session: Session) {
  return toUser(session, await loadProfile(session.user.id))
}

/** Mất mạng thì chờ supabase-js tối đa chừng này: token hết hạn thì nó thử làm mới tới ~25 giây */
const OFFLINE_SESSION_WAIT_MS = 2000

/** Phiên supabase-js lưu trên máy, đọc thẳng (không làm mới token) */
function storedSession(): Session | null {
  const key = (db().auth as unknown as { storageKey?: string }).storageKey
  const session = key ? readMock<Session | null>(key, null) : null
  return session?.user?.id ? session : null
}

/**
 * Phiên hiện tại (supabase-js tự làm mới token khi cần). Mất mạng mà supabase-js treo vì đang làm
 * mới token hết hạn, hoặc trả về không có phiên, thì dùng phiên đã lưu trên máy: mở app lúc offline
 * vẫn nhận đúng tài khoản (thao tác cần máy chủ đằng nào cũng chờ có mạng).
 */
async function currentSession(): Promise<Session | null> {
  const load = db()
    .auth.getSession()
    .then(({ data }) => data.session)
  if (navigator.onLine) return load
  const timeout = new Promise<null>((resolve) => setTimeout(resolve, OFFLINE_SESSION_WAIT_MS, null))
  return (await Promise.race([load.catch(() => null), timeout])) ?? storedSession()
}

export async function getSession(): Promise<User | null> {
  // Đọc phiên đã lưu trên máy (tự làm mới token khi cần), không gọi máy chủ nếu còn hạn
  const session = await currentSession()
  if (!session) {
    cachedProfile = null
    return null
  }
  return userOf(session)
}

/** Dùng trong các api khác cho thao tác cần đăng nhập (tủ truyện, bình luận...) */
export async function requireUser(): Promise<User> {
  const user = await getSession()
  if (!user) throw unauthenticated()
  return user
}

/** Id người đang đăng nhập; null nếu là khách. Không tải hồ sơ nên nhanh hơn getSession */
export async function getUserId(): Promise<string | null> {
  return (await currentSession())?.user.id ?? null
}

/**
 * Báo khi phiên đổi ngoài các hàm ở đây (tab khác, link trong email, hết hạn).
 * Callback của supabase-js phải ngắn và không gọi lại Supabase ngay, nên chỉ hẹn chạy onChange sau.
 */
export function onAuthStateChange(onChange: () => void): () => void {
  const { data } = db().auth.onAuthStateChange((event) => {
    // Đăng xuất (kể cả xóa tài khoản, phiên hết hạn): không giữ hồ sơ trên máy
    if (event === 'SIGNED_OUT') writeMock(PROFILE_KEY, null)
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
    cachedProfile = null
    setTimeout(onChange, 0)
  })
  // Hồ sơ tải lại ở nền đã khác bản lưu (đổi tên, ảnh ở máy khác): làm mới phiên
  profileListeners.add(onChange)
  return () => {
    data.subscription.unsubscribe()
    profileListeners.delete(onChange)
  }
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

export async function signInWithPassword(input: { email: string; password: string } & WithCaptcha) {
  cachedProfile = null
  const { data, error } = await db().auth.signInWithPassword({
    email: normalizeEmail(input.email),
    password: input.password,
    options: { captchaToken: input.captchaToken },
  })
  if (error) throw authError(error)
  return userOf(data.session)
}

export async function signUp(
  input: { displayName: string; email: string; password: string } & WithCaptcha,
): Promise<SignUpResult> {
  cachedProfile = null
  const { data, error } = await db().auth.signUp({
    email: normalizeEmail(input.email),
    password: input.password,
    options: {
      data: { display_name: input.displayName.trim() },
      emailRedirectTo: `${origin()}${paths.authCallback}`,
      captchaToken: input.captchaToken,
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
export async function sendPasswordReset({ email, captchaToken }: { email: string } & WithCaptcha) {
  const { error } = await db().auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: `${origin()}${paths.resetPassword}`,
    captchaToken,
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
  // Ghi đè cả bản lưu trên máy: loadProfile trả bản lưu trước, để cũ thì tên/ảnh cũ hiện lại
  cachedProfile = { id: current.id, displayName, avatarUrl }
  writeMock(PROFILE_KEY, cachedProfile)
  return { ...current, displayName, avatarUrl }
}

/** Kiểm tra mật khẩu hiện tại bằng cách đăng nhập lại, rồi mới đổi */
export async function changePassword(
  input: { currentPassword: string; newPassword: string } & WithCaptcha,
) {
  const user = await requireUser()
  const { error: checkError } = await db().auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
    options: { captchaToken: input.captchaToken },
  })
  if (checkError) {
    throw isAuthApiError(checkError) && checkError.code === 'invalid_credentials'
      ? new AuthError('invalid_credentials', 'Mật khẩu hiện tại không đúng.')
      : authError(checkError)
  }
  const { error } = await db().auth.updateUser({ password: input.newPassword })
  if (error) throw authError(error)
}

/**
 * Xóa hẳn tài khoản đang đăng nhập (RPC delete_account: DB xóa theo truyện, bình luận, tủ truyện...),
 * rồi bỏ phiên trên máy. password: bắt buộc với tài khoản email, kiểm tra bằng cách đăng nhập lại.
 */
export async function deleteAccount({
  password,
  captchaToken,
}: { password: string | null } & WithCaptcha) {
  const user = await requireUser()
  if (user.provider === 'email') {
    const { error } = await db().auth.signInWithPassword({
      email: user.email,
      password: password ?? '',
      options: { captchaToken },
    })
    if (error) {
      throw isAuthApiError(error) && error.code === 'invalid_credentials'
        ? new AuthError('invalid_credentials', 'Mật khẩu không đúng.')
        : authError(error)
    }
  }
  // Ảnh trong Storage không tự xóa theo tài khoản; xóa không được thì vẫn xóa tài khoản
  // (chỉ để lại file thừa)
  await Promise.allSettled([
    removeUserImages('avatars', user.id),
    removeUserImages('covers', user.id),
  ])
  unwrap(await db().rpc('delete_account'))
  cachedProfile = null
  // Tài khoản đã mất nên máy chủ có thể báo lỗi khi đăng xuất; chỉ cần xóa phiên trên máy
  await db().auth.signOut({ scope: 'local' })
}

/** Chỉ đăng xuất trên máy này */
export async function signOut() {
  cachedProfile = null
  const { error } = await db().auth.signOut({ scope: 'local' })
  if (error) throw authError(error)
}
