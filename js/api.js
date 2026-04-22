// ── API / Data Fetching ────────────────────────────────────

var _scorecardInflight = {};

// Fetch the current PGA Tour tournament from ESPN automatically.
// No hardcoded event ID — the scoreboard endpoint returns this week's event.
var ESPN_LEADERBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

function _extractTourneyMeta(ev) {
  if (!ev) return;
  var comp = ev.competitions && ev.competitions[0];
  var league = comp?.league || ev.league;
  console.log('🏷️ Tournament meta:', ev.name,
    '| ev.logos:', JSON.stringify(ev.logos?.map(function(l){return {href:l.href,rel:l.rel,width:l.width}})),
    '| ev.logo:', ev.logo,
    '| comp.logos:', JSON.stringify(comp?.logos?.map(function(l){return l.href})),
    '| league.logos:', JSON.stringify(league?.logos?.map(function(l){return {href:l.href,rel:l.rel}})),
    '| season.logos:', JSON.stringify(ev.season?.logos?.map(function(l){return l.href}))
  );
  TOURNEY_NAME = ev.name || TOURNEY_NAME || '';
  TOURNEY_SHORT = ev.shortName || TOURNEY_SHORT || '';
  TOURNEY_LOGO = '';
  // Try event-level logos (prefer dark background variant)
  if (ev.logos && ev.logos.length) {
    var darkLogo = ev.logos.find(function(l) { return l.rel && l.rel.indexOf('dark') !== -1; });
    TOURNEY_LOGO = (darkLogo && darkLogo.href) || ev.logos[0].href || '';
  }
  if (!TOURNEY_LOGO && ev.logo) TOURNEY_LOGO = ev.logo;
  // Try competition-level logos
  if (!TOURNEY_LOGO && comp) {
    var compLogos = comp.logos || [];
    if (compLogos.length) TOURNEY_LOGO = compLogos[0].href || '';
  }
  // Try league-level logos
  if (!TOURNEY_LOGO && league?.logos?.length) {
    var darkLeague = league.logos.find(function(l) { return l.rel && l.rel.indexOf('dark') !== -1; });
    TOURNEY_LOGO = (darkLeague && darkLeague.href) || league.logos[0].href || '';
  }
  // Try season-level
  if (!TOURNEY_LOGO && ev.season?.logos?.length) {
    TOURNEY_LOGO = ev.season.logos[0].href || '';
  }
  var venue = comp && comp.venue;
  TOURNEY_COURSE = venue ? (venue.fullName || venue.shortName || '') : TOURNEY_COURSE || '';
  if (ev.date) {
    var start = new Date(ev.date);
    var end = ev.endDate ? new Date(ev.endDate) : null;
    var opts = { month: 'short', day: 'numeric' };
    var startStr = start.toLocaleDateString('en-US', opts);
    var endStr = end ? end.toLocaleDateString('en-US', opts) : '';
    TOURNEY_DATES = end ? startStr + ' – ' + endStr : startStr;
  }
  // Always render the East Pole brand mark — ignore ESPN's tournament logo so
  // we're not swapping in course-specific imagery (e.g. the RBC Heritage
  // Harbour Town lighthouse) week to week.
  var hdrLogo = document.getElementById('hdr-tourney-logo');
  var splashLogo = document.getElementById('splash-tourney-logo');
  var hdrCenter = document.querySelector('.hdr-logo-center');
  var EP_MARK_SVG = '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<rect width="32" height="32" rx="6" fill="#1a4430"/>'
    + '<text x="16" y="24" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="bold" font-style="italic" fill="#d4a843">E</text>'
    + '</svg>';
  var EP_MARK_DATA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(EP_MARK_SVG);
  if (splashLogo) {
    splashLogo.src = EP_MARK_DATA_URI;
    splashLogo.alt = 'East Pole';
    splashLogo.style.display = '';
  }
  if (hdrCenter) {
    if (hdrLogo) hdrLogo.style.display = 'none';
    if (!document.getElementById('hdr-tourney-text')) {
      var wrap = document.createElement('div');
      wrap.id = 'hdr-tourney-text';
      wrap.className = 'hdr-tourney-name';
      wrap.innerHTML = EP_MARK_SVG.replace('<svg ', '<svg class="hdr-tourney-icon" ')
        + '<span class="hdr-tourney-label"></span>';
      hdrCenter.appendChild(wrap);
    }
    var lblEl = document.querySelector('.hdr-tourney-label');
    if (lblEl) lblEl.textContent = TOURNEY_NAME || '';
  }
  // Update splash text
  var subEl = document.querySelector('.brand-subtext');
  if (subEl && TOURNEY_NAME) subEl.textContent = TOURNEY_NAME;
  var chipEl = document.querySelector('.splash-event-chip');
  if (chipEl && TOURNEY_DATES) chipEl.textContent = TOURNEY_DATES + (TOURNEY_COURSE ? ' · ' + TOURNEY_COURSE : '');
}

