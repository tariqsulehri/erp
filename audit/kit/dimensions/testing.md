# Testing
**Finding ID prefix:** TST
**Applies when:** always. If there are no tests, record that as the main finding and review what should be covered first.

## Goal
Judge whether the tests would actually catch a serious regression in the flows that matter, and whether the team can trust a green result. Coverage numbers are a hint, not the answer.

## What to check

### Coverage of critical flows
- [ ] Are the most important business flows and rules listed, and does each have at least one test?
- [ ] Are money, scoring, permission and data-loss paths tested, including their failure cases?
- [ ] Are boundary values, empty inputs and invalid inputs tested, not only the happy path?
- [ ] Are recently fixed bugs covered by a test that would fail if the bug returned?
- [ ] Which important modules have no tests at all?

### Test types and balance
- [ ] Is there a sensible mix of fast unit tests, integration tests with real boundaries, and a few end-to-end journeys?
- [ ] Are integration tests using a real store or a faithful substitute, not only mocks of it?
- [ ] Is there an authorization matrix test: each role against each protected action, allowed and denied?
- [ ] Where services or tiers talk to each other, is the contract tested from both sides?
- [ ] Are non-functional checks present where relevant (accessibility, performance budgets, security checks)?

### Test quality
- [ ] Can the tests fail? Find tests with no assertions, assertions that are always true, or code under test fully replaced by mocks.
- [ ] Do assertions check outcomes users or callers care about, not just that a function was called?
- [ ] Do tests describe behaviour in names that explain what broke when they fail?
- [ ] Is there heavy duplication or copy-paste setup that hides intent?
- [ ] Are skipped, disabled or commented-out tests tracked and justified?

### Reliability of the suite
- [ ] Are there flaky tests (timing, order, shared state, network), and how are they handled?
- [ ] Do tests depend on execution order, the current date, random values or external services?
- [ ] Is each test isolated, with its own data and clean-up?
- [ ] Is the suite fast enough that people run it before committing?

### Test data and environments
- [ ] Is test data created by clear builders or fixtures, and free of real personal data?
- [ ] Can the whole suite run from a clean checkout with documented steps?
- [ ] Do tests ever touch real or production services or credentials?
- [ ] Is the test environment close enough to production for results to mean something?

### Enforcement
- [ ] Does CI run the tests on every change, and does a failure block merging?
- [ ] Is there a coverage threshold on new or changed code, and is it enforced?
- [ ] Are test results and trends visible to the team?
- [ ] Is there a defined rule for what a change must ship with in terms of tests?

## How to gather evidence
- List modules and flows, then map each to the tests that exercise it.
- Read a sample of tests from each type, looking for weak or empty assertions.
- Read the coverage report if one exists; open the files with low coverage that matter most.
- Read CI configuration for test steps, thresholds and required checks.
- Where permitted, run the suite in a disposable copy and record failures, runtime and flakiness; otherwise record "not verified".
- Look for mutation or fault-injection evidence; if none, perform a manual thought test by breaking a rule and checking if a test would notice.
- Search for skip markers and test-only shortcuts in production code.

## Severity guidance
| Situation | Severity |
|---|---|
| No tests on the code that moves money, grants access or deletes data | High |
| Tests exist but pass even when the rule is removed (cannot fail) | High |
| Suite is flaky and the team ignores red builds | Medium |
| Test names unclear or fixtures duplicated | Low |

## Common false positives
- Low coverage on generated code, configuration or trivial accessors.
- Mocks used at a true external boundary where a real service is impractical.
- Missing end-to-end tests in a small tool where integration tests cover the risk.
- Skipped tests that have a clear, dated reason.

## Strengths to look for
- Tests written alongside each change, with coverage enforced on changed code.
- A role-by-action authorization matrix.
- Regression tests named after the bugs they prevent.
- Deterministic, isolated tests that run fast in CI.
- Contract tests between tiers.

## Scorecard hints
- **1:** Few or no tests, or tests that cannot fail; no CI enforcement.
- **3:** Unit tests for much of the logic; some integration; critical flows partly covered; CI runs tests but gaps and flakiness remain.
- **5:** Critical flows and permissions proven by tests that can fail, a balanced pyramid, enforced thresholds on changed code, and a stable fast suite.
