/**
 * seed-pool-entries.gs — Apps Script
 *
 * Populates the active Sheet with synthetic East Pole pool entries for the
 * tournament ESPN is currently serving. Tiers are derived live from
 * DataGolf TOP-20 probability (via the East Pole proxy worker), so the
 * script auto-adapts week-to-week — Truist this week, next event next.
 *
 * Default: 100 entries spread across ~30–60 fake users following a Pareto
 * distribution (most users have 1–2 entries, a handful have up to 5).
 *
 * SETUP (one time):
 *   1. Open your Truist sheet → Extensions → Apps Script
 *   2. Replace any existing code with this file's contents
 *   3. Save (Cmd-S), then run → `seedSyntheticEntries`
 *   4. First run: authorize Google Sheets + External requests when prompted
 *
 * SAFETY: clears the active sheet before writing. To append instead,
 * change CLEAR_FIRST to false.
 */

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const DG_PROXY = 'https://datagolf-proxy.jhs797.workers.dev/';
const TARGET_ENTRIES = 100;
const CLEAR_FIRST = true;

function seedSyntheticEntries() {
  const sheet = SpreadsheetApp.getActiveSheet();

  // ── 1. Pull the current ESPN event + competitor field ────────────────
  const espn = JSON.parse(UrlFetchApp.fetch(ESPN_SCOREBOARD, { muteHttpExceptions: true }).getContentText());
  const ev = espn && espn.events && espn.events[0];
  if (!ev) throw new Error('ESPN scoreboard returned no events.');
  const eventName = ev.name || 'PGA Event';
  const competitors = (ev.competitions && ev.competitions[0] && ev.competitions[0].competitors) || [];
  const field = competitors
    .map(function (c) { return c.athlete && c.athlete.displayName; })
    .filter(Boolean);
  if (field.length < 8) {
    throw new Error('Not enough competitors in field (' + field.length + '). Field probably not yet published — try again Tuesday.');
  }

  // ── 2. Try to get DataGolf top_20 probabilities for ranking ──────────
  const probMap = {};
  try {
    const res = UrlFetchApp.fetch(DG_PROXY + '?endpoint=pre-tournament', { muteHttpExceptions: true });
    const dg = JSON.parse(res.getContentText());
    const arr = (dg && dg.arr) || [];
    arr.forEach(function (p) {
      // DG sends "Last, First"
      const parts = (p.player_name || '').split(', ');
      const name = parts.length === 2 ? parts[1] + ' ' + parts[0] : p.player_name;
      probMap[name] = (typeof p.top_20 === 'number') ? p.top_20 : 0;
    });
  } catch (e) {
    Logger.log('DataGolf fetch failed (' + e.message + ') — falling back to alphabetical tier split.');
  }

  // ── 3. Sort field by top_20 desc (alphabetical fallback when prob=0) ─
  const sorted = field.slice().sort(function (a, b) {
    const pa = probMap[a] || 0;
    const pb = probMap[b] || 0;
    if (pa !== pb) return pb - pa;
    return a.localeCompare(b);
  });

  // ── 4. Split into 4 ~equal quartiles ────────────────────────────────
  const quartile = Math.ceil(sorted.length / 4);
  const tiers = [
    sorted.slice(0, quartile),
    sorted.slice(quartile, quartile * 2),
    sorted.slice(quartile * 2, quartile * 3),
    sorted.slice(quartile * 3)
  ];

  // ── 5. Build users with Pareto-ish distribution ─────────────────────
  const FIRST = [
    'Jake', 'Marcus', 'Sam', 'Connor', 'Ethan', 'Logan', 'Noah', 'Ryan',
    'Tyler', 'Brandon', 'Aaron', 'Adam', 'Curt', 'Andrew', 'David', 'Matt',
    'Brian', 'Chris', 'Mike', 'Patrick', 'Daniel', 'Justin', 'Kevin', 'Eric',
    'Steve', 'James', 'Rob', 'Greg', 'Pete', 'Tony', 'Mark', 'Jeff', 'Will',
    'Sean', 'Drew', 'Cole', 'Hunter', 'Trevor', 'Blake', 'Wyatt'
  ];
  const LAST = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson',
    'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
    'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Lewis',
    'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Lopez', 'Hill',
    'Green', 'Stark', 'Hayes', 'Ward', 'Brooks', 'Foster', 'Bell', 'Reed'
  ];
  const PFX = ['The', 'Hot', 'Birdie', 'Eagle', 'Fairway', 'Bunker', 'Dogleg', 'Mulligan', 'Albatross', 'Sandy', 'Tee', 'Green', 'Ace', 'Bogey', 'Putt', 'Pin', 'Cart', 'Caddie', 'Range', 'Slice'];
  const SFX = ['Bandits', 'Boys', 'Crew', 'Squad', 'Hackers', 'Sluggers', 'Hunters', 'Killers', 'Brigade', 'Lords', 'Kings', 'Shanks', 'Slingers', 'Strikers', 'Aces', 'Eagles', 'Sharks', 'Wolves', 'Saints', 'Mafia'];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN(arr, n) {
    const copy = arr.slice();
    const out = [];
    for (let i = 0; i < n && copy.length; i++) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }
  function teamName() { return pick(PFX) + ' ' + pick(SFX); }
  function tiebreaker() { return '-' + (10 + Math.floor(Math.random() * 16)); } // -10 to -25
  function entriesPerUser() {
    const r = Math.random();
    if (r < 0.45) return 1;
    if (r < 0.75) return 2;
    if (r < 0.90) return 3;
    if (r < 0.97) return 4;
    return 5;
  }

  const users = [];
  let total = 0;
  while (total < TARGET_ENTRIES) {
    let count = entriesPerUser();
    count = Math.min(count, TARGET_ENTRIES - total);
    const first = pick(FIRST), last = pick(LAST);
    users.push({
      entrant: first + ' ' + last,
      email: (first + last).toLowerCase() + Math.floor(Math.random() * 999) + '@example.com',
      count: count
    });
    total += count;
  }

  // ── 6. Build rows: header + entries ─────────────────────────────────
  const headers = ['Timestamp', 'Email', 'Entrant', 'Entry Name', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tiebreaker'];
  const rows = [headers];
  const now = Date.now();
  users.forEach(function (u) {
    for (let i = 0; i < u.count; i++) {
      rows.push([
        new Date(now - Math.random() * 86400000 * 7), // randomized within last 7 days
        u.email,
        u.entrant,
        u.count > 1 ? teamName() + ' #' + (i + 1) : teamName(),
        pickN(tiers[0], 2).join(', '),
        pickN(tiers[1], 2).join(', '),
        pickN(tiers[2], 2).join(', '),
        pickN(tiers[3], 2).join(', '),
        tiebreaker()
      ]);
    }
  });

  // ── 7. Write to sheet ───────────────────────────────────────────────
  if (CLEAR_FIRST) sheet.clearContents();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  // Sort timestamp newest-first so the most recent entries are at top
  sheet.getRange(2, 1, rows.length - 1, headers.length).sort({ column: 1, ascending: false });

  const dgUsed = Object.keys(probMap).length > 0;
  SpreadsheetApp.getUi().alert(
    'Seeded ' + (rows.length - 1) + ' entries for ' + eventName +
    '\nUsers: ' + users.length +
    '\nTiers: ' + tiers.map(function (t) { return t.length; }).join(' / ') +
    '\nRanking: ' + (dgUsed ? 'DataGolf top-20%' : 'alphabetical (DG unavailable)')
  );
}
