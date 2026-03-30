// ── Activity Tracker ──────────────────────────────────────

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 50;
var ACT_TTL = 10 * 60 * 1000; // 10 minutes
var _actTab = 'golf';
var _actOpen = false;
var _actUnseenGolf = 0;
var _actUnseenEntry = 0;

function addActivity(cat, icon, text) {
  ACTIVITY_LOG.unshift({ cat: cat, icon: icon, text: text, time: Date.now() });
  if (ACTIVITY_LOG.length > MAX_ACTIVITY) ACTIVITY_LOG.pop();
  if (!_actOpen) {
    if (cat === 'golf') _actUnseenGolf++;
    else _actUnseenEntry++;
    updateActBadge();
  }
  if (_actOpen) renderActivityList();
}

function updateActBadge() {
  var total = _actUnseenGolf + _actUnseenEntry;
  var badge = document.getElementById('act-badge');
  if (!badge) return;
  if (total > 0) { badge.textContent = total > 99 ? '99+' : total; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }
}

function toggleActivityDrawer() {
  _actOpen = !_actOpen;
  document.getElementById('activity-drawer').classList.toggle('open', _actOpen);
  document.getElementById('activity-overlay').classList.toggle('open', _actOpen);
  if (_actOpen) {
    if (_actTab === 'golf') _actUnseenGolf = 0;
    else _actUnseenEntry = 0;
    updateActBadge();
    renderActivityList();
  }
}

function setActTab(tab, btn) {
  _actTab = tab;
  document.querySelectorAll('.act-tab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  if (tab === 'golf') _actUnseenGolf = 0;
  else _actUnseenEntry = 0;
  updateActBadge();
  renderActivityList();
}

function pruneActivity() {
  var now = Date.now();
  while (ACTIVITY_LOG.length && now - ACTIVITY_LOG[ACTIVITY_LOG.length - 1].time > ACT_TTL) ACTIVITY_LOG.pop();
}

function renderActivityList() {
  pruneActivity();
  var el = document.getElementById('act-list');
  if (!el) return;
  var items = ACTIVITY_LOG.filter(function(a) { return a.cat === _actTab; });
  if (!items.length) {
    el.innerHTML = '<div class="act-empty">' + (_actTab === 'golf' ? 'No golf activity yet. Events appear when players make birdies, bogeys, and more.' : 'No entry movements yet. Events appear when standings change.') + '</div>';
    return;
  }
  el.innerHTML = items.map(function(a) {
    return '<div class="act-item">' +
      '<div class="act-icon">' + a.icon + '</div>' +
      '<div class="act-body"><div class="act-text">' + a.text + '</div>' +
      '<div class="act-time">' + timeAgo(a.time) + '</div></div></div>';
  }).join('');
}

// Update time-ago labels every 15s
setInterval(function() { if (_actOpen) renderActivityList(); }, 15000);

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
    var icon, label;
    if (diff <= -3) { icon = '🦅🦅'; label = 'albatross on'; }
    else if (diff === -2) { icon = '🦅'; label = 'eagles'; }
    else if (diff === -1) { icon = '🐦'; label = 'birdies'; }
    else if (diff === 1) { icon = '🟡'; label = 'bogeys'; }
    else if (diff === 2) { icon = '🔴'; label = 'double bogeys'; }
    else { icon = '⛔'; label = 'makes +' + diff + ' on'; }
    var holeStr = holeNum ? ' hole ' + holeNum + ' (par ' + holePar + ')' : '';
    var poolTag = new Set(ENTRIES.flatMap(function(e) { return e.picks; })).has(name) ? ' <span style="color:var(--gold);font-size:10px">POOL</span>' : '';
    addActivity('golf', icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + holeStr + poolTag);
  });
}

function detectEntryActivity() {
  var ranked = getRanked();
  ranked.forEach(function(e, i) {
    var rank = i + 1;
    var prevRank = PREV_RANKS[e.team];
    if (prevRank === undefined) return;
    if (prevRank === rank) return;
    var diff = prevRank - rank;
    if (diff > 0) {
      addActivity('entry', '📈', '<strong>' + e.team + '</strong> moves up to <strong>#' + rank + '</strong> (was #' + prevRank + ')');
    } else {
      addActivity('entry', '📉', '<strong>' + e.team + '</strong> drops to <strong>#' + rank + '</strong> (was #' + prevRank + ')');
    }
  });
}
