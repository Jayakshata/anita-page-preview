// The 2D ANITA in the 3D world.
// Base: her painting as body + head layers (breathing, blinking, tilting to the mouse, expression per beat).
// When full-body clips exist (assets/sprites, from tools/sprites.mjs) the idle clip becomes her base and the layers step aside.
// Switching rule, so no two bodies ever overlap on screen: a clip cuts IN on its frame 0 (the master pose, which the idle
// shares), plays, and when released keeps going to its next "exit" frame (a frame near the master pose, from tools/exits.py)
// and cuts OUT there. The gaze shows whole frames of her, laid over the idle by the measured alignment; only gaze frames
// crossfade with each other (one body), and gaze cuts in and out on its centre frame.
import * as THREE from 'three';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Hero2D {
  constructor({ base = 'assets/2d/', height = 1.62, sprites = 'assets/sprites/' } = {}) {
    this.base = base; this.height = height; this.spritesBase = sprites;
    this.group = new THREE.Group();
    this.state = 'idle'; this.next = null; this.fade = 1; this.blinkT = -1; this.nextBlink = 2.5;
    this.heads = {}; this.clips = {}; this.idle = null; this.gaze = null;
  }

  // ---------------------------------------------------------------- the painting layers (fallback base)
  async load(states = ['idle', 'blink', 'listening', 'thinking', 'happy', 'concerned', 'excited']) {
    const meta = this.meta = await (await fetch(this.base + 'anita2d.json')).json();
    const tl = new THREE.TextureLoader();
    const tex = async url => { const t = await tl.loadAsync(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const px = this.px = this.height / meta.size[1];
    const mat = map => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.01 });
    const bodyTex = await tex(this.base + 'body.webp');
    this.body = new THREE.Mesh(new THREE.PlaneGeometry(meta.size[0] * px, meta.size[1] * px), mat(bodyTex));
    this.body.position.y = meta.size[1] * px / 2; this.body.renderOrder = 1; this.group.add(this.body);
    const h = meta.head; this.headPivot = new THREE.Group();
    this.headPivot.position.set((h.x + h.w / 2 - meta.size[0] / 2) * px, (meta.size[1] - (h.y + h.h)) * px, 0.01); this.group.add(this.headPivot);
    for (const s of states) {
      try { const t = await tex(this.base + `head-${s}.webp`);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(h.w * px, h.h * px), mat(t)); m.position.y = h.h * px / 2; m.material.opacity = s === 'idle' ? 1 : 0;
        m.renderOrder = 2; this.headPivot.add(m); this.heads[s] = m; } catch (e) { console.warn('no head for', s); }
    }
    const sh = await tex(this.base + 'shadow.webp');
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: sh, transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.002; this.group.add(this.shadow);
    return this;
  }

  // ---------------------------------------------------------------- sprite helpers
  async _pages(meta) {
    const tl = new THREE.TextureLoader(); const pages = [];
    for (const f of meta.files) { const t = await tl.loadAsync(this.spritesBase + f); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      t.repeat.set(1 / meta.cols, meta.fh / t.image.height); pages.push(t); }
    return pages;
  }
  _show(sp, f) {   // frame f of a sprite on its mesh: the uv offset picks the cell, nothing is re-uploaded
    const { meta, pages, mesh } = sp; const page = Math.floor(f / meta.perPage), k = f % meta.perPage, tex = pages[page];
    if (mesh.material.map !== tex) { mesh.material.map = tex; mesh.material.needsUpdate = true; }
    const rowsOnPage = tex.image.height / meta.fh; tex.offset.set((k % meta.cols) / meta.cols, 1 - (Math.floor(k / meta.cols) + 1) / rowsOnPage);
  }
  _plane(meta, height, floor, z) {
    const w = height * meta.fw / meta.fh, al = meta.align || { dx: 0, dy: 0, scale: 1 };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), new THREE.MeshBasicMaterial({ map: null, transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.01 }));
    m.position.set(al.dx / meta.fw * w, floor + height / 2 - al.dy / meta.fh * height, z); m.scale.setScalar(al.scale); m.visible = false; this.group.add(m);
    m.userData.homeX = m.position.x; m.userData.base = al.scale; return m;
  }
  _step(sp, dt) {   // advance a sprite: run in from wherever it is, then stay inside the loop range
    const [a, b] = sp.meta.range || [0, sp.meta.frames - 1];
    sp.t += dt * sp.meta.fps * sp.dir;
    if (sp.meta.loop === 'forward') { if (sp.t >= b) sp.t = a + (sp.t - b); }
    else { if (sp.t >= b) { sp.t = b; sp.dir = -1; } else if (sp.t <= a) { sp.t = a; sp.dir = 1; } }
    this._show(sp, Math.round(sp.t));
  }
  _nextExit(c) {   // where to cut away: the frame closest to the master pose within the next two seconds (wrapping inside the loop)
    const [a, b] = c.meta.range || [0, c.meta.frames - 1], pose = c.meta.pose || [], horizon = Math.round(c.meta.fps * 2);
    let best = null, bestD = Infinity, f = Math.floor(c.t);
    for (let i = 1; i <= horizon; i++) { f = f + 1 > b ? a : f + 1; const d = pose[f] !== undefined ? pose[f] : (c.exits.includes(f) ? 0 : 99);
      if (d < bestD) { bestD = d; best = f; } }
    return best === null ? b : best;
  }
  _passed(c, before, at) { return (before <= at && c.t >= at) || (c.t < before && (at >= before || at <= c.t)); }

  // ---------------------------------------------------------------- the full-body clips
  async loadIdle(name = 'idle', { height = 1.74, floor = -0.045 } = {}) {
    const meta = await (await fetch(this.spritesBase + name + '.json')).json(); const pages = await this._pages(meta);
    const m = this._plane(meta, height, floor, 0.015); m.renderOrder = 2; m.visible = true;
    this.idle = { meta, pages, mesh: m, t: (meta.range || [0])[0], dir: 1 }; this.geom = { height, floor };
    this.body.visible = false; this.headPivot.visible = false; for (const h of Object.values(this.heads)) h.visible = false;
    this.shadow.scale.set(1.15, 1.15, 1); return this;
  }
  async loadClip(name) {
    const meta = await (await fetch(this.spritesBase + name + '.json')).json(); const pages = await this._pages(meta);
    const m = this._plane(meta, this.geom.height, this.geom.floor, 0.02); m.renderOrder = 3;
    this.clips[name] = { meta, pages, mesh: m, t: 0, dir: 1, state: 'off', target: 0, exits: meta.exits && meta.exits.length ? meta.exits : [0] }; return this;
  }
  setClip(name, weight) { if (this.clips[name]) this.clips[name].target = weight; }
  async loadGaze(name = 'gaze', table = { centre: 4, r: 40, ur: 50, u: 56, ul: 62, l: 20, dl: 88, d: 90, dr: 100 }) {
    const meta = await (await fetch(this.spritesBase + name + '.json')).json(); const pages = await this._pages(meta);
    const mk = () => { const m = this._plane(meta, this.geom.height, this.geom.floor, 0.018); m.renderOrder = 3; m.material.opacity = 0; return m; };
    this.gaze = { meta, pages, table, a: { meta, pages, mesh: mk() }, b: { meta, pages, mesh: mk() }, frameA: table.centre, frameB: null, mix: 0, on: false, leaving: false };
    return this;
  }
  // kept for the painting-layer base
  setState(s) { if (s !== this.state && this.heads[s]) { this.next = s; this.fade = 0; } }
  setTalking() {}

  // ---------------------------------------------------------------- per frame
  update(dt, { mx = 0, my = 0, camera, breathing = 1, t = 0 } = {}) {
    if (camera) { const p = camera.position; this.group.rotation.y = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z); }
    if (this.idle) return this._updateSprites(dt, mx, my, t);
    // --- painting layers
    const br = Math.sin(t * 1.25) * breathing;
    this.body.scale.y = 1 + 0.004 * br; this.body.position.y = this.meta.size[1] * this.px / 2 * this.body.scale.y;
    this.headPivot.position.y = (this.meta.size[1] - (this.meta.head.y + this.meta.head.h)) * this.px + 0.004 * br;
    this.headPivot.rotation.z += (-mx * 0.07 - this.headPivot.rotation.z) * 0.08;
    this.headPivot.rotation.x += (my * 0.03 - this.headPivot.rotation.x) * 0.08;
    this.body.rotation.z += (-mx * 0.012 - this.body.rotation.z) * 0.05;
    if (this.next) { this.fade = Math.min(1, this.fade + dt / 0.2); const e = ss(0, 1, this.fade);
      for (const [s, m] of Object.entries(this.heads)) m.material.opacity = s === this.next ? e : s === this.state ? 1 - e : 0;
      if (this.fade >= 1) { this.state = this.next; this.next = null; } }
    if (this.heads.blink && !this.next) {
      if (this.blinkT < 0 && t > this.nextBlink) { this.blinkT = t; this.nextBlink = t + 2.5 + Math.random() * 3.5; }
      if (this.blinkT >= 0) { const u = (t - this.blinkT) / 0.14, v = u < 1 ? Math.sin(u * Math.PI) : 0;
        this.heads.blink.material.opacity = v; if (this.heads[this.state]) this.heads[this.state].material.opacity = 1 - v; if (u >= 1) this.blinkT = -1; }
    }
    for (const m of Object.values(this.heads)) m.visible = m.material.opacity > 0.002;
  }

  _updateSprites(dt, mx, my, t) {
    const sp = this.idle; this._step(sp, dt);
    // the whole figure leans a hair toward the mouse
    const lean = 0, shift = 0;   // she does not follow the mouse (J, 09-07)
    sp.mesh.rotation.z += (lean - sp.mesh.rotation.z) * 0.05; sp.mesh.position.x += (shift - sp.mesh.position.x) * 0.05;
    // clips: cut in on frame 0, finish to an exit frame, cut out
    let covered = false;
    const busy = Object.values(this.clips).some(c => c.state !== 'off');   // one clip at a time: the next waits until she has finished
    for (const c of Object.values(this.clips)) {
      if (c.state === 'off' && c.target > 0.5 && !busy) { c.state = 'on'; c.t = 0; c.dir = 1; }
      else if (c.state === 'on' && c.target < 0.5) { c.state = 'leaving'; c.stopAt = this._nextExit(c); }
      else if (c.state === 'leaving' && c.target > 0.5) { c.state = 'on'; }
      if (c.state === 'off') { c.mesh.visible = false; continue; }
      const before = c.t; this._step(c, dt);
      if (c.state === 'leaving' && this._passed(c, before, c.stopAt)) { c.state = 'off'; c.mesh.visible = false; continue; }
      c.mesh.visible = true; c.mesh.material.opacity = 1; covered = true;
      c.mesh.rotation.z = sp.mesh.rotation.z; c.mesh.position.x = c.mesh.userData.homeX + sp.mesh.position.x;
    }
    // gaze: whole frames, one body, cuts on the centre frame
    const gz = this._gazeUpdate(dt, mx, my, covered, t, sp);
    sp.mesh.visible = !covered && !gz;
  }

  _gazeUpdate(dt, mx, my, covered, t, sp) {
    const g = this.gaze; if (!g) return false;
    const vx = mx, vy = -(my + 0.32), d = Math.hypot(vx, vy), ang = (Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360;
    const sect = ['r', 'ur', 'u', 'ul', 'l', 'dl', 'd', 'dr'][Math.round(ang / 45) % 8];
    const want = !covered && d > 0.18, centre = g.table.centre;
    if (want && !g.on) { g.on = true; g.leaving = false; g.frameA = centre; g.frameB = null; g.mix = 0; }
    if (!want && g.on) g.leaving = true; else if (want && g.on) g.leaving = false;
    if (!g.on) { g.a.mesh.visible = g.b.mesh.visible = false; return false; }
    const target = g.leaving ? centre : (d < 0.14 ? centre : g.table[sect]);
    if (target !== g.frameA && target !== g.frameB) { g.frameB = target; g.mix = 0; }
    if (g.frameB !== null) { g.mix = Math.min(1, g.mix + dt / 0.16); if (g.mix >= 1) { g.frameA = g.frameB; g.frameB = null; g.mix = 0; } }
    if (g.leaving && g.frameA === centre && g.frameB === null) { g.on = false; g.a.mesh.visible = g.b.mesh.visible = false; return false; }
    const breath = 1 + 0.004 * Math.sin(t * 1.25);
    for (const [s, f, o] of [[g.a, g.frameA, 1 - g.mix], [g.b, g.frameB, g.mix]]) {
      if (f === null) { s.mesh.visible = false; continue; }
      this._show(s, f); s.mesh.material.opacity = o; s.mesh.visible = o > 0.002;
      s.mesh.scale.set(s.mesh.userData.base, s.mesh.userData.base * breath, 1);
      s.mesh.rotation.z = sp.mesh.rotation.z; s.mesh.position.x = s.mesh.userData.homeX + sp.mesh.position.x;
    }
    return true;
  }
}
