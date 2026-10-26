# Docker / Kubernetes / CI pipeline stack module

**Detection signals:** `Dockerfile*`, `docker-compose*.yml`, `.dockerignore`, `k8s/`, `helm/`, `kustomization.yaml`, `.github/workflows/*.yml`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`, `Jenkinsfile`, `azure-pipelines.yml`.

**Loads with dimensions:** cicd-supply-chain, security, reliability, cost, compliance.

## Vulnerability and defect patterns

### Security (containers)
- No `USER` instruction, or `USER root`: the process runs as root; a compromise is more severe. Kubernetes: `runAsNonRoot` unset.
- Base image `FROM x:latest` or no tag: builds are not reproducible. Better: a version tag, best a digest (`image@sha256:...`).
- Secrets in `ARG`, `ENV`, or `COPY .env` / `COPY . .`: they stay in image layers and `docker history`. Use BuildKit secrets (`RUN --mount=type=secret`) or runtime injection.
- `.dockerignore` missing: `.git`, `.env`, `node_modules`, and keys are copied into the build context.
- `ADD <url>` or `curl | sh` in `RUN` with no checksum check.
- Compose: `privileged: true`, `network_mode: host`, mounting `/var/run/docker.sock`, mounting host root paths, `cap_add` without need.
- Compose and Kubernetes: ports published on all interfaces (`"5432:5432"`) for databases and admin tools; bind to `127.0.0.1` when local only.
- Kubernetes: `privileged`, `allowPrivilegeEscalation: true`, `hostPath`, `hostNetwork`, secrets as plain `env` values in manifests, no `NetworkPolicy`, default service account with broad RBAC, `automountServiceAccountToken` left on without need.

### Reliability (containers)
- No `HEALTHCHECK` (Dockerfile) or no `livenessProbe`/`readinessProbe` (Kubernetes).
- No resource `limits`/`requests` (Kubernetes) or `mem_limit`/`deploy.resources` (Compose): one container can starve a node.
- No multi-stage build: compilers and dev dependencies end up in the runtime image (bigger, more attack surface).
- `CMD npm start` as shell form with no signal handling: `SIGTERM` is not forwarded, slow or forced shutdown. Use exec form and an init (`tini`, `--init`) where needed.
- Single replica with no `PodDisruptionBudget` for critical services; `restartPolicy` or `restart:` not set in Compose.
- Data volumes missing for stateful containers; `latest` image tags in manifests with `imagePullPolicy: Always` causing surprise upgrades.

### Security and supply chain (CI)
- Third-party actions or orbs pinned by tag or branch (`uses: org/action@v3`, `@main`) rather than a full commit SHA; unpinned `image:` in CI jobs.
- Secrets echoed or printed (`echo $TOKEN`, `set -x`, `env`, `printenv`); secrets passed on command lines that logs record. Check masking.
- GitHub Actions: `pull_request_target` that checks out PR code; untrusted input (`github.event.pull_request.title`, `head_ref`, issue bodies) interpolated into `run:` (script injection); default `GITHUB_TOKEN` with broad permissions and no `permissions:` block.
- Deploy jobs that run from any branch or on pull requests, with no `environment` protection, manual approval, or branch condition.
- No gates before deploy: tests, lint, security scan, or image scan not required, or set `continue-on-error: true` / `allow_failure: true`.
- Two CI systems (for example GitHub Actions and Bitbucket Pipelines) defining overlapping jobs: drift, one may skip checks. Record which one actually deploys.
- Long-lived cloud credentials stored as secrets where short-lived OIDC federation is available.
- Artifact provenance: images and packages built and pushed without signing (`cosign`), SBOM, or build attestation; deploy by mutable tag instead of digest.
- Self-hosted runners shared across repos, with persistent workspace and no isolation.
- `npm install` rather than `npm ci`, or `pip install` without hashes or a lock file in CI.

### Data and cost
- Database containers with default passwords in Compose files committed to git.
- Pipelines with no caching, no `concurrency` cancel, or no timeouts: wasted minutes and hung jobs.
- Images never pruned in the registry; oversized images (`du`/layer review).

### Testing and code health
- CI does not run the test suite, or runs it without failing the build on error.
- Duplicated YAML across jobs and environments with no reusable workflow/template; dead jobs and stale branches in triggers.

## Framework misconfigurations

- Compose `.env` interpolation of secrets into committed files; `docker-compose.yml` used for production without review.
- Kubernetes `Secret` objects are only base64; check for encryption at rest or an external secrets manager.
- `latest` tag in Helm `values.yaml`; `Ingress` with no TLS; wide `ingress` CIDR (`0.0.0.0/0`) on admin endpoints.
- GitHub Actions `permissions:` omitted (default may be write-all in older org settings); `actions/checkout` persisting credentials when not needed.
- CI variables marked as not protected or not masked; shared across all branches.

## Scanner and project commands

All run only if approved at Checkpoint A. Prefer read-only scanner modes.
- Dockerfile lint: `hadolint Dockerfile`.
- IaC and manifests: `trivy config .`, `checkov -d .`, `kube-linter lint <path>`.
- Image scan: `trivy image <image>` (needs the image built or pulled; build only if approved).
- Filesystem and dependencies: `trivy fs .`, `osv-scanner`.
- Secrets: `gitleaks detect` (full history), `trufflehog`.
- Workflow lint: `actionlint` for GitHub Actions, if installed.
- Compose validation: `docker compose config` (prints resolved values, including secrets; redact output before saving).
- SBOM: `syft <image-or-dir>`.

## Where to look first

- `Dockerfile*` at repo root and per service folder; `.dockerignore`.
- `docker-compose*.yml`, `compose.*.yml` (check which one is used for production).
- `k8s/`, `deploy/`, `helm/*/values*.yaml`, `charts/`, `manifests/`.
- `.github/workflows/`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`, `Jenkinsfile`, `.circleci/`.
- Deployment scripts: `scripts/`, `Makefile`, `deploy.sh` (read; do not run unless approved).
- Repo and CI settings for branch protection and secrets cannot be seen in files; record as not verified.

## Looks wrong but is fine

- `latest` tag in a throwaway local dev Compose file.
- Running as root in a build stage of a multi-stage Dockerfile when the final stage uses a non-root `USER`.
- Published ports bound to `127.0.0.1` for local development.
- Placeholder passwords in `.env.example` or in a test-only Compose file.
- `continue-on-error` on an optional, informational job such as a coverage upload.
- Tag-pinned first-party actions from the same organisation, if the team accepts that policy.

## Version notes

- Docker Compose v2 uses `docker compose` and ignores the top-level `version:` key; v1 (`docker-compose`) is end of life.
- Kubernetes removed PodSecurityPolicy (1.25); Pod Security Admission labels replace it. Some API versions are removed in newer releases.
- GitHub Actions: older runner images and actions on deprecated Node runtimes warn and later break.
- Base images (Node, Python, Debian) reach end of life; check the tag against the vendor support dates.
- Verify against the installed version.
