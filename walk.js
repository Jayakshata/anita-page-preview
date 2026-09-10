// "A walk with ANITA": her keyed frames (J's sprite sheets, cut from the Veo clips of the painting) stand in for the film.
// The scroll moves her through a black studio; at each stop she idles, then turns to you and speaks in her own voice.
// When the real Veo film exists it replaces the sheets frame for frame; the page logic stays the same.

const SIGNUP_ENDPOINT = location.hostname.endsWith("aneeta.ai") || location.hostname.endsWith("pages.dev") ? "/api/signup" : "";
const FALLBACK_MAILTO = "hello@aneeta.ai";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mobile = matchMedia('(max-width: 760px)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const debugP = new URLSearchParams(location.search).get('p');

// ---------------------------------------------------------------- the stops (film time 0..1 = the scroll through .film)
const STOPS = [
  { at: 0.00, x: 0.00,  s: 1.00, state: 'ARRIVING',    voice: 'arrival', panel: 0 },
  { at: 0.13, x: -0.16, s: 1.04, state: 'LISTENING',   voice: 'who',     panel: 1, right: true },
  { at: 0.25, x: 0.18,  s: 0.98, state: 'REMEMBERING', voice: 'memory',  panel: 2 },
  { at: 0.37, x: -0.14, s: 1.00, state: 'YOURS',       voice: 'yours',   panel: 3, right: true, light: 'switch' },
  { at: 0.49, x: 0.20,  s: 0.96, state: 'RUNNING',     voice: 'today',   panel: 4, light: 'numbers' },
  { at: 0.61, x: -0.18, s: 1.02, state: 'BECOMING',    voice: 'body',    panel: 5, right: true, light: 'silhouette' },
  { at: 0.74, x: 0.00,  s: 0.94, state: 'EVERYWHERE',  voice: 'screens', panel: 6, right: true, light: 'devices' },
  { at: 0.87, x: 0.14,  s: 1.00, state: 'WITH YOU',    voice: 'others',  panel: 7 },
  { at: 1.00, x: 0.00,  s: 1.00, state: 'WAITING',     voice: 'door',    panel: 8, right: true },
];
const HOLD = 0.035;          // half-width of a stop, in film time
const SCRIPT = {};           // filled from voice/script.json (the draft lines, for the captions)

// ---------------------------------------------------------------- DOM
const film = document.getElementById('film'), stage = document.getElementById('stage');
const canvas = document.getElementById('her'), ctx = canvas.getContext('2d');
const panels = [...document.querySelectorAll('.panel')];
const statusEl = document.getElementById('state'), captions = document.getElementById('captions'), hear = document.getElementById('hear');
const pool = stage.querySelector('.pool'), sweep = stage.querySelector('.sweep');
const lights = { switch: stage.querySelector('.switch'), numbers: stage.querySelector('.numbers'), silhouette: stage.querySelector('.silhouette'), devices: stage.querySelector('.devices') };
const load = document.getElementById('load'), bar = document.getElementById('bar'), loadtext = document.getElementById('loadtext');
STOPS.forEach(s => { if (s.right) panels[s.panel].classList.add('right'); });

// ---------------------------------------------------------------- sprites
async function sheet(name) {
  const meta = await (await fetch(`assets/sprites/${name}.json`)).json();
  const pages = await Promise.all(meta.files.map(f => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `assets/sprites/${f}`; })));
  return { meta, pages };
}
function cell(sp, f) {   // where frame f lives on its page
  const { meta, pages } = sp; f = clamp(Math.round(f), 0, meta.frames - 1);
  const page = Math.floor(f / meta.perPage), k = f % meta.perPage;
  return { im: pages[page], sx: (k % meta.cols) * meta.fw, sy: Math.floor(k / meta.cols) * meta.fh };
}
const sprites = {};
let loaded = 0; const toLoad = 3;
function tick(msg) { loaded++; bar.style.width = `${Math.round(loaded / toLoad * 100)}%`; if (msg) loadtext.textContent = msg; if (loaded >= toLoad) { loadtext.textContent = 'ready'; load.classList.add('is-done'); arrival.start(); } }

// ---------------------------------------------------------------- scroll → film time
let target = 0, shown = 0, lastMoveAt = 0, lastShown = -1;
function readScroll() {
  const r = film.getBoundingClientRect(), range = film.offsetHeight - innerHeight;
  target = range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  if (debugP !== null) target = +debugP;
}
addEventListener('scroll', readScroll, { passive: true }); addEventListener('resize', readScroll); readScroll();

