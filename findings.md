# findings.md

Context hub. Read this before touching anything. If you find yourself grepping the repo to
answer a structural question, the answer was missing here and you should add it.

Companion file: `research.md` holds market, vendor, and design research plus the feature
request log. This file holds the state of the code.

---

## Build state

Last updated: 2026-08-28

Right now: Phases 0, 1 and 3 are done. Phase 2 is missing campaign import and the expiry
clock. Phases 4 and 5 have not begun.

`bun test` is 128 passing, 64 of them against live Neon. Both typechecks clean.
`bun run dev` starts the API on 3001 and the web app on 3000. Fifteen web routes build.

Design direction is settled: **Imperial Blue `#021F94` on White Convolvulus `#F5F2F3`**,
ID Grotesk for the interface and Times for page titles, card-and-sidebar product layout.
See `DESIGN.md`. Everything under `design-lab/brand/`, `design-lab/creator/`,
`design-lab/index.html`, and `design-lab/direction.html` is round-one work that was
rejected. Do not read it as current. `design-lab/imperial/` is the approved pair.

| Phase | Scope | Status |
|---|---|---|
| 0 | Research docs, design system, approved mockups | done |
| 1 | Auth, both onboardings, catalog, match algorithm | done |
| 2 | Campaigns, collaborations, tracked links | mostly done, see what is left |
| 3 | Messenger over WebSocket, SSE status stream | done |
| 4 | Mocked ledger, escrow, analytics | not started |
| 5 | Workspaces and invites | not started |

### Phase 0 detail

| Item | Status | Files |
|---|---|---|
| Research doc | done | `research.md` |
| Context hub | done | `findings.md` |
| Product strategy | done, rewritten round 2 | `PRODUCT.md` |
| Design system doc | done, rewritten round 2 | `DESIGN.md` |
| Round 2 tokens | done | `design-lab/imperial/tokens.css` |
| Round 2 component layer | done | `design-lab/imperial/app.css` |
| Round 2 icon sprite | done | `design-lab/imperial/icons.js` |
| Brand mockup | done | `design-lab/imperial/brand.html` |
| Creator mockup | done | `design-lab/imperial/creator.html` |
| Sign-off from Ujjwal | approved 2026-08-27 | n/a |
| Round 1, all 26 screens | **superseded, rejected** | `design-lab/brand/`, `design-lab/creator/`, `design-lab/index.html`, `design-lab/direction.html` |

One mockup per side, static HTML with no build step. `tokens.css` and `app.css` were
promoted into `apps/web/src/app/globals.css` and are the live design system now. The
mockups are kept as the visual reference the code is checked against.

### Phase 1 detail

Auth, both onboardings, the catalog, and the match algorithm. All done.

| Item | Status | Files |
|---|---|---|
| Bun workspace skeleton | done | `package.json`, `tsconfig.json`, `bunfig.toml` |
| Shared contracts and taxonomy | done, 12 tests | `packages/contracts/src/` |
| Match scoring engine | done, 16 tests | `packages/match/src/score.ts` |
| Database schema and migration | done, generated | `packages/db/src/schema.ts`, `packages/db/migrations/0000_confused_spyke.sql` |
| Account-type trigger and pgvector indexes | done, applied and tested live | `packages/db/src/sql/guards.sql` |
| Migration applied to Neon | done, 8 live constraint tests pass | `packages/db/src/schema.test.ts` |
| AI layer, OpenRouter and Gemini | done | `packages/ai/src/` |
| LinkedIn provider, ScrapeCreators and manual | done | `packages/ai/src/linkedin/` |
| Brand site scraper | done | `packages/ai/src/scrape.ts` |
| ICP generation | done, verified live against ashbyhq.com | `packages/ai/src/icp.ts` |
| Fastify app, Zod type provider, CORS, error shape | done | `apps/api/src/app.ts` |
| Better Auth on Drizzle and Neon | done | `apps/api/src/auth.ts` |
| Account-type exclusivity at signup and login | done, 10 tests | `apps/api/src/routes/auth-routes.ts` |
| Role guards via plugin encapsulation | done | `apps/api/src/guards.ts` |
| Brand onboarding routes, ICP generate and save | done | `apps/api/src/routes/brand-routes.ts` |
| Creator onboarding routes, fetch and save | done, untested against a live profile | `apps/api/src/routes/creator-routes.ts` |
| Catalog endpoint with pgvector and explainable scores | done, verified over HTTP | `apps/api/src/routes/catalog-routes.ts` |
| Seed data, 14 creators with real embeddings | done | `packages/db/src/seed.ts` |
| Next.js web app, shell and design system | done | `apps/web/src/` |
| Brand login and signup pages | done, verified through the proxy | `apps/web/src/app/brand/{login,signup}/` |
| Brand catalog page on live data | done, 14 creators render ranked | `apps/web/src/app/brand/(app)/catalog/page.tsx` |
| Brand onboarding page, URL to editable ICP | done, verified against ashbyhq.com | `apps/web/src/app/brand/onboarding/` |
| Creator auth, onboarding, identity card | done, verified with a real LinkedIn fetch | `apps/web/src/app/creator/{login,signup,onboarding}/`, `creator/(app)/card/` |
| Creator card page | done | `apps/web/src/app/creator/(app)/card/` |

### Phase 2 detail

Campaigns, collaborations, tracked links. The negotiation half is done. Campaign import and
the expiry clock are not, and both are listed under what is left.

| Item | Status | Files |
|---|---|---|
| Collaboration state machine, pure | done, 23 tests, 919 assertions | `packages/collab/src/transitions.ts` |
| Campaign and collaboration schema | done, migrated | `packages/db/migrations/0001`, `0002` |
| Campaign and collaboration routes | done, 13 integration tests | `apps/api/src/routes/{campaign,collab}-routes.ts` |
| Creator offers screen with counter-offers | done, verified live | `apps/web/src/app/creator/(app)/offers/` |
| Brand collaborations board | done, verified live | `apps/web/src/app/brand/(app)/collaborations/` |
| Brand campaigns page and create form | done, verified live | `apps/web/src/app/brand/(app)/campaigns/` |
| Commission a creator from the catalog | done, verified live | `apps/web/src/components/commission-button.tsx` |
| Tracked link enforced in the machine and in a CHECK constraint | done | `packages/collab/src/transitions.ts`, `packages/db/src/schema.ts` |
| Campaign creation from a URL | **not started** | n/a |
| Campaign creation from a document | **not started** | n/a |
| Accept-to-publish clock and auto-refund | **not started** | n/a |

### Phase 3 detail

Messenger over WebSocket and the SSE status stream. All done.

| Item | Status | Files |
|---|---|---|
| WebSocket protocol and contracts | done | `packages/contracts/src/messaging.ts` |
| Messages table with per-room sequence | done, migrated | `packages/db/migrations/0003` |
| Broker abstraction, single process today | done | `apps/api/src/messaging/broker.ts` |
| Message persistence and history | done | `apps/api/src/messaging/service.ts` |
| WebSocket endpoint, auth before upgrade | done, 20 tests | `apps/api/src/messaging/ws.ts` |
| Signed connection tickets | done, 4 tests | `apps/api/src/messaging/ticket.ts` |
| REST history and ticket routes | done | `apps/api/src/routes/message-routes.ts` |
| Browser client, reconnect and resume | done, verified end to end | `apps/web/src/lib/use-conversation.ts` |
| Messenger screens, both sides | done | `apps/web/src/app/{brand,creator}/(app)/messenger/` |
| Status event contract | done | `packages/contracts/src/events.ts` |
| Status bus and room keys | done | `apps/api/src/events/bus.ts` |
| SSE status stream, both sides | done, 4 tests | `apps/api/src/events/sse.ts` |
| Live refresh on state change | done, verified through the proxy | `apps/web/src/components/live-collabs.tsx` |
| Shutdown drains accepted writes | done, fixed a real deadlock | `apps/api/src/messaging/ws.ts` |

