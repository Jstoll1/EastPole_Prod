// East Pole Pool — chat worker
//
// Single endpoint: POST /chat
//   body: { message: string, history?: Array<{role:'user'|'assistant', text:string}>, userEmail?: string }
//   returns: text/event-stream — Anthropic SSE relayed verbatim
//
// Architecture: orchestrates context (ESPN + DataGolf proxy + published
// Google Sheet TSV) into a single Claude API request with prompt caching.
// The cached prefix (system + tournament context) accounts for ~95% of
// tokens — first call writes the cache (1.25× cost), every call after
// reads it (0.1× cost) for ~5 minutes.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 600;

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const DG_PROXY = 'https://datagolf-proxy.jhs797.workers.dev/';
const POOL_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjBiF7GjL0OV--o5cqjWnIDtx2ON0TfZpTwX_zNNpESl8w731mzdKGTsU4gGPbpGT0F5fERvaednpL/pub?output=tsv';

const SYSTEM_PROMPT = `You are the East Pole Pool Assistant — a helpful, knowledgeable AI embedded in the East Pole golf pool app. You answer questions about the live PGA tournament, the pool standings, and the user's specific entries.

## Pool format
- Each entry picks 10 golfers
- Score = sum of the best 4 finishers' to-par scores (lowest wins)
- Missed cut / WD = +11 / +12 penalty
- Tiebreaker: 5th-best score, then 6th-best
- Top 3 entries split the pot

## What you do
- Explain the live leaderboard and a golfer's performance
- Analyze a user's entries vs the field and the rest of the pool
- Estimate finish chances honestly (use the DataGolf probabilities provided)
- Explain pool rules, scoring, and tiebreakers
- Identify which of the user's picks are helping or hurting

## What you do NOT do
- Answer general questions outside golf and this pool
- Give betting advice (you can explain odds context, not "you should bet on X")
- Make up scores or stats — only use the data provided in CONTEXT
- Reveal other users' entries beyond the public leaderboard view
- Discuss other sports, news, politics, recipes, code, or anything off-topic

## Style
- Concise and conversational — this is a chat box, not a report
- Use golfer names naturally ("Scheffler is at -8 thru 14")
- Round percentages to 1 decimal: "Win prob 32.3%"
- When uncertain, say so — never fabricate
- Keep responses to a paragraph or two unless explicitly asked for more

## Off-topic guard
If asked anything outside the tournament or this pool, respond with: "I'm only set up to help with the live tournament and your pool entries. Want to know how your picks are doing instead?"`;

// ── HTTP entrypoint ─────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (request.method !== 'POST') return cors(json({ error: 'POST only' }, 405));

    const url = new URL(request.url);
    if (url.pathname !== '/chat') return cors(json({ error: 'Not found' }, 404));

    let body;
    try { body = await request.json(); } catch { return cors(json({ error: 'Bad JSON' }, 400)); }

    const message = String(body.message || '').trim();
    if (!message) return cors(json({ error: 'Empty message' }, 400));
    if (message.length > 1000) return cors(json({ error: 'Message too long (max 1000 chars)' }, 400));

    // Cheap pre-API off-topic / injection filter
    if (isOffTopic(message)) return cors(streamRefusal());

    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const userEmail = String(body.userEmail || '').trim().toLowerCase();

    let context;
    try {
      context = await buildContext(userEmail);
    } catch (e) {
      return cors(json({ error: 'Context fetch failed', detail: e.message }, 502));
    }

    return cors(await streamFromAnthropic(env, context, history, message));
  },
};

// ── Context builder ─────────────────────────────────────────

