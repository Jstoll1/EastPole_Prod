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

  var isFinal = (typeof TOURNEY_FINAL !== 'undefined' && TOURNEY_FINAL);
  if (name) name.textContent = (typeof TOURNEY_NAME !== 'undefined' && TOURNEY_NAME) ? TOURNEY_NAME.toUpperCase() : '—';
  if (round) round.textContent = isFinal ? 'FIN' : ('R' + (typeof ESPN_ROUND !== 'undefined' ? ESPN_ROUND || '—' : '—'));
  if (status) {
    var s = 'LIVE';
    if (isFinal) { s = 'FINAL'; status.className = 'final'; }
    else if (typeof TOURNAMENT_STARTED !== 'undefined' && !TOURNAMENT_STARTED) { s = 'SCHEDULED'; status.className = 'scheduled'; }
    else { status.className = ''; }
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

var _pendingLbRender = false;
var _lbSearch = '';

function onLbSearch(v) {
  _lbSearch = v || '';
  renderTermLeaderboard();
}

function renderTermFinalBanner() {
  var holder = document.getElementById('term-lb-final');
  if (!holder) return;
  var isFinal = (typeof TOURNEY_FINAL !== 'undefined' && TOURNEY_FINAL);
  if (!isFinal) { holder.innerHTML = ''; holder.style.display = 'none'; return; }
  // Derive winner + runner-up from active golfers (exclude MC/WD)
  var actives = Object.entries(GOLFER_SCORES || {})
    .map(function(p) { return { name: p[0], g: p[1] }; })
    .filter(function(x) { return x.g && x.g.score !== 11 && x.g.score !== 12; });
  actives.sort(function(a, b) { return a.g.score - b.g.score; });
  if (!actives.length) { holder.style.display = 'none'; return; }
  var win = actives[0], ru = actives[1];
  var winFlag = (FLAGS && FLAGS[win.name]) || '';
  var ruFlag = (ru && FLAGS && FLAGS[ru.name]) || '';
  var winScore = fmtScore(win.g.score);
  var isPlayoff = (typeof ESPN_ROUND !== 'undefined' && ESPN_ROUND > 4) ||
    (ru && win.g.score === ru.g.score);
  holder.style.display = '';
  holder.innerHTML = '<span class="lbf-tag">FINAL</span>'
    + '<span class="lbf-trophy">★</span> <span class="lbf-name">' + winFlag + ' ' + termEsc(win.name) + '</span>'
    + ' <span class="lbf-score neg">' + winScore + '</span>'
    + (ru ? ' <span class="lbf-sep">·</span> RU: ' + ruFlag + ' ' + termEsc(ru.name) + ' ' + fmtScore(ru.g.score) : '')
    + (isPlayoff ? ' <span class="lbf-sep">·</span> <span class="lbf-po">PLAYOFF</span>' : '');
}

function renderTermLeaderboard() {
  renderTermFinalBanner();
  var body = document.getElementById('term-lb-body');
  if (!body) return;
  // Skip re-render while a scorecard is open so the inserted <tr> isn't wiped
  if (_termOpenCard !== null) { _pendingLbRender = true; return; }
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

  // Filter by search input
  var q = (_lbSearch || '').trim().toLowerCase();
  if (q) {
    players = players.filter(function(p) { return p.name.toLowerCase().indexOf(q) !== -1; });
  }

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
  if (_termOpenCard === playerName) {
    _termOpenCard = null;
    // Flush any leaderboard re-render that was deferred while the card was open
    if (_pendingLbRender) { _pendingLbRender = false; renderTermLeaderboard(); }
    return;
  }
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

// ── Next event lookup + weather (for between-tournaments fill) ─
var _nextEvent = null;
var _nextEventFetched = false;
var _nextEventForecast = null;

// PGA Tour venues — extend as needed when the tour visits new courses
var COURSE_COORDS = {
  'Harbour Town Golf Links':          { lat: 32.147, lon: -80.810 },
  'TPC Louisiana':                    { lat: 29.944, lon: -90.106 },
  'Quail Hollow Club':                { lat: 35.154, lon: -80.821 },
  'Colonial Country Club':            { lat: 32.713, lon: -97.401 },
  'Muirfield Village Golf Club':      { lat: 40.153, lon: -83.151 },
  'TPC River Highlands':              { lat: 41.712, lon: -72.691 },
  'Pebble Beach Golf Links':          { lat: 36.569, lon: -121.949 },
  'Augusta National Golf Club':       { lat: 33.503, lon: -82.021 },
  'Bay Hill Club & Lodge':            { lat: 28.451, lon: -81.512 },
  'TPC Sawgrass':                     { lat: 30.199, lon: -81.395 },
  'Torrey Pines Golf Course':         { lat: 32.895, lon: -117.250 },
  'Riviera Country Club':             { lat: 34.051, lon: -118.507 },
  'PGA National Resort':              { lat: 26.838, lon: -80.152 },
  'TPC Scottsdale':                   { lat: 33.639, lon: -111.912 },
  'Waialae Country Club':             { lat: 21.269, lon: -157.791 },
  'Plantation Course at Kapalua':     { lat: 21.002, lon: -156.665 },
  'Medinah Country Club':             { lat: 41.964, lon: -88.065 },
  'East Lake Golf Club':              { lat: 33.741, lon: -84.313 },
  'Caves Valley Golf Club':           { lat: 39.473, lon: -76.804 },
  'Castle Pines Golf Club':           { lat: 39.473, lon: -104.875 },
  'TPC Twin Cities':                  { lat: 45.117, lon: -93.384 },
  'Detroit Golf Club':                { lat: 42.432, lon: -83.107 },
  'TPC Deere Run':                    { lat: 41.499, lon: -90.493 },
  'Sedgefield Country Club':          { lat: 36.062, lon: -79.848 },
  'Liberty National Golf Club':       { lat: 40.687, lon: -74.058 },
  'Vidanta Vallarta':                 { lat: 20.715, lon: -105.316 },
  'The Renaissance Club':             { lat: 56.043, lon: -2.804 }
};

function findCourseCoords(venueName) {
  if (!venueName) return null;
  if (COURSE_COORDS[venueName]) return COURSE_COORDS[venueName];
  var lower = venueName.toLowerCase();
  for (var k in COURSE_COORDS) {
    var kl = k.toLowerCase();
    if (lower.indexOf(kl) !== -1 || kl.indexOf(lower) !== -1) return COURSE_COORDS[k];
  }
  return null;
}

function wxEmoji(code) {
  if (code == null) return '☁️';
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '☁️';
}

async function fetchForecast(lat, lon) {
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code'
      + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=14';
    var res = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    return data.daily || null;
  } catch (e) { return null; }
}

async function fetchNextEvent() {
  if (_nextEventFetched) return;
  _nextEventFetched = true;
  try {
    var res = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', { cache: 'no-store' });
    if (!res.ok) return;
    var data = await res.json();
    var events = (data && data.events) || [];
    var now = Date.now();
    var upcoming = events
      .map(function(e) { return { ev: e, start: e.date ? new Date(e.date).getTime() : 0 }; })
      .filter(function(x) { return x.start > now && x.ev.id !== EVENT_ID; })
      .sort(function(a, b) { return a.start - b.start; });
    if (upcoming.length) {
      var e = upcoming[0].ev;
      var comp = e.competitions && e.competitions[0];
      var venue = comp && comp.venue;
      var courseName = venue ? (venue.fullName || venue.shortName || '') : '';
      _nextEvent = {
        name: e.name || e.shortName || '',
        date: e.date ? new Date(e.date) : null,
        endDate: e.endDate ? new Date(e.endDate) : null,
        course: courseName
      };
      // Forecast — Thu start + 3 days
      var coords = findCourseCoords(courseName);
      if (coords && _nextEvent.date) {
        _nextEventForecast = await fetchForecast(coords.lat, coords.lon);
      }
      renderTerminal();
    }
  } catch (err) {
    // silent; empty-state shows a placeholder
  }
}

function renderForecastStrip() {
  if (!_nextEvent || !_nextEvent.date || !_nextEventForecast || !_nextEventForecast.time) return '';
  var f = _nextEventForecast;
  var dayLabels = ['THU', 'FRI', 'SAT', 'SUN'];
  // Anchor Thursday to the tournament's start date (PGA events run Thu–Sun; some run Wed–Sun)
  var start = new Date(_nextEvent.date);
  // Snap to Thursday of the event week if start isn't already Thu
  // Day: Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
  var dow = start.getDay();
  if (dow !== 4) {
    var delta = (4 - dow + 7) % 7;
    if (delta > 3) delta -= 7; // prefer nearest Thu
    start = new Date(start.getTime() + delta * 86400000);
  }
  var startMs = start.getTime();
  var items = [];
  for (var i = 0; i < 4; i++) {
    var target = new Date(startMs + i * 86400000);
    var yyyy = target.getFullYear();
    var mm = String(target.getMonth() + 1).padStart(2, '0');
    var dd = String(target.getDate()).padStart(2, '0');
    var key = yyyy + '-' + mm + '-' + dd;
    var idx = f.time.indexOf(key);
    if (idx === -1) continue;
    var hi = Math.round(f.temperature_2m_max[idx]);
    var lo = Math.round(f.temperature_2m_min[idx]);
    var pop = Math.round(f.precipitation_probability_max[idx] || 0);
    var wind = Math.round(f.wind_speed_10m_max[idx] || 0);
    var code = f.weather_code[idx];
    items.push('<div class="wx-day">'
      + '<div class="wx-lbl">' + dayLabels[i] + '</div>'
      + '<div class="wx-icon">' + wxEmoji(code) + '</div>'
      + '<div class="wx-temp">' + hi + '° / ' + lo + '°</div>'
      + '<div class="wx-meta">' + wind + ' mph · ' + pop + '% 💧</div>'
      + '</div>');
  }
  return items.length ? '<div class="wx-strip">' + items.join('') + '</div>' : '';
}

function renderTermWeatherBar() {
  var el = document.getElementById('term-wx-bar');
  if (!el) return;
  if (!_nextEvent) {
    el.innerHTML = '<span class="wxb-tag">NEXT</span> <span class="wxb-course">loading…</span>';
    return;
  }
  var parts = ['<span class="wxb-tag">NEXT</span>',
    '<span class="wxb-event">' + termEsc(_nextEvent.name) + '</span>'];
  if (_nextEvent.course) parts.push('<span class="wxb-sep">·</span> <span class="wxb-course">' + termEsc(_nextEvent.course) + '</span>');

  var f = _nextEventForecast;
  if (f && f.time && _nextEvent.date) {
    var dayLabels = ['THU', 'FRI', 'SAT', 'SUN'];
    var start = new Date(_nextEvent.date);
    var dow = start.getDay();
    if (dow !== 4) {
      var delta = (4 - dow + 7) % 7;
      if (delta > 3) delta -= 7;
      start = new Date(start.getTime() + delta * 86400000);
    }
    for (var i = 0; i < 4; i++) {
      var target = new Date(start.getTime() + i * 86400000);
      var key = target.getFullYear() + '-' + String(target.getMonth() + 1).padStart(2, '0') + '-' + String(target.getDate()).padStart(2, '0');
      var idx = f.time.indexOf(key);
      if (idx === -1) continue;
      var hi = Math.round(f.temperature_2m_max[idx]);
      var lo = Math.round(f.temperature_2m_min[idx]);
      var code = f.weather_code[idx];
      parts.push('<span class="wxb-sep">·</span> <span class="wxb-day">'
        + '<span class="d">' + dayLabels[i] + '</span>'
        + '<span class="ic">' + wxEmoji(code) + '</span>'
        + '<span class="t">' + hi + '°</span>'
        + '<span class="lo">/' + lo + '</span>'
        + '</span>');
    }
  } else if (!f) {
    parts.push('<span class="wxb-sep">·</span> <span class="wxb-course">forecast loading…</span>');
  }

  // Countdown on the right edge
  if (_nextEvent.date) {
    var days = Math.max(0, Math.ceil((_nextEvent.date.getTime() - Date.now()) / 86400000));
    parts.push('<span class="wxb-countdown">' + (days === 0 ? 'TODAY' : 'T-' + days + 'd') + '</span>');
  }

  el.innerHTML = parts.join(' ');
}

function renderNextEventCard(containerHtml) {
  if (!_nextEvent) return containerHtml('<div class="empty">Loading next event…</div>');
  var dateStr = '';
  if (_nextEvent.date) {
    var opts = { month: 'short', day: 'numeric' };
    var s = _nextEvent.date.toLocaleDateString('en-US', opts);
    var e = _nextEvent.endDate ? _nextEvent.endDate.toLocaleDateString('en-US', opts) : '';
    dateStr = e ? s + ' – ' + e : s;
  }
  var days = _nextEvent.date ? Math.max(0, Math.ceil((_nextEvent.date.getTime() - Date.now()) / 86400000)) : null;
  var html = '<div class="next-ev">'
    + '<div class="ne-tag">NEXT EVENT</div>'
    + '<div class="ne-name">' + termEsc(_nextEvent.name) + '</div>'
    + (_nextEvent.course ? '<div class="ne-course">' + termEsc(_nextEvent.course) + '</div>' : '')
    + '<div class="ne-meta">' + termEsc(dateStr) + (days != null ? '  ·  ' + (days === 0 ? 'today' : days + ' day' + (days === 1 ? '' : 's')) : '') + '</div>'
    + renderForecastStrip()
    + '</div>';
  return containerHtml(html);
}

function renderTermStandings() {
  var body = document.getElementById('term-std-body');
  if (!body) return;
  if (!ENTRIES || !ENTRIES.length) {
    var isFinal = (typeof TOURNEY_FINAL !== 'undefined' && TOURNEY_FINAL);
    if (isFinal) {
      body.innerHTML = renderNextEventCard(function(inner) {
        return '<tr><td colspan="5" class="tpt-fill">' + inner + '</td></tr>';
      });
      fetchNextEvent();
    } else {
      body.innerHTML = '<tr><td colspan="5" class="empty">No entries loaded</td></tr>';
    }
    var m = document.getElementById('std-meta');
    if (m) m.textContent = isFinal ? 'between events' : '—';
    return;
  }

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

// ── Render Movers (flame/ice) ──────────────────────────

function renderTermActivity() {
  var body = document.getElementById('term-act-body');
  if (!body) return;

  var isPreT = (typeof TOURNAMENT_STARTED !== 'undefined' && !TOURNAMENT_STARTED);
  var currentRound = (typeof ESPN_ROUND !== 'undefined' && ESPN_ROUND) ? Math.min(ESPN_ROUND, 4) : 0;

  var allPlayers = Object.keys(GOLFER_SCORES || {}).map(function(n) {
    var g = GOLFER_SCORES[n];
    return { name: n, score: g.score, pos: g.pos, thru: g.thru, todayDisplay: g.todayDisplay };
  });

  // Prior positions inferred from (current score − today) across the full field,
  // ranked with tie handling. Mirrors ui-leaderboard.js:178-196.
  var priorPosMap = {};
  if (!isPreT && currentRound >= 2) {
    var fullPriorScores = allPlayers
      .filter(function(p) { return p.score !== 11 && p.score !== 12; })
      .map(function(p) {
        var td = p.todayDisplay;
        var todayVal = 0, hasToday = false;
        if (td && td !== '—') { hasToday = true; todayVal = td === 'E' ? 0 : (parseInt(String(td).replace('+', '')) || 0); }
        return { name: p.name, prior: hasToday ? p.score - todayVal : p.score };
      })
      .sort(function(a, b) { return a.prior - b.prior; });
    var fpRk = 1;
    fullPriorScores.forEach(function(ps, idx) {
      if (idx > 0 && ps.prior !== fullPriorScores[idx - 1].prior) fpRk = idx + 1;
      priorPosMap[ps.name] = fpRk;
    });
  }

  // Build arrow map: delta = priorPos − currentPos (positive = climbed).
  // Skip MC/WD and players who haven't teed off (thru='—' or 'HH:MM').
  var arrowPlayers = new Map();
  if (!isPreT && currentRound >= 2) {
    allPlayers.forEach(function(p) {
      if (p.score === 11 || p.score === 12) return;
      if (p.thru === '—' || (p.thru && String(p.thru).indexOf(':') !== -1)) return;
      var cP = parsePos(p.pos); if (!cP) return;
      var sP = priorPosMap[p.name];
      if (sP && sP !== cP) arrowPlayers.set(p.name, sP - cP);
    });
  }

  var topMoverNames = (!isPreT && typeof getTopMovers === 'function') ? getTopMovers(arrowPlayers) : new Map();

  var movers = [];
  arrowPlayers.forEach(function(delta, name) {
    var g = GOLFER_SCORES[name];
    movers.push({ name: name, delta: delta, pos: g.pos, thru: g.thru, isTop: topMoverNames.has(name) });
  });
  // Top-of-list highlights: top movers first, then remaining sorted by |delta|
  movers.sort(function(a, b) {
    if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  if (!movers.length) {
    body.innerHTML = '<div class="empty">' + (isPreT ? 'Pre-tournament' : currentRound < 2 ? 'Round 1 — no prior positions yet' : 'No movement') + '</div>';
    var m0 = document.getElementById('act-meta');
    if (m0) m0.textContent = '—';
    return;
  }

  body.innerHTML = movers.slice(0, 40).map(function(m) {
    var flag = FLAGS && FLAGS[m.name] || '';
    var hot = m.delta > 0;
    var badge = hot ? '🔥' : '🧊'; // 🔥 / 🧊
    var cls = (hot ? 'act-birdie' : 'act-bogey') + (m.isTop ? ' act-top-mover' : '');
    var deltaStr = hot ? '▲' + m.delta : '▼' + Math.abs(m.delta);
    return '<div class="act-row ' + cls + '">'
      + '<div class="act-time">' + badge + '</div>'
      + '<div class="act-text">' + flag + ' ' + termEsc(m.name) + ' (' + termEsc(m.pos) + ')</div>'
      + '<div class="act-score">' + deltaStr + '</div>'
      + '</div>';
  }).join('');

  var meta = document.getElementById('act-meta');
  if (meta) meta.textContent = movers.length + ' movers';
}

// ── Render My Entries ──────────────────────────────────

function renderCourseStatsBlock() {
  // Aggregate field round averages from GOLFER_SCORES r1/r2/r3/r4
  var cuts = [[], [], [], []];
  Object.keys(GOLFER_SCORES || {}).forEach(function(n) {
    var g = GOLFER_SCORES[n];
    if (!g || g.score === 11 || g.score === 12) return;
    [g.r1, g.r2, g.r3, g.r4].forEach(function(v, i) { if (v && v > 50) cuts[i].push(v); });
  });
  var avgs = cuts.map(function(arr) {
    if (!arr.length) return null;
    var sum = arr.reduce(function(s, v) { return s + v; }, 0);
    return sum / arr.length;
  });
  var par = (typeof COURSE_PAR !== 'undefined' && COURSE_PAR) ? COURSE_PAR : 71;
  var pieces = avgs.map(function(a, i) {
    if (a == null) return '';
    var toPar = a - par;
    var tp = toPar === 0 ? 'E' : (toPar > 0 ? '+' + toPar.toFixed(1) : toPar.toFixed(1));
    var cls = toPar < 0 ? 'pos' : toPar > 0 ? 'neg' : 'eve';
    return '<div class="cs-round"><span class="cs-lbl">R' + (i + 1) + '</span>'
      + '<span class="cs-val">' + a.toFixed(1) + '</span>'
      + '<span class="cs-tp ' + cls + '">' + tp + '</span></div>';
  }).join('');
  var courseName = (typeof TOURNEY_COURSE !== 'undefined' && TOURNEY_COURSE) ? TOURNEY_COURSE : '';
  return '<div class="course-stats">'
    + '<div class="cs-head">COURSE · ' + termEsc(courseName || '—') + ' · PAR ' + par + '</div>'
    + '<div class="cs-rounds">' + pieces + '</div>'
    + '<div class="cs-foot">Field scoring average by round</div>'
    + '</div>';
}

function renderTermMy() {
  var body = document.getElementById('term-my-body');
  if (!body) return;
  var teams = (typeof currentUserTeams !== 'undefined') ? currentUserTeams : [];
  if (!teams.length) {
    var isFinal = (typeof TOURNEY_FINAL !== 'undefined' && TOURNEY_FINAL);
    var empty = '<div class="empty">Log in on mobile app to link your entries</div>';
    body.innerHTML = isFinal ? renderCourseStatsBlock() : empty;
    var mm = document.getElementById('my-meta');
    if (mm) mm.textContent = isFinal ? 'course' : '—';
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

// ── Ticker: JS-driven auto-scroll + click-drag + momentum ─

var _ticker = {
  translate: 0,
  velocity: 0,
  dragging: false,
  lastX: 0,
  lastT: 0,
  autoScrollActive: true,
  resumeTimer: null,
  AUTO_SPEED: 0.45   // px/frame when idle
};

function initTickerInteraction() {
  var track = document.querySelector('.tt-track');
  var content = document.getElementById('tt-content');
  if (!track || !content) return;

  function contentHalfWidth() { return content.scrollWidth / 2; } // doubled for wrap
  function apply() {
    var w = contentHalfWidth();
    if (w > 0) {
      while (_ticker.translate <= -w) _ticker.translate += w;
      while (_ticker.translate > 0) _ticker.translate -= w;
    }
    content.style.transform = 'translate(' + _ticker.translate + 'px, -50%)';
  }

  function tick() {
    if (_ticker.dragging) {
      // position set directly by mousemove/touchmove
    } else if (Math.abs(_ticker.velocity) > 0.2) {
      _ticker.translate += _ticker.velocity;
      _ticker.velocity *= 0.94;
      if (Math.abs(_ticker.velocity) <= 0.2) {
        if (_ticker.resumeTimer) clearTimeout(_ticker.resumeTimer);
        _ticker.autoScrollActive = false;
        _ticker.resumeTimer = setTimeout(function() { _ticker.autoScrollActive = true; }, 1500);
      }
    } else if (_ticker.autoScrollActive) {
      _ticker.translate -= _ticker.AUTO_SPEED;
    }
    apply();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function onDown(x) {
    _ticker.dragging = true;
    _ticker.lastX = x;
    _ticker.lastT = Date.now();
    _ticker.velocity = 0;
    _ticker.autoScrollActive = false;
    if (_ticker.resumeTimer) { clearTimeout(_ticker.resumeTimer); _ticker.resumeTimer = null; }
    track.classList.add('tt-dragging');
  }
  function onMove(x) {
    if (!_ticker.dragging) return;
    var now = Date.now();
    var dx = x - _ticker.lastX;
    var dt = Math.max(1, now - _ticker.lastT);
    _ticker.velocity = (dx / dt) * 16; // px per ~60fps frame
    _ticker.translate += dx;
    _ticker.lastX = x;
    _ticker.lastT = now;
    apply();
  }
  function onUp() {
    if (!_ticker.dragging) return;
    _ticker.dragging = false;
    track.classList.remove('tt-dragging');
  }

  track.addEventListener('mousedown', function(e) { onDown(e.pageX); e.preventDefault(); });
  document.addEventListener('mousemove', function(e) { onMove(e.pageX); });
  document.addEventListener('mouseup', onUp);
  track.addEventListener('touchstart', function(e) { var t = e.touches[0]; if (t) onDown(t.pageX); }, { passive: true });
  track.addEventListener('touchmove',  function(e) { var t = e.touches[0]; if (t) onMove(t.pageX); }, { passive: true });
  track.addEventListener('touchend', onUp);
  track.addEventListener('touchcancel', onUp);
}

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
  try { renderTermWeatherBar(); } catch(e) { console.error('WX error', e); }
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
  initTickerInteraction();
  fetchNextEvent(); // populates the top weather bar regardless of tournament state

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
