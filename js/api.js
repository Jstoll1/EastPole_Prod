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
  // Header logo: Wanamaker-style golf trophy + the event name stacked on
  // two lines (PGA / Championship). We deliberately ignore ESPN's tournament
  // logo URL because it varies week to week (course logos, sponsor marks).
  var hdrLogo = document.getElementById('hdr-tourney-logo');
  var splashLogo = document.getElementById('splash-tourney-logo');
  var hdrCenter = document.querySelector('.hdr-logo-center');
  var TROPHY_SVG = '<svg viewBox="0 0 32 32" fill="none" stroke="#c5a572" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">'
    // finial dot
    + '<circle cx="16" cy="3.2" r="1.1" fill="#c5a572" stroke="none"/>'
    + '<line x1="16" y1="4.4" x2="16" y2="6"/>'
    // domed lid
    + '<path d="M12.2 7 Q12.2 5 16 5 Q19.8 5 19.8 7"/>'
    // cup body
    + '<path d="M11 8 L11 17 Q11 20.5 16 20.5 Q21 20.5 21 17 L21 8 Z"/>'
    // left handle
    + '<path d="M11 10 Q7 10 7 13 Q7 15.6 11 15"/>'
    // right handle
    + '<path d="M21 10 Q25 10 25 13 Q25 15.6 21 15"/>'
    // pedestal
    + '<path d="M14 20.5 L14 23.5 L18 23.5 L18 20.5"/>'
    // base
    + '<rect x="11" y="23.5" width="10" height="2" fill="#c5a572" stroke="none"/>'
    + '</svg>';
  var TROPHY_DATA_URI = 'data:image/svg+xml;utf8,' + encodeURIComponent(TROPHY_SVG);
  // Prefer an explicit event logo URL (set via events/current.json) over
  // the built-in trophy SVG. Mostly used to drop in the official
  // tournament mark for major-week branding.
  var iconSrc = (typeof window.EVENT_LOGO_URL === 'string' && window.EVENT_LOGO_URL) ? window.EVENT_LOGO_URL : TROPHY_DATA_URI;
  var iconHtml = (iconSrc === TROPHY_DATA_URI)
    ? TROPHY_SVG.replace('<svg ', '<svg class="hdr-tourney-icon" ')
    : '<img class="hdr-tourney-icon hdr-tourney-icon-img" src="' + iconSrc + '" alt="">';
  if (splashLogo) {
    splashLogo.src = iconSrc;
    splashLogo.alt = 'Tournament';
    splashLogo.style.display = '';
  }
  if (hdrCenter) {
    if (hdrLogo) hdrLogo.style.display = 'none';
    var existingText = document.getElementById('hdr-tourney-text');
    if (existingText) existingText.remove();
    var wrap = document.createElement('div');
    wrap.id = 'hdr-tourney-text';
    wrap.className = 'hdr-tourney-name hdr-tourney-name-logo-only';
    wrap.innerHTML = iconHtml;
    hdrCenter.appendChild(wrap);
  }
  // Update splash text
  var subEl = document.querySelector('.brand-subtext');
  if (subEl && TOURNEY_NAME) subEl.textContent = TOURNEY_NAME;
  var chipEl = document.querySelector('.splash-event-chip');
  if (chipEl && TOURNEY_DATES) chipEl.textContent = TOURNEY_DATES + (TOURNEY_COURSE ? ' · ' + TOURNEY_COURSE : '');
}

