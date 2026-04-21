// ── East Pole Terminal — Desktop Bloomberg-style ──────────

// Diagnostic log — hidden by default, toggled by triple-clicking REFRESH
var _termDebugMode = false;
var _termDebugLog = [];
function termDiag(msg, isError) {
  var entry = { time: new Date().toTimeString().substring(0,8), msg: msg, isError: isError };
  _termDebugLog.push(entry);
  if (_termDebugLog.length > 100) _termDebugLog.shift();
  if (_termDebugMode) _renderDebugPanel();
}
function _renderDebugPanel() {
  var el = document.getElementById('term-diag');
  if (!_termDebugMode) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'term-diag';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#000;color:#d4a843;padding:6px 12px;font-family:monospace;font-size:10px;z-index:9999;border-top:1px solid #d4a843;max-height:200px;overflow:auto;';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;position:sticky;top:0;background:#000;padding-bottom:4px"><strong style="color:#f5c518">DEBUG</strong><button onclick="toggleTermDebug()" style="background:transparent;border:1px solid #d4a843;color:#d4a843;font-family:inherit;font-size:9px;padding:2px 8px;cursor:pointer">CLOSE</button></div>'
    + _termDebugLog.map(function(e) {
      return '<div style="color:' + (e.isError ? '#ff6b6b' : '#d4a843') + '">' + e.time + ' ' + e.msg + '</div>';
    }).join('');
  el.scrollTop = el.scrollHeight;
}
function toggleTermDebug() {
  _termDebugMode = !_termDebugMode;
  _renderDebugPanel();
}
var _refreshClicks = [];
function handleRefreshClick() {
  var now = Date.now();
  _refreshClicks.push(now);
  // Keep only clicks within last 800ms
  _refreshClicks = _refreshClicks.filter(function(t) { return now - t < 800; });
  if (_refreshClicks.length >= 3) {
    _refreshClicks = [];
    toggleTermDebug();
  } else {
    termRefresh();
  }
}

// Mobile redirect
if (window.innerWidth < 1024) {
  window.location.href = './index.html';
}

// Stubs for functions/globals from mobile-only modules that api.js references
if (typeof renderAll === 'undefined') window.renderAll = function() {};
if (typeof _tickerMode === 'undefined') window._tickerMode = 'entries';
if (typeof showToast === 'undefined') window.showToast = function() {};
// ui-activity.js provides this on mobile; stub so fetchESPN doesn't throw
if (typeof detectGolfActivity === 'undefined') window.detectGolfActivity = async function() { return; };
// ui-standings.js provides this; stub for terminal
if (typeof detectEntryActivity === 'undefined') window.detectEntryActivity = function() {};

var _termLastUpdate = 0;

// ── Table sort + column resize ─────────────────────────
// Panel-keyed sort state; each render function applies the current col/dir.
var _sortState = {
  'panel-leaderboard': { col: 'score', dir: 'asc' },
  'panel-standings':   { col: 'rank',  dir: 'asc' },
  'panel-datagolf':    { col: 'win',   dir: 'desc' }
};
var _colWidths = {};
try { _colWidths = JSON.parse(localStorage.getItem('term_col_widths') || '{}'); } catch(e) {}

function _saveColWidths() {
  try { localStorage.setItem('term_col_widths', JSON.stringify(_colWidths)); } catch(e) {}
}

function sortRowsBy(rows, col, dir, accessors) {
  var get = accessors[col];
  if (!get) return rows;
  var sign = dir === 'desc' ? -1 : 1;
  return rows.slice().sort(function(a, b) {
    var va = get(a), vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;   // nulls always last
    if (vb == null) return -1;
    if (typeof va === 'string' || typeof vb === 'string') return sign * String(va).localeCompare(String(vb));
    return sign * (va - vb);
  });
}

function updateSortIndicators(panelId) {
  var st = _sortState[panelId];
  if (!st) return;
  var panel = document.getElementById(panelId);
  if (!panel) return;
  panel.querySelectorAll('thead th[data-col]').forEach(function(th) {
    var hit = th.getAttribute('data-col') === st.col;
    th.classList.toggle('sort-asc', hit && st.dir === 'asc');
    th.classList.toggle('sort-desc', hit && st.dir === 'desc');
  });
}

