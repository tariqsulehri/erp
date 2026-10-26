# 02. Discovery (Stage 0)

Goal: build the **System Map**, a short, factual description of what is being audited. The user confirms it at Checkpoint A. Everything after builds on it, so it must be right.

Read only at this stage. Do not judge yet.

## 1. Inventory

For each repo or path in `REPOS`:

- Name, path, current branch, latest commit hash (`git rev-parse --short HEAD`), whether the tree is clean.
- Size: file count by language (use a counter such as `cloc`, or `git ls-files` + extension counts), and the number of contributors if git history exists.
- Top-level layout: one line per main folder.

## 2. Detect the stack

Read manifests and config. Typical signals:

| Signal file | Tells you |
|---|---|
| `package.json`, lockfiles | Node, package manager, framework (express, nestjs, next, react, vue, vite), scripts |
| `pyproject.toml`, `requirements*.txt`, `Pipfile` | Python, django, fastapi, flask |
| `pom.xml`, `build.gradle*` | Java/Kotlin, spring |
| `go.mod`, `Cargo.toml` | Go, Rust |
| `composer.json`, `Gemfile`, `*.csproj`, `pubspec.yaml` | PHP, Ruby, .NET, Flutter/Dart |
| `Dockerfile*`, `docker-compose*`, `*.tf`, `k8s/`, `helm/` | Containers, IaC |
| `prisma/schema.prisma`, `migrations/`, `*.sql` | Database and ORM |
| CI files: `.github/workflows`, `bitbucket-pipelines.yml`, `.gitlab-ci.yml`, `Jenkinsfile` | CI system(s) |

Also detect: test framework, linter, formatter, type checker, API style (REST, GraphQL, gRPC), auth method, queue or worker usage, third-party services (payments, email, AI, storage).

## 3. Classify the project type

Pick all that apply. The type decides which dimensions apply.

`web-app` · `api-service` · `library` · `cli-tool` · `mobile-app` · `data-pipeline` · `infra-only` · `monorepo` · `other`

| Dimension | Skip when |
|---|---|
| `accessibility-ux` | no user interface |
| `data` | no database or persistent storage |
| `cicd-supply-chain` | never skip (at least check lockfiles) |
| `compliance` | `COMPLIANCE` is `none` and no personal data is handled |
| `cost` | no cloud or paid API usage found |
| `performance` | `DEPTH=quick` and no hot path found |

Never skip silently. Each skipped dimension appears in the report with the reason.

## 4. Map the architecture (one page)

- Containers/services and how they talk (a simple list: A → B via HTTP).
- Entry points: HTTP routes (count and where defined), jobs, CLI commands, event handlers.
- Data stores and what lives in each.
- Auth: how users sign in, how roles are checked, where tokens live.
- External services and what data is sent to them.
- Deployment: where it runs, how it is built and released.
- The **top five critical flows** (for example: login, create order, pay, export data, admin change). You will trace these in Stage 3.
- Trust boundaries: where untrusted input enters, and where sensitive data leaves.

## 5. Match stacks, with a fallback

For each detected stack, look for `stacks/<name>.md` in the kit.

- **Found:** load it at Stage 3.
- **Not found:** do **not** invent a file. Do this:
  1. Apply the stack-neutral dimension checks only.
  2. Record in the System Map: "No stack module for `<stack>`. Generic checks only. Coverage for this area is lower."
  3. This note must also appear in the report's coverage section.
  4. If `GENERATE_STACK_DRAFT` is `true`: after Checkpoint A, and only with the user's yes, write a draft to `stacks/_generated/<stack>.md` from `stacks/_TEMPLATE.md`. Mark it clearly **DRAFT, auto-generated, not human-reviewed**, with the date and the signals it used. Use it for this run only, and lower the confidence of findings that depend on it. Never copy text from the audited repo into it.

## 6. Commands

Fill in what the project itself uses, so you can refer to them later (do not run them yet):

`{{INSTALL_CMD}}` · `{{BUILD_CMD}}` · `{{TEST_CMD}}` · `{{LINT_CMD}}` · `{{TYPECHECK_CMD}}` · `{{START_CMD}}`

Running project scripts needs the user's approval at Checkpoint A (see principles §2).

## 7. Write `system-map.md`

Sections: Repos and commits · Stack and versions · Project type · Architecture (containers, entry points, data, auth, external services, deployment) · Critical flows · Trust boundaries · Dimensions in scope / skipped (with reasons) · Stack modules matched / missing · Commands · Tools planned · Open questions.

Keep it under two pages. Then stop at **Checkpoint A**.
