/**
 * Cloudflare Worker: receive minimal crash reports and email them via Resend.
 * Secrets/env settings on Worker ONLY:
 * RESEND_API_KEY, REPORT_FROM (verified domain), REPORT_TO (destination mailbox).
 * Configure Cloudflare WAF rate limit and request body limit for public /report endpoint.
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/report') {
      return new Response('Not found', { status: 404 });
    }
    if (!env.RESEND_API_KEY || !env.REPORT_FROM || !env.REPORT_TO) {
      return new Response('Relay not configured', { status: 503 });
    }
    const raw = await request.text();
    if (raw.length > 40_000) return new Response('Too large', { status: 413 });
    let data;
    try { data = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }
    if (data.app !== 'RetroSoundOne' || !Array.isArray(data.events) ||
        data.events.length === 0 || data.events.length > 80) {
      return new Response('Invalid report', { status: 400 });
    }
    // Strictly keep only minimal whitelisted ASCII fields; never echo arbitrary data.
    const keep = s => String(s ?? '').replace(/[^A-Za-z0-9_.;=:-]/g, '_').slice(0, 90);
    const events = data.events.map(e => ({
      timestamp: Number.isFinite(Number(e.timestamp)) ? Number(e.timestamp) : 0,
      category: keep(e.category), code: keep(e.code), detail: keep(e.detail)
    }));
    const plain = ['RetroSound One crash/error report',
      'Version: ' + keep(data.version), 'SDK: ' + keep(data.sdk),
      '', ...events.map(e => new Date(e.timestamp || Date.now()).toISOString() +
         ' | ' + e.category + ' | ' + e.code + ' | ' + e.detail)].join('\n');
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.REPORT_FROM, to: [env.REPORT_TO],
        subject: '[RetroSound One] Ошибка ' + events.length + ' событий',
        text: plain
      })
    });
    return sent.ok ? new Response('Accepted', {status: 202})
      : new Response('Email service unavailable', {status: 503});
  }
};
