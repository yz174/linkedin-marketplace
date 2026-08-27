---
name: LinkedIn Creator Marketplace
description: A B2B creator marketplace built as a working tool. ID Grotesk and Times, Imperial Blue on White Convolvulus.
colors:
  blue: "#021F94"
  blue-hover: "#0A2CAE"
  blue-press: "#011766"
  blue-50: "#EEF1FC"
  blue-100: "#DCE3F8"
  blue-200: "#B9C6F1"
  paper: "#F5F2F3"
  card: "#FFFFFF"
  panel: "#FCFBFB"
  ink: "#14161F"
  ink-2: "#454A5C"
  muted: "#787D8E"
  line: "#EAE6E8"
  line-soft: "#F2EFF0"
  ok-bg: "#E8F5EE"
  ok-fg: "#0B7A45"
  warn-bg: "#FDF2E3"
  warn-fg: "#8A5A10"
  down-bg: "#FDECEC"
  down-fg: "#B3261E"
  dead-bg: "#F1EEEF"
  dead-fg: "#787D8E"
typography:
  h1:
    fontFamily: "Times New Roman, Times, Liberation Serif, serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "ID Grotesk, Inter, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.032em"
    fontFeature: "tnum"
  title:
    fontFamily: "ID Grotesk, Inter, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.012em"
  body:
    fontFamily: "ID Grotesk, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  small:
    fontFamily: "ID Grotesk, Inter, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "ID Grotesk, Inter, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s7: "32px"
  s8: "40px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "34px"
    typography: "{typography.small}"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.card}"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "34px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "16px"
  stat-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "16px"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
  pill-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-fg}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  pill-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-fg}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  pill-info:
    backgroundColor: "{colors.blue-50}"
    textColor: "{colors.blue}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  delta-up:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-fg}"
    rounded: "{rounded.pill}"
    padding: "2px 7px"
  delta-down:
    backgroundColor: "{colors.down-bg}"
    textColor: "{colors.down-fg}"
    rounded: "{rounded.pill}"
    padding: "2px 7px"
---

# Design System: LinkedIn Creator Marketplace

## 1. Overview

A working tool, not a publication. Both audiences arrive with a job: a marketer deciding
who to pay, a creator deciding whether to accept. The interface should disappear into that
decision.

The bar is **earned familiarity**, the standard Raycast, Linear, and Stripe set. Someone
fluent in those tools should sit down and trust this one immediately, never pausing at a
subtly-off component. Product UI does not fail by being too plain. It fails by being
strange without purpose: invented affordances for standard tasks, display fonts on labels,
decorative motion, mismatched form controls.

Structure is the same on both sides and comes straight from the reference layouts:

- **A fixed left sidebar** at 248px on a slightly cooler ground than the content, holding
  grouped navigation with small uppercase section labels. The active item is solid Imperial
  Blue with white text. It is the only navigation.
- **A sticky top bar** with a `⌘K` search field, a date-range control, notifications, and
  the account avatar.
- **A page head**: title, one line of subtitle that says something real, actions pushed
  right.
- **A row of stat cards**, each carrying an icon, a label, one large tabular number, and a
  delta badge.
- **Content in white cards** on the warm off-white page, 12px radius, hairline border, one
  very soft shadow.
- **An optional right rail** at 300px for controls and context that belong beside the work
  rather than inside it.

Nothing nests a card inside a card. Nothing uses a border on a card plus a heavy shadow.
The page is calm because the ground is quiet and the cards are the only raised objects on
it.

## 2. Colors: Imperial Blue on White Convolvulus

Two colors set the identity. Imperial Blue `#021F94` and White Convolvulus `#F5F2F3`.
Everything else is a neutral or a state.

The strategy is **restrained**, which is the product-register floor. Blue carries primary
actions, the active nav item, the current selection, match scores, and the one blue card on
the creator side. It does not decorate. Rough share of any screen: 5 to 10 percent.

**Primary.** `blue #021F94` on buttons, the active nav item, focus rings, and score values.
`blue-hover #0A2CAE` lifts on hover, `blue-press #011766` darkens on press. `blue-50
#EEF1FC` is the wash behind info pills, selected rows, and inline notes. `blue-100 #DCE3F8`
fills avatars. `blue-200 #B9C6F1` is the hover border on interactive cards and the second
tint in charts.

**Ground.** `paper #F5F2F3` is the page. `card #FFFFFF` is every raised surface. `panel
#FCFBFB` is the sidebar, a hair off the card so the two read as different planes without a
heavy divider. Borders run `line #EAE6E8` between planes and `line-soft #F2EFF0` for row
separators inside a card.

