// ── App Initialization ──────────────────────────────────────

function renderAll() {
  _renderCount++;
  renderStandings();
  renderLeaderboard();
  renderOwnership();
  renderTicker();
  if (compareMode && cmpSelections.length === 2) renderH2HInline();
  if (_debugOpen) renderDebugPanel();
}

// Pull-to-refresh for leaderboard
(function() {
  var view = document.getElementById('view-leaderboard');
  var ptr = document.getElementById('ptr-indicator');
  var ptrText = ptr.querySelector('.ptr-text');
  var threshold = 80;
  var startY = 0, pulling = false, armed = false, refreshing = false;

  view.addEventListener('touchstart', function(e) {
    if (refreshing || view.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
    armed = false;
    ptr.classList.remove('releasing', 'armed', 'refreshing');
  }, { passive: true });

  view.addEventListener('touchmove', function(e) {
    if (!pulling || refreshing) return;
    var dy = Math.max(0, e.touches[0].clientY - startY);
    if (dy === 0) return;
    var dist = Math.min(dy * 0.5, 80);
    ptr.style.height = dist + 'px';
    if (dist >= threshold && !armed) {
      armed = true;
      ptr.classList.add('armed');
      ptrText.textContent = 'Release to refresh';
    } else if (dist < threshold && armed) {
      armed = false;
      ptr.classList.remove('armed');
      ptrText.textContent = 'Pull to refresh';
    }
  }, { passive: true });

  view.addEventListener('touchend', function() {
    if (!pulling) return;
    pulling = false;
    if (armed && !refreshing) {
      refreshing = true;
      ptr.classList.remove('armed');
      ptr.classList.add('refreshing', 'releasing');
      ptr.style.height = '40px';
      ptrText.textContent = 'Refreshing…';
      trackEvent('pull-to-refresh');
      var startTime = Date.now();
      fetchESPN().finally(function() {
        var elapsed = Date.now() - startTime;
        var delay = Math.max(0, 1000 - elapsed);
        setTimeout(function() {
          refreshing = false;
          ptr.classList.add('releasing');
          ptr.classList.remove('refreshing');
          ptr.style.height = '0px';
          ptrText.textContent = 'Pull to refresh';
          setTimeout(function() { ptr.classList.remove('releasing'); }, 300);
        }, delay);
      });
    } else {
      ptr.classList.add('releasing');
      ptr.style.height = '0px';
      setTimeout(function() { ptr.classList.remove('releasing', 'armed'); }, 300);
    }
  }, { passive: true });
})();

// ── Main Init ──────────────────────────────────────────────

async function initApp() {
  ENTRIES.forEach(function(e) { e.picks = e.picks.map(resolvePlayerName); });
  allTeamEmails = [].concat(Array.from(new Set(ENTRIES.map(function(e) { return e.email; })))).sort();
  OWNERSHIP_DATA = computeOwnership();
  console.log('✅ Loaded', ENTRIES.length, 'baked-in entries');

  var returning = loadUser();
  if (returning) {
    console.log('👤 Returning user:', currentUserEmail);
  }
  if (!shouldShowSplash()) {
    var sp = document.getElementById('splash');
    if (sp) { sp.style.display = 'none'; sp.classList.add('hidden'); }
  }

  updateLbSeg();

  Object.keys(FLAGS).forEach(function(name) {
    if (!GOLFER_SCORES[name]) {
      GOLFER_SCORES[name] = { pos: '—', score: 0, thru: '—', teeTime: '—', startHole: 1, tot: null, todayDisplay: '—', r1: null, r2: null, r3: null, r4: null };
    }
  });

  renderAll();

  await fetchESPN().catch(function() { setApiStatus('cached', 'Offline'); });

  renderAll();
  startAutoRefresh();
  startAgeTimer();
}

document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  initDebugPanel();

  // Hide debug panel by default — only show via ?debug=true, long-press, or backtick
  var debugPanel = document.getElementById('debug-panel');
  if (!_debugOpen) {
    debugPanel.hidden = true;
  } else {
    debugPanel.hidden = false;
  }

  initApp();

  // Close team dropdown on outside click
  document.addEventListener('click', function(e) {
    if (_teamDdOpen && !e.target.closest('#hdr-team-display') && !e.target.closest('#team-dropdown')) {
      closeTeamDropdown();
    }
  });
});
