// ── App Initialization ──────────────────────────────────────

function renderAll() {
  _renderCount++;
  renderStandings();
  renderLeaderboard();
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

  function resetPtr() {
    pulling = false;
    armed = false;
    refreshing = false;
    ptr.style.height = '0px';
    ptr.className = 'ptr-indicator';
    ptrText.textContent = 'Pull to refresh';
  }

  view.addEventListener('touchstart', function(e) {
    if (refreshing || view.scrollTop > 5) return;
    startY = e.touches[0].clientY;
    pulling = true;
    armed = false;
    ptr.classList.remove('releasing', 'armed', 'refreshing');
  }, { passive: true });

  view.addEventListener('touchmove', function(e) {
    if (!pulling || refreshing) return;
    var dy = Math.max(0, e.touches[0].clientY - startY);
    if (dy === 0) { pulling = false; return; }
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

  function cancelPull() {
    if (!pulling) return;
    pulling = false;
    armed = false;
    ptr.classList.add('releasing');
    ptr.style.height = '0px';
    setTimeout(function() { ptr.classList.remove('releasing', 'armed'); }, 300);
  }
  view.addEventListener('touchcancel', cancelPull, { passive: true });

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
      // Safety timeout: force reset after 10s if fetch hangs
      var safetyTimer = setTimeout(resetPtr, 10000);
      var startTime = Date.now();
      fetchESPN().catch(function() {}).then(function() {
        clearTimeout(safetyTimer);
        var elapsed = Date.now() - startTime;
        var delay = Math.max(0, 800 - elapsed);
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
  try {
    console.log('🚀 initApp() starting');
    ENTRIES.forEach(function(e) { e.picks = e.picks.map(resolvePlayerName); });
    allTeamEmails = [].concat(Array.from(new Set(ENTRIES.map(function(e) { return e.email; })))).sort();
    OWNERSHIP_DATA = computeOwnership();
    console.log('✅ Loaded', ENTRIES.length, 'baked-in entries');

    var returning = loadUser();
    if (returning) {
      console.log('👤 Returning user:', currentUserEmail);
      trackEvent('returning-user');
      trackEvent('returning-entries-' + currentUserTeams.length);
    } else {
      trackEvent('new-visitor');
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
    console.log('✅ renderAll() complete');

    await fetchESPN().catch(function() { setApiStatus('cached', 'Offline'); });

    renderAll();
    startAutoRefresh();
    startAgeTimer();
    console.log('✅ initApp() complete - splash should be clickable now');
  } catch(e) {
    console.error('❌ Error in initApp():', e, e.stack);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Reset Safari zoom on load
  var vp = document.querySelector('meta[name="viewport"]');
  if (vp) { vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'); }

  // Tag body when running as a home-screen webapp so layout can collapse
  // padding meant to clear Safari's URL bar. iOS Safari's
  // display-mode: standalone media query only matches on 16.4+, so we
  // also check navigator.standalone (the iOS-classic flag) to cover
  // older devices.
  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
  if (isStandalone) document.body.classList.add('is-standalone');

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

  // Ensure splash click handler works (backup for inline onclick)
  console.log('📍 Setting up splash event listener');
  var splash = document.getElementById('splash');
  if (splash) {
    console.log('✅ Splash element found, attaching click handler');
    splash.addEventListener('click', function(e) {
      console.log('🖱️ Splash clicked, enterApp() should fire');
      enterApp();
    });
  } else {
    console.error('❌ Splash element not found!');
  }

  // Close team dropdown on outside click
  document.addEventListener('click', function(e) {
    if (_teamDdOpen && !e.target.closest('#hdr-team-display') && !e.target.closest('#team-dropdown')) {
      closeTeamDropdown();
    }
  });
});
