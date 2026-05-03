# Per-event configuration

Each tournament's configuration lives in `events/current.json`. The mobile and terminal apps load this file at boot and apply its values to the global config — `POOL_SHEET_URL`, `POOL_CONFIG.tournamentNameMatch`, `PREV_WINNER`, `AMATEURS`, etc.

## Why a JSON file?

Previously these values were hardcoded across `state.js`, `entry-loader.js`, and `entry-form.js`. Switching events meant editing ~5 files, bumping cache versions, and praying no one forgot a field. Now: drop in a new JSON, deploy.

## Schema

```json
{
  "id": "2026-pga-championship",            // any slug; for archival
  "name": "2026 PGA Championship",          // display name
  "course": "Aronimink Golf Club",          // venue name (matches ESPN)
  "courseTimezone": "America/New_York",     // IANA TZ; tee times render in this zone
  "dates": {
    "start": "2026-05-14",
    "end":   "2026-05-17"
  },
  "espn": {
    "tournamentNameMatch": "PGA Championship",
    "tournamentDate": "20260514"            // optional, YYYYMMDD; pins ESPN to a specific date
  },
  "pool": {
    "buyIn": 20,
    "fifthEntryBuyIn": 10,
    "maxEntriesPerPerson": 5,
    "picksPerTeam": 10,
    "bestN": 4,
    "payoutPctOfNet": { "first": 0.70, "second": 0.30 }
  },
  "sheet": {
    "publishedTsvUrl": "https://docs.google.com/.../pub?output=tsv"
  },
  "previousWinner": "Xander Schauffele",
  "amateurs": ["Ethan Fang", "Mason Howell"]
}
```

All fields are optional except `id` and `name`. Anything you omit falls back to the default in `state.js`.

## Adding a new event

1. Copy `events/current.json` to `events/archive/<slug>.json` to preserve history.
2. Edit `events/current.json` with the new event's values.
3. Update `entry-form.js` `POOL_ENTRY_CONFIG` if the Google Form changed (separate file because it carries the tier teams[] arrays).
4. `node scripts/cache-bust.js` (or just `git commit` — the pre-commit hook does it).
5. Push to `main`.

## What's NOT in current.json (yet)

- `POOL_ENTRY_CONFIG` — Google Form schema + tier picks. Lives in `js/entry-form.js`. Could migrate in a v2 of this system.
- `PRE_ODDS` — pre-tournament odds map. Lives in `js/state.js`. Updated per-event but bulky enough that a separate JSON makes sense.
- `FLAGS` / `NAME_ALIASES` — shared across all events. Stays in `state.js`.
