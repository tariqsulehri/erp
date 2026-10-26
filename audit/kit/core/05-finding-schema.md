# 05. Findings: schema and rubrics (Stage 4)

You write all findings into `findings.json`. The file must pass `tools/build-report.mjs --strict`. The machine-readable schema is `templates/findings.schema.json`; this file explains the **meaning** and the **rubrics**.

## 1. One finding

```json
{
  "id": "SEC-001",
  "title": "Password hashes returned by the API",
  "dimension": "security",
  "repo": "api",
  "severity": "Critical",
  "likelihood": "High",
  "impact": "High",
  "confidence": "confirmed",
  "urgency": "U0",
  "urgency_reason": "Internet-facing; hashes readable by any manager role.",
  "evidence": "GET /employees includes the full user row; no field filter.",
  "locations": ["src/config.service.ts:1210", "src/config.service.ts:481"],
  "impact_text": "Offline cracking of every account's password.",
  "root_cause": "No shared safe-select; handlers return ORM rows directly.",
  "fix": "Shared safeUserSelect plus an ORM-level strip of secret columns.",
  "test": "HTTP test: response body never contains password_hash.",
  "effort": "M",
  "effort_hours": 6,
  "fix_risk": "low",
  "blocked_by": [],
  "chain_id": "CHAIN-1",
  "needs_decision": false,
  "decision_id": null,
  "status": "open"
}
```

### Required (strict mode)
`id`, `title`, `dimension`, `severity`, `confidence`, `evidence`, `fix`, `urgency`, `urgency_reason`, `effort`, `locations` (not empty when `confidence` is `confirmed` or `likely`).

### Optional but valuable
`repo`, `likelihood`, `impact` (needed for the heat map), `impact_text`, `root_cause`, `test`, `effort_hours`, `fix_risk`, `blocked_by`, `chain_id`, `needs_decision`, `decision_id`, `references` (CWE, OWASP, ASVS IDs), `status`.

### Derived by the build (do not write these)
`quick_win`, `unblocks`, `sequence` (the recommended order number), `wave`.

### IDs
`<DIM>-<NNN>`, stable and unique, for example `SEC-001`, `ARC-004`, `DAT-002`, `PRF-003`, `REL-001`, `OBS-001`, `TST-002`, `OPS-005`, `DEP-001`, `A11-001`, `UXD-001`, `CST-001`, `CMP-001`, `CDH-001`, `DOC-001`. In a re-audit, **keep the same ID** for the same issue.

### Dimensions (allowed values)
`security`, `architecture`, `data`, `performance`, `reliability`, `observability`, `testing`, `cicd-supply-chain`, `dependencies`, `accessibility`, `ux-design`, `cost`, `compliance`, `code-health`, `documentation`.

## 2. Severity rubric (how bad)

Severity = the realistic worst outcome if it is exploited or occurs, **not** how easy the fix is. Rate against the project type and its data.

| Severity | Meaning | Typical examples |
|---|---|---|
| **Critical** | Direct path to a serious breach, data loss or corruption, or total outage, with little or no precondition. | Credential or secret exposure; auth bypass; SQL injection on a public route; irreversible loss of history; unauthenticated admin function. |
| **High** | Likely to cause a significant incident, or breaks a core guarantee, with some precondition. | Broken access control between users; missing input validation on sensitive write; no backups; non-atomic money or score update; known exploited dependency CVE. |
| **Medium** | Real weakness or defect with limited reach, or needs unusual conditions. | Weak rate limiting; missing security header; N+1 on a busy page; no CI gate; unversioned config; inconsistent error format. |
| **Low** | Hardening, polish, or small maintainability issue. | Minor header, naming drift, small duplication, missing doc. |

**Rules**
- Likelihood × impact decides it. Use `likelihood` and `impact` (`Low | Medium | High`) when you can, and they must agree with severity: High × High → Critical; High × Medium or Medium × High → High; Medium × Medium → Medium (or High with a strong reason); anything with a Low → Low or Medium.
- `suspected` confidence can never be Critical, and High only with a note on why it is worth a human look.
- A finding rated Critical or High needs reproduction or a traced path in `evidence`.

## 3. Urgency rubric (how soon)

| Level | Name | When | Target |
|---|---|---|---|
| **U0** | Now | Actively exploitable or data already exposed; cheap to contain. | 24 to 72 hours |
| **U1** | This sprint | High severity, or it blocks many other fixes. | current sprint |
| **U2** | Next release | Medium, or High with a safe workaround in place. | next 1 to 2 releases |
| **U3** | Planned | Low, or hardening and cleanup. | within the quarter |
| **U4** | Backlog | Nice to have. | when convenient |

Start from severity (Critical→U0, High→U1, Medium→U2, Low→U3), then adjust:

- **Raise** one level if: internet-facing, a public exploit exists, personal or financial data is involved, a compliance deadline applies, or it is a link in an attack chain.
- **Lower** one level if: a real mitigation already exists (name it), or access needs an already-privileged actor.
- Always write the reason in `urgency_reason`, one line, including any adjustment.

## 4. Effort and fix risk

- `effort`: **S** under half a day · **M** about 0.5 to 3 days · **L** over 3 days (or needs design). Add `effort_hours` if you can estimate.
- `fix_risk`: how risky the **fix itself** is. `low` (isolated, easily tested), `medium` (touches shared code), `high` (data migration, schema, auth, wide refactor). High-risk fixes go late in the sequence and need a safety net (see `07-sequencing.md`).

## 5. Wording

- `title`: plain words, says what is wrong, not the tool's rule name.
- `evidence`: what you saw and how you saw it. Include the proof, not just the location.
- `impact_text`: why a manager should care, in one sentence.
- `fix`: the concrete change and the **test that proves it**. A fix with no test is half a fix.
- Mask secrets and do not paste personal data.

## 6. Group, do not spray

Merge repeated symptoms into one finding with several `locations`. A "pattern" finding with a root cause beats thirty near-identical ones. Keep separate findings only when the fixes differ.

## 7. Other top-level data you must also write

`findings.json` also holds: `summary`, `scorecard`, `chains`, `waves`, `strengths`, `coverage`, `tools`, `decisions`. Their shapes are in `templates/findings.schema.json` and `templates/findings.example.json`. Sections 07 and 08 explain how to fill them.
