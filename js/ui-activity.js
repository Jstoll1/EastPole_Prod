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

// One-time clear of old-format activity, then load
(function() {
  try {
    var migrated = localStorage.getItem('eastpole_act_v2');
    if (!migrated) {
      localStorage.removeItem(_ACT_STORAGE_KEY);
      localStorage.setItem('eastpole_act_v2', '1');
    }
    var saved = JSON.parse(localStorage.getItem(_ACT_STORAGE_KEY) || '[]');
    var cutoff = Date.now() - 96 * 60 * 60 * 1000;
    ACTIVITY_LOG = saved.filter(function(a) { return a.time > cutoff; });
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
  var dr = document.getElementById('activity-drawer');
  dr.style.transform = '';
  dr.style.transition = '';
  dr.style.maxHeight = '';
  dr.classList.toggle('open', _actOpen);
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

// Swipe to resize / close drawer
(function() {
  var drawer = document.getElementById('activity-drawer');
  if (!drawer) return;
  var startY = 0, currentY = 0, dragging = false, startH = 0;
  var MIN_H = 45; // vh
  var MAX_H = 90; // vh

  function onStart(e) {
    if (!_actOpen) return;
    // Only trigger from handle/header area, not scrollable list
    var tgt = e.target;
    var list = document.getElementById('act-list');
    if (list && list.contains(tgt) && list.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    startH = drawer.offsetHeight;
    dragging = true;
    drawer.style.transition = 'none';
  }
  function onMove(e) {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    var dy = currentY - startY;
    // Swipe down: translate drawer down (to close)
    if (dy > 0) {
      drawer.style.transform = 'translateY(' + dy + 'px)';
      e.preventDefault();
    } else {
      // Swipe up: grow drawer height
      var newH = Math.min(MAX_H, Math.max(MIN_H, (startH - dy) / window.innerHeight * 100));
      drawer.style.maxHeight = newH + 'vh';
      drawer.style.transform = 'translateY(0)';
      e.preventDefault();
    }
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    drawer.style.transition = '';
    drawer.style.transform = '';
    var dy = currentY - startY;
    if (dy > 80) {
      toggleActivityDrawer();
    }
  }
  drawer.addEventListener('touchstart', onStart, { passive: true });
  drawer.addEventListener('touchmove', onMove, { passive: false });
  drawer.addEventListener('touchend', onEnd);
})();
