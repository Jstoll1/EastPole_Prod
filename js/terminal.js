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
function openAddEntryTerm() {
  var el = document.getElementById('term-addentry-overlay');
  var bd = document.getElementById('term-addentry-backdrop');
  var container = document.getElementById('term-entry-form-container');
  if (!el || !container) return;
  // Render the native form (entry-form.js provides buildEntryFormHTML)
  if (typeof buildEntryFormHTML === 'function') {
    container.innerHTML = buildEntryFormHTML();
    container.id = 'entry-form-container'; // so submitEntryForm's showEntrySuccess finds the container
    container.setAttribute('data-term', '1');
  }
  el.style.display = 'flex';
  if (bd) bd.style.display = 'block';
}
function closeAddEntryTerm() {
  var el = document.getElementById('term-addentry-overlay');
  var bd = document.getElementById('term-addentry-backdrop');
  if (el) el.style.display = 'none';
  if (bd) bd.style.display = 'none';
}
// entry-form.js calls closeAddEntry() from its success screen; alias to the terminal close on this surface
if (typeof window !== 'undefined') window.closeAddEntry = closeAddEntryTerm;

// ─── Terminal Login ─────────────────────────────────────────
function openTermLogin() {
  var modal = document.getElementById('term-login-modal');
  var bd = document.getElementById('term-login-backdrop');
  if (!modal) return;
  modal.innerHTML = buildTermLoginMenu();
  modal.style.display = 'block';
  if (bd) bd.style.display = 'block';
  setTimeout(function() {
    var f = document.getElementById('tlogin-filter');
    if (f) f.focus();
  }, 80);
}
function closeTermLogin() {
  var modal = document.getElementById('term-login-modal');
  var bd = document.getElementById('term-login-backdrop');
  if (modal) modal.style.display = 'none';
  if (bd) bd.style.display = 'none';
}
function buildTermLoginMenu() {
  var entries = (typeof ENTRIES !== 'undefined' && ENTRIES) ? ENTRIES : [];
  var seen = {};
  var users = [];

  // Group by ENTRANT first (case-insensitive) — handles the common case where
  // one person submits multiple entries with varying emails. Fall back to
  // email for entries without a username, then team as a last resort.
  entries.forEach(function(e) {
    var key, label;
    if (e.entrant) {
      key = '__ent__' + e.entrant.toLowerCase().trim();
      label = e.entrant;
    } else if (e.email) {
      key = '__eml__' + e.email.toLowerCase();
      label = e.email;
    } else {
      key = '__team__' + e.team;
      label = e.team;
    }
    if (seen[key]) return;
    seen[key] = true;
    var grp = entries.filter(function(x) {
      if (e.entrant) return (x.entrant || '').toLowerCase().trim() === e.entrant.toLowerCase().trim();
      if (e.email) return (x.email || '').toLowerCase() === e.email.toLowerCase() && !x.entrant;
      return x.team === e.team && !x.email && !x.entrant;
    });
    users.push({
      key: key,
      label: label,
      entrant: e.entrant || '',
      emails: Array.from(new Set(grp.map(function(x) { return x.email; }).filter(Boolean))),
      teams: grp.map(function(x) { return x.team; })
    });
  });
  users.sort(function(a, b) { return a.label.localeCompare(b.label); });

  var currentEmail = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : null;
  var h = '<div class="tlogin-head">'
    +    '<span>' + (currentEmail ? 'Switch Identity' : 'Select Your Identity') + '</span>'
    +    '<button class="tsb-btn" onclick="closeTermLogin()">✕</button>'
    +  '</div>';
  if (!users.length) {
    h += '<div class="tlogin-empty">No entries loaded yet. Submit an entry via + ADD ENTRY above, then come back.</div>';
    return h;
  }
  h += '<div class="tlogin-search"><input type="text" id="tlogin-filter" placeholder="search username, team, email…" oninput="filterTermLogin(this.value)"></div>';
  h += '<div class="tlogin-list">';
  users.forEach(function(u) {
    var active = currentEmail && String(currentEmail).toLowerCase() === u.key.toLowerCase();
    var escKey = u.key.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var emailStr = u.emails.join(' · ');
    h += '<div class="tlogin-row' + (active ? ' tlogin-active' : '') + '"'
      +   ' data-label="' + termEsc(u.label) + '"'
      +   ' data-email="' + termEsc(emailStr) + '"'
      +   ' data-teams="' + termEsc(u.teams.join(' ')) + '"'
      +   ' data-entrant="' + termEsc(u.entrant) + '"'
      +   ' onclick="selectTermUser(\'' + escKey + '\')">'
      +   '<div class="tlogin-email">'
      +     '<span class="tlogin-name">' + termEsc(u.label) + '</span>'
      +     (active ? ' <span class="tlogin-you">YOU</span>' : '')
      +   '</div>'
      +   '<div class="tlogin-teams">'
      +     (u.teams.length === 1 ? '1 entry · ' + termEsc(u.teams[0]) : u.teams.length + ' entries · ' + u.teams.map(termEsc).join(' · '))
      +     (emailStr ? '<div class="tlogin-emails">' + termEsc(emailStr) + '</div>' : '')
      +   '</div>'
      + '</div>';
  });
  h += '</div>';
  if (currentEmail) {
    h += '<div class="tlogin-foot"><button class="tsb-btn tlogin-logout" onclick="termLogOut()">LOG OUT</button></div>';
  }
  return h;
}
function filterTermLogin(q) {
  q = (q || '').toLowerCase().trim();
  var rows = document.querySelectorAll('.tlogin-row');
  var shown = 0;
  rows.forEach(function(r) {
    var label = (r.getAttribute('data-label') || '').toLowerCase();
    var e = (r.getAttribute('data-email') || '').toLowerCase();
    var t = (r.getAttribute('data-teams') || '').toLowerCase();
    var ent = (r.getAttribute('data-entrant') || '').toLowerCase();
    var match = !q || label.indexOf(q) !== -1 || e.indexOf(q) !== -1 || t.indexOf(q) !== -1 || ent.indexOf(q) !== -1;
    r.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  var list = document.querySelector('#term-login-modal .tlogin-list');
  if (list) {
    var hint = list.querySelector('.tlogin-nomatch');
    if (q && shown === 0) {
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'tlogin-nomatch';
        list.appendChild(hint);
      }
      hint.textContent = 'No entries match "' + q + '" — searched ' + rows.length + ' identities. Clear search to see all.';
      hint.style.display = '';
    } else if (hint) {
      hint.style.display = 'none';
    }
  }
}
function selectTermUser(key) {
  window.currentUserEmail = key;
  // New identity keys are prefixed: __ent__jake, __eml__foo@bar.com, __team__X
  window.currentUserTeams = (ENTRIES || []).filter(function(e) {
    if (typeof key !== 'string') return false;
    if (key.indexOf('__ent__') === 0) {
      return (e.entrant || '').toLowerCase().trim() === key.slice(7);
    }
    if (key.indexOf('__eml__') === 0) {
      return (e.email || '').toLowerCase() === key.slice(7) && !e.entrant;
    }
    if (key.indexOf('__team__') === 0) {
      return e.team === key.slice(8) && !e.email && !e.entrant;
    }
    // Legacy: loose match by email, entrant, or team
    var kl = String(key).toLowerCase();
    return (e.email && e.email.toLowerCase() === kl)
        || (e.entrant && e.entrant.toLowerCase() === kl)
        || (e.team === key);
  });
  window.activeTeamIdx = -1;
  try { localStorage.setItem('eastpole_v2', JSON.stringify({ email: key, activeTeamIdx: -1 })); } catch(e) {}
  updateTermLoginButton();
  closeTermLogin();
  if (typeof renderPoolRoster === 'function') renderPoolRoster();
  renderTerminal();
}
function termLogOut() {
  window.currentUserEmail = null;
  window.currentUserTeams = [];
  window.activeTeamIdx = -1;
  try { localStorage.removeItem('eastpole_v2'); } catch(e) {}
  updateTermLoginButton();
  closeTermLogin();
  if (typeof renderPoolRoster === 'function') renderPoolRoster();
  renderTerminal();
}
// ─── Entry Details (inline accordion in F2 Pool Standings) ───────
var _expandedEntryKey = null;

function openEntryDetails(rowKey) {
  if (!rowKey) return;
  // Toggle — collapse if the same row is clicked again
  if (_expandedEntryKey === rowKey) {
    _expandedEntryKey = null;
  } else {
    _expandedEntryKey = rowKey;
  }
  renderTermStandings();
}

function _buildEntryDetailRow(entry, colspan) {
  var tierLabels = { tier1: 'T1 · Favorites', tier2: 'T2 · Contenders', tier3: 'T3 · Midfield', tier4: 'T4 · Longshots' };
  var live = (typeof isTournamentLive === 'function') && isTournamentLive();
  var hasTiers = entry.tierPicks && Object.keys(entry.tierPicks).some(function(k) { return (entry.tierPicks[k] || []).length; });

  var meta = [];
  if (entry.entrant)    meta.push('<span class="ed-entrant">' + termEsc(entry.entrant) + '</span>');
  if (entry.email)      meta.push('<span class="ed-email">' + termEsc(entry.email) + '</span>');
  if (entry.tieBreaker) meta.push('<span class="ed-tb">TB: <strong>' + termEsc(entry.tieBreaker) + '</strong></span>');

  var body = '';
  if (hasTiers && !live) {
    body += '<div class="ed-picks-grid">';
    ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
      var picks = (entry.tierPicks && entry.tierPicks[k]) || [];
      if (!picks.length) return;
      body += '<div class="ed-tier">'
        +    '<div class="ed-tier-lbl">' + tierLabels[k] + '</div>'
        +    picks.map(function(p) {
               // Split team-pair "Flag A / Flag B" onto two lines so neither gets
               // truncated inside the narrow F2 panel.
               var parts = String(p).split(/\s*\/\s*/);
               return '<div class="ed-tier-pick">'
                 + parts.map(function(pp) { return '<div class="ed-tier-name">' + termEsc(pp) + '</div>'; }).join('')
                 + '</div>';
             }).join('')
        +  '</div>';
    });
    body += '</div>';
  } else {
    var picks = (entry.picks || []).slice(0, 20);
    body += '<div class="ed-picks-flat">';
    picks.forEach(function(p) {
      var gd = GOLFER_SCORES[p];
      var sc = gd ? (gd.score === 11 ? 'MC' : gd.score === 12 ? 'WD' : fmtScore(gd.score)) : '—';
      var cls = gd ? (gd.score === 11 || gd.score === 12 ? 'mc' : scoreCls(gd.score)) : '';
      var flag = (FLAGS && FLAGS[p]) || '';
      body += '<div class="ed-pick"><span class="ed-pick-name">' + flag + ' ' + termEsc(p) + '</span><span class="ed-pick-sc ' + cls + '">' + sc + '</span></div>';
    });
    body += '</div>';
  }

  return '<tr class="ed-detail-row"><td colspan="' + colspan + '" class="ed-detail-cell">'
    + (meta.length ? '<div class="ed-sub">' + meta.join(' · ') + '</div>' : '')
    + body
    + '</td></tr>';
}

