// Đưa QueryClient vào route loader qua context của React Router: loader tải trước dữ liệu vào đúng
// cache mà các hook trong trang đọc lại
import type { QueryClient } from '@tanstack/react-query'
import { createContext, RouterContextProvider } from 'react-router'

export const queryClientContext = createContext<QueryClient>()

/** Dùng cho `getContext` của router (app thật và renderApp của test) */
export const routerContext = (client: QueryClient) =>
  new RouterContextProvider(new Map([[queryClientContext, client]]))
