import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@/types/user'
import * as api from './api'

export const authKeys = {
  session: ['auth', 'session'] as const,
}

export const useSession = () =>
  useQuery({ queryKey: authKeys.session, queryFn: api.getSession, staleTime: Infinity })

function useSetSession() {
  const queryClient = useQueryClient()
  return (user: User | null) => queryClient.setQueryData(authKeys.session, user)
}

export function useSignIn() {
  const setSession = useSetSession()
  return useMutation({ mutationFn: api.signInWithPassword, onSuccess: setSession })
}

export function useSignUp() {
  const setSession = useSetSession()
  return useMutation({ mutationFn: api.signUp, onSuccess: (r) => setSession(r.user) })
}

export function useSignInWithProvider() {
  const setSession = useSetSession()
  return useMutation({ mutationFn: api.signInWithProvider, onSuccess: setSession })
}

export function useSignOut() {
  const setSession = useSetSession()
  return useMutation({ mutationFn: api.signOut, onSuccess: () => setSession(null) })
}

export const useSendPasswordReset = () => useMutation({ mutationFn: api.sendPasswordReset })
export const useUpdatePassword = () => useMutation({ mutationFn: api.updatePassword })

/** Thông báo lỗi hiển thị cho người dùng từ lỗi bất kỳ của các hàm auth */
export function authErrorMessage(error: unknown) {
  if (error instanceof api.AuthError) return error.message
  return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
}