function updateTermLoginButton() {
  var btn = document.getElementById('term-login-btn');
  if (!btn) return;
  if (currentUserEmail) {
    var key = String(currentUserEmail);
    var display;
    if (key.indexOf('__ent__') === 0) {
      // Look up the original cased entrant from ENTRIES
      var ent = key.slice(7);
      var match = (ENTRIES || []).find(function(e) { return (e.entrant || '').toLowerCase().trim() === ent; });
      display = match && match.entrant ? match.entrant : ent;
    } else if (key.indexOf('__eml__') === 0) {
      display = key.slice(7).split('@')[0];
    } else if (key.indexOf('__team__') === 0) {
      display = key.slice(8);
    } else {
      display = key.split('@')[0];
    }
    btn.textContent = '👤 ' + display.slice(0, 14).toUpperCase();
  } else {
    btn.textContent = 'LOG IN';
  }
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
  if (s < 0) return 'neg';  // negative number → red (per user preference)
  if (s > 0) return 'pos';  // positive number → green
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
      mc: g.score === 11, wd: g.score === 12,
      teamId: g.teamId
    };
  });
  // Team events (Zurich): collapse teammates into one row, keeping `names` array for lookups.
  (function() {
    var seen = {};
    var out = [];
    players.forEach(function(p) {
      if (p.teamId) {
        if (seen[p.teamId]) { seen[p.teamId].names.push(p.name); return; }
        p.names = [p.name];
        seen[p.teamId] = p;
        out.push(p);
      } else {
        p.names = [p.name];
        out.push(p);
      }
    });
    players = out;
  })();

  var lbSort = _sortState['panel-leaderboard'];
  var lbAccessors = {
    pos:   function(p) { return p.mc || p.wd ? 9999 : (parsePos(p.pos) || 9999); },
    name:  function(p) { return p.name; },
    score: function(p) { return p.mc || p.wd ? (lbSort.dir === 'desc' ? -Infinity : Infinity) : p.score; },
    today: function(p) { var t = p.today; return t === 'E' ? 0 : (parseInt(String(t).replace('+','')) || 0); },
    thru:  function(p) {
      // Sort by real tee time chronologically — earliest tees first in ASC.
      // Handles AM/PM correctly unlike the old string-based sort. Mid-round
      // and finished players both carry teeTime too, so they sort to their
      // original tee slot; thru column then shows their current state.
      if (p.teeTime && typeof p.teeTime === 'string' && p.teeTime.indexOf('T') !== -1) {
        var t = new Date(p.teeTime).getTime();
        if (!isNaN(t)) return t;
      }
      var raw = (p.thru == null) ? '' : String(p.thru).trim();
      // Fallback: parse a displayed time like "8:00 AM" directly.
      var m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (m) {
        var h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
        if (m[3]) {
          var ampm = m[3].toUpperCase();
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
        }
        return h * 60 + mm;
      }
      // F / hole number / unknown — bubble to end with a cap so stable ordering.
      if (raw.charAt(0).toUpperCase() === 'F') return Infinity;
      if (/^\d{1,2}$/.test(raw)) return 9e12 + parseInt(raw, 10);
      return Infinity;
    }
  };
  players = sortRowsBy(players, lbSort.col, lbSort.dir, lbAccessors);
  updateSortIndicators('panel-leaderboard');

  // Filter by search input
  var q = (_lbSearch || '').trim().toLowerCase();
  if (q) {
    players = players.filter(function(p) { return p.names.some(function(n) { return n.toLowerCase().indexOf(q) !== -1; }); });
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
        thruDisp = fmtTeeTime(p.teeTime, typeof TOURNEY_COURSE !== 'undefined' ? TOURNEY_COURSE : '') || '—';
      } catch(e){ thruDisp = '—'; }
    } else {
      thruDisp = p.thru || '—';
    }
    var isTeam = p.names.length > 1;
    var mine = (typeof currentUserTeams !== 'undefined' && currentUserTeams.some(function(t) { return p.names.some(function(n) { return t.picks.indexOf(n) !== -1; }); }));
    var inPool = p.names.some(function(n) { return poolNames.has(n); });
    var rowCls = mine ? 'is-mine' : '';
    var escapedName = p.name.replace(/'/g, "\\'");
    var nameCell = isTeam
      ? p.names.map(function(n) { var f = (FLAGS && FLAGS[n]) || ''; return (f ? f + ' ' : '') + termEsc(n); }).join(' / ')
      : (((FLAGS && FLAGS[p.name]) || '') + ' ' + termEsc(p.name));
    return '<tr class="' + rowCls + '" onclick="toggleTermScorecard(\'' + escapedName + '\', this)" style="cursor:pointer">'
      + '<td class="tpt-pos">' + termEsc(posDisp) + '</td>'
      + '<td class="tpt-name">' + nameCell + (inPool ? ' <span style="color:var(--term-text-muted);font-size:9px">●</span>' : '') + '</td>'
      + '<td class="tpt-score ' + scoreCl + '">' + scoreDisp + '</td>'
      + '<td class="tpt-today ' + todayCl + '">' + termEsc(todayDisp) + '</td>'
      + '<td class="tpt-thru">' + termEsc(thruDisp) + '</td>'
      + '</tr>';
  }).join('');

  var meta = document.getElementById('lb-meta');
  if (meta) {
    var tz = (typeof getEventTZ === 'function') ? getEventTZ(typeof TOURNEY_COURSE !== 'undefined' ? TOURNEY_COURSE : '') : null;
    var tzAbbrev = '';
    if (tz) {
      try {
        var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
        var p = parts.find(function(p) { return p.type === 'timeZoneName'; });
        tzAbbrev = p ? ' · times ' + p.value : '';
      } catch(e) {}
    }
    meta.textContent = players.length + ' players' + tzAbbrev;
  }
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

