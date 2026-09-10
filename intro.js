// The arrival film, before the walk.
//
// Black screen → the film fades up out of it → she is revealed and settles →
// dip back to black → the walk page underneath.
//
// Rules it has to obey:
//   - autoplay only works muted, so it is muted
//   - if the file is missing or refuses to play, get out of the way immediately;
//     the page must never be held hostage by the intro
//   - the page underneath must start at the top, so the hand-over is seamless
//   - ?nointro skips it (and a viewer who has seen it this visit is not shown it again)

const el = document.getElementById('intro');
const vid = document.getElementById('introvid');
const skip = document.getElementById('introskip');
const root = document.documentElement;

const q = new URLSearchParams(location.search);
const force = q.has('intro');                 // ?intro replays it while we are judging it
const seen = !force && sessionStorage.getItem('anita-intro') === 'seen';
const off = q.has('nointro');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let done = false;

function finish() {
  if (done) return;
  done = true;
  try { sessionStorage.setItem('anita-intro', 'seen'); } catch {}
  el.classList.add('is-settling');           // film dips to black
  setTimeout(() => {
    el.classList.add('is-gone');             // black lifts off the page
    root.classList.remove('intro-lock');
    scrollTo(0, 0);                          // hand over at the very start of the walk
    setTimeout(() => el.remove(), 1000);
  }, reduce ? 0 : 600);
}

// never show it: asked not to, already seen this visit, or no film on disk
if (!el || !vid || off || seen) {
  el?.remove();
  root.classList.remove('intro-lock');
} else {
  root.classList.add('intro-lock');
  scrollTo(0, 0);

  vid.addEventListener('ended', finish);
  vid.addEventListener('error', finish);
  skip?.addEventListener('click', finish);

  // if it has not started within a few seconds, assume it never will
  const bail = setTimeout(() => { if (vid.paused) finish(); }, 8000);
  vid.addEventListener('playing', () => clearTimeout(bail), { once: true });

  vid.muted = true;                          // required for autoplay

  // hold on pure black for a beat before she fades up out of it — otherwise a
  // cached film starts instantly and the black is never seen
  const HOLD = reduce ? 0 : 700;

  // start on the frame where her eyes are closed, not at the top of the film.
  // Seek as soon as it can seek, AND again right before play — setting currentTime
  // too early is silently ignored, which is exactly what happened first time.
  const START_AT = 0.9;
  const seek = () => { try { if (vid.currentTime < START_AT) vid.currentTime = START_AT; } catch {} };
  if (vid.readyState >= 2) seek(); else vid.addEventListener('canplay', seek, { once: true });

  // black → fade up on the held frame (eyes closed) → only then let the film run,
  // otherwise the fade eats the beat we came for
  const FADE = reduce ? 0 : 1400;
  setTimeout(() => el.classList.add('is-playing'), HOLD);
  setTimeout(() => { seek(); vid.play().catch(finish); }, HOLD + FADE);
}
