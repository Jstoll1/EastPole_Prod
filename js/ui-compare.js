// ── Head-to-Head (Compare Mode) ──

var compareMode = false;
var cmpSelections = [];
var _h2hMyIdx = null; // currently highlighted "my team" in the quick picker

function openH2HQuickPicker() {
  // Fallback: user has no entries — fall through to manual tap-two-teams flow.
  if (!currentUserTeams.length) {
    compareMode = true;
    cmpSelections = [];
    document.getElementById('cmp-toggle').classList.add('active');
    document.getElementById('cmp-hint').style.display = 'block';
    document.getElementById('cmp-hint').textContent = 'Tap two teams to compare';
    renderStandings();
    return;
  }
  // Pre-highlight the currently-active entry, or fall back to the first entry.
  var preselect = null;
  if (activeTeamIdx >= 0 && currentUserTeams[activeTeamIdx]) {
    preselect = currentUserTeams[activeTeamIdx];
  } else {
    preselect = currentUserTeams[0];
  }
  _h2hMyIdx = ENTRIES.findIndex(function(x) { return x.team === preselect.team && x.email === preselect.email; });
  renderH2HQuickPicker();
}

function renderH2HQuickPicker() {
  var existing = document.getElementById('h2h-picker');
  if (existing) existing.remove();
  var existingBd = document.getElementById('h2h-picker-backdrop');
  if (existingBd) existingBd.remove();

  var popup = document.createElement('div');
  popup.id = 'h2h-picker';
  popup.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);max-width:320px;width:90%;left:50%;top:50%;transform:translate(-50%,-50%);max-height:82vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;';

  var html = '';
  html += '<div style="font-size:13px;font-weight:800;color:var(--gold);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:center">⚔️ Head to Head</div>';

  // Section 1 — your entries
  html += '<div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Your Entry' + (currentUserTeams.length > 1 ? ' (tap to switch)' : '') + '</div>';
  var rnk = getRanked();
  var rnkMap = {}; var rk = 1;
  rnk.forEach(function(re, ri) { if (ri > 0 && rnk[ri].total !== rnk[ri-1].total) rk = ri + 1; rnkMap[re.team + '|' + re.email] = rk; });
  currentUserTeams.forEach(function(e) {
    var idx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
    var c = calcEntry(e);
    var myRk = rnkMap[e.team + '|' + e.email] || '';
    var isSelected = idx === _h2hMyIdx;
    var selStyle = isSelected ? 'border:1.5px solid var(--gold);background:rgba(212,168,67,0.12);' : 'border:1px solid transparent;';
    html += '<div class="h2h-picker-row" style="' + selStyle + '" onclick="h2hSetMine(' + idx + ')">'
      + '<span class="h2h-picker-rank">' + myRk + '</span>'
      + '<span class="h2h-picker-team">' + escHtml(e.team) + '</span>'
      + '<span class="h2h-picker-score ' + cls(c.total) + '">' + fmtTeam(c.total) + '</span></div>';
  });

  html += '<div style="height:1px;background:var(--border);margin:12px 0;"></div>';

  // Section 2 — search opponent
  html += '<div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">vs. Opponent</div>';
  html += '<input id="h2h-picker-search" type="text" placeholder="Search team or name…" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;margin-bottom:8px;outline:none;" oninput="filterH2HQuickList()">';
  html += '<div id="h2h-picker-list">';
  html += buildH2HOpponentList(_h2hMyIdx, '');
  html += '</div>';

  popup.innerHTML = html;
  document.body.appendChild(popup);

  var backdrop = document.createElement('div');
  backdrop.id = 'h2h-picker-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.4);';
  backdrop.onclick = closeH2HQuickPicker;
  document.body.appendChild(backdrop);
}

