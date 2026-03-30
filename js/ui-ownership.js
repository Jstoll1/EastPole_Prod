// ── Ownership View ──

let ownFilter='most';

function setOwnFilter(f,btn) {
  ownFilter=f;
  document.querySelectorAll('#view-ownership .seg-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderOwnership();
}

let _openOwnPlayer = null;
function toggleOwnDetail(player) {
  _openOwnPlayer = _openOwnPlayer === player ? null : player;
  renderOwnership();
}
function renderOwnership() {
  const gdMap = {};
  Object.entries(GOLFER_SCORES).forEach(([n, g]) => gdMap[n] = g);
  let data = [...OWNERSHIP_DATA];
  if (!data.length) { document.getElementById('ownership-list').innerHTML = '<div class="empty-state">No entries yet</div>'; return; }
  const searchVal = (document.getElementById('own-search')?.value || '').trim().toLowerCase();
  if (searchVal) data = data.filter(d => d.player.toLowerCase().includes(searchVal));
  const maxPct = OWNERSHIP_DATA[0].pct;
  if (ownFilter === 'least') data = [...data].sort((a, b) => a.pct - b.pct);
  else if (ownFilter === 'score') data = [...data].sort((a, b) => {
    const sa = gdMap[a.player]?.score ?? 999, sb = gdMap[b.player]?.score ?? 999;
    return sa - sb;
  });
  else if (ownFilter === 'today') data = [...data].sort((a, b) => {
    const ta = gdMap[a.player]?.todayDisplay || '—', tb = gdMap[b.player]?.todayDisplay || '—';
    const va = ta === '—' ? 999 : (ta === 'E' ? 0 : parseInt(ta.replace('+', '')) || 0);
    const vb = tb === '—' ? 999 : (tb === 'E' ? 0 : parseInt(tb.replace('+', '')) || 0);
    return va - vb;
  });
  else if (ownFilter === 'tot') data = [...data].sort((a, b) => {
    const ta = gdMap[a.player]?.tot || 9999, tb = gdMap[b.player]?.tot || 9999;
    return ta - tb;
  });
  const myPicks = currentUserTeams.length ? new Set(currentUserTeams.flatMap(t => t.picks)) : new Set();
  document.getElementById('ownership-list').innerHTML = data.map(d => {
    const gd = gdMap[d.player];
    const sc = gd?.score;
    const pos = gd?.pos || '—';
    const scf = sc !== undefined ? fmt(sc) : '—';
    const scc = sc !== undefined ? cls(sc) : 'eve';
    const mc = gd?.thru === 'MC' || gd?.score === 11;
    const isWD = gd?.thru === 'WD' || gd?.score === 12;
    const flag = FLAGS[d.player] || '';
    const posStr = isWD ? 'WD' : mc ? 'MC' : (pos !== '—' ? pos : '');
    const isMine = myPicks.has(d.player);
    const escapedName = d.player.replace(/'/g, "\\'");
    const isOpen = _openOwnPlayer === d.player;

    // Today score and thru
    const todayDisp = gd?.todayDisplay || '—';
    const todayVal = todayDisp === 'E' || todayDisp === '—' ? 0 : parseInt(todayDisp.replace('+', '')) || 0;
    const todayCls = todayDisp === '—' ? '' : (todayVal < 0 ? 'neg' : todayVal > 0 ? 'pos' : 'eve');
    const ownLastRound = (function(){ const rs = [gd?.r1,gd?.r2,gd?.r3,gd?.r4]; for(let i=rs.length-1;i>=0;i--){ if(rs[i]&&rs[i]>50) return rs[i]; } return null; })();
    const ownRoundDone = gd?.thru === 'F' || gd?.thru === '18';
    const thruDisp = ownRoundDone && ownLastRound ? String(ownLastRound) : (gd?.thru || '—');

    let valueTag = '';

    // Teams that own this player
    const teams = ENTRIES.filter(e => e.picks.includes(d.player));
    const rankedStandings = getRanked();
    let detailHtml = '';
    if (isOpen) {
      detailHtml = '<div class="own-detail open">' + teams.map(t => {
        const ri = rankedStandings.findIndex(r => r.team === t.team && r.email === t.email);
        const rank = ri >= 0 ? '#' + (ri + 1) : '';
        const myTeam = currentUserTeams.some(ct => ct.team === t.team && ct.email === t.email);
        return '<div class="own-detail-team' + (myTeam ? ' is-my-pick' : '') + '"><span class="own-team-name">' + t.team + '</span><span class="own-team-rank">' + rank + '</span></div>';
      }).join('') + '</div>';
    } else {
      detailHtml = '<div class="own-detail"></div>';
    }

    return '<div class="own-row' + (isMine ? ' is-my-pick' : '') + '" onclick="toggleOwnDetail(\'' + escapedName + '\')">' +
      '<div class="own-hdr">' +
        '<div style="display:flex;align-items:baseline;gap:6px;min-width:0">' +
          '<span class="own-name">' + flag + ' ' + d.player + '</span>' +
          (posStr ? '<span style="font-size:10px;color:var(--text3);font-weight:600;flex-shrink:0">' + posStr + '</span>' : '') +
          valueTag +
        '</div>' +
        '<div class="own-right">' +
          '<span class="own-score-tag ' + scc + '">' + scf + '</span>' +
          '<span class="own-pct">' + (d.pct * 100).toFixed(0) + '%</span>' +
        '</div>' +
      '</div>' +
      '<div class="own-bar-bg"><div class="own-bar" style="width:' + (d.pct / maxPct * 100).toFixed(1) + '%"></div></div>' +
      '<div class="own-sub">' +
        '<span>' + d.entries + ' of ' + ENTRIES.length + ' entries' + (todayDisp !== '—' ? ' · Today: <span class="own-today ' + todayCls + '">' + todayDisp + '</span>' : '') + '</span>' +
        '<span class="own-thru">' + (thruDisp !== '—' && thruDisp !== 'MC' && thruDisp !== 'WD' ? (ownRoundDone && ownLastRound ? 'Shot ' + thruDisp : 'Thru ' + thruDisp) : '') + '</span>' +
      '</div>' +
      detailHtml +
    '</div>';
  }).join('');
}
