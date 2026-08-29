import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/auth/AuthContext'
import { RedirectIfAuthed } from '@/auth/RedirectIfAuthed'
import { RequireAuth } from '@/auth/RequireAuth'
import { Layout } from '@/components/Layout'
import { FullPageLoader } from '@/components/ui'
import { SignIn } from '@/pages/SignIn'
import { SignUp } from '@/pages/SignUp'
import { TaskForm } from '@/pages/TaskForm'
import { TaskList } from '@/pages/TaskList'

// Charts (recharts) are heavy — load the dashboard only when visited.
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<RedirectIfAuthed />}>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<TaskList />} />
              <Route path="/tasks/new" element={<TaskForm />} />
              <Route path="/tasks/:id/edit" element={<TaskForm />} />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<FullPageLoader label="Loading charts" />}>
                    <Dashboard />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>

      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: '#0f172a',
            border: '1px solid #1e293b',
            color: '#e2e8f0',
          },
        }}
      />
    </BrowserRouter>
  )
}
