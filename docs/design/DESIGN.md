# Beehive Home — "Key Tags" design system

Each apartment is a coloured hotel key tag, so everyone always knows which flat they are
looking at. White rounded cards sit on a cool grey ground. One bold display face for
headings and tags, one quiet text face for everything else.

Approved screens: `docs/reference/screens/*.dc.html` (open `screens.html` in a browser to
see them side by side). Working reference: `docs/reference/prototype.html`.

## Tokens

Put these in `app/globals.css` and map them into Tailwind (`theme.extend.colors` with
`var(--…)`). Components use tokens only — never literal colours.

```css
:root {
  --bg:#ECEEF2; --surface:#FFFFFF; --surface-2:#F4F5F8; --ink:#15171C; --muted:#555B66; --line:#DFE2E8;
  --accent:#4646E0; --accent-ink:#FFFFFF; --accent-soft:#E5E5FB;
  --tag1:#FFC542; --tag1-ink:#15171C;   /* 1BHK mango */
  --tag2:#4646E0; --tag2-ink:#FFFFFF;   /* 2BHK indigo */
  --tag3:#1F7A6C; --tag3-ink:#FFFFFF;   /* future apartments */
  --tag4:#B0306A; --tag4-ink:#FFFFFF;
  --airbnb:#B8323F; --airbnb-soft:#FCE4E6; --booking:#2449A8; --booking-soft:#E2E9FA;
  --direct:#7A5200; --direct-soft:#FFF0C7; --other:#555B66; --other-soft:#EBEDF1;
  --ok:#1F6B42; --ok-soft:#E3F5EA; --warn:#7E5300; --warn-soft:#FFF0C7;
  --bad:#B42328; --bad-soft:#FDE4E4; --on-bad:#FFFFFF;
  --scrim:rgba(14,16,20,.48);
  --shadow:0 2px 4px rgba(21,23,28,.05),0 12px 32px rgba(21,23,28,.12);
  --tagshadow:0 6px 16px rgba(21,23,28,.14);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg:#0E1014; --surface:#171A20; --surface-2:#1F232A; --ink:#EEF0F4; --muted:#9BA2AE; --line:#2A2F38;
  --accent:#9A9AFF; --accent-ink:#0E1014; --accent-soft:#24254A;
  --tag1:#FFC542; --tag1-ink:#15171C; --tag2:#5B5BF2; --tag2-ink:#FFFFFF;
  --tag3:#2A9A88; --tag3-ink:#06201C; --tag4:#D2468A; --tag4-ink:#FFFFFF;
  --airbnb:#FF8A96; --airbnb-soft:#3B1A1F; --booking:#93B2FF; --booking-soft:#1A2440;
  --direct:#F5C24A; --direct-soft:#3A2F10; --other:#A9B0BB; --other-soft:#252A32;
  --ok:#5BD08E; --ok-soft:#14301F; --warn:#F5C24A; --warn-soft:#3A2F10;
  --bad:#FF7B7F; --bad-soft:#3D1A1C; --on-bad:#1A0507;
  --scrim:rgba(0,0,0,.64);
  --shadow:0 2px 4px rgba(0,0,0,.4),0 12px 32px rgba(0,0,0,.45);
  --tagshadow:0 6px 16px rgba(0,0,0,.45);
  color-scheme: dark;
}}
/* repeat the dark block under :root[data-theme="dark"] for a manual toggle */
```

## Type
- **Unbounded** 700/800 (Google Fonts, via `next/font/google`): page titles, apartment
  codes on tags (1BHK, 2BHK), big numbers, card titles. Letter-spacing −0.02 to −0.04em.
- **Inter** 400–700: all other text. Body 14.5–15 px, line-height 1.5.
- **Noto Sans Malayalam** 400–700 and **Noto Sans Devanagari** 400–600: Malayalam and
  Hindi text. Put them in the font stack after Inter so mixed text renders.
- `font-variant-numeric: tabular-nums` on every number column, money and time chip.

## Shape and space
- Radius: cards 24 px, key tags 26 px, inputs 13 px, buttons 14 px (small 11 px),
  chips/pills 999 px. Bottom sheets 28 px top corners.
- Spacing on a 4 px grid; page gutter 16 px on phones (`max(16px, env(safe-area-inset-*))`).
- Cards have no border; separation comes from the white surface on the grey ground.
  Shadows only on key tags, the floating bar and sheets.

## Components
- **Key tag** (apartment card): coloured top with a punched hole (18 px circle, ground
  colour, 3 px ring), apartment code in Unbounded 34 px, name, feature pills, status
  pill on the right; white body below with In house / Next arrival / Cleaning /
  Maintenance / Next care, then actions.
- **Week strip**: 7 rounded day buttons; today is ink with white text; small squares in
  the apartment colour mark check-in/check-out days. Tap opens the calendar.
- **Agenda row**: time chip (white, 62 px wide, tabular) + title/subtitle + apartment
  colour square(s).
- **Job card**: band in apartment colour (kind label, apartment code in Unbounded, status
  pill), body with time window, 10 px progress bar in ink, checklist rows 44 px tall on
  `--surface-2`, actions.
- **Pills**: ok / warn / bad / info / channel colours (Airbnb, Booking.com, Direct, Other).
- **Floating bottom bar** (phones < 960 px): ink background, 24 px radius, 12 px from the
  edges, 5 items, active item filled with `--tag1`; red count bubbles.
- **Sidebar** (≥ 960 px): white rounded panel, grouped links, active link filled ink.
- **Bottom sheet** (phones) / dialog (desktop) for every form; sticky footer with
  Cancel + primary action.
- **Buttons**: primary = ink fill; secondary = white with 1 px inner line; honey = tag1
  fill for the one most important action on a screen (e.g. "Complete check-in").

## Guest portal
Same tokens and fonts, no app chrome: brand row, language switch, three-segment
progress bar (Details · Photo ID · House rules), one question group per screen, full-width
58 px primary button pinned to the bottom, lock line explaining privacy. Final screen
uses the apartment colour as the full background.

## Writing
Plain, short, active. Buttons say what happens. Errors say what to do next. Malayalam
copy must be checked by a native speaker before release.
