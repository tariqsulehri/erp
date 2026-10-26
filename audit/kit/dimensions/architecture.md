# Architecture
**Finding ID prefix:** ARC
**Applies when:** always. For very small scripts, limit to the single-source-of-truth and configuration checks.

## Goal
Judge whether the structure of the system lets the team change it safely and keeps its rules true in one place. Find boundaries that leak, duplicated rules, and design choices that will become expensive.

## What to check

### Modularity and boundaries
- [ ] Can you name the main modules or components and state what each one owns?
- [ ] Does each module expose a small public surface, with others reaching it only through that surface?
- [ ] Are there circular dependencies between modules or packages?
- [ ] Does any module know details of another's internals (tables, private types, file layout)?
- [ ] Are shared libraries truly shared, or a dumping ground that everything depends on?

### Layering and coupling
- [ ] Is there a clear separation between transport, business rules and persistence?
- [ ] Do high-level rules depend on low-level details (framework, database, vendor SDK) instead of the reverse?
- [ ] Is the front end coupled to backend internals beyond the documented contract?
- [ ] Can a vendor or infrastructure piece be replaced without touching business rules?
- [ ] Are cross-cutting concerns (auth, logging, validation, errors) handled in one place?

### Domain invariants
- [ ] List the rules the business cannot afford to break. Where is each one enforced?
- [ ] Is each invariant enforced at the lowest reliable layer (data store or domain core), not only in the UI?
- [ ] Can any path (import, admin tool, job, direct call) change state without passing the rule?
- [ ] Are states and transitions explicit, with illegal transitions rejected?

### Single source of truth
- [ ] Is each important value (a metric, a status, a price, a permission) calculated or defined in one place?
- [ ] Are there two implementations of the same calculation that could disagree?
- [ ] Are constants, enums and types shared between tiers, or copied by hand?
- [ ] Is derived data clearly marked as derived, with a defined way to rebuild it?

### API design and consistency
- [ ] Are naming, verbs, status codes, pagination, filtering and error shapes consistent across endpoints?
- [ ] Is there a versioning or compatibility policy, and are breaking changes detectable?
- [ ] Are requests and responses described by a machine-readable contract that matches the code?
- [ ] Are operations that change state safe to retry, or clearly marked as not?

### Configuration and environments
- [ ] Is configuration separated from code and supplied through the environment or a config service?
- [ ] Is every config value validated at startup, with failure on missing or invalid values?
- [ ] Are environment differences (dev, test, prod) small and documented?
- [ ] Are feature flags and toggles owned, named and eventually removed?

### Evolvability and decisions
- [ ] Are significant decisions recorded with their reasons (ADRs or equivalent)?
- [ ] Where would a new feature of the most likely kind be added, and how many places must change?
- [ ] Are there known scaling or ownership limits (single instance, global state, shared database) that are written down?
- [ ] Is the cost of the current structure proportional to the project's size and stage?

## How to gather evidence
- Build a module map from directory layout and import relationships; look for cycles and fan-in hotspots.
- Trace one typical feature from request to storage and back, noting every layer it crosses.
- Search for the same business term or formula in more than one place and compare the logic.
- Read the contract or schema files and compare them with the actual handlers.
- Read configuration loading and startup code; read any decision records.
- Compare two similar endpoints or components for consistency.

## Severity guidance
| Situation | Severity |
|---|---|
| A core business rule is enforced only in the UI and can be bypassed through the API | High |
| Same metric computed two different ways and shown to users | High |
| Circular module dependencies that block independent change | Medium |
| Inconsistent naming or error format across a few endpoints | Low |

## Common false positives
- Deliberate duplication across a process boundary where sharing would couple deploys.
- Simple layering in a small project that does not need more.
- Generated code that looks coupled.
- Decisions already recorded in DECISIONS_ALREADY_MADE.

## Strengths to look for
- Rules enforced once, at a low layer, with tests.
- Clear module ownership and a small public surface.
- Config validated at startup.
- Decision records that explain trade-offs.
- Contract-first or contract-tested APIs.

## Scorecard hints
- **1:** No discernible structure; rules duplicated or only in the UI; hidden coupling makes change risky.
- **3:** Reasonable layers and modules with some leaks, a few duplicated rules, and partial contracts or decision records.
- **5:** Clear boundaries, single source of truth for key rules, consistent contracts, validated config, and recorded decisions.
