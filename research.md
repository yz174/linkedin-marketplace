# research.md

Market, vendor, and design research for the LinkedIn creator marketplace.
Append-only below the state block. Every entry carries a date.

---

## Research state

Last updated: 2026-08-28

| Topic | Status | Re-check |
|---|---|---|
| Naano product teardown | done | when they ship a pricing change |
| Category landscape | done | quarterly |
| ScrapeCreators LinkedIn API | done, key supplied and tested live | when the post shape changes |
| OpenRouter structured output support per model | done, gemini-2.5-flash verified | if the pinned model changes |
| Gemini embeddings limits and dims | done | if model version changes |
| Better Auth + Fastify + Bun integration | done, 10 tests, schema reshaped to its tables | if better-auth majors |
| Neon + pgvector + Drizzle setup | done, migrated and tested live | n/a |
| LinkedIn legal position | done | annually or on new litigation |
| Typography and color direction | done, ID Grotesk plus Times | n/a |
| Metaphor and palette | round 1 rejected, round 2 approved | n/a |
| Round 2 direction: Imperial Blue, ID Grotesk + Times | approved 2026-08-27 | n/a |
| ID Grotesk licence and woff2 files | **open**, must be purchased | before the web app ships |
| Document parsing libs under Bun | not started | before campaign uploads |
| Creator supply acquisition strategy | not started | before launch, not before build |
| WebSocket transport, auth on upgrade, resume | done, 24 tests | if the protocol version changes |
| SSE for status and analytics | done, 4 tests, cookie auth through the /bff rewrite | if the frame set grows |

Open questions:

- **ID Grotesk licence.** Must be purchased from MyFonts or YouWorkForThem and the woff2
  files self-hosted at `apps/web/public/fonts/`. Inter is the fallback in the stack, so
  nothing reflows when the real files land. This is the only thing blocking the web app
  from looking finished.
- **`pdf-parse`, `mammoth`, and JSZip on the Bun runtime.** All three are Node-era libraries
  with filesystem assumptions and none is installed yet. Blocks campaign import from a
  document. If any breaks, parsing moves behind a small Node subprocess rather than
  migrating the API.
- **ScrapeCreators credits.** Around 90 of the 100 free credits remain. Each creator
  onboarding costs 1 plus `LINKEDIN_ENRICH_POSTS`, so 6 by default. Roughly fifteen more
  creators before the free tier runs out.

Resolved since the first draft:

- ScrapeCreators API key supplied and tested live against a real profile.
- OpenRouter primary pinned to `google/gemini-2.5-flash` after a live ICP run returned
  correct sectors in 3.7s with no repair retry.
- Neon, pgvector, and Drizzle set up, migrated, and covered by live constraint tests.

---

## Naano teardown

Date: 2026-08-27. Sources: naano.com, naano.com/creators,
naano.com/blog/naano-vs-alternatives.

### What it is

A B2B LinkedIn creator marketplace. Brands browse vetted creators, book sponsored posts at
a fixed price, and track clicks back to each post. Around 3,000 creators across 100
countries, roughly 700 posting weekly. Clients named publicly: lemlist, Ringover, Attio,
folk, Leadbay, Abyssale.

### Pricing model

Creators set a flat fee per post, published before booking. Not an auction, not a bid.

| Follower band | Median fee |
|---|---|
| Under 5k | EUR 84 |
| 10k to 25k | EUR 300 |
| 25k to 50k | EUR 588 |

Stated range across the marketplace is EUR 84 to EUR 720 per post. Their creator-facing
page advertises an average of EUR 500 per sponsored post and top deals at EUR 1,500, which
sits well above their own published medians. That is supply-side acquisition copy, not a
data point.

They ran a per-click model and killed it in July 2026. Prior pricing was EUR 1.90 to
EUR 2.90 per qualified click with a 200-click minimum. The retreat from per-click to fixed
per-post is the most informative fact on their site. Per-click puts delivery risk on the
platform and creates disputes over what counts as qualified.

### Timings, self-published

- Creator accepts or declines in a median of 35 minutes.
- Booking to publication: 8 days median, 14.1 days at P90.
- Their 90-day playbook: define ICP days 1-10, launch days 10-30, measure days 30-60,
  scale to a rotation of 5-8 creators days 60-90.

