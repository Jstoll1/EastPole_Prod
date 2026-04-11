// ── Threat Board View ──
// Shows golfers most commonly on teams ranked ahead of a selected user entry,
// so the player knows who to cheer against.

var _threatNetMode = true; // default: exclude golfers already on user's team
var _threatSortCol = 'tot'; // default sort column
var _threatSortDir = 'asc'; // default sort direction
var _threatPickerOpen = false; // entry picker toggle (closed by default)

function toggleThreatPicker() {
  _threatPickerOpen = !_threatPickerOpen;
  renderThreatBoard();
}

function toggleThreatNet() {
  _threatNetMode = !_threatNetMode;
  renderThreatBoard();
}

// Pick user entry for threat analysis
function selectThreatEntry(idx) {
  if (idx < 0 || idx >= currentUserTeams.length) return;
  activeTeamIdx = idx;
  _threatPickerOpen = false; // auto-close after pick
  renderThreatBoard();
}

// Change sort column (or toggle direction if same column)
function setThreatSort(col) {
  var defaults = { name:'asc', count:'desc', thru:'asc', today:'asc', tot:'asc', t5:'desc' };
  if (_threatSortCol === col) {
    _threatSortDir = (_threatSortDir === 'asc' ? 'desc' : 'asc');
  } else {
    _threatSortCol = col;
    _threatSortDir = defaults[col] || 'asc';
  }
  renderThreatBoard();
}

// Parse today display string ('E', '-2', '+1', '—') → numeric for sort
function _threatTodayNum(td) {
  if (!td || td === '—') return null;
  if (td === 'E') return 0;
  var n = parseInt(td.replace('+', ''), 10);
  return isNaN(n) ? null : n;
}

