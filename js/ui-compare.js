// ── Head-to-Head (Compare Mode) ──

var compareMode = false;
var cmpSelections = [];

function openH2HPicker(targetIdx) {
  var existing = document.getElementById('h2h-picker');
  if (existing) existing.remove();
  var popup = document.createElement('div');
  popup.id = 'h2h-picker';
  popup.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--gold);border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);max-width:280px;width:85%;left:50%;top:50%;transform:translate(-50%,-50%);max-height:70vh;overflow-y:auto;';
  var targetTeam = ENTRIES[targetIdx].team;
  var html = '<div style="font-size:12px;font-weight:800;color:var(--gold);margin-bottom:10px;text-transform:uppercase;">Compare vs ' + targetTeam + '</div>';
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
        + '<span class="h2h-picker-team">' + e.team + '</span>'
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
    if (q && e.team.toLowerCase().indexOf(q) === -1 && e.name.toLowerCase().indexOf(q) === -1) return;
    html += '<div class="h2h-picker-row" onclick="selectH2H(' + idx + ',' + targetIdx + ')">'
      + '<span class="h2h-picker-rank">' + rk + '</span>'
      + '<span class="h2h-picker-team">' + e.team + '</span>'
      + '<span class="h2h-picker-score ' + cls(e.total) + '">' + fmtTeam(e.total) + '</span></div>';
  });
  return html || '<div style="font-size:11px;color:var(--text3);padding:8px 0;">No matches</div>';
}

function filterH2HPicker(targetIdx) {
  var q = document.getElementById('h2h-picker-search').value;
  document.getElementById('h2h-picker-list').innerHTML = buildH2HPickerList(targetIdx, q);
}

