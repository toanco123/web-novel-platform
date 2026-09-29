// Tài khoản của auth giả (features/auth/api.mock.ts), lưu localStorage. Trang quản trị bản giả
// (features/admin/api.mock.ts) cũng đọc danh sách này nên gom về đây.
import { readMock, writeMock, writeMockStrict } from '@/lib/mockStorage'
import type { User } from '@/types/user'

export type MockUser = Omit<User, 'isAdmin'> & {
  password: string | null
  role?: 'admin'
  /** Không có ở dữ liệu cũ */
  createdAt?: string
  lastSignInAt?: string
  /** Bị admin khóa: không đăng nhập được */
  bannedAt?: string | null
}

const USERS_KEY = 'mock-auth-users'

// Tài khoản demo là quản trị viên để xem thử trang /admin ở bản giả
const demoUser: MockUser = {
  id: 'demo',
  email: 'demo@webtruyen.vn',
  displayName: 'Bạn đọc Demo',
  avatarUrl: null,
  provider: 'email',
  password: 'matkhau123',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const loadUsers = () =>
  readMock<MockUser[]>(USERS_KEY, [demoUser]).map((u) =>
    // Dữ liệu lưu trước khi có vai trò: tài khoản demo vẫn là quản trị viên
    u.id === demoUser.id ? { ...demoUser, ...u, role: demoUser.role } : u,
  )
export const saveUsers = (users: MockUser[]) => writeMock(USERS_KEY, users)
// Ảnh đại diện là data URL, có thể làm đầy bộ nhớ: báo lỗi thay vì âm thầm bỏ qua
export const saveUsersStrict = (users: MockUser[]) => writeMockStrict(USERS_KEY, users)

export const toPublicUser = ({
  password: _password,
  role,
  createdAt: _createdAt,
  lastSignInAt: _lastSignInAt,
  bannedAt: _bannedAt,
  ...user
}: MockUser): User => ({ ...user, isAdmin: role === 'admin' })
