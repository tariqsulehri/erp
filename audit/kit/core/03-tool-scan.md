# 03. Tool scan (Stage 1)

Run real scanners **before** you read code in depth. Tools give facts; your judgement comes next.

## Rules

- Run a tool only if it is already installed, or the user approved installing it into a temp folder or container. Never change the audited repo's lockfiles.
- Run read-only. Point tools at the repo; write their output to `evidence/tool-output/`.
- **Redact secrets in the output before saving** (principles §2).
- Record in `run.json`: tool name, version, command, exit code, and a one-line result.
- A tool that is missing is not an error. Write "not run: not installed" in the tools list and the coverage section, and do that part by hand if you can.
- Treat tool output as **leads, not findings**. Every lead you keep is verified by hand and gets evidence.

## Purpose to tool map

Choose by purpose first, then by what the stack offers.

| Purpose | Cross-language | By ecosystem |
|---|---|---|
| Secrets in code and history | `gitleaks`, `trufflehog` | |
| Static analysis (SAST) | `semgrep` (use `--config auto`, offline rules if no network) | `eslint` + security plugins (JS/TS), `bandit` (Python), `gosec` (Go), `spotbugs` (Java), `brakeman` (Ruby) |
| Dependency vulnerabilities | `osv-scanner`, `trivy fs` | `npm audit`, `pip-audit`, `cargo audit`, `govulncheck`, OWASP dependency-check |
| Licences | `trivy`, `scancode` | `license-checker` (Node), `pip-licenses` |
| Container and IaC | `trivy image`, `trivy config`, `checkov`, `hadolint` | `kube-linter`, `tflint` |
| Type and lint health | | `tsc --noEmit`, `eslint`, `ruff`, `mypy`, `go vet`, `clippy` |
| Circular imports and layering | | `madge`, `dependency-cruiser` (JS/TS), `import-linter` (Python) |
| Duplication | `jscpd` | |
| Complexity and size | `cloc`, `lizard` | |
| Test coverage | | the project's own coverage command (run only if approved) |
| Bundle and build size | | `vite build` stats, `source-map-explorer`, `webpack-bundle-analyzer` |
| Dead code and unused deps | | `knip`, `depcheck`, `vulture`, `deadcode` |
| Accessibility (web) | `axe-core` via a browser run, `lighthouse` | |
| SBOM | `syft`, `trivy sbom` | |

## Git history mining (if git history exists and `DEPTH` is `standard` or `deep`)

- Files changed most often (hot spots): `git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -30`.
- Files that appear in many bug-fix commits (messages with fix, bug, hotfix, revert).
- Single-author files (bus factor).
- Secrets ever committed (use the secrets scanner with history on).
- Very large files or binaries in history.
- Recent churn near release: a lot of unreviewed change in sensitive areas is a risk signal.

## Output of this stage

- `evidence/tool-output/<tool>.json|txt` (redacted).
- A short table in your notes: tool, what it covered, what it found (counts), what you will verify.
- Baselines for the report: test count and pass/fail, coverage %, lint and type errors, vulnerable dependency counts by severity, bundle sizes. **Only numbers a tool produced.**
