# Data
**Finding ID prefix:** DAT
**Applies when:** the system stores data in a database, file store or other persistent store.

## Goal
Find ways stored data can become wrong, lost, exposed or unrecoverable. Check that the store itself defends its rules, that changes to it are safe, and that it can be restored.

## What to check

### Schema integrity
- [ ] Are required fields marked as required in the store, not only in application code?
- [ ] Are uniqueness rules and relationships enforced by constraints or keys?
- [ ] Are value ranges, enumerations and formats constrained where the store supports it?
- [ ] Are types appropriate for the data (exact types for money, time with zone, identifiers not stored as free text)?
- [ ] Are deletes handled deliberately (cascade, restrict, soft delete) and consistently?
- [ ] Is there orphaned, duplicated or contradictory data already present?

### Indexes and query shape
- [ ] Do the columns used in frequent filters, joins and sorts have supporting indexes?
- [ ] Are there redundant or unused indexes that slow writes?
- [ ] Are the largest tables or collections identified, with a growth expectation?

### Migrations
- [ ] Are schema changes versioned, ordered and reviewed like code?
- [ ] Can a migration run twice or halfway without damage (idempotent or transactional)?
- [ ] Are destructive changes (drop, rename, type change) split into safe steps?
- [ ] Has a migration been tested against realistic data volume and a copy of production-like data?
- [ ] Does anything seed, reset or alter data automatically in production?
- [ ] Is there a defined rollback or forward-fix path?

### Transactions and atomicity
- [ ] Which operations change more than one record, and do they succeed or fail as a unit?
- [ ] Can two concurrent requests corrupt a counter, balance, score or status (lost update)?
- [ ] Are read-then-write sequences protected by locking, versioning or atomic statements?
- [ ] Are side effects outside the store (email, queue, payment) coordinated with the commit?

### History and audit integrity
- [ ] Where history matters, are records append-only or versioned instead of overwritten?
- [ ] Can audit or history rows be edited or deleted by the application's normal credentials?
- [ ] Is it possible to reconstruct who changed what, and when?
- [ ] Are derived or cached values rebuildable from the source records?

### Personal and sensitive data
- [ ] Is there a list of fields that hold personal or sensitive data, with an owner?
- [ ] Are those fields protected, minimised and excluded from non-production copies or masked there?
- [ ] Do exports, reports and analytics expose more than they should?

### Backup, restore and retention
- [ ] Are backups taken automatically, stored apart from the primary, and protected?
- [ ] Has a restore been performed and timed recently, and is the result recorded?
- [ ] Are recovery point and recovery time goals defined and plausible?
- [ ] Is there a retention rule for old data, logs and files, and is it applied?
- [ ] Is database access limited by network and by least-privilege accounts?

## How to gather evidence
- Read the schema definitions and migration history; compare them with how the code reads and writes.
- Inspect constraints and indexes in a local or disposable copy, never in production.
- Find every multi-step write and trace whether it runs in a single transaction.
- Search for statements that update by reading first and writing later.
- Read backup configuration and any restore log or runbook.
- List fields that look personal and trace where they are copied, logged or exported.
- Check whether seeds or scripts can run against a real environment.

## Severity guidance
| Situation | Severity |
|---|---|
| No tested backup or restore for business-critical data | High |
| Multi-record update not atomic, causing wrong balances or scores on failure | High |
| Missing uniqueness constraint that allows duplicate business records | Medium |
| Unused index or inconsistent column naming | Low |

## Common false positives
- Constraints enforced in a different layer that is documented and tested (for example by a managed service).
- Intentional denormalisation for read speed with a rebuild path.
- Soft delete used on purpose where the schema looks "missing" a cascade.
- Small tables flagged for missing indexes.

## Strengths to look for
- Constraints and keys that make illegal states unrepresentable.
- Reviewed, ordered, repeatable migrations.
- Append-only history for audited facts.
- A restore drill with recorded results.
- Atomic updates for money, scores and counters.

## Scorecard hints
- **1:** No constraints, ad hoc schema changes, no backup evidence, non-atomic writes on critical data.
- **3:** Core constraints and migrations in place; some non-atomic paths, partial history, backups configured but untested.
- **5:** Strong constraints, safe migrations, atomic writes, immutable history, tested restore, defined retention and data classification.