### Platform economics

Free tier at EUR 0 per month: marketplace access, AI brief creation, click and pipeline
tracking, creator payouts included, no lock-in. Managed campaigns are custom-quoted.
Campaign spend is separate from platform fees. Creator payouts settle within 24 hours by
SEPA.

### Admitted weaknesses

Published on their own blog. All three are attack surface.

1. Attribution coverage is 62%. "Only 62 of 89 completed bookings in the latest snapshot
   carry any click event at all." They decline to publish cost-per-lead figures because
   tracking adoption is incomplete. Tracked links are optional in their product, so a third
   of bookings produce no measurable outcome.
2. Delivery rate collapses at low price points. 30.4% published rate under EUR 200, 64.6%
   above EUR 600. Cheap bookings mostly do not result in a post. Creators accept and then
   go quiet.
3. Supply gaps by vertical and geography. "If your buyer is a niche cohort, the marketplace
   may not have creator supply yet."

### What they do not have

- No negotiation. A creator accepts or declines. No counter-offer on price, deliverable, or
  date.
- No explanation of why a creator was surfaced. Audience fit scoring exists but is a number
  with no reason attached.
- No reliability signal on creator cards, despite knowing their own delivery rates.
- LinkedIn only, single channel.

### The thesis worth stealing

Their strongest published claim: a niche micro-creator with 2,000 to 10,000 followers in a
vertical like RevOps or DevTools hit 12% CTR against 0.8% for a macro account with 98,000
followers posting to a general audience. Follower count is a weak predictor. Niche fit and
engagement rate are strong ones. This is the load-bearing assumption behind the
`audienceFit` component of our match algorithm.

---

## Category landscape

Naano positions against four categories at once rather than one competitor.

| Category | What it does badly |
|---|---|
| LinkedIn Ads | Auction pricing, EUR 15-25 CPC, ad blindness, no human voice. Launches in 24-48h, which is faster than any marketplace. |
| B2C influencer platforms | Built for Instagram and TikTok, macro-creator bias, no B2B vertical taxonomy, no pipeline attribution. |
| Employee advocacy tools | Capped by headcount and employee willingness. The audience is already your own network. |
| Manual outreach | No contracts, no escrow, no measurement. Does not scale past a handful of creators. |

Structural gap across all four: nobody scores creator reliability, and nobody makes
attribution mandatory. That is where our differentiation sits.

---

## Vendor research

### ScrapeCreators, LinkedIn data

Date: 2026-08-27. Sources: scrapecreators.com, docs.scrapecreators.com.

Chosen provider for creator profile enrichment. Six LinkedIn endpoints:

| Endpoint | Returns |
|---|---|
| `GET /v1/linkedin/profile` | Public person profile plus recent posts |
| `GET /v1/linkedin/company` | Company page |
| `GET /v1/linkedin/company/posts` | Company posts, capped at 7 pages by LinkedIn |
| `GET /v1/linkedin/search/posts` | Public post search by keyword, via Google index |
| `GET /v1/linkedin/post` | Single post or article |
| `GET /v1/linkedin/post/transcript` | Video transcript where LinkedIn exposes one |

Auth is an `x-api-key` header. Pay-as-you-go: USD 47 for 25,000 credits (USD 1.88 per
1,000), USD 497 for 500,000 (USD 0.99 per 1,000). One credit per request for most
endpoints. Credits do not expire. Cached results cost zero credits. Free tier starts at 100
credits with up to 7,000 bonus available, no card. Average response time quoted at 3.12s.

Two constraints that shape the product:

1. Work history comes back but is unusable. `experience` and `education` are returned, yet
   company names arrive masked as `************ ******` for an unauthenticated scrape. The
   creator identity card must be designed without them. Corrected 2026-08-27 after hitting
   the real endpoint; the earlier note claimed the fields were absent entirely.
2. A 3s response time means profile fetch cannot sit inside a synchronous form submit
   without a real loading state. Creator onboarding step 3 needs a progress affordance that
   holds attention for several seconds.

