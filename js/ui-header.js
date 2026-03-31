// ── Header, Navigation, Onboarding, Theme ──────────────────

function updateHeaderDisplay() {
  var teamDisplay = document.getElementById('hdr-team-display');
  var joinBtn = document.getElementById('hdr-join-btn');
  var nameEl = document.getElementById('hdr-active-team');
  var caret = document.getElementById('hdr-dd-caret');
  if (currentUserEmail && currentUserTeams.length) {
    var activeTeam = activeTeamIdx >= 0 ? currentUserTeams[activeTeamIdx] : null;
    nameEl.textContent = activeTeam ? activeTeam.team : 'All Picks';
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
      return ' <button class="td-item' + (i === activeTeamIdx ? ' active' : '') + '" onclick="event.stopPropagation();selectTeamEntry(' + i + ')"> <span class="team-pill ' + (PILL_CLASSES[i] || '') + '" style="width:18px;height:14px;font-size:8px">' + pillLabel(i) + '</span> <span>' + t.team + '</span> </button>';
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
  if (meta) meta.setAttribute('content', next === 'light' ? '#006747' : '#06120c');
}

function initTheme() {
  var saved = localStorage.getItem('ep-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  var btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = saved === 'light' ? '☀️ Light' : '🌙 Dark';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', saved === 'light' ? '#006747' : '#06120c');
}

var _prevTab = 'leaderboard';

function switchTab(name, btn) {
  trackEvent('tab-' + name);
  // Remember previous tab (but not feedback itself)
  var cur = document.querySelector('.view.active');
  if (cur && cur.id !== 'view-feedback') {
    _prevTab = cur.id.replace('view-', '');
  }
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('view-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'leaderboard') {
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
  markSplashSeen();
  var splash = document.getElementById('splash');
  splash.classList.add('hidden');
  setTimeout(function() {
    splash.style.display = 'none';
    if (!currentUserEmail) showOnboarding();
  }, 500);
}

function dismissSplashBrowse() {
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
    .filter(function(p) { return !filter || p.name.toLowerCase().includes(filter.toLowerCase()); })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
  var el = document.getElementById('ob-list');
  if (!list.length) { el.innerHTML = '<div class="empty-state">No results</div>'; return; }
  el.innerHTML = list.map(function(p) {
    var isSelected = p.email === obSelectedEmail;
    var teamItems = p.teams.map(function(t, i) {
      return ' <div class="ob-team-indicator" style="display:flex;align-items:center;gap:8px;padding:10px 18px 10px 24px;border-bottom:1px solid rgba(26,51,38,0.4);"> <span class="team-pill ' + (PILL_CLASSES[i] || '') + '" style="width:20px;height:16px;font-size:9px">' + pillLabel(i) + '</span> <span style="font-size:14px;color:var(--text)">' + t + '</span> </div>';
    }).join('');
    return ' <div class="ob-name-block' + (isSelected ? ' selected' : '') + '" id="ob-block-' + p.email.replace(/[@.]/g, '_') + '"> <button class="ob-name-btn ' + (isSelected ? 'open' : '') + '" onclick="obSelectName(\'' + p.email + '\')"> <span>' + p.name + '</span> <span class="ob-name-right"> <span class="ob-entry-count">' + p.teams.length + ' ' + (p.teams.length === 1 ? 'entry' : 'entries') + '</span> <span class="ob-chevron">›</span> </span> </button> <div class="ob-teams-list ' + (isSelected ? 'open' : '') + '"> ' + teamItems + ' </div> </div>';
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
    setUser(obSelectedEmail, 0, true);
    trackEvent('user-login');
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
    return ' <div class="team-card"> <h2>' + e.team + '</h2> <div class="tc-email">' + e.email + '</div> <div class="tc-stats"> <div class="tc-stat"><div class="tc-val ' + scc + '">' + scf + '</div><div class="tc-lbl">Score</div></div> <div class="tc-stat"><div class="tc-val">#' + rank + '</div><div class="tc-lbl">Pool Rank</div></div> <div class="tc-stat"><div class="tc-val">' + (matches.length > 1 ? mi + 1 + '/' + matches.length : '—') + '</div><div class="tc-lbl">Entry</div></div> </div> </div> <div class="picks-card" style="margin-bottom:16px"> ' + calc.scores.map(function(g, j) {
      var isTop = j < 4, gd = GOLFER_SCORES[g.name];
      var pos = gd ? (gd.thru === 'WD' || gd.score === 12 ? 'WD' : gd.pos) : '—', thru = gd ? gd.thru : '';
      var pickStatus = pos === 'WD' ? ' · Withdrawn' : pos === 'MC' ? ' · Missed Cut' : (' · Thru ' + thru);
      return '<div class="pick-row"> <div class="pick-n">' + (j + 1) + '</div> <div class="pick-info"> <div class="pick-name">' + g.name + (isTop ? '<span class="pick-badge">TOP 4</span>' : '') + '</div> <div class="pick-pos">' + pos + pickStatus + '</div> </div> <div class="pick-score ' + cls(g.score) + '">' + fmt(g.score) + '</div> </div>';
    }).join('') + ' </div>';
  }).join('');
}
