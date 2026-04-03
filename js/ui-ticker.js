// ── Ticker ──────────────────────────────────────────────────

var _tickerMode = 'entries';

function toggleTickerMode() {
  _tickerMode = _tickerMode === 'entries' ? 'golfers' : 'entries';
  trackEvent('ticker-toggle-' + _tickerMode);
  var label = document.querySelector('.ticker-label');
  if (label) label.textContent = _tickerMode === 'entries' ? 'POOL' : 'FIELD';
  var track = document.querySelector('.ticker-track');
  if (track) track.scrollLeft = 0;
  renderTicker();
  console.log('🎰 Ticker mode:', _tickerMode);
}

function renderTicker() {
  var el = document.getElementById('ticker-content');
  if (!el) return;
  var track = document.querySelector('.ticker-track');
  var prevScroll = track ? track.scrollLeft : 0;
  var items;
  if (_tickerMode === 'golfers') {
    var poolNames = new Set(ENTRIES.flatMap(function(e) { return e.picks; }));
    var players = Object.entries(GOLFER_SCORES).map(function(pair) { return Object.assign({ name: pair[0] }, pair[1]); });
    // If GOLFER_SCORES is sparse, supplement from FLAGS
    if (players.length < 10) {
      Object.keys(FLAGS).forEach(function(name) {
        if (!GOLFER_SCORES[name]) {
          players.push({ name: name, pos: '—', score: 0, thru: '—' });
        }
      });
    }
    var active = players.filter(function(p) { return p.score < 11; });
    active.sort(function(a, b) { return b.score - a.score; });
    items = active.map(function(p) {
      var scf = fmt(p.score);
      var scc = cls(p.score);
      var flag = FLAGS[p.name] || '';
      var dot = poolNames.has(p.name) ? '<span class="ticker-pool-dot"></span>' : '';
      return '<span class="ticker-item"><span class="ticker-item-rank">' + p.pos + '</span> <span>' + flag + ' ' + p.name + dot + '</span> <span class="ticker-item-score ' + scc + '">' + scf + '</span></span>';
    }).join('');
  } else {
    var ranked = getRanked();
    var ranks = [];
    ranked.forEach(function(e, i) {
      if (i === 0) ranks.push(1);
      else ranks.push(e.total === ranked[i - 1].total ? ranks[i - 1] : i + 1);
    });
    // Reverse: worst first, best last (ticker scrolls left, so leader appears at end)
    var reversed = ranked.map(function(e, i) { return { entry: e, rank: ranks[i] }; }).reverse();
    items = reversed.map(function(obj) {
      var e = obj.entry, rank = obj.rank;
      var scf = fmtTeam(e.total);
      var scc = cls(e.total);
      var money = rank <= 3 ? ' 💰' : '';
      var nameStyle = rank <= 3 ? ' style="color:var(--gold)"' : '';
      return '<span class="ticker-item"><span class="ticker-item-rank">' + rank + '.</span> <span' + nameStyle + '>' + e.team + '</span> <span class="ticker-item-score ' + scc + '">' + scf + '</span>' + money + '</span>';
    }).join('');
  }
  if (!items) items = '<span class="ticker-item">No data yet</span>';
  el.innerHTML = items + items;
  if (track) track.scrollLeft = 0;
  if (!_tickerInterval) { startTickerScroll(); initTickerTouch(); }
}

// Ticker auto-scroll with native touch scrolling
var _tickerInterval = null, _tickerPaused = false, _tickerResumeT = null;

function startTickerScroll() {
  if (_tickerInterval) return;
  var track = document.querySelector('.ticker-track');
  if (!track) return;
  _tickerInterval = setInterval(function() {
    if (_tickerPaused) return;
    var content = document.getElementById('ticker-content');
    if (!content) return;
    var half = content.scrollWidth / 2;
    track.scrollLeft += 1;
    if (track.scrollLeft >= half) track.scrollLeft -= half;
  }, 16);
}

var _tickerMouseDrag = false, _tickerMouseX = 0, _tickerMouseScroll = 0;
var _tickerVelocity = 0, _tickerLastX = 0, _tickerLastTime = 0, _tickerMomentumRAF = null;

function tickerMomentum(track) {
  if (Math.abs(_tickerVelocity) < 0.5) { _tickerPaused = false; return; }
  track.scrollLeft += _tickerVelocity;
  var half = track.scrollWidth / 2;
  if (track.scrollLeft >= half) track.scrollLeft -= half;
  if (track.scrollLeft < 0) track.scrollLeft += half;
  _tickerVelocity *= 0.95;
  _tickerMomentumRAF = requestAnimationFrame(function() { tickerMomentum(track); });
}

function initTickerTouch() {
  var track = document.querySelector('.ticker-track');
  if (!track) return;
  function pause() {
    _tickerPaused = true;
    clearTimeout(_tickerResumeT);
    if (_tickerMomentumRAF) { cancelAnimationFrame(_tickerMomentumRAF); _tickerMomentumRAF = null; }
  }
  function resume() {
    clearTimeout(_tickerResumeT);
    _tickerPaused = false;
  }
  var _touchLastX = 0, _touchLastTime = 0, _touchVelocity = 0;
  track.addEventListener('touchstart', function(e) {
    pause();
    if (e.touches.length) {
      _touchLastX = e.touches[0].clientX;
      _touchLastTime = Date.now();
      _touchVelocity = 0;
    }
  }, { passive: true });
  track.addEventListener('touchmove', function(e) {
    if (!e.touches.length) return;
    var now = Date.now();
    var dt = now - _touchLastTime || 1;
    _touchVelocity = (_touchLastX - e.touches[0].clientX) / dt * 16;
    _touchLastX = e.touches[0].clientX;
    _touchLastTime = now;
  }, { passive: true });
  track.addEventListener('touchend', function() {
    clearTimeout(_tickerResumeT);
    if (Math.abs(_touchVelocity) > 2) {
      _tickerVelocity = _touchVelocity;
      tickerMomentum(track);
    } else {
      _tickerPaused = false;
    }
  }, { passive: true });
  track.addEventListener('touchcancel', function() { clearTimeout(_tickerResumeT); _tickerPaused = false; }, { passive: true });
  track.addEventListener('mousedown', function(e) {
    _tickerMouseDrag = true;
    _tickerMouseX = e.clientX;
    _tickerLastX = e.clientX;
    _tickerLastTime = Date.now();
    _tickerMouseScroll = track.scrollLeft;
    _tickerVelocity = 0;
    track.classList.add('dragging');
    pause();
    e.preventDefault();
  });
  window.addEventListener('mousemove', function(e) {
    if (!_tickerMouseDrag) return;
    var now = Date.now();
    var dt = now - _tickerLastTime || 1;
    var dx = e.clientX - _tickerMouseX;
    _tickerVelocity = (_tickerLastX - e.clientX) / dt * 16;
    _tickerLastX = e.clientX;
    _tickerLastTime = now;
    track.scrollLeft = _tickerMouseScroll - dx;
  });
  window.addEventListener('mouseup', function() {
    if (!_tickerMouseDrag) return;
    _tickerMouseDrag = false;
    track.classList.remove('dragging');
    if (Math.abs(_tickerVelocity) > 1) {
      tickerMomentum(track);
    } else {
      _tickerPaused = false;
    }
  });
}
