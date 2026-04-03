// ── Live Dashboard ────────────────────────────────────────
// Shows your 6 golfers with live scorecards, pulsing current hole,
// and hole-by-hole result callouts.

var _liveRendering = false;

async function renderLive() {
  var container = document.getElementById('live-dash-list');
  if (!container) return;
  // Only render if live tab is active
  var view = document.getElementById('view-live');
  if (!view || !view.classList.contains('active')) return;
  if (_liveRendering) return;
  _liveRendering = true;

  // Get the active team's picks (or all picks if "All Picks")
  var picks = [];
  var teamLabel = '';
  if (currentUserEmail && currentUserTeams.length) {
    if (activeTeamIdx >= 0 && currentUserTeams[activeTeamIdx]) {
      picks = currentUserTeams[activeTeamIdx].picks;
      teamLabel = currentUserTeams[activeTeamIdx].team;
    } else {
      // All Picks — unique golfers across all entries
      var seen = new Set();
      currentUserTeams.forEach(function(t) {
        t.picks.forEach(function(p) { if (!seen.has(p)) { seen.add(p); picks.push(p); } });
      });
      teamLabel = 'All Picks';
    }
  }

  var titleEl = document.getElementById('live-dash-team');
  if (titleEl) titleEl.textContent = teamLabel || 'Select a team';

  if (!picks.length) {
    container.innerHTML = '<div class="ld-empty">' +
      '<div style="font-size:40px;margin-bottom:14px">🏌️</div>' +
      '<div style="font-weight:800;color:var(--text);font-size:15px;margin-bottom:8px">No Team Selected</div>' +
      '<div style="font-size:12px;color:var(--text3);line-height:1.5">Join the pool or select a team<br>to see your golfers live.</div></div>';
    _liveRendering = false;
    return;
  }

  // Fetch scorecards
  await fetchCourseHoles();
  var needFetch = picks.filter(function(n) { return !SCORECARD_CACHE[n] && ATHLETE_IDS[n]; });
  if (needFetch.length > 0) {
    await Promise.all(needFetch.map(function(n) { return fetchPlayerScorecard(n); }));
  }

  // Sort picks by score (best first)
  var sorted = picks.slice().sort(function(a, b) {
    var sa = GOLFER_SCORES[a] ? GOLFER_SCORES[a].score : 99;
    var sb = GOLFER_SCORES[b] ? GOLFER_SCORES[b].score : 99;
    return sa - sb;
  });

  var html = '';
  sorted.forEach(function(name, idx) {
    var gd = GOLFER_SCORES[name];
    if (!gd) return;
    var flag = FLAGS[name] || '';
    var aid = ATHLETE_IDS[name];
    var rounds = SCORECARD_CACHE[name];
    var pEmoji = getPlayerEmoji(name);
    var isTop4 = idx < 4;

    // Determine thru state
    var thruNum = parseInt(gd.thru);
    var isActive = !isNaN(thruNum) && thruNum >= 1 && thruNum <= 17;
    var isFinished = gd.thru === 'F' || gd.thru === '18';
    var isTeeTime = gd.thru && /[AP]M/i.test(gd.thru);
    var isMC = gd.score === 11;
    var isWD = gd.score === 12;
    var startHole = gd.startHole || 1;
    var currentHole = isActive ? ((startHole - 1 + thruNum) % 18) + 1 : null;

    // Get hole-by-hole data
    var holeMap = {};
    var lastResult = null;
    if (rounds && rounds.length) {
      var withHoles = rounds.filter(function(r) { return r.holes && r.holes.length > 0; });
      var activeRound = withHoles.length ? withHoles[withHoles.length - 1] : null;
      if (activeRound) {
        activeRound.holes.forEach(function(h) { holeMap[h.hole] = h; });
        // Find last completed hole (highest hole number with strokes)
        var sortedHoles = activeRound.holes.filter(function(h) { return h.strokes > 0; });
        if (sortedHoles.length) {
          // Use playing order to find the "last" completed hole
          var lastHole = sortedHoles[sortedHoles.length - 1];
          // If start hole != 1, find the last in playing sequence
          if (startHole !== 1) {
            var playOrder = [];
            for (var i = 0; i < 18; i++) playOrder.push(((startHole - 1 + i) % 18) + 1);
            var lastInOrder = null;
            for (var j = playOrder.length - 1; j >= 0; j--) {
              var hd = holeMap[playOrder[j]];
              if (hd && hd.strokes > 0) { lastInOrder = hd; break; }
            }
            if (lastInOrder) lastHole = lastInOrder;
          }
          var vs = lastHole.strokes - lastHole.par;
          var verb;
          if (lastHole.strokes === 1) verb = 'aces';
          else if (vs <= -2) verb = 'eagles';
          else if (vs === -1) verb = 'birdies';
          else if (vs === 0) verb = 'pars';
          else if (vs === 1) verb = 'bogeys';
          else if (vs === 2) verb = 'double bogeys';
          else verb = '+' + vs + ' on';
          lastResult = { verb: verb, hole: lastHole.hole, vs: vs, strokes: lastHole.strokes, par: lastHole.par };
        }
      }
    }

    // Compute today's score-to-par for display
    var todayStr = gd.todayDisplay && gd.todayDisplay !== '—' ? gd.todayDisplay : '';

    var escapedName = name.replace(/'/g, "\\'");

    // ── Card start ──
    html += '<div class="ld-card' + (isTop4 ? ' ld-top4' : '') + (isMC ? ' ld-mc' : '') + (isWD ? ' ld-wd' : '') + '" onclick="openScorecardPopup(\'' + escapedName + '\')">';

    // Header row: headshot, name/flag/pos, score
    html += '<div class="ld-header">';
    if (aid) {
      html += '<img class="ld-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + aid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">';
    } else {
      html += '<div class="ld-headshot ld-headshot-empty">' + flag + '</div>';
    }
    html += '<div class="ld-info">';
    html += '<div class="ld-name">' + name + (pEmoji ? ' <span class="ld-emoji">' + pEmoji + '</span>' : '') + '</div>';
    html += '<div class="ld-meta">' + flag + ' ' + gd.pos;
    if (isActive) html += ' <span class="ld-thru">· Thru ' + gd.thru + '</span>';
    else if (isFinished) html += ' <span class="ld-thru">· F</span>';
    else if (isMC) html += ' <span class="ld-thru ld-mc-label">· MC</span>';
    else if (isWD) html += ' <span class="ld-thru ld-mc-label">· WD</span>';
    else if (isTeeTime) html += ' <span class="ld-thru">· Tees ' + gd.thru + '</span>';
    if (todayStr) html += ' <span class="ld-today">· Today ' + todayStr + '</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="ld-total ' + cls(gd.score) + '">' + fmt(gd.score) + '</div>';
    if (isTop4) html += '<div class="ld-top4-tag">T4</div>';
    html += '</div>';

    // Callout strip
    if (lastResult && (isActive || isFinished)) {
      var callCls = lastResult.vs < 0 ? 'ld-call-good' : lastResult.vs > 0 ? 'ld-call-bad' : 'ld-call-par';
      var lastName = name.split(' ').pop();
      html += '<div class="ld-callout ' + callCls + '">' + lastName + ' ' + lastResult.verb + ' ' + lastResult.hole + '</div>';
    } else if (isTeeTime) {
      // Between rounds — show tee time + last round result if available
      var teeLabel = 'Tees off ' + gd.thru;
      if (lastResult) {
        var lastName = name.split(' ').pop();
        var callCls = lastResult.vs < 0 ? 'ld-call-good' : lastResult.vs > 0 ? 'ld-call-bad' : 'ld-call-par';
        html += '<div class="ld-callout ' + callCls + '">Last: ' + lastName + ' ' + lastResult.verb + ' ' + lastResult.hole + ' · Next: ' + gd.thru + '</div>';
      } else {
        html += '<div class="ld-callout ld-call-par">' + teeLabel + '</div>';
      }
    } else if (!isMC && !isWD && gd.thru === '—') {
      html += '<div class="ld-callout ld-call-par">Waiting to tee off</div>';
    }

    // Scorecard grid (compact 18 holes) — show for active, finished, and tee-time (previous round)
    if (!isMC && !isWD) {
      html += '<div class="ld-grid">';
      // Front 9
      html += '<div class="ld-nine"><div class="ld-nine-label">OUT</div><div class="ld-holes">';
      for (var hn = 1; hn <= 9; hn++) {
        var hd = holeMap[hn];
        var par = getHolePar(hn);
        var scCls = hd && hd.strokes ? scorecardClass(hd.strokes, par) : '';
        var isCurr = currentHole === hn;
        html += '<div class="ld-hole ' + scCls + (isCurr ? ' ld-current' : '') + '">';
        html += '<div class="ld-h-num">' + hn + '</div>';
        html += '<div class="ld-h-val"><span class="sc-num">' + (hd && hd.strokes ? hd.strokes : '–') + '</span></div>';
        html += '</div>';
      }
      html += '</div></div>';
      // Back 9
      html += '<div class="ld-nine"><div class="ld-nine-label">IN</div><div class="ld-holes">';
      for (var hn = 10; hn <= 18; hn++) {
        var hd = holeMap[hn];
        var par = getHolePar(hn);
        var scCls = hd && hd.strokes ? scorecardClass(hd.strokes, par) : '';
        var isCurr = currentHole === hn;
        html += '<div class="ld-hole ' + scCls + (isCurr ? ' ld-current' : '') + '">';
        html += '<div class="ld-h-num">' + hn + '</div>';
        html += '<div class="ld-h-val"><span class="sc-num">' + (hd && hd.strokes ? hd.strokes : '–') + '</span></div>';
        html += '</div>';
      }
      html += '</div></div>';
      html += '</div>';
    }

    html += '</div>'; // end ld-card
  });

  container.innerHTML = html;
  _liveRendering = false;
}
