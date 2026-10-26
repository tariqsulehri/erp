# Performance
**Finding ID prefix:** PRF
**Applies when:** always. Weight toward the paths users or other systems actually wait on.

## Goal
Find the places where time, memory or capacity is wasted or unbounded, and rank them by how often they run and how many users feel them. Prefer measured evidence over guesses.

## What to check

### Hot paths
- [ ] Which user journeys and background jobs run most often or matter most? Are they identified?
- [ ] Do any of those paths do more work than the result needs (recompute, refetch, reformat)?
- [ ] Is there any measurement (timings, profiles, load results) for them, and where is it recorded?

### Data access patterns
- [ ] Find loops that issue one query or remote call per item (the N+1 pattern).
- [ ] Are queries filtered, joined and sorted in the store rather than in application memory?
- [ ] Do frequent queries have supporting indexes, and do any scan whole tables?
- [ ] Are large writes batched instead of sent one at a time?
- [ ] Are connection pools sized and bounded, and are connections always returned?

### Pagination and payload size
- [ ] Does every list endpoint or view have a limit, with a ceiling the caller cannot raise freely?
- [ ] Do responses include data the caller does not use (large nested objects, unused fields)?
- [ ] Are large files and exports streamed or chunked rather than built fully in memory?
- [ ] Is compression applied to text responses?

### Caching
- [ ] Which expensive, repeatable results are cached, and which should be?
- [ ] Does each cache have an owner, an expiry and an invalidation rule?
- [ ] Can stale cache data show wrong information in a place where correctness matters?
- [ ] Is there protection against many requests recomputing the same value at once (stampede)?

### Client and startup cost
- [ ] How large is the code and asset payload a first-time user downloads, and is it split by need?
- [ ] Are images and media sized, compressed and loaded lazily where appropriate?
- [ ] Does the application do heavy work at startup or first request that could be deferred?
- [ ] Do screens rerender or refetch more than their data changes require?

### Concurrency and resource limits
- [ ] Are there limits on memory, CPU, request size, request duration and concurrent work?
- [ ] Can one slow or large request starve others (blocking calls on a shared worker, unbounded queues)?
- [ ] Are long-running jobs separated from request handling?
- [ ] Is shared state accessed safely under parallel load?
- [ ] Is there a known capacity limit, and is it comfortably above current and expected load?

### Growth
- [ ] Which operations get slower as data grows, and by how much per tenfold increase?
- [ ] Do reports and dashboards read raw history each time, or from summaries?

## How to gather evidence
- Trace the top journeys end to end and count queries, remote calls and bytes per request.
- Use query plans or logs of slow queries from a local or disposable database to confirm scans.
- Read build output to see bundle composition and size.
- Look for loops containing data calls, and for list handlers without limits.
- Read resource and timeout configuration for services, jobs and containers.
- Run a small, safe, local load or timing check where permitted; otherwise record "not verified".
- Check any existing monitoring for latency percentiles and error rates.

## Severity guidance
| Situation | Severity |
|---|---|
| Unbounded list or export that can exhaust memory and take the service down | High |
| N+1 queries on a frequently used page | Medium |
| Large uncompressed assets on a rarely used screen | Low |
| Missing index on a table that is currently tiny | Low |

## Common false positives
- A loop over a small, fixed, bounded set where batching adds no value.
- Premature optimisation advice for paths that are rare or already fast.
- Query-per-item inside a one-off script or migration.
- Cache suggestions where freshness matters more than speed.

## Strengths to look for
- Mandatory pagination with sane maximums.
- Measured performance budgets and trend tracking.
- Aggregations pushed to the store, with summaries for dashboards.
- Explicit timeouts, limits and bounded queues.
- Code splitting and lazy loading sized to real use.

## Scorecard hints
- **1:** Unbounded queries and payloads, obvious N+1 on main paths, no measurement, no limits.
- **3:** Main paths acceptable; some N+1 or missing limits; limited measurement; caching ad hoc.
- **5:** Measured budgets, bounded work everywhere, deliberate caching with invalidation, summaries for heavy views, and a known capacity margin.
