# Architecture & Design Decisions: Obsidian Distributed

**Obsidian Distributed** is a multi-tenant distributed background job orchestrator and workflow execution engine designed around **high concurrency, fault tolerance, reliable scheduling, and developer observability**.

This document records the major architectural decisions behind the system, including the reasoning, trade-offs, and potential production evolution of each decision.

---

# 1. Core Architectural Decisions

## 1.1 Atomic Job Claiming with `SELECT ... FOR UPDATE SKIP LOCKED`

### Decision

Workers use PostgreSQL row-level locking to atomically claim jobs from the central job table.

Conceptually:

```sql
SELECT *
FROM jobs
WHERE status = 'QUEUED'
  AND run_at <= NOW()
ORDER BY priority DESC, run_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

### Mechanism

Each worker continuously polls PostgreSQL for executable jobs.

`FOR UPDATE` locks the selected row while `SKIP LOCKED` allows other workers to skip jobs that are already being processed.

```text
                 Job Queue
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
      Worker 01             Worker 02
          │                     │
      Lock Job A            Skip Job A
          │                     │
          ▼                     ▼
       Execute              Claim Job B
```

### Rationale

This approach avoids introducing an external message broker such as Redis or RabbitMQ for the core queueing mechanism.

It provides:

* Atomic job claiming
* Concurrent worker execution
* No duplicate claims
* Strong consistency through PostgreSQL transactions
* A simpler operational architecture

> **Important:** `SKIP LOCKED` guarantees safe, atomic claiming of a job row. It does not by itself guarantee exactly-once execution if a worker crashes after claiming a job. Exactly-once *effects* require idempotent job handlers or additional recovery mechanisms.

### Trade-off

Using PostgreSQL as the queue introduces database I/O into the hot path.

This is mitigated through appropriate indexes, particularly around the worker claim query:

```text
(status, runAt, priority)
```

For extremely high-throughput workloads, a dedicated broker could eventually be introduced.

---

## 1.2 Recurring Schedule Coordination with PostgreSQL Advisory Locks

### Decision

Recurring schedules are coordinated using PostgreSQL transaction-level advisory locks.

Workers use:

```sql
SELECT pg_try_advisory_xact_lock(...);
```

### Mechanism

Multiple workers may evaluate the same schedule simultaneously, but only the worker that successfully acquires the advisory lock performs the scheduled operation.

```text
                Schedule Tick
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
      Worker 01             Worker 02
          │                     │
     Try Lock               Try Lock
          │                     │
       SUCCESS                FAIL
          │                     │
          ▼                     ▼
     Create Job                Skip
```

### Rationale

This allows multiple scheduler instances to run safely without producing duplicate jobs.

It avoids requiring a dedicated distributed scheduler or external coordination service.

### Trade-off

Scheduling coordination depends on PostgreSQL availability and database connection state.

The database therefore becomes part of the scheduling critical path.

---

## 1.3 Fault Tolerance with Retries, Exponential Backoff, Jitter & DLQ

### Decision

Failed jobs are retried according to a configurable retry policy.

The retry delay follows:

$$
\text{Delay}
============

\text{BaseDelay} \times 2^{\text{retryCount}}
+
\text{UniformRandom}(0,\text{Jitter})
$$

### Example

```text
Attempt 1
   │
   └── 1s + jitter

Attempt 2
   │
   └── 2s + jitter

Attempt 3
   │
   └── 4s + jitter

Attempt 4
   │
   └── 8s + jitter
```

### Rationale

Exponential backoff prevents continuously failing jobs from overwhelming downstream services.

Randomized jitter reduces the possibility of a **thundering herd**, where many jobs become eligible for retry at exactly the same time.

### Dead Letter Queue

When a job exhausts its retry policy:

```text
Job
 │
 ▼
FAILED
 │
 ▼
Retry Available?
 │
 ├── YES ──► Backoff ──► QUEUED
 │
 └── NO ───► DLQ
                │
                ▼
           DlqEntry
```

The job is transitioned to `DLQ` and its failure information is persisted in `DlqEntry`.

This isolates permanently failing or "toxic" jobs without continuously blocking the queue.

---

## 1.4 DAG Workflow Orchestration

### Decision

Job dependencies are represented explicitly through `JobDependency` records.

```text
Job A
 ├──────► Job B
 │          │
 │          ▼
 └──────► Job D
            ▲
            │
Job C ───────┘
```

### Mechanism

When a parent job completes, the DAG dependency engine evaluates its dependent children.

Conceptually:

```text
Parent Completed
       │
       ▼
DagDependencyEngine
       │
       ▼
Find dependent children
       │
       ▼
Check remaining dependencies
       │
       ├── Dependencies remain
       │       │
       │       └── Remain BLOCKED
       │
       └── All satisfied
               │
               ▼
             QUEUED
```

### Cascade Semantics

When a parent successfully completes:

1. Find dependent child jobs.
2. Evaluate their remaining dependencies.
3. If all required parents have completed, atomically promote the child to `QUEUED`.
4. If a parent permanently fails and enters the DLQ, dependent jobs can be cancelled or marked as blocked according to workflow policy.

This provides DAG-style orchestration without requiring a separate workflow engine.

---

# 2. Multi-Tenancy & Security Model

## 2.1 Project-Based Tenant Isolation

Every resource belongs to a `projectId`.

```text
Project
   │
   ├── API Keys
   ├── Queues
   ├── Jobs
   └── Schedules
```

The project acts as the primary tenant boundary.

Authenticated requests resolve the API key to its associated project before accessing project-owned resources.

---

## 2.2 API Key Security

API keys use the following format:

```text
djs_live_xxxxxxxxxxxx
```

The raw API key is only exposed during provisioning.

The stored representation is a SHA-256 hash:

```text
Raw API Key
     │
     ▼