function buildH2HOpponentList(myIdx, query) {
  var ranked = getRanked();
  var q = (query || '').toLowerCase();
  var html = '';
  var rk = 1;
  ranked.forEach(function(e, i) {
    if (i > 0 && ranked[i].total !== ranked[i-1].total) rk = i + 1;
    var idx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
    if (idx === myIdx) return;
    if (q && e.team.toLowerCase().indexOf(q) === -1 && (e.entrant || '').toLowerCase().indexOf(q) === -1) return;
    html += '<div class="h2h-picker-row" onclick="selectH2H(' + myIdx + ',' + idx + ')">'
      + '<span class="h2h-picker-rank">' + rk + '</span>'
      + '<span class="h2h-picker-team">' + escHtml(e.team) + '</span>'
      + '<span class="h2h-picker-score ' + cls(e.total) + '">' + fmtTeam(e.total) + '</span></div>';
  });
  return html || '<div style="font-size:11px;color:var(--text3);padding:8px 0;text-align:center">No matches</div>';
}

function h2hSetMine(idx) {
  _h2hMyIdx = idx;
  renderH2HQuickPicker();
}

function filterH2HQuickList() {
  var q = document.getElementById('h2h-picker-search').value;
  document.getElementById('h2h-picker-list').innerHTML = buildH2HOpponentList(_h2hMyIdx, q);
}

function closeH2HQuickPicker() {
  var popup = document.getElementById('h2h-picker');
  var backdrop = document.getElementById('h2h-picker-backdrop');
  if (popup) popup.remove();
  if (backdrop) backdrop.remove();
}

function openH2HPicker(targetIdx) {
  var existing = document.getElementById('h2h-picker');
  if (existing) existing.remove();
  var popup = document.createElement('div');
  popup.id = 'h2h-picker';
  popup.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);max-width:280px;width:85%;left:50%;top:50%;transform:translate(-50%,-50%);max-height:70vh;overflow-y:auto;';
  var targetTeam = ENTRIES[targetIdx].team;
  var html = '<div style="font-size:12px;font-weight:800;color:var(--gold);margin-bottom:10px;text-transform:uppercase;">Compare vs ' + escHtml(targetTeam) + '</div>';
  if (currentUserTeams.length > 0) {
    var rnk = getRanked();
    var rnkMap = {}; var rk = 1;
    rnk.forEach(function(re, ri) { if (ri > 0 && rnk[ri].total !== rnk[ri-1].total) rk = ri + 1; rnkMap[re.team + '|' + re.email] = rk; });
    html += '<div style="font-size:9px;font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase;">Your Entries</div>';
    currentUserTeams.forEach(function(e) {
      var idx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
      if (idx === targetIdx) return;
      var c = calcEntry(e);
      var myRk = rnkMap[e.team + '|' + e.email] || '';
      html += '<div class="h2h-picker-row" onclick="selectH2H(' + idx + ',' + targetIdx + ')">'
        + '<span class="h2h-picker-rank">' + myRk + '</span>'
        + '<span class="h2h-picker-team">' + escHtml(e.team) + '</span>'
        + '<span class="h2h-picker-score ' + cls(c.total) + '">' + fmtTeam(c.total) + '</span></div>';
    });
    html += '<div style="height:1px;background:var(--border);margin:8px 0;"></div>';
  }
  html += '<div style="font-size:9px;font-weight:700;color:var(--text3);margin-bottom:4px;text-transform:uppercase;">All Entries</div>';
  html += '<input id="h2h-picker-search" type="text" placeholder="Search team or name..." style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;margin-bottom:8px;outline:none;" oninput="filterH2HPicker(' + targetIdx + ')">';
  html += '<div id="h2h-picker-list">';
  html += buildH2HPickerList(targetIdx, '');
  html += '</div>';
  popup.innerHTML = html;
  document.body.appendChild(popup);
  var backdrop = document.createElement('div');
  backdrop.id = 'h2h-picker-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.4);';
  backdrop.onclick = function() { popup.remove(); backdrop.remove(); };
  document.body.appendChild(backdrop);
}