function selectH2H(myIdx, theirIdx) {
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
document.addEventListener('click', function(e) {
  if (!compareMode) return;
  var panel = document.getElementById('h2h-inline-panel');
  var list = document.getElementById('standings-list');
  var toggle = document.getElementById('cmp-toggle');
  if (panel && panel.contains(e.target)) return;
  if (list && list.contains(e.target)) return;
  if (toggle && toggle.contains(e.target)) return;
  exitCompareMode();
});

function cmpSelectTeam(entryIdx) {
  if (!compareMode) return;
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

  var html = '<div class="h2h-panel-wrap">';
  html += '<div class="h2h-close-bar"><button class="h2h-close-btn" onclick="exitCompareMode()">✕ Exit Compare</button></div>';
  html += '<div class="h2h-prob-wrap">';
  html += '<div class="h2h-prob-labels">';
  html += '<div class="h2h-prob-name left">' + cA.team + '</div>';
  html += '<div class="h2h-prob-name right">' + cB.team + '</div>';
  html += '</div>';
  html += '<div class="h2h-prob-pcts">';
  html += '<div class="h2h-prob-pct left' + (pctLeft < pctRight ? ' losing' : '') + '">' + pctLeft + '%</div>';
  html += '<div class="h2h-prob-pct right' + (pctRight < pctLeft ? ' losing' : '') + '">' + pctRight + '%</div>';
  html += '</div>';
  html += '<div class="h2h-bar-track">';
  html += '<div class="h2h-bar-half left"><div class="h2h-bar-fill" style="width:' + pctLeft + '%"></div></div>';
  html += '<div class="h2h-bar-half right"><div class="h2h-bar-fill" style="width:' + pctRight + '%"></div></div>';
  if (pctLeft > 12) html += '<span class="h2h-bar-label left">WIN</span>';
  if (pctRight > 12) html += '<span class="h2h-bar-label right">WIN</span>';
  html += '</div>';

  function teamRoundScore(top4) {
    var sum = 0, count = 0;
    top4.forEach(function(g) {
      var today = golferTodayScore(GOLFER_SCORES[g.name]);
      if (today === null) return;
      sum += today; count++;
    });
    return { sum: sum, count: count };
  }
  var rdA = teamRoundScore(cA.top4);
  var rdB = teamRoundScore(cB.top4);
  var fmtRd = function(v) { return v > 0 ? '+' + v : v === 0 ? 'E' : '' + v; };
  var holesA = cA.picks.reduce(function(s, p) { return s + getHolesRemaining(p); }, 0);
  var holesB = cB.picks.reduce(function(s, p) { return s + getHolesRemaining(p); }, 0);

  html += '<div class="h2h-score-summary">';
  html += '<div style="text-align:left"><div class="h2h-score-big ' + cls(cA.total) + '">' + fmtTeam(cA.total) + '</div><div class="h2h-score-lbl">Total · ' + holesA + 'h left</div>';
  if (rdA.count > 0) html += '<div style="font-size:11px;font-weight:700;margin-top:3px;color:' + (rdA.sum < 0 ? '#52b788' : rdA.sum > 0 ? '#ff7070' : 'var(--text2)') + '">Today: ' + fmtRd(rdA.sum) + '</div>';
  html += '</div>';
  if (cA.total === cB.total) {
    html += '<div class="h2h-tied-badge">TIED</div>';
  } else {
    var gap = Math.abs(cA.total - cB.total);
    html += '<div style="text-align:center;color:var(--text3);font-size:10px;font-weight:700">' + gap + ' stroke' + (gap > 1 ? 's' : '') + '</div>';
  }
  html += '<div style="text-align:right"><div class="h2h-score-big ' + cls(cB.total) + '">' + fmtTeam(cB.total) + '</div><div class="h2h-score-lbl">Total · ' + holesB + 'h left</div>';
  if (rdB.count > 0) html += '<div style="font-size:11px;font-weight:700;margin-top:3px;color:' + (rdB.sum < 0 ? '#52b788' : rdB.sum > 0 ? '#ff7070' : 'var(--text2)') + '">Today: ' + fmtRd(rdB.sum) + '</div>';
  html += '</div>';
  html += '</div>';

  function todayRelPar(top4) {
    var sum = 0, count = 0;
    top4.forEach(function(g) {
      var gd = GOLFER_SCORES[g.name];
      if (!gd) return;
      var today = golferTodayScore(gd);
      if (today === null) return;
      sum += today; count++;
    });
    return { sum: sum, count: count };
  }
  var momA = todayRelPar(cA.top4);
  var momB = todayRelPar(cB.top4);
  var totalHolesLeft = cA.picks.reduce(function(s, p) { return s + getHolesRemaining(p); }, 0) + cB.picks.reduce(function(s, p) { return s + getHolesRemaining(p); }, 0);
  if (totalHolesLeft > 0 && (momA.count > 0 || momB.count > 0)) {
    var fmtPar = function(v) { return v > 0 ? '+' + v : v === 0 ? 'E' : '' + v; };
    var momDiff = momA.sum - momB.sum;
    var momHtml = '';
    if (momDiff < 0) {
      momHtml = '<span style="color:#52b788">▲ ' + cA.team + '</span> gaining today <span style="color:var(--text2)">(' + fmtPar(momA.sum) + ' vs ' + fmtPar(momB.sum) + ')</span>';
    } else if (momDiff > 0) {
      momHtml = '<span style="color:#52b788">▲ ' + cB.team + '</span> gaining today <span style="color:var(--text2)">(' + fmtPar(momB.sum) + ' vs ' + fmtPar(momA.sum) + ')</span>';
    } else {
      momHtml = 'Even today <span style="color:var(--text2)">(' + fmtPar(momA.sum) + ' each)</span>';
    }
    html += '<div class="h2h-momentum">' + momHtml + '</div>';
  }
  html += '</div>';

  html += '<div class="h2h-matchups">';
  html += '<div class="h2h-vs-label" style="text-align:center">Head to Head</div>';
  html += '<div class="h2h-vs-hdr">';
  html += '<div class="h2h-vs-team left">' + cA.team + '</div>';
  html += '<div class="h2h-vs-team right">' + cB.team + '</div>';
  html += '</div>';
  var maxLen = Math.max(cA.scores.length, cB.scores.length);
  for (var r = 0; r < maxLen; r++) {
    var isTop = r < 4;
    var gA = cA.scores[r];
    var gB = cB.scores[r];
    html += '<div class="h2h-vs-row ' + (isTop ? 'is-top' : 'is-bench') + '">';
    html += buildH2HCell(gA, 'left', isTop);
    html += '<div class="h2h-vs-rank">' + (isTop ? '★' : (r + 1)) + '</div>';
    html += buildH2HCell(gB, 'right', isTop);
    html += '</div>';
  }
  html += '</div></div>';

  container.innerHTML = html;
}

function buildH2HCell(g, side, isTop) {
  if (!g) return '<div class="h2h-vs-cell ' + side + '"></div>';
  var gd = GOLFER_SCORES[g.name];
  var thru = gd ? gd.thru : '—';
  var isWD = thru === 'WD' || (gd && gd.score === 12);
  var mc = thru === 'MC';
  var holesLeft = getHolesRemaining(g.name);
  var todayScore = golferTodayScore(gd);
  var todayTag = '';
  if (todayScore !== null) {
    var todayFmt = todayScore > 0 ? '+' + todayScore : todayScore === 0 ? 'E' : '' + todayScore;
    var todayColor = todayScore < 0 ? '#52b788' : todayScore > 0 ? '#ff7070' : 'var(--text2)';
    todayTag = '<span style="color:' + todayColor + ';font-size:10px;font-weight:700">' + todayFmt + '</span>';
  }
  var statusTag = isWD ? '<span style="color:var(--red);font-size:9px">WD</span>' : mc ? '<span style="color:var(--red);font-size:9px">MC</span>' : (holesLeft > 0 ? '<span style="color:var(--text3);font-size:9px">' + holesLeft + 'h</span>' : '<span style="color:var(--text3);font-size:9px">F</span>');
  var html = '<div class="h2h-vs-cell ' + side + '">';
  html += '<div class="h2h-vs-score ' + cls(g.score) + '">' + fmt(g.score) + '</div>';
  html += '<div class="h2h-vs-info">';
  html += '<div class="h2h-vs-name">' + g.name + '</div>';
  html += '<div class="h2h-vs-meta" style="display:flex;gap:4px;align-items:center">' + (todayTag || '') + statusTag + '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}