function initTableFeatures() {
  document.querySelectorAll('.term-panel .tp-table').forEach(function(table) {
    var panel = table.closest('.term-panel');
    if (!panel) return;
    var panelId = panel.id;
    var ths = table.querySelectorAll('thead th[data-col]');

    // Apply saved widths
    ths.forEach(function(th) {
      var key = panelId + ':' + th.getAttribute('data-col');
      if (_colWidths[key]) th.style.width = _colWidths[key] + 'px';
    });

    ths.forEach(function(th, i) {
      // Sort click (ignored while resizing / just after a resize drag)
      th.addEventListener('click', function() {
        if (th._suppressClick) return;
        var col = th.getAttribute('data-col');
        var st = _sortState[panelId];
        if (!st) return;
        if (st.col === col) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
        else { st.col = col; st.dir = 'asc'; }
        renderTerminal();
      });

      // Resize handle on every column except the last one
      if (i === ths.length - 1) return;
      var handle = document.createElement('span');
      handle.className = 'col-resize';
      th.appendChild(handle);
      handle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        th._suppressClick = true;
        var startX = e.pageX;
        var startW = th.offsetWidth;
        function onMove(ev) {
          var w = Math.max(30, startW + (ev.pageX - startX));
          th.style.width = w + 'px';
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          var key = panelId + ':' + th.getAttribute('data-col');
          _colWidths[key] = th.offsetWidth;
          _saveColWidths();
          setTimeout(function() { th._suppressClick = false; }, 50);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  });
  Object.keys(_sortState).forEach(updateSortIndicators);
}

function termToast(msg) {
  var t = document.getElementById('term-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(termToast._t);
  termToast._t = setTimeout(function() { t.classList.remove('show'); }, 2000);
}

async function termRefresh() {
  termToast('REFRESHING...');
  await fetchESPN();
  renderTerminal();
  _termLastUpdate = Date.now();
  updateStatusBar();
}

function updateClock() {
  var el = document.getElementById('tsb-time');
  if (el) {
    var d = new Date();
    el.textContent = d.toTimeString().substring(0, 8);
  }
}

function updateStatusBar() {
  var name = document.getElementById('tsb-tourney');
  var round = document.getElementById('tsb-round');
  var status = document.getElementById('tsb-status');
  var updated = document.getElementById('tsb-updated');

  if (name) name.textContent = (typeof TOURNEY_NAME !== 'undefined' && TOURNEY_NAME) ? TOURNEY_NAME.toUpperCase() : '—';
  if (round) round.textContent = 'R' + (typeof ESPN_ROUND !== 'undefined' ? ESPN_ROUND || '—' : '—');
  if (status) {
    var s = 'LIVE';
    if (typeof TOURNEY_FINAL !== 'undefined' && TOURNEY_FINAL) s = 'FINAL';
    else if (typeof TOURNAMENT_STARTED !== 'undefined' && !TOURNAMENT_STARTED) { s = 'SCHEDULED'; status.className = 'scheduled'; }
    status.textContent = s;
  }
  if (updated && _termLastUpdate) {
    var secs = Math.floor((Date.now() - _termLastUpdate) / 1000);
    updated.textContent = secs < 60 ? secs + 's ago' : Math.floor(secs / 60) + 'm ago';
  }
}

// ── Helpers ────────────────────────────────────────────

function fmtScore(s) {
  if (s == null) return '—';
  if (s === 0) return 'E';
  return s > 0 ? '+' + s : String(s);
}
function scoreCls(s) {
  if (s == null) return 'eve';
  if (s < 0) return 'pos';  // under par is GOOD
  if (s > 0) return 'neg';  // over par is BAD
  return 'eve';
}
function termEsc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function lastName(n) {
  if (!n) return '';
  var parts = n.split(' ');
  return parts[parts.length - 1];
}

// ── Render Leaderboard ─────────────────────────────────

function renderTermLeaderboard() {
  var body = document.getElementById('term-lb-body');
  if (!body) return;
  var names = Object.keys(GOLFER_SCORES || {});
  if (!names.length) { body.innerHTML = '<tr><td colspan="5" class="empty">Loading field…</td></tr>'; return; }

  var players = names.map(function(n) {
    var g = GOLFER_SCORES[n];
    return {
      name: n, pos: g.pos, score: g.score, today: g.todayDisplay, thru: g.thru, teeTime: g.teeTime,
      r1: g.r1, r2: g.r2, r3: g.r3, r4: g.r4, roundCount: g.roundCount,
      mc: g.score === 11, wd: g.score === 12
    };
  });

  var lbSort = _sortState['panel-leaderboard'];
  var lbAccessors = {
    pos:   function(p) { return p.mc || p.wd ? 9999 : (parsePos(p.pos) || 9999); },
    name:  function(p) { return p.name; },
    score: function(p) { return p.mc || p.wd ? (lbSort.dir === 'desc' ? -Infinity : Infinity) : p.score; },
    today: function(p) { var t = p.today; return t === 'E' ? 0 : (parseInt(String(t).replace('+','')) || 0); },
    thru:  function(p) { return String(p.thru || ''); }
  };
  players = sortRowsBy(players, lbSort.col, lbSort.dir, lbAccessors);
  updateSortIndicators('panel-leaderboard');

  // Get pool pick names
  var poolNames = new Set();
  (ENTRIES || []).forEach(function(e) { e.picks.forEach(function(p) { poolNames.add(p); }); });

  var isPlayoff = ESPN_ROUND > 4 || players.some(function(p) { return p.roundCount >= 5; });

  body.innerHTML = players.slice(0, 80).map(function(p) {
    var posDisp = p.mc ? 'MC' : p.wd ? 'WD' : (p.pos || '—');
    var scoreDisp = (p.mc || p.wd) ? '—' : fmtScore(p.score);
    var scoreCl = (p.mc || p.wd) ? 'mc' : scoreCls(p.score);
    var todayDisp = (p.mc || p.wd) ? '—' : (p.today || '—');
    var todayVal = todayDisp === 'E' ? 0 : parseInt(todayDisp.replace('+', '')) || 0;
    var todayCl = todayDisp === '—' ? '' : scoreCls(todayVal);
    var playerInPlayoff = isPlayoff && p.roundCount >= 5;
    var lastRoundScore = (function(){ var rs = [p.r1,p.r2,p.r3,p.r4]; for(var i=rs.length-1;i>=0;i--){ if(rs[i]&&rs[i]>50) return rs[i]; } return null; })();
    var thruDisp;
    if (p.mc || p.wd) {
      thruDisp = '';
    } else if (playerInPlayoff && lastRoundScore) {
      thruDisp = lastRoundScore + '*';
    } else if (p.thru === 'F' || p.thru === '18') {
      thruDisp = lastRoundScore || 'F';
    } else if (p.thru && p.thru.includes(':')) {
      thruDisp = p.thru;
    } else if (p.thru === '—' && p.teeTime && typeof p.teeTime === 'string' && p.teeTime.indexOf('T') !== -1) {
      try {
        var d = new Date(p.teeTime);
        thruDisp = !isNaN(d.getTime()) ? d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '—';
      } catch(e){ thruDisp = '—'; }
    } else {
      thruDisp = p.thru || '—';
    }
    var flag = (FLAGS && FLAGS[p.name]) || '';
    var mine = (typeof currentUserTeams !== 'undefined' && currentUserTeams.some(function(t) { return t.picks.indexOf(p.name) !== -1; }));
    var inPool = poolNames.has(p.name);
    var rowCls = mine ? 'is-mine' : '';
    var escapedName = p.name.replace(/'/g, "\\'");
    return '<tr class="' + rowCls + '" onclick="toggleTermScorecard(\'' + escapedName + '\', this)" style="cursor:pointer">'
      + '<td class="tpt-pos">' + termEsc(posDisp) + '</td>'
      + '<td class="tpt-name">' + flag + ' ' + termEsc(p.name) + (inPool ? ' <span style="color:var(--term-text-muted);font-size:9px">●</span>' : '') + '</td>'
      + '<td class="tpt-score ' + scoreCl + '">' + scoreDisp + '</td>'
      + '<td class="tpt-today ' + todayCl + '">' + termEsc(todayDisp) + '</td>'
      + '<td class="tpt-thru">' + termEsc(thruDisp) + '</td>'
      + '</tr>';
  }).join('');

  var meta = document.getElementById('lb-meta');
  if (meta) meta.textContent = players.length + ' players';
}

// ── Inline Scorecard ──────────────────────────────────

var _termOpenCard = null;

async function toggleTermScorecard(playerName, rowEl) {
  // Close existing
  var existing = document.getElementById('term-sc-inline');
  if (existing) existing.remove();
  if (_termOpenCard === playerName) { _termOpenCard = null; return; }
  _termOpenCard = playerName;

  // Insert loading row after clicked row
  var detailRow = document.createElement('tr');
  detailRow.id = 'term-sc-inline';
  detailRow.innerHTML = '<td colspan="5" class="tsc-wrap"><div class="tsc-loading">Loading scorecard…</div></td>';
  rowEl.parentNode.insertBefore(detailRow, rowEl.nextSibling);

  // Fetch data — force DG so a failed piggyback fetch gets retried on open
  delete SCORECARD_CACHE[playerName];
  await Promise.all([fetchCourseHoles(), fetchPlayerScorecard(playerName), fetchDGLivePreds(true)]);

  // Diagnostic: did DG populate?
  var dgKeys = Object.keys(DG_LIVE_PREDS || {});
  var dgHit = dgKeys.indexOf(playerName) !== -1;
  termDiag('DG lookup ' + playerName + ' — keys=' + dgKeys.length + ' hit=' + dgHit, !dgHit);
  if (!dgHit && dgKeys.length) {
    var sample = dgKeys.slice(0, 3).join(' | ');
    termDiag('DG sample names: ' + sample);
  }

  // Check we're still the open card
  if (_termOpenCard !== playerName) return;

  var rounds = SCORECARD_CACHE[playerName];
  var gd = GOLFER_SCORES[playerName];
  var aid = ATHLETE_IDS[playerName];
  var flag = (FLAGS && FLAGS[playerName]) || '';

  var html = '<div class="tsc-header">';
  if (aid) html += '<img class="tsc-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + aid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">';
  html += '<span class="tsc-name">' + flag + ' ' + termEsc(playerName) + '</span>';
  if (gd) html += '<span class="tsc-pos">' + (gd.pos || '') + '</span>';
  html += '<span class="tsc-close" onclick="event.stopPropagation();toggleTermScorecard(\'' + playerName.replace(/'/g, "\\'") + '\')">✕</span>';
  html += '</div>';

  // DataGolf live predictions
  html += buildDGLiveRow(playerName);

  // Round scores
  if (gd) {
    html += '<div class="tsc-rounds">';
    html += '<div class="tsc-chip"><span class="tsc-chip-lbl">TOT</span><span class="' + cls(gd.score) + '" style="font-size:14px;font-weight:900">' + fmt(gd.score) + '</span></div>';
    [{l:'R1',v:gd.r1},{l:'R2',v:gd.r2},{l:'R3',v:gd.r3},{l:'R4',v:gd.r4}].forEach(function(r) {
      if (r.v == null) return;
      var tp = r.v - COURSE_PAR;
      html += '<div class="tsc-chip"><span class="tsc-chip-lbl">' + r.l + '</span><span style="font-weight:800">' + r.v + '</span>'
        + '<span class="' + (tp<0?'neg':tp>0?'pos':'eve') + '" style="font-size:9px">' + (tp<0?''+tp:tp>0?'+'+tp:'E') + '</span></div>';
    });
    if (gd.todayDisplay && gd.todayDisplay !== '—') html += '<div class="tsc-chip"><span class="tsc-chip-lbl">TDY</span><span class="' + cls(parseInt(gd.todayDisplay.replace('+',''))||0) + '" style="font-weight:800">' + gd.todayDisplay + '</span></div>';
    html += '</div>';
  }

  // Hole-by-hole
  if (rounds && rounds.length) {
    var roundsWithData = rounds.map(function(r, i) { return { round: r, idx: i }; }).filter(function(obj) { return obj.round.holes && obj.round.holes.length > 0; });
    var activeRound = roundsWithData.length ? roundsWithData[roundsWithData.length - 1] : null;
    if (activeRound) {
      var r = activeRound.round;
      var holeMap = {};
      r.holes.forEach(function(h) { holeMap[h.hole] = h; });
      html += '<div class="tsc-grid">';
      html += '<div class="sc-nine"><div class="sc-nine-label">OUT</div><div class="sc-row sc-row-hdr">';
      for (var hn=1;hn<=9;hn++) html += '<div class="sc-cell">' + hn + '</div>';
      html += '</div><div class="sc-row sc-row-score">';
      for (var hn=1;hn<=9;hn++) { var hd=holeMap[hn]; var par=getHolePar(hn); var scC=hd&&hd.strokes?scorecardClass(hd.strokes,par):''; html += '<div class="sc-cell ' + scC + '"><span class="sc-num">' + (hd&&hd.strokes?hd.strokes:'–') + '</span></div>'; }
      html += '</div></div>';
      html += '<div class="sc-nine"><div class="sc-nine-label">IN</div><div class="sc-row sc-row-hdr">';
      for (var hn=10;hn<=18;hn++) html += '<div class="sc-cell">' + hn + '</div>';
      html += '</div><div class="sc-row sc-row-score">';
      for (var hn=10;hn<=18;hn++) { var hd=holeMap[hn]; var par=getHolePar(hn); var scC=hd&&hd.strokes?scorecardClass(hd.strokes,par):''; html += '<div class="sc-cell ' + scC + '"><span class="sc-num">' + (hd&&hd.strokes?hd.strokes:'–') + '</span></div>'; }
      html += '</div></div></div>';
    }
  }

  var cell = detailRow.querySelector('.tsc-wrap');
  if (cell) cell.innerHTML = html;
}

// ── Render Standings ───────────────────────────────────

function renderTermStandings() {
  var body = document.getElementById('term-std-body');
  if (!body) return;
  if (!ENTRIES || !ENTRIES.length) { body.innerHTML = '<tr><td colspan="5" class="empty">No entries loaded</td></tr>'; return; }

  var ranked = getRanked();
  var myKey = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '';

  // Precompute row data (rank / isMoney stay tied to original pool ranking)
  var rows = ranked.map(function(e, i) {
    var rank = i + 1;
    var teamHolesLeft = e.top4.reduce(function(s, g) { return s + getHolesRemaining(g.name); }, 0);
    var teamToday = 0, hasToday = false;
    e.top4.forEach(function(g) {
      var gd = GOLFER_SCORES[g.name];
      if (!gd) return;
      if (gd.score === 11 || gd.score === 12) return;
      var td = gd.todayDisplay;
      if (td && td !== '—') { hasToday = true; teamToday += (td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0); }
    });
    return {
      entry: e, rank: rank,
      isMine: e.email === myKey,
      isMoney: rank <= 3,
      total: e.total,
      today: hasToday ? teamToday : null,
      holes: teamHolesLeft
    };
  });

  var stSort = _sortState['panel-standings'];
  var stAccessors = {
    rank:  function(r) { return r.rank; },
    team:  function(r) { return r.entry.team; },
    total: function(r) { return r.total; },
    today: function(r) { return r.today; },
    holes: function(r) { return r.holes; }
  };
  rows = sortRowsBy(rows, stSort.col, stSort.dir, stAccessors);
  updateSortIndicators('panel-standings');

  body.innerHTML = rows.slice(0, 60).map(function(r) {
    var todayDisp = r.today == null ? '—' : fmtScore(r.today);
    var todayCl = r.today == null ? '' : scoreCls(r.today);
    var cls = [r.isMine ? 'is-mine' : '', r.isMoney ? 'is-money' : ''].filter(Boolean).join(' ');
    return '<tr class="' + cls + '">'
      + '<td class="tpt-pos">' + r.rank + '</td>'
      + '<td class="tpt-name">' + termEsc(r.entry.team) + '</td>'
      + '<td class="tpt-score ' + scoreCls(r.total) + '">' + fmtScore(r.total) + '</td>'
      + '<td class="tpt-today ' + todayCl + '">' + termEsc(todayDisp) + '</td>'
      + '<td class="tpt-thru">' + (r.holes > 0 ? r.holes : 'F') + '</td>'
      + '</tr>';
  }).join('');

  var meta = document.getElementById('std-meta');
  if (meta) meta.textContent = ranked.length + ' entries';
}

// ── Render Activity ────────────────────────────────────

function renderTermActivity() {
  var body = document.getElementById('term-act-body');
  if (!body) return;
  var names = Object.keys(GOLFER_SCORES || {});
  var events = [];

  // Pull birdies/eagles/bogies from linescores (simplified — latest rounds)
  names.forEach(function(n) {
    var g = GOLFER_SCORES[n];
    if (!g || g.score === 11 || g.score === 12) return;
    var td = g.todayDisplay;
    if (!td || td === '—' || td === 'E') return;
    var tdVal = parseInt(td.replace('+', '')) || 0;
    events.push({ name: n, today: tdVal, thru: g.thru, pos: g.pos });
  });

  events.sort(function(a, b) { return a.today - b.today; });

  if (!events.length) {
    body.innerHTML = '<div class="empty">No activity yet</div>';
    return;
  }

  body.innerHTML = events.slice(0, 50).map(function(e) {
    var flag = FLAGS && FLAGS[e.name] || '';
    var cls = e.today < -3 ? 'act-eagle' : e.today < 0 ? 'act-birdie' : e.today > 3 ? 'act-double' : 'act-bogey';
    return '<div class="act-row ' + cls + '">'
      + '<div class="act-time">' + termEsc(e.thru || '—') + '</div>'
      + '<div class="act-text">' + flag + ' ' + termEsc(e.name) + ' (#' + termEsc(e.pos) + ')</div>'
      + '<div class="act-score">' + fmtScore(e.today) + '</div>'
      + '</div>';
  }).join('');

  var meta = document.getElementById('act-meta');
  if (meta) meta.textContent = events.length + ' moving';
}

// ── Render My Entries ──────────────────────────────────

function renderTermMy() {
  var body = document.getElementById('term-my-body');
  if (!body) return;
  var teams = (typeof currentUserTeams !== 'undefined') ? currentUserTeams : [];
  if (!teams.length) {
    body.innerHTML = '<div class="empty">Log in on mobile app to link your entries</div>';
    return;
  }

  var ranked = getRanked();
  var rankMap = {};
  ranked.forEach(function(e, i) { rankMap[e.team + '|' + e.email] = i + 1; });

  body.innerHTML = teams.map(function(t) {
    var entry = ranked.find(function(e) { return e.team === t.team && e.email === t.email; });
    if (!entry) return '';
    var rank = rankMap[entry.team + '|' + entry.email];
    var total = entry.total;
    var teamToday = 0, hasToday = false;
    entry.top4.forEach(function(g) {
      var gd = GOLFER_SCORES[g.name];
      if (!gd || gd.score === 11 || gd.score === 12) return;
      var td = gd.todayDisplay;
      if (td && td !== '—') { hasToday = true; teamToday += (td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0); }
    });

    var picks = entry.scores.slice(0, 10).map(function(g, i) {
      var isTop = i < 4;
      var flag = FLAGS && FLAGS[g.name] || '';
      var gd = GOLFER_SCORES[g.name];
      var sc = gd && (gd.score === 11 || gd.score === 12) ? (gd.score === 12 ? 'WD' : 'MC') : fmtScore(g.score);
      var scCl = gd && (gd.score === 11 || gd.score === 12) ? 'mc' : scoreCls(g.score);
      return '<div class="pick ' + (isTop ? 'top' : '') + '">'
        + '<span class="p-name">' + (isTop ? '★ ' : '  ') + flag + ' ' + termEsc(lastName(g.name)) + '</span>'
        + '<span class="p-score ' + scCl + '">' + sc + '</span>'
        + '</div>';
    }).join('');

    return '<div class="my-entry-block">'
      + '<div class="my-entry-header">'
      + '<span class="my-entry-name">' + termEsc(t.team) + '</span>'
      + '<span class="my-entry-rank">#' + rank + ' of ' + ranked.length + '</span>'
      + '</div>'
      + '<div class="my-entry-stats">'
      + '<span><span class="lbl">TOT:</span><span class="' + scoreCls(total) + '">' + fmtScore(total) + '</span></span>'
      + '<span><span class="lbl">TDY:</span><span class="' + scoreCls(teamToday) + '">' + (hasToday ? fmtScore(teamToday) : '—') + '</span></span>'
      + '</div>'
      + '<div class="my-entry-picks">' + picks + '</div>'
      + '</div>';
  }).join('');

  var meta = document.getElementById('my-meta');
  if (meta) meta.textContent = teams.length + ' ' + (teams.length === 1 ? 'entry' : 'entries');
}

// ── Render DataGolf Odds ──────────────────────────────

function renderTermDataGolf() {
  var body = document.getElementById('term-dg-body');
  if (!body) return;
  var dg = (typeof DG_LIVE_PREDS !== 'undefined') ? DG_LIVE_PREDS : {};
  var names = Object.keys(dg);
  if (!names.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Loading DataGolf odds…</td></tr>';
    var metaE = document.getElementById('dg-meta');
    if (metaE) metaE.textContent = '—';
    return;
  }

  var rows = names.map(function(n) {
    var d = dg[n];
    return { name: n, win: d.win || 0, top_5: d.top_5 || 0, top_10: d.top_10 || 0, top_20: d.top_20 || 0, make_cut: d.make_cut || 0 };
  });

  var dgSort = _sortState['panel-datagolf'];
  var dgAccessors = {
    name:     function(r) { return r.name; },
    make_cut: function(r) { return r.make_cut; },
    top_20:   function(r) { return r.top_20; },
    top_10:   function(r) { return r.top_10; },
    top_5:    function(r) { return r.top_5; },
    win:      function(r) { return r.win; }
  };
  rows = sortRowsBy(rows, dgSort.col, dgSort.dir, dgAccessors);
  updateSortIndicators('panel-datagolf');

  function fmtPct(v) {
    var pct = v * 100;
    if (pct <= 0) return '—';
    if (pct < 1) return '<1';
    // Integer for whole values, one decimal otherwise; no % sign (column label implies it)
    return pct >= 99.95 || pct === Math.round(pct) ? String(Math.round(pct)) : pct.toFixed(1);
  }
  function pctCls(v) {
    if (v >= 0.5) return 'dg-hi';
    if (v >= 0.15) return 'dg-mid';
    if (v > 0) return 'dg-lo';
    return 'dg-zero';
  }
  function pctCell(v) {
    var pct = Math.max(0, Math.min(1, v || 0)) * 100;
    var bar = pct > 0
      ? 'background:linear-gradient(to right, rgba(212,168,67,0.28) ' + pct.toFixed(1) + '%, transparent ' + pct.toFixed(1) + '%);'
      : '';
    return '<td class="tpt-dg ' + pctCls(v) + '" style="' + bar + '">' + fmtPct(v) + '</td>';
  }

  body.innerHTML = rows.slice(0, 80).map(function(r) {
    var flag = (FLAGS && FLAGS[r.name]) || '';
    return '<tr>'
      + '<td class="tpt-name">' + flag + ' ' + termEsc(r.name) + '</td>'
      + pctCell(r.make_cut)
      + pctCell(r.top_20)
      + pctCell(r.top_10)
      + pctCell(r.top_5)
      + pctCell(r.win)
      + '</tr>';
  }).join('');

  var meta = document.getElementById('dg-meta');
  if (meta) meta.textContent = rows.length + ' players';
}

// ── Render Threat Board ───────────────────────────────

function renderTermThreat() {
  var body = document.getElementById('term-thr-body');
  if (!body) return;
  if (!ENTRIES || !ENTRIES.length) { body.innerHTML = '<div class="empty">No entries loaded</div>'; return; }

  var ranked = getRanked();
  // Show top 20 with gap to leader
  var leader = ranked[0];
  if (!leader) { body.innerHTML = '<div class="empty">No leader yet</div>'; return; }

  body.innerHTML = ranked.slice(0, 30).map(function(e, i) {
    var gap = e.total - leader.total;
    var gapDisp = i === 0 ? 'LEADER' : (gap > 0 ? '+' + gap : String(gap));
    return '<div class="threat-row">'
      + '<div class="threat-rank">' + (i + 1) + '</div>'
      + '<div class="threat-name">' + termEsc(e.team) + '</div>'
      + '<div class="threat-gap">' + gapDisp + '</div>'
      + '</div>';
  }).join('');

  var meta = document.getElementById('thr-meta');
  if (meta) meta.textContent = 'Δ from leader';
}

// ── Render Ticker ─────────────────────────────────────

function renderTermTicker() {
  var el = document.getElementById('tt-content');
  if (!el) return;
  var names = Object.keys(GOLFER_SCORES || {});
  if (!names.length) { el.textContent = ' LOADING LIVE DATA… '; return; }

  var items = names
    .map(function(n) {
      var g = GOLFER_SCORES[n];
      if (!g || g.score === 11 || g.score === 12) return null;
      return { name: n, pos: g.pos, score: g.score };
    })
    .filter(Boolean)
    .sort(function(a, b) { return a.score - b.score; })
    .slice(0, 40);

  var html = items.map(function(p) {
    return '<span class="tt-item">'
      + '<span class="pos">' + termEsc(p.pos || '-') + '</span>'
      + termEsc(p.name) + ' '
      + '<span class="' + (p.score < 0 ? 'pos-score' : p.score > 0 ? 'neg' : 'eve') + '">' + fmtScore(p.score) + '</span>'
      + '</span>';
  }).join('');
  // Double for seamless scroll
  el.innerHTML = html + html;
}

// ── Master Render ────────────────────────────────────

function renderTerminal() {
  try { renderTermLeaderboard(); } catch(e) { console.error('LB error', e); }
  try { renderTermStandings(); } catch(e) { console.error('STD error', e); }
  try { renderTermActivity(); } catch(e) { console.error('ACT error', e); }
  try { renderTermMy(); } catch(e) { console.error('MY error', e); }
  try { renderTermDataGolf(); } catch(e) { console.error('DG error', e); }
  try { renderTermTicker(); } catch(e) { console.error('TICKER error', e); }
  updateStatusBar();
}

// Override renderAll from app.js to hit terminal too
window.renderAll = renderTerminal;

// ── Init ─────────────────────────────────────────────

async function initTerminal() {
  termDiag('initTerminal started');
  termDiag('Globals: ENTRIES=' + (typeof ENTRIES !== 'undefined' ? ENTRIES.length : 'UNDEF')
    + ', FLAGS=' + (typeof FLAGS !== 'undefined' ? Object.keys(FLAGS).length : 'UNDEF')
    + ', fetchESPN=' + typeof fetchESPN
    + ', getRanked=' + typeof getRanked);

  updateClock();
  setInterval(updateClock, 1000);
  setInterval(updateStatusBar, 10000);

  // Load user from localStorage (same key as mobile)
  var userData = localStorage.getItem('eastpole_v2');
  if (userData) {
    try {
      var parsed = JSON.parse(userData);
      window.currentUserEmail = parsed.email || null;
      window.activeTeamIdx = parsed.activeTeamIdx == null ? -1 : parsed.activeTeamIdx;
      window.currentUserTeams = (ENTRIES || []).filter(function(e) { return e.email === currentUserEmail; });
    } catch(e) {}
  }
  if (typeof currentUserEmail === 'undefined') window.currentUserEmail = null;
  if (typeof currentUserTeams === 'undefined') window.currentUserTeams = [];
  if (typeof activeTeamIdx === 'undefined') window.activeTeamIdx = -1;

  // Render empty state immediately so user sees the panels
  try {
    renderTerminal();
    termDiag('Empty render complete');
  } catch(e) {
    termDiag('Empty render FAILED: ' + e.message, true);
  }
  updateStatusBar();
  initTableFeatures();

  // Initial fetch
  try {
    termDiag('Calling fetchESPN...');
    await fetchESPN();
    // Await DG so the F5 odds panel populates on first paint instead of waiting for the next auto-refresh
    await fetchDGLivePreds(true);
    var count = Object.keys(GOLFER_SCORES || {}).length;
    termDiag('fetchESPN done. Golfers: ' + count + ', Tourney: ' + (typeof TOURNEY_NAME !== 'undefined' ? TOURNEY_NAME : 'UNDEF'));
    // Dump first 3 players' raw data
    var samples = Object.keys(GOLFER_SCORES || {}).slice(0, 3);
    samples.forEach(function(n) {
      var g = GOLFER_SCORES[n];
      termDiag(n + ': pos=' + g.pos + ' score=' + g.score + ' today=' + g.todayDisplay + ' thru=' + g.thru + ' tee=' + g.teeTime + ' rc=' + g.roundCount);
    });
    _termLastUpdate = Date.now();
    renderTerminal();
    termDiag('Data render complete');
  } catch(e) {
    termDiag('fetchESPN FAILED: ' + e.message, true);
    termDiag('Stack: ' + (e.stack || '').split('\n').slice(0,3).join(' | '), true);
  }

  // Auto-refresh every 30 seconds
  setInterval(async function() {
    try {
      await fetchESPN();
      _termLastUpdate = Date.now();
      renderTerminal();
    } catch(e) {
      console.error('🖥️ Auto-refresh failed', e);
    }
  }, 30000);
}

// Wait for DOM + scripts
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // Give deferred scripts a tick to define globals
    setTimeout(initTerminal, 100);
  });
} else {
  setTimeout(initTerminal, 100);
}
