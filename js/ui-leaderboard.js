// ── Leaderboard View ──

var lbFilter = 'all';
var lbSearch = '';
var lbSort = 'score';
var lbSortAsc = true;

function filterLeaderboardSearch() {
  var v = document.getElementById('lb-search').value || '';
  lbSearch = v.trim().toLowerCase();
  document.getElementById('lb-search-clear').style.display = v.length ? 'block' : 'none';
  renderLeaderboard();
}

function setLbSort(col) {
  if (lbSort === col) { lbSortAsc = !lbSortAsc; }
  else { lbSort = col; lbSortAsc = true; }
  renderLeaderboard();
}

function setLbFilter(f, btn) {
  lbFilter = f;
  trackEvent('lb-filter-' + f);
  document.querySelectorAll('#view-leaderboard .seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
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
    teamLegend = '<div style="display:flex;gap:8px;justify-content:center;padding:4px 14px 0;flex-wrap:wrap">' + currentUserTeams.map(function(t, i) { return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text2)"><span class="team-pill ' + (PILL_CLASSES[i]||'') + '" style="width:16px;height:13px;font-size:8px;border-radius:4px">' + pillLabel(i) + '</span>' + t.team + '</span>'; }).join('') + '</div>';
  }
  seg.innerHTML = '<button class="seg-btn' + (lbFilter==='all'?' active':'') + '" onclick="setLbFilter(\'all\',this)">All</button> <button class="seg-btn' + (lbFilter==='pool'?' active':'') + '" onclick="setLbFilter(\'pool\',this)">In Pool</button> ' + myPicksBtn;
  var oldLegend = seg.parentNode.querySelector('.seg-team-legend');
  if (oldLegend) oldLegend.remove();
  if (teamLegend) { var div = document.createElement('div'); div.className = 'seg-team-legend'; div.innerHTML = teamLegend; seg.parentNode.appendChild(div); }
}

function renderLeaderboard() {
  _openScorecardIdx = null;
  var poolNames = new Set(ENTRIES.flatMap(function(e) { return e.picks; }));
  var myPicksMap = getMyPicksMap();
  var myAllPicks = getActiveTeamPicks();
  var players = Object.entries(GOLFER_SCORES).map(function(entry) { var name = entry[0], d = entry[1]; return Object.assign({ name: name }, d); });
  var parseTodayVal = function(p) {
    if (p.score === 11 || p.score === 12) return 999;
    if (p.thru === '—') return 999;
    if (p.thru && p.thru.includes(':')) return 999;
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
  if (lbSort === 'score') activePlayers.sort(function(a,b) {
    var aScheduled = a.thru === '—'; var bScheduled = b.thru === '—';
    if (aScheduled && bScheduled) return (parseTeeTime(a) - parseTeeTime(b)) * dir;
    if (aScheduled) return 1; if (bScheduled) return -1;
    var diff = a.score - b.score; if (diff !== 0) return diff * dir;
    return parseTeeTime(a) - parseTeeTime(b);
  });
  else if (lbSort === 'today') activePlayers.sort(function(a,b) {
    var aWaiting = a.thru === '—' || a.thru === 'F' || (a.thru && a.thru.includes(':'));
    var bWaiting = b.thru === '—' || b.thru === 'F' || (b.thru && b.thru.includes(':'));
    if (aWaiting && !bWaiting) return 1; if (!aWaiting && bWaiting) return -1;
    if (aWaiting && bWaiting) return a.score - b.score;
    return (parseTodayVal(a) - parseTodayVal(b)) * dir;
  });
  else if (lbSort === 'thru') activePlayers.sort(function(a,b) { return (parseThruVal(b) - parseThruVal(a)) * dir; });
  else if (lbSort === 'tot') activePlayers.sort(function(a,b) { return ((a.tot||9999) - (b.tot||9999)) * dir; });
  mcPlayers.sort(function(a,b) { return a.score - b.score; });
  players = activePlayers.concat(mcPlayers);
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
  if (legendEl) {
    if (currentUserTeams.length > 1 && activeTeamIdx === -1) {
      legendEl.innerHTML = currentUserTeams.map(function(t, i) { return '<div class="lb-legend-item"><span class="team-pill ' + (PILL_CLASSES[i]||'') + '" style="width:16px;height:13px;font-size:8px;border-radius:4px">' + pillLabel(i) + '</span><span>' + t.team + '</span></div>'; }).join('');
    } else if (currentUserTeams.length > 1 && activeTeamIdx >= 0) {
      var t = currentUserTeams[activeTeamIdx];
      legendEl.innerHTML = '<div class="lb-legend-item"><span class="team-pill ' + (PILL_CLASSES[activeTeamIdx]||'') + '" style="width:16px;height:13px;font-size:8px;border-radius:4px">' + pillLabel(activeTeamIdx) + '</span><span>' + t.team + '</span></div>';
    } else if (currentUserTeams.length === 1) {
      legendEl.innerHTML = '<div class="lb-legend-item"><span class="team-pill ' + (PILL_CLASSES[0]||'') + '" style="width:16px;height:13px;font-size:8px;border-radius:4px">' + pillLabel(0) + '</span><span>' + currentUserTeams[0].team + '</span></div>';
    } else { legendEl.innerHTML = ''; }
  }
  var samplePlayer = players.find(function(p) { return p.thru!=='—'&&p.thru!=='MC'&&p.thru!=='WD'; });
  var maxCompletedRounds = 0;
  players.forEach(function(p) {
    if (p.thru === '—' || p.score === 11 || p.score === 12) return;
    var cnt = [p.r1,p.r2,p.r3,p.r4].filter(function(r){return r!=null;}).length;
    if (cnt > maxCompletedRounds) maxCompletedRounds = cnt;
  });
  var completedRoundCount = maxCompletedRounds;
  var activePlayingLb = players.filter(function(p) { return p.thru !== '—' && p.thru !== 'MC' && p.thru !== 'WD' && p.score !== 11 && p.score !== 12; });
  var anyStillPlaying = activePlayingLb.some(function(p) { return /^\d+$/.test(p.thru) && parseInt(p.thru) >= 1 && parseInt(p.thru) < 18; });
  var anyHaveTeeTime = activePlayingLb.some(function(p) { return p.thru && p.thru.includes(':'); });
  var currentRound = samplePlayer ? (anyStillPlaying ? (completedRoundCount + 1) || 1 : anyHaveTeeTime ? completedRoundCount + 1 : completedRoundCount) : 0;
  var isPreT = currentRound === 0 && !TOURNAMENT_STARTED;
  if (isPreT) {
    var oddsIdx = lbSort === 't5' ? 1 : lbSort === 't10' ? 2 : 0;
    var oddsDir = lbSortAsc ? 1 : -1;
    players.sort(function(a,b) {
      var oa = PRE_ODDS[a.name] ? parseInt(PRE_ODDS[a.name][oddsIdx].replace('+','')) : 999999;
      var ob = PRE_ODDS[b.name] ? parseInt(PRE_ODDS[b.name][oddsIdx].replace('+','')) : 999999;
      return (oa - ob) * oddsDir;
    });
  }
  var roundLabels = ['PRE-TOURNAMENT ODDS','FIRST ROUND','SECOND ROUND','THIRD ROUND','FINAL ROUND'];
  var endOfRoundLabels = ['','END OF ROUND 1','END OF ROUND 2','END OF ROUND 3','FINAL ROUND'];
  var tvTitle = document.getElementById('lb-round-title');
  if (tvTitle) {
    if (anyStillPlaying) { tvTitle.textContent = roundLabels[currentRound] || 'FIRST ROUND'; }
    else if (anyHaveTeeTime && currentRound > 0) { tvTitle.textContent = roundLabels[currentRound] || 'ROUND ' + currentRound; }
    else if (currentRound > 0) { tvTitle.textContent = endOfRoundLabels[currentRound] || roundLabels[currentRound]; }
    else { tvTitle.textContent = TOURNAMENT_STARTED ? 'FIRST ROUND' : roundLabels[0]; }
  }
  var sortArrow = function(col) { return lbSort===col ? (lbSortAsc ? ' ▲' : ' ▼') : ''; };
  var sortCls = function(col) { return lbSort===col ? ' tv-h-active' : ''; };
  var colHdr;
  if (isPreT) {
    colHdr = '<div class="tv-col-hdr"><div class="tv-h-pos">#</div><div class="tv-h-pill"></div><div class="tv-h-player">PLAYER</div>'
      + '<div class="tv-h-odds tv-h-sort' + sortCls('win') + '" onclick="setLbSort(\'win\')">WIN' + sortArrow('win') + '</div>'
      + '<div class="tv-h-odds tv-h-sort' + sortCls('t5') + '" onclick="setLbSort(\'t5\')">T5' + sortArrow('t5') + '</div>'
      + '<div class="tv-h-odds tv-h-sort' + sortCls('t10') + '" onclick="setLbSort(\'t10\')">T10' + sortArrow('t10') + '</div></div>';
  } else {
    colHdr = '<div class="tv-col-hdr"><div class="tv-h-pos">POS</div><div class="tv-h-pill"></div><div class="tv-h-player">PLAYER</div>'
      + '<div class="tv-h-score tv-h-sort' + sortCls('score') + '" onclick="setLbSort(\'score\')">SCORE' + sortArrow('score') + '</div>'
      + '<div class="tv-h-today tv-h-sort' + sortCls('today') + '" onclick="setLbSort(\'today\')">TODAY' + sortArrow('today') + '</div>'
      + '<div class="tv-h-thru tv-h-sort' + sortCls('thru') + '" onclick="setLbSort(\'thru\')">THRU' + sortArrow('thru') + '</div>'
      + '</div>';
  }
  var rows = '';
  var cutInserted = false;
  var estCutInserted = false;
  var estCutShow = currentRound >= 1 && currentRound <= 2 && lbSort === 'score' && lbFilter === 'all' && !lbSearch;
  var estCutScore = null;
  if (estCutShow) { var cnt = 0; for (var ci = 0; ci < players.length; ci++) { var pp = players[ci]; if (pp.thru !== 'MC') { cnt++; if (cnt === 65) { estCutScore = pp.score; break; } } } }
  var arrowPlayers = new Map();
  if (!isPreT) {
    var allDeltas = new Map();
    players.forEach(function(p) {
      if (p.score === 11 || p.score === 12) return;
      var cP = parsePos(p.pos); if (!cP) return;
      var sP = ROUND_START_POSITIONS[p.name];
      if (sP && sP !== cP) { allDeltas.set(p.name, sP - cP); return; }
      var pP = PREV_POSITIONS[p.name];
      if (pP && pP !== cP) allDeltas.set(p.name, pP - cP);
    });
    var sorted = Array.from(allDeltas.entries()).map(function(entry) { return { name: entry[0], delta: entry[1] }; });
    var ups = sorted.filter(function(d) { return d.delta > 0; }).sort(function(a,b) { return b.delta - a.delta; }).slice(0, 10);
    var dns = sorted.filter(function(d) { return d.delta < 0; }).sort(function(a,b) { return a.delta - b.delta; }).slice(0, 10);
    ups.forEach(function(d) { arrowPlayers.set(d.name, d.delta); });
    dns.forEach(function(d) { arrowPlayers.set(d.name, d.delta); });
  }
  var topMoverNames = isPreT ? new Map() : getTopMovers(arrowPlayers);
  var rowIdx = 0;
  players.forEach(function(p) {
    var mc = p.thru==='MC'||p.thru==='WD'||p.score===11||p.score===12, inPool = poolNames.has(p.name);
    if (!cutInserted && mc && currentRound >= 2) { rows += '<div class="cut-line-row"><div class="cut-line-label">── Cut Line ──</div></div>'; cutInserted = true; }
    if (lbSort === 'score' && !estCutInserted && !cutInserted && estCutScore !== null && !mc && p.score > estCutScore) { rows += '<div class="est-cut-line-row"><div class="est-cut-line-label">── Estimated Cut Line ──</div></div>'; estCutInserted = true; }
    var sc = p.score, scf = fmt(sc);
    var scClass = mc ? 'mc' : sc < 0 ? 'neg' : sc > 0 ? 'pos' : 'eve';
    var flag = FLAGS[p.name] || '';
    var cc = getCountryCode(p.name);
    var preT = p.thru === '—';
    var teeStr = '';
    if (p.teeTime && p.teeTime.includes('T')) { try { teeStr = new Date(p.teeTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); } catch(e){} }
    else if (p.teeTime) { teeStr = p.teeTime; }
    var isTeeTime = p.thru && p.thru.includes(':');
    var lastRoundScore = (function(){ var rs = [p.r1,p.r2,p.r3,p.r4]; for(var i=rs.length-1;i>=0;i--){ if(rs[i]&&rs[i]>50) return rs[i]; } return null; })();
    var roundDone = p.thru === 'F' || p.thru === '18';
    var thruDisp = preT ? teeStr || '—' : (isTeeTime ? p.thru : (roundDone && lastRoundScore ? lastRoundScore : p.thru + (p.startHole === 10 && p.thru !== 'MC' && !roundDone && parseInt(p.thru) > 0 ? '*' : '')));
    var todayDisp = preT ? '—' : (isTeeTime ? '—' : (p.todayDisplay || '—'));
    var todayVal = todayDisp === 'E' || todayDisp === '—' ? 0 : parseInt(todayDisp.replace('+','')) || 0;
    var todayCls = todayDisp === '—' ? '' : (todayVal < 0 ? 'neg' : todayVal > 0 ? 'pos' : 'eve');
    var prevP = PREV_POSITIONS[p.name];
    var currP = parsePos(p.pos);
    var startP = ROUND_START_POSITIONS[p.name];
    var refP = startP || prevP;
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
    var oddsArr = PRE_ODDS[p.name] || ['','',''];
    if (isPreT) {
      rows += '<div class="tv-row' + (isMyPick?' is-my-team':'') + (isPrevWinner?' tv-prev-winner':'') + '" onclick="toggleScorecard(' + ri + ',\'' + escapedName + '\')" style="cursor:pointer">'
        + '<div class="tv-pos">' + (ri + 1) + '</div>'
        + '<div class="tv-pill-slot">' + pills + '</div>'
        + '<div class="tv-player"><span class="tv-name ' + (isMyPick?'is-my-pick':'') + '">' + p.name + '</span> <span class="tv-country">' + flag + (cc?' '+cc:'') + '</span>'
        + (isPrevWinner?'<span class="prev-winner-badge">Def. Champion</span>':'')
        + (inPool&&!isMyPick?'<span class="tv-pool-dot"></span>':'')
        + '</div>'
        + '<div class="tv-odds">' + oddsArr[0] + '</div>'
        + '<div class="tv-odds">' + oddsArr[1] + '</div>'
        + '<div class="tv-odds">' + oddsArr[2] + '</div>'
        + '</div>'
        + '<div class="sc-panel" id="sc-panel-' + ri + '"></div>';
    } else {
      rows += '<div class="tv-row' + (mc?' tv-mc':'') + (isMyPick?' is-my-team':'') + (isPrevWinner?' tv-prev-winner':'') + flashCls + '" onclick="toggleScorecard(' + ri + ',\'' + escapedName + '\')" style="cursor:pointer">'
        + '<div class="tv-pos">' + (mc?(p.thru==='WD'||p.score===12?'WD':'MC'):p.pos) + moveHtml + '</div>'
        + '<div class="tv-pill-slot">' + pills + '</div>'
        + '<div class="tv-player"><span class="tv-name ' + (isMyPick?'is-my-pick':'') + '">' + p.name + '</span> <span class="tv-country">' + flag + (cc?' '+cc:'') + '</span>'
        + (isMover ? (moverInfo.sign === 'up' ? '<span class="top-mover"><span class="mover-arrow">\uD83D\uDD25</span>' + Math.abs(roundDelta) + '</span>' : '<span class="top-mover down"><span class="mover-arrow">\uD83E\uDDCA</span>' + Math.abs(roundDelta) + '</span>') : '')
        + (isPrevWinner?'<span class="prev-winner-badge">Def. Champion</span>':'')
        + (inPool&&!isMyPick?'<span class="tv-pool-dot"></span>':'')
        + '</div>'
        + '<div class="tv-score ' + scClass + '">' + (preT?'—':mc?(p.thru==='WD'||p.score===12?'WD':'MC'):(scoreChange ? '<span class="score-pulse">' + scf + '</span>' : scf)) + '</div>'
        + '<div class="tv-today ' + todayCls + '">' + todayDisp + '</div>'
        + '<div class="tv-thru' + (!mc && !roundDone && !isTeeTime && !preT ? ' active' : '') + '">' + thruDisp + '</div>'
        + '</div>'
        + '<div class="sc-panel" id="sc-panel-' + ri + '"></div>';
    }
  });
  document.getElementById('leaderboard-list').innerHTML = colHdr + rows;
  var _stickyH = document.querySelector('.lb-sticky-hdr');
  var _colH = document.querySelector('#leaderboard-list .tv-col-hdr');
  if (_stickyH && _colH) _colH.style.top = _stickyH.offsetHeight + 'px';
}
