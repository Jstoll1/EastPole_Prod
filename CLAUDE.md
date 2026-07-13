# East Pole — repo notes

## Per-tournament color scheme

`events/current.json` sets `id` on the event, and `event-config.js` tags
`<body>` with `event-<id>`. `css/styles.css` scopes per-event overrides
under those body classes. Rules to preserve:

- **Standard / default** — deep navy blue (`#0a2c5b → #001d3b`
  gradient on `#hdr`). Applies whenever no per-event override wins.
- **The Masters** — green. Reserved for the `event-masters-*` id.
  When wiring the Masters week, use Augusta-style deep green
  (`~#1e4a2e → ~#0f2a1a` gradient) as the header accent.
- **The Open** — aubergine / purple. `event-the-open-*` id. Header
  gradient `#3a1a4a → #1a0e2e`. Splash chip picks up a soft aubergine
  border + glow. Wordmark stays white for contrast; gold border
  underneath stays as the East Pole anchor.

Keep gold (`--gold`, `#d4a843`) as the persistent East Pole brand color
across all events — per-event colors are accents, not full theme
swaps.
