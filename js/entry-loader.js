// ─── Pool Entry Loader ─────────────────────────────────────────
// Fetches the published Google Sheet (TSV) that backs the Google
// Form, parses rows into ENTRIES, and surfaces a Pool Roster card
// that shows team names + entrants pre-tournament (picks hidden).

var POOL_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjBiF7GjL0OV--o5cqjWnIDtx2ON0TfZpTwX_zNNpESl8w731mzdKGTsU4gGPbpGT0F5fERvaednpL/pub?output=tsv';
var _lastPoolFetch = 0;
// Tracks whether the first loadPoolEntries() attempt has resolved. Lets the
// terminal distinguish "fetching, please wait" from "really have zero entries".
window.POOL_FETCH_STATE = window.POOL_FETCH_STATE || 'idle'; // idle | loading | ok | error

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
    entrant:    find(/^entrant$|^user\s*name$|^username$|your\s*name|full\s*name|^name$/i),
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
    var picks = [];
    var tierPicks = { tier1: [], tier2: [], tier3: [], tier4: [] };
    ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
      var i = idx[k];
      if (i < 0 || !cells[i]) return;
      // Google stores multi-checkbox as ", "-joined string within the cell.
      var golfers = cells[i].split(/,\s*(?=[^\s])/).map(function(s) { return s.trim(); }).filter(Boolean);
      tierPicks[k] = golfers;
      golfers.forEach(function(g) { picks.push(g); });
    });
    entries.push({
      team: team,
      entrant: entrantCell,
      email: (idx.email >= 0 ? cells[idx.email] : '').trim(),
      timestamp: (idx.timestamp >= 0 ? cells[idx.timestamp] : '').trim(),
      tieBreaker: (idx.tiebreaker >= 0 ? cells[idx.tiebreaker] : '').trim(),
      tierPicks: tierPicks,
      picks: picks,
      golferNames: picks.slice()
    });
  }
  return entries;
}

async function loadPoolEntries(force) {
  // Throttle — don't refetch more than once every 2 minutes unless forced.
  if (!force && Date.now() - _lastPoolFetch < 120000) return;
  window.POOL_FETCH_STATE = 'loading';
  try {
    var res = await fetch(POOL_SHEET_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('⚠️ Pool sheet fetch HTTP ' + res.status);
      window.POOL_FETCH_STATE = 'error';
      return;
    }
    var text = await res.text();
    var entries = parsePoolTSV(text);
    _lastPoolFetch = Date.now();
    if (!entries.length) {
      console.warn('⚠️ Pool sheet returned 0 entries (check headers)');
      window.POOL_FETCH_STATE = 'error';
      return;
    }
    // Replace the global ENTRIES array in place so everything already
    // pointing at it picks up the new rows without a full reload.
    if (typeof ENTRIES !== 'undefined') {
      ENTRIES.length = 0;
      entries.forEach(function(e) { ENTRIES.push(e); });
    }
    window.POOL_FETCH_STATE = 'ok';
    console.log('✅ Loaded', entries.length, 'pool entries from sheet');
    // Rebind the logged-in user's team associations now that ENTRIES is populated.
    if (typeof currentUserEmail !== 'undefined' && currentUserEmail && typeof _matchUserKey === 'function') {
      window.currentUserTeams = ENTRIES.filter(function(e) { return _matchUserKey(e, currentUserEmail); });
    }
    if (typeof updateTermLoginButton === 'function') updateTermLoginButton();
    renderPoolRoster();
    if (typeof renderAll === 'function') renderAll();
  } catch(e) {
    window.POOL_FETCH_STATE = 'error';
    console.warn('⚠️ Pool entries fetch failed:', e.message);
  }
}

var _prRosterExpanded = false;
var _prMyExpandedIdx = null;
function togglePoolRoster() { _prRosterExpanded = !_prRosterExpanded; renderPoolRoster(); }

function renderPoolRoster() {
  var mount = document.getElementById('pool-roster');
  if (!mount) return;
  var entries = (typeof ENTRIES !== 'undefined' && ENTRIES) ? ENTRIES : [];
  if (!entries.length) {
    mount.innerHTML = '<div class="pr-empty">No entries yet — tap + ENTRY to be first in.</div>';
    return;
  }
  var live = isTournamentLive();
  var mine = (typeof currentUserTeams !== 'undefined' && currentUserTeams) ? currentUserTeams : [];

  var h = '<div class="pr-card">';

  // Compact summary line (always visible)
  h += '<div class="pr-summary">'
    +    '<span class="pr-title">POOL</span>'
    +    '<span class="pr-dot">·</span>'
    +    '<span class="pr-count">' + entries.length + ' ' + (entries.length === 1 ? 'entry' : 'entries') + '</span>'
    +    (live ? '' : '<span class="pr-dot">·</span><span class="pr-lock">🔒 locked until tee-off</span>')
    +    '<button class="pr-toggle" onclick="togglePoolRoster()">' + (_prRosterExpanded ? 'hide all ▴' : 'view all ▾') + '</button>'
    +  '</div>';

  // Logged-in user's entries (prominent, expandable)
  if (mine.length) {
    h += '<div class="pr-mine-section">';
    h += '<div class="pr-mine-head">Your ' + mine.length + ' ' + (mine.length === 1 ? 'entry' : 'entries') + '</div>';
    mine.forEach(function(e, i) {
      var expanded = _prMyExpandedIdx === i;
      h += '<div class="pr-mine-row' + (expanded ? ' pr-expanded' : '') + '" onclick="togglePoolRosterMyPick(' + i + ')">'
        +   '<span class="pr-caret">' + (expanded ? '▾' : '▸') + '</span>'
        +   '<span class="pr-team">' + _efEscape(e.team) + '</span>'
        +   (e.tieBreaker ? '<span class="pr-mine-tb">TB ' + _efEscape(e.tieBreaker) + '</span>' : '')
        + '</div>';
      if (expanded) h += _renderMineDetail(e);
    });
    h += '</div>';
  }

  // Full roster (collapsed by default)
  if (_prRosterExpanded) {
    h += '<div class="pr-list">';
    entries.slice().sort(function(a, b) {
      return (a.team || '').localeCompare(b.team || '');
    }).forEach(function(e) {
      h += '<div class="pr-row"><span class="pr-team">' + _efEscape(e.team) + '</span></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  mount.innerHTML = h;
}

function togglePoolRosterMyPick(idx) {
  _prMyExpandedIdx = (_prMyExpandedIdx === idx) ? null : idx;
  renderPoolRoster();
}

function _renderMineDetail(e) {
  var tierLabels = { tier1: 'T1 Favorites', tier2: 'T2 Contenders', tier3: 'T3 Midfield', tier4: 'T4 Longshots' };
  var hasTiers = e.tierPicks && Object.keys(e.tierPicks).some(function(k) { return (e.tierPicks[k] || []).length; });
  var h = '<div class="pr-mine-detail">';
  if (hasTiers) {
    ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
      var picks = (e.tierPicks && e.tierPicks[k]) || [];
      if (!picks.length) return;
      h += '<div class="pr-mine-tier">'
        + '<div class="pr-mine-tier-lbl">' + tierLabels[k] + '</div>'
        + picks.map(function(p) { return '<div class="pr-mine-pick">' + _efEscape(p) + '</div>'; }).join('')
        + '</div>';
    });
  } else if (e.picks && e.picks.length) {
    h += '<div class="pr-mine-tier">'
      + e.picks.map(function(p) { return '<div class="pr-mine-pick">' + _efEscape(p) + '</div>'; }).join('')
      + '</div>';
  }
  h += '</div>';
  return h;
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
