// ── Debug Panel ──────────────────────────────────────────

var _debugOpen = sessionStorage.getItem('debugOpen') === '1';
var _debugTapCount = 0;
var _debugTapTimer = null;
var _debugTab = 'overview';
var _debugErrFilter = 'all';
var _debugPlayerSearch = '';

function toggleDebugPanel() {
  _debugOpen = !_debugOpen;
  sessionStorage.setItem('debugOpen', _debugOpen ? '1' : '0');
  document.getElementById('debug-panel').classList.toggle('open', _debugOpen);
  if (_debugOpen) renderDebugPanel();
}

function debugSwitchTab(tab, btn) {
  _debugTab = tab;
  document.querySelectorAll('.debug-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  renderDebugPanel();
}

function debugJumpTab(tab) {
  _debugTab = tab;
  document.querySelectorAll('.debug-tab').forEach(function(t) {
    t.classList.toggle('active', t.textContent.trim().toLowerCase() === tab);
  });
  renderDebugPanel();
}

function debugClearLog() {
  ErrorTracker.log.length = 0;
  DebugPerf.network.length = 0;
  renderDebugPanel();
}

function debugCopyEntry(text) {
  navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2)).then(function() {
    showToast('Copied to clipboard');
  }).catch(function() {
    showToast('Copy failed');
  });
}

function debugExport() {
  var data = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    errors: ErrorTracker.log,
    network: DebugPerf.network,
    golferCount: Object.keys(GOLFER_SCORES).length,
    entryCount: ENTRIES.length
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'eastpole-debug-' + Date.now() + '.json';
  a.click();
}

function explainError(e) {
  var msg = (e.message || '').toLowerCase();
  var detail = e.detail ? JSON.stringify(e.detail) : '';
  var detailLower = detail.toLowerCase();

  if (msg.includes('scorecard') && msg.includes('incomplete')) {
    var player = e.detail?.player || 'a player';
    var holes = e.detail?.holesReceived?.length || '?';
    return '⛳ <b>' + escHtml(player) + '</b> only has ' + holes + ' of 18 holes loaded. This usually means they\'re still playing their round, or ESPN hasn\'t updated all holes yet. The missing holes show as dashes on the scorecard.';
  }
  if (msg.includes('scorecard api')) {
    var player = e.detail?.player || 'a player';
    return '📡 Couldn\'t load the hole-by-hole scorecard for <b>' + escHtml(player) + '</b>. ESPN\'s scorecard endpoint returned an error. Tapping their row again will retry.';
  }
  if (msg.includes('scorecard $ref')) {
    var player = e.detail?.player || 'a player';
    return '📡 ESPN sends scorecard data in pages. We tried to load the full set of holes for <b>' + escHtml(player) + '</b> but the follow-up request failed. Some holes may show as dashes.';
  }
  if (msg.includes('espn leaderboard') && msg.includes('failed')) {
    var status = e.detail?.status || '?';
    return '📡 The main ESPN leaderboard API returned status ' + status + '. This means ESPN\'s servers are either down or rate-limiting us. Scores will auto-retry in 60 seconds.';
  }
  if (msg.includes('espn') && msg.includes('parse')) {
    return '🔧 Got data back from ESPN but couldn\'t make sense of it. The response format may have changed, or the data was incomplete. Scores should recover on the next auto-refresh.';
  }
  if (msg.includes('course holes')) {
    return '⛳ Couldn\'t load par/yardage info for the course. Scorecards will still work but won\'t show par comparisons.';
  }
  if (msg.includes('fetch failed') || msg.includes('network')) {
    return '📶 A network request failed — you might be offline or have a weak connection. The app will keep retrying every 60 seconds.';
  }

  if (e.type === 'js') {
    if (msg.includes('undefined') || msg.includes('null')) {
      return '🐛 A piece of code tried to use data that doesn\'t exist yet. This can happen if the page loads before ESPN data arrives. Usually resolves on next refresh.';
    }
    if (msg.includes('typeerror')) {
      return '🐛 JavaScript type error — a function received unexpected data. This is a code bug that should be reported.';
    }
    return '🐛 An unexpected JavaScript error occurred. If this keeps happening, it may indicate a bug. Details: <i>' + escHtml(msg) + '</i>';
  }

  if (e.type === 'render') {
    return '🎨 Something went wrong while drawing the page. This is usually temporary and fixes itself on the next data refresh.';
  }

  if (e.detail) {
    return '⚠️ ' + escHtml(e.message) + '<br><small style="color:rgba(255,255,255,0.5)">Raw detail: ' + escHtml(detail.substring(0, 200)) + '</small>';
  }
  return '⚠️ ' + escHtml(e.message) + ' — No additional details available.';
}

