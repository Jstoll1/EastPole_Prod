// ── Threat Board View ──
// Shows golfers most commonly on teams ranked ahead of a selected user entry,
// so the player knows who to cheer against.

var _threatNetMode = true; // default: exclude golfers already on user's team

function toggleThreatNet() {
  _threatNetMode = !_threatNetMode;
  renderThreatBoard();
}

// Pick which of the user's entries to analyze against the field.
// Uses active entry if set, otherwise best-ranked user entry.
function _threatPickEntry(ranked) {
  if (!currentUserTeams || !currentUserTeams.length) return null;
  if (activeTeamIdx >= 0 && currentUserTeams[activeTeamIdx]) {
    return currentUserTeams[activeTeamIdx];
  }
  // Find best-ranked among user's entries
  var best = null, bestIdx = Infinity;
  currentUserTeams.forEach(function(t) {
    var i = ranked.findIndex(function(e) { return e.email === t.email && e.team === t.team; });
    if (i >= 0 && i < bestIdx) { bestIdx = i; best = t; }
  });
  return best;
}

function _threatFmtPct(v) {
  if (v == null || isNaN(v)) return '—';
  var pct = v * 100;
  return pct >= 1 ? pct.toFixed(0) + '%' : pct > 0 ? '<1%' : '—';
}

function _threatRowHtml(t, aheadCount, maxCount) {
  var gd = GOLFER_SCORES[t.name] || {};
  var dg = (typeof DG_LIVE_PREDS !== 'undefined' && DG_LIVE_PREDS[t.name]) || null;
  var flag = FLAGS[t.name] || '';
  var lastName = t.name.split(' ').slice(-1)[0];
  var isOut = gd.score === 11 || gd.score === 12;
  var isDone = gd.thru === 'F' || gd.thru === 'F*';
  var thruDisp = isOut ? (gd.score === 12 ? 'WD' : 'MC') : (gd.thru || '—');
  var todayDisp = isOut ? '—' : (gd.todayDisplay || '—');
  var totDisp = isOut ? (gd.score === 12 ? 'WD' : 'MC') : (gd.score != null ? fmt(gd.score) : '—');
  var todayCls = (todayDisp && todayDisp !== 'E' && todayDisp !== '—')
    ? (todayDisp.indexOf('-') === 0 ? 'neg' : 'pos')
    : (todayDisp === 'E' ? 'eve' : '');
  var scoreCls = isOut ? 'mc' : cls(gd.score);
  var barW = maxCount > 0 ? (t.count / maxCount * 100) : 0;
  var threatPct = aheadCount > 0 ? Math.round(t.count / aheadCount * 100) : 0;
  var top5Pct = dg ? _threatFmtPct(dg.top_5) : '—';
  var rowCls = 'threat-row';
  if (isOut) rowCls += ' threat-out';
  else if (isDone) rowCls += ' threat-done';
  var escName = t.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return '<div class="' + rowCls + '" onclick="openThreatDrill(\'' + escName + '\')">'
    + '<div class="threat-flag">' + flag + '</div>'
    + '<div class="threat-name">' + escHtml(lastName) + '</div>'
    + '<div class="threat-bar-wrap">'
    + '<div class="threat-bar" style="width:' + barW.toFixed(0) + '%"></div>'
    + '<span class="threat-bar-lbl">' + t.count + ' · ' + threatPct + '%</span>'
    + '</div>'
    + '<div class="threat-thru">' + thruDisp + '</div>'
    + '<div class="threat-today ' + todayCls + '">' + todayDisp + '</div>'
    + '<div class="threat-tot ' + scoreCls + '">' + totDisp + '</div>'
    + '<div class="threat-t5">' + top5Pct + '</div>'
    + '</div>';
}

