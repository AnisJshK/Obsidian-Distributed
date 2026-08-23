# API Reference

Base URL:

```text
http://localhost:4000
```

All API responses generally follow this structure:

```json
{
  "success": true,
  "data": {}
}
```

---

# 1. Authentication & API Keys

Authentication-related routes are mounted under `/api/auth`.

## Register Project

Creates a new project.

### Endpoint

```http
POST /api/auth/register-project
```

### Request Body

```json
{
  "name": "Production Analytics"
}
```

### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "projectId": "8b191a83-2810-4043-8d07-d7e1adc068d5",
    "projectName": "Production Analytics"
  }
}
```

---

## List Projects

Returns projects available to the authenticated context.

### Endpoint

```http
GET /api/auth/projects
```

### Authentication

Requires a valid API key.

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "8b191a83-2810-4043-8d07-d7e1adc068d5",
      "name": "Production Analytics"
    }
  ]
}
```

---

## Create API Key

Creates a new API key for the authenticated project.

### Endpoint

```http
POST /api/auth/keys
```

### Authentication

Requires a valid API key.

### Response

```json
{
  "success": true,
  "data": {
    "id": "key-123",
    "apiKey": "djs_live_xxx"
  }
}
```

> **Security:** API keys are secrets. Never commit real API keys to GitHub or expose them in frontend code.

---

## List API Keys

Returns API keys associated with the authenticated project.

### Endpoint

```http
GET /api/auth/keys
```

### Authentication

Requires a valid API key.

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "key-123",
      "createdAt": "2026-08-23T04:00:00.000Z"
    }
  ]
}
```

---

## Delete API Key

Deletes an API key.

### Endpoint

```http
DELETE /api/auth/keys/:id
```

### Authentication

Requires a valid API key.

### Path Parameters

| Parameter | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `id`      | `string` | ID of the API key to delete |

### Response

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

## Verify API Key

Verifies an API key and returns the associated project.

### Endpoint

```http
POST /api/auth/verify
```

### Request Body

```json
{
  "apiKey": "djs_live_xxx"
}
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "projectId": "8b191a83-2810-4043-8d07-d7e1adc068d5",
    "token": "djs_live_xxx",
    "project": {
      "id": "8b191a83-2810-4043-8d07-d7e1adc068d5",
      "name": "Production Analytics"
    }
  }
}
```

---

## Get Session

Returns information about the currently authenticated project.

### Endpoint

```http
GET /api/auth/session
```

### Authentication

Requires a valid API key.

### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "8b191a83-2810-4043-8d07-d7e1adc068d5",
      "name": "Production Analytics"
    }
  }
}
```

---

# 2. Jobs

Job-related routes are mounted under `/api/jobs`.

## List Jobs

Returns jobs belonging to the authenticated project.

### Endpoint

```http
GET /api/jobs
```

### Query Parameters

| Parameter   | Required | Description                   |
| ----------- | -------- | ----------------------------- |
| `status`    | No       | Filter jobs by status         |
| `queueName` | No       | Filter jobs by queue          |
| `limit`     | No       | Limit number of returned jobs |
| `offset`    | No       | Pagination offset             |

### Example

```http
GET /api/jobs?status=QUEUED&queueName=default
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "c71a82e9-4043-8d07-a81d-e01f5fa9c84e",
      "status": "COMPLETED",
      "priority": 10,
      "retryCount": 0,
      "queue": {
        "name": "default"
      }
    }
  ]
}
```

---

## Enqueue Job

Creates and queues a new background job.

### Endpoint

```http
POST /api/jobs
```

### Request Body

```json
{
  "queueName": "default",
  "payload": {
    "task": "send-email",
    "to": "dev@example.com"
  },
  "priority": 10,
  "maxRetries": 3,
  "backoffType": "EXPONENTIAL",
  "backoffDelayMs": 1000
}
```

### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "c71a82e9-4043-8d07-a81d-e01f5fa9c84e",
    "status": "QUEUED",
    "priority": 10,
    "runAt": "2026-08-23T04:00:00.000Z"
  }
}
```

---

## Batch Enqueue Jobs

Creates multiple jobs in a single request.

### Endpoint

```http
POST /api/jobs/batch
```

### Request Body

```json
{
  "jobs": [
    {
      "queueName": "default",
      "payload": {
        "task": "send-email",
        "to": "user1@example.com"
      },
      "priority": 10
    },
    {
      "queueName": "default",
      "payload": {
        "task": "send-email",
        "to": "user2@example.com"
      },
      "priority": 5
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "job-1",
      "status": "QUEUED"
    },
    {
      "id": "job-2",
      "status": "QUEUED"
    }
  ]
}
```

---

## Get Job

Returns detailed information about a specific job.

### Endpoint

```http
GET /api/jobs/:id
```

### Path Parameters

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `id`      | `string` | Job ID      |

### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "c71a82e9-4043-8d07-a81d-e01f5fa9c84e",
    "status": "COMPLETED",
    "priority": 10,
    "retryCount": 0,
    "result": {
      "status": "delivered"
    }
  }
}
```