**Text.** `ink #14161F` for primary, `ink-2 #454A5C` for secondary and nav labels, `muted
#787D8E` for captions, table headers, and units. Never pure black.

**State.** A standard semantic vocabulary, each a soft fill with a darker text of the same
hue. This is what the reference layouts do and it is the right answer:

| State | Fill | Text | Where |
|---|---|---|---|
| Success, paid, published, delivery | `ok-bg #E8F5EE` | `ok-fg #0B7A45` | Paid pills, delivery badges, positive deltas |
| Warning, expiring, countered | `warn-bg #FDF2E3` | `warn-fg #8A5A10` | Accept clock, open counter-offers |
| Info, in review, current | `blue-50` | `blue` | Draft in review, escrow holder, match score |
| Negative | `down-bg #FDECEC` | `down-fg #B3261E` | Downward deltas only |
| Inert, expired, new | `dead-bg #F1EEEF` | `dead-fg #787D8E` | Expired offers, creators with no record |

Deltas are the one place two state colors appear next to each other, and they always carry
an arrow as well as a color.

**Theme.** Light only. The scene forces it: a marketing manager reviewing shortlists at
11am in a bright open-plan office, and a creator checking offers on a phone between
meetings. Neither is a 2am incident room. A dark ramp can be added later; it is not part of
this system.

## 3. Typography

**ID Grotesk for everything in the interface. Times for page titles only.**

**ID Grotesk** (ID Typeface, Khairil Anwar) is the UI face. A contemporary grotesk with ink
traps, which is what keeps it from reading as another Helvetica clone at small sizes. It
carries labels, buttons, body copy, table cells, and every number. 14 styles ship; we use
Book 400, Medium 500, and Semibold 600.

It is a commercial licence. Buy a webfont licence from MyFonts or YouWorkForThem and
self-host `.woff2` files at `apps/web/public/fonts/`. Until then the stack falls through to
**Inter**, which is close enough in structure that layouts do not shift when the real face
lands.

```
--font: 'ID Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

**Times** carries page titles and nothing else. It is a system font on every platform, so
it costs no request and never fails to load. Set at 34px weight 400 with -0.02em tracking,
it gives each screen one editorial note against an otherwise strictly technical surface.
That contrast is the whole point, and it collapses the moment Times appears anywhere else.

Times never touches: buttons, labels, table cells, form fields, nav items, status pills, or
any number. Web Times has no reliable tabular figures, so a Times number in a data column
will drift out of alignment as values update.

Fixed pixel scale, not fluid. The ratio is tight, roughly 1.15 to 1.2 between adjacent
steps.

| Role | Face | Size | Weight | Tracking |
|---|---|---|---|---|
| Page title | Times | 34px | 400 | -0.02em |
| Identity card name | Times | 24px | 400 | -0.015em |
| Stat value | ID Grotesk | 27px | 600 | -0.032em, tabular |
| Card title | ID Grotesk | 14.5px | 600 | -0.012em |
| Body, table cell | ID Grotesk | 14px | 400 | normal |
| Nav item, secondary | ID Grotesk | 13.5px | 400 | normal |
| Caption, table header | ID Grotesk | 12.5px | 400 | normal |
| Section label | ID Grotesk | 10.5px | 600 | 0.08em, uppercase |

Two rules that carry most of the polish:

- **Negative tracking scales with size.** Anything above 20px gets at least -0.02em, and
  the grotesk sizes above 26px get -0.032em. Left at default, large type looks loose and
  amateur, which is the single most common tell in a generated dashboard.
- **Tabular figures on every number that can change.** Follower counts, fees, balances,
  scores, click counts, dates. Set `font-variant-numeric: tabular-nums` so a column holds
  its alignment when a value updates.

## 4. Elevation

Three planes and almost no shadow.

`paper` is the page, `panel` is the sidebar, `card` is every raised object. Separation comes
from the tone step plus a 1px `line` border. On top of that sits one very soft shadow,
`0 1px 2px rgba(20, 22, 31, 0.05)`, which reads as a page lift rather than a drop shadow.
Hover raises it to `0 2px 6px rgba(20, 22, 31, 0.06)` and moves the element 1px. That is
the entire elevation scale for resting surfaces.

A second, larger shadow exists only for things that float and must read as temporary: the
command palette, dropdown menus, toasts. `0 10px 30px -10px rgba(20, 22, 31, 0.18)`, never
stacked with others, never on something at rest.

Radii: 12px on cards, 8px on buttons, inputs, and nav items, 6px on the smallest chips and
keyboard hints, full pill on avatars, status pills, and delta badges. One step per size
class, applied consistently. Never 8px on everything.

Motion runs 180ms on `cubic-bezier(0.2, 0.8, 0.2, 1)`. Product users are mid-task and do
not want to watch choreography. Motion conveys state change and nothing else. No
orchestrated page-load sequence, no animated layout properties, transform and opacity only.

## 5. Components

**Sidebar nav item.** Icon at 16px stroke 1.6, label at 13.5px, an optional right-aligned
count in `muted`. Hover fills `#F3F0F1`. Active is solid blue with white text and the count
at 70% white. Section labels above each group at 10.5px uppercase.

