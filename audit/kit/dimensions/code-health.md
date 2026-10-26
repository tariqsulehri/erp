# Code Health
**Finding ID prefix:** CDH
**Applies when:** always. Keep findings to patterns that cost the team time or hide bugs; do not report style or formatting preferences.

## Goal
Judge how easy the code is to read, change and trust. Find the hot spots where complexity, duplication and weak typing make the next change slow or risky.

## What to check

### Dead and unused code
- [ ] Find modules, functions, routes, flags and configuration that nothing references.
- [ ] Is there commented-out code or long-lived temporary code left in place?
- [ ] Are there feature flags or experiments whose decision was made long ago?
- [ ] Are there unused files, assets and scripts that confuse newcomers?

### Duplication
- [ ] Is the same logic copied in several places, so a fix must be repeated?
- [ ] Are there parallel implementations of one concept (two ways to compute, format or validate the same thing)?
- [ ] Is duplication in tests so heavy that it hides what each test checks?
- [ ] Are there helpers that already exist but were rewritten elsewhere?

### Complexity and size
- [ ] Which functions or methods are very long, deeply nested or have many branches?
- [ ] Which files are very large or mix several responsibilities?
- [ ] Are there functions with long parameter lists or boolean flags that change their behaviour?
- [ ] Are there hidden dependencies on global or shared mutable state?
- [ ] Which components or modules have the most change history combined with high complexity (hot spots)?

### Naming and readability
- [ ] Do names say what things are and do, using the domain's own language consistently?
- [ ] Are there misleading names, unexplained abbreviations or magic numbers and strings?
- [ ] Is the main flow of a module understandable without reading everything?
- [ ] Is the folder and file organisation predictable?

### Error handling
- [ ] Are errors handled in a consistent pattern across the code?
- [ ] Find places where errors are swallowed, ignored or replaced by default values that hide failure.
- [ ] Do error messages and types carry enough meaning to decide what to do?
- [ ] Is exception or failure use mixed with normal control flow?

### Type safety and contracts
- [ ] Are types or schemas used at the main boundaries, and are escape hatches (any, unchecked casts, untyped maps) rare and justified?
- [ ] Are values that can be missing handled explicitly?
- [ ] Do shapes shared between modules come from one definition?
- [ ] Are warnings from the compiler or linter enabled at a meaningful level, and kept near zero?

### Debt tracking and maintenance
- [ ] Are TODO and FIXME notes dated, owned and linked to work, or are they a growing pile?
- [ ] Is there a record of known debt and a plan to reduce it?
- [ ] Do automated quality checks run in CI, with trends visible?
- [ ] Is code ownership clear for each area?
- [ ] Do coding conventions exist and are they enforced by tools rather than by review comments?

## How to gather evidence
- Measure file and function size and branching with an analysis tool in read-only mode and record which tool and when.
- Use history to find the most frequently changed files and cross them with the complexity results.
- Run a duplication detector and an unused-code detector, then confirm each result by searching for references.
- Search for broad error catches, ignored results, unchecked casts and untyped escape hatches.
- Read the largest and most changed modules in full.
- Count and sample TODO notes and note their age.
- Read lint and compiler settings.

## Severity guidance
| Situation | Severity |
|---|---|
| Swallowed errors in a path that moves money or changes permissions, hiding real failures | High |
| Large, highly complex, frequently changed module with no tests | Medium |
| Same calculation duplicated in several places with slight differences | Medium |
| Unused helper or stale commented-out block | Low |

## Common false positives
- Generated, vendored or migrated code that nobody edits.
- Dynamic references (reflection, registries, routes by name) that make live code look unused.
- Long but simple functions such as flat mapping tables or configuration.
- Intentional duplication to avoid a harmful abstraction.

## Strengths to look for
- Small, focused modules with intention-revealing names.
- One shared implementation for each concept.
- Strict types at boundaries and a consistent error pattern.
- Enforced lint and complexity limits in CI.
- Debt tracked openly and reduced steadily.

## Scorecard hints
- **1:** Large tangled files, widespread duplication and swallowed errors, loose typing, nobody wants to touch it.
- **3:** Mostly readable; a few hot spots of complexity or duplication; types and error handling uneven; checks partly automated.
- **5:** Clear, small, typed, consistent code with automated quality gates and tracked, shrinking debt.