### Phases 4 and 5

Not started. Scope is under what is left. The nine sidebar links that 404 belong here.

`bun test` is 128 passing, 64 of them against the live Neon database. `bun run typecheck` is
clean across both the root and the web app. `bun run dev` starts the API on 3001 and the web
app on 3000. `bun run db:seed` loads 14 creators with real Gemini embeddings.

Use `127.0.0.1`, not `localhost`, when curling either server on this machine. `localhost`
resolves to IPv6 here and nothing binds `::1`.

### What is left

The single list of unbuilt work. Update it here, not in six places.

**Phase 2 remainder**

| Item | Note |
|---|---|
| Campaign creation from a URL | Route accepts `source: 'url'` but nothing reads the page. `readPage` in `packages/ai` already does the work. |
| Campaign creation from PDF, PPTX, DOCX | Needs `pdf-parse`, `mammoth`, JSZip. None installed, none proven on Bun. |
| Accept-to-publish clock | `expire` exists in the state machine with a system actor. Nothing drives it. Needs a scheduled job. |
| Auto-refund on expiry | The machine returns `refund_escrow`. Nothing performs it until Phase 4. |

**Phase 4, not started**

Wallets, double-entry `ledger_entries`, `escrow_holds`, `idempotency_keys`, and the
analytics rollups. The state machine already emits `hold_escrow`, `release_escrow`, and
`refund_escrow` as effects, so this phase implements the effects rather than reworking the
machine.

**Phase 5, not started**

`workspace_invites`, member roles in the UI, and per-workspace filtering enforced on every
brand query. `workspace_id` is already on every brand-scoped table.

**Web pages that are linked but do not exist**

Every one of these is a live 404 reachable from a sidebar.

| Route | Side |
|---|---|
| `/brand/dashboard` | brand |
| `/brand/analytics` | brand |
| `/brand/billing` | brand |
| `/brand/settings`, `/brand/help` | brand |
| `/creator/assignments` | creator |
| `/creator/payouts` | creator |
| `/creator/performance` | creator |
| `/creator/settings`, `/creator/help` | creator |

**Accepted features not yet built**

Tracked in the `research.md` feature request log with status `accepted`. Repeated here so
one list answers "what is left".

| Feature | Phase |
|---|---|
| Campaign creation from a URL or an uploaded document | 2 |
| Accept-to-publish clock with auto-refund on expiry | 2 |
| Voice-matched draft co-pilot from the creator's post corpus | 3 |
| Billing tab, mocked | 4 |
| Creator earnings page | 4 |
| Creator rotation bundles, 5 to 8 with staggered dates | 4 |
| Brand workspaces with member invites | 5 |
| Compare tray, pin up to 4 creators | 1, deferred |

**Deferred by decision, not oversight**

| Item | Decision |
|---|---|
| Accessibility beyond focus states | Deferred 2026-08-27 by Ujjwal. No WCAG target. |
| Match weight sliders | The rail shows the real weights the API scored with. Dragging them is not wired. |
| ID Grotesk licence and woff2 files | Must be purchased and dropped into `apps/web/public/fonts/`, which does not exist yet. Inter is the fallback until then. |
| Creator supply acquisition | A launch problem, not a build problem. |
| A second API process | Ruled out 2026-08-28 by Ujjwal. One process, `InProcessBroker`, no message bus. |

### Blocked

| What | Blocked on | Workaround |
|---|---|---|
| ScrapeCreators credits | 97 of 100 free credits remain. Onboarding one creator costs 1 + `LINKEDIN_ENRICH_POSTS` credits, 6 by default, so about 16 creators before the free tier runs out. | Set `LINKEDIN_ENRICH_POSTS=0`, or buy credits |
| ID Grotesk rendering | A purchased webfont licence and self-hosted woff2 files | Inter is the fallback in the stack, so layouts hold and nothing shifts when the real face lands |
| Phase 1 start | Sign-off on the two round-2 mockups | none, this gate is deliberate |

---

## Working rules

These are not suggestions. They came from the project owner.

1. **No comments in code. None.** Not file headers, not section dividers, not
   explanations. If a line needs a comment, the name is wrong or the function is doing too
   much. Rename it or split it. Prose that genuinely needs to exist goes in this file.
2. **No git write operations.** No `add`, `commit`, `branch`, `push`, `tag`, `merge`,
   `rebase`, `stash`. Reading history is fine. Ujjwal handles version control.
3. **Invoke `andrej-karpathy-skills:karpathy-guidelines` before writing code.** Minimum
   code that solves the problem. No speculative abstraction. Surgical changes. Every
   changed line traces to a stated requirement.
4. **Invoke `impeccable` for design work.**
5. **Invoke `unslop` before writing prose** anywhere, including this file.
6. **Update this file and `research.md` at the end of every work chunk.** A phase with
   green tests and stale state docs is not done.
7. **Update the summary lines, not only the detail rows.** The build state header, the phase
   table, `What is left`, and the `research.md` status table drift fastest, because adding a
   row feels like recording progress while the sentence above it quietly goes stale. Reread
   the header before claiming a chunk is finished.

---

## Repo map

```
linkedin-marketplace/
  research.md            market, vendors, legal, design research, feature log
  findings.md            this file
  PRODUCT.md             register, users, personality, anti-references, principles
  DESIGN.md              tokens, colour, type, elevation, components, do and don't
  design-lab/            Phase 0 mockups, static HTML, no build step
    imperial/            ROUND 2, CURRENT. Everything else here is dead.
      tokens.css         survives, promoted to packages/ui
      app.css            component layer, becomes the basis of packages/ui
      icons.js           inline SVG sprite, 26 icons
      brand.html         brand mockup, creator catalog
      creator.html       creator mockup, home
    brand/ creator/      round 1, rejected, kept only as a record
    index.html           round 1 harness, rejected
    direction.html       round 1 chooser, rejected
  apps/
    web/                 Next.js 15 App Router, runs on Node
    api/                 Fastify, runs on Bun, owns WebSocket and SSE and money
  packages/
    contracts/           Zod schemas and inferred types, the only source of API shapes
    db/                  Drizzle schema, migrations, seed
    ui/                  design system, promoted out of design-lab after the variant pick
    ai/                  OpenRouter and Gemini clients, prompt modules, response cache
    match/               scoring engine, pure functions, no DB access, unit tested alone
  package.json           workspaces array and scripts
  bunfig.toml
  tsconfig.base.json
```

What does not live where:

- No business logic in `apps/web`. It renders and calls the API.
- No DB access in `packages/match`. It takes plain objects and returns numbers.
- No direct model calls anywhere except `packages/ai`.
- No hand-written request or response types. They all derive from `packages/contracts`.

---

## Symbol index

Populated as things get built. Path plus export name so nobody greps.

| What | Where | Export |
|---|---|---|
| Sector taxonomy, the shared vocabulary both sides pick from | `packages/contracts/src/taxonomy.ts` | `SECTORS`, `Sector` |
| Match scoring entry point | `packages/match/src/score.ts` | `scoreCreator` |
| Match component functions | `packages/match/src/score.ts` | `tagAffinity`, `semanticFit`, `audienceFit`, `reliability`, `availability` |
| Ranking helper, sorts and breaks ties deterministically | `packages/match/src/score.ts` | `rankCreators` |
| Follower bands and their median engagement | `packages/match/src/score.ts` | `bandFor`, `BANDS` |
| Database client and pool | `packages/db/src/client.ts` | `createPool`, `createDb`, `Db` |
| Migration runner, wraps drizzle with extensions and guards | `packages/db/src/migrate.ts` | default script |

