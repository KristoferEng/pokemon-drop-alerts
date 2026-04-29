# Pokémon Drop Alerts

Free SMS alerts the moment Pokémon TCG **card products** restock or new releases land at:

- pokemoncenter.com
- target.com
- walmart.com
- bestbuy.com
- gamestop.com
- costco.com

Subscribers verify with a one-time code, and receive a single short text per drop:

> `Pokemon drop at target.com - good luck!`

Card products only — booster boxes, ETBs, tins, blisters, collection boxes, etc. No accessories, no plush, no spam.

---

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind v4** for the signup page
- **Postgres** + **Drizzle ORM** for subscribers, products, stock state
- **Twilio Verify** for opt-in confirmation, **Twilio Messaging Service** for alerts
- A scrape **cycle** that polls each retailer, diffs against DB, and dispatches alerts. Run it two ways:
  - Long-running `npm run worker` (best for VPS / Render Background Worker on a paid plan)
  - HTTP `POST /api/cron/cycle` triggered by an external cron (free path; works on Render free tier)

```
.
├── app/                  Next.js App Router pages + API routes
│   ├── page.tsx          Landing page
│   ├── SignupCard.tsx    Phone → code → done flow
│   └── api/
│       ├── signup/       Phone in, send Twilio Verify code
│       └── verify/       Code in, mark subscriber verified
├── lib/
│   ├── classifier.ts     Title/category → is-this-a-card-product?
│   ├── phone.ts          US phone parsing/validation
│   ├── twilio.ts         Verify + Messaging client
│   └── db/               Drizzle schema + pool
├── worker/
│   ├── index.ts          Long-running loop
│   ├── cycle.ts          One full scrape→diff→dispatch cycle
│   └── retailers/        One file per retailer
├── scripts/
│   ├── migrate.ts        drizzle-kit migrate
│   └── seed.ts           First-run scrape (dry-run) so we don't blast users
├── drizzle/              Generated SQL migrations
└── render.yaml           Render Blueprint: web + worker + Postgres
```

---

## Setup

### 1. Twilio

1. Create a Twilio account, then a **Verify Service** (Console → Verify → Services). Note the `VAxxx…` SID.
2. Create a **Messaging Service** (Console → Messaging → Services). Add a long-code or short-code sender. For US SMS at any volume you must complete **10DLC brand + campaign registration** — Twilio walks you through it.
3. Enable **Advanced Opt-Out** on the Messaging Service so STOP/HELP are handled automatically.
4. Grab Account SID + Auth Token from the console dashboard.

### 2. Database

Render Postgres, Neon, Supabase, or local Postgres all work. You just need a `DATABASE_URL`.

### 3. Local dev

```bash
cp .env.example .env
# fill in DATABASE_URL + TWILIO_* values
npm install
npm run db:generate     # only if you change lib/db/schema.ts
npm run db:migrate      # apply migrations
npm run db:seed         # one dry-run scrape so first real cycle isn't all "new release"
npm run dev             # signup page on http://localhost:3000

# in another terminal:
npm run worker          # long-running scrape loop
# or
npm run worker:once     # one cycle, then exit
```

Set `DRY_RUN=true` while testing — the worker will log what it *would* text instead of actually sending.

Set `TEST_PHONES=+15555550100,+15555550101` to allowlist specific numbers during testing (only those will get texts).

---

## How alerts work

Each cycle (`WORKER_CYCLE_SECONDS`, default 180s) the worker:

1. Hits each of the 6 retailers' Pokémon TCG catalogs
2. Runs every product title through `lib/classifier.ts` — keeps card products (booster, ETB, tin, blister, collection, deck, etc.), rejects accessories (sleeves, binders, plush, apparel, video games, singles)
3. Upserts into `products`, compares against last-known stock state
4. Fires an alert when:
   - **`new_release`**: product URL we've never seen before (and it's in stock)
   - **`restock`**: previously-OOS product is now in stock
5. Per-product cooldown of `ALERT_COOLDOWN_HOURS` (default 6h) so a flickering "in stock" badge doesn't spam users
6. Per cycle: at most one text per retailer per subscriber, even if multiple SKUs at that retailer dropped together

