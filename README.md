<!-- PolicyChecks badges: repository policy status -->
<p align="center">
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/secret-push-protection-enabled/details.json"><img alt="Secret push protection" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/secret-push-protection-enabled.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/web-commit-signoff-required/details.json"><img alt="Web signoff" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/web-commit-signoff-required.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/sha-pinning-required/details.json"><img alt="SHA pinning" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/sha-pinning-required.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-pull-request-required/details.json"><img alt="Pull request required" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-pull-request-required.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-force-pushes-blocked/details.json"><img alt="Force pushes blocked" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-force-pushes-blocked.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-status-checks-required/details.json"><img alt="Status checks" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-status-checks-required.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/immutable-releases/details.json"><img alt="Immutable releases" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/immutable-releases.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-linear-history-required/details.json"><img alt="Linear history" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-linear-history-required.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/community-health/details.json"><img alt="Community health" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/community-health.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-deletion-blocked/details.json"><img alt="Deletion blocked" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-deletion-blocked.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/secret-scanning-enabled/details.json"><img alt="Secret scanning" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/secret-scanning-enabled.svg"></a>
  <a href="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-signed-commits-required/details.json"><img alt="Signed commits" src="https://policychecks.reponomics.org/github/frpboy/NahThatsFake/default-branch-signed-commits-required.svg"></a>
</p>
<!-- End PolicyChecks badges -->

# Nah That's Fake — Telegram Bot & Mini App

A Telegram-based deepfake and scam detection system with a Telegram bot, Telegram Mini App (TMA), and Supabase-backed data layer.

## Links

- **Live app:** https://nahthatsfake.vercel.app/
- **Source:** https://github.com/frpboy/NahThatsFake

## Features

- AI-assisted image/deepfake analysis
- Multi-provider URL safety checks
- Telegram bot and Mini App workflows
- Premium plans and payment integrations (Razorpay and Telegram Stars)
- Referral credits
- Abuse prevention and rate limiting
- Check history and usage analytics

## Repository layout

The following paths reflect the current repository tree:

```text
NahThatsFake/
├── .env.example             # Shared environment-variable template
├── bot/
│   ├── src/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── package.json
│   ├── package-lock.json
│   └── pnpm-lock.yaml
├── tma/
│   ├── api/index.js         # Vercel API entry point
│   ├── public/
│   │   ├── css/
│   │   ├── js/
│   │   ├── index.html
│   │   └── premium.html
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── pnpm-lock.yaml
├── supabase/
│   └── migrations/          # Checked-in SQL migration files
├── Documents/               # Project specifications and reports
├── Current_Schema.md        # Schema snapshot; explicitly context-only
├── DEPLOYMENT.md
├── docker-compose.yml
├── nginx.conf
└── vercel.json
```

There is no `shared/` or top-level `docs/` directory in the current tree. Project documents are under `Documents/`.

## Technology

### Telegram bot
- Node.js and TypeScript
- grammY
- Supabase JavaScript client
- Axios and node-cron

### Telegram Mini App
- Vanilla HTML, CSS, and JavaScript
- Node.js and Express
- Telegram Web App SDK
- Supabase and Razorpay integrations

### Data and hosting
- Supabase PostgreSQL with SQL migrations and Row Level Security
- Vercel for the Mini App/API deployment
- Docker Compose and Nginx configuration for self-hosted deployments

### External services
- Sightengine for image analysis
- Google Safe Browsing and VirusTotal for URL intelligence
- Razorpay and Telegram Stars for payments

## Getting started

### Prerequisites

- Node.js 20 or newer (the checked-in Supabase client dependency requires Node.js 20+)
- npm
- A Telegram bot token
- A Supabase project
- Provider credentials for the features you intend to enable

### 1. Clone the repository

```bash
git clone https://github.com/frpboy/NahThatsFake.git
cd NahThatsFake
```

### 2. Configure environment variables

The only checked-in environment template is the root `.env.example`. Create a component-local environment file so the process can load it from its working directory:

```bash
cp .env.example bot/.env
cp .env.example tma/.env
```

Edit each file and keep only the values required by that server. At minimum, the bot requires `BOT_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. The bot also accepts optional detection-provider credentials and `TMA_URL`.

The TMA server uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`; payment and webhook functionality may require the corresponding server-side Razorpay and Supabase credentials. Set `ALLOWED_ORIGINS` to the exact trusted web origins for the deployment.

Never commit either `.env` file. Never expose the Supabase service-role key or Razorpay secret to browser-side code.

### 3. Install and run the bot

The bot directory currently contains an npm lockfile:

```bash
cd bot
npm ci
npm run typecheck
npm run build
npm start
```

### 4. Install and run the TMA server

```bash
cd tma
npm ci
npm start
```

**Package-manager note:** the repository root, bot, and TMA currently contain both npm and pnpm lockfiles. This README uses the checked-in npm lockfiles for reproducible npm installs. The canonical package-manager policy and lockfile cleanup are tracked separately in [issue #373](https://github.com/frpboy/NahThatsFake/issues/373). Do not update only one lockfile when changing dependencies; keep the competing lockfiles synchronized until that policy is resolved. The root package manifest is not a workspace entry point for the bot or TMA.

## Database setup and migrations

The executable SQL files are under `supabase/migrations/`. The old paths `supabase/schema.sql`, `supabase/rls_policies.sql`, and `supabase/functions.sql` do not exist in this repository.

Important safeguards:

- `Current_Schema.md` is labelled as a context-only schema snapshot; it is not a migration and must not be executed as SQL.
- The migrations directory contains both timestamped and legacy-named SQL files. Do not assume a simple alphabetical replay is safe.
- This repository does not currently include `supabase/config.toml`; a linked Supabase CLI migration workflow is therefore not configured by this checkout.
- For an existing project, reconcile its applied migration history before running anything. Do not replay the full directory against a live database.
- For a fresh project, have the database owner review the migration dependencies and apply the intended sequence in a disposable/staging project before production.

No production migration should be run as part of local setup or this documentation change.

## Useful project documentation

- `DEPLOYMENT.md` — deployment options and operational checklist
- `Documents/Tech_Stack_Report.md` — technology stack report
- `Documents/Project_Status_Report.md` — project status
- `Documents/BSChecker_Doc1_PRD.html` through `Documents/BSChecker_Doc13_Tracker.html` — product and engineering specifications
- `Current_Schema.md` — reference snapshot only, not executable SQL

## Database tables

The schema includes user accounts, checks, cached results, payments, referrals, groups, abuse flags, feedback, and related operational data. Consult the checked-in migrations and current database state rather than treating this summary as a complete schema definition.

## Bot commands

- `/start` — onboarding
- `/check` — start a content check
- `/credits` — view credit balance
- `/refer` — referral link
- `/history` — recent checks
- `/premium` — premium options

## Pricing

The application has individual and group plans, including time-based subscriptions and credit packs. The live Mini App is the source of truth for currently offered prices and payment options.

## Security

- Supabase Row Level Security
- Bot-side abuse detection and rate limiting
- Server-side payment verification
- Environment-based secret configuration
- Image analysis without intentionally retaining uploaded image files as application content

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the deployment overview. The repository includes:
- `vercel.json` for Vercel routing
- `docker-compose.yml` for container orchestration
- `nginx.conf` as a self-hosted reverse-proxy example

Review environment variables, CORS origins, TLS configuration, database migration state, and health checks before deploying. The checked-in deployment files are examples and must be reconciled with the target environment.

## Contributing

1. Review the repository issues and existing pull requests before starting work.
2. Create a focused feature branch.
3. Follow the component's existing package and test conventions.
4. Run the relevant type checks, builds, and tests.
5. Open a pull request with the rationale and validation evidence.

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

**Nah That's Fake** — making the internet a safer place, one check at a time.