---

## Cancel Job

Cancels a job.

### Endpoint

```http
POST /api/jobs/:id/cancel
```

### Path Parameters

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `id`      | `string` | Job ID      |

### Response

```json
{
  "success": true,
  "data": {
    "id": "c71a82e9-4043-8d07-a81d-e01f5fa9c84e",
    "status": "CANCELLED"
  }
}
```

---

# 3. Dead Letter Queue

DLQ routes are mounted under `/api/dlq`.

The Dead Letter Queue contains jobs that have permanently failed after exhausting their retry attempts.

## List Dead Letter Jobs

Returns jobs currently in the dead letter queue.

### Endpoint

```http
GET /api/dlq
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "job-123",
      "status": "FAILED",
      "retryCount": 3,
      "error": "Connection timeout"
    }
  ]
}
```

---

## Replay Dead Letter Job

Requeues a failed job from the dead letter queue.

### Endpoint

```http
POST /api/dlq/:jobId/replay
```

### Path Parameters

| Parameter | Type     | Description          |
| --------- | -------- | -------------------- |
| `jobId`   | `string` | ID of the failed job |

### Response

```json
{
  "success": true,
  "data": {
    "id": "job-123",
    "status": "QUEUED"
  }
}
```

---

# 4. Queues

Queue routes are mounted under `/api/queues`.

## List Queues

Returns queues belonging to the authenticated project.

### Endpoint

```http
GET /api/queues
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "q-1a2b3c4d",
      "name": "default",
      "isPaused": false,
      "maxConcurrency": 10
    }
  ]
}
```

---

## Create Queue

Creates a new job queue.

### Endpoint

```http
POST /api/queues
```

### Request Body

```json
{
  "name": "emails",
  "maxConcurrency": 10
}
```

### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "q-123",
    "name": "emails",
    "isPaused": false,
    "maxConcurrency": 10
  }
}
```

---

## Update Queue

Updates queue configuration.

### Endpoint

```http
PATCH /api/queues/:id
```

### Path Parameters

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `id`      | `string` | Queue ID    |

### Request Body

```json
{
  "maxConcurrency": 20,
  "isPaused": true
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "q-123",
    "name": "emails",
    "isPaused": true,
    "maxConcurrency": 20
  }
}
```

---

# 5. Recurring Schedules

Schedule routes are mounted under `/api/schedules`.

## Create Schedule

Creates a recurring job schedule using a cron expression.

### Endpoint

```http
POST /api/schedules
```

### Request Body

```json
{
  "queueName": "default",
  "cronExpression": "*/5 * * * *",
  "payload": {
    "task": "sync-data"
  }
}
```

### Request Parameters

| Field            | Type     | Description                           |
| ---------------- | -------- | ------------------------------------- |
| `queueName`      | `string` | Queue used for scheduled jobs         |
| `cronExpression` | `string` | Cron expression defining the schedule |
| `payload`        | `object` | Payload passed to generated jobs      |

### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "sched-99182a",
    "cronExpression": "*/5 * * * *",
    "nextRunAt": "2026-08-23T04:05:00.000Z"
  }
}
```

---

## List Schedules

Returns recurring schedules belonging to the authenticated project.

### Endpoint

```http
GET /api/schedules
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "sched-99182a",
      "cronExpression": "*/5 * * * *",
      "nextRunAt": "2026-08-23T04:05:00.000Z"
    }
  ]
}
```

---

# 6. Workers

Worker routes are mounted under `/api/workers`.

## List Workers

Returns workers currently registered with the scheduler.

### Endpoint

```http
GET /api/workers
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "worker-123",
      "status": "ONLINE",
      "concurrency": 10
    }
  ]
}
```

---

# 7. Workflows

Workflow routes are mounted under `/api/workflows`.

Workflows allow multiple jobs to be executed as a dependency graph.

## List Workflows

Returns workflows belonging to the authenticated project.

### Endpoint

```http
GET /api/workflows
```

