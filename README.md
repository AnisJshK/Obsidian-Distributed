# Obsidian Distributed

High-performance, multi-tenant distributed background job orchestrator, workflow DAG engine, and precision scheduler built with TypeScript and PostgreSQL.

Obsidian Distributed is designed as a production-inspired distributed job scheduling platform. It separates the API, worker, database, and observability dashboard into independent monorepo workspaces while using PostgreSQL for durable job state, queue coordination, scheduling coordination, and concurrency control.

---

## Live Demo

- **Frontend**: https://obsidian-distributed-web.vercel.app
- **API**: https://obsidian-distributed-1.onrender.com
- **API Health**: https://obsidian-distributed-1.onrender.com/health

> Note: Backend services run on Render's free tier and may take 10–50 seconds
> to respond on first load if idle, though they're kept warm via a scheduled
> health-check ping.

## Documentation

- [Architecture & Concurrency Model](./docs/ARCHITECTURE.md)
- [Database Schema & ER Diagram](./docs/DATABASE_SCHEMA.md)
- [REST API Reference](./docs/API_REFERENCE.md)
- [Design Decisions & Architecture Trade-offs](./DESIGN_DECISIONS.md)
- [Automated DAG Test Suite](./scripts/test-dag.ts)

---

## Dashboard
![Dashboard](./screenshots/Dashboard.png)

## Job Management
![Jobs](./screenshots/Jobs.png)

## Queue Management
![Queues](./screenshots/Queues.png)

## Distributed Workers
![Workers](./screenshots/Workers.png)


## Overview

**Obsidian Distributed** is a distributed task orchestration platform focused on concurrency, resilience, scheduling, workflow execution, and operational visibility.

The platform uses PostgreSQL locking primitives to coordinate concurrent workers without requiring an external message broker such as Redis or RabbitMQ. Jobs are persisted in PostgreSQL, workers claim available work safely, and retry/exhaustion handling determines whether failed jobs return to the queue or enter the Dead Letter Queue (DLQ).

The platform also provides:

- Multi-tenant project isolation
- API-key-based access for application/job clients
- User authentication and project management
- Queue configuration and management
- Immediate, batch, delayed, and scheduled job execution
- Recurring schedules
- DAG-style workflows
- Retry policies and DLQ handling
- Worker coordination
- A React observability dashboard

---

## Key Features

- **Atomic Job Claiming** — PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` enables multiple workers to claim independent jobs concurrently without processing the same job simultaneously.

- **DAG Workflow Engine** — Supports multi-stage job dependency graphs with parent/child tracking, dependency resolution, cascade unblocking, and failure propagation.

- **Distributed Scheduling** — PostgreSQL advisory locks coordinate recurring schedule execution so multiple worker instances can participate without executing the same schedule concurrently.

- **Fault Tolerance & DLQ** — Configurable retry behavior supports Fixed, Linear, and Exponential Backoff with Jitter, with exhausted jobs isolated in the Dead Letter Queue.

- **Multi-Tenant Security** — API keys are hashed with SHA-256 and scoped to projects, providing project-level access boundaries for queues, jobs, schedules, and workflows.

- **Live Observability Console** — React-based dashboard for inspecting jobs, execution history, failures, queues, schedules, and worker activity.

- **Horizontal Worker Scaling** — Multiple worker instances can process the same queues concurrently using PostgreSQL locking primitives.

- **Monorepo Development Workflow** — API, worker, and web processes can be started together from the repository root with `bun run dev`.

---

## Architecture

```text
                         ┌──────────────────────────────────────┐
                         │     React Observability Dashboard    │
                         └──────────────────┬───────────────────┘
                                            │
                                      HTTP / API Key
                                            │
                                            ▼
                         ┌──────────────────────────────────────┐
                         │            Express REST API           │
                         │                                        │
                         │ Authentication / Projects / Keys      │
                         │ Queues / Jobs / Workflows / Schedules │
                         │ DLQ / Worker API                      │
                         └──────────────────┬───────────────────┘
                                            │
                                            ▼
                  ┌──────────────────────────────────────────────────┐
                  │                    PostgreSQL                     │
                  │                                                  │
                  │  Durable Job State     Queue State              │
                  │  Execution History     Project / API Key Data   │
                  │  Workflow State        Schedule State            │
                  │  DLQ State             Advisory Locks            │
                  │                                                  │
                  │  SELECT ... FOR UPDATE SKIP LOCKED               │
                  └──────────────────┬───────────────────────────────┘
                                     │
                         ┌───────────┴───────────┐
                         │ Distributed Workers   │
                         │                       │
                         │ Worker Node 01        │
                         │ Worker Node 02        │
                         │ Worker Node N         │
                         └───────────────────────┘