| LinkedIn provider interface | `packages/ai/src/linkedin/provider.ts` | `LinkedInProfileProvider` |
| ScrapeCreators implementation | `packages/ai/src/linkedin/scrapecreators.ts` | `ScrapeCreatorsProvider` |
| Manual paste implementation | `packages/ai/src/linkedin/manual.ts` | `ManualPasteProvider` |
| OpenRouter client | `packages/ai/src/openrouter.ts` | `complete` |
| Gemini embeddings | `packages/ai/src/embed.ts` | `embedDocument`, `embedQuery` |
| Role guards | `apps/api/src/guards.ts` | `requireRole` |
| Ledger operations | `apps/api/src/billing/ledger.ts` | `credit`, `debit`, `hold`, `release` (Phase 4, not built) |
| Fastify app factory | `apps/api/src/app.ts` | `buildApp` |
| Better Auth instance, pool, db | `apps/api/src/auth.ts` | `auth`, `db`, `pool`, `accountTypeFor` |
| Role guard preHandler | `apps/api/src/guards.ts` | `requireRole` |
| Auth routes, mounted per account type | `apps/api/src/routes/auth-routes.ts` | `authRoutes`, `forward`, `toHeaders` |
| Typed error response | `apps/api/src/http.ts` | `fail` |
| API environment | `apps/api/src/env.ts` | `env` |
| Brand ICP and profile routes | `apps/api/src/routes/brand-routes.ts` | `brandRoutes`, `existingWorkspace` |
| Creator fetch and profile routes | `apps/api/src/routes/creator-routes.ts` | `creatorRoutes` |
| Catalog with ranking | `apps/api/src/routes/catalog-routes.ts` | `catalogRoutes` |
| Row to card mapping | `apps/api/src/routes/catalog-shape.ts` | `toCard`, `contributorNumber` |
| Collaboration state machine | `packages/collab/src/transitions.ts` | `transition`, `allowedEvents`, `isTerminal` |
| Campaign routes | `apps/api/src/routes/campaign-routes.ts` | `campaignRoutes` |
| Collaboration routes, both sides | `apps/api/src/routes/collab-routes.ts` | `collabRoutes` |
| Collaboration actions, both sides, driven by `allowed` | `apps/web/src/components/collab-actions.tsx` | `CollabActions` |
| Invite a creator from a card | `apps/web/src/components/commission-button.tsx` | `CommissionButton` |
| Campaign create form | `apps/web/src/components/campaign-form.tsx` | `CampaignForm` |
| Shared collaboration row shape and labels | `apps/web/src/lib/collab.ts` | `CollabRow`, `CollabList`, `STATE_LABEL`, `NEEDS_YOU` |
| WebSocket frames, codes, limits | `packages/contracts/src/messaging.ts` | `ClientFrame`, `ServerFrame`, `CloseCode`, `MAX_BODY_CHARS` |
| Room fan-out, generic over its payload | `apps/api/src/messaging/broker.ts` | `Broker`, `InProcessBroker` |
| Participant check, append, history | `apps/api/src/messaging/service.ts` | `resolveParticipant`, `appendMessage`, `historySince`, `currentSeq` |
| Socket lifecycle | `apps/api/src/messaging/ws.ts` | `registerMessageSocket` |
| Signed ticket issue and verify | `apps/api/src/messaging/ticket.ts` | `issueTicket`, `readTicket` |
| Status frames over SSE | `packages/contracts/src/events.ts` | `StatusFrame`, `CollabChanged`, `StatusHello` |
| Status room keys and bus type | `apps/api/src/events/bus.ts` | `StatusBus`, `brandRoom`, `creatorRoom` |
| SSE status endpoint | `apps/api/src/events/sse.ts` | `statusStream` |
| Live refresh on a status frame | `apps/web/src/components/live-collabs.tsx` | `LiveCollabs` |
| Brand and creator row owners, shared with the stream | `apps/api/src/routes/collab-routes.ts` | `brandFor`, `creatorFor` |
| Reconnecting client hook | `apps/web/src/lib/use-conversation.ts` | `useConversation` |
| Chat pane | `apps/web/src/components/conversation.tsx` | `Conversation` |
| Thrown API error, halts the hook chain | `apps/api/src/http.ts` | `HttpError`, `fail` |
| Session accessor that never returns undefined | `apps/api/src/guards.ts` | `session` |
| Cosine calibration | `packages/match/src/score.ts` | `normalizeCosine`, `SEMANTIC_FLOOR`, `SEMANTIC_CEILING` |
| Typed browser and server fetch | `apps/web/src/lib/api.ts` | `request`, `ApiFailure` |
| Sidebar, topbar, brand nav | `apps/web/src/components/shell.tsx` | `Sidebar`, `Topbar`, `BRAND_NAV` |
| Login and signup form, both sides | `apps/web/src/components/auth-form.tsx` | `AuthForm` |
| Inline SVG icon set | `apps/web/src/components/icon.tsx` | `Icon`, `IconName` |
| Money, percent, initials | `apps/web/src/lib/format.ts` | `money`, `count`, `percent`, `initials` |
| Design tokens and components, ported from the mockup | `apps/web/src/app/globals.css` | n/a |
| Brand onboarding flow, three stages | `apps/web/src/components/brand-onboarding.tsx` | `BrandOnboarding` |
| Creator onboarding flow, fetch then confirm | `apps/web/src/components/creator-onboarding.tsx` | `CreatorOnboarding` |
| Creator navigation | `apps/web/src/components/shell.tsx` | `CREATOR_NAV` |
| Validated AI environment | `packages/ai/src/env.ts` | `env` |
| Structured model call with repair retry | `packages/ai/src/openrouter.ts` | `complete` |
| Gemini embeddings, 768 dims, normalised | `packages/ai/src/embed.ts` | `embedDocument`, `embedQuery` |
| Provider selection by env var | `packages/ai/src/linkedin/select.ts` | `linkedInProvider` |
| Fingerprint maths, engagement and cadence | `packages/ai/src/linkedin/provider.ts` | `buildFingerprint` |
| Readable page text, strips CSS and scripts | `packages/ai/src/scrape.ts` | `readPage`, `THIN_CONTENT_THRESHOLD` |
| ICP generation and the thin-page failure | `packages/ai/src/icp.ts` | `generateIcp`, `ThinPageError` |
| Captured live API responses | `packages/ai/fixtures/` | `scrapecreators-profile.json`, `scrapecreators-post.json` |

Rows are marked when they are not yet built. Delete a row if the plan changes rather than
leaving a stale pointer.

---

## Data model summary

Planned. Nothing migrated yet.

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | One row per person. `email citext UNIQUE`, `account_type` immutable after insert. | root of everything |
| `workspaces` | A brand's team container. Exists from Phase 1 even though invites ship in Phase 5. | owns brands |
| `workspace_members` | `owner` / `admin` / `member` | users to workspaces |
| `workspace_invites` | Expiring signed tokens | workspaces |
| `brands` | Brand profile, ICP text, sector tags (max 3), ICP embedding `vector(768)` | workspace |
| `creators` | Creator profile, topic prefs (max 3), rate card, fingerprint `vector(768)` | user |
| `linkedin_profile_snapshots` | Cached provider responses with `fetched_at`, so we never pay twice inside the TTL | creators |
| `creator_match_scores` | Cached score plus `components jsonb` for the reason chips | brands, creators |
| `campaigns` | Normalized brief regardless of whether it came from AI, URL, or a document | brand |
| `collaborations` | One brand-creator engagement. Carries the state enum. | campaign, creator |
| `collaboration_events` | Append-only audit log of every transition | collaborations |
| `messages` | Persisted before broadcast so history survives a reconnect | collaborations |
| `wallets` | One per workspace and one per creator | workspace or user |
| `ledger_entries` | Double-entry, paired debit and credit rows, integer minor units | wallets |
| `escrow_holds` | Funds committed to a collaboration but not yet released | collaborations |
| `idempotency_keys` | Stored response body per key so a retry returns the original result | n/a |