async function buildContext(userEmail) {
  const [espn, dg, sheet] = await Promise.all([
    fetchESPN(),
    fetchDG(),
    fetchSheet(),
  ]);
  const tournament = formatTournament(espn);
  const leaderboard = formatLeaderboard(espn);
  const pool = computePool(sheet, espn);
  const userEntries = userEmail ? pool.entries.filter(e => e.email.toLowerCase() === userEmail) : [];
  const dgPreds = formatDGPreds(dg);

  return [
    `## CONTEXT (live as of ${new Date().toISOString()})`,
    `### Tournament`,
    tournament,
    `### Live Leaderboard (top 30)`,
    leaderboard,
    `### Pool Standings (${pool.entries.length} entries)`,
    formatPoolStandings(pool.ranked),
    userEntries.length ? [`### Your Entries (${userEmail})`, formatUserEntries(userEntries, pool.ranked)].join('\n') : `### Your Entries\nNo logged-in user / no entries found for this email.`,
    `### DataGolf Win Probabilities (top 20)`,
    dgPreds,
  ].join('\n\n');
}

async function fetchESPN() {
  const res = await fetch(ESPN_SCOREBOARD, { cf: { cacheTtl: 60 } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

async function fetchDG() {
  const res = await fetch(DG_PROXY + '?endpoint=in-play', { cf: { cacheTtl: 60 } });
  if (!res.ok) {
    // fall back to pre-tournament if in-play hasn't started
    const pre = await fetch(DG_PROXY + '?endpoint=pre-tournament', { cf: { cacheTtl: 60 } });
    if (!pre.ok) return { data: [] };
    return pre.json();
  }
  return res.json();
}

async function fetchSheet() {
  const res = await fetch(POOL_SHEET_URL, { cf: { cacheTtl: 60 } });
  if (!res.ok) throw new Error(`Sheet ${res.status}`);
  return res.text();
}

// ── Formatters ──────────────────────────────────────────────

function formatTournament(espn) {
  const ev = espn?.events?.[0];
  if (!ev) return '(no live event)';
  const comp = ev.competitions?.[0] || {};
  const venue = comp.venue?.fullName || '';
  const status = ev.status?.type?.detail || ev.status?.type?.description || '';
  const round = ev.status?.period;
  return `Name: ${ev.name || ev.shortName || '—'}\nCourse: ${venue}\nDates: ${ev.date || '—'}${ev.endDate ? ' – ' + ev.endDate : ''}\nStatus: ${status}${round ? ` (round ${round})` : ''}`;
}

function formatLeaderboard(espn) {
  const comps = espn?.events?.[0]?.competitions?.[0]?.competitors || [];
  if (!comps.length) return '(field not yet published)';
  const rows = comps.slice(0, 30).map(c => {
    const ath = c.athlete || (c.athletes && c.athletes[0]) || {};
    const name = ath.displayName || '?';
    const pos = c.status?.position?.displayName || '—';
    const sc = c.statistics?.find(s => s.name === 'scoreToPar');
    const score = sc ? sc.displayValue : (c.linescores ? '?' : '—');
    const today = c.linescores?.[(c.linescores.length || 1) - 1]?.displayValue || '';
    const thru = c.status?.thru ?? c.status?.displayValue ?? '';
    return `${pos.padStart(4)} ${name.padEnd(24)} ${String(score).padStart(5)}  TDY ${String(today).padStart(4)}  THRU ${String(thru).padStart(4)}`;
  });
  return rows.join('\n');
}

function formatDGPreds(dg) {
  const arr = Array.isArray(dg.data) ? dg.data : Array.isArray(dg.baseline) ? dg.baseline : Array.isArray(dg.baseline_history_fit) ? dg.baseline_history_fit : [];
  if (!arr.length) return '(DataGolf data unavailable right now)';
  const sorted = arr.slice().sort((a, b) => (b.win || 0) - (a.win || 0)).slice(0, 20);
  return sorted.map(p => {
    const name = p.player_name ? p.player_name.split(', ').reverse().join(' ') : (p.team_name || '?');
    return `${name.padEnd(28)} Win ${pct(p.win)}  T5 ${pct(p.top_5)}  T10 ${pct(p.top_10)}  MC ${pct(p.make_cut)}`;
  }).join('\n');
}

function pct(v) {
  if (v == null) return '—';
  const n = v * 100;
  return (n < 1 ? '<1' : n.toFixed(1)) + '%';
}

// ── Pool computation ────────────────────────────────────────
// Same logic as the client (entry-loader + utils), inlined and trimmed.

function computePool(tsv, espn) {
  const entries = parseTSV(tsv);
  const golferScores = buildGolferScores(espn);
  const ranked = entries
    .map(e => calcEntry(e, golferScores))
    .sort((a, b) => a.total - b.total || (a.fifth ?? 99) - (b.fifth ?? 99) || (a.sixth ?? 99) - (b.sixth ?? 99))
    .map((e, i) => ({ ...e, rank: i + 1 }));
  return { entries, ranked };
}

function parseTSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.length);
  if (lines.length < 2) return [];
  const cells = (l) => l.split('\t');
  const headers = cells(lines[0]).map(h => h.trim());
  const find = (re) => headers.findIndex(h => re.test(h));
  const idx = {
    email:   find(/e.?mail/i),
    entrant: find(/^entrant$|^user\s*name$|^username$|your\s*name|full\s*name|^name$/i),
    team:    find(/entry\s*name|team\s*name/i),
    tier1:   find(/tier\s*1/i),
    tier2:   find(/tier\s*2/i),
    tier3:   find(/tier\s*3/i),
    tier4:   find(/tier\s*4/i),
    tb:      find(/tie.?break/i),
  };
  const stripFlag = (s) => String(s || '').replace(/^[^\p{L}]+/u, '').trim();
  const explode = (sel) => String(sel).split(/\s*\/\s*/).map(stripFlag).filter(Boolean);
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const c = cells(lines[r]);
    const team = (idx.team >= 0 ? c[idx.team] : '').trim();
    if (!team) continue;
    const picks = [];
    ['tier1','tier2','tier3','tier4'].forEach(k => {
      const i = idx[k];
      if (i < 0 || !c[i]) return;
      c[i].split(/,\s*(?=[^\s])/).forEach(sel => explode(sel.trim()).forEach(g => g && picks.push(g)));
    });
    out.push({
      team,
      entrant: (idx.entrant >= 0 ? c[idx.entrant] : '').trim(),
      email:   (idx.email   >= 0 ? c[idx.email]   : '').trim(),
      tieBreaker: (idx.tb   >= 0 ? c[idx.tb]      : '').trim(),
      picks,
    });
  }
  return out;
}

