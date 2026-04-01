// ── Ticker ──────────────────────────────────────────────────

var _tickerMode = 'entries';

function toggleTickerMode() {
  _tickerMode = _tickerMode === 'entries' ? 'golfers' : 'entries';
  var label = document.querySelector('.ticker-label');
  if (label) label.textContent = _tickerMode === 'entries' ? 'LIVE' : 'PGA';
  var track = document.querySelector('.ticker-track');
  if (track) track.scrollLeft = 0;
  renderTicker();
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
    players.sort(function(a, b) {
      // Sort by odds pre-tournament if available
      if (PRE_ODDS[a.name] && PRE_ODDS[b.name]) {
        var oa = parseInt(PRE_ODDS[a.name][0].replace('+','')) || 999999;
        var ob = parseInt(PRE_ODDS[b.name][0].replace('+','')) || 999999;
        if (oa !== ob) return oa - ob;
      }
      return a.score - b.score;
    });
    var active = players.filter(function(p) { return p.score < 11; });
    items = active.map(function(p) {
      var scf = fmt(p.score);
      var scc = cls(p.score);
      var flag = FLAGS[p.name] || '';
      var dot = poolNames.has(p.name) ? '<span class="ticker-pool-dot"></span>' : '';
      var odds = PRE_ODDS[p.name] ? PRE_ODDS[p.name][0] : '';
      var oddsHtml = odds && !TOURNAMENT_STARTED ? ' <span style="color:var(--gold);font-size:9px">' + odds + '</span>' : '';
      return '<span class="ticker-item"><span class="ticker-item-rank">' + p.pos + '</span> <span>' + flag + ' ' + p.name + dot + '</span>' + oddsHtml + ' <span class="ticker-item-score ' + scc + '">' + scf + '</span></span>';
    }).join('');
  } else {
    var ranked = getRanked();
    items = ranked.map(function(e, i) {
      var scf = fmtTeam(e.total);
      var scc = cls(e.total);
      var money = i < 3 ? ' 💰' : '';
      var nameStyle = i < 3 ? ' style="color:var(--gold)"' : '';
      return '<span class="ticker-item"><span class="ticker-item-rank">' + (i + 1) + '.</span> <span' + nameStyle + '>' + e.team + '</span> <span class="ticker-item-score ' + scc + '">' + scf + '</span>' + money + '</span>';
    }).join('');
  }
  el.innerHTML = items + items;
  if (track) track.scrollLeft = prevScroll;
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
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', function() { clearTimeout(_tickerResumeT); _tickerPaused = false; }, { passive: true });
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
