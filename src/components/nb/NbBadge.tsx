type Variant = 'green' | 'orange' | 'red' | 'blue' | 'yellow' | 'slate'

interface Props {
  variant: Variant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const styles: Record<Variant, string> = {
  green:  'bg-nb-green-bg  text-nb-green',
  orange: 'bg-nb-orange-bg text-nb-orange',
  red:    'bg-nb-red-bg    text-nb-red',
  blue:   'bg-nb-blue-bg   text-nb-blue',
  yellow: 'bg-yellow-50    text-nb-yellow',
  slate:  'bg-slate-100    text-slate-500',
}

const dotColors: Record<Variant, string> = {
  green:  'bg-nb-green',
  orange: 'bg-nb-orange',
  red:    'bg-nb-red',
  blue:   'bg-nb-blue',
  yellow: 'bg-nb-yellow',
  slate:  'bg-slate-400',
}

export default function NbBadge({ variant, children, className = '', dot = true }: Props) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-0.5
      text-[10.5px] font-extrabold rounded-full
      ${styles[variant]} ${className}
    `}>
      {dot && (
        <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  )
}