---

## Conventions

Populated as they get established. Everything below is decided, not yet implemented.

**Contracts flow one direction.** Zod schema in `packages/contracts` becomes the Fastify
route schema through `fastify-type-provider-zod`, and the web client infers its types from
the same export. If you are writing an `interface` for a request or response body, stop.

**Money is integer minor units.** Never a float, never a string, never a `Decimal` class.
Cents as `bigint`. Formatting happens at the render layer only.

**Errors carry a code.** Every API error returns `{ code, message }` where `code` is a
stable string the frontend switches on. Message is for humans and may change freely.

**Env vars are declared and validated in one place per app**, parsed through a Zod schema at
boot. A missing var fails at startup, never at first use in production.

**Naming.** Files are kebab-case. Exports are camelCase for functions and PascalCase for
types and schemas. A Zod schema and its inferred type share a name: `Campaign` is the type,
`CampaignSchema` is the schema.

**Tests live next to what they test.** `score.ts` and `score.test.ts` in the same
directory. `bun test` finds them.

---

## Decision log

Append-only. Newest last.

**2026-08-27, Bun over pnpm and Node.** Package manager, workspaces, scripts, tests, and
the `apps/api` runtime. Replaces the pnpm plus Turborepo plus vitest stack that was in the
first draft of the plan. Turborepo dropped with it, since its remote caching pays off on
large teams and we are not one.

**2026-08-27, Next.js stays on Node.** The single carve-out to the Bun decision. `bun --bun
next dev` still hits App Router edge cases. Bun installs the deps and runs the script, Next
spawns its own Node process. Not our framework to debug.

**2026-08-27, Fastify over Express.** Zod schemas become route validation and typed handlers
with no cast. Plugin encapsulation makes it structurally impossible for the brand auth hook
to apply to creator routes, where Express middleware is one flat ordered list.
`@fastify/websocket` owns the upgrade handshake so unauthenticated upgrades get rejected
rather than accepted then closed. Performance was not the reason and is irrelevant at our
scale.

**2026-08-27, OpenRouter over a direct vendor SDK.** Model choice becomes an env var and the
`models` array gives ordered fallback on rate limits. Cost is that `json_schema` structured
output is not honored by every model behind it, handled by Zod re-validation plus one repair
retry.

**2026-08-27, Gemini for embeddings.** OpenRouter has no embeddings endpoint, so this is a
second provider by necessity. `gemini-embedding-001` at 768 dimensions. Free tier is far
above our volume.

**2026-08-27, Better Auth over Clerk and hand-rolled.** Self-hosted on our own Postgres, so
the account-type exclusivity rule lives in the same database as everything else and can be
enforced by a constraint rather than by a webhook.

**2026-08-27, no shadcn/ui.** Its defaults are the exact look the brief called AI slop.
Radix unstyled primitives for keyboard handling, focus management, and ARIA. Styling layer
written from the approved mockup.

**2026-08-27, register is `product`, personality is editorial and warm.** Craft bar set at
Arc / Family / Rauno tier: interaction mechanics over illustration. Full detail in
`PRODUCT.md`.

**2026-08-27, accessibility deferred.** Explicit project decision, no WCAG target for this
build. Two things stay in on craft grounds rather than compliance grounds: designed focus
states, and Radix unstyled primitives so a later retrofit is a styling job rather than a
rewrite. Recorded so nobody reads it as an oversight.

**2026-08-28, WebSocket protocol is versioned and typed in contracts.** `ClientFrame` and
`ServerFrame` are discriminated unions parsed with Zod on both ends. The server rejects an
unrecognised frame with a typed error rather than closing, so one bad client message does
not drop a conversation.

**2026-08-28, persist before broadcast, always.** A message is committed with its sequence
before it reaches any socket, including the sender's. Delivery is therefore recoverable from
the database alone, and `ready` plus a cursor is enough to resume exactly.

**2026-08-28, client ids are UUIDs, not ULIDs.** The plan said ULID. Ordering comes from the
server-assigned sequence, so the client id only needs uniqueness, and `crypto.randomUUID()`
provides that with no dependency.

**2026-08-28, the status stream authenticates by cookie through the `/bff` rewrite.** The
WebSocket needed a signed ticket because a browser cannot put headers on a socket and Next
does not proxy upgrades. Neither limit applies to SSE: `EventSource` sends same-origin
cookies, and the Next rewrite streams `text/event-stream` without buffering, verified with
`curl -N` against `http://127.0.0.1:3000/bff/brand/events`. The endpoint therefore sits
inside the existing guarded scope and reuses `requireRole`. No second auth path.

**2026-08-28, the broker is generic over its payload.** `Broker<T>` and `InProcessBroker<T>`
carry `Message` for the socket and `CollabChanged` for the status stream. One implementation
for both, and the type parameter stops either stream from delivering the other's frames.

**2026-08-28, one API process, no message bus.** Ujjwal's call. A second instance would need
the broker backed by something shared, and this product does not run one. `InProcessBroker`
is the implementation, not a placeholder. Delete the interface if a second implementation
never arrives.

**2026-08-28, the status frame does not carry the row.** It carries the identity of the
change: collaboration, reference, from, to, actor, fee. The client calls `router.refresh()`,
so the server component refetches and stays the only place that decides what a row and its
`allowed` array look like. A frame that carried the row would be a second copy of state to
keep in sync, and the stat cards recompute from the refetched rows for free.

**2026-08-28, one actions component for both sides.** `CollabActions` replaced the
creator-only `OfferActions`, which was starting to hold a second copy of the negotiation
rules. It takes `side` and the server-supplied `allowed` list and nothing else.

**2026-08-27, the state machine is a package, not a folder in db.** `packages/collab` holds
`transition` and `allowedEvents` as pure functions over a plain object. No database import,
no Fastify import. The route reads a row, calls `transition`, and writes the result inside
one transaction alongside an append-only `collaboration_events` entry.

**2026-08-27, effects are returned, not performed.** `transition` returns
`['hold_escrow', 'count_acceptance']` and the caller decides what that means. Keeps the
machine testable without a database and leaves Phase 4 free to implement escrow properly.

**2026-08-27, onboarding never saves a draft silently.** Both onboarding flows fetch, then
show everything for confirmation, then save on an explicit action. The brand flow surfaces
what it read (source, character count, model) beside the draft. The creator flow shows
`Unknown` for engagement when it could not be measured rather than a zero. Nothing reaches
the database until the person presses confirm.

**2026-08-27, plain CSS in the web app, not Tailwind.** The approved plan said Tailwind v4,
but `design-lab/imperial/app.css` was already a working design system with real class names
that the mockups proved. Rewriting it into utilities would have been a pure cost. `globals.css`
is that file, ported, with font paths repointed at `/fonts/`. Revisit if the component count
grows enough that class collisions become a problem.

**2026-08-27, hooks throw, handlers never assume a session.** `requireRole` throws
`HttpError`; `session(request)` is the only way to read a session and it throws 401 rather
than returning undefined. Sending from a hook did not halt the chain and produced a
misleading `ERR_HTTP_HEADERS_SENT`.

**2026-08-27, Postgres computes cosine, the scorer stays pure.** `CreatorInput.semanticFit`
is an optional precomputed value. The catalog selects `1 - (embedding <=> icp)` in SQL and
passes it in, so `packages/match` never touches the database and 768 floats per creator
never cross the wire.

**2026-08-27, cosine is calibrated, not raw.** See what breaks. The `(x + 1) / 2` mapping
made the semantic component nearly useless on real Gemini embeddings.

**2026-08-27, Better Auth kept, schema reshaped to fit it.** The approved plan chose
Better Auth, so its four tables (`user`, `session`, `account`, `verification`) replaced the
hand-rolled `users` and `sessions`. `account_type` rides as an additional field on `user`,
IDs are UUIDs via `advanced.database.generateId`, and the immutability trigger moved onto
`"user"`. Domain tables now reference `user.id` as `text`.

