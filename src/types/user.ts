export type AuthProvider = 'email' | 'google' | 'facebook'

export type User = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  provider: AuthProvider
}
