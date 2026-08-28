# LinkedIn Creator Marketplace

A B2B marketplace where brands book LinkedIn creators for sponsored posts. Negotiation,
delivery, click attribution, escrow, and payout run in one place.

Two audiences with opposite relationships to the product:

- **Brands** describe an ideal customer profile once, get a ranked catalog of creators, book
  posts against a campaign brief, and watch tracked links produce pipeline.
- **Creators** register from a LinkedIn URL, get offered relevant work, negotiate or accept,
  publish in their own voice, and get paid without chasing an invoice.

Three constraints separate it from a plain job board:

1. **Tracked links are enforced by the state machine.** A post cannot reach `published`
   without one, so every completed booking produces a measurable outcome.
2. **Delivery reliability is scored and public.** Accepted-but-not-published posts count
   against a creator's record, shown on every catalog card.
3. **Match scores show their working.** Each ranking carries its components (topic overlap,
   voice similarity, audience fit, delivery record, availability) and their weights.

---

## Stack

| Layer | Choice |
|---|---|
| Runtime, package manager, test runner | [Bun](https://bun.sh) 1.3 |
| API | [Fastify](https://fastify.dev) 5 on Bun, TypeScript run directly (no build) |
| Web | [Next.js](https://nextjs.org) 15 App Router, React 19, on Node |
| Database | [Neon](https://neon.tech) Postgres + `pgvector` + `citext`, [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [better-auth](https://better-auth.com) — email/password, HTTP-only cookies |
| Realtime | WebSocket (`@fastify/websocket`) for messaging, SSE for status changes |
| AI | [OpenRouter](https://openrouter.ai) for text generation, Gemini for embeddings, [ScrapeCreators](https://scrapecreators.com) for LinkedIn data |
| Styling | Hand-written CSS, no framework. Imperial Blue on White Convolvulus, ID Grotesk + Times |
| Charts | `@visx/*` primitives, styled with the app's tokens |

---

## Repository layout

```
apps/
  api/                 Fastify server. Entry: src/server.ts
    src/routes/         one file per feature area
    src/billing/        double-entry ledger + escrow
    src/messaging/      WebSocket broker, ticket auth
    src/events/         SSE, expiry + settlement sweeps
    Dockerfile          Bun image for Render
  web/                  Next.js app
    src/app/brand/      brand routes: (app) group is the authed shell
    src/app/creator/    creator routes
    src/app/page.tsx    the shared split-screen login / signup / onboarding surface
    src/components/     shared UI, charts/, skeletons
    src/lib/            api client, formatters, collab helpers
    next.config.ts      the /bff reverse proxy to the API
packages/
  contracts/           Zod schemas + types shared by web and api. The source of truth
  db/                  Drizzle schema, migrations, SQL guards, seed + admin scripts
  ai/                  ICP generation, campaign drafting, embeddings, LinkedIn providers
  collab/              the collaboration state machine (pure, well tested)
  match/               the catalog ranking function (pure)
render.yaml            Render blueprint for the API
.env.example           every environment variable, documented
```

All packages are `private`, linked as `workspace:*`, and export raw `src/index.ts`. Bun runs
them as TypeScript; Next transpiles `@lm/contracts` (the only package the web depends on).

---

## Core concepts

### Roles are locked to the email

One email is one account, one role. A `lock_account_type` database trigger makes
`account_type` immutable after signup. To work as both a brand and a creator, use two emails.

### Onboarding gates the app

- **Brand:** signup lands on the ICP builder. It reads a product URL (or a pasted brief),
  drafts an ICP with an LLM, and the brand edits it. Saving creates the workspace, the brand
  row, and the ICP embedding. Every `/brand/(app)/*` route redirects to onboarding until the
  ICP exists.
- **Creator:** signup lands on the LinkedIn fetch step. `packages/ai` pulls the public
  profile and recent posts (ScrapeCreators, or a manual paste fallback), computes an
  engagement fingerprint, and the creator confirms every field. Saving creates the creator
  row and the fingerprint embedding.

### The match score

`packages/match/src/score.ts` scores each creator against a brand's ICP:

| Component | Default weight | Source |
|---|---|---|
| Topic overlap | 40% | shared sectors, capped at 3 per side |
| Voice similarity | 30% | cosine of the ICP embedding vs the creator fingerprint embedding |
| Audience fit | 15% | engagement rate and follower band |
| Delivery record | 10% | published / accepted, with a neutral prior for thin records |
| Availability | 5% | open slots |

The function is pure and returns the components alongside the number, so the catalog can show
why a creator ranked where they did.

### Collaboration state machine

`packages/collab/src/transitions.ts` owns every legal move. States:

```
invited → countered ⇄ (up to 3 rounds)
invited / countered → accepted → brief_shared → draft_submitted ⇄ revision_requested
                                              → draft_approved → scheduled → published
published → verified → paid
any open state → declined | expired | cancelled
```

Guards enforced here, not in the UI:
- `published` / `verified` / `paid` require a non-null `tracked_link`
- counter rounds cap at 3
- an actor cannot accept their own counter-offer
- `publish` requires a post URL

### Money: escrow + double-entry ledger

`apps/api/src/billing/`:

- On `accepted`, the brand's committed fee moves from the workspace wallet into an **escrow
  hold** (`held`).
- On `paid`, the hold is `released` and the fee moves escrow → creator wallet.
- On `expired` / `cancelled`, the hold is `refunded` back to the workspace wallet.
- Every movement is two `ledger_entries` in one `entry_group` that sum to zero. Wallet
  balances are derived, never written blind. Only the platform wallet may go negative.

Analytics reads escrow directly: `held` holds are "committed", `released` holds are "spend".

### Tracked links and clicks

Each published collaboration gets a short code. `GET /r/:code` on the API redirects to the
campaign landing URL and records a `link_clicks` row keyed by `(collaboration, visitor, day)`
so repeat visits on the same day increment `hits` rather than duplicating.

### How web and API talk in production

The browser only ever calls the web origin. `next.config.ts` rewrites `/bff/:path*` to
`${API_URL}/:path*`, so the Next server proxies to the API. Auth cookies (better-auth sets
them host-only, no `Domain`) flow back through the proxy scoped to the web domain.
WebSockets connect straight to `wss://<api-host>` with a short-lived ticket fetched over
`/bff` first, so no cookie is needed on the socket.

---

## Local development

### Prerequisites

- Bun 1.3+
- A Postgres database with `pgvector` available (Neon's free tier works)
- API keys: OpenRouter, Gemini (Google AI Studio). ScrapeCreators is optional.

### Setup

```bash
bun install
cp .env.example .env          # fill in the values
bun run db:migrate            # extensions, schema, SQL guards
bun run db:seed               # optional: ~13 demo creators for the catalog
```

### Run

Two processes, two terminals:

```bash
bun run dev:api               # Fastify on :3001, --watch
bun run dev:web               # Next.js on :3000
```

Open `http://localhost:3000`. Sign up as a brand and a creator with different emails.

---

## Environment variables

Set locally in `.env`. In production they live in the Render and Vercel dashboards.

### Shared

| Var | Notes |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string. `client.ts` upgrades `sslmode=require` to `verify-full` |

### API (Render)

| Var | Notes |
|---|---|
| `AUTH_SECRET` | 32+ random chars, e.g. `openssl rand -base64 32` |
| `API_URL` | the API's own public URL. Used as better-auth's `baseURL` |
| `WEB_ORIGIN` | the web URL, sent as the CORS `Access-Control-Allow-Origin` header |
| `OPENROUTER_API_KEY` | required |
| `GEMINI_API_KEY` | required, for embeddings |
| `SCRAPECREATORS_API_KEY` | optional if `LINKEDIN_PROVIDER=manual` |
| `LINKEDIN_PROVIDER` | `scrapecreators` (default) or `manual` |
| `OPENROUTER_MODEL` | optional, defaults to `minimax/minimax-m3:free` |
| `LINKEDIN_ENRICH_POSTS` | optional, default 5 |
| `PORT` | injected by Render; defaults to 3001 locally |

### Web (Vercel)

| Var | Notes |
|---|---|
| `API_URL` | the Render API URL. Read at build time for the `/bff` proxy and the WS URL |
| `NEXT_PUBLIC_WS_URL` | optional; `next.config.ts` derives it from `API_URL` (`https` → `wss`) |

---

## Scripts

| Command | What it does |
|---|---|
| `bun run dev:api` | Fastify with `--watch` |
| `bun run dev:web` | Next dev server |
| `bun run typecheck` | `tsc --noEmit` for the whole repo, then the web tsconfig |
| `bun run test` | `bun test packages` — unit tests for `collab`, `match`, `ai`, `contracts`, `db` |
| `bun run db:generate` | `drizzle-kit generate` after editing `packages/db/src/schema.ts` |
| `bun run db:migrate` | runs `extensions.sql`, applies migrations, runs `guards.sql`. Idempotent |
| `bun run db:seed` | loads demo creators into the catalog |

### Admin scripts (run with `DATABASE_URL` set)

| Script | Purpose |
|---|---|
| `bun run apps/api/src/reset-password.ts <email> <new-password>` | resets a local account's password |
| `bun run packages/db/src/populate-brand.ts` | fills the `sureshortlist` brand with demo campaigns, bookings, escrow, and clicks (hardcoded IDs, dev only) |
| `bun run packages/db/src/populate-creator.ts` | fills the Bill Gates creator with demo earnings and pipeline (dev only) |

---

## Testing

```bash
bun run test
```

Covers the state machine, the match function, ICP/document parsing, the ledger invariants,
the WebSocket protocol, and the schema constraints. The web app has no test runner; verify UI
changes with `bun run typecheck` and the running dev server.

---

## Deployment

Three services: **Neon** (database), **Render** (API), **Vercel** (web).

`API_URL` and `WEB_ORIGIN` reference each other, so deploy in this order.

### 1. Database — Neon

Create a project, copy the **pooled** connection string. Then run the migration once from
your machine:

```bash
DATABASE_URL='<neon-pooled-url>' bun run packages/db/src/migrate.ts
```

### 2. API — Render

New → Blueprint, pointed at this repo (it reads `render.yaml`). Or a Web Service by hand:

| Setting | Value |
|---|---|
| Language | Docker |
| Dockerfile Path | `apps/api/Dockerfile` |
| Docker Build Context Directory | `.` |
| Health Check Path | `/health` |
| Plan | `free` (sleeps after 15 min idle; background sweeps pause while asleep) |

Set the env vars from the table above. `API_URL` is this service's own
`https://<name>.onrender.com` (Render may append a suffix — use the URL it actually
assigns). `WEB_ORIGIN` is a placeholder until step 3.

### 3. Web — Vercel

Import the repo. **Root Directory** = `apps/web` (Vercel installs from the workspace root on
its own). Framework preset: Next.js.

Set `API_URL` to the real Render URL, and `NEXT_PUBLIC_WS_URL` to the same host with `wss://`.
Deploy, note the Vercel URL.

### 4. Close the loop

Set Render's `WEB_ORIGIN` to the real Vercel URL and redeploy the API.

### Notes

- **Render free tier** sleeps after 15 minutes of no traffic. The expiry and settlement
  sweeps stall while asleep. A paid instance stays warm.
- **One API instance only.** The messaging broker and status bus are in-memory.
- If Vercel's build trips on the TypeScript in `@lm/contracts`, add
  `transpilePackages: ['@lm/contracts']` to `next.config.ts`.

---

## Design system

Defined in `DESIGN.md`, applied in `apps/web/src/app/globals.css`.

- **Colors:** Imperial Blue `#021F94` carries actions, the active nav item, and selection.
  Ground is White Convolvulus `#F5F2F3`. Everything else is a neutral or a semantic state
  color. No gradients.
- **Type:** ID Grotesk for the interface (self-hosted at `apps/web/public/fonts/`), Times for
  page titles.
- **Motion:** 180ms, ease-out, state change only. Skeleton shimmers and the catalog card flip
  are the deliberate exceptions.

The reference tools are Raycast, Linear, and Stripe: earned familiarity over surprise.

---

## Product and research notes

- `PRODUCT.md` — users, brand voice, anti-references, design principles.
- `DESIGN.md` — the full design system with tokens.
- `research.md` — vendor research, the competitor teardown, and the feature request log.
- `findings.md` — known sharp edges and what breaks.
