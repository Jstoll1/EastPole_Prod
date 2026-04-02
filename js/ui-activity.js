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
    var cutoff = Date.now() - 96 * 60 * 60 * 1000;
    // Filter old entries and deduplicate by player+type within 3min windows
    var filtered = saved.filter(function(a) { return a.time > cutoff; });
    var deduped = [];
    filtered.forEach(function(a) {
      var isDup = deduped.some(function(d) {
        return d.player === a.player && d.type === a.type && Math.abs(d.time - a.time) < 180000;
      });
      if (!isDup) deduped.push(a);
    });
    ACTIVITY_LOG = deduped;
    _saveActivity();
    var lastSeen = parseInt(localStorage.getItem(_ACT_SEEN_KEY) || '0');
    _actUnseen = ACTIVITY_LOG.filter(function(a) { return a.time > lastSeen; }).length;
  } catch(e) { ACTIVITY_LOG = []; }
})();

function _saveActivity() {
  try { localStorage.setItem(_ACT_STORAGE_KEY, JSON.stringify(ACTIVITY_LOG)); } catch(e) {}
}

function addActivity(icon, text, playerName, type) {
  // Dedup: skip if same player+type within last 3min
  var now = Date.now();
  var dup = ACTIVITY_LOG.some(function(a) {
    return a.player === playerName && a.type === type && (now - a.time) < 180000;
  });
  if (dup) return;
  ACTIVITY_LOG.unshift({ icon: icon, text: text, player: playerName, type: type || '', time: now });
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
  var hasTeams = currentUserTeams && currentUserTeams.length > 0;
  var opts = '';
  if (hasTeams) {
    opts += '<option value="all">All My Entries</option>';
    currentUserTeams.forEach(function(t, i) {
      opts += '<option value="' + i + '">' + t.team + '</option>';
    });
  }
  opts += '<option value="field"' + (!hasTeams ? ' selected' : '') + '>Entire Field</option>';
  sel.innerHTML = opts;
}

function getLiveFilteredPicks() {
  var sel = document.getElementById('live-entry-filter');
  var val = sel ? sel.value : 'field';
  if (val === 'field') return null; // null = entire field
  if (val !== 'all' && currentUserTeams && currentUserTeams[parseInt(val)]) {
    trackEvent('live-filter-entry');
    return new Set(currentUserTeams[parseInt(val)].picks);
  }
  var picks = getActiveTeamPicks();
  return picks.size > 0 ? picks : null;
}

function renderActivityList() {
  var el = document.getElementById('act-list');
  if (!el) return;
  var myPicks = getLiveFilteredPicks();
  var items = myPicks
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
    var typeCls = a.type ? ' act-' + a.type : '';
    var ownE = a.player && OWNERSHIP_DATA ? OWNERSHIP_DATA.find(function(o) { return o.player === a.player; }) : null;
    var ownTag = ownE ? ' <span class="act-own">' + Math.round(ownE.pct * 100) + '%</span>' : '';
    return '<div class="act-item' + typeCls + '">' +
      '<div class="act-icon">' + a.icon + '</div>' +
      '<div class="act-body"><div class="act-text">' + a.text + ownTag + '</div>' +
      '<div class="act-time">' + timeAgo(a.time) + '</div></div></div>';
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
  var pars = COURSE_HOLES ? COURSE_HOLES.map(function(h) { return h.par; }) : getDefaultPars();
  Object.entries(freshScores).forEach(function(pair) {
    var name = pair[0], d = pair[1];
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
    var holeStr = holeNum ? ' Hole ' + holeNum : '';
    var parTag = holeNum ? ' <span class="act-meta">P' + holePar + '</span>' : '';
    var scCls = d.score < 0 ? 'neg' : d.score > 0 ? 'pos' : 'eve';
    var todayStr = d.todayDisplay && d.todayDisplay !== '—' ? d.todayDisplay : '';
    var todayTag = todayStr ? ' <span class="act-meta">(' + todayStr + ' today)</span>' : '';
    addActivity(icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + holeStr + parTag + ': <span class="act-score ' + scCls + '">' + fmt(d.score) + '</span>' + todayTag, name, type);
  });
}

function detectEntryActivity() {}

// Swipe down to close drawer
(function() {
  var drawer = document.getElementById('activity-drawer');
  if (!drawer) return;
  var startY = 0, currentY = 0, dragging = false;
  var handle = drawer.querySelector('.act-handle');
  var header = drawer.querySelector('.live-header');

  function onStart(e) {
    var t = e.touches[0];
    startY = t.clientY;
    currentY = startY;
    dragging = true;
    drawer.style.transition = 'none';
  }
  function onMove(e) {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    var dy = currentY - startY;
    if (dy > 0) {
      drawer.style.transform = 'translateY(' + dy + 'px)';
      e.preventDefault();
    }
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    drawer.style.transition = '';
    var dy = currentY - startY;
    if (dy > 80) {
      toggleActivityDrawer();
    } else {
      drawer.style.transform = _actOpen ? 'translateY(0)' : 'translateY(100%)';
    }
  }
  if (handle) { handle.addEventListener('touchstart', onStart, { passive: true }); }
  if (header) { header.addEventListener('touchstart', onStart, { passive: true }); }
  drawer.addEventListener('touchmove', onMove, { passive: false });
  drawer.addEventListener('touchend', onEnd);
})();