**2026-08-27, auth routes are ours, sessions are Better Auth's.** `/brand/signup`,
`/brand/login`, and the creator mirrors are thin wrappers that check account-type
exclusivity first and then delegate to `auth.api.signUpEmail` and `auth.api.signInEmail`.
That buys a precise 409 with the correct login path in the message, which Better Auth alone
would return as a generic duplicate-email error.

**2026-08-27, engagement rate is nullable end to end.** Forced by what ScrapeCreators
actually returns. `null` means unknown, is scored as a neutral, and is never coerced to 0.

**2026-08-27, post enrichment is capped and configurable.** `LINKEDIN_ENRICH_POSTS`,
default 5. Onboarding one creator costs `1 + N` ScrapeCreators credits. Set it to 0 to skip
engagement and rely on cadence plus topic signal alone.

**2026-08-27, OpenRouter primary is `google/gemini-2.5-flash`,** with
`anthropic/claude-3.5-haiku` and `openai/gpt-4o-mini` as ordered fallbacks. Picked after a
live ICP run against ashbyhq.com returned correct sectors in 3.7s with no repair retry.
Override with `OPENROUTER_MODEL`.

**2026-08-27, typefaces: ID Grotesk plus Times.** Ujjwal's call, after "Tempting" was
raised and turned out to be a personal-use script font by MOH, wrong for a dashboard.

ID Grotesk (ID Typeface, Khairil Anwar) carries the whole interface. Commercial licence,
sold through MyFonts and YouWorkForThem, no free CDN, so it must be bought and self-hosted
at `apps/web/public/fonts/`. Until then the stack falls through to Inter, which is close
enough structurally that nothing reflows when the real files arrive. The `@font-face` rules
already point at the expected filenames and silently no-op while those 404.

Times carries page titles and the identity card name, nothing else. It is a system font
everywhere, so it costs no request. Hard limit: never on a button, label, table cell, or
number, because web Times has no reliable tabular figures and a number column drifts out of
alignment as values update.

**2026-08-27, no build step in the packages.** Dropped TypeScript project references,
`composite`, and emitted declarations. Bun runs the TypeScript directly and `tsc` is only a
typechecker. One root `tsconfig.json`, one `tsc --noEmit`.

**2026-08-27, match scoring lives in one file, not a components directory.** Five component
functions plus a scorer and a ranker is under 200 lines. A directory per function would be
abstraction without a second caller.

**2026-08-27, semantic fit falls back to a neutral 0.5 when either embedding is missing.**
Constant for everyone who lacks one, so it never reorders that group. Every creator gets an
embedding at onboarding, so the fallback should only fire in tests and during backfill.

**2026-08-27, reliability uses a Bayesian prior rather than a raw ratio.** `(delivered +
0.5 * 4) / (accepted + 4)`. A creator with one delivered post out of one does not outrank
someone with 19 of 20, and a brand-new creator sits at exactly 0.5 instead of 0 or 1.

**2026-08-27, round 2: Imperial Blue on White Convolvulus, Inter, product register.**
Round 1 was rejected by Ujjwal as messy, with the wrong typeface and the wrong register.
Replaced wholesale. Palette is `#021F94` and `#F5F2F3`, supplied directly. Structure comes
from seven reference layouts he provided: fixed 248px sidebar with grouped nav, sticky top
bar with a `⌘K` search, stat cards with delta badges, white cards at 12px radius on a warm
off-white page, soft-fill status pills, avatar-led table rows, optional 300px right rail.

The instruction was to stay inside those references and invent nothing beyond them, so the
work here is calibration rather than expression. Three things that make it read as
considered rather than generated: negative letter-spacing on everything above 20px, tabular
figures on every mutable number, and a specific context line under each stat instead of "vs
last period".

Inter is now correct despite round 1 naming it an anti-reference. The register changed. The
impeccable product reference states plainly that system fonts and Inter are legitimate here
and that one family is usually right.

**2026-08-27, round 1 rejected. The Masthead metaphor, chosen from three.** The platform is a publication:
brands commission, creators contribute, collaborations are assignments. Beat The Studio
Visit (post-forward, too slow to scan at volume) and The Ledger (ruled register, made
creators read as inventory, which fights supply-side retention).

**2026-08-27, round 1 rejected. Oxblood and Bone, committed colour strategy.** Oxblood carries 25 to 40% of
any screen rather than sitting as trim on buttons. Gilt appears only where money is
unresolved. Status states differ by fill, outline, and dot presence, never colour alone.

**2026-08-27, round 1 rejected. Vertical rail on every variant, no horizontal tabs.**
Carried forward into round 2: the sidebar is the only navigation there too. Ujjwal's call. The
oxblood rail is now the only navigation chrome across all four variants, which removed the
masthead band entirely along with `.tabs` and `bandChrome`. Consequence worth knowing: the
variants no longer differ by chrome at all, only by density and layout. The command palette
and the numeric shortcuts (press 1 through 7) came along with it and are now on every
screen, not just Dense Ops.

**2026-08-27, ScrapeCreators behind a provider interface.** Never called directly. LinkedIn
sued Proxycurl out of existence in 2025, so any scraping intermediary is assumed temporary
by design.

---

## What breaks

Sharp edges, gotchas, and things that look wrong but are deliberate. Anything that costs
more than twenty minutes to figure out belongs here.

### pgvector indexes cap at 2000 dimensions

`gemini-embedding-001` returns 3072 dimensions by default. Neither HNSW nor IVFFlat can
index a column that wide, so a `vector(3072)` column silently degrades every similarity
query to a sequential scan. Nothing errors. It just gets slow as the catalog grows.

Fix, already in the design: request `outputDimensionality: 768` from the API. The model
supports Matryoshka truncation, so the shorter vector is a valid embedding rather than a
truncated one. Column is `vector(768)` with an HNSW index using cosine distance.

If someone later "upgrades" to 3072 for quality, they will not see a failure. Check
`EXPLAIN` output for an index scan as part of Phase 1 verification.

### Gemini `taskType` must differ between the two sides

Creator post corpora embed with `taskType: RETRIEVAL_DOCUMENT`. Brand ICPs embed with
`taskType: RETRIEVAL_QUERY`. Using the same value on both sides produces cosine similarities
that look completely plausible and rank subtly wrong. There is no error and no obvious
symptom, only worse matches.

`packages/ai/src/embed.ts` exports `embedDocument` and `embedQuery` as two separate
functions specifically so nobody passes a task type by hand.

### Next.js runs on Node while everything else runs on Bun

Deliberate. See the decision log. Consequences:

- Anything imported by both `apps/web` and `apps/api` must run on both runtimes. Keep
  Bun-specific APIs out of `packages/`.
- `bun run dev` starts two processes on two different runtimes. If web behaves oddly under
  a Bun-specific change, that is why.

### LinkedIn no longer returns job title or work history publicly

The ScrapeCreators profile endpoint returns only what an incognito browser sees, and
LinkedIn stopped exposing employment data there. Those fields come back empty. The creator
identity card is designed without them on purpose, not by oversight. Do not add a "current
role" field expecting the provider to fill it.

### ScrapeCreators takes about 3 seconds

Quoted average is 3.12s. Too slow to sit inside a form submit with a spinner. Creator
onboarding step 3 needs a progress state substantial enough to hold attention, which is why
the identity card reveal is framed as an event rather than a page load.

### Message ordering is per connection, not per arrival

The first version dispatched every incoming send with `void deliver(...)`. Ten messages
typed quickly produced ten concurrent transactions racing for the same row lock. Sequences
came out unique and monotonic, but not in the order the person typed:

```
sent:     burst 0,1,2,3,4,5,6,7,8,9
received: burst 2,0,1,6,8,9,7,3,5,4
```