function buildH2HPickerList(targetIdx, query) {
  var ranked = getRanked();
  var q = query.toLowerCase();
  var html = '';
  var rk = 1;
  ranked.forEach(function(e, i) {
    if (i > 0 && ranked[i].total !== ranked[i-1].total) rk = i + 1;
    var idx = ENTRIES.findIndex(function(x) { return x.team === e.team && x.email === e.email; });
    if (idx === targetIdx) return;
    if (q && e.team.toLowerCase().indexOf(q) === -1 && (e.entrant || '').toLowerCase().indexOf(q) === -1) return;
    html += '<div class="h2h-picker-row" onclick="selectH2H(' + idx + ',' + targetIdx + ')">'
      + '<span class="h2h-picker-rank">' + rk + '</span>'
      + '<span class="h2h-picker-team">' + escHtml(e.team) + '</span>'
      + '<span class="h2h-picker-score ' + cls(e.total) + '">' + fmtTeam(e.total) + '</span></div>';
  });
  return html || '<div style="font-size:11px;color:var(--text3);padding:8px 0;">No matches</div>';
}

function filterH2HPicker(targetIdx) {
  var q = document.getElementById('h2h-picker-search').value;
  document.getElementById('h2h-picker-list').innerHTML = buildH2HPickerList(targetIdx, q);
}

