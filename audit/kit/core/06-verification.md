# 06. Verification (Stage 5)

Before anything is reported, try to **disprove** your own findings. This stage is what separates an audit from a list of guesses.

## 1. Mechanical checks (every finding)

- Every `locations` entry: open the file, confirm the line exists and shows what you claim. Fix or remove any that do not.
- IDs are unique. No two findings describe the same root cause.
- Secrets masked. No personal data. No production hostnames or real credentials.
- Required fields present (the build checks this, but check the substance too).

## 2. Challenge pass (every Critical and High)

For each one, play a sceptical reviewer and answer in your notes:

1. **Is it reachable?** Is the code on a live path, or dead, test-only, or behind a flag that is off?
2. **Is it already mitigated elsewhere?** A middleware, a gateway, a DB constraint, a network rule, a framework default. Search for it before you claim it is missing.
3. **Is the precondition realistic?** Who can trigger it, and what must be true first?
4. **Is the impact right?** Would a real attacker or a real failure get what you claim?
5. **Can I show it?** A test, a request, a traced path, a query. If not, lower confidence.

Outcome for each: `keep`, `downgrade` (severity or confidence), `merge`, or `drop`. Record dropped findings and the reason in `progress.md`, so the user can ask.

## 3. Common false positives (check before you keep)

- Test, fixture, or sample code treated as production code.
- Placeholder values (`changeme`, `example.com`) flagged as secrets.
- A dependency CVE in a code path the project never calls (note it, lower urgency, do not drop it).
- A "missing check" that exists one layer up (route-level guard, ORM scope, gateway).
- A framework feature that is safe by default but looks unsafe in isolation.
- Generated or vendored code.

## 4. Consistency pass

- Severity ordering makes sense across the whole list. Two similar issues have the same severity.
- Urgency follows the rubric and each adjustment has a reason.
- Scorecard numbers match the findings (a dimension with a Critical cannot score above 2).
- Positive findings (strengths) are real and cited.

## 5. Gaps pass

- Reread the System Map's critical flows and dimensions list. Anything not covered goes into `coverage.skipped` with the reason.
- Anything you could not verify goes into the finding's `evidence` as "not verified: …" and the confidence is lowered.

Write the outcome (kept, downgraded, merged, dropped counts) to `progress.md`.