Every alert includes opt-out instructions handled by Twilio (`STOP` → unsubscribe automatically).

---

## Tuning the classifier

`lib/classifier.ts` has two arrays: `INCLUDE_TERMS` and `EXCLUDE_TERMS`. Edit them as new product types appear (e.g. when TPCi releases a new collection format). The classifier defaults to **exclude** when uncertain — better to miss an alert than text everyone about a Pikachu lunchbox.

---

## Tuning scrapers

Each retailer has its own file in `worker/retailers/`. They're best-effort; if a retailer changes their HTML or rotates an Algolia/API key, that scraper will start returning 0 products. The worker logs `scrape.failed` events with the error so you can spot it.

Scraper notes:

- **pokemoncenter** — Algolia public index. App ID + key are baked in but overridable via `POKEMON_CENTER_ALGOLIA_*` envs.
- **target** — Redsky API, public key baked in. Override via `TARGET_REDSKY_KEY`.
- **bestbuy** — Requires a free API key from [developer.bestbuy.com](https://developer.bestbuy.com/). Set `BESTBUY_API_KEY`. Without it the scraper returns `[]` silently.
- **walmart** — Cloudflare-protected. Direct requests work intermittently. For production, set `WALMART_PROXY_URL` to point at a residential-proxy gateway (Brightdata, ScraperAPI, etc.) — the gateway should accept a `?url=` query param and return the raw HTML.
- **gamestop** — Search-results HTML.
- **costco** — Search HTML; small inventory.

---

## Deploying to Render (free tier)

`render.yaml` provisions a free Web service + free Postgres. (Background workers require a paid plan, so on free tier we trigger the scrape cycle via an external HTTP cron — see below.)

```bash
git push origin main
```

In Render: **New → Blueprint → connect repo**, or use the API. Then in the dashboard:

1. Set secret env vars on the web service: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_MESSAGING_SERVICE_SID`, `BESTBUY_API_KEY`. `CRON_SECRET` and `DATABASE_URL` are auto-generated/wired by the Blueprint.
2. Open Shell and run:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
3. Set up an external cron to ping the cycle endpoint every 3–5 minutes:
   - Free option: [cron-job.org](https://cron-job.org) → New cron job → URL `https://<your-service>.onrender.com/api/cron/cycle`, method `POST`, interval `*/5 * * * *`, custom header `Authorization: Bearer <CRON_SECRET>` (copy from Render env vars).
   - GitHub Actions option: a `schedule:` workflow with `curl -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://<your-service>.onrender.com/api/cron/cycle`.

The cycle endpoint runs the same scrape→classify→alert flow as the long-running worker, just on demand.

### If you want the long-running worker instead (paid plan)

Add a worker service block to `render.yaml`:

```yaml
- type: worker
  name: pokemon-drop-alerts-worker
  runtime: node
  plan: starter
  buildCommand: npm ci
  startCommand: npm run worker
  envVars:
    - key: DATABASE_URL
      fromDatabase: { name: pokemon-drop-alerts-db, property: connectionString }
    # ... all the TWILIO_* vars
```

The worker code is already in `worker/index.ts`.

---

## Compliance

This is a real SMS service, not a toy. To stay on the right side of the TCPA / CTIA / 10DLC rules:

- ✅ Explicit opt-in checkbox on the signup form (consent text is in `app/SignupCard.tsx`)
- ✅ Phone verified with a one-time code before any marketing text
- ✅ `opt_in_ip` + `opted_in_at` stored for audit
- ✅ STOP/HELP keywords handled by Twilio Messaging Service Advanced Opt-Out
- ✅ Brand identity in every message ("Pokemon drop at …")
- 🟡 You **must** complete 10DLC brand + campaign registration in Twilio before sending at any volume
- 🟡 Consider adding a privacy policy + terms-of-service page if you scale this past friends-and-family

The bot doesn't store anything beyond phone numbers and consent metadata. Numbers can be deleted by replying STOP (Twilio's opt-out list) and/or by removing the row from the DB.

---

## License

MIT — do whatever you want with it.