// ---------------------------------------------------------------- her voice (sound only after the first tap)
let unlocked = false, pending = null, audio = null, speakingStop = -1;
const spoken = new Set();
function unlock() { if (unlocked) return; unlocked = true; hear.classList.remove('is-on'); soundBtn?.classList.add('is-on'); if (pending !== null) { const s = pending; pending = null; say(s); } }
['pointerdown', 'keydown', 'touchstart'].forEach(k => addEventListener(k, unlock, { passive: true }));
function stopSpeaking() { if (audio) { audio.pause(); audio = null; } speakingStop = -1; captions.classList.remove('is-on'); clearInterval(typer); }
let typer = null;
function type(text, ms) {
  const words = text.split(' '); let i = 0; captions.textContent = ''; captions.classList.add('is-on'); clearInterval(typer);
  typer = setInterval(() => { if (i >= words.length) { clearInterval(typer); return; } captions.textContent += (i ? ' ' : '') + words[i++]; }, ms / words.length);
}
let say = function (stopIndex) {
  const s = STOPS[stopIndex]; const text = SCRIPT[s.voice] || '';
  if (!unlocked) { pending = stopIndex; hear.classList.add('is-on'); type(text, Math.max(3000, text.length * 55)); speakingStop = stopIndex; setTimeout(() => { if (speakingStop === stopIndex && !audio) { speakingStop = -1; captions.classList.remove('is-on'); } }, Math.max(3000, text.length * 55) + 1500); return; }
  stopSpeaking(); speakingStop = stopIndex; spoken.add(stopIndex);
  audio = new Audio(`voice/${s.voice}.wav`); audio.preload = 'auto';
  audio.onloadedmetadata = () => type(text, audio.duration * 1000);
  audio.onended = () => { speakingStop = -1; setTimeout(() => captions.classList.remove('is-on'), 900); audio = null; };
  audio.onerror = () => { type(text, Math.max(3000, text.length * 55)); setTimeout(() => { speakingStop = -1; captions.classList.remove('is-on'); }, text.length * 55 + 1500); audio = null; };
  audio.play().catch(() => { unlocked = false; pending = stopIndex; hear.classList.add('is-on'); });
};
hear.addEventListener('click', unlock);
const soundBtn = document.getElementById('sound');
let muted = false;
soundBtn?.addEventListener('click', () => { muted = !muted; soundBtn.classList.toggle('is-off', muted); soundBtn.setAttribute('aria-pressed', String(muted)); if (audio) audio.muted = muted; });
const _say = say; say = function (i) { _say(i); if (audio) audio.muted = muted; };

// ---------------------------------------------------------------- the arrival: close on her face, then she pulls back to her place
const arrival = {
  t0: null, hold: 1.0, pull: 1.9, done: false,
  start() { this.t0 = performance.now() / 1000; },
  k() {   // 1 = close, 0 = her place
    if (this.t0 === null) return 1;
    const s = performance.now() / 1000 - this.t0; if (s < this.hold) return 1;
    const u = clamp((s - this.hold) / this.pull, 0, 1), e = 1 - Math.pow(1 - u, 3);
    if (u >= 1 && !this.done) { this.done = true; setTimeout(() => { if (shown < HOLD) say(0); }, 200); }
    return 1 - e;
  }
};
document.getElementById('walkbtn')?.addEventListener('click', () => { unlock(); scrollTo({ top: film.offsetHeight * STOPS[1].at, behavior: reduce ? 'auto' : 'smooth' }); });

