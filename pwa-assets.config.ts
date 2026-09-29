import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Icon ứng dụng (PWA) sinh từ public/favicon.svg: `npm run generate-pwa-assets` rồi commit các file
// trong public/. Icon maskable (Android) và apple-touch-icon lấy nền tím mận của theme tối
const resizeOptions = { background: '#1a0f1d' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions },
    apple: { ...preset.apple, resizeOptions },
  },
  images: ['public/favicon.svg'],
})
