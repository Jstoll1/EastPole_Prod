// ─── Pool Entry Loader ─────────────────────────────────────────
// Fetches the published Google Sheet (TSV) that backs the Google
// Form, parses rows into ENTRIES, and surfaces a Pool Roster card
// that shows team names + entrants pre-tournament (picks hidden).

var POOL_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjBiF7GjL0OV--o5cqjWnIDtx2ON0TfZpTwX_zNNpESl8w731mzdKGTsU4gGPbpGT0F5fERvaednpL/pub?output=tsv';
var _lastPoolFetch = 0;

function isTournamentLive() {
  if (typeof GOLFER_SCORES === 'undefined' || !GOLFER_SCORES) return false;
  var names = Object.keys(GOLFER_SCORES);
  for (var i = 0; i < names.length; i++) {
    var g = GOLFER_SCORES[names[i]];
    if (!g) continue;
    if (g.roundCount && g.roundCount > 0) return true;
    if (g.r1 != null && g.r1 !== 0 && g.r1 !== '—') return true;
    if (g.thru && g.thru !== '—' && g.thru !== 'TBD' && g.thru !== '') return true;
  }
  return false;
}

function _parseTSVLine(line) {
  var cells = [];
  var cur = '';
  var inQuote = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i+1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === '\t') { cells.push(cur); cur = ''; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

function parsePoolTSV(text) {
  // Google strips trailing empty lines but keep defensive
  var lines = text.replace(/\r/g, '').split('\n').filter(function(l) { return l.length > 0; });
  if (lines.length < 2) return [];
  var headers = _parseTSVLine(lines[0]).map(function(h) { return h.trim(); });
  var find = function(re) { return headers.findIndex(function(h) { return re.test(h); }); };
  var idx = {
    timestamp:  find(/timestamp/i),
    email:      find(/email/i),
    team:       find(/entry\s*name|team\s*name/i),
    tier1:      find(/tier\s*1/i),
    tier2:      find(/tier\s*2/i),
    tier3:      find(/tier\s*3/i),
    tier4:      find(/tier\s*4/i),
    tiebreaker: find(/tie.?break/i)
  };
  var entries = [];
  for (var r = 1; r < lines.length; r++) {
    var cells = _parseTSVLine(lines[r]);
    var team = (idx.team >= 0 ? cells[idx.team] : '') || '';
    team = team.trim();
    if (!team) continue;
    var picks = [];
    var tierPicks = { tier1: [], tier2: [], tier3: [], tier4: [] };
    ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
      var i = idx[k];
      if (i < 0 || !cells[i]) return;
      // Google stores multi-checkbox as ", "-joined string within the cell.
      // Each entry is a team-pair "Flag A PlayerA / Flag B PlayerB".
      var teams = cells[i].split(/,\s*(?=[^\s])/).map(function(s) { return s.trim(); }).filter(Boolean);
      tierPicks[k] = teams;
      teams.forEach(function(pair) {
        // Split team-pair into individual players and strip leading flag emoji.
        pair.split(/\s*\/\s*/).forEach(function(p) {
          var clean = p.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s🏴\u{E0020}-\u{E007F}]+/u, '').trim();
          if (clean) picks.push(clean);
        });
      });
    });
    entries.push({
      team: team,
      email: (idx.email >= 0 ? cells[idx.email] : '').trim(),
      timestamp: (idx.timestamp >= 0 ? cells[idx.timestamp] : '').trim(),
      tieBreaker: (idx.tiebreaker >= 0 ? cells[idx.tiebreaker] : '').trim(),
      tierPicks: tierPicks,
      picks: picks
    });
  }
  return entries;
}

async function loadPoolEntries(force) {
  // Throttle — don't refetch more than once every 2 minutes unless forced.
  if (!force && Date.now() - _lastPoolFetch < 120000) return;
  try {
    var res = await fetch(POOL_SHEET_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('⚠️ Pool sheet fetch HTTP ' + res.status);
      return;
    }
    var text = await res.text();
    var entries = parsePoolTSV(text);
    _lastPoolFetch = Date.now();
    if (!entries.length) {
      console.warn('⚠️ Pool sheet returned 0 entries (check headers)');
      return;
    }
    // Replace the global ENTRIES array in place so everything already
    // pointing at it picks up the new rows without a full reload.
    if (typeof ENTRIES !== 'undefined') {
      ENTRIES.length = 0;
      entries.forEach(function(e) { ENTRIES.push(e); });
    }
    console.log('✅ Loaded', entries.length, 'pool entries from sheet');
    renderPoolRoster();
    if (typeof renderAll === 'function') renderAll();
  } catch(e) {
    console.warn('⚠️ Pool entries fetch failed:', e.message);
  }
}

function renderPoolRoster() {
  var mount = document.getElementById('pool-roster');
  if (!mount) return;
  var entries = (typeof ENTRIES !== 'undefined' && ENTRIES) ? ENTRIES : [];
  if (!entries.length) {
    mount.innerHTML = '<div class="pr-empty">No entries submitted yet — tap + ENTRY below to be first in.</div>';
    return;
  }
  var live = isTournamentLive();
  var h = '<div class="pr-card">';
  h += '<div class="pr-head">'
    +    '<span class="pr-title">Pool Roster</span>'
    +    '<span class="pr-count">' + entries.length + ' ' + (entries.length === 1 ? 'entry' : 'entries') + '</span>'
    +  '</div>';
  h += '<div class="pr-note">'
    +    (live
            ? 'Picks visible on Standings view'
            : '🔒 Picks hidden until Thursday tee-off')
    +  '</div>';
  h += '<div class="pr-list">';
  entries.slice().sort(function(a, b) {
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  }).forEach(function(e) {
    h += '<div class="pr-row"><span class="pr-team">' + _efEscape(e.team) + '</span></div>';
  });
  h += '</div></div>';
  mount.innerHTML = h;
}

document.addEventListener('DOMContentLoaded', function() {
  // Defer so primary render lands first, then fetch + render the roster.
  setTimeout(function() { loadPoolEntries(true); }, 400);
  // Refresh periodically so late submissions surface without reload.
  setInterval(function() { loadPoolEntries(); }, 120000);
});