function renderThreatBoard() {
  var el = document.getElementById('leaderboard-list');
  if (!el) return;

  // Hide the lb-search bar — it doesn't apply in threat mode
  var searchWrap = document.getElementById('lb-search');
  if (searchWrap && searchWrap.parentNode) {
    searchWrap.parentNode.style.visibility = 'hidden';
  }

  if (!ENTRIES || !ENTRIES.length) {
    el.innerHTML = '<div class="threat-empty">No entries loaded yet.</div>';
    return;
  }

  var ranked = getRanked();
  var myEntry = _threatPickEntry(ranked);
  if (!myEntry) {
    el.innerHTML = '<div class="threat-empty">Set your entry to see the threat board.</div>';
    return;
  }

  // Find my index in the ranked list
  var myIdx = ranked.findIndex(function(e) { return e.email === myEntry.email && e.team === myEntry.team; });
  if (myIdx < 0) {
    el.innerHTML = '<div class="threat-empty">Could not locate your entry.</div>';
    return;
  }
  var myRankedEntry = ranked[myIdx];
  var aheadEntries = ranked.slice(0, myIdx);
  var aheadCount = aheadEntries.length;

  // Count golfer appearances in top4 of ahead entries
  var counts = {};
  aheadEntries.forEach(function(e) {
    e.top4.forEach(function(g) {
      if (!counts[g.name]) counts[g.name] = 0;
      counts[g.name]++;
    });
  });

  // My top4 for net-threat filter
  var myTop4Names = myRankedEntry.top4.map(function(g) { return g.name; });

  var threats = Object.keys(counts).map(function(name) {
    return { name: name, count: counts[name] };
  });
  if (_threatNetMode) {
    threats = threats.filter(function(t) { return myTop4Names.indexOf(t.name) < 0; });
  }
  threats.sort(function(a, b) {
    if (b.count !== a.count) return b.count - a.count;
    // Tiebreaker: by golfer current score asc (the better they're playing, the more threatening)
    var sa = (GOLFER_SCORES[a.name] && GOLFER_SCORES[a.name].score != null) ? GOLFER_SCORES[a.name].score : 99;
    var sb = (GOLFER_SCORES[b.name] && GOLFER_SCORES[b.name].score != null) ? GOLFER_SCORES[b.name].score : 99;
    return sa - sb;
  });

  // Bubble: teams within 1 stroke above me
  var bubble = aheadEntries.filter(function(e) { return (myRankedEntry.total - e.total) <= 1; });

  // Build HTML
  var html = '';

  // --- Header card ---
  html += '<div class="threat-hdr-card">';
  html += '<div class="threat-hdr-row">';
  html += '<div class="threat-hdr-entry">';
  html += '<div class="threat-hdr-label">Analyzing</div>';
  html += '<div class="threat-hdr-team">' + escHtml(myEntry.team) + '</div>';
  html += '</div>';
  if (currentUserTeams.length > 1) {
    html += '<div class="threat-hdr-switch" onclick="_threatCycleEntry()">Switch ↻</div>';
  }
  html += '</div>';
  html += '<div class="threat-hdr-stats">';
  html += '<div class="threat-stat"><div class="threat-stat-v">' + aheadCount + '</div><div class="threat-stat-l">Ahead of you</div></div>';
  html += '<div class="threat-stat"><div class="threat-stat-v">' + bubble.length + '</div><div class="threat-stat-l">Within 1 stroke</div></div>';
  html += '<div class="threat-stat"><div class="threat-stat-v ' + cls(myRankedEntry.total) + '">' + fmtTeam(myRankedEntry.total) + '</div><div class="threat-stat-l">Your total</div></div>';
  html += '</div>';
  // Net/All toggle
  html += '<div class="threat-toggle-row">';
  html += '<button class="threat-toggle-btn ' + (_threatNetMode ? 'active' : '') + '" onclick="toggleThreatNet()">Net threats only</button>';
  html += '<span class="threat-toggle-hint">' + (_threatNetMode ? 'Hiding golfers already on your team' : 'Showing all golfers') + '</span>';
  html += '</div>';
  html += '</div>';

  // --- Threat list ---
  if (!threats.length) {
    html += '<div class="threat-empty">' + (aheadCount === 0 ? 'You are in 1st place. 🏆' : 'No threats to show.') + '</div>';
  } else {
    html += '<div class="threat-col-hdr">';
    html += '<div class="threat-col-hdr-name">GOLFER</div>';
    html += '<div class="threat-col-hdr-bar">ON TEAMS AHEAD</div>';
    html += '<div class="threat-col-hdr-thru">THRU</div>';
    html += '<div class="threat-col-hdr-today">TODAY</div>';
    html += '<div class="threat-col-hdr-tot">TOT</div>';
    html += '<div class="threat-col-hdr-t5">TOP 5</div>';
    html += '</div>';

    var maxCount = threats[0].count;
    var topN = threats.slice(0, 20);
    topN.forEach(function(t) {
      html += _threatRowHtml(t, aheadCount, maxCount);
    });
  }

  el.innerHTML = html;
}

