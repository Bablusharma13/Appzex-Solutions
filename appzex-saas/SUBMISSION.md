# Submission — AppZex Solutions, Full Stack Developer

**Project:** Multi-Tenant Agency Project Management SaaS

**Live URL:** https://appzex-demo-g5ydva9ne-bablusharma13.vercel.app

Sign in at `/login` — the page has one-click buttons for every demo account. The API is at `https://api-production-afdc2.up.railway.app` (the frontend proxies `/api/*` to it, so the session cookie is first-party).

**GitHub:** https://github.com/Bablusharma13/Appzex-Solutions

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · React Hook Form + Zod · Recharts · Node.js 22 · Express 5 · Prisma 6 · MySQL 8.4 · JWT (HTTP-only cookie) · bcrypt · OpenAI API · Docker · Vitest + Supertest

Setup, architecture and design details are in [README.md](README.md). Test details are in [docs/SECURITY_TESTING.md](docs/SECURITY_TESTING.md).

---

## Demo credentials

Password for **all** accounts: **`Demo@12345`** (the login page also has one-click demo buttons)

| Role | Email |
|---|---|
| Super Admin | superadmin@appzex-demo.com |
| Agency Admin — BrightWave Digital | agencyadmin@brightwave-demo.com |
| Agency Member — BrightWave Digital | team@brightwave-demo.com |
| Client — Acme Corporation (BrightWave) | client@acme-demo.com |
| Client — Umbrella Health (BrightWave) | client@umbrella-demo.com |
| Agency Admin — NorthStar Creative | agencyadmin@northstar-demo.com |
| Agency Member — NorthStar Creative | team@northstar-demo.com |
| Client — Globex Industries (NorthStar) | client@globex-demo.com |
| Agency Admin — Pixel Harbor Studio (**suspended**) | agencyadmin@pixelharbor-demo.com |

## What to try

1. **Super Admin:** dashboard → Agencies (search, filter, sort) → BrightWave → *Enter workspace*. This is a read-only, audited support session with a persistent banner. Then *Exit Support Mode*, and try suspending or activating an agency.
2. **Agency Admin (BrightWave):** create a client → create a project (with standard milestones) → add tasks → tick a task and watch the derived progress change → record a meeting → open *Website Redesign* → *Generate AI insights*.
3. **Client (Acme):** only Acme's projects and only items the agency shared → submit feedback.
4. **Agency Admin:** Feedback inbox → change the status → reply. The client sees both.
5. **Isolation:** put any other tenant's id into a URL or API call. The API returns 404 (403 for role violations).

## Security approach

- **Tenant isolation on the server.** `agencyId` / `clientId` come from the authenticated session, which is rebuilt from the database on every request. Every query goes through shared tenant scope builders, and every id lookup is `findFirst({ id, agencyId })` (404 when outside the tenant). Foreign ids in request bodies are verified.
- **Client isolation.** A dedicated `/api/portal` API scoped to the client's own company, returning only client-visible data through allow-listed fields.
- **Auth:** bcrypt (cost 12), a minimal JWT in an HTTP-only SameSite cookie, `tokenVersion` revocation on logout, and suspension enforced at login **and** on every request.
- **RBAC:** `requireSuperAdmin`, `requireAgencyAccess`, `requireAgencyAdmin` and `requireClientAccess` on the backend. Frontend guards are for UX only.
- **Hardening:** CSRF header + origin check, helmet, strict CORS, rate limits (failed logins, API, AI), Zod validation on all inputs, and sanitized centralized errors.
- **Files:** private storage, server-generated names, extension + magic-byte validation, a size limit, and role-aware authorized streaming.
- **Tests:** 65 integration tests against real MySQL, including the 10 required security cases.

## AI implementation

