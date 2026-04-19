// ── Header, Navigation, Onboarding, Theme ──────────────────

function updateHeaderDisplay() {
  var teamDisplay = document.getElementById('hdr-team-display');
  var joinBtn = document.getElementById('hdr-join-btn');
  var nameEl = document.getElementById('hdr-active-team');
  var caret = document.getElementById('hdr-dd-caret');
  if (currentUserEmail && currentUserTeams.length) {
    var activeTeam = activeTeamIdx >= 0 ? currentUserTeams[activeTeamIdx] : null;
    nameEl.textContent = activeTeam ? activeTeam.team : 'My Entry';
    if (caret) caret.style.display = currentUserTeams.length > 1 ? 'inline' : 'none';
    teamDisplay.style.display = 'block';
    joinBtn.style.display = 'none';
  } else {
    teamDisplay.style.display = 'none';
    joinBtn.style.display = 'block';
    closeTeamDropdown();
  }
}

function updateHeaderTeam() { updateHeaderDisplay(); }

var _teamDdOpen = false;

function toggleTeamDropdown() {
  if (!currentUserTeams.length) return;
  if (currentUserTeams.length === 1) { showOnboarding(); return; }
  _teamDdOpen ? closeTeamDropdown() : openTeamDropdown();
}

function openTeamDropdown() {
  _teamDdOpen = true;
  var list = document.getElementById('team-dropdown-list');
  list.innerHTML = ' <button class="td-item' + (activeTeamIdx === -1 ? ' active' : '') +
    '" onclick="event.stopPropagation();selectTeamEntry(-1)"> <span style="width:18px;height:14px;font-size:8px;display:flex;align-items:center;justify-content:center;opacity:0.5">⊕</span> <span>All Picks</span> </button>' +
    currentUserTeams.map(function(t, i) {
      return ' <button class="td-item' + (i === activeTeamIdx ? ' active' : '') + '" onclick="event.stopPropagation();selectTeamEntry(' + i + ')"> <span class="team-pill ' + (PILL_CLASSES[i] || '') + '" style="width:18px;height:14px;font-size:8px">' + pillLabel(i) + '</span> <span>' + escHtml(t.team) + '</span> </button>';
    }).join('');
  document.getElementById('team-dropdown').classList.add('open');
  var caret = document.getElementById('hdr-dd-caret');
  if (caret) caret.classList.add('open');
}

function closeTeamDropdown() {
  _teamDdOpen = false;
  document.getElementById('team-dropdown').classList.remove('open');
  var caret = document.getElementById('hdr-dd-caret');
  if (caret) caret.classList.remove('open');
}

function selectTeamEntry(idx) {
  activeTeamIdx = idx;
  trackEvent('entry-filter-' + (idx === -1 ? 'all' : 'single'));
  saveUser();
  updateHeaderDisplay();
  updateLbSeg();
  renderAll();
  closeTeamDropdown();
  showToast(idx === -1 ? '✓ All Picks' : '✓ ' + currentUserTeams[idx].team);
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'light' ? 'dark' : 'light';
  trackEvent('theme-' + next);
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ep-theme', next);
  var btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = next === 'light' ? '☀️ Light' : '🌙 Dark';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'light' ? '#00205B' : '#080d1a');
}

function initTheme() {
  var saved = localStorage.getItem('ep-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  var btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = saved === 'light' ? '☀️ Light' : '🌙 Dark';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', saved === 'light' ? '#00205B' : '#080d1a');
}

var _prevTab = 'leaderboard';

