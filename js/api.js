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
  var espnCourse = venue ? (venue.fullName || venue.shortName || '') : '';
  // Honor a hard pin from events/current.json — keeps Shinnecock visible
  // when ESPN's scoreboard is still reporting an in-between tour stop.
  // Drops to ESPN once the override is cleared (no override key set).
  if (typeof window.EVENT_COURSE_OVERRIDE === 'string' && window.EVENT_COURSE_OVERRIDE) {
    TOURNEY_COURSE = window.EVENT_COURSE_OVERRIDE;
  } else if (espnCourse) {
    TOURNEY_COURSE = espnCourse;
  } else if (!TOURNEY_COURSE) {
    TOURNEY_COURSE = '';
  }
  if (venue && venue.address) {
    TOURNEY_CITY = venue.address.summary
      || [venue.address.city, venue.address.state || venue.address.country].filter(Boolean).join(', ')
      || TOURNEY_CITY || '';
  }
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
  // Header: stacked "PGA / CHAMPIONSHIP" wordmark — no trophy graphic,
  // no enclosing badge. Pure typography per user direction. The
  // EVENT_LOGO_URL plumbing stays in place — if a transparent logo
  // image is dropped in via events/current.json, it renders to the
  // left of the wordmark; otherwise the text stands alone centered.
  var iconHtml = '';
  if (typeof window.EVENT_LOGO_URL === 'string' && window.EVENT_LOGO_URL) {
    iconHtml = '<img class="hdr-tourney-icon hdr-tourney-icon-img" src="' + window.EVENT_LOGO_URL + '" alt="">';
  } else if (window.EVENT_STACK_TITLE && !window.EVENT_HIDE_TROPHY) {
    // Stacked wordmark (e.g. The Open): render the trophy emoji as a
    // sibling icon so it can scale to the full two-line height instead
    // of hugging the top line as inline text.
    iconHtml = '<span class="hdr-tourney-emoji">🏆</span>';
  }
  if (splashLogo) {
    splashLogo.style.display = 'none';
  }
  if (hdrCenter) {
    if (hdrLogo) hdrLogo.style.display = 'none';
    var existingText = document.getElementById('hdr-tourney-text');
    if (existingText) existingText.remove();
    var wrap = document.createElement('div');
    wrap.id = 'hdr-tourney-text';
    wrap.className = 'hdr-tourney-name';
    wrap.innerHTML = iconHtml
      + '<span class="hdr-tourney-label">'
      +   '<span class="hdr-tourney-line1"></span>'
      +   '<span class="hdr-tourney-line2"></span>'
      + '</span>';
    hdrCenter.appendChild(wrap);
    // Stack the tournament name on two lines, splitting at the LAST space.
    // "PGA Championship" → "PGA" / "Championship". Short names ("Masters",
    // "U.S. Open") stay on a single line — otherwise "U.S." / "Open" reads
    // as a broken split rather than an elegant stack.
    var l1 = document.querySelector('.hdr-tourney-line1');
    var l2 = document.querySelector('.hdr-tourney-line2');
    var name = (typeof window.EVENT_DISPLAY_NAME === 'string' && window.EVENT_DISPLAY_NAME) || TOURNEY_NAME || '';
    var lastSpace = name.lastIndexOf(' ');
    // Suppress the 🏆 emoji when a real event logo is configured (image
    // already sits to the left of the wordmark and the emoji becomes a
    // duplicate icon) OR when events/current.json opts out via hideTrophy
    // (wordmark-alone treatment, e.g. The Open).
    var trophy = (iconHtml || window.EVENT_HIDE_TROPHY) ? '' : '🏆';
    // Split when the name is long enough that a single line would crowd the
    // header, OR when the current event opts in via cfg.stackTitle (short
    // names like "The Open" split into THE / OPEN for a stacked broadcast
    // treatment).
    var forceStack = lastSpace > 0 && (name.length > 12 || window.EVENT_STACK_TITLE);
    if (l1 && l2) {
      if (forceStack) {
        l1.textContent = trophy + name.slice(0, lastSpace);
        l2.textContent = name.slice(lastSpace + 1);
      } else {
        l1.textContent = trophy + name;
        l2.textContent = '';
      }
    }
  }
  // Update splash text
  var subEl = document.querySelector('.brand-subtext');
  var splashName = (typeof window.EVENT_DISPLAY_NAME === 'string' && window.EVENT_DISPLAY_NAME) || TOURNEY_NAME || '';
  if (subEl && splashName) subEl.textContent = splashName;
  var chipEl = document.querySelector('.splash-event-chip');
  var splashDates = (typeof window.EVENT_DATES_OVERRIDE === 'string' && window.EVENT_DATES_OVERRIDE) || TOURNEY_DATES || '';
  if (chipEl && splashDates) chipEl.textContent = splashDates + (TOURNEY_COURSE ? ' · ' + TOURNEY_COURSE : '');
  // Mobile-only weather chip on the round row. No-op on terminal (the
  // chip element only exists in index.html). Cache inside the function
  // keeps this cheap on the 30s refresh cycle.
  if (typeof renderMobileWeather === 'function') renderMobileWeather();
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
    // Always discover the current PGA Tour event from the scoreboard endpoint
    // — no name/date pin. The leaderboard rolls forward week to week with
    // whatever ESPN says is "current". Pool entries are not touched by this
    // (they keep referencing whatever golfers they were submitted with);
    // when the tournament rotates and old picks aren't in the new field,
    // their scores fall through the missing-pick penalty path elsewhere.
    var res = await fetch(ESPN_LEADERBOARD_URL, { cache: 'no-store' });
    if (!res.ok) { ErrorTracker.api('ESPN leaderboard fetch failed', { status: res.status, statusText: res.statusText }); throw new Error(); }
    var data = await res.json();
    var events = (data.events && data.events.length) ? data.events : [];
    var ev = events[0];
    var comps = ev?.competitions?.[0]?.competitors || [];
    var discoveredId = ev?.id || null;

    if (!ev) {
      console.warn('🏌️ ESPN scoreboard returned no events — nothing to display');
      setApiStatus('scheduled', 'No event scheduled');
      lastFetchTime = Date.now();
      renderAll();
      return;
    }

    _extractTourneyMeta(ev);

    // Re-fetch from the leaderboard endpoint — it carries fuller competitor /
    // tee-time data than the scoreboard summary. Always do this on every
    // refresh (not just first fetch) so EVENT_ID tracks ESPN's current event
    // when it rotates week to week. The prior "only if !EVENT_ID" guard would
    // pin us to last week's tournament forever.
    if (discoveredId) {
      EVENT_ID = discoveredId;
      var lbRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=' + EVENT_ID, { cache: 'no-store' });
      if (lbRes.ok) {
        data = await lbRes.json();
        ev = data.events && data.events[0];
        comps = ev?.competitions?.[0]?.competitors || [];
        _extractTourneyMeta(ev);
      }
    }
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
      // Tee time can sit in a few different fields between rounds — ESPN's
      // c.status.teeTime is the canonical spot, but the linescore for the
      // upcoming round sometimes carries it (linescores[ESPN_ROUND]?.teeTime
      // or .startTime) and the status.position label can fall back to a
      // human "8:00 AM" string. Try them in order so a posted pairing isn't
      // missed because ESPN parked it on a sibling field.
      var teeTime = c.status?.teeTime || '';
      if (!teeTime) {
        var nextLine = lines[ESPN_ROUND] || lines[(ESPN_ROUND || 1)]; // ESPN_ROUND is current; next round = same idx (0-based linescores)
        teeTime = nextLine?.teeTime || nextLine?.startTime || '';
      }
      var thruRaw = c.status?.thru;
      // Format in the event's local timezone (e.g. CT for TPC Louisiana) so
      // tee times match what ESPN.com / pgatour.com display. Only treat
      // `nextTeeStr` as actually "next" when the tee time is in the future —
      // ESPN keeps the prior round's (now-past) tee time on the competitor
      // record after a round wraps, so without the guard a freshly-finished
      // player would immediately flip back to their already-played tee time.
      var teeIsFuture = false;
      if (teeTime && teeTime.includes('T')) {
        try { teeIsFuture = new Date(teeTime).getTime() > Date.now(); } catch(e) {}
      }
      var nextTeeStr = teeIsFuture ? fmtTeeTime(teeTime, TOURNEY_COURSE) : '';
      // Last-resort: ESPN sometimes drops a "8:00 AM" string into the
      // status displayValue or position label between rounds when the
      // structured teeTime field is still empty. If we can spot a clock-
      // looking string there, treat that as the tee time directly.
      if (!nextTeeStr) {
        var dvRaw = c.status?.displayValue || '';
        var posRaw = c.status?.position?.displayName || '';
        var clockRe = /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i;
        var dvHit = dvRaw.match(clockRe);
        var posHit = posRaw.match(clockRe);
        if (dvHit) nextTeeStr = dvHit[0];
        else if (posHit) nextTeeStr = posHit[0];
      }
      var inProgress = state === 'STATUS_IN_PROGRESS';
      var activelyPlaying = inProgress && thruRaw != null && thruRaw > 0 && thruRaw < 18;
      var thru;
      if (wd) { thru = 'WD'; }
      else if (mc) { thru = 'MC'; }
      else if (activelyPlaying) { thru = String(thruRaw); }
      // Between rounds: a future tee time wins over the prior round's "F",
      // so the THRU column flips to "8:30 AM CT" the moment ESPN posts the
      // next pairings instead of staying stuck on the finished-round label.
      else if (nextTeeStr) { thru = nextTeeStr; }
      else if (thruRaw >= 18) { thru = c.status?.displayValue || 'F'; }
      else if (scheduled) { thru = c.status?.displayValue || 'F'; }
      else { thru = thruRaw > 0 ? String(thruRaw) : (c.status?.displayValue || 'F'); }
      // ESPN sometimes parks the raw ISO timestamp in displayValue for
      // scheduled rows ('2026-05-15T10:50:00Z'). Catch that here so the
      // renderer's loose isTeeTime check (any colon) doesn't surface the
      // raw ISO.
      if (typeof thru === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(thru)) {
        var _fmt = fmtTeeTime(thru, TOURNEY_COURSE);
        if (_fmt) thru = _fmt;
      }
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
    // Gate on ESPN's authoritative STATUS_FINAL — mid-R4 a golfer 12-13 holes in
    // can have a running stroke count > 50 stored in r4, which previously tripped
    // the "all rounds complete" heuristic and flipped the app to FINAL during play.
    var _actives = Object.values(freshScores).filter(function(g) { return g.score !== 11 && g.score !== 12; });
    var _maxR = 0;
    _actives.forEach(function(g) { var cnt = [g.r1,g.r2,g.r3,g.r4].filter(function(r){return r!=null && r>50;}).length; if(cnt>_maxR) _maxR=cnt; });
    var _allFinished = _actives.length > 0 && _actives.every(function(g) {
      return g.r4 != null && g.r4 > 50;
    });
    TOURNEY_FINAL = evStatus === 'STATUS_FINAL' && _maxR >= 4 && _allFinished;
    if (TOURNEY_FINAL) {
      var lowestScore = Infinity;
      _actives.forEach(function(g) { if (g.score < lowestScore) lowestScore = g.score; });
      WINNING_SCORE = lowestScore === Infinity ? null : lowestScore;
    } else {
      WINNING_SCORE = null;
    }

    // Determine round status
    var _isPlayoff = allStatusText.indexOf('playoff') !== -1 || espnRoundNumber > 4;
    // Expose globally so renderers can show a "* Playoff" footnote even
    // when ESPN flags the playoff but no 5th round data exists yet
    // (scheduled-but-not-played state, e.g. Sunday night before a Monday
    // playoff). The local _isPlayoff covers that case via allStatusText.
    window.IS_PLAYOFF_PENDING = _isPlayoff;
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
    setApiStatus('cached', 'Offline — tap to retry');
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

