# findings.md

Context hub. Read this before touching anything. If you find yourself grepping the repo to
answer a structural question, the answer was missing here and you should add it.

Companion file: `research.md` holds market, vendor, and design research plus the feature
request log. This file holds the state of the code.

---

## Build state

Last updated: 2026-08-27

Right now: Phase 1 in progress. `packages/contracts`, `packages/match`, and `packages/db`
are built and verified. Next up: `packages/ai`, then `apps/api`, then `apps/web`.

Design direction is settled, see the round-2 note below. Open `design-lab/imperial/brand.html` and
`design-lab/imperial/creator.html`. These supersede everything in `design-lab/brand/`,
`design-lab/creator/`, `design-lab/direction.html`, and `design-lab/index.html`.

Direction locked on the second round: **Imperial Blue `#021F94` on White Convolvulus
`#F5F2F3`**, Inter throughout, card-and-sidebar product layout in the Raycast, Linear, and
Stripe idiom. See `DESIGN.md`.

The first round (The Masthead metaphor, Oxblood and Bone, Boska serif, hairline rules) was
rejected: messy, wrong typeface, wrong register. Those 26 screens are dead. Do not read
them as current.

| Phase | Scope | Status |
|---|---|---|
| 0 | Research docs, design tokens, 26 mockup screens | in progress |
| 1 | Auth, both onboardings, catalog, match algorithm | in progress |
| 2 | Campaigns, collaboration state machine, tracked links | not started |
| 3 | Messenger over WebSocket, SSE status stream | not started |
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
| Sign-off from Ujjwal | **waiting** | n/a |
| Round 1, all 26 screens | **superseded, rejected** | `design-lab/brand/`, `design-lab/creator/`, `design-lab/index.html`, `design-lab/direction.html` |

One mockup per side. No build step, no dependencies, Inter from Google Fonts, icons inline
as an SVG sprite.

Nothing in `apps/` or `packages/` exists yet. Phase 0 output is static HTML with no build
step and no dependencies.

### Phase 1 detail

| Item | Status | Files |
|---|---|---|
| Bun workspace skeleton | done | `package.json`, `tsconfig.json`, `bunfig.toml` |
| Shared contracts and taxonomy | done, 12 tests | `packages/contracts/src/` |
| Match scoring engine | done, 16 tests | `packages/match/src/score.ts` |
| Database schema and migration | done, generated | `packages/db/src/schema.ts`, `packages/db/migrations/0000_awesome_songbird.sql` |
| Account-type trigger and pgvector indexes | written, not yet applied | `packages/db/src/sql/guards.sql` |
| Migration applied to a real database | **not started**, needs `DATABASE_URL` | n/a |
| AI layer, OpenRouter and Gemini | not started | `packages/ai/` |
| Fastify API and auth | not started | `apps/api/` |
| Next.js web | not started | `apps/web/` |

`bun test` is 28 passing. `bun run typecheck` is clean.

### Blocked

| What | Blocked on | Workaround |
|---|---|---|
| Applying migrations | A Neon `DATABASE_URL` | Schema and migration are generated and reviewable without one |
| Real creator onboarding | ScrapeCreators API key from Ujjwal | `ManualPasteProvider`, plus fixture data for all UI work |
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
| Collaboration state machine | `packages/db/src/collaboration/transitions.ts` | `transition`, `ALLOWED` (Phase 2, not built) |
| LinkedIn provider interface | `packages/ai/src/linkedin/provider.ts` | `LinkedInProfileProvider` |
| ScrapeCreators implementation | `packages/ai/src/linkedin/scrapecreators.ts` | `ScrapeCreatorsProvider` |
| Manual paste implementation | `packages/ai/src/linkedin/manual.ts` | `ManualPasteProvider` |
| OpenRouter client | `packages/ai/src/openrouter.ts` | `complete` |
| Gemini embeddings | `packages/ai/src/embed.ts` | `embedDocument`, `embedQuery` |
| Role guards | `apps/api/src/auth/guards.ts` | `requireRole` |
| Ledger operations | `apps/api/src/billing/ledger.ts` | `credit`, `debit`, `hold`, `release` |

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
