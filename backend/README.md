# SheenAI — Backend

FastAPI + async SQLAlchemy + PostgreSQL. See `../PLAN.md` for the full spec.

## Layout

```
backend/
├── app/
│   ├── main.py            # FastAPI app + entrypoint
│   ├── api/
│   │   ├── router.py      # aggregates all sub-routers
│   │   └── routes/
│   │       └── health.py  # /health, /health/db
│   ├── core/
│   │   ├── config.py      # env-driven settings (pydantic-settings)
│   │   └── database.py    # async engine, session factory, get_db dependency
│   ├── models/            # ORM models: user, category, recurring_template, task
│   ├── db/seed.py         # seeds the 6 categories (idempotent)
│   └── schemas/           # Pydantic schemas  (step 3)
├── alembic/               # async migration env + versions/
├── alembic.ini            # url injected at runtime from DATABASE_URL
├── requirements.txt
└── .env.example
```

## Database

```bash
# point DATABASE_URL at your Supabase/Neon Postgres in .env, then:
alembic upgrade head          # create tables (migration 20260829_0001)
python -m app.db.seed         # insert the 6 categories
alembic check                 # confirm models == migration (optional)
```

## Local setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

copy .env.example .env         # then edit DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

## Verify it works

```bash
uvicorn app.main:app --port 8000            # terminal 1
python scripts/smoke_test.py                        # terminal 2 (from backend/)
```

Walks signup → login → categories → recurring generation → task CRUD → stats,
asserts each step, and deletes its own test user. `--base-url` to point
elsewhere, `--keep` to leave the test user. `scripts/curl_walkthrough.md` has
the same flow as copy-paste curl.

## Endpoints so far

| Method | Path         | Purpose                                  |
|--------|--------------|------------------------------------------|
| GET    | `/`             | service metadata                      |
| GET    | `/health`       | liveness (no I/O)                     |
| GET    | `/health/db`    | verifies the Postgres connection      |
| POST   | `/auth/signup`  | create account → `{access_token, user}` |
| POST   | `/auth/login`   | email + password → `{access_token, user}` |
| GET    | `/auth/me`      | current user (send `Authorization: Bearer <token>`) |
| GET    | `/categories`   | list the 6 categories                |
| GET    | `/tasks`        | list; `?date= &date_from= &date_to= &category_id= &status=` |
| POST   | `/tasks`        | create a manual task                 |
| PATCH  | `/tasks/{id}`   | partial update (e.g. `{"status":"done"}`) |
| DELETE | `/tasks/{id}`   | delete (204)                         |
| GET    | `/stats`        | **combined** streaks + time-breakdown + completion; `?date_from= &date_to= &granularity=day\|week` |
| GET    | `/stats/streaks` · `/stats/time-breakdown` · `/stats/completion` | same data individually (debug) |
| GET    | `/docs`         | Swagger UI                            |