async function fetchESPN() {
  // Wait for events/current.json to load before the first ESPN fetch so the
  // pinned tournament name + date are in place. No-op on subsequent calls
  // (the promise resolves once and stays resolved). Falls through immediately
  // if event-config.js wasn't loaded for some reason — defaults from state.js
  // still apply.
  if (typeof window.eventConfigReady !== 'undefined') {
    try { await window.eventConfigReady; } catch (e) {}
  }
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
      var ath = c.athlete;
      if (!ath || !ath.displayName) return;

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
      // "Today" = the current round's to-par. ESPN linescores carry stroke
      // totals (>50) for completed rounds and a to-par for the in-progress
      // round. The shape of the in-progress entry varies — sometimes the
      // numeric value is the to-par (-1), sometimes value is null and the
      // to-par lives in displayValue ("-1"), sometimes value is a stroke
      // total so far (35) with displayValue carrying the to-par. Probe all
      // three shapes; falling back to "—" when none match.
      var fmtTodayVal = function(v) {
        return v === 0 ? 'E' : (v > 0 ? '+' + v : String(v));
      };
      var looksLikeToPar = function(s) {
        return typeof s === 'string' && /^[+\-]?\d+$|^E$/.test(s.trim());
      };
      // In-progress: value is a small to-par numeric, or value is absent
      // and only displayValue carries the to-par string. Completed rounds
      // always have value > 50 (stroke total) — reject those even though
      // ESPN also populates displayValue with the round's to-par.
      var inProgressLine = lines.find(function(l) {
        if (!l) return false;
        if (l.value != null && Math.abs(l.value) < 50) return true;
        if (l.value == null && looksLikeToPar(l.displayValue)) return true;
        return false;
      });
      // Fallback: most recent completed round's to-par. We want TODAY to
      // show either (a) the active round's score when playing, or (b) the
      // last completed round's score in between/after rounds — never blank
      // unless the tournament hasn't started.
      var latestCompletedLine = null;
      for (var li = lines.length - 1; li >= 0; li--) {
        var ll = lines[li];
        if (ll && ll.value != null && ll.value > 50) { latestCompletedLine = ll; break; }
      }
      var todayDisplay;
      if (mc || wd) {
        todayDisplay = '—';
      } else if (inProgressLine) {
        if (looksLikeToPar(inProgressLine.displayValue)) {
          todayDisplay = inProgressLine.displayValue.trim();
        } else if (inProgressLine.value != null && Math.abs(inProgressLine.value) < 50) {
          todayDisplay = fmtTodayVal(inProgressLine.value);
        } else {
          todayDisplay = '—';
        }
      } else if (latestCompletedLine && looksLikeToPar(latestCompletedLine.displayValue)) {
        todayDisplay = latestCompletedLine.displayValue.trim();
      } else if (latestCompletedLine && latestCompletedLine.value > 50 && typeof COURSE_PAR === 'number') {
        // Last-resort: derive to-par from stroke count if displayValue is missing.
        todayDisplay = fmtTodayVal(latestCompletedLine.value - COURSE_PAR);
      } else {
        todayDisplay = '—';
      }
      var onCourse = activelyPlaying;
      var name = resolvePlayerName(ath.displayName);
      if (ath.id) freshAthleteIds[name] = ath.id;
      if (!FLAGS[name] || FLAGS[name] === '🏳️' || FLAGS[name] === '') {
        var flagObj = ath.flag;
        var citObj = ath.citizenshipCountry;
        var bpObj = ath.birthPlace;
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
      freshScores[name] = { pos: c.status?.position?.displayName || '—', score: wd ? 12 : mc ? 11 : score, thru: thru, teeTime: teeTime, startHole: startHole, tot: tot, todayDisplay: todayDisplay, r1: rval(0), r2: rval(1), r3: rval(2), r4: rval(3), roundCount: lines.filter(function(l) { return l.value != null; }).length, onCourse: onCourse, _rawLines: lines.map(function(l) { return l ? { v: l.value, dv: l.displayValue, p: l.period } : null; }) };
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
      var name = resolvePlayerName(c.athlete?.displayName || '?');
      var st = c.status?.type?.name || '';
      var sched = st === 'STATUS_SCHEDULED';
      var lines = c.linescores || [];
      var lastComp = lines.filter(function(l) { return l.value && l.value > 50; }).pop();
      console.log('🔍 ESPN', name, '| state:', st, '| thru:', c.status?.thru, '| disp:', c.status?.displayValue, '| teeTime:', c.status?.teeTime, '| scheduled:', sched, '| lastCompRound:', lastComp?.value, '| lines:', lines.map(function(l){return l.value}).join(','));
      // Detailed linescore dump for the today-scoring debug — full shape so we
      // can see what ESPN is putting in value vs displayValue per round.
      console.log('   linescores raw:', JSON.stringify(lines.map(function(l) {
        return { value: l?.value, displayValue: l?.displayValue, period: l?.period };
      })));
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
    arr.forEach(function(p) {
      var probs = probsOf(p);
      addPlayer(p.player_name, p.country, probs);
    });
    DG_LIVE_PREDS = fresh;
    _dgLastFetch = Date.now();

    // Persist a snapshot for the F3 trends chart (terminal-only, no-op when
    // the recorder isn't loaded).
    if (typeof recordDGSnapshot === 'function') {
      try { recordDGSnapshot(DG_META.event_name, fresh); } catch(e) { console.warn('DG snapshot record failed', e); }
    }

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
  var competitorId = ATHLETE_IDS[playerName];
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