function switchTab(name, btn) {
  trackEvent('tab-' + name);
  // Exit H2H compare mode on any tab switch
  if (compareMode) exitCompareMode();
  // Remember previous tab (but not feedback itself)
  var cur = document.querySelector('.view.active');
  if (cur && cur.id !== 'view-feedback') {
    _prevTab = cur.id.replace('view-', '');
  }
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('view-' + name).classList.add('active');
  btn.classList.add('active');
  document.body.setAttribute('data-active-view', name);
  if (name === 'coffee' && typeof initCoffeeView === 'function') initCoffeeView();
  if (name === 'leaderboard') {
    toggleTickerMode();
    lbSort = 'score'; lbSortAsc = true; lbFilter = 'all';
    var search = document.getElementById('lb-search');
    if (search) search.value = '';
    lbSearch = '';
    updateLbSeg();
    renderLeaderboard();
    document.getElementById('view-leaderboard').scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function closeFeedback() {
  // Return to previous tab
  var tabName = _prevTab || 'leaderboard';
  var btn = document.querySelector('.nav-btn[onclick*="' + tabName + '"]');
  if (btn) {
    switchTab(tabName, btn);
  } else {
    // Fallback: just switch to leaderboard
    var lb = document.querySelector('.nav-btn[onclick*="leaderboard"]');
    if (lb) switchTab('leaderboard', lb);
  }
}

// Feedback form logic
var _rating = 0;

function setRating(n) {
  _rating = n;
  document.querySelectorAll('.fb-view-star').forEach(function(btn, i) {
    btn.classList.toggle('active', i < n);
  });
}

function submitFeedback() {
  var message = document.getElementById('fb-message').value.trim();
  var category = document.getElementById('fb-category').value;
  var name = document.getElementById('fb-name').value.trim() || 'Anonymous';
  var btn = document.getElementById('fb-submit');

  if (!message) { document.getElementById('fb-message').focus(); return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  trackEvent('feedback-' + (category || 'general'));

  fetch('https://formspree.io/f/mjgprdnz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      form_type: 'feedback',
      rating: _rating || 'none',
      category: category || 'general',
      message: message,
      name: name
    })
  }).then(function(res) {
    if (res.ok) {
      document.getElementById('fb-form-wrap').style.display = 'none';
      document.getElementById('fb-success').style.display = 'block';
    } else {
      btn.disabled = false;
      btn.textContent = 'Submit Feedback';
      alert('Something went wrong. Please try again.');
    }
  }).catch(function() {
    btn.disabled = false;
    btn.textContent = 'Submit Feedback';
    alert('Network error. Please try again.');
  });
}

var toastT;
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(function() { t.classList.remove('show'); }, 2400);
}

// ── Onboarding ──────────────────────────────────────────────

var obSelectedEmail = null;

function showOnboarding() {
  obSelectedEmail = currentUserEmail || null;
  buildObList();
  if (obSelectedEmail) document.getElementById('ob-confirm').classList.add('ready');
  var el = document.getElementById('onboarding');
  el.style.display = 'flex';
  el.offsetHeight;
  el.classList.add('visible');
  setTimeout(function() {
    var s = document.getElementById('ob-search');
    if (s) s.focus();
  }, 300);
}

function hideOnboarding() {
  var el = document.getElementById('onboarding');
  el.classList.remove('visible');
  el.style.opacity = '0';
  setTimeout(function() {
    el.style.display = 'none';
    el.style.opacity = '';
  }, 300);
}

function enterApp() {
  try {
    console.log('🎯 enterApp() called');
    markSplashSeen();
    var splash = document.getElementById('splash');
    if (!splash) {
      console.error('❌ Splash element not found');
      return;
    }
    console.log('✅ Splash found, adding hidden class');
    splash.classList.add('hidden');
    setTimeout(function() {
      try {
        console.log('✅ Setting display:none, showing onboarding');
        splash.style.display = 'none';
        if (!currentUserEmail) {
          console.log('📋 Showing onboarding');
          showOnboarding();
        }
        if (!localStorage.getItem(WELCOME_KEY)) {
          console.log('👋 Showing welcome');
          setTimeout(showWelcome, 250);
        }
      } catch(e) {
        console.error('❌ Error in setTimeout:', e);
      }
    }, 500);
  } catch(e) {
    console.error('❌ Error in enterApp():', e);
  }
}

function showWelcome(force) {
  if (!force && localStorage.getItem(WELCOME_KEY)) return;
  var el = document.getElementById('welcome');
  if (!el) return;
  el.style.display = 'flex';
  el.offsetHeight;
  el.classList.add('visible');
}

function hideWelcome() {
  var el = document.getElementById('welcome');
  if (!el) return;
  el.classList.remove('visible');
  setTimeout(function() { el.style.display = 'none'; }, 250);
  try { localStorage.setItem(WELCOME_KEY, '1'); } catch(e) {}
}

function dismissSplashBrowse() {
  trackEvent('splash-browse');
  markSplashSeen();
  var splash = document.getElementById('splash');
  splash.classList.add('hidden');
  hideOnboarding();
  setTimeout(function() { splash.style.display = 'none'; }, 500);
}

