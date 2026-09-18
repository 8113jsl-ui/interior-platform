# Run and deploy the interior platform

The original landing is served at `/`; its entry links and form CTA open `/app/`. Landing form values are not copied into the app or submitted to the source website. Existing anchor navigation and source animation scripts are preserved. The application uses server sessions and private, authorized file routes.

This package includes deployment configuration. No hosted database, storage bucket, domain, account, or production deployment has been created or verified. Docker is not installed in the preparation environment, so the Docker image and Compose commands below have not been executed there. Check the main delivery report for application test results.

## Local start on Windows

Install Node.js 24 LTS and open a terminal in this package directory. Run:

```powershell
Copy-Item .env.example .env
npm ci
npm run setup
npm start
```

Do not overwrite an existing `.env` when upgrading. Setup prompts for the first owner's email, name, company and password. There are no default accounts or passwords. Run setup in a private terminal; keep the owner credentials in your password manager. Later users enter through one-time invitations generated in the authenticated app after the owner explicitly enables the participant policy. No email is sent automatically.

Open `http://127.0.0.1:8766` for the landing or `http://127.0.0.1:8766/app/` for login. `START.cmd` installs dependencies when absent and starts the server; on a fresh installation, stop it and run `npm run setup` to create the first owner. Keep `APP_ORIGIN` equal to the browser origin: `localhost` and `127.0.0.1` are different origins.

The local database and private uploads persist in `./data`. Restarting the server preserves them. Do not distribute this directory, `.env`, backups, or `node_modules` with a clean release.

## Docker with local SQLite

Install Docker with Compose v2. Copy `.env.example` to `.env`, keeping the local development values for this localhost check:

```text
docker compose build
docker compose run --rm app node server/cli.mjs setup
docker compose up -d app
docker compose ps
docker compose logs --tail=100 app
```

Open `http://127.0.0.1:8766/app/`. The HTTP health probe calls `GET /api/health`. A healthy probe confirms that the process responds; separately verify login, project changes, upload and authorized download before accepting a deployment.

The image uses Node 24, `npm ci --omit=dev`, and the unprivileged `node` user (UID/GID 1000). The `app-data` named volume mounts at `/app/data`; the image creates that directory owned by `node`. PostgreSQL uses a separate `postgres-data` volume. `docker compose down` preserves named volumes; **`docker compose down -v` deletes their data**.

If replacing the named volume with a Linux bind mount, create the host data directory with owner UID/GID 1000 and mode `0700` before starting. Do not solve a permission error by running the app as root or making private files world-writable. Existing volumes created with other ownership require an explicit ownership repair by the host operator. The container listens on all interfaces internally, but Compose publishes only `127.0.0.1:8766` on the host.

## Optional local PostgreSQL check

Choose a strong database password; no usable default is supplied. Set these values in `.env` (replace the illustrative password text with your actual secret; URI-encode special characters in the connection URL):

```dotenv
POSTGRES_PASSWORD=YOUR_CHOSEN_SECRET
DATABASE_URL=postgresql://interior:YOUR_URI_ENCODED_SECRET@postgres:5432/interior
POSTGRES_SSL=false
```

Start the database first and wait for its health check before running setup or starting the app:

```text
docker compose --profile postgres up -d --wait postgres
docker compose run --rm app node server/cli.mjs setup
docker compose up -d app
```

The profile database port is not published to the host. This is a local integration arrangement. Production should use a provisioned database with appropriate access controls, TLS, retention and restore testing. Switching `DATABASE_URL` selects a different database; it does not migrate an existing SQLite database automatically. Use the offline backup/restore process for migration into a fresh destination.

## Production settings and deployment sequence

Provision the hosting service, PostgreSQL database, HTTPS domain and optional private Supabase Storage bucket in your own account. Supply deployment access through your provider's secret manager or an approved secure channel. Do not paste production secrets into source files, browser code, screenshots or public logs.

1. Build the supplied Dockerfile from the package directory, including `package-lock.json`. Supply the image to your host's container service.
2. Add the server environment variables from the table below. Configure a persistent volume at `/app/data` unless all private files use Supabase and the database uses PostgreSQL. A persistent data directory is still useful for the app's operational files; do not rely on ephemeral container storage for backups.
3. Route the chosen HTTPS domain to container port `8766`. Configure the host's HTTP health check as `/api/health`. Keep the app and database off public administrative ports. The example Compose port binding is suitable for a reverse proxy on the same host; a proxy in another container should connect to `app:8766` on a private Docker network.
4. With normal application workers stopped, run `node server/cli.mjs setup` once in the configured deployment environment. Then start the application. Do not store bootstrap passwords in image layers or deployment commands.
5. Check HTTPS login, logout, session expiry, project creation, separate-role access, file upload/download and backup restoration with the actual hosted services. Redeploy/restart once and confirm data persistence. Record the deployment URL and the verification results.