function refreshData() {
  setApiStatus('', 'Refreshing…');
  // Visual ack on the header pill — without this the fetch can finish in
  // <300ms and the user sees no change so the tap feels dead.
  var pill = document.querySelector('.hdr-pill');
  if (pill) {
    pill.classList.add('is-refreshing');
    setTimeout(function() { pill.classList.remove('is-refreshing'); }, 700);
  }
  // Force-refresh DG predictions + pool sheet alongside ESPN so a tap of
  // the LIVE pill genuinely pulls all three feeds, not just scores.
  if (typeof fetchDGLivePreds === 'function') fetchDGLivePreds(true);
  if (typeof loadPoolEntries === 'function') loadPoolEntries(true);
  fetchESPN();
}

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
  if (!document.hidden && lastFetchTime && (Date.now() - lastFetchTime > 15000)) {
    fetchESPN();
  }
}

function startAutoRefresh() {
  if (_autoRefresh) return;
  _autoRefresh = setInterval(function() {
    if (document.hidden) return;
    fetchESPN();
  }, 30000);

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
    // Use a thin-space separator (no middle-dot) so the header pill doesn't
    // visually read as a second indicator next to the .live-dot circle.
    var age = s >= 45 ? (s < 60 ? ' ' + s + 's ago' : ' ' + Math.floor(s / 60) + 'm ago') : '';
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

// ─── Mobile weather chip (compact forecast next to the round label) ──────
// Coords resolve dynamically per tournament: small hand-maintained fast
// path for venues we've already seen, then Open-Meteo's free geocoding
// API for anything new. Geocode hits are cached in localStorage so we
// never re-fetch the same course twice. RainViewer takes lat/lon
// directly so no station-code mapping is required.
var _MOBILE_WX_COORDS = {
  'Shinnecock Hills Golf Club':   { lat: 40.893, lon: -72.458 },
  'Aronimink Golf Club':          { lat: 40.011, lon: -75.355 },
  'Augusta National Golf Club':   { lat: 33.503, lon: -82.021 },
  'Quail Hollow Club':            { lat: 35.154, lon: -80.821 },
  'Pebble Beach Golf Links':      { lat: 36.569, lon: -121.949 },
  'TPC Sawgrass':                 { lat: 30.199, lon: -81.395 },
  'Torrey Pines Golf Course':     { lat: 32.895, lon: -117.250 }
};
var _WX_GEOCODE_LS_KEY = 'east_pole_wx_geocode_v1';
var _wxGeocodeCache = (function() {
  try { return JSON.parse(localStorage.getItem(_WX_GEOCODE_LS_KEY) || '{}') || {}; }
  catch (e) { return {}; }
})();
function _wxGeocodePersist() {
  try { localStorage.setItem(_WX_GEOCODE_LS_KEY, JSON.stringify(_wxGeocodeCache)); } catch (e) {}
}
async function _wxGeocode(query) {
  if (!query) return null;
  try {
    var url = 'https://geocoding-api.open-meteo.com/v1/search'
      + '?name=' + encodeURIComponent(query)
      + '&count=1&language=en&format=json';
    var res = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    var hit = data && data.results && data.results[0];
    return hit ? { lat: hit.latitude, lon: hit.longitude } : null;
  } catch (e) { return null; }
}
// Sync fast-path lookup against the hand-maintained map. Returns null
// when no match — caller should fall through to the async resolver.
function _mobileWxLookupCoords(courseName) {
  if (!courseName) return null;
  if (_MOBILE_WX_COORDS[courseName]) return _MOBILE_WX_COORDS[courseName];
  var lower = courseName.toLowerCase();
  for (var k in _MOBILE_WX_COORDS) {
    var kl = k.toLowerCase();
    if (lower.indexOf(kl) !== -1 || kl.indexOf(lower) !== -1) return _MOBILE_WX_COORDS[k];
  }
  return null;
}
// Full resolver — fast path → localStorage cache → geocode by course →
// geocode by ESPN city/state. Caches every hit so subsequent loads are
// free. Returns { lat, lon } or null.
async function _mobileWxResolveCoords(courseName) {
  if (!courseName) return null;
  var fast = _mobileWxLookupCoords(courseName);
  if (fast) return fast;
  if (_wxGeocodeCache[courseName]) return _wxGeocodeCache[courseName];
  var coords = await _wxGeocode(courseName);
  if (!coords && typeof TOURNEY_CITY === 'string' && TOURNEY_CITY) {
    coords = await _wxGeocode(TOURNEY_CITY);
  }
  if (coords) {
    _wxGeocodeCache[courseName] = coords;
    _wxGeocodePersist();
  }
  return coords;
}
function _mobileWxIcon(code) {
  if (code == null) return '☁️';
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '☁️';
}
var _mobileWxCache = { course: '', daily: null, fetchedAt: 0 };
async function _fetchMobileWeather(courseName) {
  var coords = await _mobileWxResolveCoords(courseName);
  if (!coords) return null;
  // 14-day window + 4 past days covers any tournament that started up to
  // 4 days ago. The modal aligns R1–R4 by matching EVENT_DATES_START_ISO
  // inside daily.time; the chip just uses today's index. past_days is
  // mandatory once the tournament is mid-flight — Open-Meteo would
  // otherwise drop the Thu/Fri columns and R1–R4 would all shift forward.
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + coords.lat
    + '&longitude=' + coords.lon
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&past_days=4&forecast_days=10';
  try {
    var res = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    return data.daily || null;
  } catch (e) { return null; }
}
// Today's index inside daily.time. Open-Meteo returns one entry per day
// keyed by local date (YYYY-MM-DD). With past_days=4 the today slot is
// no longer index 0 — match by string.
function _mobileWxTodayIdx(d) {
  if (!d || !d.time) return -1;
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  var todayIso = y + '-' + m + '-' + day;
  var i = d.time.indexOf(todayIso);
  return i >= 0 ? i : 0;
}
async function renderMobileWeather() {
  var el = document.getElementById('lb-weather-chip');
  if (!el) return; // terminal page doesn't have the chip
  var course = (typeof TOURNEY_COURSE === 'string' && TOURNEY_COURSE) || '';
  if (!course) return;
  // Cache for 10 minutes per course — Open-Meteo is free but no reason to hammer it.
  var stale = Date.now() - _mobileWxCache.fetchedAt > 10 * 60 * 1000;
  if (_mobileWxCache.course !== course || stale || !_mobileWxCache.daily) {
    var daily = await _fetchMobileWeather(course);
    if (!daily) return;
    _mobileWxCache = { course: course, daily: daily, fetchedAt: Date.now() };
  }
  var d = _mobileWxCache.daily;
  var ti = _mobileWxTodayIdx(d);
  var temp = d.temperature_2m_max && d.temperature_2m_max[ti] != null ? Math.round(d.temperature_2m_max[ti]) : null;
  var wind = d.wind_speed_10m_max && d.wind_speed_10m_max[ti] != null ? Math.round(d.wind_speed_10m_max[ti]) : null;
  var code = d.weather_code && d.weather_code[ti] != null ? d.weather_code[ti] : null;
  if (temp == null) return;
  el.textContent = _mobileWxIcon(code) + ' ' + temp + '°' + (wind != null ? ' · ' + wind + 'mph' : '');
  el.style.display = 'inline';
  // Make the chip tappable — opens the radar + 4-round modal.
  el.style.cursor = 'pointer';
  el.onclick = openWeatherModal;
}

// ─── Weather modal ──────────────────────────────────────────────────────
// Opens a popup with the four tournament rounds (R1–R4) forecast and a
// RainViewer Doppler radar embed centered on the venue. Coords come from
// the cached lookup populated by the chip's earlier fetch — on a cold
// open we show a brief skeleton while the async resolver runs.
async function openWeatherModal() {
  var existing = document.getElementById('weather-modal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'weather-modal';
  modal.className = 'wxm-overlay';
  modal.innerHTML = '<div class="wxm-card"><div class="wxm-loading">Loading forecast…</div></div>';
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeWeatherModal();
  });
  document.body.appendChild(modal);
  var html = await _buildWeatherModalHtml();
  // Guard against the user closing the modal mid-await
  if (document.getElementById('weather-modal') === modal) {
    modal.innerHTML = html;
  }
}
function closeWeatherModal() {
  var el = document.getElementById('weather-modal');
  if (el) el.remove();
}
async function _buildWeatherModalHtml() {
  var course = (typeof TOURNEY_COURSE === 'string' && TOURNEY_COURSE) || '';
  var coords = await _mobileWxResolveCoords(course);
  var d = (_mobileWxCache && _mobileWxCache.daily) || null;
  var startIso = (typeof window.EVENT_DATES_START_ISO === 'string' && window.EVENT_DATES_START_ISO) || '';
  var title = ((typeof window.EVENT_DISPLAY_NAME === 'string' && window.EVENT_DISPLAY_NAME) || TOURNEY_NAME || 'Forecast');
  // Find the index of the tournament start date in daily.time; if absent
  // or in the past, fall back to today (index 0).
  var startIdx = 0;
  if (d && d.time && startIso) {
    var i = d.time.indexOf(startIso);
    if (i >= 0) startIdx = i;
  }
  var rounds = '';
  ['R1','R2','R3','R4'].forEach(function(label, k) {
    var idx = startIdx + k;
    var t = d && d.temperature_2m_max && d.temperature_2m_max[idx];
    var lo = d && d.temperature_2m_min && d.temperature_2m_min[idx];
    var w = d && d.wind_speed_10m_max && d.wind_speed_10m_max[idx];
    var p = d && d.precipitation_probability_max && d.precipitation_probability_max[idx];
    var code = d && d.weather_code && d.weather_code[idx];
    var dateStr = d && d.time && d.time[idx] ? new Date(d.time[idx] + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : '';
    rounds += '<div class="wxm-round">'
      + '<div class="wxm-round-head">' + label + (dateStr ? ' · <span class="wxm-round-day">' + dateStr + '</span>' : '') + '</div>'
      + '<div class="wxm-round-icon">' + _mobileWxIcon(code) + '</div>'
      + '<div class="wxm-round-temp">' + (t != null ? Math.round(t) + '°' : '—')
      + (lo != null ? ' <span class="wxm-round-lo">/' + Math.round(lo) + '°</span>' : '')
      + '</div>'
      + '<div class="wxm-round-meta">'
      + (w != null ? Math.round(w) + ' mph' : '—')
      + (p != null ? ' · ' + p + '%' : '')
      + '</div>'
      + '</div>';
  });
  // Radar via Windy's embed endpoint — RainViewer's map.html sends
  // X-Frame-Options that block iframe embedding; Windy's embed2.html is
  // purpose-built for it and accepts lat/lon directly so we get true
  // dynamic-per-tournament behavior without picking radar stations.
  var radar = '';
  if (coords) {
    var radarUrl = 'https://embed.windy.com/embed2.html'
      + '?lat=' + coords.lat + '&lon=' + coords.lon
      + '&detailLat=' + coords.lat + '&detailLon=' + coords.lon
      + '&zoom=8&level=surface&overlay=radar&product=radar'
      + '&menu=&message=true&marker=true&type=map&location=coordinates'
      + '&metricWind=mph&metricTemp=%C2%B0F';
    radar = '<div class="wxm-radar">'
      + '<iframe src="' + radarUrl + '" allowfullscreen loading="lazy"'
      + ' style="width:100%;height:300px;border:0;display:block"></iframe>'
      + '</div>';
  } else {
    radar = '<div class="wxm-radar-empty">Radar unavailable for this venue.</div>';
  }
  return '<div class="wxm-card" onclick="event.stopPropagation()">'
    + '<div class="wxm-header">'
    + '<span class="wxm-title">' + title + (course ? ' · ' + course : '') + '</span>'
    + '<button class="wxm-close" onclick="closeWeatherModal()" aria-label="Close">✕</button>'
    + '</div>'
    + '<div class="wxm-rounds">' + rounds + '</div>'
    + radar
    + '<div class="wxm-attrib">Forecast · Open-Meteo&nbsp;·&nbsp;Radar · Windy.com</div>'
    + '</div>';
}