A row lock serialises access. It does not preserve arrival order, and neither does the
async dispatch that queues behind it.

Each connection now owns a promise chain, so its own sends are applied in the order they
arrived. Total order across different senders stays arbitrary, which is correct: two people
typing at once have no meaningful relative order until the server assigns one.

### Sequence assignment holds a row lock, on purpose

`appendMessage` runs in one transaction: `SELECT ... FOR UPDATE` on the collaboration, then
a check for the client id, then `UPDATE ... message_seq + 1`, then the insert. The lock
comes first so the idempotency check cannot race, and so a retried send never burns a
sequence number.

A global `bigserial` would have been simpler and wrong. Concurrent inserts commit out of
order, so a reader can observe seq 5 before seq 4 exists, resume from 5, and silently lose
a message. A per-room counter under a lock has no such gap.

### Broker messages are buffered until history replay finishes

A message published while a connection is still loading its history would otherwise be sent
first, advance `lastSentSeq` past the replay, and cause the replay to be skipped as stale.

The connection starts in a `loading` phase that pushes live messages into a buffer. After
`ready` and the replay it flips to `live`, sorts the buffer by seq, and drains it through
the same de-duplicating emit. Dedupe is by `seq > lastSentSeq`, which is constant memory,
unlike the set of delivered ids the first draft used.

### Shutdown must drain accepted writes, not only close sockets

`app.close()` closed every socket and returned while `appendMessage` transactions were still
open. In the test suite that met a cleanup `DELETE FROM users` and deadlocked:

```
deadlock detected
Process 937 waits for ShareLock on transaction 17599; blocked by process 876.
while deleting tuple in relation "collaborations"
```

The delete cascade held a lock on one collaboration and waited for another; the in-flight
insert into `messages` held that one under `SELECT ... FOR UPDATE` and waited for an FK share
lock on the first. Reproducible across full runs, invisible when either file ran alone.

`registerMessageSocket` now tracks the tail of every connection's send chain in a `writing`
set and the `onClose` hook awaits `Promise.allSettled` over it after closing the sockets. A
message the server acknowledged is committed before the process goes away, which is the
behaviour a shutdown owed anyway. A longer sleep in the test would have hidden it.

### Open sockets stop Fastify from closing

`app.close()` hung forever in tests. WebSocket connections never drain on their own, so
Fastify waits for them indefinitely. The symptom is a test run that prints no summary and
never exits, which reads like a hang in the tests themselves.

`registerMessageSocket` tracks every open socket and closes them from an `onClose` hook with
`CloseCode.serverShutdown`, and the Fastify factory sets `forceCloseConnections: true`. This
is a real graceful-shutdown requirement, not a test workaround.

### The status stream needs writeHead, not reply.send

Fastify owns the response until `reply.hijack()`. The SSE handler resolves its room, hijacks,
then writes headers on `reply.raw` itself, which means the CORS headers set by the `onRequest`
hook never flush and have to be repeated in the `writeHead` call. `x-accel-buffering: no` and
`cache-control: no-transform` are there for proxies that would otherwise hold the stream.

Open streams block `app.close()` exactly like open sockets, so `statusStream` keeps its own
set of responses and ends them from an `onClose` hook.

### Browsers cannot set headers on a WebSocket, so the socket uses a signed ticket

The web app reaches the API through a same-origin `/bff` rewrite so cookies work. That does
not extend to WebSockets: Next does not reliably proxy upgrades, and connecting straight to
the API origin sends no cookie because the cookie belongs to the web origin.

The client therefore POSTs to `/bff/{side}/collaborations/:id/ws-ticket` over the proxy,
which authenticates by cookie, and receives an HMAC-signed ticket bound to the user, the
account type, and that one collaboration, valid for 30 seconds. The socket connects directly
to the API with `?ticket=`.

The ticket is verified with `timingSafeEqual`. It is not single-use: the 30 second window is
the bound. Tests cover a tampered signature and a ticket presented for a different
conversation.

Cookie auth still works on the socket and is what the server-side tests use, so nothing
depends on tickets existing.

### Bun does not implement the ws 'unexpected-response' event

```
[bun] Warning: ws.WebSocket 'unexpected-response' event is not implemented in bun
```

A rejected upgrade cannot be observed through the `ws` client under Bun. The server behaves
correctly: `HTTP/1.1 401 Unauthorized` with a JSON body, verified by opening a raw
`node:net` socket and writing the upgrade request by hand. The rejection tests assert on
those bytes, which is a stronger assertion than the client event would have been.

### The sender receives its own message back

`ack` carries the assigned sequence, and the full message is echoed to the sender as well.
The client needs the canonical row, its server timestamp and resolved sender name, to
replace the optimistic entry. Assertions about "what the other side received" must filter on
`message.sender`, or they will match the echo.

### One collaboration per campaign and creator, which shapes the tests

`collaborations_campaign_creator_key` is a unique index on `(campaign_id, creator_id)`. A
second invitation for the same pair fails, so any test that needs two collaborations with one
creator has to mint a campaign per case. The SSE tests do that through a `newCampaign` helper.
The first version reused one campaign and the second invite came back as an error body, which
surfaced three steps later as `404 No such assignment` on an unrelated move.

### The UI never decides what a button should do

`GET /collaborations` returns an `allowed` array per row, computed by `allowedEvents` from
the same rule table the writes go through. `CollabActions` renders one button per entry and
sends that event back. There is no client-side copy of the state machine, no list of which
buttons belong to which state, and nothing to drift.

Observed live on a fresh invitation:

```
brand:   state=invited  allowed=['cancel']
creator: state=invited  allowed=['accept', 'decline', 'counter', 'cancel']
```

Guards that are not visible in the rule table still hide the button, because `allowedEvents`
re-runs `transition` on each candidate. The counter cap, the missing tracked link, and
accepting your own counter all disappear from the UI without any UI code knowing they exist.

Adding a state or an event means editing `packages/collab/src/transitions.ts` and adding a
label to `LABEL` in `collab-actions.tsx`. Nothing else.

### Route groups keep the shell off the auth pages

`app/brand/(app)/` carries the sidebar layout and holds `catalog`, `campaigns`, and
`collaborations`. `login`, `signup`, and `onboarding` sit outside it and render bare.
Parenthesised segments do not appear in the URL, so `/brand/catalog` is unchanged.

The right rail is now a `.main-in.railed` modifier on the page rather than a class on the
shell, because only the catalog and the creator card have one.

After moving page directories, delete `apps/web/.next` before typechecking. Next caches
generated route validators and reports missing modules for the old paths, which reads like a
broken import.

### Nobody may accept their own counter-offer

Caught while clicking through the offers screen, not by a test. The rule table lets either
side accept from `countered`, because a counter can come from either direction. But the
machine had no memory of *who* countered last, so a creator could counter at a higher fee
and immediately accept their own counter, raising their own price unilaterally.

`Collaboration.lastCounterBy` now records the actor on every counter, persisted as
`collaborations.last_counter_by`, and `transition` refuses `accept` when the acceptor is
the one who made the standing offer:

```
cannot_accept_own_counter: "You made the last offer. The other side has to answer it."
```

Any future two-party negotiation state needs the same treatment. A symmetric rule table is
not enough when the parties alternate.

### The tracked-link rule is enforced twice, deliberately

`transition` refuses `publish` without a tracked link, and the `collaborations` table
carries a CHECK constraint:

```sql
state not in ('published', 'verified', 'paid') or tracked_link is not null
```

The state machine gives a useful message. The constraint means a bug in the route, a
migration, or a manual `UPDATE` cannot produce a published row with no attribution. This is
the structural answer to the incumbent's 62% attribution coverage, so it does not rely on
application code being correct.

### Bun loads .env from the working directory, not the file's package

