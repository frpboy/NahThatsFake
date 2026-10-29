
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

# Nah That's Fake - Telegram Bot & TMA

A comprehensive deepfake and scam detection system built for Telegram, featuring both a bot and a Telegram Mini App (TMA).

## Links

- **Live demo:** https://nahthatsfake.vercel.app/
- **Source code:** https://github.com/frpboy/NahThatsFake

## 🚀 Features

- **Deepfake Detection**: AI-powered image analysis to detect AI-generated content
- **Scam Link Detection**: Multi-vendor URL scanning for phishing and malware
- **Telegram Integration**: Seamless bot and TMA experience
- **Premium Plans**: Razorpay and Telegram Stars payment integration
- **Referral System**: Earn credits by inviting friends
- **Rate Limiting**: Built-in abuse prevention
- **Real-time Analytics**: Comprehensive check history and statistics

## 📁 Project Structure

```
NahThatsFake/
├── bot/                    # Telegram Bot (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts       # Main bot entry point
│   │   ├── handlers/    # Command and message handlers
│   │   ├── utils/       # Utility functions
│   │   └── middleware/  # Rate limiting, consent, etc.
│   └── package.json
├── tma/                   # Telegram Mini App
│   ├── index.html       # TMA frontend
│   ├── server.js        # TMA backend server
│   └── package.json
├── supabase/             # Database schema and migrations
│   ├── schema.sql       # Database tables
│   ├── rls_policies.sql # Row Level Security
│   └── functions.sql    # PostgreSQL functions
└── shared/              # Shared types and utilities
```

## 🛠️ Tech Stack

### Backend
- **Node.js** with TypeScript
- **Grammy** - Telegram Bot Framework
- **Supabase** - PostgreSQL database and authentication
- **Axios** - HTTP client for API calls

### Frontend (TMA)
- **HTML/CSS/JavaScript** - Vanilla JS for TMA
- **Express.js** - Backend API server
- **Telegram Web App SDK** - TMA integration

### APIs
- **Sightengine** - Deepfake detection
- **Google Safe Browsing** - URL safety
- **VirusTotal** - Multi-vendor URL scanning
- **Razorpay** - Payment processing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Telegram Bot Token
- Supabase account and project
- API keys for detection services

### 1. Clone and Setup
```bash
git clone <repository-url>
cd NahThatsFake
```

### 2. Setup Database
1. Create a Supabase project
2. Run the schema migrations in `supabase/schema.sql`
3. Apply RLS policies from `supabase/rls_policies.sql`
4. Add database functions from `supabase/functions.sql`

### 3. Configure Bot
```bash
cd bot
cp .env.example .env
# Edit .env with your credentials
npm install
npm run build
npm start
```

### 4. Configure TMA
```bash
cd tma
cp .env.example .env
# Edit .env with your credentials
npm install
npm start
```

## 🔧 Configuration

### Environment Variables (Bot)
```env
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Environment Variables (TMA)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
PORT=3000
```

## 📊 Database Schema

### Core Tables
- **users** - User profiles and subscription status
- **checks** - History of all image/link checks
- **check_cache** - Caching layer for API responses
- **payments** - Payment history and transactions
- **referrals** - Referral tracking and credits
- **groups** - Telegram group premium status
- **abuse_flags** - Abuse detection and prevention

## 🎯 Bot Commands

- `/start` - Welcome and onboarding
- `/check` - Prompt to send content for checking
- `/credits` - View credit balance
- `/refer` - Generate referral link
- `/history` - View recent checks
- `/premium` - Premium subscription options

## 💳 Pricing Plans

### Individual Plans
- **Free**: 3 checks/day + bonus credits
- **Monthly**: ₹99 - Unlimited checks
- **Annual**: ₹799 - Unlimited checks (33% off)

### Group Plans
- **Group Monthly**: ₹299 - Unlimited group checks

## 🔒 Security Features

- Row Level Security (RLS) policies
- Rate limiting and abuse detection
- API key management
- Privacy-first design (no image storage)
- Secure payment processing

## 🚀 Deployment

### Bot Deployment
1. Build the bot: `npm run build`
2. Deploy to your preferred hosting (Railway, Render, etc.)
3. Set environment variables
4. Start the bot service

### TMA Deployment
1. Deploy the TMA server to a hosting platform
2. Configure HTTPS (required for TMA)
3. Update bot to point to TMA URL
4. Configure Telegram Mini App settings

## 📈 Monitoring

- Database performance monitoring via Supabase
- Bot analytics through Telegram
- Payment tracking through Razorpay dashboard
- Error logging and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation in the `/docs` folder

---

**Nah That's Fake** - Making the internet a safer place, one check at a time! 🔍✨

## Automated checks

CI uses the checked-in npm lockfiles for the root, bot, and mini app, then runs the root test command. The Vercel project currently selects pnpm because pnpm lockfiles are also present, so manifests touched by this PR keep both npm and pnpm lockfile importer records in sync. The canonical package-manager decision remains tracked in [issue #373](https://github.com/frpboy/NahThatsFake/issues/373). From a clean checkout, run:

```sh
npm ci
npm --prefix bot ci
npm --prefix tma ci
npm test
```

The root `npm test` command runs the bot type-check, TypeScript build, and Markdown escaping regression assertions, followed by TMA JavaScript syntax validation and request-level tests. The TMA has no bundler, so its `build` script checks syntax instead of claiming to produce a compiled artifact.

The bot's existing `lint` script is not yet reproducible because ESLint is missing from its manifest/lockfile and no lint configuration is checked in. That gap is tracked separately in [issue #408](https://github.com/frpboy/NahThatsFake/issues/408); CI does not depend on a globally installed linter.

