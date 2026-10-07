import { useId } from 'react'

/**
 * Hình biểu tượng "Sách nở hoa" (hệ tọa độ 512, bản gốc ở documents/logo/): nét sách theo màu chữ,
 * cánh hoa theo token --neon. Dùng trong <svg> của SiteLogo và LogoMark.
 */
export function MarkShapes() {
  // Logo hiện nhiều lần trên trang (header, menu di động, footer, banner): id mask phải khác nhau
  const maskId = useId()

  return (
    <>
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="512" height="512" fill="#fff" />
          <circle cx="256" cy="200" r="20" fill="#000" />
        </mask>
      </defs>
      <path
        d="M256 330C210 300 150 294 100 304V398C150 388 210 392 256 422C302 392 362 388 412 398V304C362 294 302 300 256 330Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      <path d="M256 330V422" stroke="currentColor" strokeWidth="18" strokeLinecap="round" />
      <g fill="var(--neon)" mask={`url(#${maskId})`}>
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="256"
            cy="150"
            rx="30"
            ry="50"
            transform={`rotate(${deg} 256 200)`}
          />
        ))}
      </g>
      <circle cx="256" cy="200" r="10" fill="currentColor" />
    </>
  )
}

/** Riêng biểu tượng, khung vừa khít (như documents/logo/logo-mark.svg) */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="86 90 340 346" className={className} aria-hidden focusable="false">
      <MarkShapes />
    </svg>
  )
}