A one-off script placed in `packages/db` and run as `cd packages/db && bun run script.ts`
fails with `DATABASE_URL is not set`, because Bun looks for `.env` in the cwd. Run it from
the repo root instead: `bun run packages/db/script.ts`.

Module resolution works the opposite way and follows the file. A script at the repo root
cannot `import { eq } from 'drizzle-orm'`, because that package is installed under
`packages/db/node_modules`. So an ad-hoc database script must **live inside
`packages/db`** and **run from the root**. Both halves are needed.

### allowedEvents is derived, not a second source of truth

`allowedEvents` filters the rule table and then re-runs `transition` on each candidate, so
guards that are not visible in the table (counter caps, the missing tracked link, accepting
your own counter) automatically hide the action in the UI. There is no separate list of
what a button should show, which is what usually drifts.

### Sector order is load-bearing, not cosmetic

`tagAffinity` weights each sector by the position it holds on both sides, so the order a
brand lists its sectors changes the ranking. Observed live: with Loopwork's ICP
(`HR Tech, Recruiting, B2B SaaS`) Amara Boateng scored 89 and Rachel Osei 84. With Ashby's
ICP (`Recruiting, HR Tech, B2B SaaS`) Rachel moved ahead at 83 against Amara's 79, because
Rachel lists Recruiting first and Amara lists it second.

This is the intended behaviour and it is worth stating in the onboarding copy: the order
you drag your sectors into is a real signal, not a display preference. The picker currently
appends in click order, which is the ordering the algorithm reads.

### Redirects must point at pages that exist

A creator landing on `/brand/catalog` was redirected to `/creator/offers`, which was never
built, so a correct 403 turned into a 404 dead end. Now redirects to `/creator/card`.

Whenever a guard or redirect names a route, check the route exists. The sidebars currently
link to several unbuilt pages (`/brand/dashboard`, `/creator/offers`, and others). Those are
visible 404s rather than silent failures, and they are listed in the build state.

### React splits adjacent text nodes in server-rendered HTML

`<span className="lbl">Contributor {card.contributorNumber}</span>` renders as
`Contributor <!-- -->0144`. Scraping with `/class="lbl">([^<]+)</` captures only
`Contributor ` and looks like a missing value.

The page is correct. When asserting on SSR output, match the value on its own rather than
expecting a joined string.

### Non-ASCII in shell assertions is unreliable on Windows

Checking for `€1,500` in piped HTML reported a false negative through the Git Bash and
Python pipeline, while `grep -oE "€[^<]{0,12}"` found it immediately. Assert on the digits,
not the currency symbol, when verifying through the shell.

### The web app talks to the API through a /bff rewrite, never cross-origin

Next runs on 3000, Fastify on 3001. Calling the API directly from the browser would make
every request cross-origin, which means session cookies need `SameSite=None; Secure` and a
CORS preflight on every call.

Instead `next.config.ts` rewrites `/bff/:path*` to the API. The browser only ever talks to
its own origin, so cookies are plain `SameSite=Lax` and there is no preflight.

The prefix is `/bff` rather than `/api` on purpose: Better Auth already owns `/api/auth/*`
on the Fastify side, and a `/api` rewrite would produce `/api/api/auth/...`.

Server components bypass the proxy and call `API_URL` directly, forwarding the incoming
cookie. `request()` in `apps/web/src/lib/api.ts` picks the base by checking for `window`.

### Root tsc cannot typecheck the Next app

The root `tsconfig.json` has no `jsx` setting, so including `apps/web` produced
`TS17004: Cannot use JSX unless the '--jsx' flag is provided` on every component. The web
app needs `jsx: preserve`, DOM libs, and the Next plugin, none of which belong in a config
shared with Bun packages.

Root config now covers `packages/*` and `apps/api`. `bun run typecheck` runs `tsc --noEmit`
at the root and then `typecheck:web`, which runs `tsc --noEmit` inside `apps/web`.

### Next auto-installs @types/node with yarn and breaks on workspace protocol

`next build` detected missing `@types/node` and shelled out to yarn, which cannot resolve
`workspace:*`:

```
Error: Couldn't find package "@lm/contracts@workspace:*" required by "@lm/match@0.0.0"
```

The failure names the wrong packages entirely. Fix is to declare `@types/node` in
`apps/web/package.json` so Next never tries. Any dependency Next expects to auto-install
needs the same treatment.

### Use 127.0.0.1, not localhost, when curling either server

`localhost` resolves to `::1` on this machine and neither server binds IPv6, so curl
returns exit 7 with an empty status while the process log clearly says it is listening.
That combination reads like a crash and is not one.

### One CSS class, several parents

`.nm` styles the workspace name in the sidebar, the contributor name on a creator card, and
the name in a table row. That is correct CSS, each rule scoped by its parent, but it means
scraping the rendered HTML for `class="nm"` picks up the sidebar too. Match inside
`<article class="person">` when asserting on catalog output.

### Returning a reply from an async preHandler does not stop the handler

This one produced a confusing failure. The guard sent `403 wrong_account_type` correctly,
the client saw the right status and body, and then the route handler **also ran** and threw
on `request.session!.userId` because the session was never set. The visible symptom was
`ERR_HTTP_HEADERS_SENT` from Fastify's fallback error handler, which points at the wrong
place entirely.

`requireRole` now throws `HttpError` instead of calling `reply.send()`. Fastify halts the
chain reliably on a thrown error, and `setErrorHandler` renders it as `{ code, message }`.

Rules that follow:

- A hook that must reject **throws**, it does not send.
- Handlers read the session through `session(request)`, which throws 401 rather than
  returning `undefined`. There is no `request.session!` anywhere.

### Query strings are strings, Zod needs coerce

`limit: z.number()` rejected `?limit=24` with a 400, because a query value arrives as
`"24"`. `CatalogQuery` uses `z.coerce.number()`. Object-valued params cannot ride a query
string at all, so `weights` is a JSON string parsed through a transform and then piped into
`MatchWeights`.

### CORS headers belong in onRequest, not onSend

Setting response headers in an `onSend` hook throws once a reply has already been flushed,
which happens for any route that forwards a `Response`. Moved to `onRequest`, where the
preflight short-circuit also lives.

### Forward only the headers you mean

Copying every header off Better Auth's `Response` into a Fastify reply carried
`content-length` with it. Fastify then wrote a body of a different length and the request
died after send. `forward()` now copies exactly two things: the `getSetCookie()` array and
`content-type`.

### Test files share module singletons in Bun

`auth.test.ts` and `onboarding.test.ts` both import the pool from `auth.ts`, and Bun runs
test files in one process. The first file's `afterAll` called `pool.end()`, so every test in
the second file failed with `Cannot use a pool after calling end on the pool`.

No test closes the shared pool now. `createPool()` sets `allowExitOnIdle: true` so the
process still exits cleanly.

### Gemini cosine similarities occupy a narrow band, so calibrate

Mapping cosine with `(x + 1) / 2` assumes the value can go negative. Gemini embeddings on
natural English text do not: across the seeded catalog, real similarities ran 0.544 to
0.714. That mapping squashed every creator into 0.77 to 0.86, and a Gaming creator scored
higher than a MarTech one against a recruiting ICP. The component was technically live and
practically useless.

`normalizeCosine` stretches the band that actually occurs:

```ts
export const SEMANTIC_FLOOR = 0.45;
export const SEMANTIC_CEILING = 0.78;
clamp01((similarity - SEMANTIC_FLOOR) / (SEMANTIC_CEILING - SEMANTIC_FLOOR))
```

Semantic fit now spans 0.28 to 0.80 across the same catalog and the recruiting creators
separate cleanly. Re-measure these two constants if the embedding model changes, or if the
corpus shifts from short bios to full post history.

### The catalog scores every creator in memory

`GET /brand/catalog` selects all listed creators, computes cosine in SQL, then ranks in JS.
Correct and fast at 14 creators, wrong at 10,000. Postgres also chooses a sequential scan
at this size, so the HNSW index is built but not yet exercised.

