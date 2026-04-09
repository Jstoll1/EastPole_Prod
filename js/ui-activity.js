// ── Activity / Live Feed Drawer ───────────────────────────
// Shows hole-by-hole updates for the current user's golfers.
// Persisted to localStorage so feed survives refreshes.

var ACTIVITY_LOG = [];
var MAX_ACTIVITY = 300;
var _actOpen = false;
var _actUnseen = 0;
var _roundLive = false;
var _h2hLiveOpponent = null; // entry object of H2H opponent
var _h2hLiveMyIdx = -1; // my entry index for H2H
var _liveFilterVal = 'all'; // 'all' | 'field' | entry index (string). Source of truth for the live feed filter.
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
  var el = document.getElementById('live-entry-chips');
  if (!el) return;
  var hasTeams = currentUserTeams && currentUserTeams.length > 0;
  el.classList.toggle('multi', hasTeams && currentUserTeams.length > 1);

  // Normalize _liveFilterVal in case teams have changed
  if (!hasTeams) {
    _liveFilterVal = 'field';
  } else if (_liveFilterVal !== 'all' && _liveFilterVal !== 'field') {
    var idx = parseInt(_liveFilterVal);
    if (isNaN(idx) || idx < 0 || idx >= currentUserTeams.length) {
      // Default: active entry if set, else first entry
      _liveFilterVal = (activeTeamIdx >= 0 && currentUserTeams[activeTeamIdx]) ? String(activeTeamIdx) : '0';
    }
  }

  var html = '';
  if (hasTeams) {
    // Compute pool ranks once for this render
    var ranked = getRanked();
    var rnkMap = {}; var rk = 1;
    ranked.forEach(function(re, ri) {
      if (ri > 0 && ranked[ri].total !== ranked[ri-1].total) rk = ri + 1;
      rnkMap[re.team + '|' + re.email] = rk;
    });

    currentUserTeams.forEach(function(t, i) {
      var c = calcEntry(t);
      var myRk = rnkMap[t.team + '|' + t.email] || 0;
      var isActive = _liveFilterVal === String(i);
      html += '<div class="live-entry-chip' + (isActive ? ' active' : '') + '" onclick="setLiveFilter(\'' + i + '\')">'
        + '<span class="lec-rank">' + (myRk ? ordinal(myRk) : '—') + '</span>'
        + '<span class="lec-name">' + escHtml(t.team) + '</span>'
        + '<span class="lec-score ' + cls(c.total) + '">' + fmtTeam(c.total) + '</span>'
        + '</div>';
    });

    // Secondary toggles row: "All Mine" (multi-entry only) + "Field" + H2H
    var h2hActive = !!_h2hLiveOpponent;
    var h2hLabel = h2hActive ? '⚔️ vs ' + escHtml(_h2hLiveOpponent.team) : '⚔️ H2H';
    html += '<div class="live-entry-toggles">';
    if (currentUserTeams.length > 1) {
      html += '<button class="lec-pill' + (_liveFilterVal === 'all' ? ' active' : '') + '" onclick="setLiveFilter(\'all\')">All Mine</button>';
    }
    html += '<button class="lec-pill' + (_liveFilterVal === 'field' ? ' active' : '') + '" onclick="setLiveFilter(\'field\')">Field</button>';
    html += '<button id="h2h-live-btn" class="lec-pill lec-pill-h2h' + (h2hActive ? ' active' : '') + '" onclick="openH2HLivePicker()">' + h2hLabel + '</button>';
    html += '</div>';
  } else {
    html += '<div class="live-entry-chip field-only"><span class="lec-name">Entire Field</span></div>';
  }

  el.innerHTML = html;
}

function setLiveFilter(val) {
  _liveFilterVal = String(val);
  // Clear any active H2H overlay when switching filters
  _h2hLiveOpponent = null;
  var btn = document.getElementById('h2h-live-btn');
  if (btn) { btn.textContent = '⚔️ H2H'; btn.classList.remove('active'); }
  if (val !== 'all' && val !== 'field') trackEvent('live-filter-entry');
  populateLiveEntryFilter();
  renderActivityList();
}