function buildGolferScores(espn) {
  const out = {};
  const comps = espn?.events?.[0]?.competitions?.[0]?.competitors || [];
  comps.forEach(c => {
    const ath = c.athlete || (c.athletes && c.athletes[0]);
    if (!ath?.displayName) return;
    const state = c.status?.type?.name || '';
    const wd = state.includes('WITHDRAW');
    const mc = !wd && state.includes('CUT');
    const sc = c.statistics?.find(s => s.name === 'scoreToPar');
    const score = wd ? 12 : mc ? 11 : (sc ? sc.value : 0);
    out[ath.displayName] = { score, pos: c.status?.position?.displayName || '—', thru: c.status?.thru ?? '', today: c.linescores?.[(c.linescores.length||1)-1]?.displayValue || '' };
  });
  return out;
}

function calcEntry(e, gs) {
  const scored = e.picks.map(n => ({ name: n, score: gs[n]?.score ?? 11 }))
                        .sort((a, b) => a.score - b.score);
  const top4 = scored.slice(0, 4);
  return {
    team: e.team,
    entrant: e.entrant,
    email: e.email,
    tieBreaker: e.tieBreaker,
    scores: scored,
    top4,
    total: top4.reduce((s, g) => s + g.score, 0),
    fifth: scored[4]?.score ?? null,
    sixth: scored[5]?.score ?? null,
  };
}

