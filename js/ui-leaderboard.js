// ── Leaderboard View ──

var lbFilter = 'all';
var lbSearch = '';
var lbSort = 'score';
var lbSortAsc = true;
var _pendingLbRender = false;

function filterLeaderboardSearch() {
  var v = document.getElementById('lb-search').value || '';
  lbSearch = v.trim().toLowerCase();
  document.getElementById('lb-search-clear').style.display = v.length ? 'block' : 'none';
  renderLeaderboard();
}

// Close any open scorecard panel so a user-initiated re-render can proceed.
// (renderLeaderboard() is blocked while a scorecard is open, which is correct
// for background polling but not for filter/sort taps.)
function _closeOpenScorecardForRerender() {
  if (_openScorecardIdx === null) return;
  var panel = document.getElementById('sc-panel-' + _openScorecardIdx);
  if (panel) { panel.classList.remove('open'); panel.innerHTML = ''; }
  _openScorecardIdx = null;
}

function setLbSort(col) {
  if (lbSort === col) { lbSortAsc = !lbSortAsc; }
  else { lbSort = col; lbSortAsc = true; }
  _closeOpenScorecardForRerender();
  renderLeaderboard();
}

function setLbFilter(f, btn) {
  lbFilter = f;
  trackEvent('lb-filter-' + f);
  document.querySelectorAll('#view-leaderboard .seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  _closeOpenScorecardForRerender();
  renderLeaderboard();
}

function updateLbSeg() {
  var seg = document.querySelector('#view-leaderboard .seg');
  if (!seg) return;
  if (lbFilter === 'teamA' || lbFilter === 'teamB') lbFilter = 'all';
  if (lbFilter === 'myPicks' && !currentUserTeams.length) lbFilter = 'all';
  var myPicksBtn = currentUserTeams.length ? '<button class="seg-btn' + (lbFilter==='myPicks'?' active':'') + '" onclick="setLbFilter(\'myPicks\',this)">My Picks</button>' : '';
  var teamLegend = '';
  if (lbFilter === 'myPicks' && currentUserTeams.length > 0) {
    teamLegend = '<div style="display:flex;gap:8px;justify-content:center;padding:4px 14px 0;flex-wrap:wrap">' + currentUserTeams.map(function(t, i) { return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text2)"><span class="team-pill ' + (PILL_CLASSES[i]||'') + '" style="width:16px;height:13px;font-size:8px;border-radius:4px">' + pillLabel(i) + '</span>' + escHtml(t.team) + '</span>'; }).join('') + '</div>';
  }
  seg.innerHTML = '<button class="seg-btn' + (lbFilter==='all'?' active':'') + '" onclick="setLbFilter(\'all\',this)">All</button> <button class="seg-btn' + (lbFilter==='pool'?' active':'') + '" onclick="setLbFilter(\'pool\',this)">In Pool</button> ' + myPicksBtn + ' <button class="seg-btn' + (lbFilter==='threat'?' active':'') + '" onclick="setLbFilter(\'threat\',this)">🎯 Threat</button>';
  var oldLegend = seg.parentNode.querySelector('.seg-team-legend');
  if (oldLegend) oldLegend.remove();
  if (teamLegend) { var div = document.createElement('div'); div.className = 'seg-team-legend'; div.innerHTML = teamLegend; seg.parentNode.appendChild(div); }
}

function renderLeaderboard() {
  // Don't re-render while a scorecard is open — it would destroy the panel
  if (_openScorecardIdx !== null) { _pendingLbRender = true; return; }
  _pendingLbRender = false;
  // Restore search visibility for non-threat modes (threat mode hides it)
  var _lbSearchEl = document.getElementById('lb-search');
  if (_lbSearchEl && _lbSearchEl.parentNode) _lbSearchEl.parentNode.style.visibility = '';
  // Branch: Threat Board mode takes over the #leaderboard-list container
  if (lbFilter === 'threat') { renderThreatBoard(); return; }
  var poolNames = new Set(ENTRIES.flatMap(function(e) { return e.picks; }));
  var myPicksMap = getMyPicksMap();
  var myAllPicks = getActiveTeamPicks();
  var players = Object.entries(GOLFER_SCORES).map(function(entry) { var name = entry[0], d = entry[1]; return Object.assign({ name: name }, d); });
  var parseTodayVal = function(p) {
    if (p.score === 11 || p.score === 12) return 999;
    var td = p.todayDisplay || '—';
    if (td === '—') return 998;
    if (td === 'E') return 0;
    return parseInt(td.replace('+', '')) || 0;
  };
  var parseThruVal = function(p) {
    if (p.thru === '—') return -1;
    if (p.thru === 'MC') return 99;
    if (/[AP]M/i.test(p.thru)) return 18;
    return parseInt(p.thru) || 0;
  };
  var dir = lbSortAsc ? 1 : -1;
  var parseTeeTime = function(p) {
    if (!p.teeTime || !p.teeTime.includes('T')) return 0;
    try { return new Date(p.teeTime).getTime(); } catch(e) { return 0; }
  };
  var isMcWd = function(p) { return p.score === 11 || p.score === 12; };
  var activePlayers = players.filter(function(p) { return !isMcWd(p); });
  var mcPlayers = players.filter(isMcWd);
  var allScheduled = activePlayers.every(function(p) { return p.thru === '—'; });
  if (lbSort === 'score') activePlayers.sort(function(a,b) {
    var aScheduled = a.thru === '—'; var bScheduled = b.thru === '—';
    if (aScheduled && bScheduled) {
      var tt = parseTeeTime(a) - parseTeeTime(b);
      if (tt !== 0) return tt * dir;
      return a.name.localeCompare(b.name);
    }
    if (aScheduled) return 1; if (bScheduled) return -1;
    var diff = a.score - b.score; if (diff !== 0) return diff * dir;
    return parseTeeTime(a) - parseTeeTime(b);
  });
  else if (lbSort === 'today') activePlayers.sort(function(a,b) {
    var aHasToday = a.todayDisplay && a.todayDisplay !== '—';
    var bHasToday = b.todayDisplay && b.todayDisplay !== '—';
    if (!aHasToday && !bHasToday) return a.score - b.score;
    if (!aHasToday) return 1; if (!bHasToday) return -1;
    return (parseTodayVal(a) - parseTodayVal(b)) * dir;
  });
  else if (lbSort === 'thru') activePlayers.sort(function(a,b) {
    var aT = parseThruVal(a), bT = parseThruVal(b);
    var aTee = a.thru && a.thru.includes(':'), bTee = b.thru && b.thru.includes(':');
    if (aTee && bTee) return (parseTeeTime(a) - parseTeeTime(b)) * dir;
    if (aTee) return 1; if (bTee) return -1;
    var aWait = a.thru === '—', bWait = b.thru === '—';
    if (aWait && bWait) {
      var tt = parseTeeTime(a) - parseTeeTime(b);
      if (tt !== 0) return tt * dir;
      return a.name.localeCompare(b.name);
    }
    if (aWait) return 1; if (bWait) return -1;
    return (aT - bT) * dir;
  });
  else if (lbSort === 'tot') activePlayers.sort(function(a,b) { return ((a.tot||9999) - (b.tot||9999)) * dir; });
  mcPlayers.sort(function(a,b) { return a.score - b.score; });
  players = activePlayers.concat(mcPlayers);
  var allPlayers = players;
  if (lbFilter==='pool') players = players.filter(function(p) { return poolNames.has(p.name); });
  if (lbFilter==='myPicks') players = players.filter(function(p) { return myAllPicks.has(p.name); });
  if (lbSearch) players = players.filter(function(p) { return p.name.toLowerCase().indexOf(lbSearch) !== -1; });
  var countEl = document.getElementById('lb-count');
  if (countEl) {
    if (lbFilter==='pool') countEl.textContent = players.length + ' pool picks';
    else if (lbFilter==='myPicks') countEl.textContent = players.length + ' of your picks';
    else countEl.textContent = '';
  }
  var legendEl = document.getElementById('lb-legend');
  if (legendEl) { legendEl.innerHTML = ''; legendEl.style.display = 'none'; }
  // Use the full unfiltered list for round detection so filters don't break it
  var samplePlayer = allPlayers.find(function(p) { return p.thru!=='—'&&p.thru!=='MC'&&p.thru!=='WD'; });
  var maxCompletedRounds = 0;
  allPlayers.forEach(function(p) {
    if (p.thru === '—' || p.score === 11 || p.score === 12) return;
    var cnt = [p.r1,p.r2,p.r3,p.r4].filter(function(r){return r!=null;}).length;
    if (cnt > maxCompletedRounds) maxCompletedRounds = cnt;
  });
  var completedRoundCount = maxCompletedRounds;
  var activePlayingLb = allPlayers.filter(function(p) { return p.thru !== '—' && p.thru !== 'MC' && p.thru !== 'WD' && p.score !== 11 && p.score !== 12; });
  var anyStillPlaying = activePlayingLb.some(function(p) { return /^\d+$/.test(p.thru) && parseInt(p.thru) >= 1 && parseInt(p.thru) < 18; });
  var anyHaveTeeTime = activePlayingLb.some(function(p) { return p.thru && p.thru.includes(':'); });
  // Determine current round using roundCount (raw linescore count from ESPN, not filtered by >50)
  var currentRound = 0;
  if (samplePlayer) {
    if (anyStillPlaying) {
      var activeOnCourse = activePlayingLb.filter(function(p) { return /^\d+$/.test(p.thru) && parseInt(p.thru) >= 1 && parseInt(p.thru) < 18; });
      if (activeOnCourse.length > 0) {
        var gd = GOLFER_SCORES[activeOnCourse[0].name];
        currentRound = (gd && gd.roundCount) ? gd.roundCount : 1;
      } else {
        currentRound = 1;
      }
    } else if (anyHaveTeeTime) {
      var waitingPlayer = activePlayingLb.find(function(p) { return p.thru && p.thru.includes(':'); });
      if (waitingPlayer) {
        var wgd = GOLFER_SCORES[waitingPlayer.name];
        currentRound = (wgd && wgd.roundCount) ? wgd.roundCount + 1 : completedRoundCount + 1;
      } else {
        currentRound = completedRoundCount + 1;
      }
    } else {
      currentRound = completedRoundCount;
    }
  }
  var isPreT = !TOURNAMENT_STARTED;
  // Compute prior positions from FULL field (before filtering) for arrows
  var fullFieldPriorPosMap = {};
  if (!isPreT && currentRound >= 2) {
    var fullPriorScores = allPlayers
      .filter(function(p) { return p.score !== 11 && p.score !== 12; })
      .map(function(p) {
        var td = p.todayDisplay;
        var todayVal = 0;
        var hasToday = false;
        if (td && td !== '—') { hasToday = true; todayVal = td === 'E' ? 0 : parseInt(td.replace('+', '')) || 0; }
        return { name: p.name, prior: hasToday ? p.score - todayVal : p.score };
      })
      .sort(function(a, b) { return a.prior - b.prior; });
    var fpRk = 1;
    fullPriorScores.forEach(function(ps, idx) {
      if (idx > 0 && ps.prior !== fullPriorScores[idx - 1].prior) fpRk = idx + 1;
      fullFieldPriorPosMap[ps.name] = fpRk;
    });
  }
  var roundLabels = ['FIRST ROUND','FIRST ROUND','SECOND ROUND','THIRD ROUND','FINAL ROUND'];
  var endOfRoundLabels = ['','END OF ROUND 1','END OF ROUND 2','END OF ROUND 3','FINAL ROUND'];
  // Cap currentRound at 4 — playoffs are not a separate round
  if (currentRound > 4) currentRound = 4;
  var isPlayoff = ESPN_ROUND > 4 || activePlayingLb.some(function(p) {
    var gd = GOLFER_SCORES[p.name];
    return gd && gd.roundCount >= 5;
  });
  var tvTitle = document.getElementById('lb-round-title');
  if (tvTitle) {
    if (isPlayoff) {
      tvTitle.textContent = 'FINAL ROUND · PLAYOFF';
    } else if (anyStillPlaying) {
      tvTitle.textContent = roundLabels[currentRound] || 'ROUND ' + currentRound;
    } else if (anyHaveTeeTime && currentRound > 0) {
      // Between rounds: nobody playing, tee times posted for next round
      // Show end-of-previous-round label (currentRound is the upcoming round)
      var prevRound = currentRound - 1;
      tvTitle.textContent = prevRound > 0 ? (endOfRoundLabels[prevRound] || 'END OF ROUND ' + prevRound) : roundLabels[currentRound];
    } else if (currentRound > 0) {
      tvTitle.textContent = endOfRoundLabels[currentRound] || roundLabels[currentRound];
    } else {
      tvTitle.textContent = 'FIRST ROUND';
    }
  }
  console.log('🏌️ Round debug: ESPN_ROUND=' + ESPN_ROUND + ' currentRound=' + currentRound + ' anyStillPlaying=' + anyStillPlaying + ' anyHaveTeeTime=' + anyHaveTeeTime + ' completedRoundCount=' + completedRoundCount);
  var sortArrow = function(col) { return lbSort===col ? '<span class="sort-arrow">' + (lbSortAsc ? '▲' : '▼') + '</span>' : ''; };
  var sortCls = function(col) { return lbSort===col ? ' tv-h-active' : ''; };
  var colHdr = '<div class="tv-col-hdr"><div class="tv-h-pos">POS</div><div class="tv-h-pill"></div><div class="tv-h-player">PLAYER</div>'
      + '<div class="tv-h-score tv-h-sort' + sortCls('score') + '" onclick="setLbSort(\'score\')">SCORE' + sortArrow('score') + '</div>'
      + '<div class="tv-h-today tv-h-sort' + sortCls('today') + '" onclick="setLbSort(\'today\')">TODAY' + sortArrow('today') + '</div>'
      + '<div class="tv-h-thru tv-h-sort' + sortCls('thru') + '" onclick="setLbSort(\'thru\')">THRU' + sortArrow('thru') + '</div>'
      + '</div>';
  var rows = '';
  var cutInserted = false;
  var estCutInserted = false;
  var estCutShow = currentRound === 2 && lbSort === 'score' && lbSortAsc && lbFilter === 'all' && !lbSearch;
  var estCutScore = null;
  if (estCutShow) { var cnt = 0; for (var ci = 0; ci < players.length; ci++) { var pp = players[ci]; if (pp.thru !== 'MC') { cnt++; if (cnt === 65) { estCutScore = pp.score; break; } } } }
  // Use full-field prior positions for arrows (consistent across filters)
  var arrowPlayers = new Map();
  if (!isPreT && currentRound >= 2) {
    allPlayers.forEach(function(p) {
      if (p.score === 11 || p.score === 12) return;
      if (p.thru === '—' || (p.thru && p.thru.includes(':'))) return;
      var cP = parsePos(p.pos); if (!cP) return;
      var sP = fullFieldPriorPosMap[p.name];
      if (sP && sP !== cP) { arrowPlayers.set(p.name, sP - cP); }
    });
  }
  var topMoverNames = isPreT ? new Map() : getTopMovers(arrowPlayers);
  var rowIdx = 0;
  players.forEach(function(p) {
    var mc = p.thru==='MC'||p.thru==='WD'||p.score===11||p.score===12, inPool = poolNames.has(p.name);
    if (!cutInserted && mc && currentRound >= 2 && lbSort === 'score' && lbSortAsc) { rows += '<div class="cut-line-row"><div class="cut-line-label">── Cut Line ──</div></div>'; cutInserted = true; }
    if (lbSort === 'score' && !estCutInserted && !cutInserted && estCutScore !== null && !mc && p.score > estCutScore) { rows += '<div class="est-cut-line-row"><div class="est-cut-line-label">── Estimated Cut Line ──</div></div>'; estCutInserted = true; }
    var sc = p.score, scf = fmt(sc);
    var scClass = mc ? 'mc' : sc < 0 ? 'neg' : sc > 0 ? 'pos' : 'eve';
    var flag = FLAGS[p.name] || '';
    var cc = getCountryCode(p.name);
    var preT = p.thru === '—';
    var teeStr = '';
    if (p.teeTime && p.teeTime.includes('T')) {
      teeStr = (typeof fmtTeeTime === 'function') ? fmtTeeTime(p.teeTime, TOURNEY_COURSE) : '';
      if (!teeStr) {
        try { teeStr = new Date(p.teeTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); } catch(e){}
      }
    } else if (p.teeTime) { teeStr = p.teeTime; }
    var isTeeTime = p.thru && p.thru.includes(':');
    var lastRoundScore = (function(){ var rs = [p.r1,p.r2,p.r3,p.r4]; for(var i=rs.length-1;i>=0;i--){ if(rs[i]&&rs[i]>50) return rs[i]; } return null; })();
    var roundDone = p.thru === 'F' || p.thru === '18';
    var playerInPlayoff = isPlayoff && p.roundCount >= 5;
    var thruDisp;
    if (preT) {
      thruDisp = teeStr || '—';
    } else if (playerInPlayoff && lastRoundScore) {
      thruDisp = lastRoundScore + '*';
    } else if (isTeeTime) {
      thruDisp = p.thru;
    } else if (roundDone && lastRoundScore) {
      thruDisp = lastRoundScore;
    } else {
      thruDisp = p.thru + (p.startHole === 10 && p.thru !== 'MC' && !roundDone && parseInt(p.thru) > 0 ? '*' : '');
    }
    var todayDisp = preT ? '—' : (p.todayDisplay || '—');
    var todayVal = todayDisp === 'E' || todayDisp === '—' ? 0 : parseInt(todayDisp.replace('+','')) || 0;
    var todayCls = todayDisp === '—' ? '' : (todayVal < 0 ? 'neg' : todayVal > 0 ? 'pos' : 'eve');
    var prevP = PREV_POSITIONS[p.name];
    var currP = parsePos(p.pos);
    var refP = fullFieldPriorPosMap[p.name];
    var roundDelta = (refP && currP) ? refP - currP : 0;
    var moveHtml = '';
    var arrowDelta = arrowPlayers.has(p.name) ? arrowPlayers.get(p.name) : 0;
    if (!isPreT && currP && arrowDelta !== 0) {
      var justChanged = prevP && currP && currP !== prevP;
      var flashCl = justChanged ? ' pos-move-flash' : '';
      moveHtml = arrowDelta > 0 ? '<div class="pos-move up' + flashCl + '">▲' + arrowDelta + '</div>' : '<div class="pos-move dn' + flashCl + '">▼' + Math.abs(arrowDelta) + '</div>';
    }
    var moverInfo = topMoverNames.get(p.name);
    var isMover = !!moverInfo;
    var myTeamIdxs = myPicksMap[p.name] || [];
    var pills = myTeamIdxs.map(function(i) { return '<span class="team-pill ' + (PILL_CLASSES[i]||'') + '">' + pillLabel(i) + '</span>'; }).join('');
    var isMyPick = myTeamIdxs.length > 0;
    var isPrevWinner = isPreT && p.name === PREV_WINNER;
    var ri = rowIdx++;
    var escapedName = p.name.replace(/'/g, "\\'");
    var scoreChange = SCORE_CHANGES[p.name] || '';
    var flashCls = scoreChange === 'birdie' ? ' birdie-flash' : scoreChange === 'bogey' ? ' bogey-flash' : scoreChange === 'eagle' ? ' eagle-flash' : '';
    var displayName = p.name;
    var amTag = AMATEURS.has(p.name) ? ' <span class="tv-am">(a)</span>' : '';
    var emojiTag = getPlayerEmoji(p.name) || '';
    rows += '<div class="tv-row' + (mc?' tv-mc':'') + (isMyPick?' is-my-team':'') + (isPrevWinner?' tv-prev-winner':'') + flashCls + '" onclick="toggleScorecard(' + ri + ',\'' + escapedName + '\')" style="cursor:pointer">'
        + '<div class="tv-pos">' + (mc?(p.thru==='WD'||p.score===12?'WD':'MC'):p.pos) + moveHtml + '</div>'
        + '<div class="tv-pill-slot">' + pills + '</div>'
        + '<div class="tv-player"><span class="tv-name ' + (isMyPick?'is-my-pick':'') + '">' + displayName + amTag + '</span> <span class="tv-country">' + flag + (cc?' '+cc:'') + '</span>'
        + (emojiTag ? '<span class="tv-emoji-tag">' + emojiTag + '</span>' : '')
        + (isMover ? (moverInfo.sign === 'up' ? '<span class="top-mover"><span class="mover-arrow">\uD83D\uDD25</span>' + Math.abs(roundDelta) + '</span>' : '<span class="top-mover down"><span class="mover-arrow">\uD83E\uDDCA</span>' + Math.abs(roundDelta) + '</span>') : '')
        + (isPrevWinner?'<span class="prev-winner-badge">Def. Champion</span>':'')
        + (inPool&&!isMyPick?'<span class="tv-pool-dot"></span>':'')
        + '</div>'
        + '<div class="tv-score ' + scClass + '">' + (preT?'—':mc?(p.thru==='WD'||p.score===12?'WD':'MC'):(scoreChange ? '<span class="score-pulse">' + scf + '</span>' : scf)) + '</div>'
        + '<div class="tv-today ' + todayCls + '">' + todayDisp + '</div>'
        + '<div class="tv-thru' + (!mc && !roundDone && !isTeeTime && !preT ? ' active' : '') + '">' + thruDisp + '</div>'
        + '</div>'
        + '<div class="sc-panel" id="sc-panel-' + ri + '"></div>';
  });
  var lbList = document.getElementById('leaderboard-list');
  if (!players.length) {
    lbList.innerHTML = '<div style="padding:48px 24px;text-align:center;color:var(--text3)">'
      + '<div style="font-size:42px;margin-bottom:14px">⛳</div>'
      + '<div style="font-size:15px;font-weight:800;color:var(--text);letter-spacing:0.5px;margin-bottom:8px">' + (TOURNEY_NAME || 'PGA Tournament') + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:18px">' + (TOURNEY_DATES ? TOURNEY_DATES + (TOURNEY_COURSE ? ' · ' + TOURNEY_COURSE : '') : 'Loading tournament info…') + '</div>'
      + '<div style="font-size:11px;line-height:1.6;color:var(--text3);max-width:280px;margin:0 auto">Field and tee times publish from ESPN this week. Pool entries open now — leaderboard goes live Thursday tee-off.</div>'
      + '</div>';
  } else {
    lbList.innerHTML = colHdr + rows;
  }
  if (anyHaveTeeTime) { lbList.classList.add('has-tee-times'); lbList.classList.remove('no-tee-times'); }
  else { lbList.classList.add('no-tee-times'); lbList.classList.remove('has-tee-times'); }

  var _stickyH = document.querySelector('.lb-sticky-hdr');
  var _colH = document.querySelector('#leaderboard-list .tv-col-hdr');
  if (_stickyH && _colH) _colH.style.top = _stickyH.offsetHeight + 'px';
}
