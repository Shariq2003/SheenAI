# SheenAI — Frontend

React 19 + Vite 8 + TypeScript + Tailwind CSS v4. See the [project README](../README.md) for the feature overview and architecture.

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
├── main.tsx              # entry
├── App.tsx               # <BrowserRouter> + route table, <Toaster>
├── index.css             # @import "tailwindcss" + base styles
├── lib/
│   ├── api.ts            # fetch wrapper: JWT header, query params, ApiError, 401 -> logout
│   ├── types.ts          # TS mirrors of the backend schemas
│   ├── parseTime.ts      # natural-language time parsing for Quick Add
│   ├── useCategories.ts  # cached categories hook
│   ├── theme.ts          # category colours & icons
│   ├── format.ts         # time/date formatting helpers
│   ├── notify.ts         # toast helpers (sonner)
│   └── cn.ts             # clsx + tailwind-merge
├── auth/
│   ├── AuthContext.tsx   # <AuthProvider> + useAuth(): user, status, login, signup, logout
│   ├── RequireAuth.tsx   # guard -> redirects to /signin, remembers intended path
│   └── RedirectIfAuthed.tsx  # keeps signed-in users away from /signin & /signup
├── components/
│   ├── Layout.tsx        # nav shell (bottom tab bar on mobile, top nav on desktop)
│   ├── QuickAdd.tsx      # one-line task entry
│   ├── TaskTimeline.tsx  # time-ordered task timeline
│   ├── AuthForm.tsx      # shared sign-in / sign-up form
│   └── ui/               # Button, Card, Input, Select, Badge, Menu, Ring, Segmented,
│                         # Skeleton, Spinner, EmptyState
└── pages/
    ├── SignIn.tsx  SignUp.tsx
    ├── TaskList.tsx      # today's timeline + filters
    ├── TaskForm.tsx      # create / edit a task
    └── Dashboard.tsx     # streaks, time breakdown & completion charts (lazy-loaded)
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
