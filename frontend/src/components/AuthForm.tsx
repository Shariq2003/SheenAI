import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CalendarCheck, Eye, EyeOff } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { Button, Field, Input } from '@/components/ui'
import { notifyError, toast } from '@/lib/notify'

interface Props {
  mode: 'signin' | 'signup'
}

interface RedirectState {
  from?: { pathname: string }
}

const MIN_PASSWORD = 8

export function AuthForm({ mode }: Props) {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isSignup = mode === 'signup'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  const passwordTooShort =
    isSignup && password.length > 0 && password.length < MIN_PASSWORD
  const canSubmit =
    !busy &&
    email.trim() !== '' &&
    password !== '' &&
    (!isSignup || password.length >= MIN_PASSWORD)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      if (isSignup) {
        await signup(email.trim(), password)
        toast.success('Account created. Welcome to SheenAI!')
      } else {
        await login(email.trim(), password)
      }
      const to = (location.state as RedirectState | null)?.from?.pathname ?? '/'
      navigate(to, { replace: true })
    } catch (err) {
      notifyError(err, 'Could not sign you in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/40">
            <CalendarCheck className="size-5" />
          </span>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-white">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isSignup
              ? 'Track your routine, tasks and streaks.'
              : 'Sign in to your schedule.'}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/30"
        >
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint={isSignup ? `At least ${MIN_PASSWORD} characters.` : undefined}
            error={
              passwordTooShort
                ? `At least ${MIN_PASSWORD} characters.`
                : undefined
            }
          >
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isSignup ? MIN_PASSWORD : undefined}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </Field>

          <Button type="submit" loading={busy} disabled={!canSubmit} className="w-full">
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link
                to="/signin"
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to SheenAI?{' '}
              <Link
                to="/signup"
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