Before the catalog grows past roughly a thousand rows: push the ordering and a `LIMIT` into
SQL using the `<=>` operator so HNSW is used, then score only the returned page. The
scoring function already accepts a precomputed `semanticFit` for exactly this reason.

### Headers.entries() drops Set-Cookie, use getSetCookie()

Better Auth returns a web `Response`. Forwarding its headers to Fastify by iterating
`response.headers.entries()` loses the session cookie: the Fetch spec has `entries()` merge
or omit `Set-Cookie`, because a merged cookie header is not valid. The result looked like
Better Auth was not issuing a session at all, and every guarded route returned 401.

`forward()` in `routes/auth-routes.ts` reads `response.headers.getSetCookie()` first, sets
that array on the reply, then copies the remaining headers while skipping `set-cookie`.

Any future place that bridges a `Response` into Fastify needs the same treatment.

### Better Auth owns its table shape, ask the library rather than guessing

Better Auth 1.7.2 requires `account.issuer`, which older documentation and examples do not
mention. The Drizzle adapter fails at runtime, not at boot, with:

```
BetterAuthError: The field "issuer" does not exist in the "account" Drizzle schema.
```

Do not guess the field list. Print the authoritative one:

```ts
import { getAuthTables } from 'better-auth/db';
console.log(getAuthTables(auth.options));
```

That returns every model, its `modelName`, and each field with type and required flag.
Align `packages/db/src/schema.ts` to it exactly, then regenerate the migration.

The four tables are `user`, `session`, `account`, `verification`, singular by Better Auth
convention, which is why they sit next to plural domain tables like `creators` and
`brands`. That inconsistency is deliberate: matching the library costs nothing, fighting it
costs a mapping layer.

### Exclusivity is enforced in three places, on purpose

1. `uniqueIndex` on a `citext` email column, so casing cannot create a second account.
2. A `BEFORE UPDATE` trigger on `"user"` that raises if `account_type` changes.
3. `accountTypeFor(email)` checked in the route before Better Auth is called at all.

Layer 3 exists so the user gets `409 email_belongs_to_other_account_type` with a message
naming the right login page, instead of a constraint violation. Layers 1 and 2 exist so a
bug in layer 3 cannot corrupt data. Do not remove any of them.

### ScrapeCreators does not return engagement on the profile endpoint

The most expensive discovery so far, because it forced a contract change.

`GET /v1/linkedin/profile` returns `recentPosts` as
`{ link, id, title, datePublished, activityType }`. No reaction count, no comment count, and
`title` is the post text truncated to roughly 60 to 370 characters. Engagement rate, which
every creator card and the `audienceFit` component depend on, is not there.

`GET /v1/linkedin/post` does return `likeCount`, `commentCount`, and the full untruncated
`description`. Engagement therefore costs one extra credit per post.

What that means in the code:

- `Fingerprint.engagementRate` is `number | null`. Unknown is not zero, and coercing it to
  zero would rank every un-enriched creator last.
- `audienceFit` falls back to a neutral 0.5 when engagement is null, the same way
  `semanticFit` does when an embedding is missing.
- `LINKEDIN_ENRICH_POSTS`, default 5, caps how many posts get enriched. Onboarding costs
  `1 + N` credits and never surprises anyone.
- Cadence and the embedding corpus come free from the profile call, since `datePublished`
  and the truncated text are both real signal.

Corrected from earlier research: `experience` and `education` **are** returned, but company
names come back masked as `************ ******` because the scrape is unauthenticated. Work
history is still unusable, for a different reason than first recorded.

### Bun's expect().rejects hangs on rejected pg queries

`await expect(pool.query(bad)).rejects.toThrow(/…/)` never settles inside `bun test`. The
run hangs until the outer timeout and the other tests in the file report nothing, which
makes it look like a database or SSL problem. The identical query rejects correctly in a
plain script.

Use an explicit try/catch helper, which also asserts a failure actually happened instead of
silently passing on a resolved promise:

```ts
async function expectFailure(run: () => Promise<unknown>, pattern: RegExp) {
  let message = '';
  try { await run(); } catch (error) { message = (error as Error).message; }
  expect(message).toMatch(pattern);
}
```

### Readability leaks CSS when it bails out

`new Readability(document).parse()` returned almost nothing for a styled marketing site, so
the `document.body.textContent` fallback fired and swallowed every `<style>` block. Tens of
kilobytes of raw CSS went to the model on the first ICP run. It still produced correct
sectors, which is exactly why this was easy to miss.

`readPage` now removes `script, style, noscript, svg, template, iframe, link, meta` before
parsing, runs Readability against a clone, and only falls back to `body.textContent` when
the readable text is under a quarter of the fallback length. JSDOM gets a bare
`VirtualConsole` so its stylesheet-parser complaints stay out of the API logs.

Verified after the fix: ashbyhq.com yields 1,810 clean characters, linear.app 4,597.

### Neon wants sslmode=verify-full, not require

`pg` v8 warns on every connection that `sslmode=require` changes meaning in v9.
`connectionString()` rewrites `require` to `verify-full`, which matches the current
behaviour and works with Neon's certificates. Connection time is unchanged at roughly
550ms.

### Relative paths in a base tsconfig resolve against the base file, not the extender

`rootDir: "src"` in `tsconfig.base.json` at the repo root meant every package that extended
it got the repo root as its rootDir, producing `error TS6059: File ... is not under rootDir`
for every source file. The same applies to `outDir`, `include`, and any other path.

Resolved by deleting the whole build-output setup. Bun consumes TypeScript directly, so
project references, `composite`, and emitted declarations bought nothing. There is now one
root `tsconfig.json` covering every package, and `typecheck` is `tsc --noEmit`.

Side effect worth knowing: the broken config had already emitted `.js` and `.d.ts` next to
the sources, and `bun test` counted those copies as real test files. 28 tests reported as
84. If a test count suddenly triples, look for stray build output before looking at the
tests.

### `bun --filter` does not match workspace packages here

`bun --filter @lm/db run generate` returns `error: No packages matched the filter`, with or
without quoting, even though the package resolves fine for imports. Root scripts use
`cd packages/db && bun run …` instead. Revisit if a later Bun version fixes it.

### The `hidden` attribute loses to any author `display` rule

Cost an hour. The command palette shipped stuck open on every screen because `.cmd` sets
`display: grid`, and the `hidden` attribute's browser default is only `display: none` at
the very bottom of the cascade. Setting `el.hidden = true` wrote the attribute and changed
nothing on screen, so the overlay covered the page and could not be dismissed.

Any element that carries a `display` rule in our CSS and is toggled with `.hidden` needs an
explicit `[hidden] { display: none; }` guard. `shell.css` carries one for `.cmd`,
`.cmd-row`, and `.cmd-sec`.

This will bite again in React. When `packages/ui` gets a dialog, popover, or filtered list,
either guard the selector or toggle a class rather than the attribute.

### "Idempotency" means two different things in this project

The brief used the word for the rule that one email cannot hold both a brand and a creator
account. In this codebase that is called **account-type exclusivity** and it is a database
constraint plus a trigger plus a signup hook.

**HTTP idempotency keys** are a separate mechanism on money-moving endpoints, so a retried
request returns the original response instead of charging twice. Both exist. They are not
related. Do not merge them.

---

## Verification commands

```
bun install
bun run dev            api on bun, web on node, both at once
bun run dev:api
bun run dev:web
bun test               all packages
bun run typecheck      tsc --noEmit across workspaces
bun run db:generate    drizzle-kit generate
bun run db:migrate
bun run db:seed
```

Phase 0 has no commands. Open `design-lab/index.html` in a browser and click through at
1440px and 390px.

Per-phase acceptance criteria live in the plan file at
`~/.claude/plans/i-want-to-create-witty-avalanche.md`.
