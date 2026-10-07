/** Biểu đồ mini trong ô số liệu: đường + nền nhạt, tự vẽ bằng SVG (chỉ để nhìn xu hướng) */
export function Sparkline({
  values,
  color,
  className,
}: {
  values: number[]
  color: string
  className?: string
}) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  // Hệ tọa độ 100 × 30, co giãn theo khung (preserveAspectRatio="none")
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`)
  const line = points.join(' ')

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      <polygon points={`0,30 ${line} 100,30`} fill={color} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
