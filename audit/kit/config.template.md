# Audit config

Copy this file, fill it in, and pass its path to the agent. Anything you leave empty uses the default.

| Field | Default | Your value |
|---|---|---|
| `PRODUCT` | folder name | |
| `REPOS` (paths, one per line) | current folder | |
| `BRANCH` (to audit) | the current branch | |
| `MODE` | `AUDIT-ONLY` (`AUDIT+PLAN`, `AUDIT+FIX`) | |
| `DEPTH` | `standard` (`quick` = tools + top flows, `deep` = every module + git history) | |
| `INCLUDE` (paths/globs) | everything | |
| `EXCLUDE` (paths/globs) | `node_modules`, `dist`, `build`, `vendor`, `.git`, generated code | |
| `DIMENSIONS` | auto from the project type (see `dimensions/`) | |
| `COMPLIANCE` (GDPR, SOC2, HIPAA, PCI, none) | none | |
| `OUTPUT_DIR` | `./audit-results` | |
| `PREVIOUS_RUN` (for re-audit) | none | |
| `GENERATE_STACK_DRAFT` | `false` | |
| `TEAM_SIZE` (engineers who will fix) | 2 | |
| `RELEASE_CADENCE` | 2-week sprints | |
| `CONFIDENTIALITY` | `Confidential` | |
| `KNOWN_ACCEPTED_RISKS` (will not be flagged) | none | |
| `DECISIONS_ALREADY_MADE` (do not re-open) | none | |
| `BUDGET` (time or tokens) | none | |

Notes:
- `KNOWN_ACCEPTED_RISKS` and `DECISIONS_ALREADY_MADE` cut noise. List them with a one-line reason each.
- Keep client data out of the kit folder. Point `OUTPUT_DIR` somewhere else, and gitignore it.
