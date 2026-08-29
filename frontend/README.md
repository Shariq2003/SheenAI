# SheenAI — Frontend

React 19 + Vite 8 + TypeScript + Tailwind CSS v4. See `../PLAN.md` for the spec.

**Dark theme globally, mobile-first responsive** — the app is used from a phone,
so every screen stacks on narrow viewports (tables become card lists) and
navigation is a fixed bottom tab bar below `sm`, a top nav above it.

**Libraries**: `recharts` (dashboard charts), `sonner` (toasts — `<Toaster>` in
`App.tsx`, helpers in `lib/notify.ts`), `lucide-react` (icons), `clsx` +
`tailwind-merge` (`lib/cn.ts`). Shared UI primitives live in
`src/components/ui/` (Button, Card, Select, Input/Textarea/Field, StatusBadge,
CategoryChip, Skeleton, Spinner/FullPageLoader, EmptyState). Every data screen
shows a skeleton while loading and toasts on mutation success/failure. The
`/dashboard` route is `React.lazy`-loaded so recharts stays out of the initial
bundle.

## Run

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL, defaults to http://localhost:8000
npm run dev                   # http://localhost:5173
```

The backend must be running (see `../backend/README.md`). CORS on the backend
already allows `localhost:5173`.

## Scripts

| command          | what                              |
|------------------|-----------------------------------|
| `npm run dev`    | dev server with HMR               |
| `npm run build`  | `tsc -b` then `vite build` → `dist/` |
| `npm run preview`| serve the built `dist/`           |
| `npm run lint`   | oxlint                            |

## Layout

```
src/
├── main.tsx            # entry
├── App.tsx             # <BrowserRouter> + route table
├── index.css           # @import "tailwindcss" + base styles
├── lib/
│   ├── api.ts          # fetch wrapper: JWT header, query params, ApiError, 401 -> logout
│   └── types.ts        # TS mirrors of the backend schemas
├── auth/
│   ├── AuthContext.tsx # <AuthProvider> + useAuth(): user, status, login, signup, logout
│   └── RequireAuth.tsx # route guard -> redirects to /signin, remembers intended path
├── components/
│   ├── Layout.tsx      # nav shell for authed pages
│   └── AuthForm.tsx    # shared sign-in / sign-up form
└── pages/
    ├── SignIn.tsx  SignUp.tsx      # functional
    ├── TaskList.tsx                # live data, minimal — real table in step 9b
    ├── TaskForm.tsx                # stub — step 9c
    └── Dashboard.tsx               # live /stats headline numbers — charts in step 9d
```

## Routes

| path               | screen        | guard |
|--------------------|---------------|-------|
| `/signin`          | Sign in       | public |
| `/signup`          | Sign up       | public |
| `/`                | Task list     | auth  |
| `/tasks/new`       | Add task      | auth  |
| `/tasks/:id/edit`  | Edit task     | auth  |
| `/dashboard`       | Dashboard     | auth  |

## Auth flow

The JWT is stored in `localStorage` under `sheenai.token` and attached as
`Authorization: Bearer …` by `api.ts`. On load, `AuthProvider` validates a
stored token via `GET /auth/me`. Any `401` from the API clears the token and
drops the session (redirecting to `/signin`).
