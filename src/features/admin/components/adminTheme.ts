// Màu của trang quản trị (Ant Design + biểu đồ G2), lấy theo token trong src/index.css để khớp
// giao diện sáng/tối của web. antd không đọc được biến CSS nên chép giá trị hex ở đây.
import { type ThemeConfig, theme as antdTheme } from 'antd'
import type { Theme } from '@/hooks/useTheme'

const tokens = {
  light: {
    background: '#fbf4f6',
    card: '#ffffff',
    foreground: '#2a1530',
    muted: '#6e5563',
    border: '#ead7df',
    primary: '#b0144f',
    accent: '#f6dde6',
    // Màu cột/đường của biểu đồ một chuỗi (--chart-1), đã kiểm bằng validator của skill dataviz
    series: '#b0144f',
    // Các màu dưới đã kiểm bằng validator của skill dataviz (nền thẻ #ffffff):
    // đường kỳ trước (xám làm nền, nét đứt + chú giải + nhãn), qua CVD với series
    seriesMuted: '#9a8a92',
    // Lịch nhiệt: một tông, nhạt → đậm, bậc nhạt nhất ≥ 2:1 so với nền thẻ
    heat: ['#eba0bb', '#d9628f', '#b8285e', '#7d0d38'],
    // Chữ tăng/giảm và trạng thái (≥ 4.5:1, luôn kèm mũi tên/icon và chữ)
    up: '#18794e',
    down: '#b42318',
    warn: '#b45309',
  },
  dark: {
    background: '#1a0f1d',
    card: '#24152a',
    foreground: '#f4e7ed',
    muted: '#b9a0ad',
    border: 'rgba(217, 166, 143, 0.14)',
    primary: '#ff3d8b',
    accent: '#4a1d35',
    series: '#f5347f',
    // Nền thẻ #24152a; xám kỳ trước là màu chữ phụ (qua CVD với series)
    seriesMuted: '#b9a0ad',
    heat: ['#842e5a', '#a92c63', '#d93474', '#ff86b0'],
    up: '#4ade80',
    down: '#ff8a80',
    warn: '#fbbf24',
  },
}

export const adminColors = (theme: Theme) => tokens[theme]

export function adminThemeConfig(theme: Theme): ThemeConfig {
  const c = tokens[theme]
  return {
    algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: c.primary,
      colorLink: c.primary,
      colorBgLayout: c.background,
      colorBgContainer: c.card,
      colorBgElevated: c.card,
      colorText: c.foreground,
      colorTextSecondary: c.muted,
      colorBorderSecondary: c.border,
      fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
      borderRadius: 10,
    },
    components: {
      Layout: { headerBg: c.card, siderBg: c.card, bodyBg: c.background, headerPadding: '0 16px' },
      Menu: { itemBg: 'transparent', itemSelectedBg: c.accent, itemSelectedColor: c.foreground },
    },
  }
}
