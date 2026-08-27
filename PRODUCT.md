# Product

## Register

product

## Users

Two audiences with opposite relationships to the software.

**Brand-side account managers.** B2B marketers at SaaS companies, usually one person
carrying a creator budget alongside four other channels. They arrive with a product, a
quarter target, and no idea which creators are worth paying. They visit two or three times
a week, work in bursts, and leave. Their job to be done: turn a budget into published posts
that produce traceable pipeline, without the coordination overhead eating the gain. They
are evaluating the platform every single session, because the alternative is LinkedIn Ads
and a spreadsheet.

**Creators.** People with 1k to 500k LinkedIn followers in a specific vertical, monetizing
a niche audience they built by hand. They are not full-time creators. They have a day job
and post between meetings. Their job to be done: get offered relevant work, decide fast,
publish in their own voice, get paid without chasing an invoice. They will abandon anything
that feels like a job board or makes them feel like inventory.

The asymmetry matters. Brands are shopping. Creators are being shopped for. A creator who
feels like a row in a database leaves, and supply is the harder side to rebuild.

## Product Purpose

A marketplace where B2B brands book LinkedIn creators for sponsored posts, with the
negotiation, delivery, measurement, and payment in one place.

Success is a brand booking a second creator without being asked, and a creator accepting a
second offer inside an hour.

Three specific failures in the incumbent product define what this one exists to fix:

1. A third of completed bookings produce no measurable outcome, because tracked links are
   optional. Here they are a state-machine constraint. A post cannot be marked published
   without one.
2. Two thirds of low-priced bookings never result in a post. Here delivery reliability is
   scored, public on every creator card, and enforced with an accept-to-publish clock.
3. Matching returns a number with no reason attached. Here every match carries its
   components, so the brand sees why this person and can argue with the weighting.

## Brand Personality

**Clean, technical, quiet.**

A working tool. Both audiences arrive mid-task with a decision to make, and the interface
should disappear into that decision rather than perform around it.

The bar is earned familiarity, the standard Raycast, Linear, and Stripe set. Someone fluent
in those tools should sit down and trust this one immediately, never pausing at a
subtly-off component. This is a product surface, not a brand surface: system-adjacent type,
standard navigation, predictable grids, and one accent used only where it means something.

Voice: plain and specific. Says the real number. Never "seamless", "powerful", or
"effortless". A stat card reads "LinkedIn Ads averages €18", not "vs last period".

Emotional target on the brand side: control. The catalog should feel like a tool that
already did the sorting and can show its working.

Emotional target on the creator side: clarity. Open the app, see what is owed, what is
offered, and how long you have. Decide in under a minute.

Craft shows up as restraint and consistency: one type family, one accent, one elevation
step, the same button in every position it appears. Motion at 180ms, conveying state change
and nothing else. Product users are in flow and do not want to watch choreography.

## Anti-references

**Generated-dashboard tells.** Loose letter-spacing on large type, proportional figures in
a numeric column, 8px radius applied to every element regardless of size, a border plus a
heavy drop shadow on the same card, cards nested inside cards.

**Indigo-purple SaaS.** `#6366f1`, gradient headers, gradient text, glassmorphism panels,
shadcn/ui shipped unmodified.

**Editorial dashboards.** Serif display faces, hairline-rule layouts, magazine kickers.
Tried in the first design round and rejected: it read as messy and fought the task.

**Job boards.** Creators as line items with a salary band. The catalog is where this risk
is highest, which is why every creator card leads with evidence rather than a number.

**Influencer platforms.** Follower-count-first sorting, gradient stat cards, engagement
badges, the Instagram-era creator-tool grammar.

**Enterprise B2B.** Navy and gold, stock photography, laptop-mockup heroes, the word
"solutions".

Specific bans carried into implementation: gradient anything, side-stripe accent borders,
glassmorphism, stacked shadows, full-saturation accent on inactive states, custom
scrollbars, reinvented form controls, modals reached for before inline alternatives, em
dashes in copy.

## Design Principles

**Evidence over assertion.** A creator card shows two real recent posts, not a
self-declared bio. A match shows its components, not a percentage. Every number on screen
traces to something measured. When we do not have the data, the card says so rather than
filling the space.

**The catalog is the product.** Every other screen supports the moment a brand scrolls
through creators. That screen gets the most design attention, the most interaction work,
and the highest tolerance for complexity in service of scannability.

**Creators are people, brands are operators.** Both surfaces run the same components and
the same grid. The creator side spends its one blue card on the identity block, because
being booked should feel like something. The brand side spends its blue on scores and
actions.

**Constraints beat reminders.** Anything the product needs users to do reliably is enforced
by state, not by a tooltip. Tracked links, tag caps, negotiation rounds. If it matters, it
is impossible to skip.

**Motion conveys state, never decoration.** 180ms, ease-out. State change, feedback,
loading, reveal. An animation that explains nothing gets cut. No orchestrated page-load
sequences, no animated layout properties.

## Accessibility & Inclusion

Deferred by explicit project decision on 2026-08-27. No WCAG target set for this build.
Contrast ratios, reduced-motion handling, and screen-reader support are not gates on Phase
0 or Phase 1.

Two things stay in regardless, on craft grounds rather than compliance grounds:

- **Visible focus states.** A designed 2px blue ring, offset 2px. Standard-feeling product
  UI is impossible without them.
- **Radix unstyled primitives** for anything with keyboard behavior. Using them costs
  nothing over hand-rolling and means the retrofit later is a styling job, not a rewrite.

Recorded so a future pass knows this was a decision, not an oversight.
