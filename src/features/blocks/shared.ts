// Phần dùng chung của hai backend chặn người dùng (api.mock.ts, api.remote.ts)
import { AuthError } from '@/features/auth/shared'
import type { User } from '@/types/user'

export type BlockedUser = {
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>
  blockedAt: string
}

export const cannotBlockSelf = () => new AuthError('unknown', 'Bạn không thể chặn chính mình.')
