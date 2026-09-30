import { DEFAULT_SITE_URL } from '@/config/site'

/** Địa chỉ web không có dấu "/" ở cuối, vd https://ten-mien.vn (VITE_SITE_URL ghi đè mặc định) */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
