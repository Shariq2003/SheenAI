import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Lightbulb,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { addDays, hhmm, minutesToHM, parseISO, todayISO } from '@/lib/format'
import { notifyError, toast } from '@/lib/notify'
import { categoryStyle } from '@/lib/theme'
import { useCategories } from '@/lib/useCategories'
import type { CompletionStats, StatsResponse } from '@/lib/types'
import {
  Card,
  CardBody,
  CardHeader,
  Ring,
  Segmented,
  Skeleton,
} from '@/components/ui'

type Range = '7d' | '30d' | '90d'
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

const AXIS = { stroke: '#2c3547', fontSize: 11, tickLine: false, axisLine: false }
const TICK = { fill: '#64748b', fontSize: 11 }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function shortDate(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
function mondayIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7
}

export function Dashboard() {
  const categories = useCategories()
  const [range, setRange] = useState<Range>('30d')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [heat, setHeat] = useState<CompletionStats | null>(null)
  const [exporting, setExporting] = useState(false)

  const today = todayISO()
  const from = addDays(today, -(RANGE_DAYS[range] - 1))

  useEffect(() => {
    let alive = true
    setStats(null)
    const granularity = range === '90d' ? 'week' : 'day'
    api
      .getStats({
        date_from: from,
        date_to: today,
        granularity,
        category_id: categoryId ?? undefined,
      })
      .then((s) => alive && setStats(s))
      .catch((e) => alive && notifyError(e, 'Failed to load stats'))
    return () => {
      alive = false
    }
  }, [range, categoryId, from, today])

  useEffect(() => {
    let alive = true
    setHeat(null)
    api
      .getStats({
        date_from: addDays(today, -90),
        date_to: today,
        granularity: 'day',
        category_id: categoryId ?? undefined,
      })
      .then((s) => alive && setHeat(s.completion))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [categoryId, today])

  async function exportCsv() {
    setExporting(true)
    try {
      const tasks = await api.getTasks({ date_from: from, date_to: today })
      const rows = [
        ['date', 'start', 'end', 'category', 'title', 'status', 'description'],
        ...tasks.map((t) => [
          t.scheduled_date,
          hhmm(t.scheduled_start),
          hhmm(t.scheduled_end),
          t.category.name,
          t.title,
          t.status,
          t.description ?? '',
        ]),
      ]
      const csv = rows
        .map((r) =>
          r
            .map((c) => `"${String(c).replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n')
      const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `sheenai-${from}_to_${today}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${tasks.length} tasks`)
    } catch (e) {
      notifyError(e, 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--ink-3)]">
            {stats
              ? `${stats.completion.date_from} → ${stats.completion.date_to}`
              : 'Loading your stats…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-slate-300 hover:bg-[var(--surface-2)] hover:text-white disabled:opacity-50"
          >
            <Download className="size-3.5" />
            {exporting ? 'Exporting…' : 'CSV'}
          </button>
          <Segmented
            options={[
              { value: '7d', label: '7d' },
              { value: '30d', label: '30d' },
              { value: '90d', label: '90d' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip active={categoryId == null} onClick={() => setCategoryId(null)}>
          All categories
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            dot={categoryStyle(c.name, c.color).color}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      {!stats ? (
        <DashboardSkeleton />
      ) : (
        <Content stats={stats} heat={heat} categoryId={categoryId} />
      )}
    </section>
  )
}

function FilterChip({
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

function Content({
  stats,
  heat,
  categoryId,
}: {
  stats: StatsResponse
  heat: CompletionStats | null
  categoryId: number | null
}) {
  const { completion, time_breakdown, streaks } = stats
  const focused = categoryId != null

  // streaks aren't filtered server-side (they're inherently per-category) —
  // narrow the list to the selected category on the client.
  const shownStreaks =
    categoryId == null
      ? streaks.by_category
      : streaks.by_category.filter((s) => s.category_id === categoryId)

  const bestCurrent = shownStreaks.reduce(
    (b, s) => (s.current_streak > b.current_streak ? s : b),
    { category: '—', current_streak: 0, best_streak: 0 },
  )
  const bestEver = shownStreaks.reduce(
    (b, s) => (s.best_streak > b.best_streak ? s : b),
    { category: '—', current_streak: 0, best_streak: 0 },
  )

  const trend = completion.buckets.map((b) => ({
    label: shortDate(b.period_start),
    rate: Math.round(b.completion_rate * 100),
    done: b.done,
    total: b.total,
  }))

  const timeData = time_breakdown.by_category
    .filter((c) => c.scheduled_minutes > 0)
    .map((c) => ({
      name: c.category,
      minutes: c.scheduled_minutes,
      completed: c.completed_minutes,
      color: categoryStyle(c.category, c.color).color,
    }))
    .sort((a, b) => b.minutes - a.minutes)

  const donut = timeData.map((d) => ({ name: d.name, value: d.minutes, color: d.color }))

  // weekday rhythm from the 90-day daily heatmap data
  const weekday = useMemo(() => {
    const acc = WEEKDAYS.map(() => ({ rate: 0, n: 0 }))
    for (const b of heat?.buckets ?? []) {
      if (b.total === 0) continue
      const i = mondayIndex(b.period_start)
      acc[i].rate += b.completion_rate
      acc[i].n += 1
    }
    return WEEKDAYS.map((d, i) => ({
      day: d,
      rate: acc[i].n ? Math.round((acc[i].rate / acc[i].n) * 100) : 0,
    }))
  }, [heat])

  const insights = useMemo(
    () => buildInsights(completion, timeData, weekday, shownStreaks),
    [completion, timeData, weekday, shownStreaks],
  )

  return (
    <div className="space-y-5">
      {/* hero */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center justify-center gap-5 p-5 lg:col-span-2">
          <Ring
            value={completion.overall_completion_rate}
            color="var(--ok)"
            size={104}
            stroke={9}
          >
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">
                {Math.round(completion.overall_completion_rate * 100)}%
              </div>
            </div>
          </Ring>
          <div className="text-center">
            <p className="text-sm text-[var(--ink-2)]">
              <span className="font-semibold text-white">
                {completion.overall_done}
              </span>{' '}
              of {completion.overall_total} scheduled tasks.
            </p>
            <p className="mt-2 text-sm text-[var(--ink-2)]">
              <Clock className="mr-1 inline size-3.5 -translate-y-px" />
              {minutesToHM(time_breakdown.total_completed_minutes)} of{' '}
              {minutesToHM(time_breakdown.total_scheduled_minutes)} planned time.
            </p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-1 p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-orange-400">
            <Flame className="size-5" />
            <span className="text-3xl font-semibold text-white">
              {bestCurrent.current_streak}
            </span>
            <span className="text-sm text-[var(--ink-3)]">day streak</span>
          </div>
          <p className="text-xs text-[var(--ink-3)]">
            {bestCurrent.current_streak > 0
              ? `Keep ${bestCurrent.category} going`
              : 'No active streak — start one today'}
          </p>
          <p className="mt-2 text-xs text-[var(--ink-3)]">
            <Trophy className="mr-1 inline size-3.5 -translate-y-px text-amber-400" />
            Best: {bestEver.best_streak} day
            {bestEver.best_streak === 1 ? '' : 's'} ({bestEver.category})
          </p>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={CheckCircle2}
          tint="text-emerald-400 bg-emerald-500/10"
          label="Completion"
          value={`${Math.round(completion.overall_completion_rate * 100)}%`}
          sub={`${completion.overall_done}/${completion.overall_total} tasks`}
        />
        <Kpi
          icon={Clock}
          tint="text-sky-400 bg-sky-500/10"
          label="Scheduled"
          value={minutesToHM(time_breakdown.total_scheduled_minutes)}
          sub={`${minutesToHM(time_breakdown.total_completed_minutes)} done`}
        />
        <Kpi
          icon={Flame}
          tint="text-orange-400 bg-orange-500/10"
          label="Current streak"
          value={`${bestCurrent.current_streak}d`}
          sub={bestCurrent.current_streak > 0 ? bestCurrent.category : 'none'}
        />
        <Kpi
          icon={Trophy}
          tint="text-amber-400 bg-amber-500/10"
          label="Best streak"
          value={`${bestEver.best_streak}d`}
          sub={bestEver.best_streak > 0 ? bestEver.category : '—'}
        />
      </div>

      {/* insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader
            title="Insights"
            subtitle={focused ? 'For the selected category' : 'From your recent activity'}
          />
          <CardBody className="grid gap-2.5 sm:grid-cols-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md',
                    ins.tone,
                  )}
                >
                  <ins.icon className="size-3.5" />
                </span>
                <p className="text-slate-300">{ins.text}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* trend */}
      <Card>
        <CardHeader
          title="Completion trend"
          subtitle={`Done vs. planned, per ${completion.granularity}`}
        />
        <CardBody>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: 4, right: 10, top: 4 }}>
                <defs>
                  <linearGradient id="g-rate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  {...AXIS}
                  tick={TICK}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  {...AXIS}
                  tick={TICK}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  width={38}
                />
                <Tooltip
                  content={<ChartTip kind="rate" />}
                  cursor={{ stroke: '#334155' }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#g-rate)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#818cf8' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* category share */}
        <Card>
          <CardHeader title="Time by category" subtitle="Share of scheduled minutes" />
          <CardBody>
            {donut.length === 0 ? (
              <Empty>No timed tasks in this range.</Empty>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                        stroke="var(--surface-1)"
                        strokeWidth={2}
                      >
                        {donut.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip kind="time" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {donut.map((d) => (
                    <li
                      key={d.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2 text-slate-300">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.name}
                      </span>
                      <span className="tabular-nums text-[var(--ink-3)]">
                        {minutesToHM(d.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {/* weekday rhythm */}
        <Card>
          <CardHeader title="Weekly rhythm" subtitle="Avg completion by weekday" />
          <CardBody>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekday} margin={{ left: 4, right: 8, top: 4 }}>
                  <XAxis dataKey="day" {...AXIS} tick={TICK} />
                  <YAxis
                    {...AXIS}
                    tick={TICK}
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    tickFormatter={(v) => `${v}%`}
                    width={34}
                  />
                  <Tooltip
                    content={<ChartTip kind="weekday" />}
                    cursor={{ fill: '#1e253688' }}
                  />
                  <Bar dataKey="rate" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* time bars */}
      <Card>
        <CardHeader title="Scheduled time" subtitle="Per category, this range" />
        <CardBody>
          {timeData.length === 0 ? (
            <Empty>No timed tasks in this range.</Empty>
          ) : (
            <div style={{ height: timeData.length * 40 + 12 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timeData}
                  layout="vertical"
                  margin={{ left: 8, right: 20 }}
                >
                  <XAxis
                    type="number"
                    {...AXIS}
                    tick={TICK}
                    tickFormatter={(v) => `${Math.round(v / 60)}h`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    {...AXIS}
                    tick={TICK}
                    width={92}
                  />
                  <Tooltip
                    content={<ChartTip kind="time" />}
                    cursor={{ fill: '#1e253688' }}
                  />
                  <Bar dataKey="minutes" radius={[0, 5, 5, 0]} maxBarSize={22}>
                    {timeData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* activity + streak list */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Activity" subtitle="Completion rate per day, last 13 weeks" />
          <CardBody>
            {heat ? <Heatmap data={heat} /> : <Skeleton className="h-28 w-full" />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Streaks" subtitle="Current vs. best, by category" />
          <CardBody className="space-y-3">
            {shownStreaks.map((s) => {
              const c = categoryStyle(s.category, '#64748b').color
              const pct = s.best_streak
                ? (s.current_streak / s.best_streak) * 100
                : 0
              return (
                <div key={s.category_id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                      {s.category}
                    </span>
                    <span className="tabular-nums text-[var(--ink-3)]">
                      {s.current_streak} / {s.best_streak}d
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: c }}
                    />
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Heatmap({ data }: { data: CompletionStats }) {
  const today = todayISO()
  const byDate = new Map(data.buckets.map((b) => [b.period_start, b]))
  const start = addDays(data.date_from, -mondayIndex(data.date_from))
  const weeks: { date: string; rate: number; total: number; future: boolean }[][] =
    []
  let cur = start
  for (let w = 0; w < 14; w++) {
    const col: (typeof weeks)[number] = []
    for (let d = 0; d < 7; d++) {
      const b = byDate.get(cur)
      col.push({
        date: cur,
        rate: b?.completion_rate ?? 0,
        total: b?.total ?? 0,
        future: cur > today,
      })
      cur = addDays(cur, 1)
    }
    weeks.push(col)
  }
  const level = (rate: number, total: number) => {
    if (total === 0) return 'bg-white/[0.04]'
    if (rate >= 0.99) return 'bg-emerald-400'
    if (rate >= 0.66) return 'bg-emerald-500/80'
    if (rate >= 0.33) return 'bg-emerald-600/60'
    return 'bg-emerald-700/40'
  }
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[280px] gap-1">
        {weeks.map((col, i) => (
          <div key={i} className="flex flex-1 flex-col gap-1">
            {col.map((cell) => (
              <div
                key={cell.date}
                title={
                  cell.future
                    ? cell.date
                    : `${cell.date} · ${cell.total ? `${Math.round(cell.rate * 100)}% (${cell.total})` : 'no tasks'}`
                }
                className={`aspect-square w-full rounded-[3px] ${
                  cell.future ? 'bg-transparent' : level(cell.rate, cell.total)
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--ink-3)]">
        Less
        <span className="size-3 rounded-[3px] bg-white/[0.04]" />
        <span className="size-3 rounded-[3px] bg-emerald-700/40" />
        <span className="size-3 rounded-[3px] bg-emerald-600/60" />
        <span className="size-3 rounded-[3px] bg-emerald-500/80" />
        <span className="size-3 rounded-[3px] bg-emerald-400" />
        More
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: LucideIcon
  tint: string
  label: string
  value: string
  sub: string
}) {
  return (
    <Card className="flex flex-col items-center p-4 text-center">
      <div className={`flex size-8 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--ink-3)]">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="max-w-full truncate text-xs text-[var(--ink-3)]">{sub}</p>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-[var(--ink-3)]">{children}</p>
  )
}

interface TipProps {
  active?: boolean
  payload?: Array<{ payload: Record<string, unknown> }>
  kind: 'rate' | 'time' | 'weekday'
}
function ChartTip({ active, payload, kind }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as Record<string, number & string>
  return (
    <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-slate-100">{p.label ?? p.name ?? p.day}</p>
      {kind === 'rate' && (
        <p className="mt-0.5 text-[var(--ink-3)]">
          {p.rate}% · {p.done}/{p.total} done
        </p>
      )}
      {kind === 'time' && (
        <p className="mt-0.5 text-[var(--ink-3)]">
          {minutesToHM(p.value ?? p.minutes)} scheduled
          {p.completed != null ? ` · ${minutesToHM(p.completed)} done` : ''}
        </p>
      )}
      {kind === 'weekday' && (
        <p className="mt-0.5 text-[var(--ink-3)]">{p.rate}% avg completion</p>
      )}
    </div>
  )
}

interface Insight {
  icon: LucideIcon
  tone: string
  text: string
}

function buildInsights(
  completion: CompletionStats,
  timeData: { name: string; minutes: number; completed: number }[],
  weekday: { day: string; rate: number }[],
  streaks: { category: string; current_streak: number; best_streak: number }[],
): Insight[] {
  const out: Insight[] = []

  // trend: first half vs second half
  const active = completion.buckets.filter((b) => b.total > 0)
  if (active.length >= 4) {
    const mid = Math.floor(active.length / 2)
    const avg = (arr: typeof active) =>
      arr.reduce((s, b) => s + b.completion_rate, 0) / arr.length
    const delta = Math.round((avg(active.slice(mid)) - avg(active.slice(0, mid))) * 100)
    if (delta >= 4)
      out.push({
        icon: TrendingUp,
        tone: 'bg-emerald-500/10 text-emerald-400',
        text: `Completion is trending up — about ${delta} points higher than the start of this range.`,
      })
    else if (delta <= -4)
      out.push({
        icon: TrendingDown,
        tone: 'bg-rose-500/10 text-rose-400',
        text: `Completion has dipped ${Math.abs(delta)} points versus the start of this range.`,
      })
    else
      out.push({
        icon: Minus,
        tone: 'bg-slate-500/10 text-slate-400',
        text: `Completion has held steady around ${Math.round(
          completion.overall_completion_rate * 100,
        )}%.`,
      })
  }

  // best weekday
  const bw = [...weekday].sort((a, b) => b.rate - a.rate)[0]
  if (bw && bw.rate > 0)
    out.push({
      icon: Lightbulb,
      tone: 'bg-amber-500/10 text-amber-400',
      text: `You're most consistent on ${bw.day} (${bw.rate}% completion).`,
    })

  // biggest time sink
  if (timeData[0])
    out.push({
      icon: Clock,
      tone: 'bg-sky-500/10 text-sky-400',
      text: `Most of your scheduled time goes to ${timeData[0].name} (${minutesToHM(
        timeData[0].minutes,
      )}).`,
    })

  // streak
  const cur = [...streaks].sort((a, b) => b.current_streak - a.current_streak)[0]
  if (cur && cur.current_streak > 0)
    out.push({
      icon: Flame,
      tone: 'bg-orange-500/10 text-orange-400',
      text: `${cur.category} is on a ${cur.current_streak}-day streak — don't break the chain.`,
    })

  // follow-through on planned time
  const laggard = timeData
    .filter((d) => d.minutes >= 60)
    .map((d) => ({ ...d, ratio: d.completed / d.minutes }))
    .sort((a, b) => a.ratio - b.ratio)[0]
  if (laggard && laggard.ratio < 0.5)
    out.push({
      icon: CheckCircle2,
      tone: 'bg-rose-500/10 text-rose-400',
      text: `Only ${Math.round(laggard.ratio * 100)}% of planned ${laggard.name} time got done.`,
    })

  return out.slice(0, 4)
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-xl lg:col-span-2" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
