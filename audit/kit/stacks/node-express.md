# Node.js / Express API stack module

**Detection signals:** `package.json` with `express` (also `fastify`, `koa` for similar checks), `app.js`/`server.js`/`src/index.ts` calling `express()`, `routes/` or `controllers/` folders, lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`).

**Loads with dimensions:** security, reliability, performance, testing, code-health, data (when an ORM or driver is used).

## Vulnerability and defect patterns

### Security
- Routes with no auth middleware: list every `app.use`/`router.get|post|put|patch|delete` and check which have `authenticate`-style middleware. Unprotected routes are open to anyone.
- Authorization only checks "logged in", not ownership or role: look for `req.params.id` used in a query without a `userId`/tenant filter (IDOR).
- `req.body`, `req.query`, `req.params` passed straight into a DB call, `Object.assign`, or spread into a model: mass assignment and injection. Look for a `zod`/`joi`/`yup`/`express-validator` schema on each route.
- Mongo-style operator injection: `find(req.body)` or `{ email: req.body.email }` where the value can be an object like `{ "$ne": null }`.
- Prototype pollution: recursive merge or `lodash.merge`/`defaultsDeep`/`Object.assign` on user JSON; keys `__proto__`, `constructor`, `prototype`.
- `child_process.exec`, `execSync`, `spawn(..., { shell: true })` with user input: command injection. Prefer `execFile` with an args array.
- `eval`, `new Function`, `vm.runInNewContext`, `require(userInput)`: code execution.
- Path traversal: `fs.readFile`, `res.sendFile`, `path.join(base, req.params.x)` with no check that the resolved path stays inside `base`; check `express.static` roots too.
- JWT: `jwt.verify` missing, `jwt.decode` used for trust, `algorithms` not pinned, hardcoded or short secret, no `exp`, no audience or issuer check. `algorithm: 'none'` accepted.
- Password handling: plain `md5`/`sha1`/`sha256` for passwords instead of `bcrypt`/`argon2`/`scrypt`; `==` comparison of secrets instead of `crypto.timingSafeEqual`.
- Regex DoS: user input run through nested-quantifier regexes like `(a+)+`, or `new RegExp(req.query.x)`.
- SSRF: `axios`/`fetch`/`got` called with a user-supplied URL and no allow-list.
- Open redirect: `res.redirect(req.query.next)` with no allow-list.
- File upload (`multer`): no `limits`, no type check by content, files saved under the web root or with the client file name.

### Data
- Raw SQL built by string concatenation or template literals (`pg`, `mysql2`, `knex.raw`, `sequelize.query`): SQL injection. Look for placeholders (`$1`, `?`).
- Multi-step writes without a transaction: partial data on failure.

### Performance
- Sync APIs in request paths: `fs.readFileSync`, `execSync`, `bcrypt.hashSync`, large `JSON.parse`: they block the event loop.
- DB or HTTP calls inside `for`/`forEach`/`map` loops (N+1); `await` in a loop where `Promise.all` or a batch query would do.
- List endpoints with no pagination or `limit` cap.

### Reliability
- Async handler without error forwarding: on Express 4, a rejected promise in `async (req,res)` is not caught; needs `try/catch` + `next(err)` or a wrapper. Express 5 forwards rejections.
- No central error middleware (4 args: `err, req, res, next`) placed last; stack traces returned to clients.
- No `process.on('unhandledRejection')` / `uncaughtException` policy; no `SIGTERM`/`SIGINT` handler calling `server.close()` and closing DB pools (graceful shutdown).
- Outbound calls with no timeout (`axios` default is none) and no retry or circuit policy.
- In-memory state (sessions, rate-limit counters, caches) breaks with more than one instance.

### Testing
- Routes with no test; auth and role checks with no negative test (wrong role, no token, other user's id).
- Tests that mock the DB so heavily that queries are never exercised; `supertest` is the usual route test tool.

### Code health
- Business logic inside route handlers; no service layer; duplicated validation.
- `console.log` of request bodies, tokens, or passwords instead of a structured logger (`pino`, `winston`) with redaction (`redact` paths).
- Mixed `require` and `import` styles, `any`-heavy TypeScript, dead routes.

## Framework misconfigurations

- `helmet()` missing or applied after routes; `app.disable('x-powered-by')` not set.
- `cors()` with no options, or `origin: true`/`'*'` together with `credentials: true`.
- `express.json()` with no `limit` (default is 100kb, check it was not raised to a huge value); `express.urlencoded({ extended: true })` on untrusted input.
- No rate limit (`express-rate-limit`, `rate-limiter-flexible`) on login, signup, password reset, OTP routes.
- `app.set('trust proxy')` unset behind a proxy (wrong client IP, broken rate limits) or set to `true` blindly.
- Cookies: `httpOnly`, `secure`, `sameSite` missing on session or token cookies; `express-session` default `MemoryStore` in production.
- Middleware order: body parser, auth, then routes; error handler last. Auth registered after a route does not protect it.
- `NODE_ENV` not `production` (Express then returns stack traces and skips view caching).
- Secrets read from `.env` committed to git; no startup check that required env vars exist.

## Scanner and project commands

All run only if approved at Checkpoint A (they can execute project code or use the network).
- Dependency audit: `npm audit --json` (npm), `yarn npm audit` (Yarn Berry), `pnpm audit`; or `osv-scanner` on the lockfile (read-only, preferred).
- Lint: `npx eslint .` (check for `eslint-plugin-security`, `eslint-plugin-sonarjs` in config).
- Typecheck: `npx tsc --noEmit`.
- Tests: the `test` script in `package.json` (often `jest` or `vitest run`); read the script first.
- Coverage: `npx jest --coverage` or `npx vitest run --coverage` (needs a coverage provider).
- Build: the `build` script in `package.json` (often `tsc`).
- Unused deps and circular imports: `npx knip`, `npx depcheck`, `npx madge --circular src`.

## Where to look first

- Entry: `src/app.(js|ts)`, `src/server.(js|ts)`, `index.js`; middleware order is visible here.
- Routes: `src/routes/`, `src/controllers/`, `src/modules/*/`.
- Auth: `src/middleware/auth*`, `src/middlewares/`, `passport` config, JWT helpers in `utils/` or `lib/`.
- Config: `src/config/`, `.env.example`, `process.env` usage (grep it).
- Migrations: `migrations/`, `prisma/`, `knex` or `sequelize` folders.
- Tests: `tests/`, `__tests__/`, `*.test.ts`, `*.spec.ts`.

## Looks wrong but is fine

- `jwt.decode` used only to read a claim for logging or UI after `verify` has already run.
- `cors({ origin: '*' })` on a public, unauthenticated, read-only API with no cookies.
- `console.log` in scripts, seeders, and CLI entry points.
- `eval`-looking names such as `evaluate()` or `retrieval`; check the real call.
- Hardcoded test secrets in `*.test.*` or `.env.example` with obvious placeholder values.
- `execFile`/`spawn` with a fixed command and a constant args array.

## Version notes

- Express 4 vs 5: async rejections are auto-forwarded only in 5; `req.query` parsing and path-to-regexp syntax changed in 5.
- Node versions past end of life get no security fixes; check `engines` and the Dockerfile base image.
- `body-parser` is bundled with Express 4.16+; a separate old `body-parser` dependency may be stale.
- `jsonwebtoken` 9+ tightened key and algorithm checks; older majors accept weaker setups.
- Verify against the installed version.
