// ── Scorecard (hole-by-hole) ──

var _openScorecardIdx = null;

function buildDGLiveRow(playerName) {
  var dg = DG_LIVE_PREDS[playerName];
  if (!dg) return '';
  var items = [
    { label: 'Make Cut', val: dg.make_cut },
    { label: 'Top 20',   val: dg.top_20 },
    { label: 'Top 5',    val: dg.top_5 },
    { label: 'Win',      val: dg.win }
  ];
  var html = '<div class="dg-live-row">';
  items.forEach(function(it) {
    var pct = (it.val * 100);
    var disp = pct >= 1 ? pct.toFixed(1) + '%' : pct > 0 ? '<1%' : '—';
    // Color intensity: 0→dim, 1→bright gold
    var intensity = Math.min(it.val * 1.8, 1);
    var color = intensity > 0.5 ? 'var(--gold)' : intensity > 0.15 ? 'var(--text2)' : 'var(--text3)';
    var weight = intensity > 0.3 ? '800' : '700';
    html += '<div class="dg-live-box">'
      + '<div class="dg-live-lbl">' + it.label + '</div>'
      + '<div class="dg-live-val" style="color:' + color + ';font-weight:' + weight + '">' + disp + '</div>'
      + '</div>';
  });
  html += '</div>';
  return html;
}