### Response — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "workflow-123",
      "status": "COMPLETED"
    }
  ]
}
```

---

## Create Workflow

Creates a new workflow/DAG.

### Endpoint

```http
POST /api/workflows
```

### Request Body

The exact workflow schema is defined by `CreateWorkflowSchema`.

Example structure:

```json
{
  "name": "Data Processing Pipeline",
  "jobs": [
    {
      "id": "extract",
      "queueName": "default",
      "payload": {
        "task": "extract"
      }
    },
    {
      "id": "transform",
      "queueName": "default",
      "payload": {
        "task": "transform"
      },
      "parentJobIds": [
        "extract"
      ]
    }
  ]
}
```

### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "workflow-123",
    "status": "QUEUED"
  }
}
```

---

## Get Workflow

Returns details for a specific workflow/batch.

### Endpoint

```http
GET /api/workflows/:batchId
```

### Path Parameters

| Parameter | Type     | Description               |
| --------- | -------- | ------------------------- |
| `batchId` | `string` | Workflow/batch identifier |

### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "workflow-123",
    "status": "RUNNING",
    "jobs": [
      {
        "id": "job-1",
        "status": "COMPLETED"
      },
      {
        "id": "job-2",
        "status": "RUNNING"
      }
    ]
  }
}
```

---

# 8. Job Lifecycle

Jobs generally follow this lifecycle:

```text
QUEUED
   ↓
RUNNING
   ↓
COMPLETED
```

If execution fails:

```text
QUEUED
   ↓
RUNNING
   ↓
FAILED
   ↓
RETRY
   ↓
RUNNING
```

After all retry attempts are exhausted:

```text
FAILED
   ↓
DEAD LETTER QUEUE
```

A job in the DLQ can be manually replayed using:

```http
POST /api/dlq/:jobId/replay
```

---

# 9. Workflow / DAG Execution

Jobs can depend on other jobs.

Example:

```text
Job A
  │
  ├──> Job B
  │      │
  │      └──> Job D
  │
  └──> Job C
         │
         └──> Job D
```

In this example:

* Job B depends on Job A.
* Job C depends on Job A.
* Job D depends on both Job B and Job C.
* Job D should only execute after all required parent jobs complete successfully.

This allows the scheduler to execute complex workflows as directed acyclic graphs (DAGs).

---

# 10. API Summary

| Method   | Endpoint                     | Description               |
| -------- | ---------------------------- | ------------------------- |
| `DELETE` | `/api/auth/keys/:id`         | Delete API key            |
| `POST`   | `/api/auth/keys`             | Create API key            |
| `GET`    | `/api/auth/keys`             | List API keys             |
| `GET`    | `/api/auth/session`          | Get authenticated session |
| `GET`    | `/api/auth/projects`         | List projects             |
| `POST`   | `/api/auth/verify`           | Verify API key            |
| `POST`   | `/api/auth/register-project` | Register project          |
| `GET`    | `/api/dlq`                   | List dead letter jobs     |
| `POST`   | `/api/dlq/:jobId/replay`     | Replay failed job         |
| `GET`    | `/api/jobs`                  | List jobs                 |
| `POST`   | `/api/jobs`                  | Enqueue job               |
| `POST`   | `/api/jobs/batch`            | Enqueue jobs in batch     |
| `GET`    | `/api/jobs/:id`              | Get job details           |
| `POST`   | `/api/jobs/:id/cancel`       | Cancel job                |
| `GET`    | `/api/queues`                | List queues               |
| `POST`   | `/api/queues`                | Create queue              |
| `PATCH`  | `/api/queues/:id`            | Update queue              |
| `POST`   | `/api/schedules`             | Create recurring schedule |
| `GET`    | `/api/schedules`             | List recurring schedules  |
| `GET`    | `/api/workers`               | List workers              |
| `GET`    | `/api/workflows`             | List workflows            |
| `POST`   | `/api/workflows`             | Create workflow           |
| `GET`    | `/api/workflows/:batchId`    | Get workflow details      |

---

# 11. Authentication

Routes using `requireApiKey` require a valid API key.

For authenticated requests, provide the API key through the authentication mechanism configured by the API server.

Example:

```http
Authorization: Bearer djs_live_xxx
```

> The exact authentication header should match the implementation of `requireApiKey`.

---

# 12. API Architecture

The API is organized into the following functional areas:

```text
                         API Server
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   Authentication          Jobs              Queues
        │                    │                    │
   API Keys              Batch Jobs          Configuration
   Projects              Cancellation        Concurrency
   Sessions              Retries             Pause/Resume
        │                    │
        │              ┌─────┴─────┐
        │              │           │
        │             DLQ       Workflows
        │              │           │
        │           Replay       DAGs
        │                        Dependencies
        │
        ├────────────── Schedules
        │                  │
        │               Cron Jobs
        │
        └────────────── Workers
                           │
                       Execution
```

This API exposes the core functionality of the distributed job scheduler: project authentication, queue management, job execution, retries, dead-letter handling, recurring schedules, workers, and workflow/DAG execution.
