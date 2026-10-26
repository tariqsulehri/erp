# 04. Threat model (Stage 2)

Skip this stage if `security` is not in scope. Keep it short: two to three pages. It guides where you look hardest in Stage 3.

## 1. Assets

What is worth protecting? List the top ones: credentials and tokens, personal data, financial data, business-critical records, intellectual property, availability of key flows, audit integrity.

## 2. Actors

Who interacts with the system, and what do you assume about them?

| Actor | Trust level | Goal if malicious |
|---|---|---|
| Anonymous internet user | none | |
| Authenticated normal user | low | read or change other users' data |
| Privileged user (manager, admin) | medium | exceed their scope, hide actions |
| Insider / developer | high | read secrets, tamper with data |
| Third-party service or dependency | varies | supply-chain compromise |
| Automated attacker | none | scan, brute force, abuse APIs |

Adjust to the project. Remove rows that do not apply.

## 3. Trust boundaries

Draw them as a list: browser ↔ API, API ↔ database, API ↔ third party, CI ↔ registry, internal ↔ internet. For each, note what crosses it and how it is authenticated and validated.

## 4. STRIDE per boundary or key flow

For each of the top flows from the System Map, ask:

- **S**poofing: can someone pretend to be another user or service?
- **T**ampering: can data be changed in transit, at rest, or by a lower-privileged role?
- **R**epudiation: would we know who did it? Are logs complete and trustworthy?
- **I**nformation disclosure: does any response, log, error, or backup leak more than it should?
- **D**enial of service: can one request or user exhaust CPU, memory, DB, or money (API usage)?
- **E**levation of privilege: can a role act outside its scope (horizontal and vertical)?

## 5. Abuse cases

Write five to ten short stories, for example: "A line manager reads another team's records by changing an ID in the URL." Each becomes something to **test in Stage 3** against the code. A confirmed abuse case is usually a High or Critical finding.

## 6. Attack chains

Look for combinations: a Medium that enables a High. Record chains (`chain_id`) so that sequencing can break them at the cheapest link (see `07-sequencing.md`).

## Output: `threat-model.md`

Assets · Actors · Trust boundaries · STRIDE table (only rows with a real concern) · Abuse cases (each marked: tested-confirmed / tested-not-reproduced / not tested + why) · Candidate attack chains.