// Fallback event-name → course map for when ESPN doesn't include venue
// data (common on scheduled/upcoming events before tee-off).
var EVENT_TO_COURSE = {
  'zurich classic':          'TPC Louisiana',
  'rbc heritage':            'Harbour Town Golf Links',
  'masters':                 'Augusta National Golf Club',
  'pga championship':        'Quail Hollow Club',
  'charles schwab':          'Colonial Country Club',
  'memorial':                'Muirfield Village Golf Club',
  'travelers':               'TPC River Highlands',
  'pebble beach':            'Pebble Beach Golf Links',
  'arnold palmer':           'Bay Hill Club & Lodge',
  'players championship':    'TPC Sawgrass',
  'genesis invitational':    'Riviera Country Club',
  'cognizant':               'PGA National Resort',
  'phoenix open':            'TPC Scottsdale',
  'wm phoenix':              'TPC Scottsdale',
  'sony open':               'Waialae Country Club',
  'sentry':                  'Plantation Course at Kapalua',
  'byron nelson':            'TPC Craig Ranch',
  'valspar':                 'Copperhead Course',
  'tour championship':       'East Lake Golf Club',
  'bmw championship':        'Castle Pines Golf Club',
  '3m open':                 'TPC Twin Cities',
  'rocket classic':          'Detroit Golf Club',
  'john deere':              'TPC Deere Run',
  'wyndham':                 'Sedgefield Country Club',
  'northern trust':          'Liberty National Golf Club',
  'mexico open':             'Vidanta Vallarta',
  'scottish open':           'The Renaissance Club',
  'open championship':       'Royal Liverpool',
  'truist championship':     'Quail Hollow Club'
};