// Cycle through user's entries when they have multiple
function _threatCycleEntry() {
  if (!currentUserTeams || currentUserTeams.length < 2) return;
  if (activeTeamIdx < 0) activeTeamIdx = 0;
  else activeTeamIdx = (activeTeamIdx + 1) % currentUserTeams.length;
  renderThreatBoard();
}

// Drill-down: show which specific ahead-teams have this golfer in their top 4
function openThreatDrill(golferName) {
  var ranked = getRanked();
  var myEntry = _threatPickEntry(ranked);
  if (!myEntry) return;
  var myIdx = ranked.findIndex(function(e) { return e.email === myEntry.email && e.team === myEntry.team; });
  if (myIdx < 0) return;
  var aheadEntries = ranked.slice(0, myIdx);
  var myTotal = ranked[myIdx].total;

  var matching = aheadEntries.filter(function(e) {
    return e.top4.some(function(g) { return g.name === golferName; });
  });

  var rank = 1;
  aheadEntries.forEach(function(e, i) {
    if (i > 0 && compareEntries(aheadEntries[i-1], e) !== 0) rank = i + 1;
    e._drillRank = rank;
  });

  var gd = GOLFER_SCORES[golferName] || {};
  var flag = FLAGS[golferName] || '';
  var totDisp = (gd.score === 11) ? 'MC' : (gd.score === 12) ? 'WD' : (gd.score != null ? fmt(gd.score) : '—');
  var todayDisp = gd.todayDisplay || '—';
  var thruDisp = gd.thru || '—';

  var html = '<div class="threat-drill-backdrop" onclick="closeThreatDrill(event)">';
  html += '<div class="threat-drill-card" onclick="event.stopPropagation()">';
  html += '<div class="threat-drill-close" onclick="closeThreatDrill(event)">✕</div>';
  html += '<div class="threat-drill-hdr">';
  html += '<div class="threat-drill-flag">' + flag + '</div>';
  html += '<div class="threat-drill-name">' + escHtml(golferName) + '</div>';
  html += '<div class="threat-drill-score ' + cls(gd.score) + '">' + totDisp + '</div>';
  html += '</div>';
  html += '<div class="threat-drill-sub">THRU ' + thruDisp + ' · Today ' + todayDisp + '</div>';
  html += '<div class="threat-drill-list-label">On ' + matching.length + ' ahead team' + (matching.length === 1 ? '' : 's') + ':</div>';
  html += '<div class="threat-drill-list">';
  matching.forEach(function(e) {
    var gap = myTotal - e.total;
    var gapDisp = gap > 0 ? '-' + gap : gap === 0 ? '=' : '+' + Math.abs(gap);
    html += '<div class="threat-drill-team">';
    html += '<div class="threat-drill-team-rank">' + e._drillRank + '</div>';
    html += '<div class="threat-drill-team-name">' + escHtml(e.team) + '</div>';
    html += '<div class="threat-drill-team-gap">' + gapDisp + '</div>';
    html += '<div class="threat-drill-team-tot ' + cls(e.total) + '">' + fmtTeam(e.total) + '</div>';
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';

  var overlay = document.createElement('div');
  overlay.id = 'threat-drill-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

function closeThreatDrill(e) {
  if (e) e.stopPropagation();
  var o = document.getElementById('threat-drill-overlay');
  if (o) o.remove();
}
