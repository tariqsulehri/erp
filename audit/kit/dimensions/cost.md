# Cost
**Finding ID prefix:** CST
**Applies when:** the system uses paid infrastructure, cloud services, metered APIs, AI models or storage. For a free local tool, record "not applicable".

## Goal
Find what drives spend, where usage is unbounded or wasted, and whether anyone would notice a surprise bill before it hurts. Cost findings are about risk and waste, not about picking the cheapest vendor.

## What to check

### Cost drivers
- [ ] Can you list the paid services and resources, and the unit each one is billed by?
- [ ] Which user or system actions create the most billable usage?
- [ ] Is there an estimate of monthly cost, and a way to compare it with the real bill?
- [ ] Are costs attributable to environment, team or feature through tags or separate accounts?

### Unbounded usage
- [ ] Can a single user, a bug or an attacker trigger unlimited billable calls?
- [ ] Do calls to metered or AI model services have limits on size, count and frequency per user and overall?
- [ ] Is the size of prompts, context and output controlled, with the cheapest adequate model chosen per task?
- [ ] Are repeated identical requests to paid services cached or deduplicated?
- [ ] Can loops, retries or scheduled jobs multiply paid calls by accident?

### Storage and data movement
- [ ] Does storage grow without a retention or clean-up rule (files, logs, backups, snapshots, queues)?
- [ ] Is large data moved across regions, zones or out to the internet more than needed?
- [ ] Are logs and metrics kept at a volume and duration that is justified?
- [ ] Are temporary and build artifacts removed after use?

### Waste
- [ ] Are there idle, forgotten or oversized resources, such as unused environments, databases or instances?
- [ ] Do non-production environments run around the clock when they could be stopped or scaled down?
- [ ] Are resource sizes matched to measured use, with scaling that follows demand?
- [ ] Are there duplicate tools or services paid for that do the same job?
- [ ] Are discount options (commitments, reserved or spot capacity) considered where usage is steady?

### Guardrails
- [ ] Are budgets and alerts set at account, project and per-service level, with named recipients?
- [ ] Are hard quotas or caps applied to the most dangerous usage (model calls, egress, compute)?
- [ ] Is there a documented action when a threshold is crossed?
- [ ] Are credentials for paid services scoped and protected, since stolen keys become a bill?
- [ ] Is there a regular review of spend, with an owner?

### Efficiency in design
- [ ] Are expensive operations done once and reused, rather than recalculated for every request?
- [ ] Are batch and asynchronous options used where real-time is not needed?
- [ ] Is the cost of a new feature considered before release?

## How to gather evidence
- List services from infrastructure definitions, configuration and code that calls external paid APIs.
- Read billing or cost reports if the team shares them; otherwise note that costs were not verified.
- Trace each paid call from its trigger and check for caps, caches and retries.
- Read prompt construction and model selection code for size and model choice.
- Check storage and log retention settings and look at sizes where visible.
- Look for budget and alert configuration.
- Check environment schedules and resource sizes against actual load data.

## Severity guidance
| Situation | Severity |
|---|---|
| Public or low-privilege path that can drive unlimited paid model or compute calls | High |
| No budget alerts on an account with variable usage | Medium |
| Non-production environments running continuously at production size | Medium |
| Slightly oversized instance on a small service | Low |

## Common false positives
- Costs that are small in absolute terms and not growing.
- Usage that is already capped by a provider-side quota the repository does not show.
- Deliberate over-provisioning for a known peak or compliance need.
- Free-tier services flagged as cost risks.

## Strengths to look for
- Budgets, alerts and quotas with owners.
- Per-user limits and caching on paid calls.
- Retention rules for storage and logs.
- Cost tags or accounts that make spend attributable.
- Right-sized, auto-scaled resources.

## Scorecard hints
- **1:** Unknown spend, unbounded paid calls, forgotten resources, no alerts.
- **3:** Main drivers known; some limits and alerts; waste and retention gaps remain.
- **5:** Spend attributed and reviewed; usage capped per user and overall; alerts with actions; efficient design.
