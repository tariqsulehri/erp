# Documentation
**Finding ID prefix:** DOC
**Applies when:** always. Judge documentation by whether it is accurate and usable, not by how much there is.

## Goal
Judge whether a new engineer, an operator on call, or an API consumer can get what they need from the written material, and whether it still matches the code. Find missing essentials and statements that are now wrong.

## What to check

### README and onboarding
- [ ] Does the top-level README say what the system is, who it is for and how the parts fit together?
- [ ] Can a new person get the system running locally by following the written steps alone?
- [ ] Are prerequisites, required configuration and sample values (without secrets) listed?
- [ ] Are the commands to build, test, lint and run listed and still working?
- [ ] Is there guidance on how to contribute, branch, review and release?
- [ ] Is there a glossary for domain terms the code uses?

### Architecture and decisions
- [ ] Is there an overview diagram or description of components and data flow that matches reality?
- [ ] Are significant decisions and trade-offs recorded, with date and status?
- [ ] Are superseded decisions marked as such rather than left to contradict current ones?
- [ ] Are the key business rules described in one place a non-engineer could read?

### Operations and runbooks
- [ ] Is there a runbook for deploying, rolling back and recovering the system?
- [ ] Are the likely incidents (dependency down, queue backed up, bad deploy) documented with first steps?
- [ ] Are backup and restore procedures written and linked to the last real test?
- [ ] Is it clear who to contact and how to escalate?
- [ ] Are environment differences, configuration options and secrets handling described?

### API and interface documentation
- [ ] Is there a machine-readable API description, and is it generated from or tested against the code?
- [ ] Does each endpoint or function document inputs, outputs, errors, permissions and examples?
- [ ] Are breaking changes and versions explained in a change log?
- [ ] Are events, messages and webhooks documented with their payload shapes?

### Accuracy against code
- [ ] Do commands, paths, ports, names and settings in the docs exist in the code?
- [ ] Do documented behaviours, defaults and limits match what the code does?
- [ ] Are counts and statements (number of roles, tables, endpoints) still true?
- [ ] Do links work, and do referenced files and diagrams exist?
- [ ] Is each document dated or versioned, and does it have an owner?

### Comments and in-code explanation
- [ ] Do comments explain why, not restate what the code says?
- [ ] Find comments that contradict the code they sit beside.
- [ ] Are non-obvious rules, workarounds and magic values explained at the place they appear?
- [ ] Are TODO notes and obsolete notes cleaned out?

### Findability and upkeep
- [ ] Is there one index or entry point to the documentation, and are duplicates avoided?
- [ ] Is updating the docs part of the definition of done for a change?
- [ ] Are user-facing help and release notes written for the people who use the product?

## How to gather evidence
- Read the README and follow its setup steps in a disposable copy where permitted; otherwise record "not verified".
- Compare each documented command, path and setting with the repository and configuration.
- Compare the API description with the actual handlers and responses.
- Read the architecture material and check it against the real module and service layout.
- Search for stale references, broken links and renamed concepts.
- Read the most recent incident or change and see whether documentation was updated.
- Sample code comments in complex areas and test them against the code.

## Severity guidance
| Situation | Severity |
|---|---|
| Runbook or restore steps that are wrong and would fail during an incident | High |
| Setup instructions that no longer work, blocking new engineers | Medium |
| API description out of date with the real responses | Medium |
| Typo or stale link in a minor document | Low |

## Common false positives
- Concise code that is clear without comments.
- Generated documentation that looks sparse but is accurate.
- Documents explicitly marked as historical or archived.
- Informal docs in a small team where oral knowledge is a conscious choice for a low-risk tool.

## Strengths to look for
- A setup that works from the written steps alone.
- Decision records with reasons.
- API contract generated or verified from code.
- Runbooks tied to real incidents and rehearsed.
- Docs updated in the same change as the code.

## Scorecard hints
- **1:** No usable README; setup and operations live in people's heads; docs contradict the code.
- **3:** README and some architecture and API notes exist; runbooks thin; several outdated statements.
- **5:** Accurate, discoverable docs covering onboarding, architecture, decisions, API and operations, kept current as part of every change.
