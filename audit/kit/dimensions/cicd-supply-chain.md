# CI/CD and Supply Chain
**Finding ID prefix:** OPS
**Applies when:** there is any build, release or deployment process, including manual scripts and container images.

## Goal
Judge whether code reaches production only through a controlled, repeatable, reviewable path, and whether the build and its inputs can be trusted. Find ways an attacker or a mistake could ship something unreviewed.

## What to check

### Pipeline security
- [ ] Who can change the pipeline definition, and does that change need review?
- [ ] Do pipelines for untrusted contributions (forks, external pull requests) run without access to secrets or deploy rights?
- [ ] Do pipeline steps run with the least permission they need, using short-lived credentials where possible?
- [ ] Is untrusted text (branch names, titles, commit messages) kept out of shell commands in pipeline steps?
- [ ] Are third-party actions, plugins and scripts pulled in from sources the team has reviewed?

### Pinned versions and reproducibility
- [ ] Are build tools, base images and pipeline components pinned to exact versions or digests, not moving labels?
- [ ] Are dependency lockfiles committed and used in the build?
- [ ] Is the build reproducible from a clean checkout, with no manual steps or local-only inputs?
- [ ] Is there a single, versioned artifact that is promoted unchanged through environments?

### Secrets in CI
- [ ] Are secrets stored in the platform's secret store, scoped per environment, and masked in output?
- [ ] Are long-lived deploy keys avoided in favour of short-lived or federated credentials?
- [ ] Can a secret be echoed, written to an artifact, or cached by accident?
- [ ] Is there a rotation plan and a record of who can read each secret?

### Source control protections
- [ ] Is the main branch protected: required review, required passing checks, no force push?
- [ ] Are administrators and automation bound by the same rules, or are bypasses logged?
- [ ] Are commits attributable (signed or tied to verified identities)?
- [ ] Is there ownership routing so sensitive paths need the right reviewer?

### Provenance and inventory
- [ ] Is there a software bill of materials for each release, or another way to list what is inside?
- [ ] Can a deployed artifact be traced back to the exact source commit and build run?
- [ ] Are build artifacts and images signed or otherwise verified before deployment?
- [ ] Are build outputs and images scanned for known vulnerabilities and secrets?

### Image and runtime hardening
- [ ] Do containers run as a non-root user with minimal base content?
- [ ] Are read-only filesystems, dropped privileges and resource limits applied where possible?
- [ ] Do images contain only runtime needs, without build tools, source history or credentials?
- [ ] Is infrastructure defined as code and reviewed like application code?

### Deploy gates and environments
- [ ] Do quality gates (tests, scans, review) run before deployment, and can they be skipped?
- [ ] Is production deployment gated, auditable and limited to a small set of identities?
- [ ] Is rollback quick, documented and tested?
- [ ] Are environments similar enough (config shape, versions, data shape) that staging results mean something?
- [ ] Are database or schema changes sequenced safely with the application release?

## How to gather evidence
- Read all pipeline and build definitions, including reusable components and release scripts.
- Read repository settings for branch protection and review rules, where visible.
- List every external component used by the pipeline and how it is referenced.
- Read container and infrastructure definitions for user, base image, ports and privileges.
- Search pipeline files for secret handling and for untrusted values used in commands.
- Check whether release outputs include an inventory or signature.
- Read deployment documentation and trace a recent release from commit to production.

## Severity guidance
| Situation | Severity |
|---|---|
| Untrusted contributions can run with production secrets or deploy rights | Critical |
| Anyone can push to the main branch and deploy without review or checks | High |
| Build components referenced by moving labels instead of pinned versions | Medium |
| Image runs as root with no other exposure | Low |

## Common false positives
- Floating versions for internal, trusted, first-party components with their own controls.
- Missing signing for a prototype with no external consumers.
- Branch rules enforced at an organisation level the repository does not show.
- Root user in a short-lived build-only image never deployed.

## Strengths to look for
- Pinned digests and committed lockfiles.
- Short-lived federated credentials and environment-scoped secrets.
- Protected main branch with required checks.
- One artifact promoted across environments, with provenance and inventory.
- Fast, rehearsed rollback.

## Scorecard hints
- **1:** Manual or unreviewed deploys, secrets in the repository or logs, unpinned inputs, no gates.
- **3:** Automated pipeline with tests and some protections; partial pinning and scanning; rollback possible but not rehearsed.
- **5:** Hardened, least-privilege pipeline; pinned and verified inputs; provenance and inventory; gated deploys; tested rollback.
