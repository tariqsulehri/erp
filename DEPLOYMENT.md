# Deployment Runbook

How to install, update, back up, restore and roll back the ERP on a server. Commands run in the
`deployment/` folder on the server unless stated otherwise.

## What Runs Where

| Container | Image | Purpose |
| --- | --- | --- |
| `migrate` | `tariqsulehri/erp-be:<version>` | Runs once per deploy: installs a new database or applies pending migrations, then exits |
| `erp_be` | `tariqsulehri/erp-be:<version>` | Backend API on `127.0.0.1:3071` (port 5000 inside Docker) |
| `erp_fe` | `tariqsulehri/erp-fe:<version>` | Frontend on port `3070`; the browser only talks to this |
| `erp_caddy` (optional) | `caddy:2.8-alpine` | HTTPS on ports 80/443 with automatic certificates |

PostgreSQL runs outside these containers. The backend reaches it through `DATABASE_URL`.

## Release Images

Build and push from a clean checkout of the release commit. Always use a version number, never `latest`.

```bash
VERSION=1.4.0
docker build --platform linux/amd64 -t tariqsulehri/erp-be:$VERSION backend
docker build --platform linux/amd64 -t tariqsulehri/erp-fe:$VERSION frontend
docker push tariqsulehri/erp-be:$VERSION
docker push tariqsulehri/erp-fe:$VERSION
```

## First Install On A New Server

1. Install Docker and Docker Compose, then copy the `deployment/` folder to the server (for example `/opt/erp/deployment`).
2. Create the database and an application user in PostgreSQL. Allow port 5432 only from this server.
3. Create the settings files and fill in every value:
   ```bash
   cp .env.backend.example .env.backend
   cp .env.frontend.example .env.frontend
   openssl rand -hex 32   # run twice: one value for JWT_SECRET, a different one for NEXTAUTH_SECRET
   chmod 600 .env.backend .env.frontend
   ```
4. Deploy. On an empty database the `migrate` job loads the full schema automatically:
   ```bash
   ./deploy.sh 1.4.0
   ```
5. Create the first Admin user (one time), then remove `INITIAL_ADMIN_*` from `.env.backend`:
   ```bash
   docker compose run --rm -e INITIAL_ADMIN_EMAIL=admin@company.com -e INITIAL_ADMIN_PASSWORD='a-long-password' \
     backend node dist/scripts/seed-admin.js
   ```
6. Sign in, open **Settings → Posting Accounts**, check every account (including **Year-End Closing Account**), and set up the Fiscal Year.

## HTTPS

1. Point a domain (for example `erp.company.com`) at the server and open ports 80 and 443.
2. In `.env.frontend` set `NEXTAUTH_URL=https://erp.company.com`; in `.env.backend` set `CORS_ORIGIN=https://erp.company.com`.
3. Deploy with the domain set, and keep port 3070 private:
   ```bash
   export APP_DOMAIN=erp.company.com FRONTEND_BIND=127.0.0.1
   ./deploy.sh 1.4.0
   ```
   Put both exports in the deploy user's shell profile so every later deploy keeps HTTPS on.

## Update To A New Version

```bash
./deploy.sh 1.5.0
```

The script:
1. pulls the images;
2. takes a database backup into `backups/`;
3. runs the `migrate` job;
4. recreates only changed containers;
5. waits for both health checks.

It stops at the first failure, and every successful deploy is recorded in `.deploy-history`.

## Roll Back

```bash
tail .deploy-history          # find the previous version
./rollback.sh 1.4.0
```

Rollback changes containers only. If the failed version applied a migration that the previous version
cannot work with, restore the backup taken just before that deploy (`backups/erp-<time>-before-1.5.0.dump`), then roll back.

## Backups

- `deploy.sh` takes a backup before every deploy.
- Schedule a nightly backup with cron on the server:
  ```
  15 1 * * * cd /opt/erp/deployment && ./backup.sh nightly >> backups/backup.log 2>&1
  ```
- Local backups older than 30 days are deleted (`KEEP_DAYS` changes this).
- **Copy backups off the server every day**, for example with `rclone` or `aws s3 sync backups/ s3://<bucket>/erp/`. A backup on the same disk does not survive a disk or server loss.

## Restore

Practise this once on a test database before go-live, and after any PostgreSQL upgrade.

```bash
# 1. Stop the app so nobody posts during the restore
docker compose stop frontend backend

# 2. Restore into the database named in DATABASE_URL (this replaces its contents)
docker compose run --rm --no-deps -T migrate sh -c \
  'pg_restore --clean --if-exists --no-owner --dbname "${DATABASE_URL%%\?*}"' < backups/erp-20261026-011500-nightly.dump

# 3. Start the app again
docker compose up -d backend frontend
```

After restoring, open the Trial Balance and Balance Sheet and confirm the difference is 0.00.

## Health And Logs

| Check | Address |
| --- | --- |
| Backend alive | `curl http://127.0.0.1:3071/health` |
| Backend can reach the database | `curl http://127.0.0.1:3071/health/database` |
| Frontend alive | `curl http://127.0.0.1:3070/api/health` |

The backend writes one JSON line per request and per server error, each with a `requestId`.
When a user reports "Unexpected server error. Reference: <id>", search the log for that ID:

```bash
docker compose logs backend | grep '<id>'
```

## Database Schema Changes (Developers)

- Add migrations with Prisma in `backend/prisma/migrations`. Never edit a migration that has been deployed.
- The early migrations cannot build a new database by themselves, so new databases are created from
  `backend/prisma/fresh-install/schema.sql`. After adding a migration, refresh that snapshot from a database
  that has every migration applied and commit both together:
  ```bash
  cd backend
  SNAPSHOT_DATABASE_URL=postgresql://user:password@localhost:5432/erp_dev npm run db:snapshot
  ```
- CI builds a new database from the snapshot and runs all tests against it, so a missing snapshot update fails the build.