function buildObList(filter) {
  if (!filter) filter = '';
  var people = {};
  ENTRIES.forEach(function(e) {
    if (!people[e.email]) people[e.email] = { name: e.name || e.email, email: e.email, teams: [] };
    people[e.email].teams.push(e.team);
  });
  var list = Object.values(people)
    .filter(function(p) {
      if (!filter) return true;
      var q = filter.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.teams.some(function(t) { return t.toLowerCase().includes(q); });
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
  var el = document.getElementById('ob-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state">No results</div>'; return; }
  el.innerHTML = list.map(function(p) {
    var isSelected = p.email === obSelectedEmail;
    var teamItems = p.teams.map(function(t, i) {
      return ' <div class="ob-team-indicator" style="display:flex;align-items:center;gap:8px;padding:10px 18px 10px 24px;border-bottom:1px solid rgba(26,51,38,0.4);"> <span class="team-pill ' + (PILL_CLASSES[i] || '') + '" style="width:20px;height:16px;font-size:9px">' + pillLabel(i) + '</span> <span style="font-size:14px;color:var(--text)">' + escHtml(t) + '</span> </div>';
    }).join('');
    return ' <div class="ob-name-block' + (isSelected ? ' selected' : '') + '" id="ob-block-' + p.email.replace(/[@.]/g, '_') + '"> <button class="ob-name-btn ' + (isSelected ? 'open' : '') + '" onclick="obSelectName(' + escHtml(JSON.stringify(p.email)) + ')"> <span>' + escHtml(p.name) + '</span> <span class="ob-name-right"> <span class="ob-entry-count">' + p.teams.length + ' ' + (p.teams.length === 1 ? 'entry' : 'entries') + '</span> <span class="ob-chevron">›</span> </span> </button> <div class="ob-teams-list ' + (isSelected ? 'open' : '') + '"> ' + teamItems + ' </div> </div>';
  }).join('');
}

function obSelectName(email) {
  obSelectedEmail = email;
  buildObList(document.getElementById('ob-search').value);
  document.getElementById('ob-confirm').classList.add('ready');
  var blockId = 'ob-block-' + email.replace(/[@.]/g, '_');
  setTimeout(function() {
    var el = document.getElementById(blockId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function filterObNames() { buildObList(document.getElementById('ob-search').value); }

function confirmOnboarding() {
  if (!obSelectedEmail) return;
  hideOnboarding();
  try {
    setUser(obSelectedEmail, -1, true);
    var userTeams = ENTRIES.filter(function(e) { return e.email === obSelectedEmail; });
    trackEvent('user-login');
    trackEvent('login-entries-' + userTeams.length);
    showToast('✓ Team locked in');
  } catch(e) { console.error('setUser error:', e); }
}

function searchTeam() {
  var q = document.getElementById('email-search').value.toLowerCase().trim();
  var el = document.getElementById('myteam-results');
  if (!q) { el.innerHTML = ''; return; }
  var matches = ENTRIES.filter(function(e) { return e.email.toLowerCase().includes(q); });
  if (!matches.length) { el.innerHTML = '<div class="empty-state">No entries found for that email.</div>'; return; }
  var ranked = getRanked();
  el.innerHTML = matches.map(function(e, mi) {
    var calc = calcEntry(e);
    var rank = ranked.findIndex(function(r) { return r.email === e.email && r.team === e.team; }) + 1;
    var sc = calc.total, scf = fmt(sc), scc = cls(sc);
    return ' <div class="team-card"> <h2>' + escHtml(e.team) + '</h2> <div class="tc-email">' + escHtml(e.email) + '</div> <div class="tc-stats"> <div class="tc-stat"><div class="tc-val ' + scc + '">' + scf + '</div><div class="tc-lbl">Score</div></div> <div class="tc-stat"><div class="tc-val">#' + rank + '</div><div class="tc-lbl">Pool Rank</div></div> <div class="tc-stat"><div class="tc-val">' + (matches.length > 1 ? mi + 1 + '/' + matches.length : '—') + '</div><div class="tc-lbl">Entry</div></div> </div> </div> <div class="picks-card" style="margin-bottom:16px"> ' + calc.scores.map(function(g, j) {
      var isTop = j < 4, gd = GOLFER_SCORES[g.name];
      var pos = gd ? (gd.thru === 'WD' || gd.score === 12 ? 'WD' : gd.pos) : '—', thru = gd ? gd.thru : '';
      var pickStatus = pos === 'WD' ? ' · Withdrawn' : pos === 'MC' ? ' · Missed Cut' : (' · Thru ' + thru);
      return '<div class="pick-row"> <div class="pick-n">' + (j + 1) + '</div> <div class="pick-info"> <div class="pick-name">' + g.name + (isTop ? '<span class="pick-badge">TOP 4</span>' : '') + '</div> <div class="pick-pos">' + pos + pickStatus + '</div> </div> <div class="pick-score ' + cls(g.score) + '">' + fmt(g.score) + '</div> </div>';
    }).join('') + ' </div>';
  }).join('');
}

// ── Hidden "Who's Watching" Easter Egg ──
// Long-press (800ms) on Filter Entry / header team area
(function() {
  var _lpTimer = null;
  var target = null;

  document.addEventListener('DOMContentLoaded', function() {
    target = document.getElementById('hdr-team-display') || document.getElementById('hdr-join-btn');
    if (!target) return;

    target.addEventListener('touchstart', function(e) {
      _lpTimer = setTimeout(function() {
        e.preventDefault();
        showViewers();
      }, 800);
    }, { passive: false });
    target.addEventListener('touchend', function() { clearTimeout(_lpTimer); });
    target.addEventListener('touchmove', function() { clearTimeout(_lpTimer); });

    target.addEventListener('mousedown', function() {
      _lpTimer = setTimeout(showViewers, 800);
    });
    target.addEventListener('mouseup', function() { clearTimeout(_lpTimer); });
    target.addEventListener('mouseleave', function() { clearTimeout(_lpTimer); });
  });

  function showViewers() {
    trackEvent('easter-egg-viewers');
    var existing = document.getElementById('viewers-popup');
    if (existing) { existing.remove(); var bd2 = document.getElementById('viewers-backdrop'); if (bd2) bd2.remove(); return; }

    var popup = document.createElement('div');
    popup.id = 'viewers-popup';
    popup.style.cssText = 'position:fixed;z-index:9999;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(8,13,26,0.97);border:1px solid var(--gold);border-radius:14px;padding:20px 24px;box-shadow:0 12px 48px rgba(0,0,0,0.7);text-align:center;min-width:220px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    popup.innerHTML = '<div style="font-size:10px;font-weight:800;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:12px">Who\'s Watching</div>'
      + '<div id="viewers-count" style="font-size:42px;font-weight:900;color:var(--text);line-height:1;margin-bottom:4px">…</div>'
      + '<div id="viewers-label" style="font-size:11px;color:var(--text3);font-weight:600">loading</div>'
      + '<div style="margin-top:14px;font-size:9px;color:var(--text3);opacity:0.4">tap outside to close</div>';
    document.body.appendChild(popup);

    var bd = document.createElement('div');
    bd.id = 'viewers-backdrop';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.4)';
    bd.onclick = function() { popup.remove(); bd.remove(); };
    document.body.appendChild(bd);

    fetchViewerCount();
  }

  async function fetchViewerCount() {
    var countEl = document.getElementById('viewers-count');
    var labelEl = document.getElementById('viewers-label');
    if (!countEl) return;
    try {
      var res = await fetch('https://calcutta.goatcounter.com/counter/' + encodeURIComponent(location.pathname || '/') + '.json');
      if (res.ok) {
        var data = await res.json();
        var total = parseInt(data.count) || 0;
        countEl.textContent = total.toLocaleString();
        labelEl.textContent = 'views today';
        var activeEst = Math.max(1, Math.round(total * 0.08));
        setTimeout(function() {
          if (!document.getElementById('viewers-count')) return;
          countEl.style.transition = 'all 0.3s ease';
          countEl.textContent = activeEst;
          labelEl.innerHTML = 'estimated active<div style="margin-top:10px;font-size:22px;font-weight:800;color:var(--text2)">' + total.toLocaleString() + '</div><div style="font-size:10px;color:var(--text3)">total views today</div>';
        }, 1500);
      } else {
        countEl.textContent = '—';
        labelEl.textContent = 'unavailable';
      }
    } catch(e) {
      countEl.textContent = '—';
      labelEl.textContent = 'offline';
    }
  }
})();
