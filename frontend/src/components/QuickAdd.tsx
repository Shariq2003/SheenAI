import { useRef, useState } from 'react'
import { CornerDownLeft, Plus } from 'lucide-react'

import { api } from '@/lib/api'
import { hhmm } from '@/lib/format'
import { notifyError, toast } from '@/lib/notify'
import { parseTaskInput } from '@/lib/parseTime'
import { useCategories } from '@/lib/useCategories'
import { Select, Spinner } from '@/components/ui'

export function QuickAdd({
  date,
  onCreated,
}: {
  date: string
  onCreated: () => void
}) {
  const categories = useCategories()
  const [value, setValue] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const cat = categoryId || categories.find((c) => c.name === 'Other')?.id
  const parsed = parseTaskInput(value)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const p = parseTaskInput(value)
    if (!p.title.trim() || !cat) return
    setBusy(true)
    try {
      await api.createTask({
        category_id: cat,
        title: p.title.trim(),
        scheduled_date: date,
        scheduled_start: p.start ?? null,
        scheduled_end: p.end ?? null,
      })
      toast.success(
        p.start ? `Added “${p.title.trim()}” at ${p.start}` : 'Task added',
      )
      setValue('')
      inputRef.current?.focus()
      onCreated()
    } catch (err) {
      notifyError(err, 'Could not add the task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-1.5"
    >
      <div className="w-32 shrink-0">
        <Select
          sizeVariant="sm"
          value={categoryId}
          onChange={(e) =>
            setCategoryId(e.target.value ? Number(e.target.value) : '')
          }
          aria-label="Category"
        >
          <option value="">Other</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="relative flex-1">
        <Plus className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-3)]" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a task — try “Gym 7am” or “Review 14:00-15:30”"
          className="h-9 w-full rounded-lg border border-transparent bg-transparent pl-8 pr-24 text-sm text-slate-100 outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--border-strong)]"
        />
        {parsed.start && (
          <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[11px] font-medium text-indigo-300">
            {hhmm(parsed.start)}
            {parsed.end ? `–${hhmm(parsed.end)}` : ''}
          </span>
        )}
        <button
          type="submit"
          disabled={busy || !parsed.title.trim()}
          aria-label="Add"
          className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {busy ? <Spinner className="size-3.5" /> : <CornerDownLeft className="size-3.5" />}
        </button>
      </div>
    </form>
  )
}
