import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Repeat } from 'lucide-react'

import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/format'
import { STATUS_META } from '@/lib/theme'
import { notifyError, toast } from '@/lib/notify'
import { useCategories } from '@/lib/useCategories'
import { TASK_STATUSES } from '@/lib/types'
import type {
  RecurringTemplateCreate,
  TaskCreate,
  TaskStatus,
  TaskUpdate,
} from '@/lib/types'
import {
  Button,
  Card,
  CardBody,
  Field,
  FullPageLoader,
  Input,
  Select,
  Textarea,
} from '@/components/ui'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export function TaskForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const categories = useCategories()

  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [status, setStatus] = useState<TaskStatus>('pending')

  const [recurring, setRecurring] = useState(false)
  const [days, setDays] = useState<number[]>(ALL_DAYS)

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (categories.length && categoryId === '') setCategoryId(categories[0].id)
  }, [categories, categoryId])

  useEffect(() => {
    if (!id) return
    let alive = true
    setLoading(true)
    api
      .getTask(Number(id))
      .then((t) => {
        if (!alive) return
        setCategoryId(t.category_id)
        setTitle(t.title)
        setDescription(t.description ?? '')
        setDate(t.scheduled_date)
        setStart(t.scheduled_start?.slice(0, 5) ?? '')
        setEnd(t.scheduled_end?.slice(0, 5) ?? '')
        setStatus(t.status)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setLoadError(
          e instanceof ApiError && e.status === 404
            ? 'That task no longer exists.'
            : e instanceof Error
              ? e.message
              : 'Failed to load the task',
        )
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  const timeOrderBad = start !== '' && end !== '' && end < start
  const daysInvalid = recurring && days.length === 0
  const recurringTimesMissing = recurring && (start === '' || end === '')

  const canSubmit = useMemo(
    () =>
      !busy &&
      categoryId !== '' &&
      title.trim() !== '' &&
      !timeOrderBad &&
      !daysInvalid &&
      !recurringTimesMissing,
    [busy, categoryId, title, timeOrderBad, daysInvalid, recurringTimesMissing],
  )

  function toggleDay(d: number) {
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(),
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || categoryId === '') return
    setBusy(true)
    try {
      if (isEdit && id) {
        await api.updateTask(Number(id), {
          category_id: categoryId,
          title: title.trim(),
          description: description.trim() || null,
          scheduled_date: date,
          scheduled_start: start || null,
          scheduled_end: end || null,
          status,
        } satisfies TaskUpdate)
        toast.success('Task updated')
      } else if (recurring) {
        await api.createRecurringTemplate({
          category_id: categoryId,
          title: title.trim(),
          scheduled_start: start,
          scheduled_end: end,
          days: days.length === 7 ? null : days,
        } satisfies RecurringTemplateCreate)
        toast.success('Repeating task scheduled')
      } else {
        await api.createTask({
          category_id: categoryId,
          title: title.trim(),
          description: description.trim() || null,
          scheduled_date: date,
          scheduled_start: start || null,
          scheduled_end: end || null,
        } satisfies TaskCreate)
        toast.success('Task created')
      }
      navigate('/', { replace: true })
    } catch (err) {
      notifyError(err, 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <FullPageLoader label="Loading task" />
  if (loadError) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-sm text-rose-300">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="size-4" />
          Back to tasks
        </button>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-xl font-semibold text-white">
          {isEdit ? 'Edit task' : 'Add task'}
        </h1>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Category" htmlFor="tf-category">
              <Select
                id="tf-category"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Title" htmlFor="tf-title">
              <Input
                id="tf-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                placeholder="e.g. LeetCode — graphs"
              />
            </Field>

            {!recurring && (
              <Field label="Description" htmlFor="tf-desc" hint="Optional">
                <Textarea
                  id="tf-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Notes, links, subtasks…"
                />
              </Field>
            )}

            {!isEdit && (
              <button
                type="button"
                onClick={() => setRecurring((v) => !v)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                  recurring
                    ? 'border-indigo-500/50 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-900',
                )}
              >
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  <Repeat className="size-4 text-indigo-400" />
                  Repeat on a schedule
                </span>
                <span
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    recurring ? 'bg-indigo-500' : 'bg-slate-700',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 size-4 rounded-full bg-white transition-transform',
                      recurring ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
            )}

            {recurring ? (
              <Field label="Repeat on" error={daysInvalid ? 'Pick at least one day.' : undefined}>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((lbl, d) => {
                    const on = days.includes(d)
                    return (
                      <button
                        type="button"
                        key={lbl}
                        onClick={() => toggleDay(d)}
                        className={cn(
                          'h-8 w-11 rounded-lg border text-xs font-medium transition-colors',
                          on
                            ? 'border-indigo-500 bg-indigo-600 text-white'
                            : 'border-slate-700 text-slate-300 hover:bg-slate-800',
                        )}
                      >
                        {lbl}
                      </button>
                    )
                  })}
                </div>
              </Field>
            ) : (
              <Field label="Date" htmlFor="tf-date">
                <Input
                  id="tf-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    Start {recurring && <span className="text-rose-400">*</span>}
                  </span>
                }
                htmlFor="tf-start"
              >
                <Input
                  id="tf-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field
                label={
                  <>
                    End {recurring && <span className="text-rose-400">*</span>}
                  </>
                }
                htmlFor="tf-end"
              >
                <Input
                  id="tf-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            {timeOrderBad && (
              <p className="text-xs text-rose-400">
                End time can’t be before the start time.
              </p>
            )}
            {recurringTimesMissing && (
              <p className="text-xs text-rose-400">
                A repeating task needs a start and end time.
              </p>
            )}

            {isEdit && (
              <Field label="Status" htmlFor="tf-status">
                <Select
                  id="tf-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" loading={busy} disabled={!canSubmit}>
                {isEdit
                  ? 'Save changes'
                  : recurring
                    ? 'Create schedule'
                    : 'Create task'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </section>
  )
}