**Verified live 2026-08-27.** `recentPosts` carries no engagement counts, only
`{ link, id, title, datePublished, activityType }`, where `title` is the post text truncated
to roughly 60 to 370 characters. Reaction and comment counts need a separate
`GET /v1/linkedin/post` call per post, which also returns the full untruncated text. One
creator onboarding therefore costs 1 credit plus 1 per enriched post. Fixtures of both real
responses are saved at `packages/ai/fixtures/`.

The `company` endpoint is a bonus for brand onboarding. A brand's LinkedIn company page
gives follower count and a self-description that improves ICP generation.

### OpenRouter, text generation

Date: 2026-08-27.

OpenAI-wire-compatible, so the `openai` npm package works with
`baseURL: 'https://openrouter.ai/api/v1'`. Two reasons it beats going direct to one vendor:

- Model choice becomes an env var. Swapping models is config, not code.
- The `models` array gives ordered fallback when the primary provider is rate-limited or
  down.

Caveat: `response_format` with `json_schema` is not honored by every model behind
OpenRouter. Some fall back to free-form text without erroring. Mitigation is already in the
design: `packages/ai` validates every response against the same Zod schema and retries once
with a repair prompt before failing.

Open: which specific model to pin. Needs a smoke test on ICP generation across candidates,
scored on schema adherence and taxonomy compliance.

### Gemini, embeddings

Date: 2026-08-27. Sources: developers.googleblog.com, Google Cloud docs.

OpenRouter has no embeddings endpoint, so embeddings are a second provider by necessity.
Model is `gemini-embedding-001`.

- Matryoshka representation learning. Output dimensionality selectable at 3072 (default),
  1536, or 768. No price difference between them.
- Free tier around 1,500 requests per day, 10M tokens per minute. Paid is USD 0.15 per 1M
  input tokens.
- `taskType` changes the embedding. `RETRIEVAL_DOCUMENT` for the corpus side,
  `RETRIEVAL_QUERY` for the query side.

Two decisions fall out of this, both recorded in `findings.md` under what breaks:

1. Request 768 dimensions, not the 3072 default. pgvector's HNSW and IVFFlat indexes cap at
   2000 dimensions. A 3072-dim column cannot carry either index, so every similarity query
   degrades to a sequential scan. 768 is indexable and is plenty at our corpus size.
2. Creator fingerprints embed as `RETRIEVAL_DOCUMENT`, brand ICPs as `RETRIEVAL_QUERY`.
   Using one task type for both yields similarity scores that look reasonable and rank
   wrong, which is the worst kind of bug because nothing errors.

Volume check: we embed once per creator at onboarding and once per brand when the ICP
changes. The free tier is nowhere near binding. A bulk re-embed after a model upgrade is
the only case that needs batching and a rate limiter.

### Bun

Date: 2026-08-27.

Package manager, workspace manager, script runner, test runner, and the runtime for
`apps/api`. TypeScript runs with no build step. `bun test` replaces vitest and its config
file.

One carve-out: Next.js runs on the Node runtime, not Bun. Bun installs its dependencies and
`bun run dev:web` invokes the script, but Next spawns its own Node process for the dev
server and the build. `bun --bun next dev` still hits App Router edge cases. Not our
framework to debug.

Bun workspaces replace Turborepo. Turbo pays off on remote caching across a large team. A
`workspaces` array in the root `package.json` plus a few scripts is the entire build system
here.

Open: whether `pdf-parse`, `mammoth`, and `JSZip` behave on the Bun runtime. All three are
Node-era libraries. If any breaks, document parsing moves behind a small Node subprocess
rather than migrating the whole API.

---

## Legal position on LinkedIn data

Date: 2026-08-27.

Three separate questions, routinely conflated.

**Is it a computer crime?** After hiQ Labs v. LinkedIn (9th Cir. 2022), scraping genuinely
public data likely does not violate the CFAA. That holding stands.

**Does it break LinkedIn's terms?** Yes. Section 8.2 of the User Agreement prohibits
scraping profiles by any means. hiQ ultimately lost on contract grounds. Public data does
not exempt you from the agreement you accepted.

