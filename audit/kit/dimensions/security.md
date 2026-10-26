# Security
**Finding ID prefix:** SEC
**Applies when:** always. Depth scales with exposure (internet-facing, personal or financial data, multi-tenant).

## Goal
Find ways an attacker, or a user acting beyond their rights, can read, change or destroy data or take over accounts or systems. Rate against the project type and the data it holds, using OWASP Top 10 and ASVS categories as the vocabulary.

## What to check

### Authentication (ASVS V2, Identification and Authentication Failures)
- [ ] Is every entry point (routes, jobs, webhooks, admin tools, internal endpoints) either authenticated or deliberately public with a reason?
- [ ] Are credentials stored with a slow, salted, purpose-built hash, never reversible or fast-hashed?
- [ ] Are login, password reset, invite and MFA flows protected against guessing, enumeration and replay?
- [ ] Do default, shared, test or seeded accounts exist that could survive into production?

### Authorization (Broken Access Control)
- [ ] Is the permission check enforced on the server for every action, not only hidden in the UI?
- [ ] Vertical: can a low-privilege user reach a higher-privilege function by calling it directly?
- [ ] Horizontal and object-level: can user A read or change user B's records by changing an identifier?
- [ ] Are tenant or ownership filters applied in one shared place, or repeated by hand and easy to forget?
- [ ] Can a user set fields they should not control (role, owner, status) through mass assignment?
- [ ] Are the rules for "who may do what" written down and covered by an authorization matrix test?

### Input, injection and output (Injection, ASVS V5)
- [ ] Find places where untrusted input becomes executable code, markup, a query, a command, a path or a template.
- [ ] Is every external input validated for type, size, range and format at the boundary?
- [ ] Is output encoded for its destination (markup, script, attribute, URL, file, log)?
- [ ] Are deserialization, XML parsing and redirect targets safe against attacker-supplied content?
- [ ] Can a user-supplied URL make the server fetch internal or cloud-metadata addresses (SSRF)?
- [ ] Are file uploads limited by size, type, content and storage location, and never executed or served inline?

### Secrets and cryptography (Cryptographic Failures)
- [ ] Are secrets absent from source, history, images, client bundles, logs and shared config?
- [ ] Are secrets loaded from a managed store and rotatable without a code change?
- [ ] Are algorithms, key sizes and random sources current and appropriate for their purpose?
- [ ] Is data protected in transit everywhere, including service-to-service and database links?
- [ ] Is sensitive data at rest protected where the threat model needs it?

### Sessions and tokens
- [ ] Do tokens and sessions expire, rotate, and get revoked on logout, password change and role change?
- [ ] Are token signing and verification strict (algorithm, issuer, audience, expiry)?
- [ ] Are session cookies or tokens stored and sent in a way that limits theft and cross-site use?

### Web surface (Security Misconfiguration)
- [ ] Is cross-site request forgery prevented for state-changing browser requests?
- [ ] Is cross-origin access limited to named origins, with no wildcard plus credentials?
- [ ] Are standard hardening headers and a content policy set, and are debug or verbose error modes off?
- [ ] Are rate limits and lockouts in place on login, expensive endpoints and public forms?

### Data exposure and audit
- [ ] Do responses return only the fields the caller needs, with no secret or internal columns?
- [ ] Do logs, errors and analytics avoid secrets, tokens and personal data?
- [ ] Are security-relevant actions (login, permission change, export, delete) recorded with who, what and when, in a tamper-resistant way?

### AI and LLM integrations
- [ ] Can untrusted text (user input, documents, web pages) change a model's instructions or tool use (prompt injection)?
- [ ] Is the data sent to an external model limited to what is needed, with personal data minimised?
- [ ] Are model outputs treated as untrusted before they reach a query, command, page or tool call?
- [ ] Do model-driven tools run with least privilege and a human gate for destructive actions?

## How to gather evidence
- Map every entry point and trace each one to its authentication and permission check.
- Read the shared guard, middleware or policy layer first, then look for routes that bypass it.
- Trace one write and one read of another user's object end to end to test object-level control.
- Run a secret scanner over the working tree and history, and a static analyser for injection patterns, in read-only mode.
- Inspect the response shape of list and detail endpoints for extra fields.
- Read configuration for cross-origin, headers, token lifetimes and debug flags.
- Review prompts, tool definitions and data sent to model providers.

## Severity guidance
| Situation | Severity |
|---|---|
| Live secret in source, or authentication bypass on a public route | Critical |
| Any user can read or change another user's records | High |
| No rate limit on login or password reset | Medium |
| Missing minor hardening header on a static page | Low |

## Common false positives
- Test fixtures and documented dummy keys flagged as secrets.
- Public endpoints that are intentionally open (health, public content).
- Input that is validated by a shared layer the scanner cannot see.
- Findings already listed in KNOWN_ACCEPTED_RISKS.

## Strengths to look for
- One central permission layer with deny-by-default behaviour.
- Authorization matrix tests that fail when a rule is removed.
- Secrets in a managed store with rotation, and secret scanning in CI.
- Safe field selection shared by every response.
- Audit trail for sensitive actions.

## Scorecard hints
- **1:** Exposed secrets or missing authorization on sensitive data; no validation; no audit trail.
- **3:** Authentication and most authorization sound, with gaps in object-level checks, rate limiting or headers; some validation inconsistency.
- **5:** Deny-by-default access control proven by tests, validated boundaries, managed secrets, strong sessions, audit trail, and reviewed AI data flows.
