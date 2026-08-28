interface Props { size?: number; className?: string }

export default function NbLogo({ size = 32, className = '' }: Props) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 32 32" fill="none"
      className={className}
      aria-label="小本本"
    >
      <rect x="6" y="3" width="19" height="26" rx="3.5"
        fill="#EDE0CF" stroke="#D0BEA8" strokeWidth="1.5"/>
      <rect x="8.5" y="5.5" width="14" height="21" rx="2.5"
        fill="#FBF7F2" stroke="#E4D8C8" strokeWidth="1"/>
      <line x1="11" y1="10" x2="21" y2="10"
        stroke="#E4D8C8" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="11" y1="14" x2="21" y2="14"
        stroke="#E4D8C8" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="11" y1="18" x2="17" y2="18"
        stroke="#E4D8C8" strokeWidth="1.2" strokeLinecap="round"/>
      {/* 螺旋釘 */}
      <circle cx="6" cy="10.5" r="1.7" fill="none" stroke="#D0BEA8" strokeWidth="1.2"/>
      <circle cx="6" cy="16.5" r="1.7" fill="none" stroke="#D0BEA8" strokeWidth="1.2"/>
      <circle cx="6" cy="22.5" r="1.7" fill="none" stroke="#D0BEA8" strokeWidth="1.2"/>
    </svg>
  )
}