function findCourseCoords(venueName, eventName) {
  if (!venueName && eventName) {
    var elow = eventName.toLowerCase();
    for (var ek in EVENT_TO_COURSE) {
      if (elow.indexOf(ek) !== -1) { venueName = EVENT_TO_COURSE[ek]; break; }
    }
  }
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
    // Query a 6-week range so we get the next event even when the current one is still listed by /scoreboard alone.
    function fmt(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
    var now = new Date();
    var end = new Date(now.getTime() + 42 * 86400000);
    var url = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=' + fmt(now) + '-' + fmt(end) + '&limit=20';
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      _nextEventFetched = false; // allow retry
      if (typeof termDiag === 'function') termDiag('Schedule fetch HTTP ' + res.status, true);
      return;
    }
    var data = await res.json();
    var events = (data && data.events) || [];
    var nowMs = Date.now();
    var upcoming = events
      .map(function(e) { return { ev: e, start: e.date ? new Date(e.date).getTime() : 0 }; })
      .filter(function(x) { return x.start > nowMs && x.ev.id !== EVENT_ID; })
      .sort(function(a, b) { return a.start - b.start; });
    if (typeof termDiag === 'function') termDiag('Schedule: ' + events.length + ' events, ' + upcoming.length + ' upcoming');
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
      var coords = findCourseCoords(courseName);
      if (typeof termDiag === 'function') termDiag('Next: ' + _nextEvent.name + ' @ ' + courseName + (coords ? ' (coords found)' : ' (no coords)'), !coords);
      if (coords && _nextEvent.date) {
        _nextEventForecast = await fetchForecast(coords.lat, coords.lon);
        if (typeof termDiag === 'function') termDiag('Forecast: ' + (_nextEventForecast ? 'loaded' : 'failed'), !_nextEventForecast);
      }
      renderTerminal();
    } else {
      _nextEvent = { name: 'No upcoming event', course: '', date: null };
      renderTerminal();
    }
  } catch (err) {
    _nextEventFetched = false;
    if (typeof termDiag === 'function') termDiag('Schedule fetch threw: ' + err.message, true);
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

var _currentEventForecast = null;

function renderTermWeatherBar() {
  var el = document.getElementById('term-wx-bar');
  if (!el) { console.warn('🌦️ #term-wx-bar element missing'); return; }
  // Always show weather. Source depends on tournament state:
  //   • TOURNEY_FINAL true  → NEXT event (between-events window)
  //   • otherwise           → CURRENT event (live or pre-tournament)
  document.body.classList.remove('wx-hidden');

  var isFinal = (typeof TOURNEY_FINAL !== 'undefined' && TOURNEY_FINAL);
  var evName, evCourse, evDate, endDate, forecast, tag;
  if (isFinal) {
    tag = 'NEXT';
    if (!_nextEvent && !_nextEventFetched) fetchNextEvent();
    if (!_nextEvent) {
      el.innerHTML = '<span class="wxb-tag">NEXT</span> <span class="wxb-course">loading…</span>';
      return;
    }
    evName = _nextEvent.name; evCourse = _nextEvent.course;
    evDate = _nextEvent.date; endDate = _nextEvent.endDate;
    forecast = _nextEventForecast;
  } else {
    tag = 'LIVE';
    evName = (typeof TOURNEY_NAME !== 'undefined' ? TOURNEY_NAME : '') || '';
    evCourse = (typeof TOURNEY_COURSE !== 'undefined' ? TOURNEY_COURSE : '') || '';
    forecast = _currentEventForecast;
    if (typeof termDiag === 'function') termDiag('WX: LIVE ' + (evName || '?') + ' @ ' + (evCourse || '?') + ' · fc=' + (forecast ? 'ok' : 'pending'));
    if (!evName && !evCourse) {
      el.innerHTML = '<span class="wxb-tag">LIVE</span> <span class="wxb-course">loading…</span>';
      return;
    }
  }

  // Retry forecast if missing — pass event name as fallback so we can still
  // resolve coords when ESPN hasn't populated venue for scheduled events.
  if (!forecast) {
    var c = findCourseCoords(evCourse, evName);
    if (c) {
      // If course was missing but we resolved via event name, fill the display
      if (!evCourse) {
        var elow = (evName || '').toLowerCase();
        for (var ek in EVENT_TO_COURSE) {
          if (elow.indexOf(ek) !== -1) { evCourse = EVENT_TO_COURSE[ek]; break; }
        }
      }
      fetchForecast(c.lat, c.lon).then(function(f) {
        if (!f) return;
        if (isFinal) _nextEventForecast = f; else _currentEventForecast = f;
        renderTermWeatherBar();
      });
    }
  }

  var parts = ['<span class="wxb-tag">' + tag + '</span>'];
  if (evName)   parts.push('<span class="wxb-event">' + termEsc(evName) + '</span>');
  if (evCourse) parts.push('<span class="wxb-sep">·</span> <span class="wxb-course">' + termEsc(evCourse) + '</span>');

  var f = forecast;
  if (f && f.time) {
    var dayLabels = ['THU', 'FRI', 'SAT', 'SUN'];
    // Anchor to the nearest Thursday — either the event's start date (if known)
    // or this week's Thursday (for live events with no date object).
    var start;
    if (evDate) {
      start = new Date(evDate);
    } else {
      start = new Date();
    }
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

  if (isFinal && evDate) {
    var days = Math.max(0, Math.ceil((evDate.getTime() - Date.now()) / 86400000));
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
    var rowKey = (r.entry.team + '|' + (r.entry.email || r.entry.entrant || '')).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var isExpanded = _expandedEntryKey === rowKey;
    var cls = [r.isMine ? 'is-mine' : '', r.isMoney ? 'is-money' : '', 'std-clickable', isExpanded ? 'is-expanded' : ''].filter(Boolean).join(' ');
    var html = '<tr class="' + cls + '" onclick="openEntryDetails(\'' + rowKey + '\')">'
      + '<td class="tpt-pos">' + r.rank + '</td>'
      + '<td class="tpt-name">' + (isExpanded ? '▾ ' : '▸ ') + termEsc(r.entry.team) + '</td>'
      + '<td class="tpt-score ' + scoreCls(r.total) + '">' + fmtScore(r.total) + '</td>'
      + '<td class="tpt-today ' + todayCl + '">' + termEsc(todayDisp) + '</td>'
      + '<td class="tpt-thru">' + (r.holes > 0 ? r.holes : 'F') + '</td>'
      + '</tr>';
    if (isExpanded) html += _buildEntryDetailRow(r.entry, 5);
    return html;
  }).join('');

  var meta = document.getElementById('std-meta');
  if (meta) {
    var locked = (typeof isTournamentLive === 'function') && !isTournamentLive();
    meta.textContent = ranked.length + ' entries' + (locked ? ' · 🔒 picks locked' : '');
  }
}

// ── Render Movers (flame/ice) ──────────────────────────

function renderTermActivity() {
  var body = document.getElementById('term-act-body');
  if (!body) return;

  // Pool Pick Heatmap — counts how many entries picked each team / golfer.
  // Works pre-tournament (the movers branch below needs round data).
  var entries = (typeof ENTRIES !== 'undefined' && ENTRIES) ? ENTRIES : [];
  if (entries.length) {
    var counts = {};
    entries.forEach(function(e) {
      (e.picks || []).forEach(function(p) {
        counts[p] = (counts[p] || 0) + 1;
      });
    });
    var pickRows = Object.keys(counts).map(function(name) {
      return { name: name, count: counts[name] };
    }).sort(function(a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
    if (pickRows.length) {
      var maxCount = pickRows[0].count;
      var totalEntries = entries.length;
      body.innerHTML = pickRows.slice(0, 80).map(function(r, i) {
        var pct = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
        var share = totalEntries > 0 ? Math.round((r.count / totalEntries) * 100) : 0;
        var heat = r.count >= maxCount * 0.75 ? 'ph-hot' :
                   r.count >= maxCount * 0.4  ? 'ph-warm' :
                   r.count >= maxCount * 0.15 ? 'ph-cool' : 'ph-cold';
        return '<div class="ph-row ' + heat + '">'
          + '<div class="ph-rank">' + (i + 1) + '</div>'
          + '<div class="ph-name">' + termEsc(r.name) + '</div>'
          + '<div class="ph-bar"><div class="ph-bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>'
          + '<div class="ph-count">' + r.count + '</div>'
          + '<div class="ph-share">' + share + '%</div>'
          + '</div>';
      }).join('');
      var metaP = document.getElementById('act-meta');
      if (metaP) metaP.textContent = pickRows.length + ' picks · ' + totalEntries + ' entries';
      return;
    }
  }

  // Fall-through: movers view for live play with no entries loaded
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
    var empty = '<div class="empty">Tap LOG IN above to choose your username and link your entries</div>';
    body.innerHTML = isFinal ? renderCourseStatsBlock() : empty;
    var mm = document.getElementById('my-meta');
    if (mm) mm.textContent = isFinal ? 'course' : '—';
    return;
  }

  // Team-event entries (Zurich-style) carry tierPicks + team-pair pick strings.
  // Always render these as tier blocks — scoring individual golfer strings
  // against GOLFER_SCORES is wrong (picks are pairs) and was surfacing the
  // score=11 "missed cut" sentinel as "+11" per pick. When team-event-aware
  // scoring lands, pre-live render will switch to a scored view.
  var anyTeamEvent = teams.some(function(t) { return t.isTeamEvent || (t.tierPicks && Object.keys(t.tierPicks).some(function(k) { return t.tierPicks[k].length; })); });
  if (anyTeamEvent) {
    body.innerHTML = teams.map(function(t, idx) {
      var entrant = t.entrant ? '<span class="my-entry-by">' + termEsc(t.entrant) + ' · </span>' : '';
      var tb = t.tieBreaker ? '<span class="my-tb">TB: <strong>' + termEsc(t.tieBreaker) + '</strong></span>' : '';
      var tierLabels = { tier1: 'T1 Favorites', tier2: 'T2 Contenders', tier3: 'T3 Midfield', tier4: 'T4 Longshots' };
      var tiersHtml = '';
      ['tier1', 'tier2', 'tier3', 'tier4'].forEach(function(k) {
        var picks = (t.tierPicks && t.tierPicks[k]) || [];
        if (!picks.length) return;
        tiersHtml += '<div class="my-tier-group">'
          + '<div class="my-tier-lbl">' + tierLabels[k] + '</div>'
          + picks.map(function(p) { return '<div class="my-tier-pick">' + termEsc(p) + '</div>'; }).join('')
          + '</div>';
      });
      return '<div class="my-entry-block">'
        + '<div class="my-entry-header">'
        +   '<span class="my-entry-name">' + termEsc(t.team) + '</span>'
        +   '<span class="my-entry-rank">#' + (idx + 1) + ' of ' + teams.length + '</span>'
        + '</div>'
        + '<div class="my-entry-stats">' + entrant + '<span class="my-pre-tag">PRE-TOURNAMENT</span>' + tb + '</div>'
        + tiersHtml
        + '</div>';
    }).join('');
    var meta2 = document.getElementById('my-meta');
    if (meta2) meta2.textContent = teams.length + ' ' + (teams.length === 1 ? 'entry' : 'entries');
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
  // Prefer team rows when the current DG payload is a team event.
  var teamRows = (typeof DG_TEAM_PREDS !== 'undefined' && DG_TEAM_PREDS) ? DG_TEAM_PREDS : [];
  var dg = (typeof DG_LIVE_PREDS !== 'undefined') ? DG_LIVE_PREDS : {};
  var names = Object.keys(dg);
  if (!names.length && !teamRows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Loading DataGolf odds…</td></tr>';
    var metaE = document.getElementById('dg-meta');
    if (metaE) metaE.textContent = '—';
    return;
  }

  var rows;
  if (teamRows.length) {
    rows = teamRows.map(function(t) {
      return {
        name: t.display || t.team_name,
        win: t.win || 0, top_5: t.top_5 || 0, top_10: t.top_10 || 0,
        top_20: t.top_20 || 0, make_cut: t.make_cut || 0
      };
    });
  } else {
    rows = names.map(function(n) {
      var d = dg[n];
      return { name: n, win: d.win || 0, top_5: d.top_5 || 0, top_10: d.top_10 || 0, top_20: d.top_20 || 0, make_cut: d.make_cut || 0 };
    });
  }

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
    // Team-event rows already encode flags inline in the name ("🏴 A / 🏴 B"),
    // so skip the prefix when no FLAGS lookup matches to avoid a leading space.
    var nameCell = flag ? (flag + ' ' + termEsc(r.name)) : termEsc(r.name);
    return '<tr>'
      + '<td class="tpt-name">' + nameCell + '</td>'
      + pctCell(r.make_cut)
      + pctCell(r.top_20)
      + pctCell(r.top_10)
      + pctCell(r.top_5)
      + pctCell(r.win)
      + '</tr>';
  }).join('');

  var meta = document.getElementById('dg-meta');
  if (meta) {
    var parts = [rows.length + ' players'];
    var dgEvent = (typeof DG_META !== 'undefined' && DG_META.event_name) || '';
    var curEvent = (typeof TOURNEY_NAME !== 'undefined' && TOURNEY_NAME) || '';
    var norm = function(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var stale = dgEvent && curEvent && norm(dgEvent) !== norm(curEvent);
    if (dgEvent) parts.push((stale ? '⚠ ' : '') + dgEvent);
    if (DG_META && DG_META.source) parts.push(DG_META.source);
    if (DG_META && DG_META.last_updated) parts.push(DG_META.last_updated);
    meta.textContent = parts.join(' · ');
    meta.title = stale
      ? 'DataGolf is still showing ' + dgEvent + ' — odds for ' + curEvent + ' not yet published'
      : '';
    meta.style.color = stale ? 'var(--warn, #e0a030)' : '';
  }
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
  if (typeof updateTermLoginButton === 'function') updateTermLoginButton();

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
