# Compliance
**Finding ID prefix:** CMP
**Applies when:** the system handles personal, financial, health or other regulated data, or the COMPLIANCE config names a framework. Map findings to GDPR, SOC 2, HIPAA or PCI DSS only where the COMPLIANCE config says so; otherwise describe the control gap in plain words.

## Goal
Judge whether the organisation knows what data it holds, why it holds it, who can touch it and how it can be proved, corrected or removed. Report gaps in controls and evidence, not legal conclusions.

## What to check

### Data inventory
- [ ] Is there a list of personal and sensitive data fields, where each is stored, and where each flows?
- [ ] Is each field's purpose written down, and is every field needed for that purpose?
- [ ] Are copies in logs, analytics, backups, exports and non-production systems accounted for?
- [ ] Are special categories (health, financial, children, biometrics) identified and handled separately?

### Lawful basis and consent
- [ ] Is there a stated lawful basis for each processing purpose?
- [ ] Where consent is the basis, is it asked clearly, recorded with time and wording, and as easy to withdraw as to give?
- [ ] Are optional uses (marketing, analytics, tracking) off until consented?
- [ ] Are privacy notices accurate to what the system really does?

### Data subject rights
- [ ] Can the organisation find all data about one person across systems?
- [ ] Is there a working way to export a person's data in a usable form?
- [ ] Is there a working way to delete or anonymise it, including backups and downstream copies, within a defined time?
- [ ] Can inaccurate data be corrected, and processing restricted on request?
- [ ] Are requests logged, tracked and answered within deadlines?

### Retention and minimisation
- [ ] Is a retention period defined for each category, and is it actually enforced?
- [ ] Are accounts, files and logs removed or anonymised when no longer needed?
- [ ] Are production personal data copies kept out of test and development use?

### Residency and vendors
- [ ] Is it known in which countries data is stored and processed, and are transfers covered?
- [ ] Is there a list of vendors and sub-processors that receive personal data, including AI model providers?
- [ ] Does each vendor have a signed data processing agreement and a reviewed security position?
- [ ] Is data sent to vendors limited to what the service needs?

### Audit logging and access control
- [ ] Are access to and changes of regulated data logged with who, what and when?
- [ ] Are the logs protected from change and kept for the required period?
- [ ] Are access rights reviewed on a schedule, and removed promptly when people change role or leave?
- [ ] Is privileged and administrative access limited, approved and recorded?

### Governance and incidents
- [ ] Is there a named owner for privacy and security, and are staff trained?
- [ ] Is there an incident and breach response process with notification timelines and a rehearsed contact list?
- [ ] Are risk assessments (for new processing, or high-risk processing) done and kept?
- [ ] Is evidence for each control stored in a place an auditor could be given?
- [ ] Are policies versioned, approved and consistent with real practice?

## How to gather evidence
- Read the COMPLIANCE config first to know which frameworks and scopes apply.
- Trace a few personal data fields from collection to storage, logs, exports and deletion.
- Read any existing data map, privacy notice, vendor list and retention policy; compare them with the code and configuration.
- Test the export and deletion paths on disposable data, never on real people's data.
- Review audit log content and who can alter it.
- Read access review records and offboarding steps.
- Record controls that cannot be judged from the repository as "not verified".

## Severity guidance
| Situation | Severity |
|---|---|
| Regulated data sent to a vendor with no agreement or valid basis | High |
| No working way to delete or export a person's data on request | High |
| Retention period defined but not enforced | Medium |
| Policy document out of date but practice is sound | Low |

## Common false positives
- Business contact data treated as sensitive beyond what is required.
- Controls that exist at organisation level outside the repository.
- Frameworks that do not apply to the declared scope.
- Test data that is clearly synthetic.

## Strengths to look for
- A maintained data map with owners.
- Tested export and deletion processes.
- Enforced retention jobs.
- Signed vendor agreements and a sub-processor list.
- Immutable audit logs and scheduled access reviews.

## Scorecard hints
- **1:** No data inventory, no deletion or export path, unmanaged vendors, no audit trail.
- **3:** Inventory and policies exist; some rights processes manual or untested; retention and access reviews inconsistent.
- **5:** Current inventory, tested rights processes, enforced retention, vetted vendors, protected audit logs and recorded evidence.
