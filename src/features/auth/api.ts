// Nơi DUY NHẤT xử lý đăng nhập. Hiện là auth giả lưu trong localStorage (chỉ dùng khi dev);
// khi nối Supabase chỉ thay ruột các hàm này (xem mục 6 trong documents/plan-dang-nhap-dang-ky.md).
import { mockDelay as delay, readMock as read, writeMock as write } from '@/lib/mockStorage'
import type { AuthProvider, User } from '@/types/user'

type AuthErrorCode = 'invalid_credentials' | 'email_taken' | 'unauthenticated'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

type MockUser = User & { password: string | null }

const USERS_KEY = 'mock-auth-users'
const SESSION_KEY = 'mock-auth-session'

const demoUser: MockUser = {
  id: 'demo',
  email: 'demo@webtruyen.vn',
  displayName: 'Bạn đọc Demo',
  avatarUrl: null,
  provider: 'email',
  password: 'matkhau123',
}

const loadUsers = () => read<MockUser[]>(USERS_KEY, [demoUser])
const saveUsers = (users: MockUser[]) => write(USERS_KEY, users)
const toPublic = ({ password: _password, ...user }: MockUser): User => user
const normalizeEmail = (email: string) => email.trim().toLowerCase()

function startSession(user: MockUser) {
  write(SESSION_KEY, user.id)
  return toPublic(user)
}

export async function getSession(): Promise<User | null> {
  const id = read<string | null>(SESSION_KEY, null)
  const user = id ? loadUsers().find((u) => u.id === id) : undefined
  return user ? toPublic(user) : null
}

/** Dùng trong các api.ts khác cho thao tác cần đăng nhập (tủ truyện, bình luận...) */
export async function requireUser(): Promise<User> {
  const user = await getSession()
  if (!user) throw new AuthError('unauthenticated', 'Bạn cần đăng nhập để làm việc này.')
  return user
}

export async function signInWithPassword(input: { email: string; password: string }) {
  await delay(500)
  const user = loadUsers().find(
    (u) => u.email === normalizeEmail(input.email) && u.password === input.password,
  )
  if (!user) throw new AuthError('invalid_credentials', 'Email hoặc mật khẩu không đúng.')
  return startSession(user)
}

export async function signUp(input: { displayName: string; email: string; password: string }) {
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
  }
  saveUsers([...users, user])
  // Supabase có thể bật xác nhận email: khi đó needsEmailConfirmation = true và user = null
  return { user: startSession(user), needsEmailConfirmation: false }
}

export async function signInWithProvider(provider: Exclude<AuthProvider, 'email'>) {
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

export async function signOut() {
  await delay(200)
  write(SESSION_KEY, null)
}
