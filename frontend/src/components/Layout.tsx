import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Tasks', icon: ListTodo, end: true },
  { to: '/tasks/new', label: 'Add', icon: Plus },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    logout()
    navigate('/signin', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/40">
                <CalendarCheck className="size-4" />
              </span>
              <span className="text-base font-semibold tracking-tight text-white">
                SheenAI
              </span>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[var(--surface-2)] text-white'
                        : 'text-slate-400 hover:bg-[var(--surface-1)] hover:text-white',
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden max-w-[12rem] truncate text-sm text-[var(--ink-3)] md:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:bg-[var(--surface-2)] hover:text-white"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--border)] bg-[var(--bg)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-indigo-400' : 'text-slate-500',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
