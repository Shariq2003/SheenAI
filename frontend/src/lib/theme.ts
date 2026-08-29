import {
  Briefcase,
  CircleDashed,
  CircleDot,
  CircleCheck,
  CircleX,
  Code2,
  Dumbbell,
  MoonStar,
  Rocket,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { TaskStatus } from './types'

/* Category identity — hue + icon. Hues are the data-viz reference
 * dark categorical palette in fixed order (validated on #111725).
 * Keyed by the seeded category name; unknown names fall back to the
 * color the API returns. */
export const CATEGORY_STYLE: Record<
  string,
  { color: string; icon: LucideIcon }
> = {
  Gym: { color: '#3987e5', icon: Dumbbell },
  Office: { color: '#d95926', icon: Briefcase },
  'DSA/Learning': { color: '#199e70', icon: Code2 },
  'Side Project': { color: '#c98500', icon: Rocket },
  Prayer: { color: '#d55181', icon: MoonStar },
  Other: { color: '#9085e9', icon: Sparkles },
}

export function categoryStyle(name: string, fallbackColor: string) {
  return CATEGORY_STYLE[name] ?? { color: fallbackColor, icon: Sparkles }
}

/* Status — `pending` is a neutral "no state yet", the rest use the
 * reserved status palette. Always paired with an icon + label. */
export const STATUS_META: Record<
  TaskStatus,
  {
    label: string
    icon: LucideIcon
    fg: string // text/icon color
    dot: string // tailwind bg for the dot
    chip: string // tailwind classes for a pill
    bar: string // tailwind bg for a left accent bar
  }
> = {
  pending: {
    label: 'Pending',
    icon: CircleDashed,
    fg: 'text-slate-400',
    dot: 'bg-slate-500',
    chip: 'border-slate-700 bg-slate-800/60 text-slate-300',
    bar: 'bg-slate-600',
  },
  in_progress: {
    label: 'In progress',
    icon: CircleDot,
    fg: 'text-amber-400',
    dot: 'bg-amber-400',
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    bar: 'bg-amber-400',
  },
  done: {
    label: 'Done',
    icon: CircleCheck,
    fg: 'text-emerald-400',
    dot: 'bg-emerald-400',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    bar: 'bg-emerald-400',
  },
  missed: {
    label: 'Missed',
    icon: CircleX,
    fg: 'text-rose-400',
    dot: 'bg-rose-400',
    chip: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    bar: 'bg-rose-500',
  },
}

export const STATUS_ORDER: TaskStatus[] = [
  'pending',
  'in_progress',
  'done',
  'missed',
]
