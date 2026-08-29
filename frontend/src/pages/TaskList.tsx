import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'

import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  addDays,
  hhmm,
  minutesOfDay,
  minutesToHM,
  parseISO,
  todayISO,
} from '@/lib/format'
import { notifyError, toast } from '@/lib/notify'
import { categoryStyle, STATUS_META, STATUS_ORDER } from '@/lib/theme'
import { useCategories } from '@/lib/useCategories'
import type { Task, TaskStatus } from '@/lib/types'
import {
  buttonClasses,
  Card,
  EmptyState,
  Menu,
  Ring,
  Segmented,
  Skeleton,
  StatusBadge,
} from '@/components/ui'
import { QuickAdd } from '@/components/QuickAdd'
import { RowMenu, TaskTimeline } from '@/components/TaskTimeline'

const GROUPS = [
  { key: 'morning', label: 'Morning', from: 0, to: 720 },
  { key: 'afternoon', label: 'Afternoon', from: 720, to: 1020 },
  { key: 'evening', label: 'Evening', from: 1020, to: 1440 },
]

function groupFor(t: Task): string {
  const m = minutesOfDay(t.scheduled_start)
  if (m == null) return 'anytime'
  return GROUPS.find((g) => m >= g.from && m < g.to)?.key ?? 'anytime'
}
function fullDate(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function TaskList() {
  const categories = useCategories()

  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null)
  const [view, setView] = useState<'agenda' | 'timeline'>('agenda')

  const [all, setAll] = useState<Task[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setAll(await api.getTasks({ date }))
    } catch (e) {
      setAll([])
      notifyError(e, 'Failed to load tasks')
    }
  }, [date])

  useEffect(() => {
    setAll(null)
    void load()
  }, [load])

  const counts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, done: 0, missed: 0, total: 0, minutes: 0 }
    for (const t of all ?? []) {
      c[t.status]++
      c.total++
      const s = minutesOfDay(t.scheduled_start)
      const e = minutesOfDay(t.scheduled_end)
      if (s != null && e != null && e > s) c.minutes += e - s
    }
    return c
  }, [all])

  const visible = useMemo(() => {
    let list = all ?? []
    if (categoryId != null) list = list.filter((t) => t.category_id === categoryId)
    if (statusFilter) list = list.filter((t) => t.status === statusFilter)
    return [...list].sort((a, b) => {
      const am = minutesOfDay(a.scheduled_start)
      const bm = minutesOfDay(b.scheduled_start)
      if (am == null && bm == null) return a.id - b.id
      if (am == null) return 1
      if (bm == null) return -1
      return am - bm || a.id - b.id
    })
  }, [all, categoryId, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of visible) {
      const k = groupFor(t)
      map.set(k, [...(map.get(k) ?? []), t])
    }
    return [...GROUPS.map((g) => g.key), 'anytime']
      .filter((k) => map.has(k))
      .map((k) => ({
        key: k,
        label:
          k === 'anytime'
            ? 'Anytime'
            : GROUPS.find((g) => g.key === k)!.label,
        tasks: map.get(k)!,
      }))
  }, [visible])

  async function setStatus(task: Task, next: TaskStatus) {
    setBusyId(task.id)
    try {
      await api.updateTask(task.id, { status: next })
      toast.success(
        next === 'done'
          ? 'Marked as done'
          : next === 'pending'
            ? 'Reopened'
            : `Set to ${STATUS_META[next].label.toLowerCase()}`,
      )
      await load()
    } catch (e) {
      notifyError(e, 'Could not update the task')
    } finally {
      setBusyId(null)
    }
  }

  async function reschedule(task: Task, start: string, end: string | null) {
    setBusyId(task.id)
    try {
      await api.updateTask(task.id, {
        scheduled_start: start,
        scheduled_end: end,
      })
      toast.success(`Moved to ${start}`)
      await load()
    } catch (e) {
      notifyError(e, 'Could not reschedule')
    } finally {
      setBusyId(null)
    }
  }

  function confirmDelete(task: Task) {
    toast(`Delete “${task.title}”?`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await api.deleteTask(task.id)
            toast.success('Task deleted')
            await load()
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) await load()
            else notifyError(e, 'Could not delete the task')
          }
        },
      },
    })
  }

  const isToday = date === todayISO()
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  return (
    <section className="space-y-4">
      {/* header + date nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            aria-label="Previous day"
            className="grid size-9 place-items-center rounded-lg border border-[var(--border)] text-slate-400 hover:bg-[var(--surface-2)] hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-white hover:bg-[var(--surface-2)]"
            >
              <CalendarDays className="size-4 text-slate-400" />
              {isToday ? 'Today' : fullDate(date)}
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Pick date"
            />
          </div>
          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            aria-label="Next day"
            className="grid size-9 place-items-center rounded-lg border border-[var(--border)] text-slate-400 hover:bg-[var(--surface-2)] hover:text-white"
          >
            <ChevronRight className="size-4" />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              <RotateCcw className="size-3.5" />
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            options={[
              { value: 'agenda', label: 'Agenda' },
              { value: 'timeline', label: 'Timeline' },
            ]}
            value={view}
            onChange={setView}
          />
          <Link
            to="/tasks/new"
            className={buttonClasses('primary', 'md') + ' hidden sm:inline-flex'}
          >
            <Plus className="size-4" />
            Add task
          </Link>
        </div>
      </div>

      <QuickAdd date={date} onCreated={load} />

      {/* overview */}
      {all === null ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : (
        <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Ring
              value={counts.total ? counts.done / counts.total : 0}
              color="var(--ok)"
              size={68}
            >
              <span className="text-sm font-semibold text-white">
                {counts.total
                  ? Math.round((counts.done / counts.total) * 100)
                  : 0}
                %
              </span>
            </Ring>
            <div>
              <p className="text-sm font-medium text-white">
                {counts.done} of {counts.total} done
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-3)]">
                <Clock className="size-3" />
                {minutesToHM(counts.minutes)} scheduled
              </p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-4 gap-2">
            {STATUS_ORDER.map((s) => {
              const active = statusFilter === s
              const meta = STATUS_META[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-center transition-colors',
                    active
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[var(--border)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  <span className="block text-lg font-semibold text-white">
                    {counts[s]}
                  </span>
                  <span
                    className={cn(
                      'flex items-center justify-center gap-1 text-[11px]',
                      meta.fg,
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* category chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={categoryId == null} onClick={() => setCategoryId(null)}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            dot={categoryStyle(c.name, c.color).color}
          >
            {c.name}
          </Chip>
        ))}
      </div>

      {/* content */}
      {all === null ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing here"
          description={
            categoryId != null || statusFilter
              ? 'No tasks match these filters.'
              : isToday
                ? 'Add your first task above.'
                : 'No tasks on this day.'
          }
        />
      ) : view === 'timeline' ? (
        <TaskTimeline
          tasks={visible}
          isToday={isToday}
          onReschedule={reschedule}
          onToggle={(t) => setStatus(t, t.status === 'done' ? 'pending' : 'done')}
          onStatus={setStatus}
          onDelete={confirmDelete}
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  {g.label}
                </h3>
                <span className="text-xs text-[var(--ink-3)]">
                  {g.tasks.length}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <Card className="divide-y divide-[var(--border)]">
                {g.tasks.map((t, i) => {
                  const m = minutesOfDay(t.scheduled_start)
                  const pm =
                    i > 0 ? minutesOfDay(g.tasks[i - 1].scheduled_start) : -1
                  const showNow =
                    isToday &&
                    g.key !== 'anytime' &&
                    m != null &&
                    nowMin < m &&
                    (pm == null || pm < nowMin)
                  return (
                    <div key={t.id}>
                      {showNow && <NowMarker />}
                      <TaskRow
                        task={t}
                        busy={busyId === t.id}
                        onToggle={() =>
                          setStatus(t, t.status === 'done' ? 'pending' : 'done')
                        }
                        onStatus={setStatus}
                        onDelete={confirmDelete}
                      />
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Chip({
  active,
  onClick,
  dot,
  children,
}: {
  active: boolean
  onClick: () => void
  dot?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-indigo-500 bg-indigo-500/15 text-white'
          : 'border-[var(--border)] text-slate-400 hover:bg-[var(--surface-2)] hover:text-white',
      )}
    >
      {dot && (
        <span className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />
      )}
      {children}
    </button>
  )
}

function NowMarker() {
  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <span className="size-1.5 rounded-full bg-rose-400" />
      <div className="h-px flex-1 bg-rose-400/50" />
      <span className="text-[10px] font-medium uppercase tracking-wide text-rose-400">
        Now
      </span>
    </div>
  )
}

const COARSE =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: coarse)').matches

function TaskRow({
  task,
  busy,
  onToggle,
  onStatus,
  onDelete,
}: {
  task: Task
  busy: boolean
  onToggle: () => void
  onStatus: (task: Task, s: TaskStatus) => void
  onDelete: (task: Task) => void
}) {
  const done = task.status === 'done'
  const s = categoryStyle(task.category.name, task.category.color)

  // swipe (touch only)
  const [dx, setDx] = useState(0)
  const startX = useRef<number | null>(null)
  const clamped = Math.max(-160, Math.min(160, dx))

  function down(e: React.PointerEvent) {
    if (!COARSE || (e.target as HTMLElement).closest('[data-noswipe]')) return
    startX.current = e.clientX
  }
  function move(e: React.PointerEvent) {
    if (startX.current == null) return
    setDx(e.clientX - startX.current)
  }
  function up() {
    if (startX.current == null) return
    const d = dx
    startX.current = null
    setDx(0)
    if (d > 90) onToggle()
    else if (d < -130) onDelete(task)
  }

  return (
    <div className="relative overflow-hidden">
      {/* swipe backgrounds */}
      {clamped !== 0 && (
        <div
          className={cn(
            'absolute inset-y-0 flex items-center px-4 text-xs font-medium',
            clamped > 0
              ? 'left-0 text-emerald-300'
              : 'right-0 text-rose-300',
          )}
        >
          {clamped > 0 ? (
            <>
              <Check className="mr-1 size-4" /> {done ? 'Reopen' : 'Done'}
            </>
          ) : (
            <>
              <Trash2 className="mr-1 size-4" /> Delete
            </>
          )}
        </div>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: clamped ? `translateX(${clamped}px)` : undefined }}
        className={cn(
          'group flex items-center gap-3 bg-[var(--surface-1)] px-3 py-2.5 transition-colors hover:bg-white/[0.02]',
          clamped && 'transition-none',
        )}
      >
        <span
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: s.color }}
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          data-noswipe
          aria-label={done ? 'Mark pending' : 'Mark done'}
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50',
            done
              ? 'animate-pop border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-600 text-transparent hover:border-emerald-400',
          )}
        >
          <Check className="size-3" strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              done ? 'text-slate-500 line-through' : 'text-slate-100',
            )}
          >
            {task.title}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--ink-3)]">
            <span className="tabular-nums">
              {hhmm(task.scheduled_start)}
              {task.scheduled_end ? `–${hhmm(task.scheduled_end)}` : ''}
            </span>
            <span
              className="inline-flex items-center gap-1"
              style={{ color: s.color }}
            >
              <s.icon className="size-3" />
              {task.category.name}
            </span>
          </p>
        </div>

        <div className="hidden sm:block">
          <StatusBadge status={task.status} />
        </div>

        <div data-noswipe>
          <Menu
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label="Task actions"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-[var(--surface-2)] hover:text-white"
              >
                <MoreHorizontal className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <RowMenu
                task={task}
                close={close}
                onStatus={onStatus}
                onDelete={onDelete}
              />
            )}
          </Menu>
        </div>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-5">
      {[3, 2].map((n, gi) => (
        <div key={gi}>
          <Skeleton className="mb-2 h-3 w-24" />
          <Card className="divide-y divide-[var(--border)]">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="size-5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}
