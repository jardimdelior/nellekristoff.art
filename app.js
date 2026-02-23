// app.js (WAAPI deterministic 3D core + stable Active UI + correct panel width
//        + THEATRICAL “FEATHER BUBBLE” + TRAVELING WAVE + VIRTUAL INDEX WRAP FIX)
//
// Upgrades:
// - Wave now TRAVELS left -> right (per-panel peak timing based on signed virtual distance d)
// - Stronger bubble (extra Z + rotateX + rotateY + tiny scale “breath”)
// - Strength computed from VIRTUAL distance (ad) -> wrap stays smooth (3 -> 1)
// - Extra stable Z-bias + per-panel Z shim + backface hints -> reduces corner “sticking through”
// - Active panel stays calmer; side panels get most bend
// - Only active panel click/keydown opens fullscreen (no side jump)

document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

/* ===== Works ===== */
const works = [
  { src:"images/Untitled1.png", title:"Untitled 1", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled2.png", title:"Untitled 2", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled3.png", title:"Untitled 3", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];

works.forEach(w => { const i = new Image(); i.src = w.src; });

/* Contact */
window.contact = function contact(e){
  if (e) e.preventDefault();
  window.location.href = "mailto:nellekristoff@gmail.com";
};

/* helpers */
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function numPx(v){ return parseFloat(String(v).replace('px','')) || 0; }
function numDeg(v){ return parseFloat(String(v).replace('deg','')) || 0; }
function num(v){ return parseFloat(v) || 0; }

// --- virtual index helpers (prevents wrap “triple flap”) ---
function mod(n, m){ return ((n % m) + m) % m; }
function nearestVirtual(i, targetPos, n){
  const k = Math.round((targetPos - i) / n);
  return i + k * n;
}

document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("ready");

  const viewport  = document.getElementById('viewport');
  const spacePan  = document.getElementById('spacePan');
  const spaceZoom = document.getElementById('spaceZoom');

  /* ===== Menu ===== */
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const header = document.querySelector('.film-header');

  function setMenu(open){
    if (!menuBtn || !menu) return;
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (header) header.classList.toggle('menu-open', open);
  }

  if (menuBtn && menu){
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu(!menu.classList.contains('open'));
    });

    menu.addEventListener('click', (e) => e.stopPropagation());
    if (header) header.addEventListener('click', (e) => e.stopPropagation());

    const headerRight = document.querySelector('.header-right');
    if (headerRight) headerRight.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', () => setMenu(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ===== Smooth pan/zoom (viewport) ===== */
  let zoom = 1, panX = 0, panY = 0;
  let tZoom = 1, tPanX = 0, tPanY = 0;
  let animRaf = null;

  function zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
  function zoomMax(){ return num(cssVar('--zoomMax')) || 2.2; }

  function clampPanTarget(){
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const maxX = (rect.width  * (tZoom - 1)) / 2;
    const maxY = (rect.height * (tZoom - 1)) / 2;
    tPanX = clamp(tPanX, -maxX, maxX);
    tPanY = clamp(tPanY, -maxY, maxY);
  }

  function applyView(){
    if (!spacePan || !spaceZoom) return;
    const zoomZ = Math.max(0, (zoom - 1)) * 320;
    spaceZoom.style.setProperty('--zoom', zoom);
    spaceZoom.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
    spacePan.style.setProperty('--panX', panX + 'px');
    spacePan.style.setProperty('--panY', panY + 'px');
  }

  function ensureAnim(){
    if (animRaf) return;
    const ease = 0.22;
    const tick = () => {
      zoom += (tZoom - zoom) * ease;
      panX += (tPanX - panX) * ease;
      panY += (tPanY - panY) * ease;
      applyView();

      const done =
        Math.abs(tZoom - zoom) < 0.001 &&
        Math.abs(tPanX - panX) < 0.15 &&
        Math.abs(tPanY - panY) < 0.15;

      if (done){
        zoom = tZoom; panX = tPanX; panY = tPanY;
        applyView();
        animRaf = null;
        return;
      }
      animRaf = requestAnimationFrame(tick);
    };
    animRaf = requestAnimationFrame(tick);
  }

  function setZoomAt(newZoom, cx, cy){
    newZoom = clamp(newZoom, zoomMin(), zoomMax());
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const ccx = cx - rect.width  / 2;
    const ccy = cy - rect.height / 2;

    const baseZoom = zoom;
    const k = newZoom / baseZoom;

    tPanX = (panX - ccx) * k + ccx;
    tPanY = (panY - ccy) * k + ccy;

    tZoom = newZoom;
    clampPanTarget();
    ensureAnim();
  }

  function addPan(dx, dy){
    tPanX += dx;
    tPanY += dy;
    clampPanTarget();
    ensureAnim();
  }

  /* ===== Leporello + WAAPI ===== */
  const lep = document.getElementById('leporello');
  const panels = [];

  function getPanelW(){
    const p = panels[0];
    if (!p) return 0;
    const r = p.getBoundingClientRect();
    return r.width || parseFloat(getComputedStyle(p).width) || 0;
  }

  // Single-line transform string (less Safari jitter)
  function buildT(x, z, rotY, extraZ = 0, extraRotY = 0, extraRotX = 0, extraScale = 1){
    return `translate3d(-50%, -50%, 0) translate3d(${x}px, 0px, ${z + extraZ}px) rotateY(${rotY + extraRotY}deg) rotateX(${extraRotX}deg) scale(${extraScale})`;
  }

  // Motion feel (theatre / float)
  const DURATION = 2700;
  const EASING   = 'cubic-bezier(.12,.86,.18,1)';

  // THEATRICAL air-wave tuning (more visible)
  const WAVE_Z     = 110;    // towards viewer (+) -> BIG bubble
  const WAVE_ROT   = 16;     // extra Y bend (sides)
  const WAVE_X     = -6.5;  // rotateX peak (paper breathing)
  const WAVE_S     = 1.022;  // breath scale
  const WAVE_TWIST = 5.0;    // subtle alternating drama

  // TRAVEL timing
  const TRAVEL_SPREAD = 0.20; // bigger = wave travels more clearly across left->right

  // --- VIRTUAL active position (fixes wrap) ---
  let activePos = 0;        // ... -1,0,1,2,3 ...
  let animating = false;
  let queuedDir = 0;

  function activeIdx(){ return mod(activePos, works.length); }
  function activePanelIdx(){ return mod(activePos, (panels.length || works.length)); }

  // Active UI
  const activeUI = document.getElementById('activeUI');
  const amTitle = document.getElementById('amTitle');
  const amStatus = document.getElementById('amStatus');
  const activeCollect = document.getElementById('activeCollect');

  function cancelAnim(el){
    if (!el || typeof el.getAnimations !== 'function') return;
    el.getAnimations().forEach(a => a.cancel());
  }
  function cancelAll(){
    panels.forEach(cancelAnim);
    cancelAnim(activeUI);
  }

  function getTargets(targetPos){
    const panelW = getPanelW();
    const angleStep = numDeg(cssVar('--angleStep'));
    const maxAngle  = numDeg(cssVar('--maxAngle'));
    const zStep     = numPx(cssVar('--zStep'));
    const xStepPct  = num(cssVar('--xStep')) / 100;
    const stepX     = panelW * xStepPct;

    // Bigger stable separation to reduce z-fight shimmer / corner poke-through
    const Z_BIAS = 2.4;

    const n = panels.length || works.length;

    return panels.map((_, i) => {
      const iV = nearestVirtual(i, targetPos, n);
      const d  = iV - targetPos;
      const ad = Math.abs(d);

      const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
      const x   = (d === 0) ? 0 : d * stepX;

      // z tied to DOM order + tiny constant shim so panels never share exact depth
      const Z_SHIM = (i + 1) * 0.45; // always unique per panel
      const z = (d === 0) ? 0 : (-ad * zStep) - (i * Z_BIAS) - Z_SHIM;

      const op  = (d === 0) ? 1 : clamp(1 - ad * 0.05, 0.70, 1);

      return {
        d, ad, x, z, rot,
        opacity: String(op),
        transform: buildT(x, z, rot)
      };
    });
  }

  function syncActiveUIText(pos){
    const w = works[mod(pos, works.length)] || works[0];
    if (!w) return;
    if (amTitle) amTitle.textContent = w.title || "Untitled";
    if (amStatus) amStatus.textContent = w.status || "Unveiling soon";
    if (activeCollect) activeCollect.href = w.collect || "https://collect.nellekristoff.art";
  }

  function setActiveUITransformFromPanel(panelEl){
    if (!activeUI || !panelEl) return;
    activeUI.style.transform = panelEl.style.transform || "";
    activeUI.style.width = getComputedStyle(panelEl).width;
    activeUI.style.height = getComputedStyle(panelEl).height;
    activeUI.style.left = getComputedStyle(panelEl).left;
    activeUI.style.top  = getComputedStyle(panelEl).top;
  }

  function applyInstant(pos){
    cancelAll();
    const t = getTargets(pos);
    panels.forEach((el, i) => {
      el.style.transform = t[i].transform;
      el.style.opacity = t[i].opacity;
    });
    syncActiveUIText(pos);
    setActiveUITransformFromPanel(panels[mod(pos, panels.length)]);
  }

  // Feather from VIRTUAL distance:
  function featherFrom(ad){
    return clamp(ad / 2, 0, 1);
  }

  function animateBetween(fromPos, toPos){
    cancelAll();

    const from = getTargets(fromPos);
    const to   = getTargets(toPos);

    // lock exact starting state
    panels.forEach((el, i) => {
      el.style.transform = from[i].transform;
      el.style.opacity   = from[i].opacity;
    });

    syncActiveUIText(fromPos);
    setActiveUITransformFromPanel(panels[mod(fromPos, panels.length)]);

    // Base offsets for the bubble (these get shifted per-panel for travel)
    const BASE_O1 = 0.26;
    const BASE_O2 = 0.52;
    const BASE_O3 = 0.76;

    // Determine range of d currently visible to normalize travel phase
    const maxD = Math.max(1, ...from.map(p => Math.abs(p.d || 0)));
    const denom = 2 * maxD; // maps [-maxD..+maxD] -> [0..1]

    const anims = panels.map((el, i) => {
      const f = featherFrom(from[i].ad);

      // Strength: even center breathes (so middle gets bubble too)
      const strength = 0.52 + 0.72 * f; // 0.52..1.24

      // Travel phase: left early, right late
      const phase = clamp(((from[i].d || 0) + maxD) / denom, 0, 1);

      // Shift the peak times so the wave sweeps left -> right
      const shift = (phase - 0.5) * TRAVEL_SPREAD; // -..+
      const O1 = clamp(BASE_O1 + shift, 0.10, 0.70);
      const O2 = clamp(BASE_O2 + shift, 0.20, 0.86);
      const O3 = clamp(BASE_O3 + shift, 0.30, 0.95);

      // Multi-peak bubble: rise -> peak -> ripple -> settle
      const z1 = WAVE_Z * (0.20 * strength);
      const z2 = WAVE_Z * (0.62 * strength);
      const z3 = WAVE_Z * (0.34 * strength);

      // extra Y bend only when already rotated (keep active flatter)
      const ry1 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.16 * strength));
      const ry2 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.50 * strength));
      const ry3 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.26 * strength));

      // “paper breath” rotateX
      const rx1 = WAVE_X * (0.22 * strength);
      const rx2 = WAVE_X * (0.74 * strength);
      const rx3 = WAVE_X * (0.34 * strength);

      // tiny scale breath
      const s1 = 1 + ((WAVE_S - 1) * (0.20 * strength));
      const s2 = 1 + ((WAVE_S - 1) * (0.70 * strength));
      const s3 = 1 + ((WAVE_S - 1) * (0.35 * strength));

      // subtle twist (alternating)
      const twist = (i % 2 === 0 ? 1 : -1) * WAVE_TWIST * f;
      const mid1  = buildT(from[i].x, from[i].z, from[i].rot, z1, ry1 + twist * 0.22, rx1, s1);
      const mid2  = buildT(from[i].x, from[i].z, from[i].rot, z2, ry2 + twist * 0.55, rx2, s2);
      const mid3  = buildT(from[i].x, from[i].z, from[i].rot, z3, ry3 + twist * 0.35, rx3, s3);

      return el.animate(
        [
          { transform: from[i].transform, opacity: from[i].opacity, offset: 0 },
          { transform: mid1,              opacity: from[i].opacity, offset: O1 },
          { transform: mid2,              opacity: from[i].opacity, offset: O2 },
          { transform: mid3,              opacity: from[i].opacity, offset: O3 },
          { transform: to[i].transform,   opacity: to[i].opacity,   offset: 1 }
        ],
        { duration: DURATION, easing: EASING, fill: 'forwards' }
      );
    });

    // Active UI follows with calmer wave (buttons feel stable)
    let uiAnim = null;
    if (activeUI){
      const fromPanelIndex = mod(fromPos, panels.length);
      const toPanelIndex   = mod(toPos, panels.length);

      const uiFrom = from[fromPanelIndex].transform;
      const uiTo   = to[toPanelIndex].transform;

      const fUI = 0.55;

      const z1 = WAVE_Z * (0.12 + 0.22 * fUI);
      const z2 = WAVE_Z * (0.26 + 0.44 * fUI);
      const z3 = WAVE_Z * (0.16 + 0.30 * fUI);

      const rx1 = WAVE_X * (0.10 + 0.20 * fUI);
      const rx2 = WAVE_X * (0.22 + 0.40 * fUI);
      const rx3 = WAVE_X * (0.14 + 0.26 * fUI);

      const s1  = 1 + ((WAVE_S - 1) * (0.10 + 0.18 * fUI));
      const s2  = 1 + ((WAVE_S - 1) * (0.22 + 0.40 * fUI));
      const s3  = 1 + ((WAVE_S - 1) * (0.14 + 0.26 * fUI));

      // keep UI offsets fixed (no left->right travel) so it feels anchored
      const O1 = BASE_O1, O2 = BASE_O2, O3 = BASE_O3;

      const uiMid1 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z1, 0, rx1, s1);
      const uiMid2 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z2, 0, rx2, s2);
      const uiMid3 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z3, 0, rx3, s3);

      uiAnim = activeUI.animate(
        [
          { transform: uiFrom,  offset: 0 },
          { transform: uiMid1,  offset: O1 },
          { transform: uiMid2,  offset: O2 },
          { transform: uiMid3,  offset: O3 },
          { transform: uiTo,    offset: 1 }
        ],
        { duration: DURATION, easing: EASING, fill: 'forwards' }
      );
    }

    return Promise.allSettled([
      ...anims.map(a => a.finished),
      uiAnim ? uiAnim.finished : Promise.resolve()
    ]).then(() => {
      cancelAll();
      panels.forEach((el, i) => {
        el.style.transform = to[i].transform;
        el.style.opacity   = to[i].opacity;
      });

      syncActiveUIText(toPos);
      setActiveUITransformFromPanel(panels[mod(toPos, panels.length)]);
    });
  }

  function runQueued(){
    if (queuedDir === 0) return;
    const dir = Math.sign(queuedDir);
    queuedDir -= dir;
    step(dir);
  }

  function step(dir){
    if (works.length < 2) return;

    if (animating){
      queuedDir += dir;
      return;
    }

    animating = true;

    const fromPos = activePos;
    const toPos   = activePos + dir; // ALWAYS one step (no modulo jump)

    animateBetween(fromPos, toPos).then(() => {
      activePos = toPos;
      animating = false;
      runQueued();
    });
  }

  function next(){ step(+1); }
  function prev(){ step(-1); }

  /* Build panels */
  if (lep){
    works.forEach((w, idx) => {
      const el = document.createElement('div');
      el.className = 'panel';
      el.tabIndex = 0;

      // Stability hints (helps “corner poking” in some GPUs)
      el.style.backfaceVisibility = 'hidden';
      el.style.transformStyle = 'preserve-3d';
      el.style.transformOrigin = '50% 50%';

      el.innerHTML = `
        <div class="print">
          <img src="${w.src}" alt="${w.title}" draggable="false">
          <div class="noise"></div>
        </div>
      `;

      // Backface on inner elements too (helps on iOS/Safari)
      const pr = el.querySelector('.print');
      if (pr){
        pr.style.backfaceVisibility = 'hidden';
        pr.style.transformStyle = 'preserve-3d';
      }

      const im = el.querySelector('img');
      if (im){
        im.style.backfaceVisibility = 'hidden';
        im.addEventListener('dragstart', (e) => e.preventDefault());
        im.addEventListener('mousedown', (e) => e.preventDefault());
        im.addEventListener('contextmenu', (e) => e.preventDefault());
      }

      // Only ACTIVE panel reacts to click (no side jump)
      el.addEventListener('click', () => {
        if (animating) return;
        if (idx !== activePanelIdx()) return;
        const selectButton = document.getElementById('selectBtn');
        if (selectButton) selectButton.click();
      });

      // Also prevent side-jump on keyboard
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (animating) return;
        if (idx !== activePanelIdx()) return;
        const selectButton = document.getElementById('selectBtn');
        if (selectButton) selectButton.click();
      });

      lep.appendChild(el);
      panels.push(el);
    });
  }

  // Arrow click (right)
  const arrowRight = document.getElementById('arrowRight');
  if (arrowRight){
    arrowRight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      next();
    });
  }

  // Optional left arrow button
  const arrowLeft = document.getElementById('arrowLeft');
  if (arrowLeft){
    arrowLeft.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      prev();
    });
  }

  /* ===== Fullscreen overlay ===== */
  const selectBtn = document.getElementById('selectBtn');
  const fullscreen = document.getElementById('fullscreen');
  const fsImg = document.getElementById('fsImg');
  const fsTitle = document.getElementById('fsTitle');
  const fsStatus = document.getElementById('fsStatus');
  const fsCollect = document.getElementById('fsCollect');
  const closeBtn = document.getElementById('closeBtn');

  function isFullscreenOpen(){
    return fullscreen && fullscreen.classList.contains('open');
  }

  function openFullscreen(){
    const w = works[activeIdx()] || works[0];
    if (!w || !fullscreen || !fsImg) return;

    fsImg.src = w.src;
    fsImg.alt = w.title || "";
    if (fsTitle) fsTitle.textContent = w.title || "Untitled";
    if (fsStatus) fsStatus.textContent = w.status || "Unveiling soon";
    if (fsCollect) fsCollect.href = w.collect || "https://collect.nellekristoff.art";

    fullscreen.classList.add('open');
    fullscreen.setAttribute('aria-hidden', 'false');
  }

  function closeFullscreen(){
    if (!fullscreen) return;
    fullscreen.classList.remove('open');
    fullscreen.setAttribute('aria-hidden', 'true');
  }

  if (selectBtn){
    selectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openFullscreen();
    });
  }
  if (closeBtn){
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeFullscreen();
    });
  }
  if (fullscreen){
    fullscreen.addEventListener('click', (e) => {
      if (e.target === fullscreen) closeFullscreen();
    });
  }

  /* ===== Viewport pointer pan/zoom ===== */
  let pointers = new Map();
  let lastPan = null;
  let pinchStart = null;

  function setPointer(e){ pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
  function updatePointer(e){
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function getTwoPointers(){
    const arr = Array.from(pointers.values());
    if (arr.length < 2) return null;
    return [arr[0], arr[1]];
  }
  function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
  function mid(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

  if (viewport){
    viewport.addEventListener('pointerdown', (e) => {
      if (isFullscreenOpen()) return;

      const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, .menu, .menu-btn');
      if (interactive) return;

      viewport.setPointerCapture(e.pointerId);
      setPointer(e);

      if (pointers.size === 1){
        lastPan = { x: e.clientX, y: e.clientY };
        pinchStart = null;
      } else if (pointers.size === 2){
        const [p1, p2] = getTwoPointers();
        pinchStart = { d: dist(p1,p2), z: tZoom, m: mid(p1,p2) };
        lastPan = null;
      }
    });

    viewport.addEventListener('pointermove', (e) => {
      if (isFullscreenOpen()) return;
      if (!pointers.has(e.pointerId)) return;
      updatePointer(e);

      if (pointers.size === 1 && lastPan){
        addPan(e.clientX - lastPan.x, e.clientY - lastPan.y);
        lastPan = { x: e.clientX, y: e.clientY };
      }

      if (pointers.size >= 2){
        const two = getTwoPointers();
        if (!two) return;
        const [p1, p2] = two;

        const dNow = dist(p1,p2);
        const mNow = mid(p1,p2);

        if (!pinchStart){
          pinchStart = { d: dNow, z: tZoom, m: mNow };
          return;
        }

        const rect = viewport.getBoundingClientRect();
        const cx = mNow.x - rect.left;
        const cy = mNow.y - rect.top;

        setZoomAt(pinchStart.z * (dNow / pinchStart.d), cx, cy);
        addPan(mNow.x - pinchStart.m.x, mNow.y - pinchStart.m.y);
        pinchStart.m = mNow;
      }
    });

    function endPointer(e){
      pointers.delete(e.pointerId);
      if (pointers.size === 0){ lastPan = null; pinchStart = null; }
      if (pointers.size === 1){
        const remaining = Array.from(pointers.values())[0];
        lastPan = remaining ? { x: remaining.x, y: remaining.y } : null;
        pinchStart = null;
      }
    }

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);

    viewport.addEventListener('wheel', (e) => {
      if (isFullscreenOpen()) return;
      e.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0018);
      setZoomAt(tZoom * factor, cx, cy);
    }, { passive:false });
  }

  /* keyboard */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenOpen()){
      closeFullscreen();
      return;
    }
    if (isFullscreenOpen()) return;

    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  function init(){
    zoom = tZoom = 1;
    panX = tPanX = 0;
    panY = tPanY = 0;
    applyView();

    requestAnimationFrame(() => applyInstant(activePos));
  }
  init();

  window.addEventListener('resize', () => {
    clampPanTarget();
    ensureAnim();
    requestAnimationFrame(() => applyInstant(activePos));
  });
});