function selectH2H(myIdx, theirIdx) {
  _cmpClickLock = true;
  trackEvent('h2h-compare');
  var popup = document.getElementById('h2h-picker');
  var backdrop = document.getElementById('h2h-picker-backdrop');
  if (popup) popup.remove();
  if (backdrop) backdrop.remove();
  compareMode = true;
  cmpSelections = [myIdx, theirIdx];
  document.getElementById('cmp-toggle').classList.add('active');
  document.getElementById('cmp-hint').style.display = 'none';
  renderStandings();
  renderH2HInline();
  setTimeout(function() {
    var panel = document.getElementById('h2h-inline-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function toggleCompareMode() {
  _cmpClickLock = true;
  // If entering compare mode and user has entries, open the quick picker instead
  // of the manual tap-two-teams flow (easier with 149-entry standings).
  if (!compareMode && currentUserTeams.length > 0) {
    openH2HQuickPicker();
    return;
  }
  compareMode = !compareMode;
  cmpSelections = [];
  document.getElementById('cmp-toggle').classList.toggle('active', compareMode);
  document.getElementById('cmp-hint').style.display = compareMode ? 'block' : 'none';
  document.getElementById('h2h-inline-panel').innerHTML = '';
  renderStandings();
}

function exitCompareMode() {
  compareMode = false;
  cmpSelections = [];
  document.getElementById('cmp-toggle').classList.remove('active');
  document.getElementById('cmp-hint').style.display = 'none';
  document.getElementById('h2h-inline-panel').innerHTML = '';
  renderStandings();
}

// Click outside H2H panel or standings list closes compare mode
// Use a flag to prevent the click-outside handler from firing on the
// same click that triggered a selection (since renderStandings removes
// the clicked element from the DOM, making contains() return false).
var _cmpClickLock = false;
document.addEventListener('click', function(e) {
  if (!compareMode) return;
  if (_cmpClickLock) { _cmpClickLock = false; return; }
  var panel = document.getElementById('h2h-inline-panel');
  var list = document.getElementById('standings-list');
  var toggle = document.getElementById('cmp-toggle');
  var picker = document.getElementById('h2h-picker');
  var backdrop = document.getElementById('h2h-picker-backdrop');
  var hint = document.getElementById('cmp-hint');
  if (panel && panel.contains(e.target)) return;
  if (list && list.contains(e.target)) return;
  if (toggle && toggle.contains(e.target)) return;
  if (picker && picker.contains(e.target)) return;
  if (backdrop && backdrop.contains(e.target)) return;
  if (hint && hint.contains(e.target)) return;
  exitCompareMode();
});

function cmpSelectTeam(entryIdx) {
  if (!compareMode) return;
  _cmpClickLock = true;
  var pos = cmpSelections.indexOf(entryIdx);
  if (pos >= 0) {
    cmpSelections.splice(pos, 1);
    document.getElementById('h2h-inline-panel').innerHTML = '';
    document.getElementById('cmp-hint').style.display = 'block';
    document.getElementById('cmp-hint').textContent = cmpSelections.length === 0 ? 'Tap two teams to compare' : 'Tap one more team';
    renderStandings();
    return;
  }
  if (cmpSelections.length >= 2) {
    cmpSelections[1] = entryIdx;
  } else {
    cmpSelections.push(entryIdx);
  }
  renderStandings();
  if (cmpSelections.length === 2) {
    document.getElementById('cmp-hint').style.display = 'none';
    renderH2HInline();
    setTimeout(function() {
      var panel = document.getElementById('h2h-inline-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  } else {
    document.getElementById('cmp-hint').style.display = 'block';
    document.getElementById('cmp-hint').textContent = 'Tap one more team';
    document.getElementById('h2h-inline-panel').innerHTML = '';
  }
}

function renderH2HInline() {
  var container = document.getElementById('h2h-inline-panel');
  if (!container || cmpSelections.length < 2) { if (container) container.innerHTML = ''; return; }

  var entryA = ENTRIES[cmpSelections[0]];
  var entryB = ENTRIES[cmpSelections[1]];
  var cA = calcEntry(entryA);
  var cB = calcEntry(entryB);
  var prob = calcWinProbability(entryA, entryB);
  var pctLeft = prob.pctA;
  var pctRight = prob.pctB;
  var leftLeads = cA.total < cB.total;
  var rightLeads = cB.total < cA.total;

  function teamToday(top4) {
    var sum = 0, count = 0;
    top4.forEach(function(g) {
      var gd = GOLFER_SCORES[g.name];
      if (!gd || gd.score === 11 || gd.score === 12) return;
      var td = gd.todayDisplay;
      if (!td || td === '—') return;
      sum += td === 'E' ? 0 : (parseInt(td.replace('+', ''), 10) || 0);
      count++;
    });
    return count > 0 ? sum : null;
  }
  function teamHoles(top4) {
    return top4.reduce(function(s, g) { return s + getHolesRemaining(g.name); }, 0);
  }
  var todayA = teamToday(cA.top4);
  var todayB = teamToday(cB.top4);
  var holesA = teamHoles(cA.top4);
  var holesB = teamHoles(cB.top4);
  var gap = Math.abs(cA.total - cB.total);
  var gapText = cA.total === cB.total ? 'TIED' : gap + ' stroke' + (gap > 1 ? 's' : '');
  var fmtT = function(v) { return v == null ? '—' : v > 0 ? '+' + v : v === 0 ? 'E' : '' + v; };
  var todayClsFor = function(v) { return v == null ? 'eve' : v < 0 ? 'neg' : v > 0 ? 'pos' : 'eve'; };

  var picksASet = new Set(entryA.picks);
  var sharedSet = new Set(entryB.picks.filter(function(p) { return picksASet.has(p); }));

  var html = '<div class="h2h-panel-wrap">';
  html += '<div class="h2h-close-bar"><button class="h2h-close-btn" onclick="exitCompareMode()">✕ Exit Compare</button></div>';

  // --- HERO WIN BAR ---
  html += '<div class="h2h-prob-wrap">';
  html += '<div class="h2h-prob-labels">';
  html += '<div class="h2h-prob-name left' + (leftLeads ? ' leader' : '') + '">' + (leftLeads ? '<span class="h2h-crown">👑</span> ' : '') + escHtml(cA.team) + '</div>';
  html += '<div class="h2h-prob-name right' + (rightLeads ? ' leader' : '') + '">' + escHtml(cB.team) + (rightLeads ? ' <span class="h2h-crown">👑</span>' : '') + '</div>';
  html += '</div>';
  html += '<div class="h2h-prob-pcts">';
  html += '<div class="h2h-prob-pct left' + (pctLeft < pctRight ? ' losing' : '') + '">' + pctLeft + '%</div>';
  html += '<div class="h2h-prob-gap">' + gapText + '</div>';
  html += '<div class="h2h-prob-pct right' + (pctRight < pctLeft ? ' losing' : '') + '">' + pctRight + '%</div>';
  html += '</div>';
  html += '<div class="h2h-bar-track">';
  html += '<div class="h2h-bar-half left"><div class="h2h-bar-fill" style="width:' + pctLeft + '%"></div></div>';
  html += '<div class="h2h-bar-half right"><div class="h2h-bar-fill" style="width:' + pctRight + '%"></div></div>';
  html += '</div>';
  html += '</div>';

  // --- STAT BLOCKS ---
  html += '<div class="h2h-stats">';
  ['A', 'B'].forEach(function(side) {
    var c = side === 'A' ? cA : cB;
    var today = side === 'A' ? todayA : todayB;
    var holes = side === 'A' ? holesA : holesB;
    var leads = side === 'A' ? leftLeads : rightLeads;
    html += '<div class="h2h-stat-block' + (side === 'B' ? ' right' : '') + (leads ? ' leader' : '') + '">';
    html += '<div class="h2h-stat-tot ' + cls(c.total) + '">' + fmtTeam(c.total) + '</div>';
    html += '<div class="h2h-stat-row"><span class="lbl">Today</span><span class="val ' + todayClsFor(today) + '">' + fmtT(today) + '</span></div>';
    html += '<div class="h2h-stat-row"><span class="lbl">Holes left</span><span class="val">' + holes + '</span></div>';
    html += '</div>';
  });
  html += '</div>';

  // --- PICKS: shared first, then unique side-by-side ---
  function pickFields(g) {
    var gd = GOLFER_SCORES[g.name];
    var flag = FLAGS[g.name] || '';
    var isMc = g.score === 11 || g.score === 12;
    var todayRaw = gd ? gd.todayDisplay : null;
    var todayScore = (!todayRaw || todayRaw === '—') ? null : (todayRaw === 'E' ? 0 : parseInt(todayRaw.replace('+', ''), 10) || 0);
    var todayDisp = todayScore == null ? '' : (todayScore > 0 ? '+' + todayScore : todayScore === 0 ? 'E' : '' + todayScore);
    var todayCl = todayScore == null ? '' : todayScore < 0 ? 'pos' : todayScore > 0 ? 'neg' : '';
    var holes = getHolesRemaining(g.name);
    var holesDisp = isMc ? '—' : holes > 0 ? holes + 'h' : 'F';
    return {
      flag: flag,
      lastName: g.name.split(' ').slice(-1)[0],
      tot: isMc ? (g.score === 12 ? 'WD' : 'MC') : fmt(g.score),
      totCl: isMc ? 'mc' : cls(g.score),
      today: todayDisp, todayCl: todayCl,
      holes: holesDisp,
      score: g.score
    };
  }
  function pickRowHtml(r) {
    return '<span class="hp-flag">' + r.flag + '</span>'
      + '<span class="hp-name">' + escHtml(r.lastName) + '</span>'
      + '<span class="hp-tot ' + r.totCl + '">' + r.tot + '</span>'
      + '<span class="hp-today ' + r.todayCl + '">' + r.today + '</span>'
      + '<span class="hp-holes">' + r.holes + '</span>';
  }

  // Shared picks
  var sharedList = Array.from(sharedSet).map(function(name) {
    var g = cA.scores.find(function(x) { return x.name === name; });
    return g ? pickFields(g) : null;
  }).filter(Boolean).sort(function(a, b) { return a.score - b.score; });
  if (sharedList.length > 0) {
    html += '<div class="h2h-section">';
    html += '<div class="h2h-section-hdr">Shared picks (' + sharedList.length + ')</div>';
    sharedList.forEach(function(r) {
      html += '<div class="h2h-shared-row">' + pickRowHtml(r) + '</div>';
    });
    html += '</div>';
  }

  // Unique picks — paired side-by-side
  var uniqueA = cA.scores.filter(function(g) { return !sharedSet.has(g.name); });
  var uniqueB = cB.scores.filter(function(g) { return !sharedSet.has(g.name); });
  if (uniqueA.length > 0 || uniqueB.length > 0) {
    html += '<div class="h2h-section">';
    html += '<div class="h2h-section-hdr">Unique picks</div>';
    html += '<div class="h2h-unique-hdr"><div class="left">' + escHtml(cA.team) + '</div><div class="right">' + escHtml(cB.team) + '</div></div>';
    var rows = Math.max(uniqueA.length, uniqueB.length);
    var topA = new Set(cA.top4.map(function(g) { return g.name; }));
    var topB = new Set(cB.top4.map(function(g) { return g.name; }));
    for (var i = 0; i < rows; i++) {
      var gA = uniqueA[i];
      var gB = uniqueB[i];
      html += '<div class="h2h-unique-row">';
      if (gA) {
        var rA = pickFields(gA);
        html += '<div class="h2h-unique-cell left' + (topA.has(gA.name) ? ' is-top' : '') + '">' + pickRowHtml(rA) + '</div>';
      } else {
        html += '<div class="h2h-unique-cell left empty"></div>';
      }
      if (gB) {
        var rB = pickFields(gB);
        html += '<div class="h2h-unique-cell right' + (topB.has(gB.name) ? ' is-top' : '') + '">' + pickRowHtml(rB) + '</div>';
      } else {
        html += '<div class="h2h-unique-cell right empty"></div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

// Middle-column row diff: who wins this slot and by how many strokes?
function buildH2HRowDiff(gA, gB) {
  if (!gA || !gB) return '<div class="h2h-vs-rank"></div>';
  var diff = gA.score - gB.score;
  if (diff === 0) return '<div class="h2h-vs-rank tied">=</div>';
  if (diff < 0) {
    return '<div class="h2h-vs-rank left-wins"><span class="rank-arrow">◀</span>' + Math.abs(diff) + '</div>';
  }
  return '<div class="h2h-vs-rank right-wins">' + diff + '<span class="rank-arrow">▶</span></div>';
}

function buildH2HCell(g, side, isTop, ctx) {
  if (!g) return '<div class="h2h-vs-cell ' + side + '"></div>';
  ctx = ctx || {};
  var gd = GOLFER_SCORES[g.name];
  var thru = gd ? gd.thru : '—';
  var isWD = thru === 'WD' || (gd && gd.score === 12);
  var mc = thru === 'MC';
  var holesLeft = getHolesRemaining(g.name);
  var todayRaw = gd ? gd.todayDisplay : null;
  var todayScore = (!todayRaw || todayRaw === '—') ? null : (todayRaw === 'E' ? 0 : parseInt(todayRaw.replace('+', '')) || 0);
  var todayTag = '';
  if (todayScore !== null) {
    var todayFmt = todayScore > 0 ? '+' + todayScore : todayScore === 0 ? 'E' : '' + todayScore;
    var todayColor = todayScore < 0 ? '#52b788' : todayScore > 0 ? '#ff7070' : 'var(--text2)';
    todayTag = '<span style="color:' + todayColor + ';font-size:10px;font-weight:700">' + todayFmt + '</span>';
  }
  var statusTag = isWD ? '<span style="color:var(--red);font-size:9px">WD</span>' : mc ? '<span style="color:var(--red);font-size:9px">MC</span>' : (ROUND_START_ROUND >= 4 ? (holesLeft > 0 ? '<span style="color:var(--text3);font-size:9px">' + holesLeft + 'h</span>' : '<span style="color:var(--text3);font-size:9px">F</span>') : '');

  var isShared = ctx.sharedSet && ctx.sharedSet.has(g.name);
  var isBest = isTop && ctx.bestName === g.name;
  var isWorst = isTop && ctx.worstName === g.name;
  var flag = FLAGS[g.name] || '';
  var badge = isBest ? '<span class="h2h-vs-badge fire" title="Top contributor">🔥</span>' : (isWorst ? '<span class="h2h-vs-badge ice" title="Dragging the team">❄️</span>' : '');
  var sharedTag = isShared ? '<span class="h2h-vs-shared" title="Both teams picked">⛓</span>' : '';
  var flagSpan = flag ? '<span class="h2h-vs-flag">' + flag + '</span>' : '';
  var nameHtml = side === 'left'
    ? badge + flagSpan + '<span class="h2h-vs-pname">' + escHtml(g.name) + '</span>'
    : '<span class="h2h-vs-pname">' + escHtml(g.name) + '</span>' + flagSpan + badge;

  var html = '<div class="h2h-vs-cell ' + side + (isShared ? ' shared' : '') + '">';
  html += '<div class="h2h-vs-score ' + cls(g.score) + '">' + fmt(g.score) + '</div>';
  html += '<div class="h2h-vs-info">';
  html += '<div class="h2h-vs-name">' + nameHtml + '</div>';
  html += '<div class="h2h-vs-meta" style="display:flex;gap:4px;align-items:center">' + (todayTag || '') + statusTag + sharedTag + '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}
