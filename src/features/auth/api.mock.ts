// Auth giả lưu trong localStorage: dùng cho test tự động và khi chạy không có Supabase
// (xem api.ts). Bản thật: api.remote.ts.
import { mockDelay as delay, readMock as read, writeMock as write } from '@/lib/mockStorage'
import { purgeUser } from '@/mocks/accounts'
import {
  loadUsers,
  type MockUser,
  saveUsers,
  saveUsersStrict,
  toPublicUser as toPublic,
} from '@/mocks/users'
import type { User } from '@/types/user'
import { AuthError, type SignUpResult, type SocialProvider, unauthenticated } from './shared'

const SESSION_KEY = 'mock-auth-session'

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const bannedError = () =>
  new AuthError(
    'banned',
    'Tài khoản đã bị khóa do vi phạm quy định. Liên hệ ban quản trị nếu bạn cho rằng đây là nhầm lẫn.',
  )

function startSession(user: MockUser) {
  if (user.bannedAt) throw bannedError()
  write(SESSION_KEY, user.id)
  // Trang quản trị hiện lần đăng nhập cuối
  const lastSignInAt = new Date().toISOString()
  saveUsers(loadUsers().map((u) => (u.id === user.id ? { ...u, lastSignInAt } : u)))
  return toPublic(user)
}

export async function getSession(): Promise<User | null> {
  const id = read<string | null>(SESSION_KEY, null)
  const user = id ? loadUsers().find((u) => u.id === id) : undefined
  // Bản giả: bị khóa thì mất phiên ngay (Supabase: khi token hết hạn, tối đa 1 giờ)
  return user && !user.bannedAt ? toPublic(user) : null
}

/** Dùng trong các api.ts khác cho thao tác cần đăng nhập (tủ truyện, bình luận...) */
export async function requireUser(): Promise<User> {
  const user = await getSession()
  if (!user) throw unauthenticated()
  return user
}

/** Id người đang đăng nhập; null nếu là khách */
export async function getUserId(): Promise<string | null> {
  return (await getSession())?.id ?? null
}

/** Bản giả không có sự kiện đăng nhập từ nơi khác (tab khác, link trong email) */
export function onAuthStateChange(_onChange: () => void): () => void {
  return () => {}
}

/** Trang /auth/callback: bản giả không chuyển qua trang ngoài nên chỉ đọc phiên hiện tại */
export async function completeAuthRedirect(): Promise<User | null> {
  return getSession()
}

export async function signInWithPassword(input: { email: string; password: string }) {
  await delay(500)
  const user = loadUsers().find(
    (u) => u.email === normalizeEmail(input.email) && u.password === input.password,
  )
  if (!user) throw new AuthError('invalid_credentials', 'Email hoặc mật khẩu không đúng.')
  return startSession(user)
}

export async function signUp(input: {
  displayName: string
  email: string
  password: string
}): Promise<SignUpResult> {
  await delay(700)
  const users = loadUsers()
  const email = normalizeEmail(input.email)
  if (users.some((u) => u.email === email)) {
    throw new AuthError('email_taken', 'Email này đã được đăng ký. Đăng nhập hoặc dùng email khác.')
  }
  const user: MockUser = {
    id: crypto.randomUUID(),
    email,
    displayName: input.displayName.trim(),
    avatarUrl: null,
    provider: 'email',
    password: input.password,
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  // Supabase có thể bật xác nhận email: khi đó needsEmailConfirmation = true và user = null
  return { user: startSession(user), needsEmailConfirmation: false }
}

export async function signInWithProvider(provider: SocialProvider): Promise<User> {
  await delay(800)
  const users = loadUsers()
  const email = `ban-doc-${provider}@example.com`
  let user = users.find((u) => u.email === email)
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      displayName: provider === 'google' ? 'Bạn đọc Google' : 'Bạn đọc Facebook',
      avatarUrl: null,
      provider,
      password: null,
      createdAt: new Date().toISOString(),
    }
    saveUsers([...users, user])
  }
  return startSession(user)
}

/** Luôn thành công để không tiết lộ email có tồn tại hay không */
export async function sendPasswordReset(_email: string) {
  await delay(500)
}

export async function updatePassword(password: string) {
  await delay(500)
  // Bản giả: link trong email chưa có thật, nên đổi mật khẩu cho phiên hiện tại (nếu có)
  const id = read<string | null>(SESSION_KEY, null)
  if (!id) return
  saveUsers(loadUsers().map((u) => (u.id === id ? { ...u, password } : u)))
}

/** Tên và ảnh hiện tại của nhiều người dùng (bình luận hiển thị theo hồ sơ mới nhất) */
export async function getProfiles(ids: string[]) {
  const wanted = new Set(ids)
  return new Map(
    loadUsers()
      .filter((u) => wanted.has(u.id))
      .map((u) => [u.id, { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }]),
  )
}

export async function updateProfile(input: { displayName: string; avatarUrl: string | null }) {
  await delay(500)
  const current = await requireUser()
  const users = loadUsers()
  const user = users.find((u) => u.id === current.id)!
  const updated = { ...user, displayName: input.displayName.trim(), avatarUrl: input.avatarUrl }
  saveUsersStrict(users.map((u) => (u.id === updated.id ? updated : u)))
  return toPublic(updated)
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  await delay(500)
  const current = await requireUser()
  const users = loadUsers()
  const user = users.find((u) => u.id === current.id)!
  if (user.password === null || user.password !== input.currentPassword) {
    throw new AuthError('invalid_credentials', 'Mật khẩu hiện tại không đúng.')
  }
  saveUsers(users.map((u) => (u.id === user.id ? { ...u, password: input.newPassword } : u)))
}

/**
 * Xóa hẳn tài khoản đang đăng nhập cùng truyện, bình luận, tủ truyện... của họ, rồi đăng xuất.
 * password: bắt buộc với tài khoản email (tài khoản Google/Facebook truyền null)
 */
export async function deleteAccount(password: string | null) {
  await delay(500)
  const current = await requireUser()
  const user = loadUsers().find((u) => u.id === current.id)!
  if (user.password !== null && user.password !== password) {
    throw new AuthError('invalid_credentials', 'Mật khẩu không đúng.')
  }
  purgeUser(user.id)
  write(SESSION_KEY, null)
}

export async function signOut() {
  await delay(200)
  write(SESSION_KEY, null)
}