SHA-256
     │
     ▼
Stored keyHash
```

This means the database does not need to contain the original secret.

---

## 2.3 Scoped Authorization

Every tenant-owned mutation verifies both the resource ID and its associated project.

Conceptually:

```ts
where: {
  id: resourceId,
  projectId: authenticatedProjectId
}
```

This pattern is applied to operations such as:

* Queue updates
* Queue deletion
* Schedule creation
* Schedule updates
* API key revocation
* Job operations
* Project-owned resource access

This prevents a valid API key from one project from being used to access another project's resources.

---

# 3. Trade-offs & System Boundaries

The current implementation intentionally favors a relatively simple architecture while leaving clear paths for future production evolution.

| Component                    | Current Implementation                                                                                               | Production Evolution / Rationale                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Worker Scoping**           | Workers operate as a shared compute pool and can claim jobs across available project queues.                         | Enterprise deployments could introduce tenant-specific worker pools, worker tags, dedicated compute, or VPC-level isolation.    |
| **Queue Backend**            | PostgreSQL acts as the central job queue.                                                                            | Extremely high-throughput deployments could introduce Redis, Kafka, or another dedicated broker.                                |
| **Connection Pooling**       | Neon PostgreSQL uses PgBouncer transaction-mode pooling with `connection_limit=1`.                                   | Appropriate for serverless/containerized workloads; larger deployments can tune pool sizes and connection limits independently. |
| **Interactive Transactions** | Explicit transaction timeouts are configured to prevent long-running operations from exhausting the connection pool. | Production deployments can tune timeouts based on workload characteristics.                                                     |
| **Workflow Builder**         | Workflows are created through REST APIs using DAG parent-job relationships.                                          | A visual workflow canvas could be added later without changing the underlying DAG execution model.                              |
| **Scheduler**                | PostgreSQL advisory locks coordinate recurring schedule execution.                                                   | A dedicated distributed scheduler could be introduced if scheduling throughput becomes a bottleneck.                            |
| **Job Execution**            | Workers execute jobs directly after atomic database claiming.                                                        | Long-running or isolated workloads could move to sandboxed workers or container-based execution.                                |
| **Observability**            | Job state, execution history, worker heartbeats, and DLQ records provide operational visibility.                     | Production deployments could add OpenTelemetry, centralized logs, metrics, and distributed tracing.                             |

---

# 4. Why PostgreSQL?

PostgreSQL was selected as the core coordination layer because the system requires more than simple data persistence.

It provides:

* ACID transactions
* Row-level locking
* `SKIP LOCKED`
* Advisory locks
* Strong referential integrity
* JSON/JSONB payload storage
* Consistent state transitions
* Mature indexing and query capabilities

This allows the initial system to remain operationally simple:

```text
                    ┌───────────────┐
                    │  API Nodes    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    │               │
                    │ Queue         │
                    │ Scheduling    │
                    │ Locks         │
                    │ State         │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          Worker 01     Worker 02     Worker 03
```

Instead of introducing Redis, RabbitMQ, a distributed scheduler, and a separate workflow engine from the beginning, PostgreSQL provides the primitives required to build the first version of the platform.

---

# 5. Key Design Principles

The architecture is guided by several principles:

### Prefer Strong Primitives Over Additional Infrastructure

Use PostgreSQL's transactional and locking capabilities before introducing another distributed system.

### Keep API Nodes Stateless

API instances should be horizontally scalable and interchangeable.

### Make Workers Horizontally Scalable

Any worker should be able to claim eligible work without requiring centralized worker coordination.

### Treat Jobs as Persistent State

A job should remain recoverable and observable even if a worker crashes.

### Design for Failure

Retries, backoff, jitter, DLQs, and heartbeats are first-class parts of the architecture rather than afterthoughts.

### Keep Tenant Boundaries Explicit

Every project-owned operation should be scoped by `projectId`.

### Separate Current State from History

`Job` represents the current state of work, while `JobExecution` preserves execution history.

---

# 6. Future Evolution

The current architecture intentionally provides a foundation that can evolve as throughput and operational requirements increase.

Potential future improvements include:

* Dedicated message broker for extremely high queue throughput
* Tenant-aware worker pools
* Worker autoscaling
* Distributed tracing with OpenTelemetry
* Prometheus-compatible metrics
* Sandboxed job execution
* Visual DAG workflow builder
* Job cancellation and timeout enforcement
* Automatic worker recovery
* Priority fairness and starvation prevention
* Per-tenant rate limiting
* Multi-region worker clusters
* Database read replicas for observability workloads

The important design constraint is that these additions should **extend the existing execution model rather than replace its core correctness guarantees**.

---

# Summary

Obsidian Distributed deliberately uses PostgreSQL as both its **system of record and its initial distributed coordination layer**.

The key decisions are:

| Decision                     | Primary Benefit                       |
| ---------------------------- | ------------------------------------- |
| `FOR UPDATE SKIP LOCKED`     | Concurrent atomic job claiming        |
| Advisory locks               | Duplicate-free schedule coordination  |
| Exponential backoff + jitter | Resilient retries                     |
| Dead Letter Queue            | Isolation of permanently failing jobs |
| Explicit DAG dependencies    | Reliable workflow orchestration       |
| Project-scoped API keys      | Multi-tenant isolation                |
| Stateless API nodes          | Horizontal API scaling                |
| Distributed workers          | Parallel job execution                |
| PostgreSQL transactions      | Consistent state transitions          |

> **The architecture favors correctness and operational simplicity first, while preserving clear paths toward higher throughput, stronger isolation, and more sophisticated distributed infrastructure as the system grows.**
