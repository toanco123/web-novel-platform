// Bìa chữ tự sinh cho truyện chưa có ảnh bìa: mỗi slug ra một bảng màu cố định
const palettes = [
  { from: '#5b1331', to: '#1f0a17', ink: '#f6d9c9' },
  { from: '#3d1a4f', to: '#140a1c', ink: '#f1d3c4' },
  { from: '#a8465f', to: '#3a1022', ink: '#fde8ec' },
  { from: '#2b2350', to: '#120d24', ink: '#e9d6c8' },
  { from: '#7a2a1f', to: '#26100c', ink: '#f7dcc0' },
  { from: '#1f4a44', to: '#0b1c1a', ink: '#e7d8c2' },
  { from: '#6a2c5c', to: '#1b0c1e', ink: '#ffd6e6' },
]

export function coverPalette(slug: string) {
  let hash = 0
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return palettes[hash % palettes.length]
}