function getLiveFilteredPicks() {
  var val = _liveFilterVal;
  if (val === 'field') return null; // null = entire field
  if (_h2hLiveOpponent) {
    // Union of my entry picks + opponent picks
    var myEntry = currentUserTeams[_h2hLiveMyIdx] || currentUserTeams[0];
    var all = new Set(myEntry.picks.concat(_h2hLiveOpponent.picks));
    return all;
  }
  if (val !== 'all' && currentUserTeams && currentUserTeams[parseInt(val)]) {
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

  // Refresh the entry chips (rank + total) so they track live score changes
  populateLiveEntryFilter();

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

  // Team / H2H live header
  var feedHdr = '';
  var filterVal = _liveFilterVal;
  var isH2H = !!_h2hLiveOpponent;
  var myH2HPicks = null, oppH2HPicks = null;
  if (isH2H) {
    var myEntry = currentUserTeams[_h2hLiveMyIdx] || currentUserTeams[0];
    feedHdr = buildH2HLiveHeader(myEntry, _h2hLiveOpponent);
    myH2HPicks = new Set(myEntry.picks);
    oppH2HPicks = new Set(_h2hLiveOpponent.picks);
  } else if (filterVal !== 'field' && filterVal !== 'all' && currentUserTeams[parseInt(filterVal)]) {
    feedHdr = buildTeamLiveHeader(currentUserTeams[parseInt(filterVal)]);
  } else if (filterVal === 'all' && currentUserTeams.length === 1) {
    feedHdr = buildTeamLiveHeader(currentUserTeams[0]);
  }

  el.innerHTML = feedHdr + items.map(function(a) {
    var typeCls = a.type ? ' act-' + a.type : '';
    var teamTag = '';
    if (isH2H && a.player) {
      var isMine = myH2HPicks.has(a.player);
      var isTheirs = oppH2HPicks.has(a.player);
      if (isMine && isTheirs) teamTag = ' act-shared';
      else if (isMine) teamTag = ' act-mine';
      else if (isTheirs) teamTag = ' act-theirs';
    }
    var ownE = a.player && OWNERSHIP_DATA ? OWNERSHIP_DATA.find(function(o) { return o.player === a.player; }) : null;
    var ownTag = ownE ? ' <span class="act-own">' + Math.round(ownE.pct * 100) + '%</span>' : '';
    var escapedPlayer = a.player.replace(/'/g, "\\'");
    return '<div class="act-item' + typeCls + teamTag + '" onclick="openScorecardPopup(\'' + escapedPlayer + '\')" style="cursor:pointer">' +
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

// ── H2H Live Mode ──
function openH2HLivePicker() {
  // If H2H is active, toggle it off
  if (_h2hLiveOpponent) {
    _h2hLiveOpponent = null;
    populateLiveEntryFilter();
    renderActivityList();
    return;
  }
  var existing = document.getElementById('h2h-live-picker');
  if (existing) existing.remove();
  var popup = document.createElement('div');
  popup.id = 'h2h-live-picker';
  popup.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);max-width:300px;width:85%;left:50%;top:50%;transform:translate(-50%,-50%);max-height:70vh;overflow-y:auto;';
  var ranked = getRanked();
  var rnkMap = {}; var rk = 1;
  ranked.forEach(function(re, ri) { if (ri > 0 && ranked[ri].total !== ranked[ri-1].total) rk = ri + 1; rnkMap[re.team + '|' + re.email] = rk; });
  var html = '<div style="font-size:12px;font-weight:800;color:var(--gold);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">⚔️ Pick Your Opponent</div>';
  // If user has multiple entries, let them pick which of their entries
  if (currentUserTeams.length > 1) {
    html += '<div style="font-size:9px;font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase">Your Entry</div>';
    currentUserTeams.forEach(function(t, i) {
      var c = calcEntry(t);
      var myRk = rnkMap[t.team + '|' + t.email] || '';
      html += '<div class="h2h-picker-row" onclick="selectH2HLiveMy(' + i + ')" style="cursor:pointer">'
        + '<span class="h2h-picker-rank">' + myRk + '</span>'
        + '<span class="h2h-picker-team">' + escHtml(t.team) + '</span>'
        + '<span class="h2h-picker-score ' + cls(c.total) + '">' + fmtTeam(c.total) + '</span></div>';
    });
    html += '<div style="height:1px;background:var(--border);margin:8px 0;"></div>';
  }
  html += '<div style="font-size:9px;font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase">Choose Opponent</div>';
  html += '<input id="h2h-live-search" type="text" placeholder="Search..." style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;margin-bottom:8px;outline:none;" oninput="filterH2HLivePicker()">';
  html += '<div id="h2h-live-list">' + buildH2HLiveList('') + '</div>';
  popup.innerHTML = html;
  document.body.appendChild(popup);
  var backdrop = document.createElement('div');
  backdrop.id = 'h2h-live-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.4);';
  backdrop.onclick = function() { cancelH2HLivePicker(); };
  document.body.appendChild(backdrop);
}

function buildH2HLiveList(query) {
  var ranked = getRanked();
  var q = query.toLowerCase();
  var myEmails = new Set(currentUserTeams.map(function(t) { return t.email; }));
  var html = '';
  var rk = 1;
  ranked.forEach(function(e, i) {
    if (i > 0 && ranked[i].total !== ranked[i-1].total) rk = i + 1;
    if (myEmails.has(e.email)) return;
    if (q && e.team.toLowerCase().indexOf(q) === -1 && e.name.toLowerCase().indexOf(q) === -1) return;
    var entryIdx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
    html += '<div class="h2h-picker-row" onclick="selectH2HLiveOpponent(' + entryIdx + ')" style="cursor:pointer">'
      + '<span class="h2h-picker-rank">' + rk + '</span>'
      + '<span class="h2h-picker-team">' + escHtml(e.team) + '</span>'
      + '<span class="h2h-picker-score ' + cls(e.total) + '">' + fmtTeam(e.total) + '</span></div>';
  });
  return html || '<div style="color:var(--text3);font-size:11px;padding:8px">No matches</div>';
}

function filterH2HLivePicker() {
  var q = (document.getElementById('h2h-live-search') || {}).value || '';
  var list = document.getElementById('h2h-live-list');
  if (list) list.innerHTML = buildH2HLiveList(q);
}

function selectH2HLiveMy(teamIdx) {
  _h2hLiveMyIdx = teamIdx;
  // Highlight selected, keep picker open for opponent selection
  var rows = document.querySelectorAll('#h2h-live-picker .h2h-picker-row');
  rows.forEach(function(r) { r.style.background = ''; });
  // Find the row for this team
  var t = currentUserTeams[teamIdx];
  if (t) {
    rows.forEach(function(r) {
      if (r.querySelector('.h2h-picker-team') && r.querySelector('.h2h-picker-team').textContent === t.team) {
        r.style.background = 'var(--gold-bg)';
      }
    });
  }
}

function selectH2HLiveOpponent(entryIdx) {
  var opp = ENTRIES[entryIdx];
  if (!opp) return;
  _h2hLiveOpponent = opp;
  // If user only has one entry, auto-select it
  if (currentUserTeams.length === 1) _h2hLiveMyIdx = 0;
  // If multi-entry and none selected, use first
  if (_h2hLiveMyIdx < 0) _h2hLiveMyIdx = 0;
  // Close picker
  var p = document.getElementById('h2h-live-picker');
  var b = document.getElementById('h2h-live-backdrop');
  if (p) p.remove();
  if (b) b.remove();
  populateLiveEntryFilter();
  renderActivityList();
}

function cancelH2HLivePicker() {
  var p = document.getElementById('h2h-live-picker');
  var b = document.getElementById('h2h-live-backdrop');
  if (p) p.remove();
  if (b) b.remove();
  _h2hLiveOpponent = null;
  populateLiveEntryFilter();
  renderActivityList();
}

function buildTeamLiveHeader(entry) {
  var c = calcEntry(entry);
  var ranked = getRanked();
  var rk = 1;
  ranked.forEach(function(re, ri) {
    if (ri > 0 && ranked[ri].total !== ranked[ri-1].total) rk = ri + 1;
    if (re.team === entry.team && re.email === entry.email) rk = rk;
  });
  // Find rank
  var myRank = '';
  var rkNum = 1;
  for (var i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i].total !== ranked[i-1].total) rkNum = i + 1;
    if (ranked[i].team === entry.team && ranked[i].email === entry.email) { myRank = rkNum; break; }
  }
  var teamToday = 0;
  c.top4.forEach(function(g) {
    var gd = GOLFER_SCORES[g.name];
    if (gd && (gd.score === 11 || gd.score === 12)) return;
    var td = gd ? gd.todayDisplay : null;
    if (td && td !== '—') teamToday += td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0;
  });
  var todayFmt = teamToday > 0 ? '+' + teamToday : teamToday === 0 ? 'E' : '' + teamToday;
  var todayCls = teamToday < 0 ? 'neg' : teamToday > 0 ? 'pos' : 'eve';

  var html = '<div style="padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:8px;border:1px solid rgba(212,168,67,0.15)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<div><div style="font-size:12px;font-weight:800;color:var(--gold);letter-spacing:0.5px">' + escHtml(entry.team) + '</div>';
  html += '<div style="font-size:9px;color:var(--text3);margin-top:1px">' + ordinal(myRank) + ' place · Today: <span class="' + todayCls + '">' + todayFmt + '</span></div></div>';
  html += '<div style="font-size:24px;font-weight:900" class="' + cls(c.total) + '">' + fmtTeam(c.total) + '</div>';
  html += '</div>';
  // Top 4 golfers in a grid
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px">';
  c.top4.forEach(function(g) {
    var gd = GOLFER_SCORES[g.name];
    var flag = FLAGS[g.name] || '';
    var td = gd ? gd.todayDisplay : '—';
    if (gd && (gd.score === 11 || gd.score === 12)) td = '—';
    var tdCls = td === '—' ? '' : (parseInt(td) < 0 ? 'neg' : parseInt(td) > 0 ? 'pos' : 'eve');
    var isMc = g.score === 11 || g.score === 12;
    var thru = gd ? gd.thru : '—';
    var lastName = g.name.split(' ').pop();
    html += '<div style="display:flex;align-items:center;gap:3px">';
    html += '<span style="font-size:9px">' + flag + '</span>';
    html += '<span style="font-size:10px;font-weight:700;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lastName + '</span>';
    html += '<span style="font-size:9px;font-weight:800" class="' + (isMc ? 'mc' : cls(g.score)) + '">' + fmt(g.score) + '</span>';
    if (td !== '—') html += '<span style="font-size:8px;font-weight:700" class="' + tdCls + '">(' + td + ')</span>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

function ordinal(n) {
  if (!n) return '';
  var s = ['th','st','nd','rd'];
  var v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildH2HLiveHeader(myEntry, oppEntry) {
  var cA = calcEntry(myEntry);
  var cB = calcEntry(oppEntry);
  var diff = cA.total - cB.total;
  var diffStr = diff === 0 ? 'TIED' : (Math.abs(diff) + (diff < 0 ? ' ahead' : ' behind'));
  var diffCls = diff < 0 ? 'neg' : diff > 0 ? 'pos' : 'eve';

  function buildSide(entry, calc, align) {
    var html = '<div style="flex:1;text-align:' + align + '">';
    html += '<div style="font-size:10px;font-weight:800;color:var(--gold);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px">' + escHtml(entry.team) + '</div>';
    html += '<div style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:6px" class="' + cls(calc.total) + '">' + fmtTeam(calc.total) + '</div>';
    // Show top 4 players
    calc.top4.forEach(function(g) {
      var gd = GOLFER_SCORES[g.name];
      var flag = FLAGS[g.name] || '';
      var thru = gd ? gd.thru : '—';
      var td = gd ? gd.todayDisplay : '—';
      if (gd && (gd.score === 11 || gd.score === 12)) td = '—';
      var tdCls = td === '—' ? '' : (parseInt(td) < 0 ? 'neg' : parseInt(td) > 0 ? 'pos' : 'eve');
      var isMc = g.score === 11 || g.score === 12;
      var lastName = g.name.split(' ').pop();
      html += '<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px;justify-content:' + (align === 'left' ? 'flex-start' : 'flex-end') + '">';
      if (align === 'left') {
        html += '<span style="font-size:10px">' + flag + '</span>';
        html += '<span style="font-size:10px;font-weight:700;color:var(--text)">' + lastName + '</span>';
        html += '<span style="font-size:9px;font-weight:800" class="' + (isMc ? 'mc' : cls(g.score)) + '">' + fmt(g.score) + '</span>';
        if (td !== '—') html += '<span style="font-size:8px;font-weight:700" class="' + tdCls + '">(' + td + ')</span>';
      } else {
        if (td !== '—') html += '<span style="font-size:8px;font-weight:700" class="' + tdCls + '">(' + td + ')</span>';
        html += '<span style="font-size:9px;font-weight:800" class="' + (isMc ? 'mc' : cls(g.score)) + '">' + fmt(g.score) + '</span>';
        html += '<span style="font-size:10px;font-weight:700;color:var(--text)">' + lastName + '</span>';
        html += '<span style="font-size:10px">' + flag + '</span>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  var html = '<div class="h2h-live-hdr" style="display:flex;gap:8px;padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:8px;border:1px solid rgba(212,168,67,0.15)">';
  html += buildSide(myEntry, cA, 'left');
  html += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:40px">';
  html += '<div style="font-size:8px;font-weight:800;color:var(--text3);letter-spacing:0.5px">VS</div>';
  html += '<div style="font-size:9px;font-weight:800;margin-top:2px" class="' + diffCls + '">' + diffStr + '</div>';
  html += '</div>';
  html += buildSide(oppEntry, cB, 'right');
  html += '</div>';
  return html;
}

// Swipe to resize / close drawer
var _dragAct = { on: false, y0: 0, yNow: 0, h0: 0, fromList: false };

function actDragStart(e) {
  if (!_actOpen) return;
  _dragAct.on = true;
  _dragAct.fromList = false;
  _dragAct.y0 = e.touches[0].clientY;
  _dragAct.yNow = _dragAct.y0;
  var dr = document.getElementById('activity-drawer');
  _dragAct.h0 = dr.offsetHeight;
  dr.style.transition = 'none';
}

// Allow swipe-down from list when scrolled to top
(function() {
  var listEl = null;
  var startY = 0;
  var tracking = false;

  document.addEventListener('touchstart', function(e) {
    listEl = document.getElementById('act-list');
    if (!listEl || !_actOpen) return;
    if (!listEl.contains(e.target)) return;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!tracking || !listEl || _dragAct.on) return;
    if (listEl.scrollTop > 0) return; // not at top, let it scroll
    var dy = e.touches[0].clientY - startY;
    if (dy > 10) {
      // Scrolled to top and swiping down — start drag
      tracking = false;
      _dragAct.on = true;
      _dragAct.fromList = true;
      _dragAct.y0 = e.touches[0].clientY;
      _dragAct.yNow = _dragAct.y0;
      var dr = document.getElementById('activity-drawer');
      _dragAct.h0 = dr.offsetHeight;
      dr.style.transition = 'none';
    }
  }, { passive: true });

  document.addEventListener('touchend', function() {
    tracking = false;
  }, { passive: true });
})();

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