async function fetchESPN() {
  try {
    // First fetch: discover the current tournament from the scoreboard endpoint.
    // Once we have an event ID, switch to the leaderboard endpoint for full data.
    var fetchUrl;
    if (EVENT_ID) {
      fetchUrl = 'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=' + EVENT_ID;
    } else {
      fetchUrl = ESPN_LEADERBOARD_URL;
    }
    var res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) { ErrorTracker.api('ESPN leaderboard fetch failed', { status: res.status, statusText: res.statusText }); throw new Error(); }
    var data = await res.json();
    var ev = data.events && data.events[0];
    var comps = ev?.competitions?.[0]?.competitors || [];
    var discoveredId = ev?.id || null;
    _extractTourneyMeta(ev);

    // If we just discovered the event ID from scoreboard, re-fetch from
    // leaderboard endpoint which has full competitor/tee-time data.
    if (!EVENT_ID && discoveredId) {
      EVENT_ID = discoveredId;
      var lbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=' + EVENT_ID, { cache: 'no-store' });
      if (lbRes.ok) {
        data = await lbRes.json();
        ev = data.events && data.events[0];
        comps = ev?.competitions?.[0]?.competitors || [];
        _extractTourneyMeta(ev);
      }
    }
    EVENT_ID = discoveredId || EVENT_ID || null;
    if (!comps.length) {
      console.log('⚠️ ESPN API returned event but no competitors — field not published yet.',
        'ev.competitions[0] keys:', ev?.competitions?.[0] ? Object.keys(ev.competitions[0]) : '(none)');
      setApiStatus('scheduled', 'Pre-Tournament');
      if (Object.keys(GOLFER_SCORES).length === 0) {
        Object.keys(FLAGS).forEach(function(name) {
          GOLFER_SCORES[name] = { pos: '—', score: 0, thru: '—', teeTime: '—', startHole: 1, tot: null, todayDisplay: '—', r1: null, r2: null, r3: null, r4: null };
        });
      }
      lastFetchTime = Date.now();
      renderAll();
      return;
    }
    console.log('📊 ESPN competitors:', comps.length,
      '| first competitor keys:', Object.keys(comps[0] || {}),
      '| roster?', Array.isArray(comps[0]?.roster) ? comps[0].roster.length : 'no',
      '| athletes?', Array.isArray(comps[0]?.athletes) ? comps[0].athletes.length : 'no',
      '| athlete?', comps[0]?.athlete?.displayName || 'no');
    var evStatus = ev?.status?.type?.name || '';
    var evDetail = ev?.status?.type?.detail || '';
    var evDesc = ev?.status?.type?.description || '';
    var compStatus = ev?.competitions?.[0]?.status?.type?.name || '';
    var compDetail = ev?.competitions?.[0]?.status?.type?.detail || '';
    var allStatusText = (evDetail + ' ' + evDesc + ' ' + compDetail).toLowerCase();
    var espnRoundNumber = ev?.status?.period || 0;
    if (espnRoundNumber > 0) ESPN_ROUND = espnRoundNumber;
    var isPreTournament = evStatus === 'STATUS_SCHEDULED';
    console.log('📡 Event status:', evStatus, '| detail:', evDetail, '| compStatus:', compStatus, '| compDetail:', compDetail);
    var wasPre = !TOURNAMENT_STARTED;
    if (!TOURNAMENT_STARTED && !isPreTournament) TOURNAMENT_STARTED = true;
    if (wasPre && TOURNAMENT_STARTED) console.log('🏌️ TOURNAMENT_STARTED flipped to true — event status:', evStatus);
    var hdrSub = document.getElementById('hdr-sub');
    if (hdrSub) hdrSub.textContent = '';

    Object.entries(GOLFER_SCORES).forEach(function(pair) {
      var n = pair[0], d = pair[1];
      var p = parsePos(d.pos);
      if (p) PREV_POSITIONS[n] = p;
      if (d.score !== 11 && d.score !== 12) { PREV_SCORES[n] = d.score; PREV_THRU[n] = d.thru; }
    });

    var freshScores = {};
    var freshAthleteIds = {};
    // Team events (e.g. Zurich Classic) send multiple athletes per competitor,
    // sharing a single status / teeTime / linescores. Flatten roster/athletes
    // arrays into per-athlete rows while keeping individual events unchanged.
    comps.forEach(function(c) {
      var athletesList = [];
      if (Array.isArray(c.roster) && c.roster.length) {
        c.roster.forEach(function(r) { var a = r?.athlete || r; if (a?.displayName) athletesList.push(a); });
      } else if (Array.isArray(c.athletes) && c.athletes.length) {
        c.athletes.forEach(function(a) { if (a?.displayName) athletesList.push(a); });
      } else if (c.athlete?.displayName) {
        athletesList.push(c.athlete);
      }
      if (!athletesList.length) return;
      // Compute shared team/individual status ONCE per competitor
      var state = c.status?.type?.name || '';
      var scheduled = state === 'STATUS_SCHEDULED';
      var dispVal = (c.status?.displayValue || '').toUpperCase();
      var stateDesc = (c.status?.type?.description || '').toUpperCase();
      var posName = (c.status?.position?.displayName || '').toUpperCase();
      var wd = !isPreTournament && (state.includes('WD') || state.includes('WITHDRAW') || dispVal === 'WD' || stateDesc.includes('WITHDRAW') || posName === 'WD');
      var mc = !isPreTournament && !wd && state.includes('CUT');
      var scoreToPar = c.statistics?.find(function(s) { return s.name === 'scoreToPar'; });
      var lines = c.linescores || [];
      var computedPar = lines.reduce(function(s, l) { return (l.value && l.value > 50) ? s + (l.value - COURSE_PAR) : s; }, 0);
      var score = wd ? 12 : mc ? 11 : (scoreToPar ? scoreToPar.value : computedPar);
      var teeTime = c.status?.teeTime || '';
      var thruRaw = c.status?.thru;
      var nextTeeStr = '';
      if (teeTime && teeTime.includes('T')) { try { nextTeeStr = new Date(teeTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch(e) {} }
      var inProgress = state === 'STATUS_IN_PROGRESS';
      var activelyPlaying = inProgress && thruRaw != null && thruRaw > 0 && thruRaw < 18;
      var thru;
      if (wd) { thru = 'WD'; }
      else if (mc) { thru = 'MC'; }
      else if (activelyPlaying) { thru = String(thruRaw); }
      else if (thruRaw >= 18) { thru = c.status?.displayValue || 'F'; }
      else if (scheduled && nextTeeStr) { thru = nextTeeStr; }
      else if (nextTeeStr && !thruRaw) { thru = nextTeeStr; }
      else if (scheduled) { thru = c.status?.displayValue || 'F'; }
      else { thru = thruRaw > 0 ? String(thruRaw) : (c.status?.displayValue || 'F'); }
      var startHole = c.status?.startHole || 1;
      var rval = function(idx) { var v = lines[idx]?.value; return (v && v > 50) ? v : null; };
      var tot = lines.reduce(function(s, l) { return (l.value && l.value > 50 ? s + l.value : s); }, 0) || null;
      var activeRndIdx = lines.findIndex(function(l, i) { return l.value != null && !(l.value > 50 && lines[i + 1]?.value != null); });
      var todayRound = activelyPlaying ? lines[activeRndIdx >= 0 ? activeRndIdx : 0] : (scheduled ? null : lines[activeRndIdx >= 0 ? activeRndIdx : 0]);
      var todayDisplay = (mc || wd) ? '—' : (todayRound?.displayValue || (todayRound?.value > 50 ? (function() { var tp = todayRound.value - COURSE_PAR; return tp === 0 ? 'E' : (tp > 0 ? '+' + tp : String(tp)); })() : '—'));
      var onCourse = activelyPlaying;
      var teamPos = c.status?.position?.displayName || '—';
      var roundCount = lines.filter(function(l) { return l.value != null; }).length;
      athletesList.forEach(function(athlete) {
        var rawName = athlete.displayName;
        var name = resolvePlayerName(rawName);
        if (athlete.id) freshAthleteIds[name] = athlete.id;
        // Auto-derive flag from ESPN's country code if we don't have one yet
        if (!FLAGS[name] || FLAGS[name] === '🏳️' || FLAGS[name] === '') {
          var flagObj = athlete.flag;
          var citObj = athlete.citizenshipCountry;
          var bpObj = athlete.birthPlace;
          var ccode = '';
          if (flagObj) ccode = (flagObj.alt || flagObj.abbreviation || flagObj.text || '').toUpperCase();
          if (!ccode && citObj) ccode = (citObj.abbreviation || citObj.alpha3 || citObj.alpha2 || citObj.countryCode || '').toUpperCase();
          if (!ccode && bpObj) ccode = (bpObj.countryAbbreviation || bpObj.country || '').toUpperCase();
          if (!ccode && flagObj && flagObj.href) {
            var flagMatch = flagObj.href.match(/\/(\w{2,3})\.png/i);
            if (flagMatch) ccode = flagMatch[1].toUpperCase();
          }
          if (ccode && CODE_TO_FLAG[ccode]) {
            FLAGS[name] = CODE_TO_FLAG[ccode];
          } else if (ccode && ccode.length === 2) {
            FLAGS[name] = String.fromCodePoint(0x1F1E6 + ccode.charCodeAt(0) - 65, 0x1F1E6 + ccode.charCodeAt(1) - 65);
          }
        }
        freshScores[name] = { pos: teamPos, score: wd ? 12 : mc ? 11 : score, thru: thru, teeTime: teeTime, startHole: startHole, tot: tot, todayDisplay: todayDisplay, r1: rval(0), r2: rval(1), r3: rval(2), r4: rval(3), roundCount: roundCount, onCourse: onCourse };
      });
    });
    // Debug: log first 5 competitors with all status fields. For team events
    // (e.g. Zurich Classic) we log each athlete in the roster.
    comps.slice(0, 5).forEach(function(c) {
      var names = [];
      if (Array.isArray(c.roster) && c.roster.length) names = c.roster.map(function(r) { return r?.athlete?.displayName || r?.displayName || '?'; });
      else if (Array.isArray(c.athletes) && c.athletes.length) names = c.athletes.map(function(a) { return a?.displayName || '?'; });
      else names = [c.athlete?.displayName || '?'];
      var st = c.status?.type?.name || '';
      var sched = st === 'STATUS_SCHEDULED';
      var lines = c.linescores || [];
      var lastComp = lines.filter(function(l) { return l.value && l.value > 50; }).pop();
      console.log('🔍 ESPN', names.join(' / '), '| state:', st, '| thru:', c.status?.thru, '| disp:', c.status?.displayValue, '| teeTime:', c.status?.teeTime, '| scheduled:', sched, '| lastCompRound:', lastComp?.value, '| lines:', lines.map(function(l){return l.value}).join(','));
    });

    // Detect score changes for animations
    var newChanges = {};
    Object.entries(freshScores).forEach(function(pair) {
      var n = pair[0], d = pair[1];
      if (d.score === 11 || d.score === 12) return;
      var prev = PREV_SCORES[n];
      if (prev !== undefined && d.score !== prev) {
        var diff = d.score - prev;
        newChanges[n] = diff <= -2 ? 'eagle' : diff < 0 ? 'birdie' : 'bogey';
      }
    });
    if (Object.keys(newChanges).length > 0) {
      SCORE_CHANGES = newChanges;
      setTimeout(function() { SCORE_CHANGES = {}; renderLeaderboard(); }, 8000);
    } else if (!Object.keys(SCORE_CHANGES).length) {
      SCORE_CHANGES = {};
    }

    // Players in picks/FLAGS but missing from ESPN data are likely WD (only during tournament)
    if (!isPreTournament) {
      var allPickNames = new Set();
      ENTRIES.forEach(function(e) { e.picks.forEach(function(p) { allPickNames.add(p); }); });
      allPickNames.forEach(function(name) {
        if (!freshScores[name] && FLAGS[name]) {
          freshScores[name] = { pos: 'WD', score: 12, thru: 'WD', teeTime: '', startHole: 1, tot: null, todayDisplay: '—', r1: null, r2: null, r3: null, r4: null };
          console.log('⚠️ Marked', name, 'as WD (missing from ESPN data)');
        }
      });
    }

    await detectGolfActivity(freshScores);
    GOLFER_SCORES = freshScores;
    ATHLETE_IDS = freshAthleteIds;
    lastFetchTime = Date.now();

    // Detect tournament final + winning score for tiebreaker resolution
    var _actives = Object.values(freshScores).filter(function(g) { return g.score !== 11 && g.score !== 12; });
    var _maxR = 0;
    _actives.forEach(function(g) { var cnt = [g.r1,g.r2,g.r3,g.r4].filter(function(r){return r!=null && r>50;}).length; if(cnt>_maxR) _maxR=cnt; });
    var _allFinished = _actives.length > 0 && _actives.every(function(g) {
      // Authoritative signal: R4 score exists for every active golfer (ESPN thru text varies: F, Final, FT, F*, etc.)
      return g.r4 != null && g.r4 > 50;
    });
    TOURNEY_FINAL = _maxR >= 4 && _allFinished;
    if (TOURNEY_FINAL) {
      var lowestScore = Infinity;
      _actives.forEach(function(g) { if (g.score < lowestScore) lowestScore = g.score; });
      WINNING_SCORE = lowestScore === Infinity ? null : lowestScore;
    } else {
      WINNING_SCORE = null;
    }

    // Determine round status
    var _isPlayoff = allStatusText.indexOf('playoff') !== -1 || espnRoundNumber > 4;
    if (isPreTournament) {
      setApiStatus('scheduled', 'Pre-Tournament');
      setRoundLive(false);
    } else if (_isPlayoff) {
      setApiStatus('live', 'Playoff');
      setRoundLive(true);
    } else {
      var activePlayers = Object.values(freshScores).filter(function(g) { return g.score !== 11 && g.score !== 12; });
      var anyTeeTime = activePlayers.some(function(g) { return g.thru && g.thru.includes(':'); });
      var anyMidRound = activePlayers.some(function(g) { return g.onCourse; });
      setRoundLive(anyMidRound);
      var allDone = !anyMidRound && !anyTeeTime && activePlayers.length > 0 && activePlayers.every(function(g) { return g.thru === 'F' || g.thru === '18' || g.thru === 'MC' || g.thru === 'WD'; });
      if (anyTeeTime && !anyMidRound) {
        var maxComp = 0;
        activePlayers.forEach(function(g) { var cnt = [g.r1, g.r2, g.r3, g.r4].filter(function(r) { return r != null; }).length; if (cnt > maxComp) maxComp = cnt; });
        var nextRound = Math.min(maxComp + 1, 4);
        setApiStatus('between', 'Rd ' + nextRound);
        if (ROUND_START_ROUND < nextRound) {
          saveRoundStartPositions(nextRound);
          console.log('📌 Saved round-start positions for Rd', nextRound);
        }
      } else if (allDone) {
        var completedRound = [activePlayers[0]?.r4 ? 4 : 0, activePlayers[0]?.r3 ? 3 : 0, activePlayers[0]?.r2 ? 2 : 0, activePlayers[0]?.r1 ? 1 : 0].find(function(r) { return r > 0; }) || 1;
        setApiStatus('between', 'Rd ' + completedRound + ' Done');
        if (ROUND_START_ROUND < completedRound + 1) {
          saveRoundStartPositions(completedRound + 1);
          console.log('📌 Saved round-start positions for Rd', completedRound + 1);
        }
      } else {
        var maxCompleted = 0;
        activePlayers.forEach(function(g) {
          var cnt = [g.r1, g.r2, g.r3, g.r4].filter(function(r) { return r != null; }).length;
          if (cnt > maxCompleted) maxCompleted = cnt;
        });
        var currentRound = anyMidRound ? (maxCompleted + 1) || 1 : maxCompleted || (ROUND_START_ROUND || 1);
        if (ROUND_START_ROUND < currentRound) {
          saveRoundStartPositions(currentRound);
          console.log('📌 Saved round-start positions for Rd', currentRound);
        }
        if (anyMidRound) {
          setApiStatus('live', 'Live');
        } else {
          setApiStatus('between', 'Rd ' + (maxCompleted || 1));
        }
      }
    }
    console.log('✅ ESPN API returned', Object.keys(GOLFER_SCORES).length, 'golfers');
    fetchDGLivePreds(); // piggyback — has its own 5-min throttle
    renderAll();
  } catch(e) {
    ErrorTracker.api('ESPN leaderboard/scores parse failed', { message: e.message, stack: e.stack });
    console.error('❌ ESPN API error:', e.message, e.stack);
    if (Object.keys(GOLFER_SCORES).length === 0) {
      Object.keys(FLAGS).forEach(function(name) {
        GOLFER_SCORES[name] = { pos: '—', score: 0, thru: '—', teeTime: 'TBD', startHole: 1, tot: null, todayDisplay: '—', r1: null, r2: null, r3: null, r4: null };
      });
      console.log('⚠️ Seeded', Object.keys(GOLFER_SCORES).length, 'golfers from FLAGS (offline fallback)');
    }
    setApiStatus('cached', 'Offline · tap to retry');
    renderAll();
  }
}

function setApiStatus(state, text) {
  _lastStatusText = text;
  var dot = document.getElementById('live-dot');
  if (dot) dot.className = 'live-dot' + (state === 'live' ? ' on' : '');
  var hdrStatus = document.getElementById('hdr-status');
  if (hdrStatus) hdrStatus.textContent = text;
  var ticker = document.querySelector('.ticker-label');
  if (ticker) ticker.textContent = _tickerMode === 'entries' ? 'POOL' : 'PGA';
}

function refreshData() { setApiStatus('', 'Refreshing…'); fetchESPN(); }

// ─── DataGolf live in-play predictions ───
var _dgLastFetch = 0;
async function fetchDGLivePreds(force) {
  // Only fetch every 2 minutes (Worker caches & shields DataGolf); force bypasses throttle
  if (!force && Date.now() - _dgLastFetch < 120000) return;
  try {
    var res = await fetch('https://datagolf-proxy.jhs797.workers.dev/', { cache: 'no-store' });
    if (!res.ok) {
      var msg = 'DataGolf fetch failed: HTTP ' + res.status;
      console.warn('⚠️ ' + msg);
      if (typeof termDiag === 'function') termDiag(msg, true);
      return;
    }
    var json = await res.json();
    var arr = json.data || json;
    if (!Array.isArray(arr)) {
      if (typeof termDiag === 'function') termDiag('DataGolf: unexpected payload shape', true);
      return;
    }
    var fresh = {};
    var flagsFilled = 0;
    arr.forEach(function(p) {
      // Convert "Last, First" → "First Last"
      var parts = (p.player_name || '').split(', ');
      var name = parts.length === 2 ? (parts[1] + ' ' + parts[0]) : p.player_name;
      name = NAME_ALIASES[name] || name;
      fresh[name] = {
        win: p.win || 0,
        top_5: p.top_5 || 0,
        top_10: p.top_10 || 0,
        top_20: p.top_20 || 0,
        make_cut: p.make_cut || 0
      };
      // Fallback flag from DataGolf when ESPN didn't provide a country
      if (p.country && (!FLAGS[name] || FLAGS[name] === '🏳️' || FLAGS[name] === '')) {
        var code = String(p.country).toUpperCase();
        if (CODE_TO_FLAG[code]) { FLAGS[name] = CODE_TO_FLAG[code]; flagsFilled++; }
      }
    });
    DG_LIVE_PREDS = fresh;
    _dgLastFetch = Date.now();
    console.log('✅ DataGolf live preds:', Object.keys(fresh).length, 'players' + (flagsFilled ? ' (filled ' + flagsFilled + ' flags)' : ''));
    if (typeof termDiag === 'function') termDiag('DataGolf preds loaded: ' + Object.keys(fresh).length + ' players' + (flagsFilled ? ' · ' + flagsFilled + ' flags' : ''));
  } catch(e) {
    console.warn('⚠️ DataGolf fetch failed:', e.message);
    if (typeof termDiag === 'function') termDiag('DataGolf fetch threw: ' + e.message, true);
  }
}

var _autoRefresh = null;

function _onVisibilityChange() {
  if (!document.hidden && lastFetchTime && (Date.now() - lastFetchTime > 30000)) {
    fetchESPN();
  }
}

function startAutoRefresh() {
  if (_autoRefresh) return;
  _autoRefresh = setInterval(function() {
    if (document.hidden) return;
    fetchESPN();
  }, 60000);

  // Refresh immediately when user returns to tab
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

function stopAutoRefresh() {
  clearInterval(_autoRefresh);
  _autoRefresh = null;
  document.removeEventListener('visibilitychange', _onVisibilityChange);
}

function startAgeTimer() {
  setInterval(function() {
    if (!lastFetchTime) return;
    var s = Math.floor((Date.now() - lastFetchTime) / 1000);
    var age = s >= 45 ? (s < 60 ? ' · ' + s + 's ago' : ' · ' + Math.floor(s / 60) + 'm ago') : '';
    var el = document.getElementById('hdr-status');
    if (el) el.textContent = _lastStatusText + age;
  }, 5000);
}

// ─── Scorecard (hole-by-hole) ───
async function fetchCourseHoles() {
  if (COURSE_HOLES) return;
  try {
    var res = await fetch('https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=' + EVENT_ID, { cache: 'no-store' });
    if (!res.ok) return;
    var data = await res.json();
    var holes = data.events?.[0]?.courses?.[0]?.holes;
    if (holes && holes.length) {
      COURSE_HOLES = holes.map(function(h) { return { number: h.number, par: h.shotsToPar, yardage: h.totalYards }; });
      var totalPar = COURSE_HOLES.reduce(function(s, h) { return s + h.par; }, 0);
      if (totalPar >= 60 && totalPar <= 80) COURSE_PAR = totalPar;
      console.log('✅ Course holes loaded:', COURSE_HOLES.length, 'holes, par', COURSE_PAR);
    }
  } catch(e) { ErrorTracker.api('Course holes fetch failed', { error: e.message }); console.error('❌ Course holes fetch error:', e.message); }
}

async function fetchPlayerScorecard(playerName, forceRefresh) {
  if (!forceRefresh && SCORECARD_CACHE[playerName]) return SCORECARD_CACHE[playerName];
  // Share inflight request — prevents concurrent fetches for same player
  if (_scorecardInflight[playerName]) return _scorecardInflight[playerName];
  var playerId = ATHLETE_IDS[playerName];
  if (!playerId || !EVENT_ID) return null;
  _scorecardInflight[playerName] = _fetchScorecardImpl(playerName, playerId);
  try { return await _scorecardInflight[playerName]; } finally { delete _scorecardInflight[playerName]; }
}

async function _fetchScorecardImpl(playerName, playerId) {
  try {
    var url = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/' + EVENT_ID + '/competitions/' + EVENT_ID + '/competitors/' + playerId + '/linescores?lang=en&region=us&limit=100';
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Scorecard API ' + res.status);
    var data = await res.json();

    var roundItems = data.items || [];

    var rounds = await Promise.all(roundItems.map(async function(r, ri) {
      var holeData = r.linescores || [];

      if (holeData.length < 18) {
        var linesRef = r.linescores$ref || r.$ref || (r.linescores && r.linescores.$ref);
        if (linesRef) {
          try {
            var refUrl = linesRef + (linesRef.includes('?') ? '&' : '?') + 'limit=25';
            var refRes = await fetch(refUrl, { cache: 'no-store' });
            if (refRes.ok) {
              var refData = await refRes.json();
              if (refData.items && refData.items.length > holeData.length) {
                holeData = refData.items;
              }
            }
          } catch(e2) { ErrorTracker.api('Scorecard $ref fetch failed', { player: playerName, round: ri + 1, error: e2.message }); console.warn('⚠️ $ref fetch failed for round', ri + 1, e2.message); }
        }
      }

      var holes = holeData.map(function(h) {
        return {
          hole: h.period,
          strokes: h.value,
          par: h.par,
          type: h.scoreType?.name || '',
          display: h.displayValue || String(h.value)
        };
      });
      holes.sort(function(a, b) { return a.hole - b.hole; });
      return { value: r.value, displayValue: r.displayValue, period: r.period, holes: holes };
    }));

    var gd = GOLFER_SCORES[playerName];
    rounds.forEach(function(r, ri) {
      if (r.holes.length > 0 && r.holes.length < 18) {
        var thru = gd ? gd.thru : '?';
        ErrorTracker.api('Incomplete scorecard: only ' + r.holes.length + '/18 holes', {
          player: playerName, round: ri + 1, thru: thru,
          holesReceived: r.holes.map(function(h) { return h.hole; })
        });
      }
    });

    SCORECARD_CACHE[playerName] = rounds;
    console.log('✅ Scorecard loaded for', playerName, ':', rounds.length, 'round(s),', rounds.map(function(r) { return r.holes.length + ' holes'; }).join(', '));
    return rounds;
  } catch(e) {
    ErrorTracker.api('Scorecard fetch failed', { player: playerName, error: e.message });
    console.error('❌ Scorecard fetch error for', playerName, ':', e.message);
    return null;
  }
}

// ── Debug Perf (fetch wrapper) ──────────────────────────────
var DebugPerf = (function() {
  var network = [];
  var MAX = 100;
  function logRequest(entry) { network.push(entry); if (network.length > MAX) network.shift(); }
  return { network: network, logRequest: logRequest };
})();

// Wrap fetch to track all network requests
var _origFetch = window.fetch;
window.fetch = async function() {
  var args = arguments;
  var url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  var start = performance.now();
  try {
    var res = await _origFetch.apply(this, args);
    DebugPerf.logRequest({
      url: url.length > 80 ? url.substring(0, 80) + '…' : url,
      status: res.status,
      duration: Math.round(performance.now() - start),
      ts: new Date().toISOString(),
      ok: res.ok
    });
    return res;
  } catch(e) {
    DebugPerf.logRequest({
      url: url.length > 80 ? url.substring(0, 80) + '…' : url,
      status: 'ERR',
      duration: Math.round(performance.now() - start),
      ts: new Date().toISOString(),
      ok: false,
      error: e.message
    });
    throw e;
  }
};