// ---------------------------------------------------------------- per frame
let last = performance.now(), idleT = 1, walkT = 45, talkT = 2, activeStop = -1, litNumbers = 0, litDevices = 0, lastPanel = -1, dpr = 1;
function fit() { dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(stage.clientWidth * dpr); canvas.height = Math.round(stage.clientHeight * dpr); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
// mode crossfade (idle / walk / talk) and distance-driven walking
let mode = 'idle', prevMode = null, modeMix = 1, prevCx = null, walkSpeed = 0;
addEventListener('resize', fit); fit();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Math.abs(target - shown) > 0.0005) lastMoveAt = now;
  shown += (target - shown) * (debugP !== null ? 1 : 0.09);
  const p = shown, W = stage.clientWidth, H = stage.clientHeight;

  // where she is: the stop we are at (if inside its hold), else the walk between two stops
  let i = 0; while (i < STOPS.length - 1 && p >= STOPS[i + 1].at) i++;
  const a = STOPS[i], b = STOPS[Math.min(i + 1, STOPS.length - 1)];
  const inA = p <= a.at + HOLD, inB = p >= b.at - HOLD && b !== a;
  const atStop = inA ? i : inB ? i + 1 : -1;
  let x, s, walking = 0, dir = 1;
  if (atStop >= 0) { x = STOPS[atStop].x; s = STOPS[atStop].s; }
  else { const u = ss(a.at + HOLD, b.at - HOLD, p); x = lerp(a.x, b.x, u); s = lerp(a.s, b.s, u); walking = Math.sin(u * Math.PI) > 0.02 ? 1 : 0; dir = b.x >= a.x ? 1 : -1; }

  // the arrival zoom
  const ar = atStop === 0 ? arrival.k() : 0;
  if (!ar && arrival.t0 === null && loaded >= toLoad) arrival.start();

  // her size and place on the stage
  const baseH = H * (mobile ? 0.50 : 0.72) * s;
  const zoom = lerp(1, mobile ? 2.6 : 3.1, ar);
  const h = baseH * zoom, w = h * sprites.idle.meta.fw / sprites.idle.meta.fh;   // the sheet's own cell aspect, not a baked-in 360x640
  const floorY = H * (mobile ? 0.60 : 0.86);
  const cx = W / 2 + x * W * (mobile ? 0.45 : 1) * (1 - ar);
  // when zoomed we look at her face (about 17% down the frame), not her middle
  const faceFrac = 0.17;
  const top = lerp(floorY - h, H * 0.5 - h * faceFrac - h * 0.02, ar);

  // how fast she is really moving across the stage (px/s), smoothed: the walk cycle follows the distance, so the feet match the motion
  const vx = prevCx === null ? 0 : (cx - prevCx) / Math.max(dt, 1e-3); prevCx = cx;
  walkSpeed += (Math.abs(vx) - walkSpeed) * 0.2;
  const strideLen = baseH * 0.62;                         // one full cycle (20 frames) per 0.62 of her height travelled
  const wantWalk = walkSpeed > baseH * 0.05;              // slower than that, she just stands
  const want = (speakingStop === atStop && atStop >= 0 && sprites.talk) ? 'talk' : (wantWalk && sprites.walk) ? 'walk' : 'idle';
  if (want !== mode) { prevMode = mode; mode = want; modeMix = 0; }
  modeMix = Math.min(1, modeMix + dt / 0.14);
  // advance every clock (so the previous mode keeps moving during the crossfade)
  { const [r0, r1] = sprites.idle.meta.range; idleT += dt * sprites.idle.meta.fps; if (idleT > r1) idleT = r0 + (idleT - r1); }
  if (sprites.walk) { const [r0, r1] = sprites.walk.meta.range; walkT += (walkSpeed * dt / strideLen) * (r1 - r0 + 1); while (walkT > r1) walkT -= (r1 - r0 + 1); }
  if (sprites.talk) { const [r0, r1] = sprites.talk.meta.range; talkT += dt * sprites.talk.meta.fps; if (talkT > r1) talkT = r0 + (talkT - r1); }
  const clockOf = m => m === 'talk' ? [sprites.talk, talkT] : m === 'walk' ? [sprites.walk, walkT] : [sprites.idle, idleT];
  const [sp, f] = clockOf(mode);
  const al = sp.meta.align || { dx: 0, dy: 0, scale: 1 };

  // draw: her, and her faint reflection in the floor
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const flip = dir < 0 && mode === 'walk';
  // draw one clip at frame f (a float): the two neighbouring frames blended by the fraction, so 12 fps reads as smooth motion
  const drawClip = (clip, ft, alpha, mirror) => {
    const a2 = clip.meta.align || { dx: 0, dy: 0, scale: 1 };
    const dw = w * a2.scale, dh = h * a2.scale, dx = cx - dw / 2 + a2.dx / clip.meta.fw * w, dy = top + (h - dh) - a2.dy / clip.meta.fh * h;
    // no frame blending: the sheets carry the clip's own 24 fps, so every frame is a real one
    const blend = false;   // the sheets are the clip's own 24 fps now, so there are no missing frames to fake; blending two of them only ghosted her hands
    const [r0, r1] = clip.meta.range, f0 = blend ? Math.floor(ft) : Math.round(ft), fr = blend ? ft - f0 : 0, f1 = f0 + 1 > r1 ? r0 : f0 + 1;
    ctx.save(); if (mirror) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    for (const [ff, wgt] of [[f0, 1], [f1, fr]]) { if (wgt < 0.02) continue; const c = cell(clip, ff); ctx.globalAlpha = alpha * wgt; ctx.drawImage(c.im, c.sx, c.sy, clip.meta.fw, clip.meta.fh, dx, dy, dw, dh); }
    ctx.restore();
  };
  const drawHer = (alphaScale) => {
    if (prevMode && modeMix < 1) { const [ps, pf] = clockOf(prevMode); drawClip(ps, pf, alphaScale * (1 - modeMix), prevMode === 'walk' && dir < 0); }
    drawClip(sp, f, alphaScale * (prevMode && modeMix < 1 ? modeMix : 1), flip);
  };
  drawHer(1);
  if (ar < 0.6) {   // her faint reflection in the floor
    ctx.save(); ctx.translate(0, floorY * 2 + 2); ctx.scale(1, -1); drawHer(0.11 * (1 - ar)); ctx.restore();
    const g = ctx.createLinearGradient(0, floorY, 0, floorY + h * 0.55); g.addColorStop(0, 'rgba(5,5,6,0.35)'); g.addColorStop(1, 'rgba(5,5,6,1)');
    ctx.fillStyle = g; ctx.fillRect(0, floorY, W, H - floorY);
  }

  // the lights follow her
  stage.style.setProperty('--hx', `${(cx / W * 100).toFixed(2)}%`);
  stage.style.setProperty('--hy', `${((top + h * 0.2) / H * 100).toFixed(2)}%`); stage.style.setProperty('--floor', `${(floorY / H * 100).toFixed(2)}%`);

  // stops: panels, status, pool, sweep, the stop's own light, and her line
  if (atStop !== activeStop) {
    if (activeStop >= 0) { stopSpeaking(); pending = null; hear.classList.remove('is-on'); }
    activeStop = atStop;
    if (atStop >= 0) {
      const st = STOPS[atStop]; statusEl.textContent = st.state; pool.classList.add('is-on');
      if (!reduce && atStop > 0) { sweep.classList.remove('go'); void sweep.offsetWidth; sweep.classList.add('go'); }
      litNumbers = 0; litDevices = 0;
    } else { statusEl.textContent = 'WALKING'; pool.classList.remove('is-on'); }
    for (const [name, el] of Object.entries(lights)) el.classList.toggle('is-on', atStop >= 0 && STOPS[atStop].light === name);
  }
  // she speaks once you have settled at a stop (not on the arrival: that waits for the pull-back)
  if (atStop > 0 && speakingStop !== atStop && !spoken.has(atStop) && now - lastMoveAt > 350 && (unlocked || pending === null) && !(pending === atStop)) { say(atStop); if (!unlocked) spoken.add(atStop); }
  if (atStop < 0) for (const k of [...spoken]) { if (Math.abs(p - STOPS[k].at) > 0.1) spoken.delete(k); }   // walk far enough away and she will say it again
  if (atStop === 4 && lights.numbers.classList.contains('is-on')) { litNumbers = Math.min(4, litNumbers + dt * 1.6); lights.numbers.querySelectorAll('b').forEach((el, k) => el.classList.toggle('lit', k < litNumbers)); }
  if (atStop === 6 && lights.devices.classList.contains('is-on')) { litDevices = Math.min(7, litDevices + dt * 1.4); lights.devices.querySelectorAll(':scope > div').forEach((el, k) => el.classList.toggle('lit', k < litDevices)); }

  // panels: the stop's panel is on; while walking nothing is
  const show = atStop >= 0 && (atStop !== 0 || (arrival.done || ar < 0.05)) ? STOPS[atStop].panel : -1;
  if (show !== lastPanel) { panels.forEach((el, k) => el.classList.toggle('is-on', k === show)); lastPanel = show; }

  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- go
