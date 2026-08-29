# Manual backend walkthrough (curl)

Prefer `python scripts/smoke_test.py` — it asserts and cleans up. This is the
copy-paste version for poking at things by hand.

Start the server first:

```bash
cd backend
uvicorn app.main:app --port 8000
```

`BASE=http://localhost:8000`. Examples use `jq` for readability (optional).

---

## 1. Health

```bash
curl -s $BASE/health | jq
curl -s $BASE/health/db | jq          # {"status":"ok","database":"connected"}
```

## 2. Sign up (returns a token immediately)

```bash
curl -s -X POST $BASE/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"secret12345"}' | jq

# grab the token into a var:
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"secret12345"}' | jq -r .access_token)
AUTH="Authorization: Bearer $TOKEN"
```

## 3. Who am I

```bash
curl -s $BASE/auth/me -H "$AUTH" | jq
```

## 4. Categories (for the task form)

```bash
curl -s $BASE/categories -H "$AUTH" | jq
```

## 5. Today's tasks

Signing up / the first request of the day auto-creates today's recurring tasks
(Gym, 5 prayers, Office on weekdays).

```bash
curl -s $BASE/tasks -H "$AUTH" | jq '.[] | {id, title, category: .category.name, status, scheduled_start}'
```

Filters (combine freely):

```bash
curl -s "$BASE/tasks?date=2026-08-29"        -H "$AUTH" | jq length
curl -s "$BASE/tasks?status=pending"         -H "$AUTH" | jq length
curl -s "$BASE/tasks?category_id=5"          -H "$AUTH" | jq length
curl -s "$BASE/tasks?date_from=2026-08-01&date_to=2026-08-31" -H "$AUTH" | jq length
```

## 6. Create a manual task

```bash
TASK_ID=$(curl -s -X POST $BASE/tasks -H "$AUTH" -H 'content-type: application/json' -d '{
  "category_id": 3,
  "title": "LeetCode: graphs",
  "description": "3 problems",
  "scheduled_date": "2026-08-29",
  "scheduled_start": "21:00:00",
  "scheduled_end": "22:30:00"
}' | jq -r .id)
echo "created task $TASK_ID"
```

## 7. Mark it done / edit it

```bash
curl -s -X PATCH $BASE/tasks/$TASK_ID -H "$AUTH" -H 'content-type: application/json' \
  -d '{"status":"done"}' | jq '{id, status, completed_at}'

curl -s -X PATCH $BASE/tasks/$TASK_ID -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"LeetCode: graphs (revised)","status":"pending"}' | jq
```

## 8. Delete it

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $BASE/tasks/$TASK_ID -H "$AUTH"   # 204
```

## 9. Stats — one combined call

The dashboard uses only this. `date_from` / `date_to` default to the last 30
days; `granularity` is `day` (default) or `week`.

```bash
curl -s $BASE/stats -H "$AUTH" | jq '{
  streaks: [.streaks.by_category[] | {category, current_streak, best_streak}],
  time_totals: {scheduled: .time_breakdown.total_scheduled_minutes, completed: .time_breakdown.total_completed_minutes},
  completion: {done: .completion.overall_done, total: .completion.overall_total, rate: .completion.overall_completion_rate}
}'

curl -s "$BASE/stats?granularity=week" -H "$AUTH" | jq '.completion.buckets'
curl -s "$BASE/stats?date_from=2026-08-01&date_to=2026-08-29" -H "$AUTH" | jq '.completion.overall_total'
```

Debug-only individual endpoints (same data, split up):

```bash
curl -s $BASE/stats/streaks         -H "$AUTH" | jq
curl -s $BASE/stats/time-breakdown  -H "$AUTH" | jq
curl -s $BASE/stats/completion      -H "$AUTH" | jq
```
