// ── API / Data Fetching ────────────────────────────────────

var _scorecardInflight = {};

async function fetchESPN() {
  try {
    var res = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga');
    if (!res.ok) { ErrorTracker.api('ESPN leaderboard fetch failed', { status: res.status, statusText: res.statusText }); throw new Error(); }
    var data = await res.json();
    var comps = data.events?.[0]?.competitions?.[0]?.competitors || [];
    EVENT_ID = data.events?.[0]?.id || EVENT_ID || null;
    if (!comps.length) {
      console.log('⚠️ ESPN API returned event but no competitors — field not published yet');
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
    var evStatus = data.events?.[0]?.status?.type?.name || '';
    var evDetail = data.events?.[0]?.status?.type?.detail || '';
    var evDesc = data.events?.[0]?.status?.type?.description || '';
    var compStatus = data.events?.[0]?.competitions?.[0]?.status?.type?.name || '';
    var compDetail = data.events?.[0]?.competitions?.[0]?.status?.type?.detail || '';
    var allStatusText = (evDetail + ' ' + evDesc + ' ' + compDetail).toLowerCase();
    var espnRoundNumber = data.events?.[0]?.status?.period || 0;
    if (espnRoundNumber > 0) ESPN_ROUND = espnRoundNumber;
    var isPreTournament = evStatus === 'STATUS_SCHEDULED';
    console.log('📡 Event status:', evStatus, '| detail:', evDetail, '| compStatus:', compStatus, '| compDetail:', compDetail);
    var wasPre = !TOURNAMENT_STARTED;
    if (!TOURNAMENT_STARTED && !isPreTournament) TOURNAMENT_STARTED = true;
    if (wasPre && TOURNAMENT_STARTED) console.log('🏌️ TOURNAMENT_STARTED flipped to true — event status:', evStatus);
    var fullName = data.events[0].name || 'Valero Texas Open';
    var parts = fullName.split(' ');
    var openIdx = parts.findIndex(function(w) { return w.toLowerCase() === 'open'; });
    var shortName = openIdx > 0 ? parts.slice(Math.max(0, openIdx - 1), openIdx + 1).join(' ') : fullName;
    var hdrSub = document.getElementById('hdr-sub');
    if (hdrSub) hdrSub.textContent = shortName;
    var tournLabel = document.getElementById('lb-tournament-label');
    if (tournLabel) tournLabel.textContent = shortName;

    Object.entries(GOLFER_SCORES).forEach(function(pair) {
      var n = pair[0], d = pair[1];
      var p = parsePos(d.pos);
      if (p) PREV_POSITIONS[n] = p;
      if (d.score !== 11 && d.score !== 12) { PREV_SCORES[n] = d.score; PREV_THRU[n] = d.thru; }
    });

    var freshScores = {};
    var freshAthleteIds = {};
    comps.forEach(function(c) {
      var rawName = c.athlete?.displayName;
      if (!rawName) return;
      var name = resolvePlayerName(rawName);
      if (c.athlete?.id) freshAthleteIds[name] = c.athlete.id;
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
      var lastCompletedRound = lines.filter(function(l) { return l.value && l.value > 50; }).pop();
      var nextTeeStr = '';
      if (teeTime && teeTime.includes('T')) { try { nextTeeStr = new Date(teeTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch(e) {} }
      var inProgress = state === 'STATUS_IN_PROGRESS';
      var activelyPlaying = inProgress && thruRaw != null && thruRaw > 0 && thruRaw < 18;
      var thru;
      if (wd) { thru = 'WD'; }
      else if (mc) { thru = 'MC'; }
      else if (activelyPlaying) { thru = String(thruRaw); }
      else if (nextTeeStr) { thru = nextTeeStr; }
      else if (scheduled) { thru = c.status?.displayValue || 'F'; }
      else { thru = thruRaw > 0 ? String(thruRaw) : (c.status?.displayValue || 'F'); }
      var startHole = c.status?.startHole || 1;
      var rval = function(idx) { var v = lines[idx]?.value; return (v && v > 50) ? v : null; };
      var tot = lines.reduce(function(s, l) { return (l.value && l.value > 50 ? s + l.value : s); }, 0) || null;
      var activeRndIdx = lines.findIndex(function(l, i) { return l.value != null && !(l.value > 50 && lines[i + 1]?.value != null); });
      var todayRound = activelyPlaying ? lines[activeRndIdx >= 0 ? activeRndIdx : 0] : (scheduled ? null : lines[activeRndIdx >= 0 ? activeRndIdx : 0]);
      var todayDisplay = (mc || wd) ? '—' : (todayRound?.displayValue || (todayRound?.value > 50 ? (function() { var tp = todayRound.value - COURSE_PAR; return tp === 0 ? 'E' : (tp > 0 ? '+' + tp : String(tp)); })() : '—'));
      var onCourse = activelyPlaying;
      freshScores[name] = { pos: c.status?.position?.displayName || '—', score: wd ? 12 : mc ? 11 : score, thru: thru, teeTime: teeTime, startHole: startHole, tot: tot, todayDisplay: todayDisplay, r1: rval(0), r2: rval(1), r3: rval(2), r4: rval(3), roundCount: lines.filter(function(l) { return l.value != null; }).length, onCourse: onCourse };
    });
    // Debug: log first 5 players with all status fields
    comps.slice(0, 5).forEach(function(c) {
      var n = resolvePlayerName(c.athlete?.displayName || '?');
      var st = c.status?.type?.name || '';
      var sched = st === 'STATUS_SCHEDULED';
      var lines = c.linescores || [];
      var lastComp = lines.filter(function(l) { return l.value && l.value > 50; }).pop();
      console.log('🔍 ESPN', n, '| state:', st, '| thru:', c.status?.thru, '| disp:', c.status?.displayValue, '| teeTime:', c.status?.teeTime, '| scheduled:', sched, '| lastCompRound:', lastComp?.value, '| lines:', lines.map(function(l){return l.value}).join(','));
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

    // Determine round status
    if (isPreTournament) {
      setApiStatus('scheduled', 'Pre-Tournament');
      setRoundLive(false);
    } else {
      var activePlayers = Object.values(freshScores).filter(function(g) { return g.score !== 11 && g.score !== 12; });
      var anyTeeTime = activePlayers.some(function(g) { return g.thru && g.thru.includes(':'); });
      var anyMidRound = activePlayers.some(function(g) { return g.onCourse; });
      setRoundLive(anyMidRound);
      var allDone = !anyMidRound && !anyTeeTime && activePlayers.length > 0 && activePlayers.every(function(g) { return g.thru === 'F' || g.thru === '18' || g.thru === 'MC' || g.thru === 'WD'; });
      if (anyTeeTime && !anyMidRound) {
        var maxComp = 0;
        activePlayers.forEach(function(g) { var cnt = [g.r1, g.r2, g.r3, g.r4].filter(function(r) { return r != null; }).length; if (cnt > maxComp) maxComp = cnt; });
        var nextRound = maxComp + 1;
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
  dot.className = 'live-dot' + (state === 'live' ? ' on' : '');
  document.getElementById('hdr-status').textContent = text;
  var ticker = document.querySelector('.ticker-label');
  if (ticker) ticker.textContent = _tickerMode === 'entries' ? 'POOL' : 'PGA';
}

function refreshData() { setApiStatus('', 'Refreshing…'); fetchESPN(); }

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
    var res = await fetch('https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=' + EVENT_ID);
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
    var res = await fetch(url);
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
            var refRes = await fetch(refUrl);
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