**Search field.** White, 8px radius, hairline border, a 16px magnifier, and a `⌘K` hint
chip on the right. Focus draws the blue border plus a 3px `blue-50` ring. This is the
standard pattern from every reference and it should not be reinvented.

**Stat card.** Icon plus label in `muted` on one row, then the value at 27px 600 tabular,
then a delta badge on the same baseline, then one line of context beneath in 12px `muted`.
The context line is what stops these being generic: "LinkedIn Ads averages €18" beats "vs
last period".

**Delta badge.** Pill, 11.5px 600, arrow icon plus number. Green up, red down, grey flat.
Never a bare colored number.

**Creator card.** The catalog unit. A 44px avatar, name at 14.5px 600, sector and
contributor number beneath in `muted`, then one line of match evidence in `ink-2`, then a
three-column fact row divided by a `line-soft` rule: followers, engagement, fee. The match
score sits top-right as a `blue-50` pill. A delivery pill sits at the bottom. Hover borders
in `blue-200` and lifts 1px.

**Segmented control.** A `#EDEAEB` container at 8px radius with 3px padding. The selected
segment is white with the card shadow. Counts ride inside each segment as small pills.
Used for view switching, never for navigation.

**Status pill.** Soft fill, darker text of the same hue, 11.5px 500, an optional 5px dot.
Full pill radius. The dot is present on live states and absent on inert ones, so state is
never carried by color alone.

**Table row.** 13px cells, `line-soft` separators, no outer border, no zebra striping. Hover
tints `#FAF9F9`. The first cell pairs a 26px avatar with a name and a `muted` sub-line.
Numbers right-align and run tabular.

**Progress track.** 5px, full radius, `#EDEAEB` ground, blue fill for primary weight and
`blue-200` for secondary. Used for match weighting and rate comparison.

**Timeline.** An 11px dot on a 1px connector line. Completed dots fill blue, the current
dot is a blue ring with a `blue-50` halo, future dots stay `line`. Label at 13px, meta at
11.5px `muted`.

**Buttons.** Primary is solid blue, 34px tall, 8px radius, white text at 13px 500. Ghost is
white with a `line` border and `ink-2` text. Both take a 14px leading icon. Small variant
drops to 29px. There is no third variant.

**Focus.** A 2px blue ring offset 2px. Designed, never the browser default, never removed.

## 6. Do's and Don'ts

**Do** use ID Grotesk for the entire interface, and Times for page titles only.

**Do** apply negative letter-spacing to anything above 20px. Loose large type is the
clearest sign nobody looked at it.

**Do** set tabular figures on every number that can change.

**Do** give every stat card a context line that says something specific.

**Do** keep the accent under about 10% of the surface. Primary actions, active nav, current
selection, scores. Nothing else.

**Do** state loading with skeletons that match the shape of the content, not a spinner in
the middle of a card.

**Do** write empty states that teach the screen, not "nothing here yet".

**Don't** put a card inside a card.

**Don't** combine a border and a heavy shadow on the same resting surface. Pick the border.

**Don't** use a gradient anywhere: not on text, not on cards, not on charts.

**Don't** use a colored `border-left` or `border-right` above 1px as an accent stripe.

**Don't** use glassmorphism, backdrop blur, or stacked shadows.

**Don't** apply full-saturation blue to inactive or disabled states.

**Don't** reinvent standard affordances. Custom scrollbars, odd form controls, and
non-standard modals cost trust and buy nothing.

**Don't** reach for a modal first. Inline expansion, then a side panel, then a dialog.

**Don't** put Times on a button, a label, a table cell, or any number. Web Times has no
reliable tabular figures and a serif label reads as a mistake in a technical surface.

**Don't** animate a layout property, and keep every transition at or under 250ms.

**Don't** write an em dash in any copy, or `--` standing in for one.
