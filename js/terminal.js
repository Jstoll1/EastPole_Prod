// ── East Pole Terminal — Desktop Bloomberg-style ──────────

function termDiag(msg, isError) {
  try {
    var el = document.getElementById('term-diag');
    if (!el) {
      el = document.createElement('div');
      el.id = 'term-diag';
      el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#000;color:#d4a843;padding:6px 12px;font-family:monospace;font-size:10px;z-index:9999;border-top:1px solid #d4a843;max-height:150px;overflow:auto';
      document.body.appendChild(el);
    }
    var line = document.createElement('div');
    line.style.color = isError ? '#ff6b6b' : '#d4a843';
    line.textContent = new Date().toTimeString().substring(0,8) + ' ' + msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  } catch(e) {}
}

// Mobile redirect
if (window.innerWidth < 1024) {
  window.location.href = './index.html';
}

// Stubs for functions/globals from mobile-only modules that api.js references
if (typeof renderAll === 'undefined') window.renderAll = function() {};
if (typeof _tickerMode === 'undefined') window._tickerMode = 'entries';
if (typeof showToast === 'undefined') window.showToast = function() {};

var _termLastUpdate = 0;

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
      mc: g.score === 11, wd: g.score === 12
    };
  });

  players.sort(function(a, b) {
    if (a.mc && !b.mc) return 1;
    if (!a.mc && b.mc) return -1;
    if (a.wd && !b.wd) return 1;
    if (!a.wd && b.wd) return -1;
    return a.score - b.score;
  });

  // Get pool pick names
  var poolNames = new Set();
  (ENTRIES || []).forEach(function(e) { e.picks.forEach(function(p) { poolNames.add(p); }); });

  body.innerHTML = players.slice(0, 80).map(function(p) {
    var posDisp = p.mc ? 'MC' : p.wd ? 'WD' : (p.pos || '—');
    var scoreDisp = (p.mc || p.wd) ? '—' : fmtScore(p.score);
    var scoreCl = (p.mc || p.wd) ? 'mc' : scoreCls(p.score);
    var todayDisp = (p.mc || p.wd) ? '—' : (p.today || '—');
    var todayVal = todayDisp === 'E' ? 0 : parseInt(todayDisp.replace('+', '')) || 0;
    var todayCl = todayDisp === '—' ? '' : scoreCls(todayVal);
    var thruDisp = (p.mc || p.wd) ? '' : (p.thru || '');
    if (thruDisp === '—' && p.teeTime && p.teeTime.includes('T')) {
      try { thruDisp = new Date(p.teeTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); } catch(e){}
    }
    var flag = (FLAGS && FLAGS[p.name]) || '';
    var mine = (typeof currentUserTeams !== 'undefined' && currentUserTeams.some(function(t) { return t.picks.indexOf(p.name) !== -1; }));
    var inPool = poolNames.has(p.name);
    var rowCls = mine ? 'is-mine' : '';
    return '<tr class="' + rowCls + '">'
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

// ── Render Standings ───────────────────────────────────

function renderTermStandings() {
  var body = document.getElementById('term-std-body');
  if (!body) return;
  if (!ENTRIES || !ENTRIES.length) { body.innerHTML = '<tr><td colspan="5" class="empty">No entries loaded</td></tr>'; return; }

  var ranked = getRanked();
  var myKey = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '';

  body.innerHTML = ranked.slice(0, 60).map(function(e, i) {
    var rank = i + 1;
    var isMine = e.email === myKey;
    var isMoney = rank <= 3;
    var teamHolesLeft = e.top4.reduce(function(s, g) { return s + getHolesRemaining(g.name); }, 0);
    var teamToday = 0, hasToday = false;
    e.top4.forEach(function(g) {
      var gd = GOLFER_SCORES[g.name];
      if (!gd) return;
      if (gd.score === 11 || gd.score === 12) return;
      var td = gd.todayDisplay;
      if (td && td !== '—') {
        hasToday = true;
        teamToday += (td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0);
      }
    });
    var todayDisp = hasToday ? fmtScore(teamToday) : '—';
    var todayCl = hasToday ? scoreCls(teamToday) : '';
    var cls = [isMine ? 'is-mine' : '', isMoney ? 'is-money' : ''].filter(Boolean).join(' ');
    return '<tr class="' + cls + '">'
      + '<td class="tpt-pos">' + rank + '</td>'
      + '<td class="tpt-name">' + termEsc(e.team) + '</td>'
      + '<td class="tpt-score ' + scoreCls(e.total) + '">' + fmtScore(e.total) + '</td>'
      + '<td class="tpt-today ' + todayCl + '">' + termEsc(todayDisp) + '</td>'
      + '<td class="tpt-thru">' + (teamHolesLeft > 0 ? teamHolesLeft : 'F') + '</td>'
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

// ── Render Ownership ──────────────────────────────────

function renderTermOwnership() {
  var body = document.getElementById('term-own-body');
  if (!body) return;
  if (!OWNERSHIP_DATA || !OWNERSHIP_DATA.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No ownership data</td></tr>';
    return;
  }

  body.innerHTML = OWNERSHIP_DATA.slice(0, 60).map(function(d) {
    var gd = GOLFER_SCORES[d.player];
    var mc = gd && (gd.score === 11 || gd.score === 12);
    var flag = FLAGS && FLAGS[d.player] || '';
    var scDisp = mc ? 'MC' : (gd ? fmtScore(gd.score) : '—');
    var scCl = mc ? 'mc' : (gd ? scoreCls(gd.score) : '');
    var todayDisp = mc ? '—' : (gd ? (gd.todayDisplay || '—') : '—');
    var todayVal = todayDisp === 'E' ? 0 : parseInt(todayDisp.replace('+', '')) || 0;
    var todayCl = todayDisp === '—' ? '' : scoreCls(todayVal);
    var thruDisp = mc ? '' : (gd ? gd.thru : '');
    return '<tr>'
      + '<td class="tpt-pos">' + Math.round(d.pct * 100) + '%</td>'
      + '<td class="tpt-name">' + flag + ' ' + termEsc(d.player) + '</td>'
      + '<td class="tpt-score ' + scCl + '">' + scDisp + '</td>'
      + '<td class="tpt-today ' + todayCl + '">' + termEsc(todayDisp) + '</td>'
      + '<td class="tpt-thru">' + termEsc(thruDisp || '') + '</td>'
      + '</tr>';
  }).join('');

  var meta = document.getElementById('own-meta');
  if (meta) meta.textContent = OWNERSHIP_DATA.length + ' players';
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
  try { renderTermOwnership(); } catch(e) { console.error('OWN error', e); }
  try { renderTermThreat(); } catch(e) { console.error('THR error', e); }
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

  // Initial fetch
  try {
    termDiag('Calling fetchESPN...');
    await fetchESPN();
    var count = Object.keys(GOLFER_SCORES || {}).length;
    termDiag('fetchESPN done. Golfers: ' + count + ', Tourney: ' + (typeof TOURNEY_NAME !== 'undefined' ? TOURNEY_NAME : 'UNDEF'));
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
