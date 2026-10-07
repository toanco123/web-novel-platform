/** 'apple': chỉ đăng nhập được trên app iOS (id token), web chưa có nút nhưng vẫn phải nhận ra tài khoản */
export type AuthProvider = 'email' | 'google' | 'facebook' | 'apple'

export type User = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  provider: AuthProvider
  /** Quản trị viên: xem được trang /admin */
  isAdmin: boolean
}