**What is the enforcement reality?** LinkedIn sued Proxycurl's operator and Proxycurl shut
down entirely on 2025-07-04. That suit, not hiQ, is the live warning. Earlier successful
actions turned on fake accounts and authenticated access rather than reading public pages.
Cookie-based flows carry materially higher risk than public-page reads.

**Our position.** We do not scrape. We use a third-party provider that does, and we design
so the provider is replaceable:

- One `LinkedInProfileProvider` interface. ScrapeCreators is one implementation.
- `ManualPasteProvider` is always available as a fallback, requires no vendor, and carries
  no scraping exposure.
- If the vendor disappears the way Proxycurl did, we change one env var and the product
  keeps working with degraded onboarding UX.

**GDPR.** We store personal data about creators. Creators register themselves and consent
at onboarding, which is the clean lawful basis. Hard rule: never import, enrich, or store
profiles of people who have not registered. No prospecting database, no shadow profiles.

---

## Design research

Date: 2026-08-27.

### What we are avoiding

The brief named it: AI slop. Concretely, the visual signature to stay away from is Inter or
a system stack at 14px, an indigo-to-purple gradient, `#6366f1` as the accent, shadcn/ui
defaults shipped unmodified, 8px radius and a 1px border on every surface, and a serif
pulled in to signal premium.

We use Radix UI unstyled primitives for keyboard handling, focus management, and ARIA, and
write the entire styling layer ourselves. Accessibility from the library, appearance from
us.

### Round 2 direction, 2026-08-27

Round 1 (The Masthead, Oxblood and Bone, Boska serif, hairline rules) was rejected as messy
with the wrong typeface and the wrong register. What replaced it:

- Palette supplied directly: Imperial Blue `#021F94`, White Convolvulus `#F5F2F3`.
- Reference tools named: Raycast and Linear. Reference layouts supplied: seven dashboard
  screenshots in the Stripe, Nexus, Mondays, and LoopAI idiom.
- Instruction: stay inside those references, invent nothing beyond them.

Patterns extracted from the seven references and now binding:

| Pattern | Detail |
|---|---|
| Navigation | Fixed 248px left sidebar, grouped sections with small uppercase labels, solid accent on the active item |
| Top bar | Sticky, `⌘K` search field, date-range control, notification bell, avatar |
| Stat cards | Icon plus label, one large tabular number, coloured delta pill, one context line |
| Surfaces | White cards, 12px radius, hairline border, one very soft shadow, on a warm off-white page |
| Status | Soft-fill pills, darker text of the same hue, optional dot |
| Rows | Avatar plus name plus muted sub-line, right-aligned tabular numbers |
| Controls | Segmented pill switchers with inline counts |
| Type | One grotesque throughout, no display face |

Inter is now the correct answer despite round 1 listing it as an anti-reference. The
register changed from brand to product, and the impeccable product reference is explicit
that system fonts and Inter are legitimate for product UI, with one family usually right.

### Typography, round 1, superseded

Trend research points at neo-grotesques for quiet authority in fintech, developer tools,
and design-forward SaaS, with Aktiv Grotesk and Suisse Int'l recurring on Awwwards. Both
are paid. The free equivalents with real drawing quality come from Fontshare, Indian Type
Foundry's free-for-commercial-use library.

| Role | Face | Why |
|---|---|---|
| UI and body | Switzer | Neo-grotesk, variable, wide weight range, Helvetica-adjacent without being a clone |
| Dense variant alternate | General Sans | Tighter, more neutral, holds up at small sizes in data rows |
| Display only | Boska or Instrument Serif | Headline numbers, identity card, empty-state statements. Never body copy. |
| Numerals and mono | Geist Mono | Money, follower counts, IDs, timestamps. Tabular figures wherever a number can change. |

Rejected on purpose: Inter (ubiquitous to the point of invisibility), Space Grotesk (worn
out), any serif for body text, any system-font stack as the primary voice.

### Color

Each variant gets one neutral ramp plus exactly one signal color. Status colors are
semantic tokens, never raw hex at the call site: `--status-pending`, `--status-countered`,
`--status-live`, `--status-paid`. Light and dark ramps both defined from the start rather
than dark bolted on afterward.

