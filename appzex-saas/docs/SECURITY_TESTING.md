# Security testing

This document explains how tenant isolation and authorization are verified, both automatically and by hand.

## How to run

```bash
docker compose -f docker/docker-compose.yml up -d mysql   # from appzex-saas/
cd backend
npm test
```

- The tests call the **real Express app over HTTP** (Supertest) against a **real MySQL database**. Nothing is mocked except the OpenAI provider.
- Before the run, `tests/setup/globalSetup.ts` runs `prisma migrate deploy` (non-destructive) and loads the demo seed into the dedicated `appzex_test` database.
- `tests/setup/testEnv.ts` refuses to run if `DATABASE_URL` does not point to a database whose name contains `test`. Test configuration comes from `.env.test`, falling back to the committed `.env.test.example`. `TEST_DATABASE_URL` can override the database (used in CI).
- Files run serially because they share one seeded database.
- CI (`.github/workflows/ci.yml` at the repository root) runs the same suite against a MySQL service container.

Latest local run: **8 files, 65 tests, all passing.**

## Required cases (`tests/security.test.ts`)

| # | Test | Setup | Assertion |
|---|---|---|---|
| 1 | Agency A accesses Agency B project | BrightWave admin → `GET /api/projects/<NorthStar "Brand Identity">` | 403/404 (returns 404); body contains no project data |
| 2 | Agency A accesses Agency B task | `GET /api/tasks/<NorthStar task>` and `/comments` | 403/404 (404) |
| 3 | Agency A modifies Agency B project | `PATCH` (rename, complete) and `DELETE` | 403/404 (404); the row in MySQL is unchanged and not soft-deleted |
| 4 | Client 1 accesses Client 2 project | Acme client → Umbrella project (same agency) and Globex project (other agency) via `/api/portal/projects/:id` | 403/404 (404) |
| 5 | Client accesses internal agency API | Acme client → 9 agency endpoints (`/dashboard`, `/projects`, `/clients`, `/tasks`, `/team`, `/activity`, `/files`, …) and `POST /clients` | 403 on every call |
| 6 | Client downloads another client's file | Acme client → Umbrella PDF (same agency) and Globex PDF (other agency) via `GET /api/files/:id` | 403/404 (404); no `Content-Disposition` header |
| 7 | Agency user accesses Super Admin endpoint | Agency admin, agency member and client → `/api/super-admin/dashboard`, `/agencies`, `PATCH …/status` | 403 |
| 8 | Suspended agency calls API | A token issued for a Pixel Harbor (suspended) admin and for its client user | 403 `"Your agency account is currently suspended. Please contact support."`; login also returns 403 |
| 9 | Unauthenticated access | No cookie on `/auth/me`, `/projects`, `/dashboard`, `/portal/dashboard`, `/super-admin/dashboard`; plus a tampered token | 401 |
| 10 | Wrong password | Valid email with a wrong password; an unknown email | 401 with the same message, and no cookie set |

## Additional coverage

| File | What it proves |
|---|---|
| `auth.test.ts` | HttpOnly + SameSite cookie; no password hash in responses; bcrypt hashes in the DB; role → home mapping; **logout revokes the token** (a replayed cookie gets 401); 422 field errors; CSRF header required; disallowed `Origin` rejected; a deactivated user is blocked mid-session; JSON 404s |
| `tenantIsolation.test.ts` | Lists (projects, clients, tasks, team, activity, files, meetings, feedback) contain no other-tenant data; a `clientId` filter pointing at another tenant returns nothing; cross-tenant reads of clients, milestones, meetings, feedback, files and activity; **13 cross-tenant write attempts** (create task/milestone/meeting/feedback, update/delete task, status changes, comments, file visibility/delete) with the DB verified unchanged; foreign `clientId` / `managerId` / `assigneeId` → 422; `agencyId` in a body is ignored; a milestone from another project is rejected |
| `clientPortal.test.ts` | Client sees only its own projects; the portal project response contains **no** private meetings, raw notes, internal files, internal tasks or storage keys; client-facing progress; downloads limited to shared files of own projects; no feedback on other clients' projects; full feedback loop (client submits → agency changes status and replies → client sees it), with the activity trail visible to the client |
| `superAdmin.test.ts` | Metrics match the DB; server-side search, filter and pagination; **suspension blocks existing sessions immediately** (agency user and client); super admin cannot use workspace routes without support mode; support mode reads one agency only, writes are blocked (`SUPPORT_READ_ONLY`), other tenants return 404, and start/end are audited; agency creation in one transaction |
| `files.test.ts` | Server-generated storage names, never exposed; byte-exact authorized download; other agency and client denied for internal files; visibility toggle controls client access; `.exe` rejected; **spoofed MIME** (script named `.png`) rejected by the magic-byte check; path-traversal filenames neutralized; size limit 413; cross-agency upload denied; client uploads limited to own projects; delete rights (member own only, admin any) |
| `projectWorkflow.test.ts` | Client → project with default milestones → tasks → completion; **progress derived** (0 → 25%, reopen/complete); `progress` in a request body is ignored; server-side validation (required fields, date order); member cannot create clients, manage the team or delete projects; soft delete hides the project and its tasks; client with projects cannot be deleted (409); due buckets computed on the server |
| `ai.test.ts` | Missing key → 503 with the configuration message; **another tenant's project never reaches the AI provider** (404, provider not called) for health and meeting summary; payload contains only the authorized project (no other tenants, no emails); output validation; invalid-JSON fallback; provider failure → 502 without leaking details; clients get 403 |

