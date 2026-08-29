import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { minutesOfDay } from '@/lib/format'
import { categoryStyle } from '@/lib/theme'
import type { Task, TaskStatus } from '@/lib/types'
import { Menu, MenuItem, Spinner } from '@/components/ui'

const PPM = 1 // px per minute
const GUTTER = 46
const SNAP = 15

function fmt(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function label(h: number): string {
  const d = new Date(2000, 0, 1, h)
  return d.toLocaleTimeString(undefined, { hour: 'numeric' })
}

export function TaskTimeline({
  tasks,
  isToday,
  onReschedule,
  onToggle,
  onStatus,
  onDelete,
}: {
  tasks: Task[]
  isToday: boolean
  onReschedule: (task: Task, start: string, end: string | null) => void | Promise<void>
  onToggle: (task: Task) => void
  onStatus: (task: Task, s: TaskStatus) => void
  onDelete: (task: Task) => void
}) {
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragMin, setDragMin] = useState(0)
  // block held at its dropped position (with a spinner) while the PATCH + reload runs
  const [saving, setSaving] = useState<{ id: number; start: number; dur: number } | null>(
    null,
  )
  const drag = useRef<{ startY: number; orig: number; dur: number } | null>(null)

  const timed = tasks.filter((t) => minutesOfDay(t.scheduled_start) != null)
  const untimed = tasks.filter((t) => minutesOfDay(t.scheduled_start) == null)

  const { rangeStart, rangeEnd, placed, cols } = useMemo(() => {
    const spans = timed.map((t) => {
      const s = minutesOfDay(t.scheduled_start)!
      const e = minutesOfDay(t.scheduled_end) ?? s + 30
      return { t, s, e: Math.max(e, s + 20) }
    })
    const minS = spans.length ? Math.min(...spans.map((x) => x.s)) : 360
    const maxE = spans.length ? Math.max(...spans.map((x) => x.e)) : 1320
    const rs = Math.max(0, Math.min(360, Math.floor((minS - 60) / 60) * 60))
    const re = Math.min(1440, Math.max(1320, Math.ceil((maxE + 60) / 60) * 60))

    spans.sort((a, b) => a.s - b.s || a.e - b.e)
    const colEnd: number[] = []
    const items = spans.map((sp) => {
      let col = colEnd.findIndex((end) => end <= sp.s)
      if (col === -1) {
        col = colEnd.length
        colEnd.push(sp.e)
      } else colEnd[col] = sp.e
      return { ...sp, col }
    })
    return { rangeStart: rs, rangeEnd: re, placed: items, cols: Math.max(1, colEnd.length) }
  }, [timed])

  const height = (rangeEnd - rangeStart) * PPM
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const showNow = isToday && nowMin >= rangeStart && nowMin <= rangeEnd

  function onDown(e: React.PointerEvent, sp: { t: Task; s: number; e: number }) {
    if (saving || (e.target as HTMLElement).closest('[data-noalt]')) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { startY: e.clientY, orig: sp.s, dur: sp.e - sp.s }
    setDragId(sp.t.id)
    setDragMin(sp.s)
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || dragId == null) return
    const dy = e.clientY - drag.current.startY
    let next = drag.current.orig + dy / PPM
    next = Math.round(next / SNAP) * SNAP
    next = Math.max(rangeStart, Math.min(rangeEnd - drag.current.dur, next))
    setDragMin(next)
  }
  async function onUp(
    e: React.PointerEvent,
    sp: { t: Task; s: number; e: number },
  ) {
    if (!drag.current) return
    const dur = drag.current.dur
    // derive final position from the up event too, so a fast drag with no
    // intermediate move still lands
    const dy = e.clientY - drag.current.startY
    let next = Math.round((drag.current.orig + dy / PPM) / SNAP) * SNAP
    next = Math.max(rangeStart, Math.min(rangeEnd - dur, next))
    const moved = Math.abs(next - drag.current.orig)
    drag.current = null
    setDragId(null)
    if (moved < SNAP) return

    const hasEnd = minutesOfDay(sp.t.scheduled_end) != null
    // hold the block at the drop position + show a spinner until the
    // parent's PATCH + refetch resolves
    setSaving({ id: sp.t.id, start: next, dur })
    try {
      await onReschedule(sp.t, fmt(next), hasEnd ? fmt(next + dur) : null)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3">
      {untimed.length > 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-2">
          <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
            Unscheduled
          </p>
          <div className="flex flex-wrap gap-1.5">
            {untimed.map((t) => {
              const s = categoryStyle(t.category.name, t.category.color)
              return (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-slate-200 hover:bg-[var(--surface-2)]"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {t.title}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-2">
        <div className="relative" style={{ height }}>
          {/* hour grid */}
          {Array.from(
            { length: Math.floor(rangeEnd / 60) - Math.ceil(rangeStart / 60) + 1 },
            (_, i) => Math.ceil(rangeStart / 60) + i,
          ).map((h) => {
            const top = (h * 60 - rangeStart) * PPM
            return (
              <div key={h} className="absolute inset-x-0" style={{ top }}>
                <span className="absolute -top-2 left-0 w-10 text-right text-[10px] text-[var(--ink-3)]">
                  {label(h)}
                </span>
                <div
                  className="border-t border-[var(--border)]"
                  style={{ marginLeft: GUTTER }}
                />
              </div>
            )
          })}

          {showNow && (
            <div
              className="absolute inset-x-0 z-10"
              style={{ top: (nowMin - rangeStart) * PPM, marginLeft: GUTTER }}
            >
              <div className="relative">
                <span className="absolute -left-1 -top-1 size-2 rounded-full bg-rose-500" />
                <div className="border-t border-rose-500/70" />
              </div>
            </div>
          )}

          {/* blocks */}
          <div
            className="absolute inset-y-0 right-0"
            style={{ left: GUTTER }}
          >
            {placed.map((sp) => {
              const dragging = dragId === sp.t.id
              const isSaving = saving?.id === sp.t.id
              const pos = dragging
                ? dragMin
                : isSaving
                  ? saving!.start
                  : sp.s
              const dur = isSaving ? saving!.dur : sp.e - sp.s
              const top = (pos - rangeStart) * PPM
              const h = Math.max(dur * PPM, 26)
              const cs = categoryStyle(sp.t.category.name, sp.t.category.color)
              const done = sp.t.status === 'done'
              return (
                <div
                  key={sp.t.id}
                  onPointerDown={(e) => onDown(e, sp)}
                  onPointerMove={onMove}
                  onPointerUp={(e) => onUp(e, sp)}
                  className={cn(
                    'absolute touch-none select-none overflow-hidden rounded-lg border-l-2 px-2 py-1 text-xs transition-shadow',
                    dragging
                      ? 'z-20 cursor-grabbing shadow-xl'
                      : isSaving
                        ? 'z-20 cursor-default'
                        : 'cursor-grab',
                  )}
                  style={{
                    top,
                    height: h,
                    left: `calc(${(sp.col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 6px)`,
                    borderLeftColor: cs.color,
                    background: cs.color + (done ? '14' : '26'),
                  }}
                >
                  {isSaving && (
                    <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-[var(--surface-1)]/60 backdrop-blur-[1px]">
                      <Spinner className="size-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex items-start justify-between gap-1',
                      isSaving && 'opacity-40',
                    )}
                  >
                    <span
                      className={cn(
                        'truncate font-medium',
                        done ? 'text-slate-400 line-through' : 'text-slate-100',
                      )}
                    >
                      {sp.t.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5" data-noalt>
                      <button
                        type="button"
                        onClick={() => onToggle(sp.t)}
                        aria-label="Toggle done"
                        className={cn(
                          'grid size-4 place-items-center rounded-full border',
                          done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-500 text-transparent hover:border-emerald-400',
                        )}
                      >
                        <Check className="size-2.5" strokeWidth={3} />
                      </button>
                      <Menu
                        trigger={({ toggle }) => (
                          <button
                            type="button"
                            onClick={toggle}
                            aria-label="Actions"
                            className="grid size-4 place-items-center rounded text-slate-400 hover:text-white"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <RowMenu
                            task={sp.t}
                            close={close}
                            onStatus={onStatus}
                            onDelete={onDelete}
                          />
                        )}
                      </Menu>
                    </div>
                  </div>
                  {h > 34 && (
                    <span
                      className={cn(
                        'text-[10px] text-[var(--ink-3)]',
                        isSaving && 'opacity-40',
                      )}
                    >
                      {fmt(pos)}
                      {minutesOfDay(sp.t.scheduled_end) != null
                        ? `–${fmt(pos + dur)}`
                        : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-[var(--ink-3)]">
        {saving ? (
          <>
            <Spinner className="size-3" />
            Rescheduling…
          </>
        ) : (
          'Drag a block to reschedule · tap ✓ to complete'
        )}
      </p>
    </div>
  )
}

export function RowMenu({
  task,
  close,
  onStatus,
  onDelete,
}: {
  task: Task
  close: () => void
  onStatus: (task: Task, s: TaskStatus) => void
  onDelete: (task: Task) => void
}) {
  return (
    <>
      {task.status !== 'in_progress' && (
        <MenuItem icon={Play} onClick={() => { onStatus(task, 'in_progress'); close() }}>
          Start
        </MenuItem>
      )}
      {task.status !== 'done' ? (
        <MenuItem icon={Check} onClick={() => { onStatus(task, 'done'); close() }}>
          Mark done
        </MenuItem>
      ) : (
        <MenuItem icon={RotateCcw} onClick={() => { onStatus(task, 'pending'); close() }}>
          Reopen
        </MenuItem>
      )}
      {task.status !== 'missed' && (
        <MenuItem icon={XCircle} onClick={() => { onStatus(task, 'missed'); close() }}>
          Mark missed
        </MenuItem>
      )}
      <div className="my-1 h-px bg-[var(--border)]" />
      <Link
        to={`/tasks/${task.id}/edit`}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-200 hover:bg-white/5"
      >
        <Pencil className="size-4" />
        Edit
      </Link>
      <MenuItem icon={Trash2} danger onClick={() => { onDelete(task); close() }}>
        Delete
      </MenuItem>
    </>
  )
}