| Variable | Production value / meaning |
| --- | --- |
| `NODE_ENV` | `production`; enables the production configuration checks. |
| `APP_ORIGIN` | Exact HTTPS origin, such as `https://interior.example.com`, with no path. This is the browser origin used for same-origin checks. |
| `HOST`, `PORT` | Container: `0.0.0.0`, `8766`. Native local execution defaults to `127.0.0.1`, `8766`. |
| `DATABASE_URL` | Private PostgreSQL connection URL supplied by your database provider. Credentials remain server-side. |
| `POSTGRES_SSL` | `true` for a hosted TLS database. The optional local Compose database uses `false`. |
| `POSTGRES_SSL_CA` | Optional trusted CA certificate as PEM text for a provider/private CA. Use the secret manager's multiline support. Do not disable certificate verification to work around an invalid certificate. |
| `DATA_DIR` | `/app/data` in the supplied container; a private persistent directory for native execution. |
| `SESSION_DAYS` | Session lifetime, default `7`. |
| `ALLOW_SQLITE_PRODUCTION` | Default `false`. A deliberate `true` permits SQLite in production; only use it on a single instance with a persistent volume and tested backups. PostgreSQL is required otherwise. |
| `SUPABASE_URL` | Optional project URL for private file storage; configure together with the key and bucket. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional privileged server-only Supabase storage key. Never place it in `public/`, a browser build variable, an API response, or client code. |
| `SUPABASE_BUCKET` | Existing **private** bucket name. Do not make the bucket public to enable image previews. The application streams authorized files through `/api/files/{id}`. |

Keep the database reachable only from the application or approved operator tooling. Never expose PostgreSQL directly to end users. Use database credentials limited to the application's database, and retain the provider's recovery credentials separately. Supabase Storage configuration does not replace `DATABASE_URL`: storage and database connections are separate concerns. Rotating a service key requires updating the server secret and restarting the application.

Production requires an HTTPS `APP_ORIGIN`. Local HTTP settings are for local development. Setting a production origin without providing a working TLS endpoint is not a completed deployment. Provider-specific DNS, certificates, networking, resource sizing and permissions remain to be configured and tested once the provider and credentials are supplied.

## Offline backup, migration and restore

Stop every application instance before running backup or restore. Keep database credentials and storage credentials configured for the relevant source/destination. Treat backups as sensitive: they contain the full database and private files, rather than an individual user's filtered export.

For native execution, run these from the package directory with the server stopped:

```text
node --env-file-if-exists=.env server/cli.mjs backup ./backups/first-backup
```

The target must be a new directory. The CLI writes `export.json` and a `files` directory. Supabase files are downloaded into the backup as well. Retain both together, encrypt the backup using your organization's backup system, and store a separate copy outside the server. Do not consider a backup verified until it has been restored and checked.

To restore or migrate, configure `.env` for a **new, empty destination database** and destination storage. For SQLite, choose a new empty `DATA_DIR`; for PostgreSQL, provision a new empty application database and set its `DATABASE_URL`. Do not point the command at the live source database. Then run:

```text
node --env-file-if-exists=.env server/cli.mjs restore ./backups/first-backup --confirm
```

Restore requires a stopped server and an empty destination; it does not overwrite an existing application database. It rehydrates files into the configured local or Supabase storage. Validate the restored application privately before changing production traffic. Keep the old deployment and backup available until that validation passes.

For a Compose backup, keep the database service available but stop the application, then run:

```text
docker compose stop app
docker compose run --rm app node server/cli.mjs backup /app/data/backups/first-backup
docker compose cp app:/app/data/backups/first-backup ./backups/first-backup
docker compose up -d app
```

Create the local `backups` parent directory before the copy. The first backup copy inside the named volume is not an off-server backup; retain the copied directory elsewhere. For a Compose restore, first provision a fresh app data volume and empty database, mount the backup directory read-only at `/backup`, and run the same restore CLI in a one-off app container against that new configuration. Never attach the live app volume as a restore destination.

## Owner password recovery

An authorized server operator can issue a one-time password-reset URL:

```text
node --env-file-if-exists=.env server/cli.mjs reset-password owner@example.com
```

Use the actual owner's email. The printed URL is a secret; deliver it only to the verified account owner. This CLI is operational access, not a public administrator portal. After recovery, confirm login and review operator access.

## Updating and accepting a release

Take and verify a backup before deployment. Keep `.env` and data outside the image. Build the new image, stop old instances for any required database changes, start the updated instance and review logs. Test the core role-based workflows against the actual production configuration. Application tests do not by themselves verify your DNS, TLS termination, database networking, storage policy, volume persistence or recovery process.
