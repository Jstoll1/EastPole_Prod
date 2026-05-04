// East Pole Golf chat — slide-up panel, streams from Cloudflare Worker proxy.
// Set CHAT_API_URL to your deployed worker URL after `wrangler deploy`.

var CHAT_API_URL = 'https://eastpole-chat.jhs797.workers.dev';

var chatHistory = [];
var chatStreaming = false;

function chatOpen() {
  document.getElementById('chat-panel').classList.add('open');
  document.getElementById('chat-overlay').classList.add('open');
  setTimeout(function() {
    var inp = document.getElementById('chat-input');
    if (inp) inp.focus();
  }, 280);
}
function chatClose() {
  document.getElementById('chat-panel').classList.remove('open');
  document.getElementById('chat-overlay').classList.remove('open');
}

function chatBuildContext() {
  var ctx = {};
  try {
    if (typeof TOURNEY_NAME !== 'undefined') {
      ctx.tournament = {
        name: TOURNEY_NAME, course: TOURNEY_COURSE, dates: TOURNEY_DATES,
        round: typeof ESPN_ROUND !== 'undefined' ? ESPN_ROUND : null,
        started: typeof TOURNAMENT_STARTED !== 'undefined' ? TOURNAMENT_STARTED : null,
        final: typeof TOURNEY_FINAL !== 'undefined' ? TOURNEY_FINAL : null,
        coursePar: typeof COURSE_PAR !== 'undefined' ? COURSE_PAR : null,
      };
    }
    if (typeof POOL_CONFIG !== 'undefined') ctx.poolConfig = POOL_CONFIG;
    if (typeof currentUserEmail !== 'undefined') ctx.currentUser = currentUserEmail;
    if (typeof ENTRIES !== 'undefined' && typeof getRanked === 'function') {
      var ranked = getRanked();
      ctx.standings = ranked.slice(0, 50).map(function(e, i) {
        return { rank: i + 1, team: e.team, entrant: e.entrant, total: e.total, picks: e.picks };
      });
    }
    if (typeof DG_LIVE_PREDS !== 'undefined' && DG_LIVE_PREDS) {
      var preds = Object.keys(DG_LIVE_PREDS).map(function(name) {
        var p = DG_LIVE_PREDS[name];
        return { name: name, win: p.win, top5: p.top5, top10: p.top10, top20: p.top20, makeCut: p.make_cut };
      }).filter(function(p) { return p.win != null; })
        .sort(function(a, b) { return (b.win || 0) - (a.win || 0); })
        .slice(0, 25);
      ctx.dataGolfPredictions = preds;
      if (typeof DG_META !== 'undefined') ctx.dataGolfMeta = DG_META;
    }
    if (typeof GOLFER_SCORES !== 'undefined') {
      var arr = Object.keys(GOLFER_SCORES).map(function(name) {
        var g = GOLFER_SCORES[name];
        return { name: name, pos: g.pos, total: g.total, today: g.today, thru: g.thru, r1: g.r1, r2: g.r2, r3: g.r3, r4: g.r4 };
      });
      arr.sort(function(a, b) {
        var pa = parseInt(String(a.pos).replace(/\D/g, ''), 10) || 999;
        var pb = parseInt(String(b.pos).replace(/\D/g, ''), 10) || 999;
        return pa - pb;
      });
      ctx.leaderboard = arr.slice(0, 80);
    }
  } catch (e) {
    ctx.contextError = String(e);
  }
  return ctx;
}

function chatRender() {
  var box = document.getElementById('chat-messages');
  if (!box) return;
  if (chatHistory.length === 0) {
    box.innerHTML = '<div class="chat-empty">Ask about the leaderboard, your entries, or pool rules.<div class="chat-suggestions">' +
      '<button class="chat-sugg" onclick="chatSuggest(\'Who is leading the pool right now?\')">Who is leading?</button>' +
      '<button class="chat-sugg" onclick="chatSuggest(\'How am I doing?\')">How am I doing?</button>' +
      '<button class="chat-sugg" onclick="chatSuggest(\'What are the payouts?\')">Payouts?</button>' +
      '</div></div>';
    return;
  }
  box.innerHTML = '';
  chatHistory.forEach(function(m) {
    var d = document.createElement('div');
    d.className = 'chat-msg ' + m.role + (m.error ? ' error' : '');
    d.textContent = m.content;
    if (m.streaming) d.classList.add('chat-typing');
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
}

function chatSuggest(text) {
  var inp = document.getElementById('chat-input');
  inp.value = text;
  chatSend();
}

async function chatSend() {
  if (chatStreaming) return;
  var inp = document.getElementById('chat-input');
  var text = inp.value.trim();
  if (!text) return;
  if (text.length > 500) text = text.slice(0, 500);
  inp.value = '';
  chatHistory.push({ role: 'user', content: text });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
  var assistantMsg = { role: 'assistant', content: '', streaming: true };
  chatHistory.push(assistantMsg);
  chatStreaming = true;
  document.getElementById('chat-send').disabled = true;
  chatRender();

  try {
    var res = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistory.filter(function(m) { return !m.streaming; }).map(function(m) {
          return { role: m.role, content: m.content };
        }),
        context: chatBuildContext(),
      }),
    });

    if (!res.ok || !res.body) {
      var errBody = await res.text().catch(function() { return ''; });
      throw new Error('HTTP ' + res.status + ' ' + errBody.slice(0, 200));
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('data: ') !== 0) continue;
        var data = line.slice(6).trim();
        if (!data) continue;
        try {
          var evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
            assistantMsg.content += evt.delta.text;
            chatRender();
          }
        } catch (e) { /* ignore non-JSON keepalives */ }
      }
    }

    assistantMsg.streaming = false;
  } catch (err) {
    assistantMsg.content = 'Error: ' + err.message;
    assistantMsg.streaming = false;
    assistantMsg.error = true;
  } finally {
    chatStreaming = false;
    document.getElementById('chat-send').disabled = false;
    chatRender();
  }
}

function chatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatSend();
  }
}

document.addEventListener('DOMContentLoaded', chatRender);
