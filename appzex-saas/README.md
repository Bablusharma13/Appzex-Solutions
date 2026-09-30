# AppZex Multi-Tenant Agency SaaS

A multi-tenant project management platform for digital agencies. Many agencies share one deployment, but every agency's data stays isolated on the server. The platform has three experiences:

| Experience | Who | Route | Look & feel |
|---|---|---|---|
| **Super Admin Portal** | Platform operator (`SUPER_ADMIN`) | `/super-admin` | Dark "Platform Console", violet accent |
| **Agency Workspace** | Agency admins and team members | `/app` | Operations-focused sidebar app, blue accent |
| **Client Portal** | The agency's clients (`CLIENT`) | `/client` | Simple top-nav portal, teal accent, read-mostly |

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Multi-tenancy strategy](#multi-tenancy-strategy)
- [Authentication & authorization](#authentication--authorization)
- [Support mode](#support-mode)
- [Database schema](#database-schema)
- [AI feature](#ai-feature)
- [File security](#file-security)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Seed data](#seed-data)
- [Demo credentials](#demo-credentials)
- [API overview](#api-overview)
- [Security test cases](#security-test-cases)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)
- [Product decisions](#product-decisions)

---

## Overview

Everything operational follows one hierarchy:

```
Super Admin
└── Agency (tenant)
    ├── Agency members (admins, team)
    └── Clients
        └── Projects
            ├── Milestones
            ├── Tasks ── Comments
            ├── Meetings
            ├── Feedback ── Comments
            ├── Files
            └── Activity log
```

Every operational row carries an `agencyId`. The backend always takes that `agencyId` from the authenticated session, never from the URL, query string or request body.

## Features

**Super Admin Portal**
- Platform dashboard with live counts: agencies (total, active, suspended), users, clients and projects, plus plan mix and recent platform activity.
- Agency list with server-side search (name, slug, email, owner), status and plan filters, sortable columns and pagination.
- Agency detail page: team, clients, projects with progress, activity and support-session history.
- Create an agency together with its first admin (one transaction).
- Suspend or activate an agency (confirmation dialog, reason recorded in the audit log). A suspension takes effect on the next request, not at token expiry.
- **Support mode**: enter an agency workspace in audited, read-only mode.

**Agency Workspace**
- Dashboard with live stats (clients, active projects, projects due in 14 days, completed projects, pending feedback, overdue tasks), charts (project progress, project status, task status), upcoming work, upcoming milestones and activity.
- Clients: create, edit, view, delete (blocked while the client still has projects), internal notes and portal-user invitations.
- Projects: create, edit, change status, soft delete, filters, sorting and pagination. Progress is derived from tasks, never typed in.
- Milestones: ordered phases with status and per-milestone task progress. Standard milestones can be added automatically.
- Tasks: assignee, priority, due date, milestone and a "client visible" flag. One-click completion updates progress. Cross-project task list with Overdue / Due today / Due this week / Completed buckets, filters and a "My tasks" toggle. Internal comments.
- Meetings: raw notes (always internal) plus a reviewed summary (optionally shared with the client). The **AI Meeting Summary** can turn action items into tasks.
- Feedback inbox: status workflow (Open → In review → In progress → Resolved / Declined) and a reply thread the client can see.
- Files: private uploads with a per-file "share with client" toggle and authorized downloads.
- **AI Project Health Assistant** on every project.
- Team management, full activity/audit timeline and agency settings.

**Client Portal**
- Overview of active projects, upcoming milestones, pending actions (tasks the agency shared with the client) and recent updates.
- Project page: progress, milestone timeline, upcoming deadlines, action items, shared meeting summaries, shared files, and feedback.
- Submit feedback and reply to the agency; share files with the agency.
- Only client-visible data is ever returned.

**Cross-cutting**
- Loading skeletons, empty states with calls to action, error states with retry, toasts, confirmation dialogs, and form validation on both frontend and backend.
- Responsive layouts: the sidebar collapses to a slide-over, tables scroll horizontally, forms become single-column and cards stack.
- Accessibility: semantic HTML, labelled controls, native selects, keyboard-reachable menus and dialogs (Radix), visible focus rings, and a skip link.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query 5, React Hook Form 7 + Zod 4, Recharts 3, Radix UI primitives (shadcn-style components), sonner, lucide-react |
| Backend | Node.js 22, Express 5, TypeScript, Prisma 6, Zod 4, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, multer 2, OpenAI SDK |
| Database | MySQL 8.4 |
| Testing | Vitest + Supertest integration tests against a real MySQL test database |
| Tooling | ESLint 9, Prettier, Docker / Docker Compose, GitHub Actions CI |

The UI components (`frontend/src/components/ui`) are written in the shadcn/ui style: Radix primitives with Tailwind classes and `class-variance-authority`. They were written directly rather than generated by the shadcn CLI.

## Architecture

```
┌──────────────────────────┐        HTTPS (JSON, cookie auth)       ┌──────────────────────────────┐
│  Next.js frontend :3000  │  ───────────────────────────────────▶  │  Express API :5000 (/api/*)  │
│  - route guards (UX)     │   credentials: include                 │  helmet · cors · rate limit  │
│  - TanStack Query        │   X-Requested-With header (CSRF)       │  csrf · authenticate         │
│  - lib/api.ts client     │                                        │  role / tenant guards        │
└──────────────────────────┘                                        │  controllers → services      │
                                                                    │  → tenant-scoped Prisma      │
                                                                    └──────┬───────────┬───────────┘
                                                                           │           │
                                                                     ┌─────▼────┐ ┌────▼──────────┐
                                                                     │  MySQL   │ │ Private file  │
                                                                     │  (Prisma)│ │ storage       │
                                                                     └──────────┘ └───────────────┘
                                                                           │ (after authorization only)
                                                                     ┌─────▼──────────┐
                                                                     │  OpenAI API    │
                                                                     └────────────────┘
```

- **Frontend and backend are separate applications**, each with its own `package.json`, build and deployment. They talk over REST.
- Backend layering: `routes` (role guards) → `controllers` (parse and validate input, send response) → `services` (business logic, transactions, activity logging) → `repositories` (tenant scopes and ownership-checked loaders) → Prisma.
- Consistent response envelope: `{ "success": true, "data": … }` or `{ "success": false, "message": "…", "code": "…", "errors": [{ "path", "message" }] }`.

## Project structure

```
appzex-saas/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # data model (tenant-scoped)
│   │   ├── migrations/              # Prisma migrations
│   │   ├── seed.ts                  # demo data (3 agencies)
│   │   └── demoFiles.ts             # generates small real PDF/PNG/CSV demo files
│   ├── src/
│   │   ├── app.ts / server.ts       # Express app + bootstrap
│   │   ├── config/                  # env validation (Zod), Prisma client
│   │   ├── middleware/              # authenticate, authorize, csrf, rateLimit, upload, errorHandler
│   │   ├── repositories/            # scopes.ts (tenant where-builders), tenantRepository.ts (find-or-404)
│   │   ├── services/                # auth, superAdmin, agency, client, project, milestone, task,
│   │   │   ├── ai/                  # meeting, feedback, file, activity, portal, progress, health
│   │   │   └── storage/             # AI provider + service; storage provider + upload validation
│   │   ├── controllers/             # thin HTTP handlers
│   │   ├── routes/                  # auth, superAdmin, workspace (agency), portal (client)
│   │   ├── validators/              # Zod schemas
│   │   ├── types/ utils/
│   ├── tests/                       # security + integration tests (Vitest + Supertest)
│   ├── Dockerfile, docker-entrypoint.sh
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   ├── super-admin/         # dashboard, agencies, agencies/[id]
│   │   │   ├── app/                 # agency workspace: dashboard, projects, clients, tasks, …
│   │   │   └── client/              # client portal: dashboard, projects, feedback, meetings, files
│   │   ├── components/ui/           # Button, Dialog, Tabs, DropdownMenu, inputs, …
│   │   ├── components/shared/       # StatCard, badges, charts, EmptyState, Pagination, FileList, …
│   │   ├── components/layout/       # shells, sidebar, support banner, role gate
│   │   ├── features/                # domain dialogs & views (projects, tasks, meetings, AI, …)
│   │   ├── hooks/                   # TanStack Query hooks (useProjects, useTasks, …)
│   │   └── lib/                     # api.ts (central client), query keys, types, utils
│   ├── Dockerfile
│   └── .env.example
├── docker/
│   ├── docker-compose.yml           # MySQL (+ optional full stack profile)
│   └── mysql/init.sql
├── docs/SECURITY_TESTING.md
├── SUBMISSION.md
└── README.md
```

## Multi-tenancy strategy

The tenant boundary is enforced **on the server, in every query**. Hiding UI elements is only a convenience.

**1. The session decides the tenant.** `authenticate` verifies the JWT and then **re-reads the user from the database** to build `req.auth` (`userId`, `role`, `agencyId`, `clientId`, `supportSession`). Controllers only ever read `agencyId` from there:

```ts
const ctx = getAgencyContext(req); // { agencyId, userId, role } — from the DB, not the request
```

**2. One set of scope builders** (`backend/src/repositories/scopes.ts`) produces every tenant `where` clause:

```ts
export const agencyProjects = (agencyId: string) => ({ agencyId, deletedAt: null });
export const clientFiles = (ctx: ClientContext) => ({
  agencyId: ctx.agencyId,
  clientVisible: true,
  project: { agencyId: ctx.agencyId, clientId: ctx.clientId, deletedAt: null },
});
```

**3. Ownership-checked loaders** (`tenantRepository.ts`) implement the required pattern: never `findUnique({ id })`, always

```ts
prisma.project.findFirst({ where: { id: projectId, agencyId: authenticatedAgencyId, deletedAt: null } })
```

If the row is missing, the API returns **404**. An id that exists in another tenant is indistinguishable from one that does not exist, so ids cannot be probed across tenants.

**4. Foreign ids in request bodies are verified.** `clientId`, `managerId`, `assigneeId`, `milestoneId`, `taskId` and `feedbackId` must belong to the caller's agency (and, where relevant, to the same project), otherwise the API returns **422** with a field error. `agencyId` sent in a body is ignored; a test proves it.

**5. Children inherit the parent's tenant.** New tasks, files, comments and so on take `agencyId` from the already-authorized parent project.

**Client isolation is stricter.** Client users only reach `/api/portal/*`. Every portal query is scoped by `agencyId` **and** the user's own `clientId`, and only returns rows the agency marked client-visible (tasks, meetings, files) plus client-visible activity. Portal responses use explicit allow-listed `select`s, so internal notes, raw meeting notes, private files, internal activity, storage keys and other clients' data are never selected at all.

**Role boundaries:**

| Route family | Allowed | Everyone else |
|---|---|---|
| `/api/super-admin/*` | `SUPER_ADMIN` | 403 |
| agency workspace (`/api/projects`, `/api/tasks`, …) | `AGENCY_ADMIN`, `AGENCY_MEMBER`, `SUPER_ADMIN` **in support mode (GET only)** | 403 |
| `/api/portal/*` | `CLIENT` | 403 |
| `GET /api/files/:id` (download) | role-aware check in the service | 403 / 404 |

## Authentication & authorization

- **Passwords** are hashed with **bcrypt** (bcryptjs, cost factor 12, configurable via `BCRYPT_ROUNDS`) and never returned. Unknown emails still run a bcrypt comparison, so response timing doesn't reveal whether an account exists, and the error message is identical.
- **JWT** (HS256, 8h default) holds only identity: `sub` (user id), `role`, `agencyId`, `tv` (token version) and, in support mode, `sid`. It is stored in an **HTTP-only cookie** (`appzex_session`, `SameSite=Lax`, `Secure` in production). JavaScript never sees the token.
- **The database is the source of truth.** On each request the user, membership, client company and agency status are reloaded:
  - suspended agency → `403 "Your agency account is currently suspended. Please contact support."` (checked at login **and** on every request)
  - deactivated user, disabled client portal or deleted client → 403
  - `tokenVersion` mismatch (bumped on logout) → 401, so a logged-out token cannot be replayed
  - `agencyId` claim that no longer matches the membership → 401
- **RBAC middleware:** `authenticate`, `requireRole`, `requireSuperAdmin`, `requireAgencyAccess`, `requireAgencyAdmin` and `requireClientAccess`.

| Action | Agency Admin | Agency Member | Client | Super Admin |
|---|---|---|---|---|
| View workspace data | ✅ | ✅ | ❌ | ✅ read-only (support mode) |
| Projects: create / edit / change status | ✅ | ✅ | ❌ | ❌ |
| Projects: delete | ✅ | ❌ | ❌ | ❌ |
| Clients, portal users, team, settings | ✅ | ❌ | ❌ | ❌ |
| Milestones, tasks, meetings, feedback replies | ✅ | ✅ | ❌ | ❌ |
| Delete a file | ✅ any | own uploads | ❌ | ❌ |
| AI insights | ✅ | ✅ | ❌ | ❌ |
| Portal: view own projects, submit feedback, reply, upload | ❌ | ❌ | ✅ | ❌ |
| Manage agencies, suspend / activate, support mode | ❌ | ❌ | ❌ | ✅ |

- **CSRF:** the cookie is `SameSite=Lax`. Every state-changing request must also carry a custom `X-Requested-With` header, which a cross-site page cannot send without passing a CORS preflight, and CORS only allows `CORS_ORIGIN`. When an `Origin` header is present it must be allow-listed.
- **Hardening:** helmet, an explicit CORS allow-list (never `*` with credentials), JSON body limit, a login rate limit (10 **failed** attempts per 15 minutes per IP, so switching demo accounts is never throttled), a general API limit, an AI limit (10 per minute per user), Zod validation on every input, and a centralized error handler that never leaks stack traces or SQL.
- **Frontend:** `RoleGate` redirects signed-out users to `/login` and wrong-role users to their own home (Super Admin → `/super-admin/dashboard`, agency roles → `/app/dashboard`, clients → `/client/dashboard`). A 401 or suspension response anywhere triggers a central redirect to login. This layer is for UX only; the API enforces everything again.

## Support mode

- Super Admin clicks **Enter Workspace** (with an optional reason). This creates a `SupportSession` row (60-minute expiry), writes `support.session_started` to the **agency's own activity log**, and re-issues the session cookie with the session id (`sid`).
- While the session is active, `authenticate` resolves `agencyId` from the `SupportSession` row. The UI shows a persistent amber banner: **"Super Admin Support Mode — Viewing Agency: BrightWave Digital"**, with **Exit Support Mode**.
- **Read-only by design:** `requireAgencyAccess` rejects every non-GET request in support mode (`403 SUPPORT_READ_ONLY`), including AI calls. Other agencies stay invisible (404).
- Exit (or logout) ends the session, logs `support.session_ended` with the duration, and returns to the agency page. A fresh super admin login closes any dangling session.

**Why read-only?** Support staff need to *see* what a customer sees in order to help, not act as them. Read-only access avoids unattributed changes to customer data, keeps the agency's audit trail truthful, and means a stolen super admin session cannot silently change tenant data. Agencies can also see every support visit in their own activity feed. Write-capable "impersonation" can be added later with explicit per-action auditing if it's ever needed.

## Database schema

MySQL via Prisma (`backend/prisma/schema.prisma`). All ids are **CUIDs** (not guessable sequences). All tables have `createdAt`, and mutable ones have `updatedAt`.

| Table | Purpose / key relations |
|---|---|
| `users` | All accounts. `role` (SUPER_ADMIN / AGENCY_ADMIN / AGENCY_MEMBER / CLIENT), `passwordHash`, `tokenVersion`, `isActive`, `clientId` (client users only) |
| `agencies` | Tenants. `slug` (unique), `status` (ACTIVE / SUSPENDED), `plan`, `ownerId` |
| `agency_members` | Links an agency user to an agency (`userId` unique: one agency per user in the MVP) + `jobTitle` |
| `clients` | Client companies of an agency. `portalEnabled`, internal `notes`, soft delete (`deletedAt`) |
| `projects` | `agencyId`, `clientId`, `managerId`, dates (`DATE`), `status`, `priority`, soft delete |
| `milestones` | Ordered phases of a project (`order`, `status`, `dueDate`) |
| `tasks` | `projectId`, optional `milestoneId`, `assigneeId`, `status`, `priority`, `dueDate`, `clientVisible`, `completedAt` |
| `task_comments` | Internal task discussion |
| `meetings` | `notes` (internal), `summary` (shareable), `clientVisible` |
| `feedback` / `feedback_comments` | Client change requests + client-visible conversation |
| `files` (`ProjectFile`) | Metadata of private uploads: `storageName` (server-generated key), `mimeType`, `size`, `clientVisible`, optional `taskId` / `feedbackId` |
| `activity_logs` | Append-only audit stream: `actorType`, `eventType` (e.g. `task.completed`), `entityType`/`entityId`, `visibility` (INTERNAL / CLIENT), JSON `metadata`. Designed so notifications can be fanned out from it later |
| `support_sessions` | Super admin support visits: agency, reason, start, expiry, end |

- **Indexes** match the scoped query patterns, for example `(agencyId, status)`, `(agencyId, dueDate)`, `(agencyId, createdAt)`, `(projectId, status)`, `(agencyId, deletedAt)`, plus `clientId`, `assigneeId`, `userId` and `eventType`.
- **Referential actions** are chosen deliberately. Agency and client relations use `Restrict`, so an agency can never be cascade-deleted by accident. Project children `Cascade` (projects themselves are soft-deleted). Optional links such as `milestoneId`, `assigneeId` and `managerId` use `SET NULL`, so deleting a milestone keeps its tasks.
- **Soft delete** applies to clients and projects. The scope builders exclude deleted rows, so no query can forget to. A client cannot be deleted while it still has projects (409).
- **Transactions** wrap every multi-step write, for example: project + default milestones + activity; agency + admin + membership + activity; status change + activity; and every mutation together with its audit entry.
- **Progress is derived** (`completedTasks / totalTasks × 100`, 0 when there are no tasks), never stored, and recalculated whenever a task changes.

## AI feature

### AI Project Health Assistant (primary)

- **Problem:** project managers juggle many projects. Spotting slipping ones means reading tasks, milestones, deadlines and feedback. The assistant does that analysis on demand and drafts a client update.
- **Input:** before any AI call, the backend computes **deterministic facts** from the database (`healthService.ts`): total/completed/open/overdue tasks, completion %, days until the deadline, overdue milestones, pending feedback, unassigned open work, the overdue task list, milestone states, recent feedback and recent activity, plus a **rule-based health level** (`ON_TRACK` / `AT_RISK` / `CRITICAL`) with reasons. These facts are shown in the UI even without AI and are the *only* data the model receives, so it analyses facts rather than inventing them.
- **Output:** strict JSON `{ health, summary, risks[], overdueWork[], recommendedActions[], clientUpdate }`, validated with Zod. The UI shows a health badge, summary, risks, overdue work, recommended next actions, and a client communication suggestion with a Copy button.
- **Model:** OpenAI Chat Completions in JSON mode, `OPENAI_MODEL` (default `gpt-4.1-mini`, configurable). The provider sits behind a small interface (`services/ai/aiProvider.ts`), so it can be swapped or mocked.
- **Prompt:** the system prompt tells the model to analyse only the supplied data, never invent facts, base risks on overdue tasks, deadlines, milestones and feedback, keep recommendations concise, say so explicitly when data is insufficient, and keep the client update free of internal names and blame.
- **Security:** the order is fixed: **authenticate → authorize the project against the caller's agency (404 otherwise) → collect only that project's facts → call the model.** The request never includes contact details, emails or other tenants' data. The API key lives only on the server. Clients get 403, and support mode is read-only. The AI never writes to project data; only an audit entry (`ai.project_health_generated`) is recorded. Output is advisory and clearly labelled for review.
- **Failure handling:**
  - no `OPENAI_API_KEY` → `503` with "AI service is not configured. Add OPENAI_API_KEY to enable this feature." (the rule-based metrics still work)
  - provider error or timeout (30s, 1 retry) → `502` with "Unable to generate AI insights right now. Please try again.", plus a Retry button; provider details are only logged on the server
  - invalid JSON from the model → a readable fallback (rule-based health, reasons and overdue list), flagged in the UI
  - loading state "Analyzing project…", and a per-user rate limit

### AI Meeting Summary (secondary)

In the meeting dialog, the user types raw notes and clicks **Generate AI Summary**. The model returns `{ summary, keyDecisions[], actionItems[{ title, owner, dueDate }], deadlines[] }`. The UI composes an **editable** summary for review, and selected action items become real tasks when the meeting is saved. Only the project name, meeting title and notes are sent, after the same project authorization.

## File security

- **Private storage:** files live in `UPLOAD_DIR` (default `backend/uploads/`), outside any web root. There is no static route to them. Uploads are gitignored; demo files are generated by the seed.
- **Server-generated names:** `storageName = <uuid>.<ext>`. The user's filename is only metadata, sanitized to strip paths and control characters. The storage layer rejects any key that doesn't match `^[a-f0-9-]{36}\.[a-z0-9]{2,5}$`, which rules out path traversal.
- **Validation:** extension allow-list (PDF, PNG, JPG/JPEG, DOC/DOCX, XLS/XLSX, CSV, TXT), **magic-byte signature check** (the browser-supplied MIME type is ignored; the stored MIME type is derived from the validated extension), and a size limit (`MAX_UPLOAD_MB`, default 10 MB, returns 413).
- **Authorized downloads only:** `GET /api/files/:id` looks the file up with a role-aware scope:
  - agency users and support mode → file must belong to their agency
  - clients → file must be `clientVisible` **and** belong to one of their own projects
  - anyone else → 403 or 404

  Only then is the file streamed, with `Content-Disposition: attachment`, `nosniff` and `Cache-Control: private, no-store`.
- **S3-ready:** all file I/O goes through a `StorageProvider` interface (`save`, `read`, `remove`). Switching to S3, R2 or GCS means implementing that interface. No business or authorization code changes.

## Local setup

**Prerequisites:** Node.js 20+ (tested on 22), npm, and Docker Desktop (or your own MySQL 8).

```bash
# 1. Start MySQL (creates databases `appzex` and `appzex_test`)
cd appzex-saas
docker compose -f docker/docker-compose.yml up -d mysql

# 2. Backend
cd backend
cp .env.example .env            # then set JWT_SECRET to a long random string
npm install                     # also runs `prisma generate`
npx prisma migrate dev          # apply migrations to the dev database
npx prisma db seed              # load demo data
npm run dev                     # API on http://localhost:5000

# 3. Frontend (new terminal)
cd appzex-saas/frontend
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm install
npm run dev                     # app on http://localhost:3000
```

Open http://localhost:3000 and use a demo account (the login page has one-click fill buttons).

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Shortcut:** from `appzex-saas/`, `npm run setup` starts MySQL, installs both apps, applies migrations and seeds. Then run `npm run dev:backend` and `npm run dev:frontend`.

**Everything in Docker:** `docker compose -f docker/docker-compose.yml --profile full up -d --build` builds and runs MySQL, the API (it migrates and seeds an empty database on first start) and the frontend.

### Commands reference

| Task | Command (in the folder shown) |
|---|---|
| Start backend (dev) | `backend/` → `npm run dev` |
| Start frontend (dev) | `frontend/` → `npm run dev` |
| Generate Prisma client | `backend/` → `npx prisma generate` |
| Validate schema | `backend/` → `npx prisma validate` |
| Run migrations (dev) | `backend/` → `npx prisma migrate dev` |
| Run migrations (prod) | `backend/` → `npx prisma migrate deploy` |
| Seed database | `backend/` → `npx prisma db seed` |
| Security & integration tests | `backend/` → `npm test` |
| Lint | `backend/` or `frontend/` → `npm run lint` |
| Type-check | `backend/` or `frontend/` → `npm run typecheck` |
| Production build | `backend/` → `npm run build` · `frontend/` → `npm run build` |
| Production start | `backend/` → `npm run start:prod` (migrate deploy + start) · `frontend/` → `npm start` |

## Environment variables

**Backend (`backend/.env`)**, validated at startup with Zod (the server refuses to start with invalid config):

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `5000` | API port |
| `DATABASE_URL` | – | MySQL connection string (**required**) |
| `JWT_SECRET` | – | ≥ 32 characters (**required**) |
| `JWT_EXPIRES_IN` | `8h` | Session lifetime |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed browser origins |
| `COOKIE_SECURE` | `false` | `true` in production (HTTPS) |
| `COOKIE_SAMESITE` | `lax` | `lax` (same site / proxy mode) or `none` (cross-site; forces Secure) |
| `TRUST_PROXY` | `0` | Number of reverse proxies in front of the API |
| `UPLOAD_DIR` | `./uploads` | Private upload directory |
| `MAX_UPLOAD_MB` | `10` | Upload size limit |
| `OPENAI_API_KEY` | empty | Enables AI features (server-only) |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Any Chat Completions model that supports JSON mode |
| `AI_TIMEOUT_MS` | `30000` | AI request timeout |
| `SUPPORT_SESSION_MINUTES` | `60` | Support session lifetime |
| `SEED_ON_START` | `false` | Docker only: seed on first start if the database is empty |

**Frontend (`frontend/.env.local`):**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base including `/api`, e.g. `http://localhost:5000/api`, or `/api` in proxy mode |
| `BACKEND_URL` | Optional. When set, Next.js proxies `/api/*` to this origin (first-party cookies in production) |
| `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` | Set to `false` to hide the demo account buttons on the login page |

Only `.env.example` files are committed. `.env`, `.env.local` and `.env.test` are gitignored.

## Database setup

- `docker/mysql/init.sql` creates `appzex_test` and grants the dev user rights to create Prisma's shadow database.
- Development: `npx prisma migrate dev` applies (and, after schema changes, creates) migrations.
- Production: `npx prisma migrate deploy` applies committed migrations only (non-destructive). The backend's `npm run start:prod` and the Docker entrypoint both run it.
- Reset a local database: `npx prisma migrate reset` (destructive; development only).

## Seed data

`npx prisma db seed` replaces all data with a fictional demo set. Dates are relative to "today", so overdue and due-soon states always look realistic.

| Agency | Status | Team | Clients | Projects |
|---|---|---|---|---|
| **BrightWave Digital** | Active · Growth | Maya Chen (admin), Leo Martins, Priya Nair, Sam Ortiz | Acme Corporation, Umbrella Health, Summit Outdoor Co. | Website Redesign, SEO Campaign, Patient Portal UX Audit, Brand Refresh (completed), E-commerce Launch (past deadline) |
| **NorthStar Creative** | Active · Enterprise | Daniel Okafor (admin), Sofia Rossi, Kenji Watanabe | Globex Industries, Initech Software | Brand Identity, Marketing Website, Product Launch Video |
| **Pixel Harbor Studio** | **Suspended** · Starter | Morgan Lee (admin) | Harbor Coffee Roasters | Menu & Packaging Design |

Each project includes milestones, tasks (some overdue, some client-visible), meetings (client-visible and internal), feedback threads, real downloadable files (PDF, PNG, CSV, TXT generated at seed time; internal and shared), a full activity history and a past support session. The data differs between agencies, so isolation is easy to see.

## Demo credentials

**Password for every account: `Demo@12345`**

| Role | Email | Lands on |
|---|---|---|
| Super Admin | `superadmin@appzex-demo.com` | `/super-admin/dashboard` |
| BrightWave admin | `agencyadmin@brightwave-demo.com` | `/app/dashboard` |
| BrightWave member | `team@brightwave-demo.com` | `/app/dashboard` |
| BrightWave client (Acme) | `client@acme-demo.com` | `/client/dashboard` |
| BrightWave client (Umbrella) | `client@umbrella-demo.com` | `/client/dashboard` |
| NorthStar admin | `agencyadmin@northstar-demo.com` | `/app/dashboard` |
| NorthStar member | `team@northstar-demo.com` | `/app/dashboard` |
| NorthStar client (Globex) | `client@globex-demo.com` | `/client/dashboard` |
| Pixel Harbor admin (**suspended**) | `agencyadmin@pixelharbor-demo.com` | Login is refused with the suspension message |

**Suggested 5-minute walkthrough**
1. Super Admin → Agencies → BrightWave → **Enter workspace** → note the banner and read-only mode → **Exit Support Mode**.
2. BrightWave admin → create a client → create a project with standard milestones → add tasks → tick one and watch progress change → record a meeting → open *Website Redesign* → **Generate AI insights**.
3. Acme client → see only Acme's projects and only shared items → submit feedback.
4. BrightWave admin → Feedback → change the status and reply.
5. Try another tenant's id in any URL: the API returns 404.

## API overview

Base URL `http://localhost:5000/api`. State-changing requests need the `X-Requested-With` header and the session cookie.

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | public / authenticated |
| Super admin | `GET /super-admin/dashboard` · `GET, POST /super-admin/agencies` · `GET /super-admin/agencies/:id` · `PATCH /super-admin/agencies/:id/status` · `POST /super-admin/agencies/:id/support-session` · `POST /super-admin/support-session/:id/end` | SUPER_ADMIN |
| Workspace | `GET /dashboard` · `GET, PATCH /agency` · `GET, POST /team` · `GET /activity` | agency (writes: admin) |
| Clients | `GET, POST /clients` · `GET, PATCH, DELETE /clients/:id` · `POST /clients/:id/portal-users` | agency (writes: admin) |
| Projects | `GET, POST /projects` · `GET, PATCH, DELETE /projects/:id` · `GET /projects/:id/health` · `GET /projects/:id/activity` | agency (delete: admin) |
| Milestones | `GET, POST /projects/:projectId/milestones` · `PATCH, DELETE /milestones/:id` | agency |
| Tasks | `GET /tasks` · `GET /tasks/summary` · `GET, POST /projects/:projectId/tasks` · `GET, PATCH, DELETE /tasks/:id` · `GET, POST /tasks/:taskId/comments` | agency |
| Meetings | `GET /meetings` · `GET, POST /projects/:projectId/meetings` · `PATCH, DELETE /meetings/:id` | agency |
| Feedback | `GET /feedback` · `GET, POST /projects/:projectId/feedback` · `GET, PATCH /feedback/:id` · `POST /feedback/:id/comments` | agency |
| Files | `GET /files` · `GET, POST /projects/:projectId/files` · `PATCH, DELETE /files/:id` · `GET /files/:id` (download) | agency; download also clients |
| AI | `GET /ai/status` · `POST /ai/project-health` · `POST /ai/meeting-summary` | agency |
| Client portal | `GET /portal/dashboard` · `GET /portal/projects` · `GET /portal/projects/:id` · `POST /portal/projects/:projectId/feedback` · `POST /portal/projects/:projectId/files` · `GET /portal/feedback` · `GET /portal/feedback/:id` · `POST /portal/feedback/:id/comments` · `GET /portal/meetings` · `GET /portal/files` | CLIENT |

Lists support `page` / `pageSize` (maximum 100) and, where relevant, `search`, `status`, `priority`, `clientId`, `projectId`, `assigneeId` (`me` / `unassigned`), `due` (`overdue` / `today` / `week` / `completed`), `sort` and `order`. Filters only narrow results that are already tenant-scoped.

Status codes used: 200, 201, 400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503.

## Security test cases

```bash
cd backend
npm test
```

The suite needs MySQL running (the Docker service above). It prepares the dedicated `appzex_test` database with `prisma migrate deploy` + the seed, and refuses to run against any database whose name doesn't contain "test". It is **65 tests in 8 files**, all hitting the real HTTP API against real MySQL. The ten required cases live in `tests/security.test.ts`:

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Agency A reads an Agency B project | 403/404 | 404 ✅ |
| 2 | Agency A reads an Agency B task (and its comments) | 403/404 | 404 ✅ |
| 3 | Agency A updates/deletes an Agency B project (DB unchanged) | 403/404 | 404 ✅ |
| 4 | Client 1 opens Client 2's project (same agency and other agency) | 403/404 | 404 ✅ |
| 5 | Client calls internal agency APIs | 403 | 403 ✅ |
| 6 | Client downloads another client's file | 403/404 | 404 ✅ |
| 7 | Agency admin, member or client calls Super Admin endpoints | 403 | 403 ✅ |
| 8 | Suspended agency (and its client) calls the API with a pre-issued token; login | 403 | 403 ✅ |
| 9 | Unauthenticated / tampered token on protected APIs | 401 | 401 ✅ |
| 10 | Wrong password (and unknown email, same response) | 401 | 401 ✅ |

The other suites cover auth (HttpOnly cookie, bcrypt hashes, logout revocation, CSRF and origin checks, deactivated users), broad tenant isolation (lists, filters, 13 cross-tenant write attempts, foreign `clientId` / `managerId` / `assigneeId` / `milestoneId`, ignored body `agencyId`), the client portal (no internal data leaks, feedback loop), super admin (metrics, search, filter, pagination, live suspension, audited read-only support mode, agency creation), files (private storage, spoofed MIME, disallowed types, path traversal, size limit, visibility toggle, delete rights), project workflow (derived progress, validation, admin-only actions, soft delete) and AI (not-configured message, **no provider call for another tenant's project**, output validation, fallback, provider failure).

See [`docs/SECURITY_TESTING.md`](docs/SECURITY_TESTING.md) for the full matrix and manual `curl` checks.

## Deployment

The frontend deploys to **Vercel**. The backend deploys to **Railway**, **Render** or any Docker host, with a hosted **MySQL** database (Railway MySQL, Aiven, TiDB Cloud, AWS RDS, etc.).

### Recommended: Vercel + Railway, with first-party cookies through a proxy

Browsers increasingly block third-party cookies. If the frontend and API live on different domains, let Vercel proxy `/api` so the session cookie belongs to the frontend's own domain.

1. **Database:** in Railway, create a project and add **MySQL**.
2. **API:** add a service from this GitHub repo with root directory `appzex-saas/backend`. Railway builds `backend/Dockerfile`; the entrypoint runs `prisma migrate deploy` and starts the server on `$PORT`. Set these variables:
   ```
   NODE_ENV=production
   DATABASE_URL=${{MySQL.MYSQL_URL}}
   JWT_SECRET=<48+ random bytes, hex>
   CORS_ORIGIN=https://<your-app>.vercel.app
   COOKIE_SECURE=true
   COOKIE_SAMESITE=lax
   TRUST_PROXY=2
   UPLOAD_DIR=/data/uploads          # attach a Railway volume at /data
   OPENAI_API_KEY=<optional>
   OPENAI_MODEL=gpt-4.1-mini
   SEED_ON_START=true                # demo only: seeds once, when the DB is empty
   ```
   Generate a public domain for the service and check `https://<api-domain>/api/health`. The image runs as the unprivileged `node` user; if the mounted volume is not writable by it, set Railway's `RAILWAY_RUN_UID=0` or change the volume's ownership.
3. **Frontend:** in Vercel, import the repo with root directory `appzex-saas/frontend` (framework preset: Next.js) and set:
   ```
   NEXT_PUBLIC_API_URL=/api
   BACKEND_URL=https://<api-domain>
   ```
   Deploy. `next.config.ts` rewrites `/api/*` to `BACKEND_URL`.
4. Put the final Vercel URL into the API's `CORS_ORIGIN` and redeploy the API.

**Alternative, direct cross-site mode:** set `NEXT_PUBLIC_API_URL=https://<api-domain>/api` on the frontend and `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` on the API. This works, but browsers with strict third-party-cookie blocking (for example Safari) may drop the session, so the proxy setup is preferred.

**Render:** create a Web Service with root `appzex-saas/backend`, build `npm ci && npm run build`, start `npm run start:prod` and health check `/api/health`. Use an external MySQL, the same variables as above (`TRUST_PROXY=1` without Vercel in front) and a persistent disk for `UPLOAD_DIR`. Seed once from a shell with `npx prisma db seed`.

**Production checklist:** HTTPS everywhere, a strong `JWT_SECRET`, `COOKIE_SECURE=true`, exact `CORS_ORIGIN`, `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false` (for real customers), persistent upload storage (volume or S3), and database backups.

## Known limitations

- One agency per user (`agency_members.userId` is unique). There are no email invitations or password resets: admins set temporary passwords.
- Local-disk file storage needs a persistent volume in production (the S3 adapter is a future step). There is no virus scanning.
- Rate limiting is in-memory (per instance) and keyed by IP (login, general API) or user (AI). Multi-instance deployments need a shared store such as Redis, and `TRUST_PROXY` must match the proxy chain.
- JWTs are revoked by bumping `tokenVersion`, so logging out signs the user out on every device.
- Support mode is read-only. Support staff cannot fix data on behalf of an agency.
- AI results are not persisted; they are regenerated on demand, and only an audit entry is stored.
- An activity event that was client-visible when it happened (e.g. "file uploaded") stays in the client's timeline even if the item is later made internal. The item itself becomes inaccessible.
- Frontend route guards are client-side (the API is the real gate). Pages render after a session check rather than being server-rendered.
- Date-only fields are stored as UTC calendar dates, so "overdue" uses the UTC day boundary.
- Integration tests share one seeded database and run serially.

## Future improvements

- Database-level tenant integrity: composite foreign keys `(projectId, agencyId)`, or row-level security on PostgreSQL.
- S3/R2 storage with signed URLs, virus scanning and per-agency storage quotas.
- Notifications (in-app and email) fanned out from `activity_logs`.
- Email invitations, password reset, MFA/SSO, and session management per device.
- Per-project membership and custom roles; approval workflows for clients.
- Persisted AI reports with trend history, and portfolio-level AI summaries.
- Redis-backed rate limiting and caching, background jobs (email, AI).
- Browser E2E tests (Playwright) in CI, and OpenTelemetry tracing.
- Billing/subscription management for plans; dark mode; i18n.

## Product decisions

- **Separate client API (`/api/portal/*`).** Branching on role inside agency endpoints would risk leaking internal fields. Dedicated portal endpoints with allow-listed `select`s make client isolation explicit and easy to audit.
- **404 for cross-tenant ids, 403 for role violations.** A 403 would confirm that another tenant's id exists; a 404 reveals nothing.
- **DB-backed session context on every request.** It costs one indexed query per request, and in return suspension, deactivation, role changes and logout take effect immediately, even for tokens already issued.
- **HTTP-only cookie + SameSite + custom-header CSRF check,** instead of tokens in `localStorage`, which XSS could steal.
- **Read-only, audited support mode** (see [Support mode](#support-mode)).
- **Derived progress.** Progress is computed from task completion instead of a typed-in percentage, so it cannot drift from reality.
- **Soft delete for clients and projects; hard delete for tasks, milestones, meetings and files.** Important business records stay recoverable. Deleting a client is blocked while it has projects, so one click can't hide a large dataset.
- **Deterministic metrics before AI.** The AI explains verified facts and never modifies data. The same metrics provide a useful rule-based assessment when AI is disabled.
- **Scope builders in one file.** Isolation is a single, reviewable pattern rather than conditions scattered through services.
- **Pragmatic UI stack.** Radix primitives + Tailwind with native `<select>`s for accessibility and mobile. The chart colors come from a validated colorblind-safe palette, and every chart also shows its values as text.
- **Cut, not compromised.** Billing, real-time chat, drag-and-drop boards and SSO were intentionally left out to spend the time on security, isolation and core workflows.
