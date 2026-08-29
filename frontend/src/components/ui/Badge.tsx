import { cn } from '@/lib/cn'
import { categoryStyle, STATUS_META } from '@/lib/theme'
import type { TaskStatus } from '@/lib/types'

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus
  className?: string
}) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.chip,
        className,
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  )
}

export function CategoryChip({
  name,
  color,
  withIcon = false,
  className,
}: {
  name: string
  color: string
  withIcon?: boolean
  className?: string
}) {
  const s = categoryStyle(name, color)
  const Icon = s.icon
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        color: s.color,
        borderColor: s.color + '4d',
        backgroundColor: s.color + '1a',
      }}
    >
      {withIcon ? (
        <Icon className="size-3" />
      ) : (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: s.color }}
        />
      )}
      {name}
    </span>
  )
}