```

The major runtime responsibilities are separated:

| Component | Responsibility |
|---|---|
| **API** | Authentication, project management, API keys, queues, jobs, workflows, schedules, DLQ operations, and worker-facing endpoints |
| **Worker** | Claims and executes jobs, processes workflow dependencies, handles retries, and participates in scheduling |
| **Database** | Durable state, transactional coordination, locking, execution history, project isolation, and scheduling coordination |
| **Web** | Observability and operational UI for the platform |

For a detailed explanation of concurrency, worker coordination, DAG execution, and scheduling, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Monorepo Structure

```text
distributed-job-scheduler/
│
├── apps/
│   ├── api/                    # Express REST API
│   ├── worker/                 # Distributed job worker
│   └── web/                    # React observability dashboard
│
├── packages/
│   └── database/               # Database schema, client & migrations
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   └── API_REFERENCE.md
│
├── scripts/
│   └── test-dag.ts
│
├── DESIGN_DECISIONS.md
├── package.json
└── README.md
```

The repository is a manually structured Bun monorepo rather than a Turborepo. The root workspace configuration includes:

```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

---

# Getting Started

## Prerequisites

Make sure the following are installed:

- [Bun](https://bun.sh/)
- PostgreSQL or a hosted PostgreSQL provider such as Neon
- Git

Verify Bun:

```bash
bun --version
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/AnisJshK/Obsidian-Distributed.git
cd distributed-job-scheduler
```

---

## 2. Install Dependencies

Install all workspace dependencies from the monorepo root:

```bash
bun install
```

Bun installs dependencies for the root project and its configured workspaces.

---

## 3. Configure Environment Variables

The application uses environment variables for API communication and database connectivity.

### Root `.env`

The web application and API clients use the API base URL. API keys should be supplied through the appropriate local development configuration rather than committed to source control.

Example:

```env
API_URL="http://localhost:4000/api"
API_KEY="<development-api-key>"
```

### Database `.env`

The database workspace requires a PostgreSQL connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/obsidian_dev?sslmode=disable"
```

Do not commit real credentials or API keys to the repository.

---

## 4. Generate the Database Client

From the repository root:

```bash
bun run db:generate
```

This executes the database workspace's generation script.

---

## 5. Run Database Migrations

```bash
bun run db:migrate
```

This applies the required database migrations through the shared database workspace.

---

## 6. Seed the Database

If development seed data is required:

```bash
bun run db:seed
```

---

# Running the Platform

The complete development environment can be started from the repository root:

```bash
bun run dev
```

The root development command starts the primary application processes concurrently:

```text
                    bun run dev
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
            API        WORKER        WEB
             │           │           │
             ▼           ▼           ▼
       Express API   Job Engine   React UI
```

The processes are labelled separately in the terminal:

```text
[API]     ...
[WORKER]  ...
[WEB]     ...
```

This allows the complete local platform to be started with a single command.

---

## Running Services Individually

Each primary service can also be started independently.

### API

```bash
bun run dev:api
```

### Worker

```bash
bun run dev:worker
```

### Web Dashboard

```bash
bun run dev:web
```

Run an individual service when debugging or developing a specific part of the platform.

---

## Root Development Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start API, worker, and web dashboard concurrently |
| `bun run dev:api` | Start only the REST API |
| `bun run dev:worker` | Start only the distributed worker |
| `bun run dev:web` | Start only the React dashboard |
| `bun run db:generate` | Generate the database client |
| `bun run db:migrate` | Run database migrations |
| `bun run db:seed` | Seed the development database |

---

## Development Process Model

The root development command uses `concurrently` to orchestrate the application processes:

```text
                         Root package.json
                                │
                         bun run dev
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
             dev:api        dev:worker        dev:web
                │               │               │
                ▼               ▼               ▼
          @scheduler/api  @scheduler/worker  @scheduler/web
```

Each service remains independently runnable while sharing a convenient development entry point.

---

# API Overview

The API is organized by responsibility and authentication boundary.

## Authentication

Base path:

```text
/api/auth
```

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a user |
| `POST` | `/api/auth/login` | Public | Authenticate a user |
| `POST` | `/api/auth/register-project` | User session | Create/register a project |
| `POST` | `/api/auth/verify` | Public | Verify an API key or verification payload |
| `GET` | `/api/auth/me` | User session | Retrieve the authenticated user |
| `POST` | `/api/auth/logout` | User/session | Clear the session cookie |
| `GET` | `/api/auth/session` | API key | Retrieve the authenticated project/session context |

Authentication middleware is applied according to the route's required credential type.

---

## Health Check

```http
GET /health
```

Returns the API health status and process uptime.

Example response:

```json
{
  "status": "ok",
  "uptime": 123.45
}
```

---

## Projects

Base path:

```text
/api/projects
```

Project routes require a user session.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List projects available to the authenticated user |
| `GET` | `/api/projects/:id` | Retrieve a project |
| `PATCH` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |

---

## API Keys

Base path:

```text
/api/keys
```

API-key management is user-scoped. The key-management routes require the authenticated user context.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/keys` | List API keys |
| `POST` | `/api/keys` | Create an API key |
| `DELETE` | `/api/keys/:id` | Delete an API key |

### Important authentication distinction

The `/api/keys` router is mounted with:

```text
app.use("/api/keys", requireUser, keysRouter)
```

The router itself does **not** need to repeat `requireApiKey` on every route.

This is intentionally different from the API-facing job routes, which are protected by API-key authentication.

There should be only one `/api/keys` router registration in the API application. If two identical `app.use("/api/keys", ...)` registrations exist in the source, the duplicate should be removed rather than documented as two separate API groups.

---

## Queues

Base path:

```text
/api/queues
```

Queues are project-scoped resources used to organize and control job execution.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/queues` | List queues |
| `POST` | `/api/queues` | Create a queue |
| `PATCH` | `/api/queues/:id` | Update queue configuration |

Queue configuration includes execution-related controls such as priority, concurrency, retry behavior, and pause/resume state where supported by the application.

---

## Dead Letter Queue

Base path:

```text
/api/dlq
```

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/dlq` | List dead-lettered jobs |
| `POST` | `/api/dlq/:jobId/replay` | Replay a dead-lettered job |

The DLQ isolates jobs that have exhausted their configured retry policy. Replay allows an operator to return an eligible failed job to normal processing.

---

## Workflows

Base path:

```text
/api/workflows
```

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/workflows` | List workflows/batches |
| `POST` | `/api/workflows` | Ingest a workflow definition |
| `GET` | `/api/workflows/:batchId` | Retrieve workflow/batch state |

Workflow ingestion is validated through `IngestWorkflowSchema`.

---

## Recurring Schedules

Base path:

```text
/api/schedules
```

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/schedules` | Create a recurring schedule |
| `GET` | `/api/schedules` | List schedules |

Schedule creation is validated through `CreateRecurringScheduleSchema`.

Recurring execution is coordinated at the worker/database layer so multiple worker instances can participate without duplicating the same scheduled execution.

---

# Job API

The application-facing job API is intentionally separated under `/api/v1/jobs`.

Base path:

```text
/api/v1/jobs
```

All routes under this mount require API-key authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/jobs` | List jobs |
| `POST` | `/api/v1/jobs` | Create a job |
| `POST` | `/api/v1/jobs/batch` | Create a batch of jobs |
| `GET` | `/api/v1/jobs/:id` | Retrieve a job |
| `POST` | `/api/v1/jobs/:id/cancel` | Cancel a job |

The API validates job payloads using the appropriate Zod schemas, including `CreateJobSchema` and `CreateBatchJobSchema`.

### Job lifecycle

At a high level, a job follows this lifecycle:

```text
Client
  │
  │ POST /api/v1/jobs
  ▼
REST API
  │
  │ Persist
  ▼
PostgreSQL
  │
  │ QUEUED
  ▼
Worker Claim
  │
  │ SELECT ... FOR UPDATE SKIP LOCKED
  ▼
RUNNING
  │
  ├──────────── Success ────────────► COMPLETED
  │
  └──────────── Failure
                    │
                    ▼
                  Retry
                    │
             ┌──────┴──────┐
             │             │
          Available      Exhausted
             │             │
             ▼             ▼
           QUEUED          DLQ
```

This separation allows job producers to submit work without needing to know which worker will execute it.

---

# Worker API

Base path:

```text
/api/v1/worker
```

The worker API is protected by API-key authentication.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/worker` | Worker-facing API endpoint |

The worker layer is responsible for distributed execution while the API layer remains responsible for accepting and managing application requests.

---

# Authentication Model

The platform uses two primary authentication contexts.

## User Authentication

User-facing routes use the authenticated user session.

These routes cover operations such as:

- Registration
- Login
- User identity
- Project management
- API key management

Session state is represented through the `session` cookie.

## API Key Authentication

Application and service-facing routes use API keys.

API keys are:

- Hashed using SHA-256
- Scoped to a project
- Used to authorize project-level resources
- Suitable for programmatic job submission and worker communication

The distinction is important:

```text
User Session
    │
    ├── Projects
    └── API Key Management

API Key
    │
    └── Project-scoped application access
          │
          ├── Jobs
          ├── Queues
          ├── Workflows
          ├── Schedules
          └── Worker operations
```

The exact middleware applied to each endpoint is documented in [API_REFERENCE.md](./docs/API_REFERENCE.md).

---

# Database Commands

Database operations are routed through the shared database workspace.

### Generate

```bash
bun run db:generate
```

### Migrate

```bash
bun run db:migrate
```

### Seed

```bash
bun run db:seed
```

Internally, the root scripts use Bun workspace filtering:

```json
{
  "db:migrate": "bun --filter @scheduler/database migrate",
  "db:generate": "bun --filter @scheduler/database generate",
  "db:seed": "bun --filter @scheduler/database seed"
}
```

This keeps database tooling centralized while allowing database commands to be executed from the repository root.

---

# Concurrency & Reliability

One of the core design goals is to achieve safe distributed execution without introducing a separate queue broker.

## Atomic Job Claims

Workers use PostgreSQL row-level locking with:

```sql
SELECT ...
FOR UPDATE SKIP LOCKED
```

`SKIP LOCKED` allows one worker to skip rows currently being claimed by another worker instead of waiting for those locks. This makes it suitable for high-concurrency queue consumption.

Conceptually:

```text
                 PostgreSQL
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
     Worker 1      Worker 2      Worker 3
        │             │             │
     Claim A        Claim B        Claim C
        │             │             │
        └─────────────┼─────────────┘
                      │
               No duplicate claim
```

## Horizontal Worker Scaling

Because queue state is stored centrally in PostgreSQL, multiple worker processes can operate against the same queues.

Adding workers increases available execution capacity while PostgreSQL coordinates ownership of individual jobs.

## Retry Handling

When a job fails, the retry policy determines whether it should be attempted again.

Supported backoff strategies include:

- Fixed Backoff
- Linear Backoff
- Exponential Backoff
- Jitter

A job that exhausts its retry policy is moved to the DLQ.

---

# Workflow Execution

Workflows model jobs as dependency graphs rather than independent tasks.

A simplified workflow can be represented as:

```text
        Job A
       /     \
      ▼       ▼
   Job B    Job C
      \       /
       ▼     ▼
        Job D
```

The workflow engine tracks dependencies and makes downstream jobs eligible only when their required predecessors reach the appropriate state.

Failure propagation prevents dependent work from executing when its prerequisites cannot successfully complete.

For the implementation-level details, see [ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

# Observability

The web application provides an operational view of the distributed system.

The dashboard is intended to make the following information visible:

- Job state
- Execution history
- Failed jobs
- Queues
- Recurring schedules
- Worker activity
- Workflow execution

This separates operational visibility from the API and worker processes while keeping the platform within the same monorepo.

---

# Documentation Guide

The repository documentation is organized by concern.

### [Architecture & Concurrency Model](./docs/ARCHITECTURE.md)

Covers:

- Distributed worker architecture
- Job claiming
- `SKIP LOCKED`
- PostgreSQL advisory locks
- DAG execution
- Retry handling
- Horizontal scaling
- Worker coordination

### [Database Schema](./docs/DATABASE_SCHEMA.md)

Covers:

- Entity relationships
- Job storage
- Queue/project relationships
- Execution history
- Worker tracking
- DLQ storage
- Multi-tenant data model

### [REST API Reference](./docs/API_REFERENCE.md)

Covers:

- Authentication
- Projects
- API keys
- Queues
- Jobs
- Workflows
- Schedules
- DLQ operations
- Worker endpoints
- Request/response examples
- Authentication requirements

### [Design Decisions](./DESIGN_DECISIONS.md)

Covers:

- Architectural rationale
- PostgreSQL queue design
- Concurrency decisions
- Security model
- Trade-offs
- Future production evolution

---

# Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun / Node.js |
| Language | TypeScript |
| API | Express |
| Database | PostgreSQL / Neon |
| Validation | Zod |
| Frontend | React |
| Server State | TanStack Query |
| Styling | Tailwind CSS |
| Package Management | Bun Workspaces |
| Process Orchestration | concurrently |

---

# API Route Summary

For quick orientation, the API is divided into the following resource groups:

| Base Path | Primary Purpose | Authentication Context |
|---|---|---|
| `/health` | API health check | Public |
| `/api/auth` | User authentication, projects during onboarding, verification, and session context | User session / API key depending on endpoint |
| `/api/projects` | Project management | User session |
| `/api/keys` | API key management | User session |
| `/api/queues` | Queue management | User/project context |
| `/api/dlq` | Dead Letter Queue operations | User/project context |
| `/api/workflows` | Workflow management | User/project context |
| `/api/schedules` | Recurring schedules | User/project context |
| `/api/v1/jobs` | Application job API | API key |
| `/api/v1/worker` | Worker-facing API | API key |

The complete endpoint-level reference, including schemas and request/response details, belongs in [API_REFERENCE.md](./docs/API_REFERENCE.md).

---

# License

This project is intended for educational and portfolio purposes.
