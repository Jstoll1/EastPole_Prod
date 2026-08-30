// ── Schedule Overlay ────────────────────────────────────────

var _scheduleOpen = false;
var _scheduleData = null;
var _logoTapTime = 0;

function handleLogoDblTap() {
  var now = Date.now();
  if (now - _logoTapTime < 500) {
    _logoTapTime = 0;
    toggleSchedule();
  } else {
    _logoTapTime = now;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var logoEl = document.getElementById('hdr-logo-tap');
  if (logoEl) {
    logoEl.addEventListener('click', handleLogoDblTap);
    logoEl.addEventListener('touchend', function(e) {
      e.preventDefault();
      handleLogoDblTap();
    });
  }
});

function toggleSchedule() {
  var el = document.getElementById('schedule-overlay');
  var bd = document.getElementById('schedule-backdrop');
  if (!el) return;
  _scheduleOpen = !_scheduleOpen;
  el.classList.toggle('open', _scheduleOpen);
  if (bd) bd.classList.toggle('open', _scheduleOpen);
  if (_scheduleOpen && !_scheduleData) fetchSchedule();
  else if (_scheduleOpen) scrollToCurrentEvent();
}

function scrollToCurrentEvent() {
  setTimeout(function() {
    var current = document.querySelector('.sched-item.is-current');
    if (current) current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function fetchSchedule() {
  var listEl = document.getElementById('schedule-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="sched-loading">Loading schedule…</div>';
  try {
    var events = [];
    // Try the scoreboard endpoint with date ranges for full schedule
    var urls = [
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=20250101-20251231&limit=100',
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=20260101-20261231&limit=100'
    ];
    for (var u = 0; u < urls.length; u++) {
      try {
        var res = await fetch(urls[u], { cache: 'no-store' });
        if (res.ok) {
          var data = await res.json();
          events = events.concat(data.events || []);
        }
      } catch(e) {}
    }
    // Deduplicate by event ID
    var seen = {};
    events = events.filter(function(ev) {
      if (seen[ev.id]) return false;
      seen[ev.id] = true;
      return true;
    });
    // Sort by date
    events.sort(function(a, b) {
      return new Date(a.date || 0) - new Date(b.date || 0);
    });
    if (!events.length) {
      listEl.innerHTML = '<div class="sched-loading">No schedule data available</div>';
      return;
    }
    _scheduleData = events;
    // Debug: show what ESPN returns for first 3 events
    var dbg = events.slice(0, 3).map(function(ev) {
      var c = ev.competitions && ev.competitions[0];
      return ev.name + ' | venue: ' + JSON.stringify(c && c.venue ? {full: c.venue.fullName, addr: c.venue.address} : 'none') + ' | keys: ' + Object.keys(ev).join(',');
    });
    console.log('📋 Schedule debug:', dbg);
    renderSchedule();
    scrollToCurrentEvent();
  } catch (e) {
    listEl.innerHTML = '<div class="sched-loading">Could not load schedule</div>';
  }
}

function renderSchedule() {
  var listEl = document.getElementById('schedule-list');
  if (!listEl || !_scheduleData) return;
  var now = Date.now();
  var currentId = EVENT_ID;
  var _schedNextMarked = false;
  // 2026 PGA Tour venues
  var COURSE_MAP = {
    'masters tournament': { course: 'Augusta National Golf Club', city: 'Augusta, GA' },
    'pga championship': { course: 'Aronimink Golf Club', city: 'Newtown Square, PA' },
    'u.s. open': { course: 'Shinnecock Hills Golf Club', city: 'Southampton, NY' },
    'the open championship': { course: 'Royal Birkdale Golf Club', city: 'Southport, England' },
    'the players championship': { course: 'TPC Sawgrass', city: 'Ponte Vedra Beach, FL' },
    'rbc heritage': { course: 'Harbour Town Golf Links', city: 'Hilton Head Island, SC' },
    'the memorial tournament': { course: 'Muirfield Village Golf Club', city: 'Dublin, OH' },
    'arnold palmer invitational': { course: 'Bay Hill Club & Lodge', city: 'Orlando, FL' },
    'genesis invitational': { course: 'Riviera Country Club', city: 'Pacific Palisades, CA' },
    'wm phoenix open': { course: 'TPC Scottsdale', city: 'Scottsdale, AZ' },
    'the cj cup byron nelson': { course: 'TPC Craig Ranch', city: 'McKinney, TX' },
    'wells fargo championship': { course: 'Quail Hollow Club', city: 'Charlotte, NC' },
    'charles schwab challenge': { course: 'Colonial Country Club', city: 'Fort Worth, TX' },
    'the championship at aronimink': { course: 'Aronimink Golf Club', city: 'Newtown Square, PA' },
    'travelers championship': { course: 'TPC River Highlands', city: 'Cromwell, CT' },
    'rocket mortgage classic': { course: 'Detroit Golf Club', city: 'Detroit, MI' },
    'fedex st. jude championship': { course: 'TPC Southwind', city: 'Memphis, TN' },
    'bmw championship': { course: 'Caves Valley Golf Club', city: 'Owings Mills, MD' },
    'tour championship': { course: 'East Lake Golf Club', city: 'Atlanta, GA' },
    'the sentry': { course: 'The Plantation Course at Kapalua', city: 'Maui, HI' },
    'sony open': { course: 'Waialae Country Club', city: 'Honolulu, HI' },
    'the american express': { course: 'PGA West', city: 'La Quinta, CA' },
    'farmers insurance open': { course: 'Torrey Pines Golf Course', city: 'San Diego, CA' },
    'at&t pebble beach': { course: 'Pebble Beach Golf Links', city: 'Pebble Beach, CA' },
    'cognizant classic': { course: 'PGA National Resort', city: 'Palm Beach Gardens, FL' },
    'houston open': { course: 'Memorial Park Golf Course', city: 'Houston, TX' },
    'valero texas open': { course: 'TPC San Antonio', city: 'San Antonio, TX' },
    'zurich classic': { course: 'TPC Louisiana', city: 'Avondale, LA' },
    'rlx golf': { course: 'Bethpage Black', city: 'Farmingdale, NY' },
    'scottish open': { course: 'The Renaissance Club', city: 'North Berwick, Scotland' },
    '3m open': { course: 'TPC Twin Cities', city: 'Blaine, MN' },
    'john deere classic': { course: 'TPC Deere Run', city: 'Silvis, IL' },
    'wyndham championship': { course: 'Sedgefield Country Club', city: 'Greensboro, NC' }
  };
  var MAJORS = {
    'masters': '🏆',
    'pga championship': '🏆',
    'u.s. open': '🏆',
    'the open': '🏆',
    'open championship': '🏆'
  };
  listEl.innerHTML = _scheduleData.map(function(ev) {
    var name = ev.name || ev.shortName || '';
    var nameLower = name.toLowerCase();
    var majorIcon = '';
    Object.keys(MAJORS).forEach(function(m) {
      if (nameLower.indexOf(m) !== -1) majorIcon = '<span class="sched-major">MAJOR</span>';
    });
    var comp = ev.competitions && ev.competitions[0];
    var venue = comp && comp.venue;
    var course = venue ? (venue.fullName || venue.shortName || '') : '';
    var city = '';
    if (venue && venue.address) {
      city = venue.address.summary || [venue.address.city, venue.address.state].filter(Boolean).join(', ');
    }
    var startDate = ev.date ? new Date(ev.date) : null;
    var endDate = ev.endDate ? new Date(ev.endDate) : null;
    var opts = { month: 'short', day: 'numeric' };
    var dateStr = '';
    if (startDate) {
      dateStr = startDate.toLocaleDateString('en-US', opts);
      if (endDate) dateStr += ' – ' + endDate.toLocaleDateString('en-US', opts);
    }
    var evStatus = ev.status?.type?.name || '';
    var isCurrent = ev.id === currentId;
    var isLive = evStatus === 'STATUS_IN_PROGRESS';
    var isFinal = evStatus === 'STATUS_FINAL';
    var isUpcoming = !isFinal && !isLive && startDate && startDate > new Date();
    var statusBadge = '';
    if (isCurrent && isLive) {
      statusBadge = '<span class="sched-badge sched-live">LIVE</span>';
    } else if (isCurrent) {
      statusBadge = '<span class="sched-badge sched-thisweek">THIS WEEK</span>';
    } else if (isUpcoming && !statusBadge) {
      // Find first upcoming event that isn't current
      if (!_schedNextMarked) {
        _schedNextMarked = true;
        statusBadge = '<span class="sched-badge sched-next">UP NEXT</span>';
      }
    }
    var champHtml = '';
    if (comp && comp.competitors) {
      var winner = comp.competitors.find(function(c) { return c.status?.position?.id === '1' || c.status?.position?.displayName === '1'; });
      if (winner && winner.athlete) {
        var flag = '';
        var cc = (winner.athlete.flag?.alt || winner.athlete.citizenshipCountry?.alpha3 || '').toUpperCase();
        if (cc && typeof CODE_TO_FLAG !== 'undefined' && CODE_TO_FLAG[cc]) flag = CODE_TO_FLAG[cc] + ' ';
        champHtml = '<div class="sched-champ">🏆 ' + flag + (winner.athlete.displayName || '') + '</div>';
      }
    }
    // Fallback to hardcoded course map
    if (!course || !city) {
      var mapped = null;
      Object.keys(COURSE_MAP).forEach(function(k) {
        if (nameLower.indexOf(k) !== -1) mapped = COURSE_MAP[k];
      });
      if (mapped) {
        if (!course) course = mapped.course;
        if (!city) city = mapped.city;
      }
    }
    // Try to get venue from multiple ESPN paths
    if (!course && ev.venues && ev.venues.length) {
      course = ev.venues[0].fullName || ev.venues[0].shortName || '';
      if (!city && ev.venues[0].address) {
        city = ev.venues[0].address.summary || [ev.venues[0].address.city, ev.venues[0].address.state].filter(Boolean).join(', ');
      }
    }
    // Try location field
    if (!city && ev.location) city = ev.location;
    // Try competition geoBroadcasts or notes for location hints
    if (!course && comp && comp.notes && comp.notes.length) {
      var courseNote = comp.notes.find(function(n) { return n.type === 'event' || n.type === 'venue'; });
      if (courseNote) course = courseNote.headline || '';
    }
    return '<div class="sched-item' + (isCurrent ? ' is-current' : '') + '">'
      + '<div class="sched-name">' + majorIcon + escHtml(name) + statusBadge + '</div>'
      + '<div class="sched-details">'
      + (dateStr ? '<span>📅 ' + dateStr + '</span>' : '')
      + (course ? '<span>⛳ ' + escHtml(course) + '</span>' : '')
      + (city ? '<span>📍 ' + escHtml(city) + '</span>' : '')
      + '</div>'
      + champHtml
      + '</div>';
  }).join('');
}

// ── Header, Navigation, Theme ──────────────────────────────

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
  document.body.setAttribute('data-active-view', name);
  if (name === 'coffee' && typeof initCoffeeView === 'function') initCoffeeView();
  if (name === 'leaderboard') {
    renderTicker();
    lbSort = 'score'; lbSortAsc = true;
    var search = document.getElementById('lb-search');
    if (search) search.value = '';
    lbSearch = '';
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

function enterApp() {
  markSplashSeen();
  var splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('hidden');
  setTimeout(function() { splash.style.display = 'none'; }, 500);
}
