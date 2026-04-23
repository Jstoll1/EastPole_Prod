// ── Analytics ─────────────────────────────────────────────
function trackEvent(name) {
  if (window.goatcounter && goatcounter.count) {
    goatcounter.count({ path: '/event/' + name, event: true });
  }
}

// ── Utility Functions ──────────────────────────────────────

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function timeAgo(ts) {
  var s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  var m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  return h + 'h ago';
}

function normalCDF(x) {
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  var a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  var sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  var t = 1.0 / (1.0 + p * x);
  var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// Score formatting helpers
var gs = function(n) {
  if (GOLFER_SCORES[n]) return GOLFER_SCORES[n].score;
  if (Object.keys(GOLFER_SCORES).length > 0) console.warn('⚠️ Player not found in GOLFER_SCORES:', n);
  return TOURNAMENT_STARTED ? 11 : 0;
};
var fmt = function(s) { return s === 11 ? 'MC' : s === 12 ? 'WD' : s < 0 ? '' + s : s > 0 ? '+' + s : 'E'; };
var fmtTeam = function(s) { return s < 0 ? '' + s : s > 0 ? '+' + s : 'E'; };
var cls = function(s) { return s < 0 ? 'neg' : s > 0 ? 'pos' : 'eve'; };

function parsePos(pos) {
  if (!pos || pos === '—' || pos === 'MC' || pos === 'WD') return null;
  return parseInt(String(pos).replace('T', '')) || null;
}

function resolvePlayerName(name) { return NAME_ALIASES[name] || name; }
function getCountryCode(name) { return FLAG_TO_CODE[FLAGS[name]] || ''; }

function getHolesRemaining(playerName) {
  var gd = GOLFER_SCORES[playerName];
  if (!gd) return 0;
  if (gd.thru === 'MC' || gd.thru === 'WD' || gd.score === 11 || gd.score === 12) return 0;
  // roundCount = total linescores with any value (includes in-progress)
  var roundCount = gd.roundCount || [gd.r1, gd.r2, gd.r3, gd.r4].filter(function(r) { return r != null; }).length;
  var thruNum = parseInt(gd.thru);
  var roundDone = gd.thru === 'F' || gd.thru === '18';
  if (roundDone) {
    // Finished current round: roundCount includes it
    return Math.max(0, (4 - roundCount) * 18);
  }
  if (!isNaN(thruNum) && thruNum > 0) {
    // Mid-round: roundCount includes in-progress round
    return Math.max(0, (4 - roundCount) * 18 + (18 - thruNum));
  }
  // Hasn't started (tee time or '—'): roundCount = completed rounds only
  return Math.max(0, (4 - roundCount) * 18);
}

// Strip any non-letter prefix (flag emoji, regional-indicator codepoints,
// whitespace, ZWJ, etc.) from a raw pick segment and normalize to the
// canonical GOLFER_SCORES key. Using [^\p{L}]+ is more robust than an
// emoji-property allow-list, which historically missed regional-indicator
// flag sequences under some JS engines.
function _cleanPickName(raw) {
  if (typeof raw !== 'string') return '';
  var stripped = raw.replace(/^[^\p{L}]+/u, '').trim();
  return (typeof resolvePlayerName === 'function') ? resolvePlayerName(stripped) : stripped;
}

var _scorePickWarned = {};

// Score one pick. Team-event pair strings ("🏴 Matt F / 🏴 Alex F") share a
// single team score in GOLFER_SCORES (same record written for both teammates)
// — resolve either teammate instead of feeding the whole pair string to gs(),
// which would miss and fall through to the MC=11 penalty (collapsing every
// entry in a Zurich-style team pool to +44).
function scorePick(pick) {
  if (typeof pick === 'string' && pick.indexOf(' / ') !== -1) {
    var names = pick.split(/\s*\/\s*/).map(_cleanPickName).filter(Boolean);
    for (var i = 0; i < names.length; i++) {
      if (GOLFER_SCORES[names[i]]) return GOLFER_SCORES[names[i]].score;
    }
    // Neither teammate matched — log once per pair so a miss is visible in
    // the console (instead of silently collapsing to the MC penalty).
    if (!_scorePickWarned[pick]) {
      _scorePickWarned[pick] = 1;
      console.warn('⚠️ scorePick: team pair unresolved', { pick: pick, cleaned: names, inScores: names.map(function(n){return !!GOLFER_SCORES[n];}) });
    }
    return gs(names[0] || pick);
  }
  return gs(pick);
}

function calcEntry(e) {
  var scores = e.picks.map(function(n) { return { name: n, score: scorePick(n) }; }).sort(function(a, b) { return a.score - b.score; });
  var bestN = (typeof POOL_CONFIG !== 'undefined' && POOL_CONFIG.bestN) ? POOL_CONFIG.bestN : 4;
  var top4 = scores.slice(0, bestN);
  return Object.assign({}, e, {
    scores: scores,
    top4: top4,
    total: top4.reduce(function(s, g) { return s + g.score; }, 0),
    fifthScore: scores[bestN] ? scores[bestN].score : null,
    sixthScore: scores[bestN + 1] ? scores[bestN + 1].score : null
  });
}

// Comparator implementing 2026 tiebreaker rules:
// 1) lowest total (best 4) wins
// 2) tied → lower 5th-best score wins
// 3) still tied → lower 6th-best score wins
// 4) still tied → split evenly (returns 0)
function compareEntries(a, b) {
  if (a.total !== b.total) return a.total - b.total;
  var a5 = a.fifthScore == null ? 9999 : a.fifthScore;
  var b5 = b.fifthScore == null ? 9999 : b.fifthScore;
  if (a5 !== b5) return a5 - b5;
  var a6 = a.sixthScore == null ? 9999 : a.sixthScore;
  var b6 = b.sixthScore == null ? 9999 : b.sixthScore;
  if (a6 !== b6) return a6 - b6;
  return 0;
}

function getRanked() {
  return ENTRIES.map(calcEntry).sort(compareEntries);
}

// Pool payouts — locked to sponsor-confirmed totals for 2026 Masters.
// Total pot: $2,390 (127 entries + 15 fifth-entry discounts)
// 1st: $1,645 · 2nd: $705 · 3rd: $40
function computePoolPayouts() {
  return { pot: 2390, p1: 1645, p2: 705, p3: 40, entries: ENTRIES.length };
}

function computeOwnership() {
  if (!ENTRIES.length) return [];
  var counts = {};
  ENTRIES.forEach(function(e) { e.picks.forEach(function(p) { counts[p] = (counts[p] || 0) + 1; }); });
  return Object.entries(counts)
    .map(function(pair) { return { player: pair[0], entries: pair[1], pct: pair[1] / ENTRIES.length }; })
    .sort(function(a, b) { return b.pct - a.pct; });
}

function getMyPicksMap() {
  if (!currentUserEmail) return {};
  var map = {};
  var teamsToShow = activeTeamIdx >= 0 ? [currentUserTeams[activeTeamIdx]].filter(Boolean) : currentUserTeams;
  teamsToShow.forEach(function(entry) {
    var idx = currentUserTeams.indexOf(entry);
    entry.picks.forEach(function(name) {
      if (!map[name]) map[name] = [];
      if (!map[name].includes(idx)) map[name].push(idx);
    });
  });
  return map;
}

function getActiveTeamPicks() {
  if (!currentUserEmail) return new Set();
  if (activeTeamIdx >= 0 && currentUserTeams[activeTeamIdx]) {
    return new Set(currentUserTeams[activeTeamIdx].picks);
  }
  return new Set(currentUserTeams.flatMap(function(t) { return t.picks; }));
}

function golferTodayScore(gd) {
  if (!gd || gd.score > 10) return null;
  var thru = gd.thru;
  if (!thru || thru === '—' || thru === 'MC' || thru === 'WD' || thru === 'F' || thru.includes(':')) return null;
  var thruNum = parseInt(thru);
  if (isNaN(thruNum) || thruNum < 1) return null;
  var rounds = [gd.r1, gd.r2, gd.r3, gd.r4];
  var completedRel = 0;
  for (var i = 0; i < rounds.length; i++) {
    var r = rounds[i];
    if (r == null || r <= 50) break;
    var next = rounds[i + 1];
    if (next != null && next > 50) { completedRel += r - COURSE_PAR; continue; }
    break;
  }
  return gd.score - completedRel;
}

function getDefaultPars() {
  // Augusta National hole pars
  return [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4];
}

function getHolePar(holeNum) {
  if (COURSE_HOLES && COURSE_HOLES[holeNum - 1]) return COURSE_HOLES[holeNum - 1].par;
  var defaults = getDefaultPars();
  return defaults[holeNum - 1] || 4;
}

function scorecardClass(strokes, par) {
  if (!strokes || strokes <= 0) return '';
  var diff = strokes - par;
  if (diff <= -3 || strokes === 1) return 'sc-ace';
  if (diff <= -2) return 'sc-eagle';
  if (diff === -1) return 'sc-birdie';
  if (diff === 0) return 'sc-par';
  if (diff === 1) return 'sc-bogey';
  return 'sc-dbl';
}

function getTopMovers(arrowMap) {
  var ups = [], dns = [];
  arrowMap.forEach(function(delta, name) {
    if (delta > 0) ups.push({ name: name, delta: delta });
    if (delta < 0) dns.push({ name: name, delta: Math.abs(delta) });
  });
  ups.sort(function(a, b) { return b.delta - a.delta; });
  dns.sort(function(a, b) { return b.delta - a.delta; });
  var result = new Map();
  // Top 3 movers each direction (include ties at the 3rd spot)
  function assignTop(list, sign) {
    if (!list.length) return;
    var cutoff = list.length >= 5 ? list[4].delta : list[list.length - 1].delta;
    list.forEach(function(item) {
      if (item.delta >= cutoff) result.set(item.name, { sign: sign });
    });
  }
  assignTop(ups, 'up');
  assignTop(dns, 'down');
  return result;
}

function calcWinProbability(entryA, entryB) {
  var cA = calcEntry(entryA);
  var cB = calcEntry(entryB);
  var diff = cA.total - cB.total;
  var holesA = cA.top4.map(function(g) { return getHolesRemaining(g.name); });
  var holesB = cB.top4.map(function(g) { return getHolesRemaining(g.name); });
  var totalHolesA = holesA.reduce(function(s, h) { return s + h; }, 0);
  var totalHolesB = holesB.reduce(function(s, h) { return s + h; }, 0);
  if (totalHolesA + totalHolesB === 0) {
    if (diff < 0) return { pctA: 100, pctB: 0 };
    if (diff > 0) return { pctA: 0, pctB: 100 };
    return { pctA: 50, pctB: 50 };
  }
  var STROKE_VAR = 1.1 * 1.1;
  var BEST4_DAMPEN = 0.65;
  var teamVarA = holesA.reduce(function(s, h) { return s + STROKE_VAR * h; }, 0) * BEST4_DAMPEN;
  var teamVarB = holesB.reduce(function(s, h) { return s + STROKE_VAR * h; }, 0) * BEST4_DAMPEN;
  var sigma = Math.sqrt(Math.max(teamVarA + teamVarB, 1));
  var z = -diff / sigma;
  var pA = normalCDF(z) * 100;
  var clampedA = Math.max(1, Math.min(99, Math.round(pA)));
  return { pctA: clampedA, pctB: 100 - clampedA };
}
