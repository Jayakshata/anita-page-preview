// ANITA landing page — one continuous scene. She stays; the world streams and rises around her as you scroll.
// Before launch: point SIGNUP_ENDPOINT at a real list (POST {email} as JSON). Empty = the button opens an email to FALLBACK_MAILTO.
const SIGNUP_ENDPOINT = "";
const FALLBACK_MAILTO = "hello@aneeta.ai";

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MixamoWalk } from './walk.js';
import { Hero2D } from './hero2d.js';
import { Tour } from './tour.js';

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const deg = THREE.MathUtils.degToRad;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
function rotWorld(node, axis, angle) {            // rotate a bone about a WORLD axis, whatever its own rest axes are
  const pw = node.parent.getWorldQuaternion(new THREE.Quaternion());
  const d = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  node.quaternion.premultiply(pw.clone().invert().multiply(d).multiply(pw));
}
const mobile = matchMedia('(max-width: 700px)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const debug = location.search.includes('debug');
const hero3d = /hero=3d/.test(location.search);   // Dee 09-07: mechanic yes, her 3D body no. The painting is the hero; 3D stays for comparison only

// ---------------------------------------------------------------- page: scroll, captions, nav, sign-up
const caps = [...document.querySelectorAll('.caption, .facts')];
const access = document.getElementById('access');
const hud = document.getElementById('hud'); if (debug) hud.hidden = false;
let target = 0, shown = 0, mx = 0, my = 0, smx = 0, smy = 0;
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
function readScroll() { const m = maxScroll(); target = m > 0 ? clamp(scrollY / m, 0, 1) : 0; }
addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', readScroll);
addEventListener('mousemove', e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; });
readScroll();
// scroll the page over `ms` milliseconds (the tour walks her at a human pace; the eased `shown` follows)
function glide(frac, ms) { return new Promise(res => { const from = scrollY, to = frac * maxScroll(), t0 = performance.now();
  (function step(now) { const u = Math.min(1, (now - t0) / ms), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; scrollTo(0, from + (to - from) * e); if (u < 1) requestAnimationFrame(step); else res(); })(t0); }); }
let hero = null, tour = null, tourBeat = null;
const badge = document.createElement('div'); badge.className = 'tour-badge'; badge.textContent = 'she is showing you around · scroll to take over'; document.body.appendChild(badge);
document.getElementById('tour')?.addEventListener('click', () => {
  if (!hero || tour?.on) return;
  tour = new Tour({ hero, scrollTo: glide, onBeat: b => { tourBeat = b; document.body.classList.toggle('tour-on', !!b); },
    beats: [ { at: 0.20, voice: 'talk.wav', hold: 9000, walk: 3500 }, { at: 0.40, voice: 'memory.wav', hold: 8000, walk: 3200 }, { at: 0.54, voice: 'yours.wav', hold: 7000, walk: 2600 },
             { at: 0.66, voice: 'today.wav', hold: 6000, walk: 2600 }, { at: 0.80, voice: 'robot.wav', hold: 10000, walk: 3500 }, { at: 0.87, voice: 'others.wav', hold: 7000, walk: 2000 }, { at: 1, voice: 'access.wav', hold: 5000, walk: 2600 } ] });
  tour.start();
});
document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault(); scrollTo({ top: +el.dataset.go * maxScroll(), behavior: reduce ? 'auto' : 'smooth' });
}));
function placeCaptions(p) {
  caps.forEach(el => { const at = +el.dataset.at, o = ss(0, 1, 1 - Math.abs(p - at) / 0.075);
    el.style.opacity = o.toFixed(3); el.style.transform = `translateY(${((1 - o) * 14).toFixed(1)}px)`; el.classList.toggle('is-on', o > 0.5);
    el.querySelectorAll('.lines li').forEach((li, i) => li.classList.toggle('is-on', p > at - 0.03 + i * 0.012)); });
  access.classList.toggle('is-on', p > 0.968);
}
// sign-up: same behaviour as the earlier build, so nothing changes for whoever wires the list
const form = document.getElementById('signup'), msg = document.getElementById('msg'), email = document.getElementById('email');
const say = (text, isError) => { msg.textContent = text; msg.classList.toggle('is-error', !!isError); };
form.addEventListener('submit', async e => {
  e.preventDefault();
  const value = email.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { say('That email does not look right yet.', true); email.focus(); return; }
  if (!SIGNUP_ENDPOINT) {
    const subject = encodeURIComponent('ANITA early access'), body = encodeURIComponent(`Please add ${value} to the early access list.`);
    location.href = `mailto:${FALLBACK_MAILTO}?subject=${subject}&body=${body}`;
    say('Your email app should open. If it does not, write to ' + FALLBACK_MAILTO + '.'); return;
  }
  try {
    const res = await fetch(SIGNUP_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value }) });
    if (!res.ok) throw new Error(res.status);
    say('You are on the list. You will hear from the founder.'); form.reset();
  } catch { say(`Could not add you right now. Email ${FALLBACK_MAILTO} instead.`, true); }
});

