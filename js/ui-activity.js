// ── Activity Tracker ──────────────────────────────────────
// Shows hole-by-hole updates for the current user's golfers.
// Persisted to localStorage so feed survives refreshes.

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 300;
var _actOpen = false;
var _actUnseen = 0;
var _ACT_STORAGE_KEY = 'eastpole_activity';
var _ACT_SEEN_KEY = 'eastpole_activity_seen';

// Load persisted activity on startup
(function() {
  try {
    var saved = JSON.parse(localStorage.getItem(_ACT_STORAGE_KEY) || '[]');
    var cutoff = Date.now() - 24 * 60 * 60 * 1000;
    ACTIVITY_LOG = saved.filter(function(a) { return a.time > cutoff; });
    var lastSeen = parseInt(localStorage.getItem(_ACT_SEEN_KEY) || '0');
    _actUnseen = ACTIVITY_LOG.filter(function(a) { return a.time > lastSeen; }).length;
    updateActBadge();
  } catch(e) { ACTIVITY_LOG = []; }
})();

function _saveActivity() {
  try { localStorage.setItem(_ACT_STORAGE_KEY, JSON.stringify(ACTIVITY_LOG)); } catch(e) {}
}

function addActivity(icon, text, playerName) {
  ACTIVITY_LOG.unshift({ icon: icon, text: text, player: playerName, time: Date.now() });
  if (ACTIVITY_LOG.length > MAX_ACTIVITY) ACTIVITY_LOG = ACTIVITY_LOG.slice(0, MAX_ACTIVITY);
  _saveActivity();
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
  if (!_actOpen) trackEvent('activity-open');
  _actOpen = !_actOpen;
  document.getElementById('activity-drawer').classList.toggle('open', _actOpen);
  document.getElementById('activity-overlay').classList.toggle('open', _actOpen);
  if (_actOpen) {
    _actUnseen = 0;
    updateActBadge();
    try { localStorage.setItem(_ACT_SEEN_KEY, String(Date.now())); } catch(e) {}
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
    el.innerHTML = '<div class="act-empty">' +
      '<div style="font-size:24px;margin-bottom:12px">⚡</div>' +
      '<div style="font-weight:700;color:var(--text);margin-bottom:8px">Live Hole-by-Hole Feed</div>' +
      '<div>Your entries\' golfers will show up here as they complete each hole during the round.</div>' +
      '<div style="margin-top:12px;font-size:12px;color:var(--text3);font-style:italic">' +
      'The broadcast won\'t show every shot — but this will. Birdies, bogeys, eagles — as they happen.</div></div>';
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
    if (diff <= -3) { icon = '🦅🦅'; label = 'albatross'; }
    else if (diff === -2) { icon = '🦅'; label = 'eagles'; }
    else if (diff === -1) { icon = '🐦'; label = 'birdies'; }
    else if (diff === 1) { icon = '🟡'; label = 'bogeys'; }
    else if (diff === 2) { icon = '🔴'; label = 'double bogeys'; }
    else { icon = '⛔'; label = '+' + diff + ' on'; }
    var holeStr = holeNum ? ' #' + holeNum : '';
    var parStr = holeNum ? ' <span style="color:var(--text3);font-size:11px">(Par ' + holePar + ')</span>' : '';
    var todayStr = d.todayDisplay && d.todayDisplay !== '—' ? d.todayDisplay : '';
    var statusStr = ' <span style="color:var(--text2)">— <strong>' + fmt(d.score) + '</strong>' + (todayStr ? ' (' + todayStr + ' today)' : '') + '</span>';
    addActivity(icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + holeStr + parStr + statusStr, name);
  });
}

function detectEntryActivity() {
  // No longer used — activity is golfer-focused only
}
