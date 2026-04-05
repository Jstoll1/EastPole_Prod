// ── Activity / Live Feed Drawer ───────────────────────────
// Shows hole-by-hole updates for the current user's golfers.
// Persisted to localStorage so feed survives refreshes.

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 300;
var _actOpen = false;
var _actUnseen = 0;
var _roundLive = false;
var HOLE_TIMESTAMPS = {};
var _ACT_STORAGE_KEY = 'eastpole_activity';
var _HOLE_TS_KEY = 'eastpole_hole_ts';

// Load hole timestamps from localStorage
try { HOLE_TIMESTAMPS = JSON.parse(localStorage.getItem(_HOLE_TS_KEY) || '{}'); } catch(e) { HOLE_TIMESTAMPS = {}; }
function _saveHoleTimestamps() { try { localStorage.setItem(_HOLE_TS_KEY, JSON.stringify(HOLE_TIMESTAMPS)); } catch(e) {} }
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
  // Dedup: skip if same player + same text within last 3min
  var now = Date.now();
  var dup = ACTIVITY_LOG.some(function(a) {
    return a.player === playerName && a.text === text && (now - a.time) < 180000;
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

var _actRendering = false;
async function renderActivityList() {
  var el = document.getElementById('act-list');
  if (!el || _actRendering) return;
  _actRendering = true;

  var myPicks = getLiveFilteredPicks(); // Set of player names, or null for entire field
  var playerNames = [];
  if (myPicks) {
    playerNames = Array.from(myPicks);
  } else {
    // Entire field: all active players (thru is a number or F)
    Object.entries(GOLFER_SCORES).forEach(function(pair) {
      var d = pair[1];
      if (d.score === 11 || d.score === 12) return;
      var t = parseInt(d.thru);
      if ((!isNaN(t) && t >= 1) || d.thru === 'F' || d.thru === '18') playerNames.push(pair[0]);
    });
  }

  if (!playerNames.length) {
    el.innerHTML = '<div class="act-empty">' +
      '<div style="font-size:36px;margin-bottom:16px">⚡</div>' +
      '<div style="font-weight:800;color:var(--text);margin-bottom:10px;font-size:16px">' + (_roundLive ? 'Waiting for updates…' : 'Live Hole-by-Hole Feed') + '</div>' +
      '<div style="line-height:1.6">Scores will appear here as golfers complete holes.</div></div>';
    _actRendering = false;
    return;
  }

  // Invalidate stale scorecards: if player's thru has advanced beyond cached holes, re-fetch
  playerNames.forEach(function(n) {
    var gd = GOLFER_SCORES[n];
    if (!gd || !SCORECARD_CACHE[n]) return;
    var thruNow = parseInt(gd.thru);
    if (isNaN(thruNow) && (gd.thru === 'F' || gd.thru === '18')) thruNow = 18;
    if (isNaN(thruNow)) return;
    var rounds = SCORECARD_CACHE[n];
    var withHoles = rounds.filter(function(r) { return r.holes && r.holes.length > 0; });
    var activeRound = withHoles.length ? withHoles[withHoles.length - 1] : null;
    var cachedHoles = activeRound ? activeRound.holes.filter(function(h) { return h.strokes > 0; }).length : 0;
    if (thruNow > cachedHoles) delete SCORECARD_CACHE[n];
  });

  // Show loading if scorecards need fetching
  var needFetch = playerNames.filter(function(n) { return !SCORECARD_CACHE[n] && ATHLETE_IDS[n]; });
  if (needFetch.length > 0) {
    el.innerHTML = '<div class="act-empty" style="padding:30px"><div style="font-size:11px;color:var(--text3)">Loading scorecards…</div></div>';
    await fetchCourseHoles();
    await Promise.all(needFetch.map(function(n) { return fetchPlayerScorecard(n); }));
  }

  // Build hole-by-hole items from scorecards, most recent hole first
  var items = [];
  playerNames.forEach(function(name) {
    var rounds = SCORECARD_CACHE[name];
    var gd = GOLFER_SCORES[name];
    if (!rounds || !rounds.length || !gd) return;
    if (gd.score === 11 || gd.score === 12 || gd.thru === 'MC' || gd.thru === 'WD') return;
    // Only show holes from the current round (not previous rounds)
    var thruNum = parseInt(gd.thru);
    var isOnCourse = !isNaN(thruNum) && thruNum >= 1 && thruNum <= 17;
    var isFinished = gd.thru === 'F' || gd.thru === '18';
    if (!isOnCourse && !isFinished) return;
    var withHoles = rounds.filter(function(r) { return r.holes && r.holes.length > 0; });
    var activeRound = withHoles.length ? withHoles[withHoles.length - 1] : null;
    if (!activeRound) return;
    var flag = FLAGS[name] || '';
    var pEmoji = getPlayerEmoji(name);
    var emojiTag = pEmoji ? '<span class="act-emoji-tag">' + pEmoji + '</span>' : '';
    var roundNum = withHoles.length;
    // Running score-to-par through the round
    var priorRoundsPar = 0;
    for (var ri = 0; ri < roundNum - 1; ri++) {
      if (rounds[ri] && rounds[ri].value && rounds[ri].value > 50) priorRoundsPar += (rounds[ri].value - COURSE_PAR);
    }
    var playerThru = isFinished ? 18 : (isOnCourse ? thruNum : 0);
    var runningScore = priorRoundsPar;
    activeRound.holes.forEach(function(h) {
      if (!h.strokes || !h.par) return;
      runningScore += (h.strokes - h.par);
      var vs = h.strokes - h.par;
      if (vs === 0) return; // Skip pars
      var icon, label, type;
      if (vs <= -2) { icon = '🦅'; label = 'eagles'; type = 'eagle'; }
      else if (vs === -1) { icon = '🐦'; label = 'birdies'; type = 'birdie'; }
      else if (vs === 1) { icon = '🟡'; label = 'bogeys'; type = 'bogey'; }
      else if (vs === 2) { icon = '🔴'; label = 'double bogeys'; type = 'double'; }
      else { icon = '⛔'; label = '+' + vs + ' on'; type = 'worse'; }
      var scCls = runningScore < 0 ? 'neg' : runningScore > 0 ? 'pos' : 'eve';
      var holeTs = HOLE_TIMESTAMPS[name + '-' + h.hole] || 0;
      items.push({
        player: name, hole: h.hole, type: type, icon: icon,
        text: '<strong>' + flag + ' ' + name + '</strong>' + emojiTag + ' ' + label + ' Hole ' + h.hole + ' <span class="act-meta">P' + h.par + '</span>: <span class="act-score ' + scCls + '">' + fmt(runningScore) + '</span>',
        sortKey: h.hole,
        holesAgo: playerThru - h.hole,
        stillPlaying: isOnCourse,
        timestamp: holeTs
      });
    });
  });

  // Sort by recency: timestamp first (newest on top), then holesAgo fallback
  items.sort(function(a, b) {
    if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    if (a.holesAgo !== b.holesAgo) return a.holesAgo - b.holesAgo;
    if (a.stillPlaying !== b.stillPlaying) return a.stillPlaying ? -1 : 1;
    return a.player.localeCompare(b.player);
  });

  if (!items.length) {
    el.innerHTML = '<div class="act-empty">' +
      '<div style="font-size:36px;margin-bottom:16px">⚡</div>' +
      '<div style="font-weight:800;color:var(--text);margin-bottom:10px;font-size:16px">No holes completed yet</div>' +
      '<div style="line-height:1.6">Scores will appear as golfers complete holes.</div></div>';
    _actRendering = false;
    return;
  }

  el.innerHTML = items.map(function(a) {
    var typeCls = a.type ? ' act-' + a.type : '';
    var ownE = a.player && OWNERSHIP_DATA ? OWNERSHIP_DATA.find(function(o) { return o.player === a.player; }) : null;
    var ownTag = ownE ? ' <span class="act-own">' + Math.round(ownE.pct * 100) + '%</span>' : '';
    var escapedPlayer = a.player.replace(/'/g, "\\'");
    return '<div class="act-item' + typeCls + '" onclick="openScorecardPopup(\'' + escapedPlayer + '\')" style="cursor:pointer">' +
      '<div class="act-icon">' + a.icon + '</div>' +
      '<div class="act-body"><div class="act-text">' + a.text + ownTag + '</div>' +
      '</div></div>';
  }).join('') + '<div class="act-end">You\'re all caught up</div>';
  _actRendering = false;
}

// Refresh feed every 30s when open
setInterval(function() { if (_actOpen) renderActivityList(); }, 30000);

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

async function detectGolfActivity(freshScores) {
  var pars = COURSE_HOLES ? COURSE_HOLES.map(function(h) { return h.par; }) : getDefaultPars();
  // Collect players whose thru advanced
  var updates = [];
  Object.entries(freshScores).forEach(function(pair) {
    var name = pair[0], d = pair[1];
    if (d.score === 11 || d.score === 12) return;
    var prev = PREV_SCORES[name];
    if (prev === undefined) return;
    var prevThru = PREV_THRU[name];
    var prevThruNum = prevThru ? parseInt(prevThru) : NaN;
    if (isNaN(prevThruNum) && prevThru === 'F') prevThruNum = 18;
    var thruNum = parseInt(d.thru);
    var thruNow = !isNaN(thruNum) ? thruNum : (d.thru === 'F' || d.thru === '18' ? 18 : 0);
    if (isNaN(prevThruNum) || thruNow <= prevThruNum) return;
    // Record timestamps for each hole completed
    var now = Date.now();
    for (var hh = prevThruNum + 1; hh <= thruNow; hh++) {
      HOLE_TIMESTAMPS[name + '-' + hh] = now;
    }
    _saveHoleTimestamps();
    updates.push({ name: name, d: d, prev: prev, prevThruNum: prevThruNum, thruNow: thruNow });
  });
  if (!updates.length) return;

  // Fetch scorecards for players who advanced (clear cache first)
  updates.forEach(function(u) { delete SCORECARD_CACHE[u.name]; });
  await fetchCourseHoles();
  await Promise.all(updates.map(function(u) { return fetchPlayerScorecard(u.name); }));

  updates.forEach(function(u) {
    var name = u.name, d = u.d, thruNow = u.thruNow, prevThruNum = u.prevThruNum;
    var holesJumped = thruNow - prevThruNum;
    var flag = FLAGS[name] || '';
    var scCls = d.score < 0 ? 'neg' : d.score > 0 ? 'pos' : 'eve';
    var todayStr = d.todayDisplay && d.todayDisplay !== '—' ? d.todayDisplay : '';
    var todayTag = todayStr ? ' <span class="act-meta">(' + todayStr + ' today)</span>' : '';

    // Get actual hole data from scorecard
    var rounds = SCORECARD_CACHE[name];
    var activeRound = null;
    if (rounds && rounds.length) {
      var withHoles = rounds.filter(function(r) { return r.holes && r.holes.length > 0; });
      activeRound = withHoles.length ? withHoles[withHoles.length - 1] : null;
    }
    var holeMap = {};
    if (activeRound) activeRound.holes.forEach(function(h) { holeMap[h.hole] = h; });

    if (holesJumped === 1) {
      var holeNum = thruNow;
      var hd = holeMap[holeNum];
      var holePar = (hd && hd.par) ? hd.par : (pars[holeNum - 1] || 4);
      var strokes = hd ? hd.strokes : null;
      var icon, label, type;
      if (strokes && holePar) {
        var vs = strokes - holePar;
        if (vs <= -2) { icon = '🦅'; label = 'eagles'; type = 'eagle'; }
        else if (vs === -1) { icon = '🐦'; label = 'birdies'; type = 'birdie'; }
        else if (vs === 0) { icon = '⛳'; label = 'pars'; type = 'par'; }
        else if (vs === 1) { icon = '🟡'; label = 'bogeys'; type = 'bogey'; }
        else if (vs === 2) { icon = '🔴'; label = 'double bogeys'; type = 'double'; }
        else { icon = '⛔'; label = '+' + vs + ' on'; type = 'worse'; }
      } else {
        // No scorecard data — use neutral message instead of guessing from score delta
        icon = '⛳'; label = 'completes'; type = 'par';
      }
      addActivity(icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + ' Hole ' + holeNum + ' <span class="act-meta">P' + holePar + '</span>: <span class="act-score ' + scCls + '">' + fmt(d.score) + '</span>' + todayTag, name, type);
    } else {
      // Multi-hole: report each hole if we have scorecard data
      var reported = false;
      if (activeRound) {
        for (var h = prevThruNum + 1; h <= thruNow; h++) {
          var hd = holeMap[h];
          if (hd && hd.strokes && hd.par) {
            var vs = hd.strokes - hd.par;
            var icon, label, type;
            if (vs <= -2) { icon = '🦅'; label = 'eagles'; type = 'eagle'; }
            else if (vs === -1) { icon = '🐦'; label = 'birdies'; type = 'birdie'; }
            else if (vs === 0) { icon = '⛳'; label = 'pars'; type = 'par'; }
            else if (vs === 1) { icon = '🟡'; label = 'bogeys'; type = 'bogey'; }
            else if (vs === 2) { icon = '🔴'; label = 'double bogeys'; type = 'double'; }
            else { icon = '⛔'; label = '+' + vs + ' on'; type = 'worse'; }
            addActivity(icon, '<strong>' + flag + ' ' + name + '</strong> ' + label + ' Hole ' + h + ' <span class="act-meta">P' + hd.par + '</span>: <span class="act-score ' + scCls + '">' + fmt(d.score) + '</span>' + todayTag, name, type);
            reported = true;
          }
        }
      }
      if (!reported) {
        // No scorecard data — show neutral progress update instead of guessing from score delta
        addActivity('⛳', '<strong>' + flag + ' ' + name + '</strong> now at: <span class="act-score ' + scCls + '">' + fmt(d.score) + '</span>' + todayTag + ' <span class="act-meta">thru ' + thruNow + '</span>', name, 'par');
      }
    }
  });
}

function detectEntryActivity() {}

// Swipe to resize / close drawer
var _dragAct = { on: false, y0: 0, yNow: 0, h0: 0 };

function actDragStart(e) {
  if (!_actOpen) return;
  _dragAct.on = true;
  _dragAct.y0 = e.touches[0].clientY;
  _dragAct.yNow = _dragAct.y0;
  var dr = document.getElementById('activity-drawer');
  _dragAct.h0 = dr.offsetHeight;
  dr.style.transition = 'none';
}

document.addEventListener('touchmove', function(e) {
  if (!_dragAct.on) return;
  _dragAct.yNow = e.touches[0].clientY;
  var dy = _dragAct.yNow - _dragAct.y0;
  var dr = document.getElementById('activity-drawer');
  if (dy > 0) {
    // Swiping down — slide drawer down to dismiss
    dr.style.transform = 'translateY(' + dy + 'px)';
  } else {
    // Swiping up — grow taller
    var px = _dragAct.h0 - dy;
    var vh = Math.min(92, px / window.innerHeight * 100);
    dr.style.maxHeight = vh + 'vh';
    dr.style.transform = '';
  }
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', function() {
  if (!_dragAct.on) return;
  _dragAct.on = false;
  var dr = document.getElementById('activity-drawer');
  var dy = _dragAct.yNow - _dragAct.y0;
  if (dy > 80) {
    // Close
    dr.style.transition = '';
    dr.style.transform = '';
    toggleActivityDrawer();
  } else {
    // Snap — keep the new height, clear transform
    dr.style.transform = '';
    dr.style.transition = '';
  }
});