// ---------------------------------------------------------------- can we draw her?
const canvas = document.getElementById('gl');
const load = document.getElementById('load'), loadbar = document.getElementById('loadbar'), loadtext = document.getElementById('loadtext');
let gl = null; try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch {}
if (!gl) {
  // no WebGL: the painting stands in, the words still scroll
  canvas.remove(); document.getElementById('still').hidden = false; load.classList.add('is-done');
  (function still() { shown += (target - shown) * 0.1; placeCaptions(shown); requestAnimationFrame(still); })();
} else { start(); }

function start() {
// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x02070d, 0.0072);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1200);
scene.add(new THREE.HemisphereLight(0x8fd8ff, 0x050a12, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(3, 6, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x58e6ff, 2.2); rim.position.set(-3, 4, -5); scene.add(rim);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.4, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function fit() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', fit); fit();

// ---------------------------------------------------------------- the floor: an endless grid that streams when she walks
const grid = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uOffset: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0x19c8ff) } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uOffset, uOpacity; uniform vec3 uColor; varying vec3 vW;
    float line(float x){ float g = abs(fract(x - 0.5) - 0.5) / fwidth(x); return 1.0 - smoothstep(0.0, 1.3, g); }
    void main(){ float cell = 2.0; float l = max(line(vW.x / cell), line((vW.z + uOffset) / cell));
      float d = length(vW.xz); float fade = exp(-d * d * 0.00045) * smoothstep(0.0, 6.0, d);
      gl_FragColor = vec4(uColor * (0.55 + 0.45 * fade), l * fade * uOpacity); }`
}));
grid.rotation.x = -Math.PI / 2; grid.position.y = 0.005; scene.add(grid);

// ---------------------------------------------------------------- memory: a constellation around her
const memory = new THREE.Group(); scene.add(memory);
{
  const n = 260, pos = new Float32Array(n * 3), pts = []; let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) { const r = 2.6 + rnd() * 4.5, a = rnd() * Math.PI * 2, y = 0.3 + rnd() * 3.2;
    const p = [Math.cos(a) * r, y, Math.sin(a) * r]; pts.push(p); pos.set(p, i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9df3ff, size: 0.05, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const lines = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = pts[i], b = pts[j]; if (Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) < 1.15) lines.push(...a, ...b); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3));
  const segs = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x35b8d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  memory.add(dots, segs); memory.userData = { dots, segs };
}

// ---------------------------------------------------------------- the city (J's Blender exports)
const world = new THREE.Group(); scene.add(world);
const pieces = [];
const loader = new GLTFLoader();
let loaded = 0; const total = 10;
function tick() {
  loaded++; loadbar.style.width = `${Math.round(loaded / total * 100)}%`;
  if (loaded >= total) { loadtext.textContent = 'ready'; load.classList.add('is-done'); }
}
function tune(root, glow) {
  root.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (m.emissiveIntensity > 1) m.emissiveIntensity = glow; else { m.color.setHex(0x0c1a2c); m.roughness = 0.85; m.metalness = 0; } m.fog = true; } } });
  return root;
}
function piece(file, opts) {
  loader.load('assets/' + file, g => {
    const obj = tune(g.scene, opts.e || 2.0); obj.scale.setScalar(opts.s || 1); obj.visible = false;
    if (opts.ry) obj.rotation.y = opts.ry;
    world.add(obj); pieces.push({ obj, place: opts.place }); tick();
  }, undefined, e => { console.error(file, e); tick(); });
}
const pass = (x, y, z0, z1, a, b) => (obj, p) => { const u = (p - a) / (b - a); obj.visible = u > 0 && u < 1; if (obj.visible) obj.position.set(x, y, lerp(z0, z1, u)); };
const rise = (x, z, h, a, b) => (obj, p) => { const u = ss(a, b, p); obj.visible = u > 0; obj.position.set(x, lerp(-h, 0, u), z); };
piece('FarCity.glb',     { s: 0.35, e: 1.15, place: (o, p) => { o.visible = p > 0.05 && !(p > 0.52 && p < 0.62); o.position.set(0, -2 + 2 * ss(0.05, 0.2, p), -40); } });
piece('HeroMonolith.glb',{ s: 0.16, place: pass(-11, 0, -260, 30, 0.08, 0.26) });
piece('Wing.glb',        { s: 0.20, place: pass( 13, 0, -300, 30, 0.12, 0.32), ry: Math.PI });
piece('Overhang.glb',    { s: 0.22, place: pass(-14, 0, -320, 30, 0.26, 0.40) });
piece('Monorail.glb',    { s: 0.22, place: (o, p) => { const u = (p - 0.60) / 0.14; o.visible = u > 0 && u < 1; o.position.set(lerp(70, -70, u), 9, -60); }, ry: Math.PI / 2 });
piece('BladeTower.glb',  { s: 0.55, place: rise(-34, -75, 50, 0.70, 0.82) });
piece('Twins.glb',       { s: 0.55, place: rise( 40, -68, 60, 0.73, 0.85) });
piece('Terrace.glb',     { s: 0.80, place: rise(-78, -150, 76, 0.76, 0.88) });
piece('GatewayArch.glb', { s: 0.32, e: 1.25, place: (o, p) => { const u = ss(0.74, 0.90, p); o.visible = u > 0; o.position.set(0, lerp(-12, 0, u), lerp(-170, -40, u)); } });

// ---------------------------------------------------------------- her
let model = null, mixer = null, walk = null, height = 1.6;
const bones = {}, idle = {}, restWorld = {}, blink = []; let hipsRest = null, hipsIdleWorld = null, rootRest = null, walkRig = null;
function relaxArms() {   // the file is a T-pose: curl the fingers while the palms still face down, then drop the arms
  for (const side of ['L', 'R']) {
    const up = bones[`J_Bip_${side}_UpperArm`], low = bones[`J_Bip_${side}_LowerArm`], hand = bones[`J_Bip_${side}_Hand`];
    if (!up) continue;
    const p = up.getWorldPosition(new THREE.Vector3()), c = (low || up).getWorldPosition(new THREE.Vector3());
    const dir = Math.sign(c.x - p.x) || (side === 'L' ? 1 : -1);
    for (const f of ['Index', 'Middle', 'Ring', 'Little']) [16, 26, 22].forEach((a, i) => { const b = bones[`J_Bip_${side}_${f}${i + 1}`]; if (b) rotWorld(b, Z, -dir * deg(a)); });
    [8, 14].forEach((a, i) => { const b = bones[`J_Bip_${side}_Thumb${i + 2}`]; if (b) rotWorld(b, Y, dir * deg(a)); });
    rotWorld(up, Z, -dir * deg(76)); rotWorld(up, X, deg(-5));
    if (low) rotWorld(low, X, deg(-16));
    if (hand) { rotWorld(hand, Z, -dir * deg(10)); rotWorld(hand, X, deg(-6)); }
  }
}
if (!hero3d) {
  new Hero2D({ height: 1.62 }).load().then(h => h.loadIdle('idle').catch(() => h)).then(h => h.loadClip('walk').catch(() => h)).then(h => h.loadClip('talk').catch(() => h)).then(h => { hero = h; scene.add(h.group); if (debug) window.__hero = h; tick(); tick(); }, e => { console.error(e); loadtext.textContent = 'could not load her — write to hello@aneeta.ai'; });
}
if (hero3d) loader.load('assets/anita.glb', gltf => {
  model = gltf.scene;
  model.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) { o.frustumCulled = false;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { if (!m) continue; m.roughness = 1; m.metalness = 0;
        if (m.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity = 1.35; }
      if (o.morphTargetDictionary && 'Fcl_EYE_Close' in o.morphTargetDictionary) blink.push([o, o.morphTargetDictionary['Fcl_EYE_Close']]); }
  });
  scene.add(model); model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model); height = box.max.y - box.min.y;
  model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  model.updateMatrixWorld(true);
  for (const b of Object.values(bones)) restWorld[b.name] = b.getWorldQuaternion(new THREE.Quaternion());   // the T-pose, what the Mixamo walk is measured against
  relaxArms();
  for (const b of Object.values(bones)) idle[b.name] = b.quaternion.clone();
  if (bones.J_Bip_C_Hips) { hipsRest = bones.J_Bip_C_Hips.position.clone(); hipsIdleWorld = bones.J_Bip_C_Hips.getWorldQuaternion(new THREE.Quaternion()); }
  if (bones.Root) rootRest = bones.Root.position.clone();
  if (debug) window.__dbgObjs = { camera, model, bones, scene };
  tick();
  // her walk: the Mixamo clip retargeted onto her bones live (walk.js); if that file fails, the code walk below stands in
  new MixamoWalk(bones, restWorld, hipsRest, idle).load('assets/Mixamo_Walk.fbx').then(w => { walkRig = w; tick(); }, e => { console.error('walk', e); tick(); });
}, undefined, e => { console.error(e); loadtext.textContent = 'could not load her — write to hello@aneeta.ai'; });

// ---------------------------------------------------------------- per frame
let last = performance.now(), fps = 0, gridOffset = 0, walkPhase = 0, nextBlink = 2, blinkT = -1;
document.addEventListener('visibilitychange', () => { last = performance.now(); });
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; fps = fps * 0.9 + (1 / Math.max(dt, 1e-3)) * 0.1;
  shown += (target - shown) * 0.07; smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
  const p = shown, t = now / 1000;

  // she walks between the talk and the memory, and again towards the arch; talking while walking never happens
  const walking = ss(0.08, 0.13, p) * (1 - ss(0.15, 0.18, p)) + ss(0.26, 0.29, p) * (1 - ss(0.35, 0.38, p)) + ss(0.70, 0.73, p) * (1 - ss(0.78, 0.82, p));
  const gridOn = ss(0.02, 0.10, p) * (1 - ss(0.50, 0.55, p) * 0.75 + ss(0.60, 0.64, p) * 0.75) * (1 - ss(0.86, 0.93, p) * 0.6);
  const mem = ss(0.34, 0.40, p) * (1 - ss(0.46, 0.51, p));
  const dim = ss(0.50, 0.55, p) * (1 - ss(0.60, 0.64, p));   // 'yours': the city fades to just her
  gridOffset += dt * (walkRig ? 1.6 : 1.35) * walking;   // the floor moves at her stride
  grid.material.uniforms.uOffset.value = gridOffset;
  grid.material.uniforms.uOpacity.value = gridOn * 0.75;
  memory.rotation.y = t * 0.06; memory.userData.dots.material.opacity = mem; memory.userData.segs.material.opacity = mem * 0.55;
  for (const { obj, place } of pieces) place(obj, p);

  const orbit = reduce ? 0 : Math.sin(p * Math.PI * 2) * deg(14);
  const back = ss(0.70, 0.90, p) * (1 - ss(0.91, 0.96, p) * 0.5);   // pull back for the city, come halfway back for the last words
  const dist = lerp(4.9, 9.2, back) * (1 + 0.04 * Math.sin(p * Math.PI)) * (mobile ? 1.45 : 1);
  const camH = lerp(1.05, 2.1, back);
  camera.position.set(Math.sin(orbit) * dist + smx * 0.35, camH + smy * -0.15, Math.cos(orbit) * dist);
  camera.lookAt(0, lerp(0.92, 1.05, back), 0);

  if (hero) {
    // beats: what she does while the world moves. The painting cannot walk; the world streams past her instead.
    const beat = p < 0.32 ? 'idle' : p < 0.46 ? 'listening' : p < 0.60 ? 'idle' : p < 0.74 ? 'happy' : 'idle';
    hero.setState(beat);
    if (tourBeat) { hero.setClip('walk', tourBeat.phase === 'walk' ? 1 : 0); hero.setClip('talk', tourBeat.phase === 'talk' ? 1 : 0); }
    else { hero.setClip('walk', walking);                                                   // she walks while the world streams past
           hero.setClip('talk', ss(0.15, 0.18, p) * (1 - ss(0.25, 0.28, p))); }             // and talks with her hands in the talk beat
    hero.update(dt, { mx: smx, my: smy, camera, t, breathing: 1 });
  }
  if (model) {
    // her walk is procedural: a calm walk in place, driven by scroll. No clip: the retargeted one had broken arms and a twisted chest.
    for (const b of Object.values(bones)) if (idle[b.name]) b.quaternion.copy(idle[b.name]);
    walkPhase += dt * 0.95 * walking;
    if (walkRig) walkRig.update(dt, walking, 1.0);
    else if (walking > 0.001) {
      const ph = walkPhase * Math.PI * 2, w = walking;
      for (const [side, s] of [['L', 0], ['R', Math.PI]]) {
        const a = ph + s, ul = bones[`J_Bip_${side}_UpperLeg`], ll = bones[`J_Bip_${side}_LowerLeg`], ft = bones[`J_Bip_${side}_Foot`], ua = bones[`J_Bip_${side}_UpperArm`], la = bones[`J_Bip_${side}_LowerArm`];
        if (ul) rotWorld(ul, X, deg(24) * Math.sin(a) * w);                                   // thigh swings back and forward
        if (ll) rotWorld(ll, X, -deg(30) * Math.max(0, Math.sin(a - 1.3)) * w);               // knee bends as the leg swings through
        if (ft) rotWorld(ft, X, deg(8) * Math.sin(a) * w);
        if (ua) rotWorld(ua, X, -deg(17) * Math.sin(a) * w);                                  // arms counter-swing
        if (la) rotWorld(la, X, -deg(10) * Math.max(0, -Math.sin(a)) * w);
      }
      rotWorld(bones.J_Bip_C_Hips, Y, deg(5) * Math.sin(ph) * w); rotWorld(bones.J_Bip_C_Hips, Z, deg(2.5) * Math.sin(ph) * w);
      if (bones.J_Bip_C_Chest) rotWorld(bones.J_Bip_C_Chest, Y, -deg(6) * Math.sin(ph) * w);
      if (bones.J_Bip_C_Spine) rotWorld(bones.J_Bip_C_Spine, X, deg(2) * w);
    }
    if (!walkRig && hipsRest) bones.J_Bip_C_Hips.position.set(hipsRest.x, hipsRest.y - (0.025 * Math.abs(Math.sin(walkPhase * Math.PI * 2)) - 0.01) * walking, hipsRest.z);
    model.rotation.y = smx * deg(3);
    if (!reduce) for (const side of ['L', 'R']) { const up = bones[`J_Bip_${side}_UpperArm`]; if (up) rotWorld(up, X, 0.018 * Math.sin(t * 0.9 + (side === 'L' ? 0 : 1.7)) * (1 - walking)); }
    const yaw = smx * 0.5 - orbit * 0.6, pitch = smy * 0.25;
    const share = { J_Bip_C_Chest: 0.10, J_Bip_C_UpperChest: 0.12, J_Bip_C_Neck: 0.22, J_Bip_C_Head: 0.56 };
    for (const [n, f] of Object.entries(share)) { const b = bones[n]; if (!b) continue;
      if (n === 'J_Bip_C_Chest') rotWorld(b, X, 0.02 * Math.sin(t * 1.3) * (1 - walking));
      rotWorld(b, Y, yaw * f); rotWorld(b, X, pitch * f); }
    if (blink.length) {
      if (blinkT < 0 && t > nextBlink) { blinkT = t; nextBlink = t + 2.5 + Math.random() * 3; }
      if (blinkT >= 0) { const u = (t - blinkT) / 0.16, v = u < 1 ? Math.sin(u * Math.PI) : 0;
        for (const [m, i] of blink) m.morphTargetInfluences[i] = v; if (u >= 1) blinkT = -1; }
    }
  }
  placeCaptions(p);
  bloom.strength = 0.55 + 0.1 * ss(0.70, 0.9, p) - 0.25 * dim;
  composer.render();
  if (debug) hud.textContent = `p ${p.toFixed(2)} · walk ${walking.toFixed(2)} · ${fps.toFixed(0)} fps`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
