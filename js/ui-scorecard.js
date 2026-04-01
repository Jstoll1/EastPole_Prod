// ── Scorecard (hole-by-hole) ──

var _openScorecardIdx = null;

function showPickerPopup(owners, evt) {
  evt.stopPropagation();
  var existing = document.getElementById('picker-popup');
  if (existing) existing.remove();
  if (!owners || !owners.length) return;
  var popup = document.createElement('div');
  popup.id = 'picker-popup';
  popup.style.cssText = 'position:fixed;z-index:9999;background:var(--card);border:1px solid var(--gold);border-radius:10px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,0,0,.45);max-width:260px;min-width:200px;';
  var rect = evt.target.getBoundingClientRect();
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
  var html = '<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:8px;text-transform:uppercase;">Picked by</div>';
  owners.forEach(function(e) {
    var teamEsc = e.team.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;gap:12px;border-bottom:1px solid var(--border);cursor:pointer" onclick="event.stopPropagation();jumpToEntry(\'' + teamEsc + '\')">'
      + '<span style="font-size:12px;font-weight:600;color:var(--text)">' + e.name + '</span>'
      + '<span style="font-size:10px;color:var(--gold);text-align:right;white-space:nowrap;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px">' + e.team + ' →</span></div>';
  });
  popup.innerHTML = html;
  document.body.appendChild(popup);
  var dismiss = function(ev) {
    if (!popup.contains(ev.target)) {
      ev.stopPropagation();
      popup.remove();
      document.removeEventListener('click', dismiss, true);
    }
  };
  setTimeout(function() { document.addEventListener('click', dismiss, true); }, 0);
}

async function toggleScorecard(idx, playerName) {
  trackEvent('scorecard-open');
  var panel = document.getElementById('sc-panel-' + idx);
  if (!panel) return;
  if (_openScorecardIdx === idx) {
    panel.classList.remove('open');
    panel.innerHTML = '';
    _openScorecardIdx = null;
    return;
  }
  if (_openScorecardIdx !== null) {
    var prev = document.getElementById('sc-panel-' + _openScorecardIdx);
    if (prev) { prev.classList.remove('open'); prev.innerHTML = ''; }
  }
  _openScorecardIdx = idx;
  panel.innerHTML = '<div class="sc-loading">Loading scorecard…</div>';
  panel.classList.add('open');
  panel.onclick = function() { panel.classList.remove('open'); panel.innerHTML = ''; panel.onclick = null; _openScorecardIdx = null; };

  await Promise.all([fetchCourseHoles(), fetchPlayerScorecard(playerName)]);

  var rounds = SCORECARD_CACHE[playerName];
  var gd = GOLFER_SCORES[playerName];
  var ownEntry = OWNERSHIP_DATA.find(function(o) { return o.player === playerName; });
  var ownPct = ownEntry ? Math.round(ownEntry.pct * 100) : 0;
  var ownPctStr = ownPct + '% of entries';
  var ownOwners = ENTRIES.filter(function(e) { return e.picks.indexOf(playerName) !== -1; });

  function buildOwnBadge() {
    if (ownOwners.length > 0) return '<span class="own-badge-btn" style="font-size:10px;color:var(--gold);font-weight:600;margin-left:auto;white-space:nowrap;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;padding:4px 6px">' + ownPctStr + '</span>';
    return '<span style="font-size:10px;color:var(--text3);font-weight:600;margin-left:auto;white-space:nowrap">' + ownPctStr + '</span>';
  }
  function bindOwnBadge(container) {
    var btn = container.querySelector('.own-badge-btn');
    if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); showPickerPopup(ownOwners, e); });
  }

  // Fallback: round-level summary if no hole-by-hole data
  if (!rounds || !rounds.length || !rounds.some(function(r) { return r.holes && r.holes.length > 0; })) {
    var fbAid = ATHLETE_IDS[playerName];
    var fb = '<div class="sc-header">' + (fbAid ? '<img class="sc-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + fbAid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">' : '') + '<span class="sc-player-name">' + playerName + '</span>';
    if (gd) fb += '<span class="sc-player-pos">' + gd.pos + '</span>';
    fb += buildOwnBadge();
    fb += '</div><div style="padding:8px 12px 12px;">';
    var flag = FLAGS[playerName] || '';
    var cc = getCountryCode(playerName);
    if (flag || cc) fb += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">' + flag + ' ' + cc + '</div>';
    var pOdds = PRE_ODDS[playerName];
    if (pOdds) {
      fb += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;"><div style="font-size:9px;color:var(--text3);font-weight:700;">WIN</div><div style="font-size:14px;font-weight:800;color:var(--gold)">' + pOdds[0] + '</div></div>';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;"><div style="font-size:9px;color:var(--text3);font-weight:700;">TOP 5</div><div style="font-size:14px;font-weight:800;color:var(--gold)">' + pOdds[1] + '</div></div>';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;"><div style="font-size:9px;color:var(--text3);font-weight:700;">TOP 10</div><div style="font-size:14px;font-weight:800;color:var(--gold)">' + pOdds[2] + '</div></div>';
      fb += '</div>';
    }
    fb += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    var scTotal = gd ? fmt(gd.score) : '—';
    fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;">'
      + '<div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase;">Total</div>'
      + '<div style="font-size:18px;font-weight:900;" class="' + (gd ? cls(gd.score) : '') + '">' + scTotal + '</div></div>';
    [{ label:'R1', val:gd?.r1 },{ label:'R2', val:gd?.r2 },{ label:'R3', val:gd?.r3 },{ label:'R4', val:gd?.r4 }].filter(function(r) { return r.val != null; }).forEach(function(r) {
      var toPar = r.val - COURSE_PAR;
      var toParStr = toPar < 0 ? String(toPar) : toPar > 0 ? '+' + toPar : 'E';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;">'
        + '<div style="font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase;">' + r.label + '</div>'
        + '<div style="font-size:16px;font-weight:800;">' + r.val + '</div>'
        + '<div style="font-size:10px;font-weight:700;" class="' + (toPar < 0 ? 'neg' : toPar > 0 ? 'pos' : 'eve') + '">' + toParStr + '</div></div>';
    });
    fb += '</div>';
    if (gd?.thru && gd.thru !== '—') fb += '<div style="margin-top:8px;font-size:10px;color:var(--text3);">Thru ' + gd.thru + (gd.todayDisplay !== '—' ? ' · Today: ' + gd.todayDisplay : '') + '</div>';
    fb += '</div>';
    panel.innerHTML = fb;
    bindOwnBadge(panel);
    return;
  }

  var scAid = ATHLETE_IDS[playerName];
  var html = '<div class="sc-header">' + (scAid ? '<img class="sc-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + scAid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">' : '') + '<span class="sc-player-name">' + playerName + '</span>';
  if (gd) html += '<span class="sc-player-pos">' + gd.pos + '</span>';
  html += buildOwnBadge();
  html += '</div>';

  var completedRounds = rounds.map(function(r, i) { return { r: r, i: i }; }).filter(function(obj) { return obj.r.value != null && obj.r.value > 50; });
  if (completedRounds.length > 1) {
    html += '<div class="sc-round-summary">';
    html += completedRounds.map(function(obj) {
      var r = obj.r, i = obj.i;
      var dpC = '';
      if (r.displayValue) { dpC = r.displayValue.indexOf('-') === 0 ? 'color:var(--red)' : (r.displayValue === 'E' ? '' : 'color:var(--green-bright)'); }
      return '<span class="sc-round-chip">R' + (i + 1) + ': ' + r.value + (r.displayValue ? ' (<span style="' + dpC + '">' + r.displayValue + '</span>)' : '') + '</span>';
    }).join('<span class="sc-round-sep">|</span>');
    html += '</div>';
  }

  var roundsWithData = rounds.map(function(r, i) { return { round: r, idx: i }; }).filter(function(obj) { return obj.round.holes && obj.round.holes.length > 0; });
  var activeRound = roundsWithData.length ? roundsWithData[roundsWithData.length - 1] : null;
  if (activeRound) {
    var r = activeRound.round;
    var ri = activeRound.idx;
    var dpColor = '';
    if (r.displayValue) {
      if (r.displayValue.indexOf('-') === 0) dpColor = 'color:var(--red)';
      else if (r.displayValue === 'E') dpColor = '';
      else dpColor = 'color:var(--green-bright)';
    }
    if (completedRounds.length <= 1) {
      html += '<div class="sc-round-label">R' + (ri + 1) + (r.value ? ' — ' + r.value : '') + (r.displayValue ? ' (<span style="' + dpColor + '">' + r.displayValue + '</span>)' : '') + '</div>';
    }
    html += '<div class="sc-grid">';
    var holeMap = {};
    r.holes.forEach(function(h) { holeMap[h.hole] = h; });

    // Front 9
    html += '<div class="sc-nine">';
    html += '<div class="sc-nine-label">OUT</div>';
    html += '<div class="sc-row sc-row-hdr">';
    for (var hn = 1; hn <= 9; hn++) { html += '<div class="sc-cell">' + hn + '</div>'; }
    html += '</div>';
    html += '<div class="sc-row sc-row-score">';
    for (var hn = 1; hn <= 9; hn++) {
      var hd = holeMap[hn];
      var par = getHolePar(hn);
      var scCls = hd && hd.strokes ? scorecardClass(hd.strokes, par) : '';
      html += '<div class="sc-cell ' + scCls + '"><span class="sc-num">' + (hd && hd.strokes ? hd.strokes : '–') + '</span></div>';
    }
    html += '</div>';
    html += '</div>';

    // Back 9
    html += '<div class="sc-nine">';
    html += '<div class="sc-nine-label">IN</div>';
    html += '<div class="sc-row sc-row-hdr">';
    for (var hn = 10; hn <= 18; hn++) { html += '<div class="sc-cell">' + hn + '</div>'; }
    html += '</div>';
    html += '<div class="sc-row sc-row-score">';
    for (var hn = 10; hn <= 18; hn++) {
      var hd = holeMap[hn];
      var par = getHolePar(hn);
      var scCls = hd && hd.strokes ? scorecardClass(hd.strokes, par) : '';
      html += '<div class="sc-cell ' + scCls + '"><span class="sc-num">' + (hd && hd.strokes ? hd.strokes : '–') + '</span></div>';
    }
    html += '</div>';
    html += '</div>';

    html += '</div>';
  }

  panel.innerHTML = html;
  bindOwnBadge(panel);
}
