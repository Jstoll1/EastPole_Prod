// ── Standings View ──

var _openPanelTeam = null;
var standingsSort = 'total';
var standingsSortDir = 1; // 1 = asc for score, toggled on re-click

function toggleStandingsSort(col) {
  if (standingsSort === col) {
    standingsSortDir *= -1;
  } else {
    standingsSort = col;
    standingsSortDir = 1;
  }
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

  var heroHtml = '';
  if (currentUserEmail && currentUserTeams.length > 0) {
    var teamsToShow = activeTeamIdx >= 0 ? [currentUserTeams[activeTeamIdx]].filter(Boolean) : currentUserTeams;
    var rows = '';
    teamsToShow.forEach(function(activeTeam) {
      var myIdx = ranked.findIndex(function(e) { return e.email === activeTeam.email && e.team === activeTeam.team; });
      if (myIdx >= 0) {
        var myEntry = ranked[myIdx];
        var myRank = ranks[myIdx];
        var scc = cls(myEntry.total);
        var prevRk = PREV_RANKS[myEntry.team];
        var moveHtml = '';
        if (prevRk && prevRk !== myRank) {
          var d = prevRk - myRank;
          moveHtml = d > 0 ? '<span class="my-row-move up">▲' + d + '</span>' : '<span class="my-row-move dn">▼' + Math.abs(d) + '</span>';
        }
        var myHolesLeft = myEntry.picks.reduce(function(s, p) { return s + getHolesRemaining(p); }, 0);
        var myHolesTag = '<span class="my-row-holes">' + myHolesLeft + ' holes left</span>';
        var myTeamToday = 0, myTodayCount = 0;
        myEntry.top4.forEach(function(g) { var td = golferTodayScore(GOLFER_SCORES[g.name]); if (td !== null) { myTeamToday += td; myTodayCount++; } });
        var myTodayDisp = myTodayCount > 0 ? (myTeamToday > 0 ? '+' + myTeamToday : myTeamToday === 0 ? 'E' : '' + myTeamToday) : '—';
        var myTodayCls = myTeamToday < 0 ? 'neg' : myTeamToday > 0 ? 'pos' : 'eve';
        var safeTeam = myEntry.team.replace(/'/g, "\\'");
        rows += '<div class="my-row" onclick="jumpToEntry(\'' + safeTeam + '\')"> <div class="my-row-rank">' + myRank + '</div> <div class="my-row-team">' + myEntry.team + '</div> ' + moveHtml + ' ' + myHolesTag + ' <div class="my-row-today ' + myTodayCls + '">' + myTodayDisp + '</div> <div class="my-row-score ' + scc + '">' + fmtTeam(myEntry.total) + '</div> </div>';
      }
    });
    var showAllBtn = (activeTeamIdx >= 0 && currentUserTeams.length > 1) ? '<div class="my-show-all" onclick="trackEvent(\'show-all-entries\');setUser(\'' + currentUserEmail + '\',-1)">Show All Entries</div>' : '';
    if (rows) heroHtml = '<div class="my-teams-block"><div class="my-teams-label">YOUR ENTRIES</div>' + rows + showAllBtn + '</div>';
  }

  var html = '';
  ranked.forEach(function(e, i) {
    var rank = ranks[i];
    var sc = e.total, scf = fmtTeam(sc), scc = cls(sc);
    var top4Str = e.top4.map(function(g) { return fmt(g.score); }).join(' ');
    var isMyTeam = e.email === currentTeamEmail ? 'is-my-team' : '';
    var entryIdx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
    var isCmpSelected = compareMode && cmpSelections.includes(entryIdx);
    var cmpNum = isCmpSelected ? (cmpSelections.indexOf(entryIdx) + 1) : 0;
    var cmpCls = compareMode ? ' cmp-mode' : '';
    var cmpSelCls = isCmpSelected ? ' cmp-selected' : '';
    var cmpBadge = isCmpSelected ? '<span class="cmp-badge">' + cmpNum + '</span>' : '';
    var teamHolesLeft = e.picks.reduce(function(sum, p) { return sum + getHolesRemaining(p); }, 0);
    var rowClick = compareMode ? 'cmpSelectTeam(' + entryIdx + ')' : 'togglePanel(this,' + i + ')';
    // Movement badge relative to round start
    var startRk = ROUND_START_ENTRY_RANKS[e.team];
    var refRk = startRk || PREV_RANKS[e.team];
    var moveBadge = '';
    if (refRk && refRk !== rank) {
      var mv = refRk - rank;
      if (mv > 0) moveBadge = '<span class="s-move up">&#9650;' + mv + '</span>';
      else if (mv < 0) moveBadge = '<span class="s-move dn">&#9660;' + Math.abs(mv) + '</span>';
    }
    var teamToday = 0, teamTodayCount = 0;
    e.top4.forEach(function(g) { var td = golferTodayScore(GOLFER_SCORES[g.name]); if (td !== null) { teamToday += td; teamTodayCount++; } });
    var todayDisp = teamTodayCount > 0 ? (teamToday > 0 ? '+' + teamToday : teamToday === 0 ? 'E' : '' + teamToday) : '—';
    var todayCls = teamToday < 0 ? 'neg' : teamToday > 0 ? 'pos' : 'eve';
    var holesTag = teamHolesLeft > 0 ? '<span class="s-holes">' + teamHolesLeft + ' holes left</span>' : '<span class="s-holes done">F</span>';
    html += ' <div class="standing-row ' + isMyTeam + cmpCls + cmpSelCls + '" onclick="' + rowClick + '"> <div class="s-rank">' + rank + '</div> <div class="s-info"> <div class="s-team">' + e.team + cmpBadge + moveBadge + '</div> <div class="s-name">' + e.name + ' ' + holesTag + '</div> </div> <div class="s-today ' + todayCls + '">' + todayDisp + '</div> <div class="s-score ' + scc + '">' + scf + '</div> <div class="s-arrow" id="arr-' + i + '">' + (compareMode ? '' : '›') + '</div> </div> <div class="picks-panel" id="panel-' + i + '"> ' + e.scores.map(function(g, j) {
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
      var holesDisp = holesLeft > 0 ? holesLeft + ' holes left' : 'F';
      var gToday = golferTodayScore(gd);
      var gTodayDisp = gToday !== null ? (gToday > 0 ? '+' + gToday : gToday === 0 ? 'E' : '' + gToday) : '—';
      var gTodayCls = gToday !== null ? (gToday < 0 ? 'neg' : gToday > 0 ? 'pos' : 'eve') : '';
      var gThru = '';
      if (gd) {
        if (gd.thru === 'F' || gd.thru === '18') gThru = 'F';
        else if (gd.thru === 'WD' || gd.score === 12) gThru = 'WD';
        else if (gd.thru === 'MC') gThru = 'MC';
        else if (gd.thru && gd.thru !== '—') gThru = gd.thru;
      }
      return '<div class="mini-pick ' + (isTop?'is-top':'') + '"> <div class="mini-pick-left"> <div class="mini-pick-top"> ' + (isTop?'<span class="star">★</span>':'<span style="width:10px;display:inline-block"></span>') + ' <span class="mini-pick-name">' + (flag ? flag + ' ' : '') + g.name + '</span>' + (posDisplay ? ' <span class="mini-pick-pos">' + posDisplay + '</span>' : '') + ' </div> <div class="mini-pick-bottom"> ' + (rndsStr?'<span class="mini-pick-rounds">' + rndsStr + '</span>':'') + ' <span class="mini-pick-holes">' + holesDisp + '</span>' + ' ' + (ownP?'<span class="mini-pick-own">' + ownP + '</span>':'') + ' </div> </div> <div class="mini-pick-right"> <span class="mini-pick-today ' + gTodayCls + '">' + gTodayDisp + '</span> <span class="mini-pick-score ' + cls(g.score) + '">' + fmt(g.score) + '</span>' + (gThru ? ' <span class="mini-pick-thru-val">' + gThru + '</span>' : '') + ' </div> </div>';
    }).join('');
    var isTied = (i < ranked.length-1 && ranked[i].total === ranked[i+1].total) || (i > 0 && ranked[i].total === ranked[i-1].total);
    var tbFooter2 = (isTied && e.tb != null) ? ' · TB: ' + e.tb : '';
    html += '<div class="picks-panel-footer"><span>' + e.name + tbFooter2 + ' · ' + teamHolesLeft + ' holes left</span><button class="h2h-quick-btn" onclick="event.stopPropagation();openH2HPicker(' + entryIdx + ')">⚔️ H2H</button></div> </div>';
  });

  detectEntryActivity();
  // Seed round-start entry ranks if empty (first load)
  if (TOURNAMENT_STARTED && Object.keys(ROUND_START_ENTRY_RANKS).length === 0) {
    ranked.forEach(function(e, i) { ROUND_START_ENTRY_RANKS[e.team] = ranks[i]; });
  }
  ranked.forEach(function(e, i) { PREV_RANKS[e.team] = ranks[i]; });
  document.getElementById('my-teams-container').innerHTML = heroHtml;
  el.innerHTML = html;
  var hasTies = ranks.some(function(r, i) { return i > 0 && r === ranks[i-1]; });
  document.getElementById('standings-footnote').style.display = hasTies ? 'block' : 'none';

  // Restore open panel after re-render
  if (_openPanelTeam) {
    var restoreIdx = ranked.findIndex(function(e) { return e.team === _openPanelTeam; });
    if (restoreIdx >= 0) {
      var panel = document.getElementById('panel-' + restoreIdx);
      var arr = document.getElementById('arr-' + restoreIdx);
      if (panel) { panel.classList.add('open'); var sRow = panel.previousElementSibling; if (sRow) sRow.classList.add('panel-open'); }
      if (arr) arr.textContent = '⌄';
    }
  }
}

function togglePanel(row, i) {
  trackEvent('standings-expand');
  var panel = document.getElementById('panel-'+i);
  var arr = document.getElementById('arr-'+i);
  var prevOpen = document.querySelector('.picks-panel.open');
  if (prevOpen && prevOpen !== panel) {
    prevOpen.classList.remove('open');
    var prevRow = prevOpen.previousElementSibling;
    if (prevRow) { prevRow.classList.remove('panel-open'); var prevArr = prevRow.querySelector('.s-arrow'); if (prevArr) prevArr.textContent = '›'; }
  }
  var open = panel.classList.toggle('open');
  arr.textContent = open ? '⌄' : '›';
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
