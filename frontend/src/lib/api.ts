// Thin fetch wrapper around the SheenAI backend.
//
// - attaches the stored JWT as `Authorization: Bearer <token>`
// - serializes query params and JSON bodies
// - throws `ApiError` (with status + parsed detail) on non-2xx
// - on 401, clears the token and emits `auth:unauthorized` so the auth
//   context can drop the session

import type {
  Category,
  RecurringTemplate,
  RecurringTemplateCreate,
  StatsParams,
  StatsResponse,
  Task,
  TaskCreate,
  TaskFilters,
  TaskUpdate,
  TokenResponse,
  User,
} from './types'

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
).replace(/\/$/, '')

const TOKEN_KEY = 'sheenai.token'

let authToken: string | null = readStoredToken()

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  return authToken
}

export function setAuthToken(token: string | null): void {
  authToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — keep the in-memory token */
  }
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown, fallback: string) {
    super(pickMessage(detail, fallback))
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function pickMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'detail' in detail) {
    const d = (detail as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length > 0) {
      // FastAPI validation error list
      const first = d[0] as { msg?: string; loc?: unknown[] }
      if (first?.msg) {
        const loc = Array.isArray(first.loc) ? first.loc.slice(1).join('.') : ''
        return loc ? `${loc}: ${first.msg}` : first.msg
      }
    }
  }
  return fallback
}

interface RequestOptions {
  method?: string
  body?: unknown
  params?: Record<string, string | number | undefined>
  auth?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, auth = true } = opts

  const url = new URL(BASE_URL + path)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && authToken) headers['Authorization'] = `Bearer ${authToken}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, null, 'Network error — is the backend running?')
  }

  if (res.status === 401) {
    setAuthToken(null)
    window.dispatchEvent(new Event('auth:unauthorized'))
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? safeJsonParse(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, data ?? text, `Request failed (${res.status})`)
  }
  return data as T
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const api = {
  // auth
  signup: (email: string, password: string) =>
    request<TokenResponse>('/auth/signup', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  login: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  me: () => request<User>('/auth/me'),

  // categories
  getCategories: () => request<Category[]>('/categories'),

  // tasks
  getTasks: (filters: TaskFilters = {}) =>
    request<Task[]>('/tasks', { params: { ...filters } }),
  getTask: (id: number) => request<Task>(`/tasks/${id}`),
  createTask: (payload: TaskCreate) =>
    request<Task>('/tasks', { method: 'POST', body: payload }),
  updateTask: (id: number, payload: TaskUpdate) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: payload }),
  deleteTask: (id: number) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  // recurring templates
  getRecurringTemplates: () =>
    request<RecurringTemplate[]>('/recurring-templates'),
  createRecurringTemplate: (payload: RecurringTemplateCreate) =>
    request<RecurringTemplate>('/recurring-templates', {
      method: 'POST',
      body: payload,
    }),

  // stats — single combined endpoint
  getStats: (params: StatsParams = {}) =>
    request<StatsResponse>('/stats', { params: { ...params } }),
}
