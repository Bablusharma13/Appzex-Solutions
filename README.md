# AppZex Solutions — Multi-Tenant Agency Project Management SaaS

A secure, multi-tenant SaaS where many agencies share one platform while their data stays isolated on the server. It has three experiences:

- **Super Admin Portal:** manage agencies, suspend or activate them, and use audited read-only support mode.
- **Agency Workspace:** clients, projects, milestones, tasks, meetings, feedback, files, activity, and an **AI Project Health Assistant**.
- **Client Portal:** a client sees only its own projects and only what the agency shares; it can submit feedback and share files.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · Node.js · Express 5 · Prisma 6 · MySQL 8 · JWT (HTTP-only cookie) · bcrypt · OpenAI · Docker

The application lives in [`appzex-saas/`](appzex-saas):

| Document | Contents |
|---|---|
| [appzex-saas/README.md](appzex-saas/README.md) | Architecture, multi-tenancy strategy, auth, AI, file security, setup, API, deployment |
| [appzex-saas/SUBMISSION.md](appzex-saas/SUBMISSION.md) | Submission summary, demo credentials, shortcuts and limitations |
| [appzex-saas/docs/SECURITY_TESTING.md](appzex-saas/docs/SECURITY_TESTING.md) | Security test matrix and manual verification |

## Quick start

```bash
cd appzex-saas
docker compose -f docker/docker-compose.yml up -d mysql

cd backend && cp .env.example .env    # set JWT_SECRET
npm install && npx prisma migrate dev && npx prisma db seed && npm run dev

# second terminal
cd appzex-saas/frontend && cp .env.example .env.local
npm install && npm run dev            # http://localhost:3000
```

All demo accounts use the password **`Demo@12345`**. For example: `superadmin@appzex-demo.com`, `agencyadmin@brightwave-demo.com`, `client@acme-demo.com`. The full list is in the app README.

Run the security and integration tests with `cd appzex-saas/backend && npm test`.
