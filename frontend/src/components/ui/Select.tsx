import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'

type Props = SelectHTMLAttributes<HTMLSelectElement> & { sizeVariant?: 'sm' | 'md' }

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className, sizeVariant = 'md', children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 pr-9 text-slate-100 outline-none transition-colors',
          'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50',
          sizeVariant === 'sm' ? 'h-9 pl-2.5 text-xs' : 'h-10 pl-3 text-sm',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
    </div>
  )
})