function renderDebugPanel() {
  var body = document.getElementById('debug-body');
  if (!body) return;

  if (_debugTab === 'overview') {
    var errs = ErrorTracker.log;
    var apiErrs = errs.filter(function(e) { return e.type === 'api'; }).length;
    var jsErrs = errs.filter(function(e) { return e.type === 'js'; }).length;
    var renderErrs = errs.filter(function(e) { return e.type === 'render'; }).length;
    var nets = DebugPerf.network;
    var avgLatency = nets.length ? Math.round(nets.reduce(function(s, n) { return s + n.duration; }, 0) / nets.length) : 0;
    var failedReqs = nets.filter(function(n) { return !n.ok; }).length;
    var lastFetch = nets.length ? nets[nets.length - 1] : null;
    var uptime = Math.floor(performance.now() / 1000);
    var uptimeStr = uptime > 3600 ? Math.floor(uptime / 3600) + 'h ' + Math.floor((uptime % 3600) / 60) + 'm' : Math.floor(uptime / 60) + 'm ' + (uptime % 60) + 's';

    body.innerHTML = '<div class="debug-stat-grid">'
      + '<div class="debug-stat' + (errs.length ? ' clickable' : '') + '" onclick="debugJumpTab(\'errors\')"><div class="debug-stat-label">Total Errors</div><div class="debug-stat-value ' + (errs.length === 0 ? 'good' : errs.length < 5 ? 'warn' : 'bad') + '">' + errs.length + '</div></div>'
      + '<div class="debug-stat' + (apiErrs ? ' clickable' : '') + '" onclick="debugJumpTab(\'errors\')"><div class="debug-stat-label">API Errors</div><div class="debug-stat-value ' + (apiErrs === 0 ? 'good' : 'bad') + '">' + apiErrs + '</div></div>'
      + '<div class="debug-stat' + (jsErrs ? ' clickable' : '') + '" onclick="debugJumpTab(\'errors\')"><div class="debug-stat-label">JS Errors</div><div class="debug-stat-value ' + (jsErrs === 0 ? 'good' : 'bad') + '">' + jsErrs + '</div></div>'
      + '<div class="debug-stat' + (renderErrs ? ' clickable' : '') + '" onclick="debugJumpTab(\'errors\')"><div class="debug-stat-label">Render Errors</div><div class="debug-stat-value ' + (renderErrs === 0 ? 'good' : 'bad') + '">' + renderErrs + '</div></div>'
      + '<div class="debug-stat' + (avgLatency >= 500 ? ' clickable' : '') + '" onclick="debugJumpTab(\'network\')"><div class="debug-stat-label">Avg Latency</div><div class="debug-stat-value ' + (avgLatency < 500 ? 'good' : avgLatency < 2000 ? 'warn' : 'bad') + '">' + avgLatency + 'ms</div></div>'
      + '<div class="debug-stat' + (failedReqs ? ' clickable' : '') + '" onclick="debugJumpTab(\'network\')"><div class="debug-stat-label">Failed Requests</div><div class="debug-stat-value ' + (failedReqs === 0 ? 'good' : 'bad') + '">' + failedReqs + '</div></div>'
      + '<div class="debug-stat"><div class="debug-stat-label">Golfers Loaded</div><div class="debug-stat-value">' + Object.keys(GOLFER_SCORES).length + '</div></div>'
      + '<div class="debug-stat"><div class="debug-stat-label">Session Uptime</div><div class="debug-stat-value">' + uptimeStr + '</div></div>'
      + '</div>';

  } else if (_debugTab === 'errors') {
    var allErrs = ErrorTracker.log.slice().reverse();
    var filtered = _debugErrFilter === 'all' ? allErrs : allErrs.filter(function(e) { return e.type === _debugErrFilter; });
    var filterHtml = '<div style="display:flex;gap:4px;margin-bottom:8px">';
    ['all', 'api', 'js', 'render'].forEach(function(f) {
      var cnt = f === 'all' ? allErrs.length : allErrs.filter(function(e) { return e.type === f; }).length;
      filterHtml += '<button onclick="_debugErrFilter=\'' + f + '\';renderDebugPanel()" style="padding:3px 8px;font-size:9px;border-radius:4px;border:1px solid ' + (_debugErrFilter === f ? 'var(--gold)' : 'rgba(255,255,255,0.15)') + ';background:' + (_debugErrFilter === f ? 'rgba(212,168,67,0.2)' : 'none') + ';color:' + (_debugErrFilter === f ? 'var(--gold)' : 'var(--text3)') + ';cursor:pointer;font-family:inherit;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">' + f + ' (' + cnt + ')</button>';
    });
    filterHtml += '</div>';
    if (!filtered.length) { body.innerHTML = filterHtml + '<div class="debug-empty">No ' + (_debugErrFilter === 'all' ? '' : '' + _debugErrFilter + ' ') + 'errors logged</div>'; return; }
    body.innerHTML = filterHtml + filtered.map(function(e, i) {
      var t = e.ts.split('T')[1].substring(0, 8);
      var plain = explainError(e);
      return '<div class="debug-row debug-expandable" onclick="this.classList.toggle(\'expanded\')">'
        + '<span class="ts">' + t + '</span><span class="tag ' + e.type + '">' + e.type + '</span>'
        + '<span class="msg">' + escHtml(e.message) + '</span>'
        + '<span class="debug-copy-btn" onclick="event.stopPropagation();debugCopyEntry(' + JSON.stringify(JSON.stringify(e)).replace(/"/g, '&quot;') + ')">⧉</span>'
        + '<span class="debug-expand-icon">▸</span>'
        + '<div class="debug-explain">' + plain + '</div>'
        + '</div>';
    }).join('');

  } else if (_debugTab === 'players') {
    var html = '<div style="margin-bottom:8px"><input id="debug-player-search" type="text" placeholder="Search player..." value="' + escHtml(_debugPlayerSearch) + '" oninput="_debugPlayerSearch=this.value;renderDebugPanel()" style="width:100%;padding:6px 10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-family:inherit;font-size:11px;box-sizing:border-box"></div>';
    var names = Object.keys(GOLFER_SCORES).sort();
    var q = _debugPlayerSearch.toLowerCase();
    var matches = q ? names.filter(function(n) { return n.toLowerCase().includes(q); }) : names.slice(0, 20);
    if (!matches.length) { body.innerHTML = html + '<div class="debug-empty">' + (q ? 'No player found for "' + escHtml(q) + '"' : 'No golfer data loaded') + '</div>'; return; }
    html += matches.map(function(name) {
      var g = GOLFER_SCORES[name];
      var prev = PREV_SCORES[name];
      var diff = prev !== undefined && g.score !== prev ? (g.score - prev) : null;
      var diffStr = diff !== null ? (diff > 0 ? '<span style="color:#FF7F7F">+' + diff + '</span>' : '<span style="color:#34c759">' + diff + '</span>') : '';
      var holesLeft = getHolesRemaining(name);
      var inPool = ENTRIES.some(function(e) { return e.picks.includes(name); });
      return '<div class="debug-row" style="flex-wrap:wrap;gap:4px">'
        + '<div style="display:flex;align-items:center;gap:6px;width:100%">'
        + '<span style="font-weight:700;color:#fff;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (FLAGS[name] || '') + ' ' + name + '</span>'
        + (inPool ? '<span style="font-size:8px;background:rgba(212,168,67,0.2);color:var(--gold);padding:1px 5px;border-radius:3px;font-weight:700">POOL</span>' : '')
        + '<span class="debug-copy-btn" onclick="debugCopyEntry(\'' + name.replace(/'/g, "\\'") + ': \'+JSON.stringify(GOLFER_SCORES[\'' + name.replace(/'/g, "\\'") + '\']))">⧉</span>'
        + '</div>'
        + '<div style="display:flex;gap:10px;width:100%;font-size:10px;color:var(--text3)">'
        + '<span>Pos: <b style="color:#fff">' + g.pos + '</b></span>'
        + '<span>Score: <b class="' + cls(g.score) + '">' + fmt(g.score) + '</b>' + (diffStr ? ' ' + diffStr : '') + '</span>'
        + '<span>Thru: <b style="color:#fff">' + g.thru + '</b></span>'
        + '<span>Holes left: <b style="color:#fff">' + holesLeft + '</b></span>'
        + '</div>'
        + '<div style="display:flex;gap:10px;width:100%;font-size:10px;color:var(--text3)">'
        + '<span>R1:' + (g.r1 || '—') + '</span><span>R2:' + (g.r2 || '—') + '</span><span>R3:' + (g.r3 || '—') + '</span><span>R4:' + (g.r4 || '—') + '</span>'
        + '<span>Tot:' + (g.tot || '—') + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
    if (!q) html += '<div class="debug-empty">Showing first 20 of ' + names.length + ' players. Type to search.</div>';
    body.innerHTML = html;
    var si = document.getElementById('debug-player-search');
    if (si && document.activeElement !== si) { si.focus(); si.selectionStart = si.selectionEnd = si.value.length; }

  } else if (_debugTab === 'network') {
    var nets = DebugPerf.network.slice().reverse();
    if (!nets.length) { body.innerHTML = '<div class="debug-empty">No network requests logged</div>'; return; }
    body.innerHTML = nets.map(function(n) {
      var t = n.ts.split('T')[1].substring(0, 8);
      return '<div class="debug-row"><span class="ts">' + t + '</span><span class="tag perf" style="color:' + (n.ok ? '#34c759' : '#FF7F7F') + '">' + n.status + '</span><span class="msg">' + escHtml(n.url) + ' <span style="color:' + (n.duration < 500 ? '#34c759' : n.duration < 2000 ? '#f5c518' : '#FF7F7F') + '">' + n.duration + 'ms</span></span></div>';
    }).join('');

  } else if (_debugTab === 'perf') {
    var mem = performance.memory ? performance.memory : null;
    var entries = performance.getEntriesByType('navigation')[0];
    var paintEntries = performance.getEntriesByType('paint');
    var fcp = paintEntries.find(function(e) { return e.name === 'first-contentful-paint'; });
    var renderCount = typeof _renderCount !== 'undefined' ? _renderCount : '—';

    body.innerHTML = '<div class="debug-stat-grid">'
      + '<div class="debug-stat"><div class="debug-stat-label">Page Load</div><div class="debug-stat-value">' + (entries ? Math.round(entries.loadEventEnd - entries.startTime) + 'ms' : '—') + '</div></div>'
      + '<div class="debug-stat"><div class="debug-stat-label">First Paint</div><div class="debug-stat-value">' + (fcp ? Math.round(fcp.startTime) + 'ms' : '—') + '</div></div>'
      + '<div class="debug-stat"><div class="debug-stat-label">DOM Nodes</div><div class="debug-stat-value">' + document.querySelectorAll('*').length + '</div></div>'
      + '<div class="debug-stat"><div class="debug-stat-label">Render Cycles</div><div class="debug-stat-value">' + renderCount + '</div></div>'
      + (mem ? '<div class="debug-stat"><div class="debug-stat-label">JS Heap</div><div class="debug-stat-value">' + Math.round(mem.usedJSHeapSize / 1048576) + 'MB</div></div>' : '')
      + (mem ? '<div class="debug-stat"><div class="debug-stat-label">Heap Limit</div><div class="debug-stat-value">' + Math.round(mem.jsHeapSizeLimit / 1048576) + 'MB</div></div>' : '')
      + '</div>';
  }
}

// Initialize debug panel: long press on Live pill
function initDebugPanel() {
  var pill = document.querySelector('.hdr-pill');
  if (pill) {
    var pressTimer = null;
    pill.addEventListener('touchstart', function(e) { pressTimer = setTimeout(function() { e.preventDefault(); toggleDebugPanel(); }, 700); }, { passive: false });
    pill.addEventListener('touchend', function() { clearTimeout(pressTimer); });
    pill.addEventListener('touchmove', function() { clearTimeout(pressTimer); });
    pill.addEventListener('mousedown', function() { pressTimer = setTimeout(function() { toggleDebugPanel(); }, 700); });
    pill.addEventListener('mouseup', function() { clearTimeout(pressTimer); });
    pill.addEventListener('mouseleave', function() { clearTimeout(pressTimer); });
  }

  // Also support ?debug=true URL parameter
  var params = new URLSearchParams(window.location.search);
  if (params.get('debug') === 'true') {
    _debugOpen = true;
  }

  // Keyboard toggle with backtick key
  window.addEventListener('keydown', function(e) {
    if (e.key === '`') {
      _debugOpen = !_debugOpen;
      sessionStorage.setItem('debugOpen', _debugOpen ? '1' : '0');
      document.getElementById('debug-panel').classList.toggle('open', _debugOpen);
      if (_debugOpen) renderDebugPanel();
    }
  });

  // Restore debug panel if was open
  if (_debugOpen) {
    document.getElementById('debug-panel').classList.add('open');
    renderDebugPanel();
  }
}