### Direction per variant

- Brand v1 Editorial Ops: printed annual report. Paper-warm neutrals, wide margins,
  hairline rules, large numerals treated as display objects.
- Brand v2 Dense Ops: Linear and Height. Dark-first, compact rows, tabular figures, command
  palette, persistent filter chips.
- Creator v1 Identity Card: physical object. Weight, heavy numerals, a treated edge. The
  maximalist moment inside an otherwise quiet shell.
- Creator v2 Opportunity Feed: a stack of deals worked through by keyboard. Earnings is the
  largest number on the page.

---

## Feature request log

Append here. Never delete a row, change its status instead.

Status values: `accepted` means agreed and not yet built. `shipped` means built and
verified. `partial` names what is missing. Update this column when a feature lands.

| Date | From | Feature | Problem it solves | Phase | Status |
|---|---|---|---|---|---|
| 2026-08-27 | Ujjwal | Two interfaces, one email locked to one role | Account confusion, two different products bleeding into each other | 1 | shipped |
| 2026-08-27 | Ujjwal | Brand onboarding, AI ICP from a product page URL, editable | Brands describe their own ICP badly, and a wrong ICP breaks matching | 1 | shipped |
| 2026-08-27 | Ujjwal | Creator onboarding from a LinkedIn URL, no OAuth | LinkedIn OAuth needs partner approval and weeks of setup | 1 | shipped |
| 2026-08-27 | Ujjwal | Creator identity card with fetched stats | Inclusiveness and retention on the supply side | 1 | shipped |
| 2026-08-27 | Ujjwal | Creator catalog, matched and browse-all views | The screen that decides whether brands stay | 1 | shipped |
| 2026-08-27 | Ujjwal | Match algorithm on a shared taxonomy, both sides capped at 3 tags | Untargeted catalogs waste brand time | 1 | shipped |
| 2026-08-27 | Ujjwal | Campaign creation three ways: AI, URL, document upload | Brands already have briefs in PDF and PPTX | 2 | accepted |
| 2026-08-27 | Ujjwal | Collaborations tab tracking every status from booking to payment | The core operational surface | 2 | shipped |
| 2026-08-27 | Ujjwal | Messenger over WebSocket | Negotiation happens in conversation | 3 | shipped |
| 2026-08-27 | Ujjwal | SSE for status changes and analytics | Live updates without polling | 3 | shipped |
| 2026-08-27 | Ujjwal | Billing tab, mocked | Fund flow without a payment integration | 4 | accepted |
| 2026-08-27 | Ujjwal | Creator earnings page | Supply-side transparency | 4 | accepted |
| 2026-08-27 | Ujjwal | Brand workspaces with member invites | Marketing teams are not one person | 5 | accepted |
| 2026-08-27 | Claude | Explainable match score, reason chips plus weight sliders | Naano shows a number with no reason. Cheapest real differentiator. | 1 | shipped, sliders not interactive |
| 2026-08-27 | Claude | Delivery reliability score public on every creator card | Naano's own 30.4% delivery rate under EUR 200 goes unaddressed in their product | 2 | shipped, no accept-to-publish clock |
| 2026-08-27 | Claude | Counter-offers as a first-class state, bounded at 3 rounds | Naano has no negotiation at all | 2 | shipped |
| 2026-08-27 | Claude | Tracked links enforced by the state machine, not by reminder | Naano's attribution coverage is 62% because tracking is optional | 2 | shipped |
| 2026-08-27 | Claude | Voice-matched draft co-pilot from the creator's own post corpus | Writing sponsored posts is the biggest supply-side friction, and we already store the corpus for matching | 3 | accepted |
| 2026-08-27 | Claude | Creator rotation bundles, book 5-8 with staggered dates | Naano's playbook says rotation works, their product makes you assemble it by hand | 4 | accepted |
| 2026-08-27 | Claude | Compare tray, pin up to 4 creators side by side | Shortlisting across a large catalog | 1 | not started |
| 2026-08-27 | Claude | Accept-to-publish clock with auto-refund on expiry | Enforces the reliability score instead of only displaying it | 2 | accepted, not built |