- **AI Project Health Assistant** (primary). The backend first computes deterministic metrics from the database (completion, overdue tasks and milestones, deadline distance, pending feedback, unassigned work) and a rule-based health level. It then sends **only those facts** for the one authorized project to OpenAI in JSON mode. The Zod-validated result (health, summary, risks, overdue work, recommended actions, client update) is shown for review and never written to project data.
- **AI Meeting Summary** (secondary). It turns raw notes into an editable summary, decisions, deadlines and action items, which can be converted into tasks.
- **Failure handling:** a clear "AI service is not configured. Add OPENAI_API_KEY…" message; "Unable to generate AI insights right now. Please try again." with Retry; a readable fallback when the model output is invalid; the "Analyzing project…" loading state; per-user rate limiting. The key is server-only, and `OPENAI_MODEL` is configurable.

## Deployment

| Piece | Host |
|---|---|
| Frontend | Vercel — https://appzex-demo-g5ydva9ne-bablusharma13.vercel.app |
| API | Railway — https://api-production-afdc2.up.railway.app |
| Database | Railway MySQL 8.4 plugin (private networking, persistent volume) |
| Uploads | Railway volume mounted at `/app/uploads` |

The frontend sets `NEXT_PUBLIC_API_URL=/api` and `BACKEND_URL=https://api-production-afdc2.up.railway.app`. `next.config.ts` rewrites `/api/*` to the API, so the browser only ever talks to its own origin and the `SameSite=Lax` session cookie is **first-party** — no third-party-cookie blocking, and no cross-site cookie configuration needed.

Production variables on the API: `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `TRUST_PROXY=1`, `CORS_ORIGIN=<the Vercel URL>`, `SEED_ON_START=true`, `MAX_UPLOAD_MB=4`.

Two deployment-specific notes:

- **`MAX_UPLOAD_MB` is 4 MB, not the 10 MB default.** The frontend proxies uploads through Vercel, and a Vercel function rejects request bodies above 4.5 MB. The app's own limit is therefore lowered to stay under that ceiling. The limit is configuration, not a code change — set `MAX_UPLOAD_MB=10` once the frontend is hosted somewhere without the function body cap.
- **The upload volume is owned by `root` on a fresh Railway volume, while the image runs as the unprivileged `node` user.** The volume was chowned to `node:node` once (`chown -R node:node /app/uploads`). If the volume is ever recreated, that must be repeated or `RAILWAY_RUN_UID=0` set — otherwise uploads fail with a permissions error.

Verified on the live deployment after the build: health endpoint, login for all four roles, Super Admin platform metrics, client portal scoping, cross-tenant reads and writes returning 404, role violations returning 403, suspended-agency login blocked, file upload → download → delete round-trip, and the AI "not configured" path.

## Shortcuts taken (12–15 hour scope)

- Admins set temporary passwords for new users. There are no email invitations or password resets.
- One agency per user.
- Files are stored on local disk behind a `StorageProvider` interface (S3 is a drop-in replacement, but not implemented yet). In this deployment the upload directory is a persistent Railway volume, so files survive restarts.
- Support mode is read-only instead of full impersonation.
- AI reports are generated on demand and not stored.
- In-memory rate limiting (single instance).
- UI components are written directly in the shadcn/ui style instead of generated by the shadcn CLI.
- No billing, real-time updates, drag-and-drop boards or SSO. These were cut on purpose to prioritise security and core workflows.

## Known limitations

See [README → Known limitations](README.md#known-limitations). The main ones: uploads rely on a local disk (persistent here via a Railway volume) and would need S3-style storage to scale horizontally; rate limits are per instance; logout revokes all of the user's sessions; client-visible activity entries stay visible after an item is made internal (the item itself becomes inaccessible); route guards on the frontend are client-side (the API is the real gate).

## Future improvements

Composite foreign keys (or PostgreSQL RLS) for database-level tenant integrity · S3 storage with signed URLs and virus scanning · notifications fanned out from the activity log · email invitations, password reset, MFA · per-project roles · persisted AI reports and portfolio insights · Redis-backed rate limiting and jobs · Playwright E2E in CI · billing.
