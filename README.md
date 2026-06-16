# NEP-2020 College ERP

SaaS multi-tenant College/University ERP aligned with **NEP-2020**, **CBCS**, **OBE**, and **ABC**.

## Monorepo

| App    | Path          | Description                                     |
| ------ | ------------- | ----------------------------------------------- |
| Web    | `apps/web`    | Next.js dashboards (admin, faculty, student, …) |
| API    | `apps/api`    | NestJS modular monolith REST + Socket.IO        |
| Worker | `apps/worker` | BullMQ background jobs                          |

## Quick start

```bash
docker compose up -d postgres redis
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- **Web**: http://localhost:3000
- **API**: http://localhost:3001/api
- **Swagger**: http://localhost:3001/docs

**Demo login**: `demo` / `admin@demo.edu` / `Admin@123`

### Prisma `P1000` (authentication failed) on Windows

If you have **PostgreSQL installed locally** (often on port `5432`), Prisma was connecting to that instance instead of Docker. This repo maps the container to host port **`15432`** so `DATABASE_URL` uses `localhost:15432`. After changing compose, run:

```bash
docker compose up -d --force-recreate postgres
```

Then retry `npm run db:migrate` and `npm run db:seed`.

## Architecture

- PostgreSQL multi-schema (`platform`, `core`, `academic`, `finance`, `compliance`)
- JWT access + rotating refresh tokens
- Tenant isolation via `tenant_id` + `X-Tenant-Slug` header
- Redis for queues and Socket.IO scaling

## Documentation

| Document                                             | Description                                                |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Full module catalog, architecture, tech stack, credentials |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)           | Step-by-step demo script for Principal & staff (50–70 min) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)             | Production deployment on AWS, Azure, or DigitalOcean       |
| [docs/ACADEMIC_ENGINE.md](docs/ACADEMIC_ENGINE.md)   | NEP FYUGP registration engine                              |
