// ─── Pool Entry Loader ─────────────────────────────────────────
// Fetches the published Google Sheet (TSV) that backs the Google
// Form, parses rows into ENTRIES, and surfaces a Pool Roster card
// that shows team names + entrants pre-tournament (picks hidden).

var POOL_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjBiF7GjL0OV--o5cqjWnIDtx2ON0TfZpTwX_zNNpESl8w731mzdKGTsU4gGPbpGT0F5fERvaednpL/pub?output=tsv';
var _lastPoolFetch = 0;

function isTournamentLive() {
  if (typeof GOLFER_SCORES === 'undefined' || !GOLFER_SCORES) return false;
  // Only consider "live" when someone has actually posted a round score.
  // Don't use thru because pre-tournament it holds tee-time strings ("8:00").
  var names = Object.keys(GOLFER_SCORES);
  for (var i = 0; i < names.length; i++) {
    var g = GOLFER_SCORES[names[i]];
    if (!g) continue;
    if (g.roundCount && g.roundCount > 0) return true;
    // Round scores are real golf totals (60-100ish) — filter out 0/null/strings
    if (typeof g.r1 === 'number' && g.r1 > 30) return true;
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
  console.log('📋 Pool sheet headers:', headers);
  var find = function(re) { return headers.findIndex(function(h) { return re.test(h); }); };
  var idx = {
    timestamp:  find(/timestamp/i),
    email:      find(/e.?mail/i),
    entrant:    find(/^entrant$|your\s*name|full\s*name|^name$/i),
    team:       find(/entry\s*name|team\s*name/i),
    tier1:      find(/tier\s*1/i),
    tier2:      find(/tier\s*2/i),
    tier3:      find(/tier\s*3/i),
    tier4:      find(/tier\s*4/i),
    tiebreaker: find(/tie.?break/i)
  };
  console.log('📋 Pool sheet column indices:', idx);
  var entries = [];
  for (var r = 1; r < lines.length; r++) {
    var cells = _parseTSVLine(lines[r]);
    var team = (idx.team >= 0 ? cells[idx.team] : '') || '';
    team = team.trim();
    if (!team) continue;
    var entrantCell = (idx.entrant >= 0 ? cells[idx.entrant] : '').trim();
    // If sheet doesn't have a separate entrant column but the entry name was
    // submitted as "Username — Entry Name" (em dash) or "Username - Entry Name"
    // (hyphen), split it back out so the username can be searched separately.
    if (!entrantCell) {
      var split = team.split(/\s+[—-]\s+/);
      if (split.length === 2) {
        entrantCell = split[0].trim();
        team = split[1].trim();
      }
    }
    var picks = [];           // team-pair strings (e.g. "🏴 Matt Fitzpatrick / 🏴 Alex Fitzpatrick")
    var golferNames = [];     // flat individual names (kept for future solo-event scoring)
    var tierPicks = { tier1: [], tier2: [], tier3: [], tier4: [] };
    ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
      var i = idx[k];
      if (i < 0 || !cells[i]) return;
      // Google stores multi-checkbox as ", "-joined string within the cell.
      var teams = cells[i].split(/,\s*(?=[^\s])/).map(function(s) { return s.trim(); }).filter(Boolean);
      tierPicks[k] = teams;
      teams.forEach(function(pair) {
        picks.push(pair);
        // Also extract individual players (strip leading flag) for any scoring
        // code that still assumes solo entries.
        pair.split(/\s*\/\s*/).forEach(function(p) {
          var clean = p.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s🏴\u{E0020}-\u{E007F}]+/u, '').trim();
          if (clean) golferNames.push(clean);
        });
      });
    });
    entries.push({
      team: team,
      entrant: entrantCell,
      email: (idx.email >= 0 ? cells[idx.email] : '').trim(),
      timestamp: (idx.timestamp >= 0 ? cells[idx.timestamp] : '').trim(),
      tieBreaker: (idx.tiebreaker >= 0 ? cells[idx.tiebreaker] : '').trim(),
      tierPicks: tierPicks,
      picks: picks,
      golferNames: golferNames,
      isTeamEvent: picks.length > 0 && picks[0].indexOf(' / ') !== -1
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
    // Refresh the logged-in user's team associations now that ENTRIES is populated
    if (typeof currentUserEmail !== 'undefined' && currentUserEmail) {
      window.currentUserTeams = ENTRIES.filter(function(e) { return e.email === currentUserEmail; });
    }
    if (typeof updateTermLoginButton === 'function') updateTermLoginButton();
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
  var myEmail = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : null;
  var h = '<div class="pr-card">';
  h += '<div class="pr-head">'
    +    '<span class="pr-title">Pool Roster</span>'
    +    '<span class="pr-count">' + entries.length + ' ' + (entries.length === 1 ? 'entry' : 'entries') + '</span>'
    +  '</div>';
  h += '<div class="pr-note">'
    +    (live
            ? 'Picks visible on Standings view'
            : '🔒 Picks hidden until Thursday tee-off · tap your entry to view your own picks')
    +  '</div>';
  h += '<div class="pr-list">';
  entries.slice().sort(function(a, b) {
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  }).forEach(function(e, i) {
    var mine = myEmail && e.email && e.email.toLowerCase() === String(myEmail).toLowerCase();
    h += '<div class="pr-row' + (mine ? ' pr-row-mine' : '') + '"'
      +    (mine ? ' onclick="toggleMyPicks(' + i + ')"' : '')
      +    '>'
      +    '<span class="pr-team">' + _efEscape(e.team) + '</span>'
      +    (mine ? '<span class="pr-mine-tag">YOU</span>' : '')
      +  '</div>';
  });
  h += '</div>';
  h += '<div id="pr-my-picks" class="pr-my-picks" style="display:none"></div>';
  h += '</div>';
  mount.innerHTML = h;
}

function toggleMyPicks(idx) {
  var entries = (typeof ENTRIES !== 'undefined' && ENTRIES) ? ENTRIES : [];
  var e = entries[idx];
  if (!e) return;
  var panel = document.getElementById('pr-my-picks');
  if (!panel) return;
  if (panel.dataset.open === '1' && panel.dataset.idx === String(idx)) {
    panel.style.display = 'none';
    panel.dataset.open = '0';
    return;
  }
  panel.dataset.open = '1';
  panel.dataset.idx = String(idx);
  var tierLabels = { tier1: 'Tier 1 · Favorites', tier2: 'Tier 2 · Contenders', tier3: 'Tier 3 · Midfield', tier4: 'Tier 4 · Longshots' };
  var html = '<div class="pr-mp-head">' + _efEscape(e.team) + ' — your picks</div>';
  ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
    var teams = (e.tierPicks && e.tierPicks[k]) || [];
    if (!teams.length) return;
    html += '<div class="pr-mp-tier">';
    html += '<div class="pr-mp-tier-lbl">' + tierLabels[k] + '</div>';
    teams.forEach(function(t) {
      html += '<div class="pr-mp-team">' + _efEscape(t) + '</div>';
    });
    html += '</div>';
  });
  if (e.tieBreaker) html += '<div class="pr-mp-tb">Tiebreaker: <strong>' + _efEscape(e.tieBreaker) + '</strong></div>';
  panel.innerHTML = html;
  panel.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
  // Defer so primary render lands first, then fetch + render the roster.
  setTimeout(function() { loadPoolEntries(true); }, 400);
  // Refresh periodically so late submissions surface without reload.
  setInterval(function() { loadPoolEntries(); }, 120000);
});
