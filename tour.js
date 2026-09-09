// "Let her show you": she walks the page beat by beat and explains each one in her own voice.
// Narration files are optional (assets/voice/<beat>.mp3); without them each beat holds for its reading time with the talk clip.
// Any scroll, wheel, key or click by the visitor ends the tour.
export class Tour {
  constructor({ hero, beats, scrollTo, onBeat, voiceBase = 'assets/voice/' }) {
    this.hero = hero; this.beats = beats; this.scrollTo = scrollTo; this.onBeat = onBeat; this.voiceBase = voiceBase;
    this.on = false; this.audio = null; this.i = -1; this.speaking = 0;
    this._stop = () => this.stop();
  }
  async start() {
    if (this.on) return; this.on = true; this.i = -1;
    // the first user gesture unlocks audio for the whole tour
    this.audio = new Audio(); this.audio.preload = 'auto';
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(e => addEventListener(e, this._stop, { passive: true, once: true }));
    await this._next();
  }
  stop() { if (!this.on) return; this.on = false; this.speaking = 0; if (this.audio) { this.audio.pause(); this.audio.src = ''; } this.onBeat && this.onBeat(null); }
  async _next() {
    if (!this.on) return;
    this.i++; if (this.i >= this.beats.length) { this.stop(); return; }
    const b = this.beats[this.i];
    // walk there: the page scrolls itself at a human pace, she walks while the world moves
    this.onBeat && this.onBeat({ ...b, phase: 'walk' });
    await this.scrollTo(b.at, b.walk || 2200); if (!this.on) return;
    // stand and speak
    this.onBeat && this.onBeat({ ...b, phase: 'talk' }); this.speaking = 1;
    const said = await this._say(b.voice, b.hold || 5000); if (!this.on) return;
    this.speaking = 0; this.onBeat && this.onBeat({ ...b, phase: 'done' });
    await new Promise(r => setTimeout(r, 500));
    await this._next();
  }
  _say(file, fallbackMs) {
    return new Promise(resolve => {
      if (!file) { setTimeout(resolve, fallbackMs); return; }
      const a = this.audio; let done = false; const finish = () => { if (!done) { done = true; resolve(true); } };
      a.onended = finish; a.onerror = () => setTimeout(finish, fallbackMs);
      a.src = this.voiceBase + file; a.play().catch(() => setTimeout(finish, fallbackMs));
    });
  }
}
