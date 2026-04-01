// ── Activity / Live Feed Drawer ───────────────────────────
// Shows hole-by-hole updates for the current user's golfers.
// Persisted to localStorage so feed survives refreshes.

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 300;
var _actOpen = false;
var _actUnseen = 0;
var _roundLive = false;
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
  } catch(e) { ACTIVITY_LOG = []; }
})();

function _saveActivity() {
  try { localStorage.setItem(_ACT_STORAGE_KEY, JSON.stringify(ACTIVITY_LOG)); } catch(e) {}
}

function addActivity(icon, text, playerName, type) {
  ACTIVITY_LOG.unshift({ icon: icon, text: text, player: playerName, type: type || '', time: Date.now() });
  if (ACTIVITY_LOG.length > MAX_ACTIVITY) ACTIVITY_LOG = ACTIVITY_LOG.slice(0, MAX_ACTIVITY);
  _saveActivity();
  if (!_actOpen) _actUnseen++;
  if (_actOpen) renderActivityList();
}

function toggleActivityDrawer() {
  if (!_actOpen) trackEvent('activity-open');
  _actOpen = !_actOpen;
  document.getElementById('activity-drawer').classList.toggle('open', _actOpen);
  document.getElementById('activity-overlay').classList.toggle('open', _actOpen);
  if (_actOpen) {
    _actUnseen = 0;
    try { localStorage.setItem(_ACT_SEEN_KEY, String(Date.now())); } catch(e) {}
    populateLiveEntryFilter();
    renderActivityList();
  }
}

function updateLiveTab() {
  var fab = document.getElementById('activity-fab');
  if (!fab) return;
  if (_roundLive) {
    fab.classList.add('live');
  } else {
    fab.classList.remove('live');
  }
}

function populateLiveEntryFilter() {
  var sel = document.getElementById('live-entry-filter');
  if (!sel) return;
  var opts = '<option value="all">All My Entries</option>';
  if (currentUserTeams && currentUserTeams.length > 0) {
    currentUserTeams.forEach(function(t, i) {
      opts += '<option value="' + i + '">' + t.team + '</option>';
    });
  }
  sel.innerHTML = opts;
}

function getLiveFilteredPicks() {
  var sel = document.getElementById('live-entry-filter');
  var val = sel ? sel.value : 'all';
  if (val !== 'all' && currentUserTeams && currentUserTeams[parseInt(val)]) {
    return new Set(currentUserTeams[parseInt(val)].picks);
  }
  return getActiveTeamPicks();
}

function renderActivityList() {
  var el = document.getElementById('act-list');
  if (!el) return;
  var myPicks = getLiveFilteredPicks();
  var items = myPicks.size > 0
    ? ACTIVITY_LOG.filter(function(a) { return myPicks.has(a.player); })
    : ACTIVITY_LOG;
  if (!items.length) {
    var msg = !_roundLive
      ? '<div class="act-empty">' +
        '<div style="font-size:36px;margin-bottom:16px">⚡</div>' +
        '<div style="font-weight:800;color:var(--text);margin-bottom:10px;font-size:16px">Live Hole-by-Hole Feed</div>' +
        '<div style="line-height:1.6">Your entries\' golfers will show up here as they complete each hole during the round.</div></div>'
      : '<div class="act-empty">' +
        '<div style="font-size:36px;margin-bottom:16px">⚡</div>' +
        '<div style="font-weight:800;color:var(--text);margin-bottom:10px;font-size:16px">Waiting for updates…</div>' +
        '<div style="line-height:1.6">Scores will appear here as your golfers complete holes.</div></div>';
    el.innerHTML = msg;
    return;
  }
  el.innerHTML = items.map(function(a) {
    var ts = new Date(a.time);
    var timeStr = ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    var typeCls = a.type ? ' act-' + a.type : '';
    return '<div class="act-item' + typeCls + '">' +
      '<div class="act-icon">' + a.icon + '</div>' +
      '<div class="act-body"><div class="act-text">' + a.text + '</div>' +
      '<div class="act-time">' + timeStr + ' · ' + timeAgo(a.time) + '</div></div></div>';
  }).join('');
}

// Update time-ago labels every 15s when drawer is open
setInterval(function() { if (_actOpen) renderActivityList(); }, 15000);

function setRoundLive(isLive) {
  _roundLive = isLive;
  updateLiveTab();
  var pill = document.getElementById('live-status-pill');
  if (pill) {
    if (isLive) {
      pill.textContent = '● Live';
      pill.classList.add('active');
    } else {
      pill.textContent = TOURNAMENT_STARTED ? 'Between Rounds' : 'Pre-Tournament';
      pill.classList.remove('active');
    }
  }
}

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
    var icon, label, type;
    if (diff <= -3) { icon = '🦅'; label = 'albatross'; type = 'eagle'; }
    else if (diff === -2) { icon = '🦅'; label = 'eagles'; type = 'eagle'; }
    else if (diff === -1) { icon = '🐦'; label = 'birdies'; type = 'birdie'; }
    else if (diff === 1) { icon = '🟡'; label = 'bogeys'; type = 'bogey'; }
    else if (diff === 2) { icon = '🔴'; label = 'double bogeys'; type = 'double'; }
    else { icon = '⛔'; label = '+' + diff + ' on'; type = 'worse'; }
    var holeStr = holeNum ? ' #' + holeNum : '';
    var parStr = holeNum ? ' <span style="color:var(--text3);font-size:12px">(Par ' + holePar + ')</span>' : '';
    var todayStr = d.todayDisplay && d.todayDisplay !== '—' ? d.todayDisplay : '';
    var statusStr = ' <span style="color:var(--text2)">—</span> <strong>' + fmt(d.score) + '</strong>' + (todayStr ? ' <span style="color:var(--text3);font-size:12px">(' + todayStr + ' today)</span>' : '');
    addActivity(icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + holeStr + parStr + statusStr, name, type);
  });
}

function detectEntryActivity() {}
