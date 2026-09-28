import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { StorageFullError } from '@/lib/mockStorage'
import type { User } from '@/types/user'
import * as api from './api'

export const authKeys = {
  session: ['auth', 'session'] as const,
}

export const useSession = () =>
  useQuery({ queryKey: authKeys.session, queryFn: api.getSession, staleTime: Infinity })

/** Tải lại phiên khi đăng nhập/đăng xuất xảy ra ngoài các hook ở đây (tab khác, link email, hết hạn) */
export function useAuthSync() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      api.onAuthStateChange(
        () => void queryClient.invalidateQueries({ queryKey: authKeys.session }),
      ),
    [queryClient],
  )
}

/** Trang /auth/callback: lấy phiên vừa tạo từ link quay về, rồi lưu vào cache phiên */
export function useCompleteAuthRedirect() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['auth', 'callback'],
    queryFn: async () => {
      const user = await api.completeAuthRedirect()
      queryClient.setQueryData(authKeys.session, user)
      return user
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  })
}

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

export function useUpdateProfile() {
  const setSession = useSetSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (user) => {
      setSession(user)
      // Bình luận hiển thị tên/ảnh mới
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })
}

export const useChangePassword = () => useMutation({ mutationFn: api.changePassword })

/** Xóa tài khoản: xong thì bỏ mọi dữ liệu đã tải của người này và về trạng thái khách */
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      queryClient.removeQueries()
      queryClient.setQueryData(authKeys.session, null)
    },
  })
}

export const useSendPasswordReset = () => useMutation({ mutationFn: api.sendPasswordReset })
export const useUpdatePassword = () => useMutation({ mutationFn: api.updatePassword })

/** Thông báo lỗi hiển thị cho người dùng từ lỗi bất kỳ của các hàm auth */
export function authErrorMessage(error: unknown) {
  if (error instanceof api.AuthError || error instanceof StorageFullError) return error.message
  return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
}