// Resolve sort value for a threat row on a given column
function _threatSortValue(t, col) {
  var gd = GOLFER_SCORES[t.name] || {};
  var dg = (typeof DG_LIVE_PREDS !== 'undefined' && DG_LIVE_PREDS[t.name]) || null;
  var isOut = gd.score === 11 || gd.score === 12;
  switch (col) {
    case 'name':
      return t.name.split(' ').slice(-1)[0].toLowerCase();
    case 'count':
      return t.count;
    case 'thru':
      if (isOut) return -1;
      var th = gd.thru;
      if (!th || th === '—') return -1;
      if (th === 'F' || th === 'F*') return 18;
      var tn = parseInt(th, 10);
      return isNaN(tn) ? -1 : tn;
    case 'today':
      if (isOut) return 999;
      var tv = _threatTodayNum(gd.todayDisplay);
      return tv == null ? 999 : tv;
    case 'tot':
      if (isOut) return 999;
      return (gd.score != null) ? gd.score : 999;
    case 't5':
      return dg ? (dg.top_5 || 0) : -1;
    default:
      return 0;
  }
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
  var sortMul = (_threatSortDir === 'asc') ? 1 : -1;
  threats.sort(function(a, b) {
    var va = _threatSortValue(a, _threatSortCol);
    var vb = _threatSortValue(b, _threatSortCol);
    if (va < vb) return -1 * sortMul;
    if (va > vb) return 1 * sortMul;
    // Tiebreaker 1: count desc (threat strength)
    if (b.count !== a.count) return b.count - a.count;
    // Tiebreaker 2: golfer score asc
    var sa = (GOLFER_SCORES[a.name] && GOLFER_SCORES[a.name].score != null) ? GOLFER_SCORES[a.name].score : 99;
    var sb = (GOLFER_SCORES[b.name] && GOLFER_SCORES[b.name].score != null) ? GOLFER_SCORES[b.name].score : 99;
    return sa - sb;
  });

  // Strokes from the money — pool pays top 3, so gap vs. 3rd-place cutoff
  var PAY_RANK = 3;
  var cutoffEntry = ranked[PAY_RANK - 1]; // 3rd-place entry
  var inMoney = (myIdx < PAY_RANK);
  var strokesFromCash = null;
  if (cutoffEntry && !inMoney) {
    strokesFromCash = myRankedEntry.total - cutoffEntry.total;
  }

  // Build HTML
  var html = '';

  // --- Header card ---
  html += '<div class="threat-hdr-card">';
  // Current entry readout + Change button (collapses to compact row)
  var myPillIdx = -1;
  currentUserTeams.forEach(function(t, idx) {
    if (t.email === myEntry.email && t.team === myEntry.team) myPillIdx = idx;
  });
  var myPillColor = PILL_CLASSES[myPillIdx] || '';
  html += '<div class="threat-hdr-current">';
  html += '<div class="threat-hdr-team-solo">'
    + '<span class="threat-entry-dot ' + myPillColor + '"></span>'
    + escHtml(myEntry.team)
    + '</div>';
  if (currentUserTeams.length > 1) {
    html += '<button class="threat-hdr-change" onclick="toggleThreatPicker()">'
      + (_threatPickerOpen ? 'Close' : 'Change')
      + '</button>';
  }
  html += '</div>';
  // Entry picker — shown only when expanded
  if (currentUserTeams.length > 1 && _threatPickerOpen) {
    html += '<div class="threat-entry-picker">';
    currentUserTeams.forEach(function(t, idx) {
      var r = ranked.findIndex(function(e) { return e.email === t.email && e.team === t.team; });
      var rk = r >= 0 ? (r + 1) : '—';
      var isActive = (t.email === myEntry.email && t.team === myEntry.team);
      var pillColor = PILL_CLASSES[idx] || '';
      html += '<div class="threat-entry-pill' + (isActive ? ' active' : '') + '" onclick="selectThreatEntry(' + idx + ')">'
        + '<span class="threat-entry-dot ' + pillColor + '"></span>'
        + '<span class="threat-entry-rank">' + rk + '</span>'
        + '<span class="threat-entry-name">' + escHtml(t.team) + '</span>'
        + '</div>';
    });
    html += '</div>';
  }
  html += '<div class="threat-hdr-stats">';
  html += '<div class="threat-stat"><div class="threat-stat-v">' + aheadCount + '</div><div class="threat-stat-l">Ahead of you</div></div>';
  // Strokes from the money
  var cashV, cashCls;
  if (inMoney) {
    cashV = 'IN $';
    cashCls = 'pos';
  } else if (strokesFromCash == null) {
    cashV = '—';
    cashCls = '';
  } else {
    cashV = '+' + strokesFromCash;
    cashCls = 'neg';
  }
  html += '<div class="threat-stat"><div class="threat-stat-v ' + cashCls + '">' + cashV + '</div><div class="threat-stat-l">Strokes from $</div></div>';
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
    var _arrow = function(col) {
      if (_threatSortCol !== col) return '';
      return '<span class="threat-sort-arrow">' + (_threatSortDir === 'asc' ? '▲' : '▼') + '</span>';
    };
    var _act = function(col) { return _threatSortCol === col ? ' active' : ''; };
    html += '<div class="threat-col-hdr">';
    html += '<div class="threat-col-hdr-name threat-sortable' + _act('name') + '" onclick="setThreatSort(\'name\')">GOLFER' + _arrow('name') + '</div>';
    html += '<div class="threat-col-hdr-bar threat-sortable' + _act('count') + '" onclick="setThreatSort(\'count\')">ON TEAMS AHEAD' + _arrow('count') + '</div>';
    html += '<div class="threat-col-hdr-thru threat-sortable' + _act('thru') + '" onclick="setThreatSort(\'thru\')">THRU' + _arrow('thru') + '</div>';
    html += '<div class="threat-col-hdr-today threat-sortable' + _act('today') + '" onclick="setThreatSort(\'today\')">TODAY' + _arrow('today') + '</div>';
    html += '<div class="threat-col-hdr-tot threat-sortable' + _act('tot') + '" onclick="setThreatSort(\'tot\')">TOT' + _arrow('tot') + '</div>';
    html += '<div class="threat-col-hdr-t5 threat-sortable' + _act('t5') + '" onclick="setThreatSort(\'t5\')">TOP 5' + _arrow('t5') + '</div>';
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