async function toggleScorecard(idx, playerName) {
  trackEvent('scorecard-open');
  trackEvent('scorecard-' + playerName.toLowerCase().replace(/\s+/g, '-'));
  var panel = document.getElementById('sc-panel-' + idx);
  if (!panel) return;
  if (_openScorecardIdx === idx) {
    panel.classList.remove('open');
    panel.innerHTML = '';
    _openScorecardIdx = null;
    if (_pendingLbRender) renderLeaderboard();
    return;
  }
  if (_openScorecardIdx !== null) {
    var prev = document.getElementById('sc-panel-' + _openScorecardIdx);
    if (prev) { prev.classList.remove('open'); prev.innerHTML = ''; }
    _openScorecardIdx = null;
    if (_pendingLbRender) renderLeaderboard();
    return;
  }
  _openScorecardIdx = idx;
  var escapedName = playerName.replace(/'/g, "\\'");
  panel.innerHTML = '<div class="sc-loading">Loading scorecard…</div>';
  panel.classList.add('open');

  delete SCORECARD_CACHE[playerName];
  await Promise.all([fetchCourseHoles(), fetchPlayerScorecard(playerName)]);

  var rounds = SCORECARD_CACHE[playerName];
  var gd = GOLFER_SCORES[playerName];

  // Fallback: round-level summary if no hole-by-hole data
  if (!rounds || !rounds.length || !rounds.some(function(r) { return r.holes && r.holes.length > 0; })) {
    var fbAid = ATHLETE_IDS[playerName];
    var fb = '<div class="sc-header">' + (fbAid ? '<img class="sc-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + fbAid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">' : '') + '<span class="sc-player-name">' + playerName + '</span>';
    fb += emojiButtonHtml(escapedName);
    if (gd) fb += '<span class="sc-player-pos">' + gd.pos + '</span>';
    fb += '</div><div style="padding:8px 12px 12px;">';
    var flag = FLAGS[playerName] || '';
    var cc = getCountryCode(playerName);
    if (flag || cc) fb += '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">' + flag + ' ' + cc + '</div>';
    fb += buildDGLiveRow(playerName);
    var pOdds = PRE_ODDS[playerName];
    if (pOdds) {
      fb += '<div style="display:flex;gap:8px;margin-bottom:10px;">';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;"><div style="font-size:9px;color:var(--text3);font-weight:700;">WIN</div><div style="font-size:14px;font-weight:800;color:var(--gold)">' + pOdds[0] + '</div></div>';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;"><div style="font-size:9px;color:var(--text3);font-weight:700;">TOP 5</div><div style="font-size:14px;font-weight:800;color:var(--gold)">' + pOdds[1] + '</div></div>';
      fb += '<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;"><div style="font-size:9px;color:var(--text3);font-weight:700;">TOP 10</div><div style="font-size:14px;font-weight:800;color:var(--gold)">' + pOdds[2] + '</div></div>';
      fb += '</div>';
    }
    // Uniform chip format — LABEL on top, colored to-par on bottom, same
    // sizing across TOT/R1-R4/TDY so the row reads consistently.
    var _chip = 'background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center;min-width:60px;';
    var _chipLbl = 'font-size:9px;color:var(--text3);font-weight:700;text-transform:uppercase;';
    var _chipVal = 'font-size:18px;font-weight:900;';
    fb += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    fb += '<div style="' + _chip + '">'
      + '<div style="' + _chipLbl + '">Total</div>'
      + '<div style="' + _chipVal + '" class="' + (gd ? cls(gd.score) : '') + '">' + (gd ? fmt(gd.score) : '—') + '</div></div>';
    [{ label:'R1', val:gd?.r1 },{ label:'R2', val:gd?.r2 },{ label:'R3', val:gd?.r3 },{ label:'R4', val:gd?.r4 }].filter(function(r) { return r.val != null; }).forEach(function(r) {
      var toPar = r.val - COURSE_PAR;
      fb += '<div style="' + _chip + '">'
        + '<div style="' + _chipLbl + '">' + r.label + '</div>'
        + '<div style="' + _chipVal + '" class="' + (toPar < 0 ? 'neg' : toPar > 0 ? 'pos' : 'eve') + '">' + fmtTeam(toPar) + '</div></div>';
    });
    if (gd && gd.todayDisplay && gd.todayDisplay !== '—') {
      var _tdy = gd.todayDisplay === 'E' ? 0 : parseInt(gd.todayDisplay.replace('+','')) || 0;
      fb += '<div style="' + _chip + '">'
        + '<div style="' + _chipLbl + '">TDY</div>'
        + '<div style="' + _chipVal + '" class="' + cls(_tdy) + '">' + gd.todayDisplay + '</div></div>';
    }
    fb += '</div>';
    if (gd?.thru && gd.thru !== '—') fb += '<div style="margin-top:8px;font-size:10px;color:var(--text3);">Thru ' + gd.thru + (gd.todayDisplay !== '—' ? ' · Today: ' + gd.todayDisplay : '') + '</div>';
    fb += '</div>';
    panel.innerHTML = fb;
    return;
  }

  var scAid = ATHLETE_IDS[playerName];
  var html = '<div class="sc-header">' + (scAid ? '<img class="sc-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + scAid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">' : '') + '<span class="sc-player-name">' + playerName + '</span>';
  html += emojiButtonHtml(escapedName);
  if (gd) html += '<span class="sc-player-pos">' + gd.pos + '</span>';
  html += '</div>';
  html += buildDGLiveRow(playerName);

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
}


// Standalone scorecard popup (used from activity feed)
async function openScorecardPopup(playerName) {
  var existing = document.getElementById('sc-popup-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'sc-popup-overlay';
  overlay.className = 'sc-popup-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var wrap = document.createElement('div');
  wrap.className = 'sc-popup-wrap';
  wrap.innerHTML = '<div class="sc-loading">Loading scorecard…</div>';
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);

  // Swipe down to close
  var _sY = 0, _cY = 0, _dragging = false;
  wrap.addEventListener('touchstart', function(e) {
    if (wrap.scrollTop > 0) return;
    _sY = e.touches[0].clientY; _cY = _sY; _dragging = true;
    wrap.style.transition = 'none';
  }, { passive: true });
  wrap.addEventListener('touchmove', function(e) {
    if (!_dragging) return;
    _cY = e.touches[0].clientY;
    var dy = _cY - _sY;
    if (dy > 0) { wrap.style.transform = 'translateY(' + dy + 'px)'; wrap.style.opacity = Math.max(0.3, 1 - dy / 300); e.preventDefault(); }
  }, { passive: false });
  wrap.addEventListener('touchend', function() {
    if (!_dragging) return;
    _dragging = false;
    wrap.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    if (_cY - _sY > 80) { overlay.remove(); } else { wrap.style.transform = ''; wrap.style.opacity = ''; }
  });

  delete SCORECARD_CACHE[playerName];
  await Promise.all([fetchCourseHoles(), fetchPlayerScorecard(playerName)]);

  var rounds = SCORECARD_CACHE[playerName];
  var gd = GOLFER_SCORES[playerName];
  var flag = FLAGS[playerName] || '';
  var aid = ATHLETE_IDS[playerName];

  var html = '<div class="sc-popup-close" onclick="document.getElementById(\'sc-popup-overlay\').remove()">✕</div>';
  var escapedForEmoji = playerName.replace(/'/g, "\\'");
  html += '<div class="sc-header">'
    + (aid ? '<img class="sc-headshot" src="https://a.espncdn.com/combiner/i?img=/i/headshots/golf/players/full/' + aid + '.png&w=80&h=58" onerror="this.style.display=\'none\'">' : '')
    + '<span class="sc-player-name">' + flag + ' ' + playerName + '</span>';
  html += emojiButtonHtml(escapedForEmoji);
  if (gd) html += '<span class="sc-player-pos">' + gd.pos + '</span>';
  html += '</div>';

  // DataGolf live predictions
  html += buildDGLiveRow(playerName);

  // Score summary
  if (gd) {
    html += '<div style="display:flex;gap:6px;padding:6px 12px;flex-wrap:wrap">';
    html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px 10px;text-align:center;min-width:50px">'
      + '<div style="font-size:8px;color:var(--text3);font-weight:700">TOTAL</div>'
      + '<div style="font-size:16px;font-weight:900" class="' + cls(gd.score) + '">' + fmt(gd.score) + '</div></div>';
    [{ l:'R1', v:gd.r1 },{ l:'R2', v:gd.r2 },{ l:'R3', v:gd.r3 },{ l:'R4', v:gd.r4 }].filter(function(r){ return r.v != null; }).forEach(function(r) {
      var tp = r.v - COURSE_PAR;
      html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px 10px;text-align:center;min-width:40px">'
        + '<div style="font-size:8px;color:var(--text3);font-weight:700">' + r.l + '</div>'
        + '<div style="font-size:14px;font-weight:800">' + r.v + '</div>'
        + '<div style="font-size:9px;font-weight:700" class="' + (tp<0?'neg':tp>0?'pos':'eve') + '">' + (tp<0?''+tp:tp>0?'+'+tp:'E') + '</div></div>';
    });
    if (gd.thru && gd.thru !== '—') html += '<div style="align-self:center;font-size:10px;color:var(--text3);margin-left:auto">Thru ' + gd.thru + (gd.todayDisplay !== '—' ? ' · Today: ' + gd.todayDisplay : '') + '</div>';
    html += '</div>';
  }

  // Hole-by-hole grid
  if (rounds && rounds.length) {
    var roundsWithData = rounds.map(function(r, i) { return { round: r, idx: i }; }).filter(function(obj) { return obj.round.holes && obj.round.holes.length > 0; });
    var activeRound = roundsWithData.length ? roundsWithData[roundsWithData.length - 1] : null;
    if (activeRound) {
      var r = activeRound.round;
      var holeMap = {};
      r.holes.forEach(function(h) { holeMap[h.hole] = h; });
      html += '<div class="sc-grid" style="margin-top:4px">';
      html += '<div class="sc-nine"><div class="sc-nine-label">OUT</div><div class="sc-row sc-row-hdr">';
      for (var hn=1;hn<=9;hn++) html += '<div class="sc-cell">' + hn + '</div>';
      html += '</div><div class="sc-row sc-row-score">';
      for (var hn=1;hn<=9;hn++) { var hd=holeMap[hn]; var par=getHolePar(hn); var scC=hd&&hd.strokes?scorecardClass(hd.strokes,par):''; html += '<div class="sc-cell ' + scC + '"><span class="sc-num">' + (hd&&hd.strokes?hd.strokes:'–') + '</span></div>'; }
      html += '</div></div>';
      html += '<div class="sc-nine"><div class="sc-nine-label">IN</div><div class="sc-row sc-row-hdr">';
      for (var hn=10;hn<=18;hn++) html += '<div class="sc-cell">' + hn + '</div>';
      html += '</div><div class="sc-row sc-row-score">';
      for (var hn=10;hn<=18;hn++) { var hd=holeMap[hn]; var par=getHolePar(hn); var scC=hd&&hd.strokes?scorecardClass(hd.strokes,par):''; html += '<div class="sc-cell ' + scC + '"><span class="sc-num">' + (hd&&hd.strokes?hd.strokes:'–') + '</span></div>'; }
      html += '</div></div></div>';
    }
  }

  wrap.innerHTML = html;
}

// ── Emoji Picker for Player Tags ──────────────────────────

function emojiButtonHtml(escapedName) {
  var em = getPlayerEmoji(escapedName.replace(/\\'/g, "'"));
  var html = '<button class="sc-emoji-btn" onclick="event.stopPropagation();openEmojiPicker(\'' + escapedName + '\')">' + (em || '+') + '</button>';
  if (em) html += '<button class="sc-emoji-clear" onclick="event.stopPropagation();selectPlayerEmoji(\'' + escapedName + '\',\'\')">✕</button>';
  return html;
}

function openEmojiPicker(playerName) {
  // Find the button that was tapped and swap it for an input
  var btn = document.querySelector('.sc-emoji-btn');
  if (!btn) return;
  var currentEmoji = getPlayerEmoji(playerName);

  var input = document.createElement('input');
  input.className = 'sc-emoji-input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.maxLength = 2;
  input.value = '';
  btn.replaceWith(input);

  input.addEventListener('input', function() {
    var val = input.value.trim();
    if (!val) return;
    var emoji;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var segs = Array.from(new Intl.Segmenter({granularity: 'grapheme'}).segment(val));
      emoji = segs.length ? segs[0].segment : val;
    } else {
      emoji = Array.from(val)[0] || val;
    }
    selectPlayerEmoji(playerName, emoji);
    // Replace input back with the button showing the emoji
    var newBtn = document.createElement('button');
    newBtn.className = 'sc-emoji-btn';
    newBtn.textContent = emoji;
    newBtn.onclick = function(e) { e.stopPropagation(); openEmojiPicker(playerName); };
    input.replaceWith(newBtn);
  });

  input.addEventListener('blur', function() {
    // If they dismiss without picking, restore the button
    setTimeout(function() {
      if (input.parentNode) {
        var newBtn = document.createElement('button');
        newBtn.className = 'sc-emoji-btn';
        newBtn.textContent = currentEmoji || '+';
        newBtn.onclick = function(e) { e.stopPropagation(); openEmojiPicker(playerName); };
        input.replaceWith(newBtn);
      }
    }, 200);
  });

  input.focus();
}

function selectPlayerEmoji(playerName, emoji) {
  setPlayerEmoji(playerName, emoji);
  // Update all emoji buttons visible on the page
  document.querySelectorAll('.sc-emoji-btn').forEach(function(btn) {
    btn.textContent = emoji || '+';
  });
  // Update leaderboard emoji tags without full re-render (avoids collapsing open scorecard)
  document.querySelectorAll('.tv-emoji-tag').forEach(function(el) { el.remove(); });
  if (emoji) {
    document.querySelectorAll('.tv-player').forEach(function(row) {
      var nameEl = row.querySelector('.tv-name');
      if (nameEl && nameEl.textContent === playerName) {
        var tag = document.createElement('span');
        tag.className = 'tv-emoji-tag';
        tag.textContent = emoji;
        var country = row.querySelector('.tv-country');
        if (country) country.insertAdjacentElement('afterend', tag);
      }
    });
  }
  // Re-render activity feed if open
  if (typeof renderActivityList === 'function' && _actOpen) renderActivityList();
}

// Triple-tap header logo to clear all emoji tags
var _logoTapCount = 0;
var _logoTapTimer = null;

function _handleLogoTap() {
  _logoTapCount++;
  if (_logoTapCount === 3) {
    _logoTapCount = 0;
    clearTimeout(_logoTapTimer);
    if (Object.keys(PLAYER_EMOJI).length === 0) return;
    PLAYER_EMOJI = {};
    try { localStorage.removeItem(PLAYER_EMOJI_KEY); } catch(e) {}
    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    if (typeof renderActivityList === 'function' && _actOpen) renderActivityList();
  } else {
    clearTimeout(_logoTapTimer);
    _logoTapTimer = setTimeout(function() { _logoTapCount = 0; }, 800);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var logo = document.querySelector('.hdr-logo-center');
  if (logo) {
    logo.addEventListener('touchend', function(e) { e.preventDefault(); _handleLogoTap(); });
    logo.addEventListener('click', _handleLogoTap);
  }
});
