# Audit Kit

A stack-independent kit that makes an AI coding agent audit any codebase, rank the fixes by urgency and the best order, and produce one self-contained HTML report.

## Quick start

1. Copy `config.template.md`, fill it in (or let the agent ask).
2. Open your agent in the code to audit and paste:
   > Follow `<path-to-kit>/AUDIT.md`. Config: `<path-to-config>`.
3. Answer at the two checkpoints (confirm the System Map; review the report).
4. Open `audit-results/<run>/report.html`.

## Ready-to-paste prompts

Open `PROMPTS.md`: 18 numbered prompts for different situations (quick look, full audit, security only, resume, re-audit, fix a wave, and more). Pick a number, fill in the `<ANGLE BRACKETS>`, paste.

## Layout

```
PROMPTS.md            18 numbered, ready-to-paste prompts
AUDIT.md              master prompt: modes, load order, workflow, checkpoints
config.template.md    settings and placeholders
core/                 principles, discovery, tool scan, threat model, finding schema + rubrics, verification, sequencing, report format
dimensions/           stack-neutral checklists (security, data, testing, ...)
stacks/               stack-specific patterns, loaded after detection (+ _TEMPLATE.md)
remediation/          REMEDIATE.md, pr-checklist.md
reaudit/              diff-mode.md
templates/            report template, findings schema, examples, remediation log
tools/build-report.mjs  validate + order + render (no dependencies, Node 18+)
```

## The three rankings

- **Severity:** how bad (Critical, High, Medium, Low).
- **Urgency:** how soon (U0 now … U4 backlog).
- **Sequence:** the best order to fix, from dependencies, urgency, quick wins and fix risk. The report groups it into waves with exit criteria.

## Build and check a report by hand

```
node tools/build-report.mjs <run-folder> --strict     # validate, derive order, write report.html + findings.csv
node tools/build-report.mjs <run-folder> --check      # validate only
```

Try it on the example: copy `templates/findings.example.json` to a new folder as `findings.json`, and `templates/report.config.example.json` as `report.config.json`.

## Safety defaults

Read-only in audit modes, results written only to the run folder, repo content treated as data, secrets masked, build rejects unmasked secrets. Keep `audit-results/` out of git.

## Status

Version in `VERSION`. Stage 1 delivers HTML. Print and PDF styling is minimal; full PDF export is a later stage.
