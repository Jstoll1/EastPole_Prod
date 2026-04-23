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
    // First fetch: discover the tournament from the scoreboard endpoint.
    // If POOL_CONFIG pins us to a specific tournament date (e.g. Masters week),
    // pass ?dates=YYYYMMDD so we resolve to THAT event instead of "this week",
    // and reject any event whose name doesn't match the pool's configured
    // tournament — otherwise, once the pool's event ends, ESPN would hand back
    // next week's competitors and every Masters pick would collapse to a
    // missing-player WD/MC penalty score.
    var pinDate = (typeof POOL_CONFIG !== 'undefined' && POOL_CONFIG.tournamentDate) ? POOL_CONFIG.tournamentDate : '';
    var pinName = (typeof POOL_CONFIG !== 'undefined' && POOL_CONFIG.tournamentNameMatch) ? POOL_CONFIG.tournamentNameMatch : '';
    var fetchUrl;
    if (EVENT_ID) {
      fetchUrl = 'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=' + EVENT_ID;
    } else if (pinDate) {
      fetchUrl = ESPN_LEADERBOARD_URL + '?dates=' + pinDate;
    } else {
      fetchUrl = ESPN_LEADERBOARD_URL;
    }
    var res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) { ErrorTracker.api('ESPN leaderboard fetch failed', { status: res.status, statusText: res.statusText }); throw new Error(); }
    var data = await res.json();
    var events = (data.events && data.events.length) ? data.events : [];
    var ev;
    if (pinName) {
      // Scan the entire events array for the pool's target — ESPN sometimes
      // returns multiple events on a given date (e.g. PGA + Korn Ferry).
      ev = events.find(function(e) { return (e && e.name || '').toLowerCase().indexOf(pinName.toLowerCase()) !== -1; });
    }
    if (!ev) ev = events[0];
    var comps = ev?.competitions?.[0]?.competitors || [];
    var discoveredId = ev?.id || null;

    // Refuse to adopt an event that doesn't match the pool's target tournament.
    // Prevents post-event data drift (e.g. serving Zurich Classic scores to a
    // Masters pool once the Masters has concluded). Also short-circuits when
    // ESPN returned nothing at all for the pinned date.
    if (pinName && (!ev || (ev.name || '').toLowerCase().indexOf(pinName.toLowerCase()) === -1)) {
      console.warn('🔒 ESPN response did not include pool target "' + pinName + '" (got: ' + events.map(function(e){return e && e.name;}).join(' / ') + ') — skipping scores update');
      lastFetchTime = Date.now();
      renderAll();
      return;
    }

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
    comps.forEach(function(c) {
      // Team events (e.g. Zurich Classic) expose `athletes` (plural); singles events use `athlete`.
      // ESPN has shipped several shapes over the years — probe each before giving up.
      var teamAthletes = null;
      if (Array.isArray(c.athletes)) teamAthletes = c.athletes;
      else if (c.roster && Array.isArray(c.roster.athletes)) teamAthletes = c.roster.athletes;
      else if (Array.isArray(c.roster)) teamAthletes = c.roster.map(function(r) { return r && r.athlete ? r.athlete : r; });
      else if (c.team && Array.isArray(c.team.athletes)) teamAthletes = c.team.athletes;
      if (teamAthletes) teamAthletes = teamAthletes.filter(function(a) { return a && a.displayName; });
      var athleteList = (teamAthletes && teamAthletes.length) ? teamAthletes : (c.athlete?.displayName ? [c.athlete] : []);
      if (!athleteList.length) return;

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
      // Format in the event's local timezone (e.g. CT for TPC Louisiana) so
      // tee times match what ESPN.com / pgatour.com display.
      var nextTeeStr = (teeTime && teeTime.includes('T')) ? fmtTeeTime(teeTime, TOURNEY_COURSE) : '';
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
      // For team events, tag each golfer's record with a shared teamId so the
      // leaderboard can collapse teammates into a single row (still one entry
      // per golfer in GOLFER_SCORES so pool picks resolve normally elsewhere).
      var isTeamEvent = athleteList.length > 1;
      var teamId = isTeamEvent ? ('team-' + (c.id || c.uid || athleteList.map(function(a){return a.id||a.displayName;}).join('|'))) : null;
      // Raw ESPN competitor ID for the team. Used by fetchPlayerScorecard to
      // hit /competitors/{id}/linescores — in team events the competitor is
      // the TEAM, so the athlete ID 404s but the team competitor ID resolves
      // to the team's hole-by-hole (twoball / alternate-shot) score.
      var teamCompId = isTeamEvent ? (c.id || c.uid || null) : null;
      var teammateNames = isTeamEvent ? athleteList.map(function(a) { return resolvePlayerName(a.displayName); }) : null;
      var teamRecord = { pos: c.status?.position?.displayName || '—', score: wd ? 12 : mc ? 11 : score, thru: thru, teeTime: teeTime, startHole: startHole, tot: tot, todayDisplay: todayDisplay, r1: rval(0), r2: rval(1), r3: rval(2), r4: rval(3), roundCount: lines.filter(function(l) { return l.value != null; }).length, onCourse: onCourse, teamId: teamId, teamCompId: teamCompId, teammateNames: teammateNames };

      athleteList.forEach(function(ath) {
        var rawName = ath?.displayName;
        if (!rawName) return;
        var name = resolvePlayerName(rawName);
        if (ath?.id) freshAthleteIds[name] = ath.id;
        if (!FLAGS[name] || FLAGS[name] === '🏳️' || FLAGS[name] === '') {
          var flagObj = ath?.flag;
          var citObj = ath?.citizenshipCountry;
          var bpObj = ath?.birthPlace;
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
        freshScores[name] = Object.assign({}, teamRecord);
      });
    });
    // If ESPN returned competitors but nothing parsed (unknown shape),
    // dump the first competitor for diagnosis and fall back to the
    // pre-tournament empty-state path so the UI doesn't silently blank.
    if (Object.keys(freshScores).length === 0) {
      console.warn('⚠️ ESPN returned', comps.length, 'competitors but none parsed — raw shape:', comps[0]);
      ErrorTracker.api('ESPN competitors unparseable', {
        count: comps.length,
        firstKeys: comps[0] ? Object.keys(comps[0]) : null,
        firstSample: comps[0] ? JSON.stringify(comps[0]).slice(0, 1500) : null
      });
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
    // Debug: log first 5 competitors with all status fields
    comps.slice(0, 5).forEach(function(c) {
      var names = Array.isArray(c.athletes) && c.athletes.length
        ? c.athletes.map(function(a) { return resolvePlayerName(a?.displayName || '?'); }).join(' / ')
        : resolvePlayerName(c.athlete?.displayName || '?');
      var st = c.status?.type?.name || '';
      var sched = st === 'STATUS_SCHEDULED';
      var lines = c.linescores || [];
      var lastComp = lines.filter(function(l) { return l.value && l.value > 50; }).pop();
      console.log('🔍 ESPN', names, '| state:', st, '| thru:', c.status?.thru, '| disp:', c.status?.displayValue, '| teeTime:', c.status?.teeTime, '| scheduled:', sched, '| lastCompRound:', lastComp?.value, '| lines:', lines.map(function(l){return l.value}).join(','));
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
    fetchDGLivePreds(); // piggyback — has its own 60s throttle
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
var DG_PROXY = 'https://datagolf-proxy.jhs797.workers.dev/';

async function _fetchDGEndpoint(endpoint) {
  try {
    var res = await fetch(DG_PROXY + '?endpoint=' + endpoint, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, endpoint: endpoint };
    var json = await res.json();
    // Two payload shapes:
    //   in-play       → { event_name, last_updated, data: [...per-player rows...] }
    //   pre-tournament → { event_name, last_updated, baseline: [...], baseline_history_fit: [...] }
    //                    For team events, each row is a team: { team_name, p1_country, p2_country, win, top_5, ... }
    var arr = Array.isArray(json.data) ? json.data
            : Array.isArray(json.baseline_history_fit) ? json.baseline_history_fit
            : Array.isArray(json.baseline) ? json.baseline
            : Array.isArray(json) ? json
            : null;
    if (!arr) {
      // Dump a peek at the payload so we can see what shape DG actually returned
      console.warn('🏌️ DG ' + endpoint + ' shape mismatch — top-level keys:', Object.keys(json), 'sample:', JSON.stringify(json).slice(0, 500));
      return { ok: false, reason: 'shape', endpoint: endpoint };
    }
    var event_name = json.event_name || json.info?.event_name || '';
    var last_updated = json.last_updated || json.info?.last_updated || '';
    // First time we successfully load this endpoint, log a sample row so payload shape is visible
    if (arr.length && !_dgSampleLogged[endpoint]) {
      _dgSampleLogged[endpoint] = true;
      console.log('🏌️ DG ' + endpoint + ' sample row keys:', Object.keys(arr[0]), arr[0]);
    }
    return { ok: true, endpoint: endpoint, json: json, arr: arr, event_name: event_name, last_updated: last_updated };
  } catch (e) {
    return { ok: false, reason: e.message, endpoint: endpoint };
  }
}
var _dgSampleLogged = {};

async function fetchDGLivePreds(force) {
  // Only fetch every 60s (Worker caches & shields DataGolf); force bypasses throttle
  if (!force && Date.now() - _dgLastFetch < 60000) return;
  try {
    // Hit both endpoints in parallel — Worker proxies each upstream URL with
    // independent caching. Then pick whichever payload's event matches the
    // live ESPN TOURNEY_NAME. (If the Worker hasn't been updated to honor the
    // ?endpoint= param, both will return the same data — harmless.)
    var results = await Promise.all([
      _fetchDGEndpoint('pre-tournament'),
      _fetchDGEndpoint('in-play')
    ]);
    var pre = results[0], live = results[1];
    var ok = results.filter(function(r) { return r.ok; });
    // Always emit a one-line diagnostic of what each endpoint returned
    var diag = results.map(function(r) {
      if (!r.ok) return r.endpoint + '=ERR(' + (r.status || r.reason) + ')';
      return r.endpoint + '=' + (r.event_name || 'no-event') + '/' + r.arr.length + 'p';
    }).join(' · ');
    console.log('🏌️ DG endpoints:', diag);
    if (typeof termDiag === 'function') termDiag('DG: ' + diag);
    if (!ok.length) {
      _dgLastFetch = Math.min(_dgLastFetch, Date.now() - 45000);
      return;
    }
    var norm = function(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var espnEvent = norm(typeof TOURNEY_NAME !== 'undefined' ? TOURNEY_NAME : '');
    var chosen = null;
    if (espnEvent) {
      // Prefer in-play if its event matches ESPN (tournament is live), else pre-tournament if matches.
      if (live.ok && norm(live.event_name) === espnEvent) chosen = live;
      else if (pre.ok && norm(pre.event_name) === espnEvent) chosen = pre;
    }
    // No ESPN match — default to pre-tournament when available (we're in pre-event window),
    // else whichever endpoint returned data.
    if (!chosen) chosen = pre.ok ? pre : live;

    var json = chosen.json, arr = chosen.arr;
    DG_META.event_name = chosen.event_name;
    DG_META.last_updated = chosen.last_updated;
    DG_META.source = chosen.endpoint;
    DG_META.fetched_at = Date.now();
    var fresh = {};
    var dgByFuzzy = {}; // fuzzy key → DG country code (for cross-matching ESPN names)
    var flagsFilled = 0;
    var fuzzyKey = function(s) {
      return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
    };
    var probsOf = function(p) {
      return {
        win: p.win || 0,
        top_5: p.top_5 || 0,
        top_10: p.top_10 || 0,
        top_20: p.top_20 || 0,
        make_cut: p.make_cut || 0
      };
    };
    var addPlayer = function(rawName, country, probs) {
      var parts = (rawName || '').split(', ');
      var name = parts.length === 2 ? (parts[1] + ' ' + parts[0]) : rawName;
      name = NAME_ALIASES[name] || name;
      if (!name) return;
      fresh[name] = probs;
      if (country) dgByFuzzy[fuzzyKey(name)] = String(country).toUpperCase();
      if (country && (!FLAGS[name] || FLAGS[name] === '🏳️' || FLAGS[name] === '')) {
        var code = String(country).toUpperCase();
        if (CODE_TO_FLAG[code]) { FLAGS[name] = CODE_TO_FLAG[code]; flagsFilled++; }
      }
    };
    // Resolve a DataGolf abbreviated team-name part ("M. Fitzpatrick" or "Gerard")
    // to a canonical FLAGS key by matching against existing FLAGS / GOLFER_SCORES names.
    var _resolvePool = null;
    var resolveDGTeamName = function(part) {
      part = String(part || '').trim();
      if (!part) return null;
      if (!_resolvePool) {
        var seen = {};
        _resolvePool = Object.keys(FLAGS || {}).concat(Object.keys(GOLFER_SCORES || {})).filter(function(n) {
          if (seen[n]) return false; seen[n] = true; return true;
        });
      }
      var dotIdx = part.indexOf('.');
      if (dotIdx === -1) {
        // Last name only ("Gerard", "Yellamaraju", "Dumont De Chassart") — match
        // by the trailing last-name chunk (up to 3 words for names like
        // "Dumont De Chassart").
        var lastLower = part.toLowerCase();
        for (var i = 0; i < _resolvePool.length; i++) {
          var nm = _resolvePool[i];
          var ps = nm.split(/\s+/);
          var l1 = ps[ps.length - 1].toLowerCase();
          var l2 = ps.length >= 2 ? ps.slice(-2).join(' ').toLowerCase() : '';
          var l3 = ps.length >= 3 ? ps.slice(-3).join(' ').toLowerCase() : '';
          if (l1 === lastLower || l2 === lastLower || l3 === lastLower) return nm;
        }
        return null;
      }
      // "X. Lastname" — first initial(s) + last name (last name may be multi-word).
      var m = part.match(/^([A-Za-z]+)\.?\s+(.+)$/);
      if (!m) return null;
      var initial = m[1].toLowerCase();
      var last = m[2].toLowerCase();
      for (var j = 0; j < _resolvePool.length; j++) {
        var nm2 = _resolvePool[j];
        var ps2 = nm2.split(/\s+/);
        if (ps2.length < 2) continue;
        if (!ps2[0].toLowerCase().startsWith(initial)) continue;
        var rest = ps2.slice(1).join(' ').toLowerCase();
        var lastSingle = ps2[ps2.length - 1].toLowerCase();
        if (rest === last || lastSingle === last) return nm2;
      }
      return null;
    };

    var unresolved = [];
    var freshTeams = []; // populated only for team-event payloads
    arr.forEach(function(p) {
      var probs = probsOf(p);
      // Team-event pre-tournament: row has team_name + p1_country/p2_country, no per-player names.
      if (p.team_name && (p.p1_country !== undefined || p.p2_country !== undefined)) {
        var tparts = String(p.team_name).split('/').map(function(s) { return s.trim(); });
        var n1 = resolveDGTeamName(tparts[0]);
        var n2 = resolveDGTeamName(tparts[1]);
        if (n1) addPlayer(n1, p.p1_country, probs); else if (tparts[0]) unresolved.push(tparts[0]);
        if (n2) addPlayer(n2, p.p2_country, probs); else if (tparts[1]) unresolved.push(tparts[1]);
        // Build a team row keyed by the original team_name so F5 can render teams.
        // Use the resolved canonical names + flag emojis when available.
        var p1Display = n1 ? ((FLAGS[n1] || '') + ' ' + n1).trim() : tparts[0];
        var p2Display = n2 ? ((FLAGS[n2] || '') + ' ' + n2).trim() : tparts[1];
        freshTeams.push({
          team_name: p.team_name,
          display: p1Display + ' / ' + p2Display,
          p1_country: p.p1_country,
          p2_country: p.p2_country,
          win: probs.win, top_5: probs.top_5, top_10: probs.top_10,
          top_20: probs.top_20, make_cut: probs.make_cut
        });
      } else if (p.player_name_1 && p.player_name_2) {
        addPlayer(p.player_name_1, p.country_1, probs);
        addPlayer(p.player_name_2, p.country_2, probs);
      } else {
        addPlayer(p.player_name, p.country, probs);
      }
    });
    DG_TEAM_PREDS = freshTeams;
    if (unresolved.length) {
      console.warn('🏌️ DG: ' + unresolved.length + ' team-name parts unresolved:', unresolved.join(', '));
      if (typeof termDiag === 'function') termDiag('DG unresolved names: ' + unresolved.length + ' (see console)', true);
    }
    DG_LIVE_PREDS = fresh;
    _dgLastFetch = Date.now();

    // Cross-match: any GOLFER_SCORES row without a flag — try a fuzzy name
    // lookup against DataGolf's country data before giving up.
    var crossFilled = 0;
    var stillMissing = [];
    Object.keys(GOLFER_SCORES || {}).forEach(function(espnName) {
      var f = FLAGS[espnName];
      if (f && f !== '🏳️' && f !== '') return;
      var code = dgByFuzzy[fuzzyKey(espnName)];
      if (code && CODE_TO_FLAG[code]) {
        FLAGS[espnName] = CODE_TO_FLAG[code];
        crossFilled++;
      } else {
        stillMissing.push(espnName + (code ? ' (DG code: ' + code + ')' : ''));
      }
    });
    if (crossFilled > 0) console.log('🏳️ Fuzzy-matched', crossFilled, 'flags from DG');
    if (stillMissing.length > 0) {
      console.warn('⚠️ Missing flags for', stillMissing.length, 'golfers:', stillMissing.join(', '));
      ErrorTracker.api('Missing player flags', { count: stillMissing.length, players: stillMissing });
      if (typeof termDiag === 'function') termDiag('Missing flags: ' + stillMissing.length + ' — see console', true);
    }
    console.log('✅ DataGolf live preds:', Object.keys(fresh).length, 'players' + (flagsFilled ? ' (filled ' + flagsFilled + ' flags)' : '') + (crossFilled ? ' (+' + crossFilled + ' fuzzy)' : ''));
    if (typeof termDiag === 'function') termDiag('DataGolf preds loaded: ' + Object.keys(fresh).length + ' players' + (flagsFilled ? ' · ' + flagsFilled + ' flags' : '') + (crossFilled ? ' · +' + crossFilled + ' fuzzy' : ''));
    // Re-render so F5 odds + threat panels reflect the fresh DG numbers (not just flags)
    if (typeof renderAll === 'function') renderAll();
  } catch(e) {
    console.warn('⚠️ DataGolf fetch failed:', e.message);
    if (typeof termDiag === 'function') termDiag('DataGolf fetch threw: ' + e.message, true);
    // Don't let a transient failure lock us out for the full throttle window
    _dgLastFetch = Math.min(_dgLastFetch, Date.now() - 45000);
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
  // Team events: ESPN's competitor is the TEAM, so /competitors/{athleteId}
  // 404s. Fall back to the team competitor ID so the linescores endpoint
  // returns the team's twoball/alternate-shot hole-by-hole scores. Singles
  // events have no teamCompId and keep using the athlete ID as before.
  var gd = GOLFER_SCORES[playerName];
  var competitorId = (gd && gd.teamCompId) || ATHLETE_IDS[playerName];
  if (!competitorId || !EVENT_ID) return null;
  _scorecardInflight[playerName] = _fetchScorecardImpl(playerName, competitorId);
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
