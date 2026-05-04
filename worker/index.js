const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const SYSTEM_BASE = `You are the East Pole Golf Pool assistant — a sharp, concise, slightly playful caddie embedded in a fantasy golf pool app.

Your job: answer questions about the live tournament, the pool standings, individual entries, head-to-head matchups, and the pool rules. Be specific. Cite numbers. Don't hedge.

Tone: terse, confident, fun. Light golf vernacular is fine ("birdie barrage", "moving day"). Avoid corporate filler. No emojis unless the user uses them first. Never invent stats — if context doesn't have it, say so.

Format: short paragraphs, no headers unless asked. Bullet only when listing 3+ things.`;

function corsHeaders(origin, allowed) {
  const ok = allowed === '*' || origin === allowed;
  return {
    'Access-Control-Allow-Origin': ok ? (origin || allowed) : allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400, cors); }

    const { messages, context } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages required' }, 400, cors);
    }

    const contextBlock = context
      ? `\n\nLIVE POOL CONTEXT (JSON snapshot):\n${JSON.stringify(context).slice(0, 60000)}`
      : '';

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: [
          { type: 'text', text: SYSTEM_BASE },
          { type: 'text', text: contextBlock, cache_control: { type: 'ephemeral' } },
        ],
        messages,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      return json({ error: 'upstream', status: upstream.status, detail: errText }, 502, cors);
    }

    return new Response(upstream.body, {
      headers: {
        ...cors,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
