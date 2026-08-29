import { cn } from '@/lib/cn'

interface Option<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === o.value
              ? 'bg-[var(--surface-2)] text-white shadow-sm'
              : 'text-slate-400 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
