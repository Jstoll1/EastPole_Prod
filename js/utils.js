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
  var thruStr = String(gd.thru || '');
  var roundDone = thruStr === 'F' || thruStr === '18';
  if (roundDone) {
    // Finished current round: roundCount includes it
    return Math.max(0, (4 - roundCount) * 18);
  }
  // Tee-time strings ('8:30 AM CT', '10:50') would parseInt to the hour and
  // falsely enter the mid-round branch — inflating holes-left by (18 − hour).
  // Skip integer parsing when the value carries a clock separator.
  if (thruStr.indexOf(':') === -1) {
    var thruNum = parseInt(thruStr, 10);
    if (!isNaN(thruNum) && thruNum > 0 && thruNum < 18) {
      // Mid-round: roundCount includes in-progress round
      return Math.max(0, (4 - roundCount) * 18 + (18 - thruNum));
    }
  }
  // Hasn't started (tee time or '—'): roundCount = completed rounds only
  return Math.max(0, (4 - roundCount) * 18);
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
