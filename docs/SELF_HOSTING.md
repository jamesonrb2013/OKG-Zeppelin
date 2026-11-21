# Self-hosting OKG Administrative & Management

This guide explains how to deploy your own independent instance of **OKG Administrative & Management** (the OKG-Zeppelin codebase), starting with an empty server and ending with a working Discord bot, API, and web dashboard.

You control your own Discord application, hosting, database, Redis service, domain, credentials, and backups. Your instance is separate from the official OKG deployment.

> **Important:** These instructions describe the repository's current code and configuration. The lightweight Docker Compose deployment builds the code in your own checkout. The standalone Compose file uses the prebuilt `dragory/zeppelin` image; do not assume that image contains custom changes from your fork. If you want to run the exact code you cloned, use the lightweight deployment below.

## 1. What you need

### Required accounts and services

- A Discord account with permission to create an application and add a bot to a server.
- A GitHub account and access to this repository.
- A Linux server or VPS for a reliable 24/7 deployment. Docker Desktop can be used for testing on Windows or macOS.
- A MySQL-compatible database. The application uses MySQL through TypeORM.
- A Redis-compatible service. The application requires `REDIS_URL`.
- A domain name or subdomains for the dashboard and API, plus HTTPS/TLS in front of them for public production use.

### Recommended server resources

For a small community, start with at least 2 CPU cores and 2–4 GB RAM, plus enough disk for the database, logs, and backups. Actual requirements depend on server size, traffic, enabled modules, and media/archive usage. Keep MySQL and Redis storage persistent.

### Software

- Git
- Docker Engine and the Docker Compose v2 plugin
- A reverse proxy or secure tunnel for HTTPS (Caddy, Nginx, or Cloudflare Tunnel)
- Optional for manual/non-Docker deployment: Node.js 24 or newer and pnpm 11.19.0

You do not need to install Node.js or pnpm on the host when using the repository's Docker Compose build.

## 2. Create your Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application** and give it a name, such as `My OKG Manager`.
3. Open **Bot** and create/add the bot if Discord has not already done so.
4. Copy the bot token. Keep it private; anyone with it can control your bot.
5. Open **OAuth2 → General** and copy the **Client ID** and **Client Secret**.
6. Under OAuth2 redirect URLs, add the callback URL you will use after choosing your public API URL. Its exact format is:

   `<API_URL>/auth/oauth-callback`

   For example, if `API_URL=https://api.example.com/api`, register:

   `https://api.example.com/api/auth/oauth-callback`

7. Under **Bot → Privileged Gateway Intents**, enable the intents required by the modules you plan to use. At minimum, review Server Members, Message Content, and Presence intents against your enabled features. Only enable privileged intents you actually need.
8. Generate an installation URL using the `bot` and `applications.commands` scopes. Select the permissions your bot needs, then use that URL to invite it to your test Discord server.

**Keep the application credentials private.** Never paste your bot token, client secret, database password, Redis password, or generated encryption key into a public issue, screenshot, commit, or support message.

## 3. Prepare your server and clone the repository

On an Ubuntu/Debian server, install Git and Docker Engine with the official Docker instructions:

- [Install Docker Engine](https://docs.docker.com/engine/install/)
- [Install the Docker Compose plugin](https://docs.docker.com/compose/install/linux/)

Then clone the repository:

```bash
git clone https://github.com/jamesonrb2013/OKG-Zeppelin.git
cd OKG-Zeppelin
```

If you are deploying a fork, replace the repository URL with your own fork. Keep the repository's complete workspace; the Docker build needs the root workspace files and the `backend`, `shared`, and `dashboard` packages.

Check Docker is available:

```bash
docker --version
docker compose version
```

## 4. Choose your deployment layout

There are two production layouts in the repository:

| Layout | What it provides | Best use |
| --- | --- | --- |
| Lightweight | Builds the checked-out source and runs migration, API, bot, and dashboard containers. You provide MySQL, Redis, and HTTPS/reverse proxy. | Recommended for running your own fork or customized OKG instance. |
| Standalone | Includes MySQL, Redis, and an Nginx container, using the prebuilt `dragory/zeppelin` image. | Only use when that image is the version you intend to run. It may not include your fork's custom code. |

The rest of this guide uses **Lightweight**, so your deployment is built from the source you cloned.

## 5. Create MySQL and Redis

### MySQL

Create a database and a dedicated database user for this instance. Example SQL (run as a MySQL administrator):

```sql
CREATE DATABASE okg_manager
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'okg_manager'@'%' IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';

GRANT ALL PRIVILEGES ON okg_manager.* TO 'okg_manager'@'%';
FLUSH PRIVILEGES;
```

Restrict database network access to the application host or private network. Do not expose MySQL's port to the public internet.

The application checks that the database server uses **UTC**. Configure the MySQL server/session timezone as UTC before starting the app. The current database driver enables TLS with certificate verification disabled; use a trusted/private network and follow your database provider's security guidance.

### Redis

Provision a Redis-compatible service and keep it private. The application requires a non-empty `REDIS_URL`. Use the private/internal connection URL supplied by your Redis host.

Examples:

```dotenv
# Redis without authentication, reachable from the application container
REDIS_URL=redis://redis-host:6379

# Redis with username/password (URL-encode special characters in credentials)
REDIS_URL=redis://default:YOUR_PASSWORD@redis-host:6379

# Redis over TLS, if your provider requires it
REDIS_URL=rediss://default:YOUR_PASSWORD@redis-host:6380
```

Do not use `localhost` in a container's Redis URL unless Redis is running in that same container. In Docker Compose, `localhost` means the current container, not another service.

> **Configuration note:** `REDIS_URL` is required by the current environment schema, even though it is not currently listed in the checked-in `.env.example`. Add it yourself before starting any service. The standalone Compose file includes a Redis container named `redis`, so its internal URL is normally `redis://redis:6379`. The lightweight Compose file does not create Redis; supply a reachable Redis service yourself.

## 6. Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` and fill in the values. For a lightweight deployment, a typical configuration looks like this:

```dotenv
# Required application secrets
KEY=REPLACE_WITH_EXACTLY_32_RANDOM_CHARACTERS
CLIENT_ID=YOUR_DISCORD_APPLICATION_CLIENT_ID
CLIENT_SECRET=YOUR_DISCORD_OAUTH2_CLIENT_SECRET
BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN

# Public URLs; use the final HTTPS URLs that users will visit
DASHBOARD_URL=https://manager.example.com
API_URL=https://api.example.com/api

# Required Redis connection
REDIS_URL=redis://YOUR_REDIS_PRIVATE_HOST:6379

# Optional access and server defaults
STAFF=
DEFAULT_ALLOWED_SERVERS=

# Optional database credentials for direct/manual runs.
# The lightweight Compose file uses the LIGHTWEIGHT_DB_* variables below.
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_DATABASE=

# Lightweight Compose settings
LIGHTWEIGHT_API_PORT=3001
LIGHTWEIGHT_DASHBOARD_PORT=3002
LIGHTWEIGHT_DB_HOST=YOUR_MYSQL_PRIVATE_HOST
LIGHTWEIGHT_DB_PORT=3306
LIGHTWEIGHT_DB_USER=okg_manager
LIGHTWEIGHT_DB_PASSWORD=REPLACE_WITH_DATABASE_PASSWORD
LIGHTWEIGHT_DB_DATABASE=okg_manager
LIGHTWEIGHT_API_PATH_PREFIX=/api

# Production mode
NODE_ENV=production
DEBUG=false
```

Generate a 32-character key on Linux/macOS with:

```bash
openssl rand -hex 16
```

Paste the resulting 32-character value into `KEY`. Do not reuse a public example key.

### Complete environment variable reference

The following variables are read by the backend environment validator or are defined in the repository's deployment template. Variables marked as required must be supplied for the relevant deployment.

| Variable | Required? | Purpose / value |
| --- | --- | --- |
| `KEY` | Yes | Application encryption/signing key. Must be exactly 32 characters. Generate a private random value. |
| `CLIENT_ID` | Yes | Discord application's Client ID. Must be at least 16 characters. |
| `CLIENT_SECRET` | Yes | Discord OAuth2 Client Secret. Must be exactly 32 characters. |
| `BOT_TOKEN` | Yes | Discord bot token. Must be at least 50 characters. |
| `DASHBOARD_URL` | Yes | Full public dashboard URL, including scheme. Used for API CORS and login redirects. |
| `API_URL` | Yes | Full public API URL, including any configured path prefix. Used to build the Discord OAuth callback URL. |
| `REDIS_URL` | Yes | Redis connection URL. Must be non-empty. |
| `STAFF` | No | Comma-separated Discord user IDs that can access global/staff commands. |
| `DEFAULT_ALLOWED_SERVERS` | No | Comma-separated Discord server IDs allowed by default. The built-in OKG core guild ID `1488682722606977175` is always included by the current code. |
| `PHISHERMAN_API_KEY` | No | Optional API key for the Phisherman integration, if you use that feature. |
| `FISHFISH_API_KEY` | No | Optional API key for the FishFish integration, if you use that feature. |
| `DEFAULT_SUCCESS_EMOJI` | No | Success reaction/indicator. Defaults to `✅`. |
| `DEFAULT_ERROR_EMOJI` | No | Error reaction/indicator. Defaults to `❌`. |
| `DB_HOST` | Depends | Direct/manual database hostname. Defaults to `mysql` in the backend data source. |
| `DB_PORT` | Depends | Direct/manual database port. Defaults to `3306`. |
| `DB_USER` | Depends | Direct/manual database username. Defaults to `zeppelin`. |
| `DB_PASSWORD` | Depends | Direct/manual database password. Falls back to `DEVELOPMENT_MYSQL_PASSWORD` if not set. |
| `DB_DATABASE` | Depends | Direct/manual database name. Defaults to `zeppelin`. |
| `DEVELOPMENT_MYSQL_PASSWORD` | No | Development database password fallback; not a production secret strategy. |
| `API_PATH_PREFIX` | No | Prefix mounted before API routes. Production default is empty; development default is `/api`. Set `/api` if your public API URL ends in `/api`. |
| `DEBUG` | No | Set to the literal string `true` to enable debug behavior. Otherwise treated as false. |
| `NODE_ENV` | No | Runtime environment. Defaults to `development`; set to `production` for deployments. |

### Variables in the root `.env.example` for Docker Compose

These variables configure the supplied Compose files. They are not all backend application variables.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `LIGHTWEIGHT_API_PORT` | Lightweight | Host port mapped to the API container's port 3001. |
| `LIGHTWEIGHT_DASHBOARD_PORT` | Lightweight | Host port mapped to the dashboard container's port 3002. |
| `LIGHTWEIGHT_DB_HOST` | Lightweight | MySQL hostname reachable from the containers. |
| `LIGHTWEIGHT_DB_PORT` | Lightweight | MySQL port. |
| `LIGHTWEIGHT_DB_USER` | Lightweight | MySQL username. |
| `LIGHTWEIGHT_DB_PASSWORD` | Lightweight | MySQL password. |
| `LIGHTWEIGHT_DB_DATABASE` | Lightweight | MySQL database name. |
| `LIGHTWEIGHT_API_PATH_PREFIX` | Lightweight | API route prefix, usually `/api`. |
| `STANDALONE_WEB_PORT` | Standalone | Host port mapped to the bundled Nginx HTTPS port 443. |
| `STANDALONE_MYSQL_PORT` | Standalone | MySQL host port, bound to loopback in the supplied Compose file. |
| `STANDALONE_MYSQL_PASSWORD` | Standalone | Password for the bundled `zeppelin` MySQL user. |
| `STANDALONE_MYSQL_ROOT_PASSWORD` | Standalone | Password for the bundled MySQL root user. |
| `DEVELOPMENT_WEB_PORT` | Development | Host port for the development web environment. |
| `DEVELOPMENT_MYSQL_PORT` | Development | Host port for development MySQL access. |
| `DEVELOPMENT_MYSQL_ROOT_PASSWORD` | Development | Root password for the development database container. |
| `DEVELOPMENT_SSH_PORT` | Development | Host port for the development container's SSH server. |
| `DEVELOPMENT_SSH_PASSWORD` | Development | SSH password for the development container. |
| `CF_TUNNEL_TOKEN` | Optional tunnel profile | Cloudflare Tunnel token when using the corresponding Compose tunnel profile. |

The root example also contains commented `OMNIROUTE_API_KEY` and `OMNIROUTE_BASE_URL` placeholders for optional OKG AI/OmniRoute integration. They are not part of the current Zod environment schema shown in `backend/src/env.ts`; do not assume they are required for the bot, API, or dashboard to start. Configure them only if the AI integration in the version you deploy explicitly supports them.

### Important URL matching rules

- `DASHBOARD_URL` must be the public origin of your dashboard, for example `https://manager.example.com`.
- `API_URL` must be the public API base URL, including the prefix if you use one, for example `https://api.example.com/api`.
- `LIGHTWEIGHT_API_PATH_PREFIX` and `API_URL` must agree. If the prefix is `/api`, set `API_URL` to end in `/api`.
- Register the exact callback `<API_URL>/auth/oauth-callback` in the Discord Developer Portal.
- Use HTTPS for both public URLs. Do not use a trailing slash unless your reverse proxy and callback registration are configured consistently.

## 7. Deploy with Docker Compose (recommended)

Confirm that your `.env` contains all required application credentials, `REDIS_URL`, and the `LIGHTWEIGHT_DB_*` settings.

Validate the Compose file:

```bash
docker compose -f docker-compose.lightweight.yml config
```

Build and start the services:

```bash
docker compose -f docker-compose.lightweight.yml up -d --build
```

The deployment runs these containers/jobs:

- **migrate** — runs the database migrations and exits after success.
- **api** — starts the HTTP API on container port 3001.
- **bot** — starts the Discord bot process.
- **dashboard** — serves the built dashboard on container port 3002.

The API and dashboard ports are published using `LIGHTWEIGHT_API_PORT` and `LIGHTWEIGHT_DASHBOARD_PORT`. The bot does not need a public inbound port.

Check status:

```bash
docker compose -f docker-compose.lightweight.yml ps
```

Follow logs:

```bash
docker compose -f docker-compose.lightweight.yml logs -f
```

Follow one service:

```bash
docker compose -f docker-compose.lightweight.yml logs -f bot
docker compose -f docker-compose.lightweight.yml logs -f api
docker compose -f docker-compose.lightweight.yml logs -f dashboard
docker compose -f docker-compose.lightweight.yml logs -f migrate
```

The migration container should finish successfully before the API and bot are considered ready. If it fails, inspect its logs before restarting the application.

## 8. Configure domains and HTTPS

For a public deployment, place a reverse proxy or secure tunnel in front of the API and dashboard. The app's API and dashboard servers listen on HTTP internally; do not expose them directly to the internet without TLS and appropriate network controls.

A common layout is:

| Public hostname | Forward to |
| --- | --- |
| `manager.example.com` | Dashboard host port, usually `127.0.0.1:3002` |
| `api.example.com` | API host port, usually `127.0.0.1:3001` |

Configure your proxy to:

1. Terminate HTTPS and renew certificates automatically.
2. Forward requests to the correct internal port.
3. Preserve the request path, including `/api` if you configured that prefix.
4. Support the request body sizes your instance needs. The API accepts JSON bodies up to 50 MB in the current source.
5. Avoid caching authenticated API responses.
6. Keep database and Redis ports private.

After setting the public URLs, update `DASHBOARD_URL`, `API_URL`, and `LIGHTWEIGHT_API_PATH_PREFIX` in `.env`, then recreate the affected containers:

```bash
docker compose -f docker-compose.lightweight.yml up -d
```

Also update the Discord OAuth2 redirect URL to exactly:

```
https://api.example.com/api/auth/oauth-callback
```

Replace the example host and prefix with your actual configuration.

## 9. First login and server access

1. Confirm the bot is online in Discord.
2. Open your dashboard URL.
3. Select **Login with Discord**.
4. Authorize the Discord OAuth2 request.
5. Confirm the Discord account has access to at least one server where the bot is installed and allowed.
6. If you configured `STAFF`, verify the user ID is included exactly as a Discord ID, without a mention wrapper.
7. Open the server in the dashboard and configure its modules and permissions.

The bot's presence in a server alone does not automatically grant every Discord user dashboard access. Use the application's owner/staff permission workflow and the dashboard's access controls.

## 10. Manual deployment without Docker

Manual deployment is intended for operators who are comfortable managing Node.js processes, dependency installation, reverse proxies, and service restarts.

Install Node.js 24 or newer and pnpm 11.19.0, then clone the repository and configure the root `.env` file as described above.

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm run build
```

Run database migrations once:

```bash
pnpm run run:migrate
```

Then run each process separately (use a process manager such as systemd or PM2 in production):

**Terminal/service 1 — API**

```bash
pnpm run run:api
```

**Terminal/service 2 — Bot**

```bash
pnpm run run:bot
```

**Terminal/service 3 — Dashboard**

```bash
pnpm run run:dashboard
```

The API defaults to port 3001 and the dashboard defaults to port 3002. The bot process also starts a lightweight health endpoint using `PORT` when that variable is supplied, otherwise port 10000. Configure your process manager to restart failed processes and stop them gracefully.

For manual deployment, set the backend's direct database variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE`) and `REDIS_URL`. The lightweight Compose variables are only used by the supplied lightweight Compose file.

## 11. Updating your instance

Back up the database first. Then update your checkout:

```bash
git pull
```

Rebuild and recreate the services:

```bash
docker compose -f docker-compose.lightweight.yml up -d --build
```

The migration service runs as part of the Compose startup dependency chain. Check its result and then inspect the bot/API logs:

```bash
docker compose -f docker-compose.lightweight.yml ps
docker compose -f docker-compose.lightweight.yml logs --tail=200 migrate api bot
```

Do not delete database volumes or wipe your database to fix an ordinary deployment issue. Review release notes and migration instructions before upgrading across major changes.

## 12. Backups and security

- Schedule automated MySQL backups and test restoring them.
- Enable persistence and backups for Redis if the features you use rely on Redis state.
- Keep `.env` out of Git. Never commit secrets.
- Use unique, strong passwords for MySQL and Redis.
- Restrict MySQL and Redis to private networking.
- Use HTTPS for the dashboard and API.
- Limit server/host firewall access to the ports you actually need.
- Keep Docker, the operating system, Node dependencies, and the application updated.
- Rotate a Discord bot token immediately if it is exposed. Update the deployment environment and recreate the bot container.
- Back up your encryption key `KEY` securely. Losing it may prevent the instance from reading data encrypted with the previous key.
- Do not share database dumps, logs, or environment files publicly; they may contain user data or secrets.

## 13. Troubleshooting

### The app exits immediately with an environment validation error

Check that `KEY`, `CLIENT_ID`, `CLIENT_SECRET`, `BOT_TOKEN`, `DASHBOARD_URL`, `API_URL`, and `REDIS_URL` are present and correctly formatted. The current schema requires `KEY` to be 32 characters and `CLIENT_SECRET` to be 32 characters.

### Redis connection errors

- Confirm `REDIS_URL` is set in the environment of every application container.
- Confirm the hostname and port are reachable from inside the container.
- Do not use `localhost` to refer to a separate Redis container.
- Check authentication and TLS requirements in the provider's connection URL.

### MySQL connection errors

- Confirm the database host, port, username, password, and database name.
- In lightweight Compose, check the `LIGHTWEIGHT_DB_*` variables.
- Confirm the MySQL server accepts connections from the Docker host/private network.
- Confirm the database timezone is UTC.
- Check that the database exists and the application user has privileges on it.

### Discord login redirects with an OAuth error

- Confirm `CLIENT_ID` and `CLIENT_SECRET` belong to the same Discord application as `BOT_TOKEN`.
- Confirm the OAuth2 redirect URL exactly matches `<API_URL>/auth/oauth-callback`.
- Confirm the API is reachable over HTTPS.
- Confirm `API_URL` includes the same path prefix configured in `LIGHTWEIGHT_API_PATH_PREFIX`.

### Dashboard loads but API calls fail

- Check `window.API_URL` is populated from the dashboard container's `API_URL` environment variable.
- Check the API container logs.
- Confirm `DASHBOARD_URL` exactly matches the public dashboard origin allowed by API CORS.
- Check reverse proxy path forwarding and TLS configuration.

### The bot is online but a server is missing or inaccessible

- Confirm the bot was invited to the correct Discord server.
- Confirm the server ID is allowed by the instance's configuration.
- Check the user's dashboard permissions and any `STAFF` configuration.
- Confirm required Discord intents and bot permissions are enabled.

### View logs and restart a service

```bash
# All service logs
docker compose -f docker-compose.lightweight.yml logs -f

# Restart one service
docker compose -f docker-compose.lightweight.yml restart bot

# Rebuild and recreate all services
docker compose -f docker-compose.lightweight.yml up -d --build
```

## 14. Useful links

- [OKG-Zeppelin source repository](https://github.com/jamesonrb2013/OKG-Zeppelin)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Docker Engine installation](https://docs.docker.com/engine/install/)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [Caddy documentation](https://caddyserver.com/docs/)
- [Cloudflare Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

---

**You now have the complete deployment path:** create your Discord application, provision MySQL and Redis, configure the environment, build and launch the containers, secure the public URLs, and sign in to your own dashboard.
