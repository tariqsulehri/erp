# Observability
**Finding ID prefix:** OBS
**Applies when:** the system runs somewhere the team cannot attach a debugger, such as a service, job or deployed application.

## Goal
Judge whether the team can tell, quickly and from evidence, that something is wrong, where it is wrong and who it affects. Also check that the evidence itself is safe to keep.

## What to check

### Logging
- [ ] Are logs structured (consistent fields) rather than free text that must be parsed by eye?
- [ ] Do log levels mean something, and is the production level appropriate?
- [ ] Do error logs include enough context (operation, identifiers, cause) to act on without reproducing?
- [ ] Are logs shipped off the host to a place that survives restarts and is searchable?
- [ ] Is log volume bounded, with no per-item noise in hot paths?

### Correlation and tracing
- [ ] Does each request get an identifier that appears in every log line it causes?
- [ ] Is that identifier passed to downstream services, jobs and responses?
- [ ] Can a single user action be followed across components?
- [ ] Is distributed tracing in place where a request crosses several services?

### Metrics
- [ ] Are the basic signals measured for each service: request rate, errors, latency, saturation?
- [ ] Are business-level signals measured (sign-ups, completed jobs, failed payments, queue age)?
- [ ] Are latency figures percentiles rather than only averages?
- [ ] Are metric labels bounded so they cannot explode in cardinality?

### Alerting
- [ ] Are there alerts for user-visible failure, not only for resource usage?
- [ ] Does each alert have an owner, a severity and a linked runbook or first step?
- [ ] Are alerts tuned so that they are rare enough to be trusted?
- [ ] Is there a way to know when monitoring itself, or a scheduled job, has silently stopped?
- [ ] Is there an on-call or escalation path, even a small one?

### Error reporting
- [ ] Are unhandled errors captured with stack, release version and context in one place?
- [ ] Do front-end errors reach the same place, with source maps handled safely?
- [ ] Are errors grouped and deduplicated so new ones are noticed?
- [ ] Are errors that are caught and swallowed still counted or logged?

### Health and status
- [ ] Is there an endpoint or dashboard that shows whether the system and its dependencies are healthy?
- [ ] Can the running version and configuration identity be determined from outside?
- [ ] Is there a defined service level target and a measure against it?

### Safe telemetry
- [ ] Do logs, traces, metrics and error reports exclude secrets, tokens and personal data?
- [ ] Are request and response bodies logged only deliberately and with masking?
- [ ] Are access to telemetry and its retention controlled?
- [ ] Do audit events (who did what) exist separately from debug logs?

## How to gather evidence
- Read the logging setup and sample many log statements across modules for consistency and content.
- Trace one request through the code and note where its identifier is created and propagated.
- Read monitoring, dashboard and alert definitions if they exist in the repository or configuration.
- Search log statements for variables that may hold secrets or personal data.
- Check error handling code for catch blocks that discard the error.
- Check deployment configuration for log destinations and retention.
- Ask what the team looked at during the last incident; record the answer.

## Severity guidance
| Situation | Severity |
|---|---|
| Secrets or personal data written to logs or error reports | High |
| No alerting on user-visible failure for a production service | High |
| No correlation identifier, making incidents slow to diagnose | Medium |
| Inconsistent log levels or message wording | Low |

## Common false positives
- Local or development log output that is intentionally verbose.
- Telemetry provided by the platform and not visible in the repository.
- Prototypes or internal tools where heavy monitoring is out of proportion.
- Identifiers in logs that are technical, not personal.

## Strengths to look for
- Structured logs with request identifiers everywhere.
- Alerts tied to user impact, each with a runbook.
- Masking applied centrally to telemetry.
- Dashboards for the main journeys and dependencies.
- Release markers that link errors to deployments.

## Scorecard hints
- **1:** Plain text logs on one host, no alerts, no error capture, sensitive data in logs.
- **3:** Structured logs and error reporting; basic metrics; patchy correlation; alerts mostly on infrastructure.
- **5:** Correlated logs, metrics and traces; user-impact alerts with owners and runbooks; safe telemetry; monitoring of the monitoring.
