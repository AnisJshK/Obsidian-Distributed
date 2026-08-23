# API Reference

Base URL:

```text
http://localhost:3000
```

All API responses follow this general structure:

```json
{
  "success": true,
  "data": {}
}
```

---

## 1. Authentication

### Create Project

Creates a new project and generates an API key.

**Endpoint**

```http
POST /api/auth/projects
```

**Response — `201 Created`**

```json
{
  "success": true,
  "data": {
    "projectId": "8b191a83-2810-4043-8d07-d7e1adc068d5",
    "projectName": "Production Analytics",
    "apiKey": "djs_live_5fa9c84e1b824a739281e01f"
  }
}
```

> **Security:** Never commit real API keys to GitHub. Replace the example key with a placeholder such as `djs_live_xxx` in a public repository.

---

### Verify API Key

Verifies an API key and returns the associated project.

**Endpoint**

```http
POST /api/auth/verify
```

**Request Body**

```json
{
  "apiKey": "djs_live_xxx"
}
```

**Response — `200 OK`**

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

### Get Session Information

Returns information about the currently authenticated project.

**Endpoint**

```http
GET /api/auth/session
```

**Response — `200 OK`**

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

# 2. Jobs & Workflows

## Enqueue Job

Creates and queues a new background job.

Supports job priority, retries, exponential backoff, and parent job dependencies for workflow/DAG execution.

**Endpoint**

```http
POST /api/jobs
```

**Request Body**

```json
{
  "projectId": "8b191a83-2810-4043-8d07-d7e1adc068d5",
  "queueName": "default",
  "payload": {
    "task": "send-email",
    "to": "dev@example.com"
  },
  "priority": 10,
  "maxRetries": 3,
  "backoffType": "EXPONENTIAL",
  "backoffDelayMs": 1000,
  "parentJobIds": [
    "optional-parent-job-uuid"
  ]
}
```

### Request Parameters

| Field            | Type       | Description                                    |
| ---------------- | ---------- | ---------------------------------------------- |
| `projectId`      | `string`   | ID of the project that owns the job            |
| `queueName`      | `string`   | Queue where the job should be executed         |
| `payload`        | `object`   | Arbitrary data required by the worker          |
| `priority`       | `number`   | Job priority                                   |
| `maxRetries`     | `number`   | Maximum number of retry attempts               |
| `backoffType`    | `string`   | Retry backoff strategy                         |
| `backoffDelayMs` | `number`   | Initial retry delay in milliseconds            |
| `parentJobIds`   | `string[]` | Optional parent jobs for workflow dependencies |

**Response — `201 Created`**

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

## List / Filter Jobs

Returns jobs for a project with optional filtering by status and queue.

**Endpoint**

```http
GET /api/jobs?projectId={id}&status=QUEUED&queueName=default
```

### Query Parameters

| Parameter   | Required | Description           |
| ----------- | -------- | --------------------- |
| `projectId` | Yes      | Project ID            |
| `status`    | No       | Filter jobs by status |
| `queueName` | No       | Filter jobs by queue  |

**Response — `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "id": "c71a82e9-4043-8d07-a81d-e01f5fa9c84e",
      "queue": {
        "name": "default"
      },
      "status": "COMPLETED",
      "priority": 10,
      "retryCount": 0,
      "duration": "480ms",
      "result": {
        "status": "delivered"
      }
    }
  ]
}
```

---

# 3. Queues & Recurring Schedules

## List Queues

Returns all queues belonging to a project.

**Endpoint**

```http
GET /api/queues?projectId={id}
```

### Query Parameters

| Parameter   | Required | Description |
| ----------- | -------- | ----------- |
| `projectId` | Yes      | Project ID  |

**Response — `200 OK`**

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

## Register Cron Schedule

Creates a recurring job schedule using a cron expression.

**Endpoint**

```http
POST /api/schedules
```

**Request Body**

```json
{
  "projectId": "8b191a83-2810-4043-8d07-d7e1adc068d5",
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
| `projectId`      | `string` | Project ID                            |
| `queueName`      | `string` | Queue used for scheduled jobs         |
| `cronExpression` | `string` | Cron expression defining the schedule |
| `payload`        | `object` | Payload passed to the generated job   |

**Response — `201 Created`**

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

# API Summary

| Method | Endpoint             | Description               |
| ------ | -------------------- | ------------------------- |
| `POST` | `/api/auth/projects` | Create a project          |
| `POST` | `/api/auth/verify`   | Verify an API key         |
| `GET`  | `/api/auth/session`  | Get authenticated session |
| `POST` | `/api/jobs`          | Enqueue a job             |
| `GET`  | `/api/jobs`          | List/filter jobs          |
| `GET`  | `/api/queues`        | List project queues       |
| `POST` | `/api/schedules`     | Register a cron schedule  |

---

## Job Lifecycle

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

Jobs can be retried according to their configured `maxRetries`, `backoffType`, and `backoffDelayMs`.

---

## Workflow / DAG Execution

Jobs can depend on other jobs using `parentJobIds`.

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

A job with parent dependencies should only become executable once its required parent jobs have completed successfully.

---