(async () => {
  try {
    const sc = await (await fetch('voice/script.json')).json(); Object.assign(SCRIPT, sc.lines);
    sprites.idle = await sheet('idle'); tick('her idle');
    requestAnimationFrame(frame);
    sprites.walk = await sheet('walk'); tick('her walk');
    sprites.talk = await sheet('talk'); tick('her voice');
  } catch (e) { console.error(e); loadtext.textContent = 'could not load her — write to hello@aneeta.ai'; }
})();

// ---------------------------------------------------------------- early access form (same behaviour as J's page)
const form = document.getElementById('signup'), msg = document.getElementById('msg'), email = document.getElementById('email');
const sayMsg = (t, err) => { msg.textContent = t; msg.classList.toggle('is-error', !!err); };
form.addEventListener('submit', async e => {
  e.preventDefault(); const value = email.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { sayMsg('That email does not look right yet.', true); email.focus(); return; }
  if (!SIGNUP_ENDPOINT) { location.href = `mailto:${FALLBACK_MAILTO}?subject=${encodeURIComponent('ANITA early access')}&body=${encodeURIComponent(`Please add ${value} to the early access list.`)}`; sayMsg('Your email app should open. If it does not, write to ' + FALLBACK_MAILTO + '.'); return; }
  try { const r = await fetch(SIGNUP_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value }) }); if (!r.ok) throw new Error(r.status); sayMsg('You are on the list. You will hear from the founder.'); form.reset(); }
  catch { sayMsg(`Could not add you right now. Email ${FALLBACK_MAILTO} instead.`, true); }
});
