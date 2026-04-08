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
  // Compute true ranks based on total score (+ TB when final)
  var rankMap = {};
  var rk = 1;
  ranked.forEach(function(e, i) {
    if (i > 0) {
      var prev = ranked[i-1];
      // Bump rank when comparator (total → 5th → 6th) returns non-zero.
      // Equal-comparator entries share a rank (split tied per 2026 rules).
      if (compareEntries(prev, e) !== 0) rk = i + 1;
    }
    rankMap[e.team + '|' + e.email] = rk;
  });
  // Apply display sort if not default
  if (standingsSort !== 'total') {
    ranked.sort(function(a, b) {
      var dir = standingsSortDir;
      if (standingsSort === 'today') {
        var todayA = 0, todayB = 0;
        a.top4.forEach(function(g) { var gd = GOLFER_SCORES[g.name]; if (gd && (gd.score === 11 || gd.score === 12)) return; var td = gd ? gd.todayDisplay : null; if (td && td !== '—') todayA += td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0; });
        b.top4.forEach(function(g) { var gd = GOLFER_SCORES[g.name]; if (gd && (gd.score === 11 || gd.score === 12)) return; var td = gd ? gd.todayDisplay : null; if (td && td !== '—') todayB += td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0; });
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
  // Winner splash box
  var winnerBoxEl = document.getElementById('winner-splash');
  if (!winnerBoxEl) {
    winnerBoxEl = document.createElement('div');
    winnerBoxEl.id = 'winner-splash';
    cardsEl.parentNode.insertBefore(winnerBoxEl, cardsEl);
  }
  var poolPayouts = computePoolPayouts();
  var payoutAmounts = [poolPayouts.p1, poolPayouts.p2, poolPayouts.p3];
  var payoutLabels = ['1st', '2nd', '3rd'];
  if (tourneyDone && ranked[0]) {
    var w = ranked[0];
    var wPayoutAmt = poolPayouts.p1;
    var wScoreDisp = fmtTeam(w.total);
    var wScoreCls = cls(w.total);
    var wGolfers = w.top4.map(function(g) {
      var gd = GOLFER_SCORES[g.name];
      var flag = FLAGS[g.name] || '';
      var isMc = gd && (gd.score === 11 || gd.score === 12);
      var gScore = isMc ? (gd.score === 12 ? 'WD' : 'MC') : fmt(g.score);
      var gCls = isMc ? 'mc' : cls(g.score);
      return '<div class="ws-golfer"><span class="ws-golfer-flag">' + flag + '</span><span class="ws-golfer-name">' + escHtml(g.name) + '</span><span class="ws-golfer-score ' + gCls + '">' + gScore + '</span></div>';
    }).join('');
    winnerBoxEl.innerHTML = '<div class="ws-confetti"></div>'
      + '<div class="ws-content">'
      + '<div class="ws-trophy">🏆</div>'
      + '<div class="ws-label">EAST POLE MASTERS POOL CHAMPION</div>'
      + '<div class="ws-team">' + escHtml(w.team) + '</div>'
      + '<div class="ws-by">' + escHtml(w.name) + '</div>'
      + '<div class="ws-total"><span class="' + wScoreCls + '">' + wScoreDisp + '</span></div>'
      + '<div class="ws-golfers">' + wGolfers + '</div>'
      + '<div class="ws-payout">$' + wPayoutAmt.toLocaleString() + '</div>'
      + '<div class="ws-payout-lbl">Prize Money</div>'
      + '</div>';
    winnerBoxEl.style.display = '';
  } else {
    winnerBoxEl.innerHTML = '';
    winnerBoxEl.style.display = 'none';
  }

  cardsEl.innerHTML = payoutLabels.map(function(label, i) {
    var holder = '';
    var tbNote = '';
    if (TOURNAMENT_STARTED && ranked[i] && maxCompleted >= 2) {
      holder = ranked[i].team;
      if (tourneyDone) {
        // Detect split-tied (tied even after 5th + 6th best score)
        var splitMates = ranked.filter(function(e) { return compareEntries(e, ranked[i]) === 0; });
        if (splitMates.length > 1) {
          tbNote = '<div class="pc-tb">Split ' + splitMates.length + '-way</div>';
        }
      }
    }
    var isGold = i === 0;
    var finalCls = tourneyDone ? ' final' : '';
    var compactCls = holder ? '' : ' compact';
    var whoRow = holder ? '<div class="pc-who">' + escHtml(holder) + '</div>' : '';
    return '<div class="payout-card ' + (isGold ? 'gold' : '') + finalCls + compactCls + '">' +
      '<div class="pc-lbl">' + label + '</div>' +
      '<div class="pc-amt">$' + payoutAmounts[i].toLocaleString() + '</div>' +
      whoRow +
      tbNote +
    '</div>';
  }).join('');
  var poolSubHtml = ENTRIES.length + ' entries · $' + POOL_CONFIG.buyIn + ' buy-in · <strong style="color:var(--gold)">$' + poolPayouts.pot.toLocaleString() + ' pot</strong>';
  if (TOURNEY_FINAL) {
    var winScoreDisp = WINNING_SCORE > 0 ? '+' + WINNING_SCORE : WINNING_SCORE === 0 ? 'E' : String(WINNING_SCORE);
    poolSubHtml += '<br><span class="final-label">🏆 TOURNAMENT FINAL</span> · Winning score: <strong>' + winScoreDisp + '</strong>';
  } else {
    poolSubHtml += '<br>Best 4 of 10 golfer scores combined over four rounds wins.';
  }
  document.getElementById('standings-pool-sub').innerHTML = poolSubHtml;

  // Compute prior-round entry ranks dynamically (same logic as leaderboard)
  var priorEntryRanks = {};
  if (TOURNAMENT_STARTED) {
    var priorEntries = ranked.map(function(e) {
      var priorTotal = 0;
      e.top4.forEach(function(g) {
        var gd = GOLFER_SCORES[g.name];
        var td = gd ? gd.todayDisplay : null;
        var todayVal = 0;
        if (td && td !== '—') {
          todayVal = td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0;
        }
        priorTotal += g.score - todayVal;
      });
      return { key: e.team + '|' + e.email, prior: priorTotal };
    }).sort(function(a, b) { return a.prior - b.prior; });
    var pRk = 1;
    priorEntries.forEach(function(pe, idx) {
      if (idx > 0 && pe.prior !== priorEntries[idx - 1].prior) pRk = idx + 1;
      priorEntryRanks[pe.key] = pRk;
    });
  }

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
        var priorRk = priorEntryRanks[entryKey];
        var moveHtml = '';
        if (priorRk && priorRk !== myRank) {
          var mv = priorRk - myRank;
          moveHtml = mv > 0 ? '<div class="pos-move up">▲' + mv + '</div>' : '<div class="pos-move dn">▼' + Math.abs(mv) + '</div>';
        }
        var myTeamToday = 0, myTodayCount = 0;
        myEntry.top4.forEach(function(g) { var gd = GOLFER_SCORES[g.name]; if (gd && (gd.score === 11 || gd.score === 12)) return; var td = gd ? gd.todayDisplay : null; if (td && td !== '—') { myTeamToday += td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0; myTodayCount++; } });
        var myTodayDisp = myTodayCount > 0 ? (myTeamToday > 0 ? '+' + myTeamToday : myTeamToday === 0 ? 'E' : '' + myTeamToday) : '—';
        var myTodayCls = myTeamToday < 0 ? 'neg' : myTeamToday > 0 ? 'pos' : 'eve';
        var teamJumpArg = escHtml(JSON.stringify(myEntry.team));
        myRows += '<div class="my-hero-row" onclick="jumpToEntry(' + teamJumpArg + ')">'
            + '<div class="my-hero-rank">' + myRank + moveHtml + '</div>'
            + '<div class="my-hero-name">' + escHtml(myEntry.team) + '</div>'
            + '<div class="my-hero-today ' + myTodayCls + '">' + myTodayDisp + '</div>'
            + '<div class="my-hero-score ' + scc + '">' + fmtTeam(myEntry.total) + '</div>'
            + '</div>';
      }
    });
    var showAllBtn = (activeTeamIdx >= 0 && currentUserTeams.length > 1) ? '<div class="my-show-all" onclick="trackEvent(\'show-all-entries\');setUser(' + escHtml(JSON.stringify(currentUserEmail)) + ',-1)">Show All Entries</div>' : '';
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
    var priorRk = priorEntryRanks[entryKey];
    var moveHtml = '';
    if (priorRk && priorRk !== rank) {
      var mv = priorRk - rank;
      moveHtml = mv > 0 ? '<div class="pos-move up">▲' + mv + '</div>' : '<div class="pos-move dn">▼' + Math.abs(mv) + '</div>';
    }
    var teamToday = 0, teamTodayCount = 0;
    e.top4.forEach(function(g) { var gd = GOLFER_SCORES[g.name]; if (gd && (gd.score === 11 || gd.score === 12)) return; var td = gd ? gd.todayDisplay : null; if (td && td !== '—') { teamToday += (td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0); teamTodayCount++; } });
    var todayDisp = teamTodayCount > 0 ? (teamToday > 0 ? '+' + teamToday : teamToday === 0 ? 'E' : '' + teamToday) : '—';
    var todayCls = teamToday < 0 ? 'neg' : teamToday > 0 ? 'pos' : 'eve';
    var holesTag = ROUND_START_ROUND >= 4 ? (teamHolesLeft > 0 ? '<span class="s-holes">' + teamHolesLeft + '</span>' : '') : '';
    var inMoney = TOURNEY_FINAL && rank <= 3;
    var moneyIcon = inMoney ? (rank === 1 ? '🏆' : '💰') : '';
    html += '<div class="tv-row st-row' + isMyTeam + cmpCls + cmpSelCls + (inMoney ? ' in-money' : '') + '" onclick="' + rowClick + '" style="cursor:pointer">'
        + '<div class="tv-pos">' + (moneyIcon || rank) + moveHtml + '</div>'
        + '<div class="tv-player"><span class="st-expand-arrow">▾</span><span class="tv-name' + (isMyTeam ? ' is-my-pick' : '') + '">' + escHtml(e.team) + '</span>' + cmpBadge + ' <span class="tv-country">' + escHtml(e.name) + '</span>' + holesTag + '</div>'
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
      var gTodayRaw = (gd && (gd.score === 11 || gd.score === 12)) ? null : (gd ? gd.todayDisplay : null);
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
      var escapedGName = g.name.replace(/'/g, "\\'");
      var stScId = 'st-sc-' + i + '-' + j;
      return '<div class="tv-row st-pick-row ' + (isTop ? 'is-top' : 'is-bench') + '" onclick="event.stopPropagation();toggleStandingsScorecard(\'' + stScId + '\',\'' + escapedGName + '\')" style="cursor:pointer">'
          + '<div class="tv-pos" style="font-size:10px">' + (isTop ? '★' : '') + '</div>'
          + '<div class="tv-player"><span class="st-pick-name">' + (flag ? flag + ' ' : '') + g.name + '</span>'
          + '<div class="st-pick-sub">' + (ownP ? '<span class="mini-pick-own">' + ownP + '</span>' : '') + '</div>'
          + '</div>'
          + '<div class="tv-thru">' + thruDisp + '</div>'
          + '<div class="tv-today ' + gTodayCls + '">' + gTodayDisp + '</div>'
          + '<div class="tv-score ' + (isMc ? 'mc' : cls(g.score)) + '">' + (isMc ? (gd.thru === 'WD' || gd.score === 12 ? 'WD' : 'MC') : fmt(g.score)) + '</div>'
          + '</div>'
          + '<div class="sc-panel" id="' + stScId + '"></div>';
    }).join('');
    // 5th/6th-best tiebreaker note (only on tied entries among top 3)
    var tbFooter2 = '';
    var isTiedWithNeighbor = (i < displayRanked.length-1 && displayRanked[i].total === displayRanked[i+1].total) || (i > 0 && displayRanked[i].total === displayRanked[i-1].total);
    if (isTiedWithNeighbor && rank <= 3) {
      var tbBits = [];
      if (e.fifthScore != null) tbBits.push('5th: ' + fmt(e.fifthScore));
      if (e.sixthScore != null) tbBits.push('6th: ' + fmt(e.sixthScore));
      if (tbBits.length) tbFooter2 = ' · TB ' + tbBits.join(' / ');
    }
    var footerHoles = ROUND_START_ROUND >= 4 && !TOURNEY_FINAL ? ' · ' + teamHolesLeft + ' holes left' : '';
    // Payout badge for top 3 when final
    var payoutBadge = '';
    if (TOURNEY_FINAL && rank <= 3) {
      var payAmt = payoutAmounts[rank - 1];
      var payLbl = payoutLabels[rank - 1];
      payoutBadge = '<span class="payout-badge' + (rank === 1 ? ' gold' : '') + '">💰 ' + payLbl + ' — $' + payAmt.toLocaleString() + '</span>';
    }
    html += '<div class="picks-panel-footer"><span>' + escHtml(e.name) + tbFooter2 + footerHoles + '</span>' + payoutBadge + '<button class="h2h-quick-btn" onclick="event.stopPropagation();openH2HPicker(' + entryIdx + ')">⚔️ H2H</button></div> </div>';
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
  var fnEl = document.getElementById('standings-footnote');
  fnEl.style.display = (hasTies || TOURNEY_FINAL) ? 'block' : 'none';
  if (hasTies || TOURNEY_FINAL) {
    fnEl.innerHTML = '<strong style="color:var(--text2);">TB</strong> = Tied teams in the top 3 are broken by lowest 5th-best golfer score, then 6th-best. Still tied after 6 = split evenly.'
      + '<br><strong style="color:var(--text2);">MC</strong> = Missed Cut (+11 penalty). <strong style="color:var(--text2);">WD</strong> = Withdrawn (+12 penalty).';
  }

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
  // If a golfer scorecard is open inside standings, just close that first
  if (_openStScorecardId !== null) {
    var scPanel = document.getElementById(_openStScorecardId);
    if (scPanel) { scPanel.classList.remove('open'); scPanel.innerHTML = ''; }
    _openStScorecardId = null;
    return;
  }
  var panel = document.getElementById('panel-'+i);
  var prevOpen = document.querySelector('.picks-panel.open');
  if (prevOpen && prevOpen !== panel) {
    prevOpen.classList.remove('open');
    var prevRow = prevOpen.previousElementSibling;
    if (prevRow) prevRow.classList.remove('panel-open');
    _openPanelTeam = null;
    return;
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
