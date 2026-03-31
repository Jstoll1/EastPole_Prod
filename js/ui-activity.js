// ── Activity Tracker ──────────────────────────────────────
// Shows hole-by-hole updates for the current user's golfers only.
// Sorted newest first. No TTL expiry — persists for the session.
// Includes "while you were away" banner when returning to the tab.

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 200;
var _actOpen = false;
var _actUnseen = 0;

// ── While You Were Away ──────────────────────────────────
var _awaySince = null;        // timestamp when user left the tab
var _awayEvents = [];          // events accumulated while away
var _prevTeamTotal = null;     // team score when user left

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    // User left — start tracking
    _awaySince = Date.now();
    _awayEvents = [];
    // Snapshot current team score
    var ranked = getRanked();
    var myTeam = ranked.find(function(e) {
      return e.email === currentUserEmail &&
        (activeTeamIdx < 0 || e.team === (currentUserTeams[activeTeamIdx] || {}).team);
    });
    _prevTeamTotal = myTeam ? myTeam.total : null;
  } else if (_awaySince && _awayEvents.length > 0) {
    // User returned — show banner
    showAwayBanner();
  }
});

function addAwayEvent(icon, text, playerName) {
  if (document.hidden && _awaySince) {
    _awayEvents.push({ icon: icon, text: text, player: playerName, time: Date.now() });
  }
}

function showAwayBanner() {
  var existing = document.getElementById('away-banner');
  if (existing) existing.remove();

  var elapsed = Date.now() - _awaySince;
  var minAway = Math.round(elapsed / 60000);
  var timeLabel = minAway < 1 ? 'less than a minute' : (minAway === 1 ? '1 min' : minAway + ' min');

  // Filter to user's picks
  var myPicks = getActiveTeamPicks();
  var events = myPicks.size > 0
    ? _awayEvents.filter(function(a) { return myPicks.has(a.player); })
    : _awayEvents;

  if (!events.length) { _awaySince = null; _awayEvents = []; return; }

  // Calculate net team movement
  var netHtml = '';
  var ranked = getRanked();
  var myTeam = ranked.find(function(e) {
    return e.email === currentUserEmail &&
      (activeTeamIdx < 0 || e.team === (currentUserTeams[activeTeamIdx] || {}).team);
  });
  if (myTeam && _prevTeamTotal !== null) {
    var diff = myTeam.total - _prevTeamTotal;
    if (diff !== 0) {
      var direction = diff < 0 ? '▲' : '▼';
      var strokeWord = Math.abs(diff) === 1 ? 'stroke' : 'strokes';
      var color = diff < 0 ? '#52b788' : '#ff7070';
      netHtml = '<div class="away-net" style="color:' + color + '">'
        + direction + ' ' + Math.abs(diff) + ' ' + strokeWord
        + ' (team now ' + fmtTeam(myTeam.total) + ')</div>';
    }
  }

  var eventsHtml = events.map(function(a) {
    var ts = new Date(a.time);
    var timeStr = ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return '<div class="away-event">'
      + '<span class="away-icon">' + a.icon + '</span>'
      + '<span class="away-text">' + a.text + '</span>'
      + '<span class="away-time">' + timeStr + '</span>'
      + '</div>';
  }).join('');

  var banner = document.createElement('div');
  banner.id = 'away-banner';
  banner.innerHTML = '<div class="away-card">'
    + '<div class="away-header">'
    + '<span class="away-title">⚡ While you were away (' + timeLabel + ')</span>'
    + '<button class="away-close" onclick="dismissAwayBanner()">✕</button>'
    + '</div>'
    + '<div class="away-events">' + eventsHtml + '</div>'
    + netHtml
    + '<button class="away-dismiss" onclick="dismissAwayBanner()">Got it</button>'
    + '</div>';
  document.body.appendChild(banner);

  // Auto-dismiss after 15 seconds
  setTimeout(function() { dismissAwayBanner(); }, 15000);

  _awaySince = null;
  _awayEvents = [];
}

