// TypeScript mirrors of the backend Pydantic schemas.

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'missed'

export const TASK_STATUSES: TaskStatus[] = [
  'pending',
  'in_progress',
  'done',
  'missed',
]

export interface User {
  id: number
  email: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface Category {
  id: number
  name: string
  color: string
  is_recurring_default: boolean
}

export interface Task {
  id: number
  category_id: number
  template_id: number | null
  title: string
  description: string | null
  status: TaskStatus
  scheduled_date: string // YYYY-MM-DD
  scheduled_start: string | null // HH:MM:SS
  scheduled_end: string | null
  completed_at: string | null
  created_at: string
  category: Category
}

export interface TaskCreate {
  category_id: number
  title: string
  description?: string | null
  status?: TaskStatus
  scheduled_date: string
  scheduled_start?: string | null
  scheduled_end?: string | null
}

export type TaskUpdate = Partial<{
  category_id: number
  title: string
  description: string | null
  status: TaskStatus
  scheduled_date: string
  scheduled_start: string | null
  scheduled_end: string | null
}>

export interface RecurringTemplate {
  id: number
  category_id: number
  title: string
  scheduled_start: string
  scheduled_end: string
  days: number[] // 0=Mon .. 6=Sun
  prayer_slot: string | null
  active: boolean
  category: Category
}

export interface RecurringTemplateCreate {
  category_id: number
  title: string
  scheduled_start: string
  scheduled_end: string
  days?: number[] | null
}

export interface TaskFilters {
  date?: string
  date_from?: string
  date_to?: string
  category_id?: number
  status?: TaskStatus
}

// --- Stats ---

export interface CategoryStreak {
  category_id: number
  category: string
  current_streak: number
  best_streak: number
  last_done_date: string | null
}

export interface StreaksStats {
  as_of: string
  by_category: CategoryStreak[]
}

export interface CategoryTime {
  category_id: number
  category: string
  color: string
  scheduled_minutes: number
  completed_minutes: number
  task_count: number
}

export interface TimeBreakdownStats {
  date_from: string
  date_to: string
  total_scheduled_minutes: number
  total_completed_minutes: number
  by_category: CategoryTime[]
}

export interface CompletionBucket {
  period_start: string
  total: number
  done: number
  missed: number
  pending: number
  in_progress: number
  completion_rate: number
}

export interface CompletionStats {
  granularity: 'day' | 'week'
  date_from: string
  date_to: string
  overall_total: number
  overall_done: number
  overall_completion_rate: number
  buckets: CompletionBucket[]
}

export interface StatsResponse {
  streaks: StreaksStats
  time_breakdown: TimeBreakdownStats
  completion: CompletionStats
}

export interface StatsParams {
  date_from?: string
  date_to?: string
  granularity?: 'day' | 'week'
  category_id?: number
}