function formatPoolStandings(ranked) {
  if (!ranked.length) return '(no entries yet)';
  return ranked.slice(0, 30).map(e => {
    const total = e.total > 0 ? '+' + e.total : e.total === 0 ? 'E' : String(e.total);
    return `#${String(e.rank).padStart(3)} ${e.team.padEnd(28)} ${total.padStart(5)}  by ${e.entrant || '—'}`;
  }).join('\n');
}

function formatUserEntries(myEntries, ranked) {
  return myEntries.map(my => {
    const r = ranked.find(x => x.team === my.team && x.email === my.email);
    if (!r) return `${my.team}: (not yet ranked)`;
    const total = r.total > 0 ? '+' + r.total : r.total === 0 ? 'E' : String(r.total);
    const lines = [
      `Entry: ${r.team}`,
      `Pool rank: #${r.rank} of ${ranked.length}`,
      `Total: ${total} (best 4 of ${r.scores.length})`,
      r.tieBreaker ? `Tiebreaker: ${r.tieBreaker}` : null,
      `Picks (★ = counts toward total):`,
    ].filter(Boolean);
    r.scores.forEach((g, i) => {
      const fmt = g.score === 11 ? 'MC' : g.score === 12 ? 'WD' : (g.score > 0 ? '+' + g.score : g.score === 0 ? 'E' : String(g.score));
      lines.push(`  ${i < 4 ? '★' : ' '} ${g.name.padEnd(28)} ${fmt}`);
    });
    return lines.join('\n');
  }).join('\n\n');
}

// ── Anthropic streaming ─────────────────────────────────────

async function streamFromAnthropic(env, contextText, history, userMessage) {
  const messages = [];
  // Inject context into the FIRST user message so it sits inside the cached
  // prefix on first call. Subsequent turns drop the context block (history
  // already carries it) and Anthropic's prefix-match cache still hits.
  if (history.length === 0) {
    messages.push({ role: 'user', content: `${contextText}\n\n---\n\n${userMessage}` });
  } else {
    history.forEach(h => messages.push({ role: h.role, content: h.text }));
    messages.push({ role: 'user', content: userMessage });
  }

  const upstream = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      // Cache the system prompt so the ~1500 token system instructions
      // don't re-bill on every chat turn.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return json({ error: 'Anthropic API error', status: upstream.status, detail: errText }, 502);
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────

function cors(res) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function isOffTopic(message) {
  const m = message.toLowerCase();
  const patterns = [
    /\bwrite (me )?(a |an )?(poem|essay|story|song|code|script|email|recipe)\b/,
    /\b(translate|recipe|homework)\b/,
    /\bexplain (quantum|relativity|gravity|the (theory|history) of)\b/,
    /\bignore (your |the )?(previous |above |prior )?(instructions|prompt|rules)\b/,
    /\byou are now\b|\bpretend (you are|to be)\b|\bact as\b/,
    /\b(who is|tell me about) (the president|biden|trump|obama)\b/,
    /\bweather (in|at|for) (?!.*(?:augusta|aronimink|tpc|harbour|quail|pebble|riviera|torrey|bay hill|sawgrass))\b/,
  ];
  return patterns.some(re => re.test(m));
}

// Pre-canned SSE refusal — mirrors Anthropic's stream shape so the client
// can use one parser for both cases.
function streamRefusal() {
  const text = "I'm only set up to help with the live tournament and your pool entries. Want to know how your picks are doing instead?";
  const events = [
    `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: { id: 'refusal', type: 'message', role: 'assistant', content: [], stop_reason: null, model: MODEL, usage: { input_tokens: 0, output_tokens: 0 } } })}\n\n`,
    `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
    `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text } })}\n\n`,
    `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
    `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 0 } })}\n\n`,
    `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
  ];
  const stream = new ReadableStream({
    start(c) { events.forEach(e => c.enqueue(new TextEncoder().encode(e))); c.close(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
