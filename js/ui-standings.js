// ── Standings View ──

var _openPanelTeam = null;
var standingsSort = 'total';
var standingsSortDir = 1; // 1 = asc for score, toggled on re-click
var stSearch = '';

function toggleStandingsSort(col) {
  if (standingsSort === col) {
    standingsSortDir *= -1;
  } else {
    standingsSort = col;
    standingsSortDir = 1;
  }
  renderStandings();
}

function filterStandingsSearch() {
  var v = document.getElementById('st-search').value || '';
  stSearch = v.trim().toLowerCase();
  document.getElementById('st-search-clear').style.display = v.length ? 'block' : 'none';
  renderStandings();
}

function renderStandings() {
  var ranked = getRanked();
  updateHeaderTeam();
  var el = document.getElementById('standings-list');
  // Compute true ranks based on total score
  var rankMap = {};
  var rk = 1;
  ranked.forEach(function(e, i) {
    if (i > 0 && ranked[i].total !== ranked[i-1].total) rk = i + 1;
    rankMap[e.team + '|' + e.email] = rk;
  });
  // Apply display sort if not default
  if (standingsSort !== 'total') {
    ranked.sort(function(a, b) {
      var dir = standingsSortDir;
      if (standingsSort === 'today') {
        var todayA = 0, todayB = 0;
        a.top4.forEach(function(g) { var t = golferTodayScore(GOLFER_SCORES[g.name]); if (t !== null) todayA += t; });
        b.top4.forEach(function(g) { var t = golferTodayScore(GOLFER_SCORES[g.name]); if (t !== null) todayB += t; });
        return (todayA - todayB) * dir || a.total - b.total;
      }
      if (standingsSort === 'entry') {
        return a.team.localeCompare(b.team) * dir;
      }
      return 0;
    });
  } else if (standingsSortDir === -1) {
    ranked.reverse();
  }
  var ranks = ranked.map(function(e) { return rankMap[e.team + '|' + e.email]; });

  // Payout cards
  var cardsEl = document.getElementById('standings-cards');
  var maxCompleted = 0;
  if (TOURNAMENT_STARTED) {
    Object.values(GOLFER_SCORES).forEach(function(gd) {
      var cnt = [gd.r1,gd.r2,gd.r3,gd.r4].filter(function(r){return r!=null && r>50;}).length;
      if (cnt > maxCompleted) maxCompleted = cnt;
    });
  }
  var totalHolesLeft = ranked.length > 0 ? ranked.reduce(function(s, e) { return s + e.picks.reduce(function(s2, p) { return s2 + getHolesRemaining(p); }, 0); }, 0) : 999;
  var tourneyDone = maxCompleted >= 4 && totalHolesLeft === 0;
  cardsEl.innerHTML = POOL_CONFIG.payouts.map(function(p, i) {
    var holder = '—';
    if (TOURNAMENT_STARTED && ranked[i]) {
      if (tourneyDone) {
        var tiedCount = ranked.filter(function(e) { return e.total === ranked[i].total; }).length;
        holder = ranked[i].team + (tiedCount > 1 && ranks[i] === i + 1 ? '' : '');
      } else if (maxCompleted >= 2) {
        holder = ranked[i].team;
      } else {
        holder = 'In Progress';
      }
    }
    var isGold = i === 0;
    return '<div class="payout-card ' + (isGold ? 'gold' : '') + '">' +
      '<div class="pc-lbl">' + p.place + '</div>' +
      '<div class="pc-amt">$' + p.amount + '</div>' +
      '<div class="pc-who">' + holder + '</div>' +
    '</div>';
  }).join('');
  var actualPot = ENTRIES.length * POOL_CONFIG.buyIn;
  document.getElementById('standings-pool-sub').innerHTML = ENTRIES.length + ' entries · $' + POOL_CONFIG.buyIn + ' buy-in · <strong style="color:var(--gold)">$' + actualPot.toLocaleString() + ' pot</strong><br>Best 4 of 6 golfer scores combined over four rounds wins.';

  // Build floating "my entries" box above standings
  var heroHtml = '';
  if (currentUserEmail && currentUserTeams.length > 0) {
    var teamsToShow = activeTeamIdx >= 0 ? [currentUserTeams[activeTeamIdx]].filter(Boolean) : currentUserTeams;
    var myRows = '';
    teamsToShow.forEach(function(activeTeam) {
      var myIdx = ranked.findIndex(function(e) { return e.email === activeTeam.email && e.team === activeTeam.team; });
      if (myIdx >= 0) {
        var myEntry = ranked[myIdx];
        var myRank = ranks[myIdx];
        var scc = cls(myEntry.total);
        var entryKey = myEntry.team + '|' + myEntry.email;
        var startRk = ROUND_START_ENTRY_RANKS[entryKey];
        var refRk = startRk || PREV_RANKS[entryKey];
        var moveHtml = '';
        if (refRk && refRk !== myRank) {
          var mv = refRk - myRank;
          moveHtml = mv > 0 ? '<div class="pos-move up">▲' + mv + '</div>' : '<div class="pos-move dn">▼' + Math.abs(mv) + '</div>';
        }
        var myTeamToday = 0, myTodayCount = 0;
        myEntry.top4.forEach(function(g) { var td = golferTodayScore(GOLFER_SCORES[g.name]); if (td !== null) { myTeamToday += td; myTodayCount++; } });
        var myTodayDisp = myTodayCount > 0 ? (myTeamToday > 0 ? '+' + myTeamToday : myTeamToday === 0 ? 'E' : '' + myTeamToday) : '—';
        var myTodayCls = myTeamToday < 0 ? 'neg' : myTeamToday > 0 ? 'pos' : 'eve';
        var safeTeam = myEntry.team.replace(/'/g, "\\'");
        myRows += '<div class="my-hero-row" onclick="jumpToEntry(\'' + safeTeam + '\')">'
            + '<div class="my-hero-rank">' + myRank + moveHtml + '</div>'
            + '<div class="my-hero-name">' + myEntry.team + '</div>'
            + '<div class="my-hero-today ' + myTodayCls + '">' + myTodayDisp + '</div>'
            + '<div class="my-hero-score ' + scc + '">' + fmtTeam(myEntry.total) + '</div>'
            + '</div>';
      }
    });
    var showAllBtn = (activeTeamIdx >= 0 && currentUserTeams.length > 1) ? '<div class="my-show-all" onclick="trackEvent(\'show-all-entries\');setUser(\'' + currentUserEmail + '\',-1)">Show All Entries</div>' : '';
    if (myRows) heroHtml = '<div class="my-hero-block">' + myRows + showAllBtn + '</div>';
  }

  // Apply search filter
  var displayRanked = ranked;
  var displayRanks = ranks;
  if (stSearch) {
    var filtered = [];
    var filteredRanks = [];
    ranked.forEach(function(e, i) {
      if (e.team.toLowerCase().indexOf(stSearch) !== -1 || e.name.toLowerCase().indexOf(stSearch) !== -1 || e.email.toLowerCase().indexOf(stSearch) !== -1) {
        filtered.push(e);
        filteredRanks.push(ranks[i]);
      }
    });
    displayRanked = filtered;
    displayRanks = filteredRanks;
  }

  var html = '';
  displayRanked.forEach(function(e, i) {
    var rank = displayRanks[i];
    var sc = e.total, scf = fmtTeam(sc), scc = cls(sc);
    var isMyTeam = e.email === currentTeamEmail ? ' is-my-team' : '';
    var entryIdx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
    var isCmpSelected = compareMode && cmpSelections.includes(entryIdx);
    var cmpNum = isCmpSelected ? (cmpSelections.indexOf(entryIdx) + 1) : 0;
    var cmpCls = compareMode ? ' cmp-mode' : '';
    var cmpSelCls = isCmpSelected ? ' cmp-selected' : '';
    var cmpBadge = isCmpSelected ? '<span class="cmp-badge">' + cmpNum + '</span>' : '';
    var teamHolesLeft = ROUND_START_ROUND >= 4 ? e.top4.reduce(function(sum, g) { return sum + getHolesRemaining(g.name); }, 0) : 0;
    var rowClick = compareMode ? 'cmpSelectTeam(' + entryIdx + ')' : 'togglePanel(this,' + i + ')';
    // Movement badge
    var entryKey = e.team + '|' + e.email;
    var startRk = ROUND_START_ENTRY_RANKS[entryKey];
    var refRk = startRk || PREV_RANKS[entryKey];
    var moveHtml = '';
    if (refRk && refRk !== rank) {
      var mv = refRk - rank;
      moveHtml = mv > 0 ? '<div class="pos-move up">▲' + mv + '</div>' : '<div class="pos-move dn">▼' + Math.abs(mv) + '</div>';
    }
    var teamToday = 0, teamTodayCount = 0;
    e.top4.forEach(function(g) { var td = golferTodayScore(GOLFER_SCORES[g.name]); if (td !== null) { teamToday += td; teamTodayCount++; } });
    var todayDisp = teamTodayCount > 0 ? (teamToday > 0 ? '+' + teamToday : teamToday === 0 ? 'E' : '' + teamToday) : '—';
    var todayCls = teamToday < 0 ? 'neg' : teamToday > 0 ? 'pos' : 'eve';
    var holesTag = ROUND_START_ROUND >= 4 ? (teamHolesLeft > 0 ? '<span class="s-holes">' + teamHolesLeft + '</span>' : '') : '';
    html += '<div class="tv-row st-row' + isMyTeam + cmpCls + cmpSelCls + '" onclick="' + rowClick + '" style="cursor:pointer">'
        + '<div class="tv-pos">' + rank + moveHtml + '</div>'
        + '<div class="tv-player"><span class="tv-name' + (isMyTeam ? ' is-my-pick' : '') + '">' + e.team + '</span>' + cmpBadge + ' <span class="tv-country">' + e.name + '</span>' + holesTag + '</div>'
        + '<div class="tv-thru"></div>'
        + '<div class="tv-today ' + todayCls + '">' + todayDisp + '</div>'
        + '<div class="tv-score ' + scc + '">' + scf + '</div>'
        + '</div>'
        + '<div class="picks-panel" id="panel-' + i + '"> ' + e.scores.map(function(g, j) {
      var isTop = j < 4;
      var gd = GOLFER_SCORES[g.name];
      var preT = !TOURNAMENT_STARTED;
      var pos = gd ? (gd.thru === 'WD' || gd.score === 12 ? 'WD' : gd.pos) : '';
      var rounds = gd ? [gd.r1,gd.r2,gd.r3,gd.r4].filter(function(r){return r!=null;}) : [];
      var rndsStr = rounds.length ? rounds.map(function(r,ri){return 'R'+(ri+1)+':'+r;}).join(' ') : '';
      var ownE = OWNERSHIP_DATA.find(function(o) { return o.player === g.name; });
      var ownP = ownE ? Math.round(ownE.pct * 100) + '% Owned' : '';
      var thruVal = gd ? gd.thru : '';
      var holesLeft = getHolesRemaining(g.name);
      var stLastRound = (function(){ if(!gd) return null; var rs = [gd.r1,gd.r2,gd.r3,gd.r4]; for(var i=rs.length-1;i>=0;i--){ if(rs[i]&&rs[i]>50) return rs[i]; } return null; })();
      var stRoundDone = gd && (gd.thru === 'F' || gd.thru === '18');
      var thruDisplay = preT ? '' : ((gd && (gd.thru === 'WD' || gd.score === 12)) ? '' : (stRoundDone ? (stLastRound ? 'Shot ' + stLastRound : '') : (thruVal && thruVal !== '—' ? 'Thru ' + thruVal : '')));
      var posDisplay = preT ? '' : pos;
      var flag = FLAGS[g.name] || '';
      var holesDisp = ROUND_START_ROUND >= 4 ? (holesLeft > 0 ? holesLeft + ' holes left' : 'F') : '';
      var gTodayRaw = gd ? gd.todayDisplay : null;
      var gTodayDisp = gTodayRaw && gTodayRaw !== '—' ? gTodayRaw : '—';
      var gTodayVal = gTodayDisp === '—' ? null : (gTodayDisp === 'E' ? 0 : parseInt(gTodayDisp.replace('+', '')) || 0);
      var gTodayCls = gTodayVal !== null ? (gTodayVal < 0 ? 'neg' : gTodayVal > 0 ? 'pos' : 'eve') : '';
      var gThru = '';
      if (gd) {
        if (gd.thru === 'F' || gd.thru === '18') gThru = 'F';
        else if (gd.thru === 'WD' || gd.score === 12) gThru = 'WD';
        else if (gd.thru === 'MC') gThru = 'MC';
        else if (gd.thru && gd.thru !== '—') gThru = gd.thru;
      }
      var teeStr = '';
      if (gd && gd.teeTime && gd.teeTime.includes('T')) { try { teeStr = new Date(gd.teeTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); } catch(ex){} }
      var thruDisp = '';
      if (gd) {
        if (gd.thru === 'WD' || gd.score === 12) thruDisp = 'WD';
        else if (gd.thru === 'MC') thruDisp = 'MC';
        else if (gd.thru === 'F' || gd.thru === '18') thruDisp = stLastRound || 'F';
        else if (gd.thru && gd.thru.includes(':')) thruDisp = gd.thru;
        else if (gd.thru === '—') thruDisp = teeStr || '—';
        else if (gd.thru) thruDisp = gd.thru + (gd.startHole === 10 && parseInt(gd.thru) > 0 ? '*' : '');
      }
      var isMc = gd && (gd.thru === 'MC' || gd.thru === 'WD' || gd.score === 11 || gd.score === 12);
      return '<div class="tv-row st-pick-row ' + (isTop ? 'is-top' : 'is-bench') + '">'
          + '<div class="tv-pos" style="font-size:10px">' + (isTop ? '★' : '') + '</div>'
          + '<div class="tv-player"><span class="st-pick-name">' + (flag ? flag + ' ' : '') + g.name + '</span>'
          + (posDisplay ? ' <span class="mini-pick-pos">' + posDisplay + '</span>' : '')
          + '<div class="st-pick-sub">' + (rndsStr ? '<span class="mini-pick-rounds">' + rndsStr + '</span>' : '') + (ownP ? ' <span class="mini-pick-own">' + ownP + '</span>' : '') + '</div>'
          + '</div>'
          + '<div class="tv-thru">' + thruDisp + '</div>'
          + '<div class="tv-today ' + gTodayCls + '">' + gTodayDisp + '</div>'
          + '<div class="tv-score ' + (isMc ? 'mc' : cls(g.score)) + '">' + (isMc ? (gd.thru === 'WD' || gd.score === 12 ? 'WD' : 'MC') : fmt(g.score)) + '</div>'
          + '</div>';
    }).join('');
    var isTied = (i < displayRanked.length-1 && displayRanked[i].total === displayRanked[i+1].total) || (i > 0 && displayRanked[i].total === displayRanked[i-1].total);
    var tbFooter2 = (isTied && e.tb != null) ? ' · TB: ' + e.tb : '';
    var footerHoles = ROUND_START_ROUND >= 4 ? ' · ' + teamHolesLeft + ' holes left' : '';
    html += '<div class="picks-panel-footer"><span>' + e.name + tbFooter2 + footerHoles + '</span><button class="h2h-quick-btn" onclick="event.stopPropagation();openH2HPicker(' + entryIdx + ')">⚔️ H2H</button></div> </div>';
  });

  detectEntryActivity();
  // Seed round-start entry ranks if empty (first load)
  if (TOURNAMENT_STARTED && Object.keys(ROUND_START_ENTRY_RANKS).length === 0) {
    ranked.forEach(function(e, i) { ROUND_START_ENTRY_RANKS[e.team + '|' + e.email] = ranks[i]; });
  }
  ranked.forEach(function(e, i) { PREV_RANKS[e.team + '|' + e.email] = ranks[i]; });
  document.getElementById('my-teams-container').innerHTML = heroHtml;
  el.innerHTML = html;
  var hasTies = ranks.some(function(r, i) { return i > 0 && r === ranks[i-1]; });
  document.getElementById('standings-footnote').style.display = hasTies ? 'block' : 'none';

  // Restore open panel after re-render
  if (_openPanelTeam) {
    var restoreIdx = displayRanked.findIndex(function(e) { return e.team === _openPanelTeam; });
    if (restoreIdx >= 0) {
      var panel = document.getElementById('panel-' + restoreIdx);
      if (panel) { panel.classList.add('open'); var sRow = panel.previousElementSibling; if (sRow) sRow.classList.add('panel-open'); }
    }
  }
}

function togglePanel(row, i) {
  trackEvent('standings-expand');
  var panel = document.getElementById('panel-'+i);
  var prevOpen = document.querySelector('.picks-panel.open');
  if (prevOpen && prevOpen !== panel) {
    prevOpen.classList.remove('open');
    var prevRow = prevOpen.previousElementSibling;
    if (prevRow) prevRow.classList.remove('panel-open');
  }
  var open = panel.classList.toggle('open');
  var standingRow = panel.previousElementSibling;
  if (standingRow) { if (open) standingRow.classList.add('panel-open'); else standingRow.classList.remove('panel-open'); }
  if (open) {
    var ranked = getRanked();
    _openPanelTeam = ranked[i] ? ranked[i].team : null;
  } else {
    _openPanelTeam = null;
  }
}

function jumpToEntry(teamName) {
  trackEvent('jump-to-entry');
  var popup = document.getElementById('picker-popup');
  if (popup) popup.remove();
  if (_openScorecardIdx !== null) {
    var scPanel = document.getElementById('sc-panel-' + _openScorecardIdx);
    if (scPanel) { scPanel.classList.remove('open'); scPanel.innerHTML = ''; scPanel.onclick = null; }
    _openScorecardIdx = null;
  }
  var standingsBtn = document.querySelector('.nav-btn[onclick*="standings"]');
  if (standingsBtn) switchTab('standings', standingsBtn);
  var ranked = getRanked();
  var idx = ranked.findIndex(function(e) { return e.team === teamName; });
  if (idx >= 0) {
    setTimeout(function() {
      var panel = document.getElementById('panel-' + idx);
      var row = panel ? panel.previousElementSibling : null;
      if (panel && !panel.classList.contains('open')) togglePanel(row, idx);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}
