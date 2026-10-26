# Reliability
**Finding ID prefix:** REL
**Applies when:** the system runs as a service, job, or anything with users or dependencies that expect it to keep working.

## Goal
Find how the system behaves when things go wrong: slow dependencies, duplicate requests, crashes, partial failures and restarts. Check that failures are contained, visible and recoverable.

## What to check

### Timeouts and retries
- [ ] Does every call to another system (network, database, third-party API) have an explicit timeout?
- [ ] Are retries limited, spaced with backoff and jitter, and applied only to safe failures?
- [ ] Can retries from many callers multiply load on a struggling dependency (retry storm)?
- [ ] Is there a circuit breaker or equivalent to stop calling a dependency that is clearly down?

### Idempotency and duplicates
- [ ] Which operations can be received twice (client retry, webhook redelivery, job rerun)?
- [ ] Do those operations produce the same result the second time, or create duplicates or double charges?
- [ ] Are idempotency keys or unique constraints used where duplicates would hurt?
- [ ] Do scheduled jobs guard against overlapping runs?

### Races and consistency
- [ ] Find read-then-write sequences on shared state without locking or atomic updates.
- [ ] Can two users or processes act on the same record at once and leave it wrong?
- [ ] Are check-then-act patterns (existence, balance, availability) protected?
- [ ] Does partial failure in a multi-step operation leave inconsistent state, and is there compensation?

### Lifecycle
- [ ] On a stop signal, does the service finish or hand back in-flight work before exiting?
- [ ] Does startup fail fast and clearly when required configuration or dependencies are missing?
- [ ] Is there a liveness check and a readiness check that reflect real ability to serve?
- [ ] Do health checks avoid hiding a broken dependency, or killing a healthy service for a transient one?
- [ ] Is state kept in process memory that would be lost on restart or break horizontal scaling?

### Queues and background work
- [ ] Do queues and job systems have retry limits and a place for permanently failing items (dead letters)?
- [ ] Is someone alerted when the dead-letter place grows or a queue backs up?
- [ ] Are queues and buffers bounded so a slow consumer cannot exhaust memory or disk?
- [ ] Are poison messages prevented from blocking everything behind them?

### Failure modes and degradation
- [ ] For each critical dependency, what happens to the user when it is down, and is that decided or accidental?
- [ ] Can non-critical features fail without taking down core features?
- [ ] Do error paths return a clear failure rather than swallow errors and report success?
- [ ] Is there a single point of failure (one instance, one database, one person with access)?

### Recovery and operations
- [ ] Is there a runbook for the most likely incidents, and has recovery been rehearsed?
- [ ] Can a bad deploy be rolled back quickly?
- [ ] Are availability and recovery targets stated and consistent with the architecture?

## How to gather evidence
- List every outbound call and read its client configuration for timeouts and retries.
- Find handlers triggered by webhooks, queues or schedules and trace what happens on a second delivery.
- Search for unguarded read-modify-write sequences on shared records.
- Read startup, shutdown and health check code and deployment configuration.
- Inspect queue and job configuration for retry limits and dead-letter handling.
- Where safe and local, simulate a dependency failure or a repeated request and observe the result; otherwise record "not verified".
- Review incident notes, runbooks and past outage reports if they exist.

## Severity guidance
| Situation | Severity |
|---|---|
| Retried or redelivered request can double-apply a financial or irreversible action | High |
| No timeout on a call in the main request path, so one slow dependency stalls everything | High |
| No graceful shutdown, so deploys drop in-flight requests | Medium |
| Health check returns success regardless of state on a non-critical service | Low |

## Common false positives
- Operations that are naturally idempotent (setting a value to a fixed state).
- Timeouts supplied by a platform or proxy layer the code does not show.
- Single instances in clearly non-critical or internal tools.
- Swallowed errors that are intentionally logged and non-fatal (best-effort cleanup).

## Strengths to look for
- Timeouts, backoff and limits set deliberately and centrally.
- Idempotency keys or unique constraints on repeatable operations.
- Dead-letter handling with alerts.
- Graceful shutdown and meaningful readiness checks.
- Documented degradation behaviour and rehearsed recovery.

## Scorecard hints
- **1:** No timeouts or limits, duplicates and races likely, crashes lose work, failures go unnoticed.
- **3:** Timeouts and some retries exist; idempotency and shutdown uneven; some failure handling undocumented.
- **5:** Bounded, idempotent, observable failure handling everywhere that matters, with rehearsed recovery and clear degradation rules.
