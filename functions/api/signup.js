// Cloudflare Pages Function: POST /api/signup  {email}
// Stores the address in the SIGNUPS KV namespace (bind it in the Pages project: Settings → Functions → KV bindings → SIGNUPS).
// GET /api/signup?key=<SIGNUP_ADMIN_KEY> lists them (set SIGNUP_ADMIN_KEY as an environment variable in the same place).
// No third party, nothing leaves Cloudflare, no tracking.

const ok = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function onRequestPost({ request, env }) {
  if (!env.SIGNUPS) return ok({ error: 'SIGNUPS KV binding is missing' }, 500);
  let email = '';
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) email = (await request.json()).email || '';
    else email = (await request.formData()).get('email') || '';
  } catch { return ok({ error: 'bad request' }, 400); }
  email = String(email).trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return ok({ error: 'that email does not look right' }, 400);
  const key = `signup:${email}`;
  const existing = await env.SIGNUPS.get(key);
  if (!existing) {
    const record = { email, at: new Date().toISOString(), source: request.headers.get('referer') || 'aneeta.ai', ua: (request.headers.get('user-agent') || '').slice(0, 160), country: request.cf?.country || '' };
    await env.SIGNUPS.put(key, JSON.stringify(record));
  }
  return ok({ ok: true, already: Boolean(existing) });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.SIGNUP_ADMIN_KEY || url.searchParams.get('key') !== env.SIGNUP_ADMIN_KEY) return ok({ error: 'not allowed' }, 403);
  const out = []; let cursor;
  do {
    const page = await env.SIGNUPS.list({ prefix: 'signup:', cursor });
    for (const k of page.keys) { const v = await env.SIGNUPS.get(k.name); if (v) out.push(JSON.parse(v)); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  out.sort((a, b) => a.at.localeCompare(b.at));
  return ok({ count: out.length, signups: out });
}