## Manual checks with curl

```bash
API=http://localhost:5000/api
H='-H Content-Type:application/json -H X-Requested-With:curl'

# Log in as two tenants and a client
curl -s -c bw.jar  $H -X POST $API/auth/login -d '{"email":"agencyadmin@brightwave-demo.com","password":"Demo@12345"}'
curl -s -c ns.jar  $H -X POST $API/auth/login -d '{"email":"agencyadmin@northstar-demo.com","password":"Demo@12345"}'
curl -s -c acme.jar $H -X POST $API/auth/login -d '{"email":"client@acme-demo.com","password":"Demo@12345"}'

# Take a NorthStar project id…
NS_ID=$(curl -s -b ns.jar "$API/projects?search=Brand" | node -pe "JSON.parse(require('fs').readFileSync(0)).data.items[0].id")

# …and try it as BrightWave: 404
curl -s -w ' [%{http_code}]\n' -b bw.jar $API/projects/$NS_ID
curl -s -w ' [%{http_code}]\n' -b bw.jar $H -X PATCH $API/projects/$NS_ID -d '{"name":"hacked"}'
curl -s -w ' [%{http_code}]\n' -b bw.jar $H -X POST $API/ai/project-health -d "{\"projectId\":\"$NS_ID\"}"

# Client on internal APIs: 403; on another tenant's project: 404
curl -s -w ' [%{http_code}]\n' -b acme.jar $API/projects
curl -s -w ' [%{http_code}]\n' -b acme.jar $API/portal/projects/$NS_ID

# Agency on super admin: 403 · no cookie: 401 · no CSRF header: 403
curl -s -w ' [%{http_code}]\n' -b bw.jar $API/super-admin/dashboard
curl -s -w ' [%{http_code}]\n' $API/projects
curl -s -w ' [%{http_code}]\n' -H Content-Type:application/json -X POST $API/auth/login -d '{}'

# Suspended agency login: 403 with the suspension message
curl -s -w ' [%{http_code}]\n' $H -X POST $API/auth/login -d '{"email":"agencyadmin@pixelharbor-demo.com","password":"Demo@12345"}'
```

## Threats considered

| Threat | Mitigation |
|---|---|
| IDOR / cross-tenant access | Every lookup uses tenant scope builders + `findFirst({ id, agencyId })`; 404 on mismatch |
| Trusting client-supplied tenant ids | `agencyId` always comes from the DB-backed session; foreign ids in bodies are validated |
| Client seeing internal data | Separate portal API with allow-listed selects and `clientVisible` rules |
| Stale sessions after suspension or logout | Per-request DB check of agency status, user status and `tokenVersion` |
| Token theft via XSS | HTTP-only cookie; the token is never exposed to JavaScript |
| CSRF | SameSite=Lax + required custom header + CORS allow-list + Origin check |
| Brute force | Failed-login rate limit; constant-time-ish response for unknown emails |
| Malicious uploads | Extension allow-list + magic bytes + size limit + generated names + private storage + attachment downloads with `nosniff` |
| Path traversal | Sanitized display names; storage keys restricted to `uuid.ext` |
| AI data leakage | Authorization before data collection; minimal payload; server-side key; no DB writes from AI output |
| Privileged support access | Time-boxed, read-only, audited support sessions visible to the agency |
| Information leakage in errors | Central error handler; generic 500s; Prisma and provider errors are never forwarded |
