"""End-to-end backend smoke test.

Walks the full flow against a RUNNING server: signup -> login -> me ->
categories -> recurring tasks auto-generated for today -> create / update /
filter / delete a manual task -> combined stats. Prints a line per step and
exits non-zero if any check fails.

Usage (from the backend/ directory, with the server already running):

    uvicorn app.main:app --port 8000          # in another terminal
    python scripts/smoke_test.py                       # hits http://localhost:8000
    python scripts/smoke_test.py --base-url http://localhost:8010
    python scripts/smoke_test.py --keep                # don't delete the test user

Each run uses a fresh unique email. Cleanup deletes that test user directly
via the database (needs the same .env / DATABASE_URL the server uses); pass
--keep to skip cleanup.
"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

import httpx

# make "app" importable when run as `python scripts/smoke_test.py`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_COLOR = sys.stdout.isatty()
PASS = "\033[32mPASS\033[0m" if _COLOR else "PASS"
FAIL = "\033[31mFAIL\033[0m" if _COLOR else "FAIL"
_failures = 0


def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text


def check(label: str, cond: bool, detail: str = "") -> None:
    global _failures
    if not cond:
        _failures += 1
    print(f"  {PASS if cond else FAIL}  {label}" + (f"  - {detail}" if detail else ""))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--keep", action="store_true", help="don't delete the test user")
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    # example.com is reserved-but-accepted by the email validator; .test is not.
    email = f"smoke_{uuid.uuid4().hex[:10]}@example.com"
    password = "smoke-Test-123!"
    c = httpx.Client(base_url=base, timeout=30)
    print(f"Base URL: {base}")
    print(f"Test user: {email}\n")

    # 1. health -------------------------------------------------------------
    print("health")
    r = c.get("/health")
    check("GET /health -> 200 ok", r.status_code == 200 and r.json().get("status") == "ok")
    r = c.get("/health/db")
    check("GET /health/db -> 200 connected", r.status_code == 200,
          f"{r.status_code} {r.text[:120]}")

    # 2. signup / login / me ------------------------------------------------
    print("\nauth")
    r = c.post("/auth/signup", json={"email": email, "password": password})
    check("POST /auth/signup -> 201", r.status_code == 201, r.text[:160])
    if r.status_code != 201:
        return _finish(c, base, email, args.keep)
    token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    check("signup returns token + user", bool(token) and r.json()["user"]["email"] == email)

    r = c.post("/auth/signup", json={"email": email, "password": password})
    check("duplicate signup -> 409", r.status_code == 409)

    r = c.post("/auth/login", json={"email": email, "password": password})
    check("POST /auth/login -> 200", r.status_code == 200)
    token = r.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    r = c.post("/auth/login", json={"email": email, "password": "wrong"})
    check("login wrong password -> 401", r.status_code == 401)

    r = c.get("/auth/me", headers=auth)
    check("GET /auth/me -> 200", r.status_code == 200 and r.json()["email"] == email)
    check("GET /auth/me no token -> 401", c.get("/auth/me").status_code == 401)

    # 3. categories -------------------------------------------------------
    print("\ncategories")
    r = c.get("/categories", headers=auth)
    cats = r.json() if r.status_code == 200 else []
    check("GET /categories -> 6", len(cats) == 6, ", ".join(x["name"] for x in cats))
    by_name = {x["name"]: x["id"] for x in cats}

    # 4. recurring tasks auto-generated for today -------------------------
    print("\nrecurring generation")
    r = c.get("/tasks", headers=auth)
    tasks = r.json() if r.status_code == 200 else []
    today = tasks[0]["scheduled_date"] if tasks else None
    check("GET /tasks -> today's recurring tasks exist", len(tasks) >= 6,
          f"{len(tasks)} tasks on {today}: " + ", ".join(sorted(t["title"] for t in tasks)))
    check("all generated tasks are recurring (template_id set)",
          all(t["template_id"] for t in tasks))
    check("each task carries its nested category", all(t["category"]["name"] for t in tasks))

    # 5. manual task: create / update / filter / delete ------------------
    print("\ntask CRUD")
    r = c.post("/tasks", headers=auth, json={
        "category_id": by_name["DSA/Learning"],
        "title": "Smoke: binary search drills",
        "description": "5 problems",
        "scheduled_date": today,
        "scheduled_start": "21:00:00",
        "scheduled_end": "22:00:00",
    })
    check("POST /tasks -> 201", r.status_code == 201, r.text[:160])
    task_id = r.json()["id"] if r.status_code == 201 else None
    check("created task: template_id null, status pending",
          r.status_code == 201 and r.json()["template_id"] is None
          and r.json()["status"] == "pending")

    r = c.post("/tasks", headers=auth, json={
        "category_id": 999999, "title": "bad", "scheduled_date": today})
    check("POST /tasks unknown category -> 400", r.status_code == 400)

    r = c.patch(f"/tasks/{task_id}", headers=auth, json={"status": "done"})
    check("PATCH status=done -> 200 + completed_at set",
          r.status_code == 200 and r.json()["completed_at"] is not None)

    r = c.get("/tasks", headers=auth, params={"status": "done"})
    check("GET /tasks?status=done includes it",
          any(t["id"] == task_id for t in r.json()))
    r = c.get("/tasks", headers=auth, params={"category_id": by_name["Prayer"]})
    check("GET /tasks?category_id=Prayer -> only Prayer",
          all(t["category"]["name"] == "Prayer" for t in r.json()) and len(r.json()) >= 1)
    r = c.get("/tasks", headers=auth, params={"date": "2000-01-01"})
    check("GET /tasks?date=2000-01-01 -> empty", r.json() == [])

    r = c.delete(f"/tasks/{task_id}", headers=auth)
    check("DELETE /tasks/{id} -> 204", r.status_code == 204)
    r = c.patch(f"/tasks/{task_id}", headers=auth, json={"title": "x"})
    check("PATCH deleted task -> 404", r.status_code == 404)

    # 6. combined stats -------------------------------------------------
    print("\nstats (single combined endpoint)")
    r = c.get("/stats", headers=auth)
    check("GET /stats -> 200", r.status_code == 200, r.text[:160])
    if r.status_code == 200:
        s = r.json()
        check("response has streaks + time_breakdown + completion",
              set(s) == {"streaks", "time_breakdown", "completion"})
        check("streaks cover all 6 categories",
              len(s["streaks"]["by_category"]) == 6)
        check("completion buckets are dense (default 30-day window)",
              len(s["completion"]["buckets"]) == 30)
        tb = s["time_breakdown"]
        cp = s["completion"]
        print(f"     window {cp['date_from']}..{cp['date_to']}  "
              f"completion {cp['overall_done']}/{cp['overall_total']} "
              f"({cp['overall_completion_rate']:.0%})  "
              f"scheduled {tb['total_scheduled_minutes']} min")
        for st in s["streaks"]["by_category"]:
            if st["current_streak"] or st["best_streak"]:
                print(f"     streak  {st['category']:<13} "
                      f"current={st['current_streak']} best={st['best_streak']}")

    r = c.get("/stats", headers=auth, params={"granularity": "week"})
    check("GET /stats?granularity=week -> 200",
          r.status_code == 200 and r.json()["completion"]["granularity"] == "week")
    r = c.get("/stats", headers=auth, params={"granularity": "month"})
    check("GET /stats?granularity=month -> 422", r.status_code == 422)
    check("GET /stats no token -> 401", c.get("/stats").status_code == 401)

    return _finish(c, base, email, args.keep)


def _finish(c: httpx.Client, base: str, email: str, keep: bool) -> int:
    print()
    if keep:
        print(f"--keep set: leaving test user {email} in the database.")
    else:
        try:
            import asyncio

            from sqlalchemy import text

            from app.core.database import engine

            async def _del() -> None:
                async with engine.begin() as conn:
                    await conn.execute(
                        text("DELETE FROM users WHERE email = :e"), {"e": email}
                    )
                await engine.dispose()

            asyncio.run(_del())
            print(f"Cleaned up test user {email}.")
        except Exception as exc:  # noqa: BLE001
            print(f"Cleanup skipped ({exc!r}). Delete {email} manually if needed.")

    print()
    if _failures:
        print(_c("31", f"{_failures} check(s) FAILED"))
        return 1
    print(_c("32", "All checks passed - backend looks good."))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
