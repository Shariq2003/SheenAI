import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/cn'

const WIDTH = 184

/** Dropdown menu rendered in a body portal so it never clips inside a
 * scroll container or an `overflow-hidden` card. Flips up near the
 * viewport bottom. */
export function Menu({
  trigger,
  children,
  align = 'end',
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const h = menuRef.current?.offsetHeight ?? 220
    const flipUp = window.innerHeight - r.bottom < h + 12
    const top = flipUp ? Math.max(8, r.top - h - 6) : r.bottom + 6
    let left = align === 'end' ? r.right - WIDTH : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - WIDTH - 8))
    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onMove = () => place()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  return (
    <span ref={anchorRef} className="inline-flex">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
            className="animate-fade-in z-50 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] p-1 shadow-xl shadow-black/50"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </span>
  )
}

export function MenuItem({
  onClick,
  icon: Icon,
  children,
  danger,
}: {
  onClick: () => void
  icon?: React.ComponentType<{ className?: string }>
  children: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
        danger
          ? 'text-rose-300 hover:bg-rose-500/10'
          : 'text-slate-200 hover:bg-white/5',
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </button>
  )
}