function dismissAwayBanner() {
  var banner = document.getElementById('away-banner');
  if (banner) {
    banner.classList.add('away-hiding');
    setTimeout(function() { banner.remove(); }, 300);
  }
}

// ── Core Activity Feed ───────────────────────────────────

function addActivity(icon, text, playerName) {
  ACTIVITY_LOG.unshift({ icon: icon, text: text, player: playerName, time: Date.now() });
  if (ACTIVITY_LOG.length > MAX_ACTIVITY) ACTIVITY_LOG.pop();
  // Also track for away banner
  addAwayEvent(icon, text, playerName);
  if (!_actOpen) {
    _actUnseen++;
    updateActBadge();
  }
  if (_actOpen) renderActivityList();
}

function updateActBadge() {
  var badge = document.getElementById('act-badge');
  if (!badge) return;
  if (_actUnseen > 0) { badge.textContent = _actUnseen > 99 ? '99+' : _actUnseen; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }
}

function toggleActivityDrawer() {
  _actOpen = !_actOpen;
  document.getElementById('activity-drawer').classList.toggle('open', _actOpen);
  document.getElementById('activity-overlay').classList.toggle('open', _actOpen);
  if (_actOpen) {
    _actUnseen = 0;
    updateActBadge();
    renderActivityList();
  }
}

function renderActivityList() {
  var el = document.getElementById('act-list');
  if (!el) return;
  var myPicks = getActiveTeamPicks();
  var items = myPicks.size > 0
    ? ACTIVITY_LOG.filter(function(a) { return myPicks.has(a.player); })
    : ACTIVITY_LOG;
  if (!items.length) {
    el.innerHTML = '<div class="act-empty">No activity yet for your golfers. Updates appear as they complete holes.</div>';
    return;
  }
  el.innerHTML = items.map(function(a) {
    var ts = new Date(a.time);
    var timeStr = ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return '<div class="act-item">' +
      '<div class="act-icon">' + a.icon + '</div>' +
      '<div class="act-body"><div class="act-text">' + a.text + '</div>' +
      '<div class="act-time">' + timeStr + ' · ' + timeAgo(a.time) + '</div></div></div>';
  }).join('');
}

// Update time-ago labels every 15s
setInterval(function() { if (_actOpen) renderActivityList(); }, 15000);

function detectGolfActivity(freshScores) {
  var myPicks = getActiveTeamPicks();
  if (!myPicks.size) return;
  var pars = COURSE_HOLES ? COURSE_HOLES.map(function(h) { return h.par; }) : getDefaultPars();
  Object.entries(freshScores).forEach(function(pair) {
    var name = pair[0], d = pair[1];
    if (!myPicks.has(name)) return;
    if (d.score === 11 || d.score === 12) return;
    var prev = PREV_SCORES[name];
    if (prev === undefined) return;
    var diff = d.score - prev;
    if (diff === 0) return;
    var thruNum = parseInt(d.thru);
    var holeNum = !isNaN(thruNum) && thruNum >= 1 ? thruNum : (d.thru === 'F' || d.thru === '18' ? 18 : null);
    var holePar = holeNum ? (pars[holeNum - 1] || 4) : 4;
    var flag = FLAGS[name] || '';
    var icon, label;
    if (diff <= -3) { icon = '🦅🦅'; label = 'albatross on'; }
    else if (diff === -2) { icon = '🦅'; label = 'eagles'; }
    else if (diff === -1) { icon = '🐦'; label = 'birdies'; }
    else if (diff === 1) { icon = '🟡'; label = 'bogeys'; }
    else if (diff === 2) { icon = '🔴'; label = 'double bogeys'; }
    else { icon = '⛔'; label = 'makes +' + diff + ' on'; }
    var holeStr = holeNum ? ' hole ' + holeNum + ' (par ' + holePar + ')' : '';
    var scoreStr = ' — now <strong>' + fmt(d.score) + '</strong> thru ' + (d.thru || '?');
    addActivity(icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + holeStr + scoreStr, name);
  });
}

function detectEntryActivity() {
  // No longer used — activity is golfer-focused only
}
