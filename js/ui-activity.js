// ── Activity Tracker ──────────────────────────────────────
// Shows hole-by-hole updates for the current user's golfers only.
// Sorted newest first. No TTL expiry — persists for the session.

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 200;
var _actOpen = false;
var _actUnseen = 0;

function addActivity(icon, text, playerName) {
  ACTIVITY_LOG.unshift({ icon: icon, text: text, player: playerName, time: Date.now() });
  if (ACTIVITY_LOG.length > MAX_ACTIVITY) ACTIVITY_LOG.pop();
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
  // Filter to only current user's picks
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
  if (!myPicks.size) return; // No user selected — skip
  var pars = COURSE_HOLES ? COURSE_HOLES.map(function(h) { return h.par; }) : getDefaultPars();
  Object.entries(freshScores).forEach(function(pair) {
    var name = pair[0], d = pair[1];
    if (!myPicks.has(name)) return; // Only track user's golfers
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
