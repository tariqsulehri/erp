# Dependencies
**Finding ID prefix:** DEP
**Applies when:** the project uses any third-party libraries, packages, images or services declared in a manifest.

## Goal
Find third-party code that is vulnerable, abandoned, legally risky or hard to keep current. Judge by whether the weakness is actually reachable, not only by whether a scanner printed a warning.

## What to check

### Known vulnerabilities
- [ ] Are there declared dependencies, direct or indirect, with published security advisories?
- [ ] For each serious advisory, is the vulnerable function or feature actually used, and can attacker input reach it?
- [ ] Are any advisories known to be exploited in the wild?
- [ ] Is a fixed version available, and is the upgrade compatible?
- [ ] Are build-time and test-time dependencies assessed separately from runtime ones?

### Maintenance health
- [ ] Which dependencies are abandoned, archived, deprecated or without a release for a long time?
- [ ] Is each critical dependency maintained by more than one person or an organisation?
- [ ] Is there a plan or alternative for any dependency that is end of life?
- [ ] Are runtime, language and base image versions themselves still supported?

### Licences
- [ ] Is the licence of every dependency known and recorded?
- [ ] Do any licences conflict with how the project is distributed or sold (for example copyleft in a closed product)?
- [ ] Are there dependencies with no licence or an unclear one?
- [ ] Is there a policy for allowed and forbidden licences?

### Version drift and upgrades
- [ ] How far behind the latest release are key dependencies, and is there a major version gap?
- [ ] Are updates applied regularly, or in rare large jumps?
- [ ] Is there automation proposing updates, and do tests give confidence to merge them?
- [ ] Are version ranges so loose that two installs can differ?

### Lockfiles and integrity
- [ ] Is a lockfile committed for every manifest, and kept in sync with it?
- [ ] Do installs use the lockfile exactly, and verify integrity hashes?
- [ ] Are there several lockfiles or package managers for the same project?
- [ ] Are dependencies fetched from the intended registries only?

### Typosquat and trust risk
- [ ] Are there dependencies whose names look like misspellings of popular ones, or that have very little history?
- [ ] Do any dependencies run install-time scripts, and are they reviewed?
- [ ] Are dependencies pulled directly from a repository branch, a URL or a local path instead of a release?
- [ ] Is there a dependency that does very little and could be replaced by a few lines of code?

### Footprint
- [ ] Are declared dependencies actually used, and are any unused ones present?
- [ ] Are the same capabilities provided by several overlapping libraries?
- [ ] Are vendored or copied third-party sources tracked with their origin and version?

## How to gather evidence
- Read every dependency manifest and lockfile, noting direct versus indirect entries.
- Run an advisory scanner in read-only or copy mode and record the tool, date and database version.
- For each serious advisory, search the code for the affected feature and trace whether input reaches it.
- Check release dates and maintainer activity from registry metadata where available.
- Run a licence reporting tool in a copy of the project.
- Search for unused dependencies using an analyser, then confirm by searching the code.
- Compare manifest ranges to lockfile contents.

## Severity guidance
| Situation | Severity |
|---|---|
| Actively exploited vulnerability in a reachable runtime dependency | Critical |
| Reachable high-severity advisory with a fix available | High |
| Abandoned library on a critical path with no replacement plan | Medium |
| Unused or slightly outdated development-only dependency | Low |

## Common false positives
- Advisories in code paths the project never calls, or in dev-only tools that never ship.
- Duplicate advisories reported through several indirect paths for one root cause.
- "Outdated" flags for versions that are still supported and patched.
- Licence warnings for tools used only during development.

## Strengths to look for
- Committed lockfiles installed strictly.
- Automated, regular update proposals with tests behind them.
- A recorded licence policy and inventory.
- Small, well-chosen dependency set.
- Reachability analysis noted for each accepted advisory.

## Scorecard hints
- **1:** No lockfile, known exploitable vulnerabilities, unsupported runtime, unknown licences.
- **3:** Lockfiles present; some outdated or vulnerable packages with low reachability; licences partly known; updates irregular.
- **5:** Current, minimal, locked dependencies; regular automated updates; reachability-based triage; clear licence policy.
