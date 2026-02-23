// app.js — TWO STACKED DECKS (top + bottom) inside same viewport
// - Each deck has its own panels + activePos + wave animation.
// - Clicking a deck makes it the "current deck".
// - Zoom IN = full freedom.
// - Zoom OUT to zoomMin snaps panY to that deck's rest position (top half / bottom half).
// - ArrowLeft/ArrowRight navigate the current deck only.
// - Uses unscaled panel width (computedStyle) so no post-zoom jump.

document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

/* ===== Works (6 total) ===== */
const worksBottom = [
  { src:"images/Untitled1.png", title:"Untitled 1", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled2.png", title:"Untitled 2", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled3.png", title:"Untitled 3", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];
const worksTop = [
  { src:"images/Untitled4.png", title:"Untitled 4", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled5.png", title:"Untitled 5", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled6.png", title:"Untitled 6", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];

// preload
[...worksBottom, ...worksTop].forEach(w => { const i = new Image(); i.src = w.src; });

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

  /* ===== Menu (unchanged) ===== */
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

  // allow a little pan even at min zoom
  function clampPanTarget(){
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();

    const slackX = rect.width  * 0.08;
    const slackY = rect.height * 0.08;

    const extraX = Math.max(0, (tZoom - 1)) * rect.width  / 2;
    const extraY = Math.max(0, (tZoom - 1)) * rect.height / 2;

    const maxX = extraX + slackX;
    const maxY = extraY + slackY;

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

  // ===== Snap-to-deck when zoomed out =====
  let currentDeck = 'bottom'; // 'top' | 'bottom'
  function deckRestPanY(deck){
    if (!viewport) return 0;
    const rect = viewport.getBoundingClientRect();
    // viewport center -> half split => +/- quarter height feels perfect
    const amt = rect.height * 0.25;
    return deck === 'top' ? -amt : +amt;
  }
  function snapToDeckIfZoomedOut(){
    const zMin = zoomMin();
    // near-min counts as "zoomed out"
    if (tZoom <= zMin + 0.0005){
      tZoom = zMin;
      tPanX = 0;
      tPanY = deckRestPanY(currentDeck);
      clampPanTarget();
      ensureAnim();
    }
  }

  function ensureAnim(){
    if (animRaf) return;

    // breathing follow
    const ease = 0.14;

    const tick = () => {
      zoom += (tZoom - zoom) * ease;
      panX += (tPanX - panX) * ease;
      panY += (tPanY - panY) * ease;

      applyView();

      const done =
        Math.abs(tZoom - zoom) < 0.0008 &&
        Math.abs(tPanX - panX) < 0.10 &&
        Math.abs(tPanY - panY) < 0.10;

      if (done){
        zoom = tZoom; panX = tPanX; panY = tPanY;
        applyView();
        animRaf = null;

        // once we truly settle at min zoom, enforce deck rest
        snapToDeckIfZoomedOut();
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

    const baseZoom = zoom || 1;
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

  /* ===== WAAPI / 3D ===== */
  const lep = document.getElementById('leporello');
  if (!lep) return;

  // Active UI (single overlay; follows active panel of current deck)
  const activeUI = document.getElementById('activeUI');
  const amTitle = document.getElementById('amTitle');
  const amStatus = document.getElementById('amStatus');
  const activeCollect = document.getElementById('activeCollect');

  function cancelAnim(el){
    if (!el || typeof el.getAnimations !== 'function') return;
    el.getAnimations().forEach(a => a.cancel());
  }

  function setActiveUITransformFromPanel(panelEl){
    if (!activeUI || !panelEl) return;
    activeUI.style.transform = panelEl.style.transform || "";
    activeUI.style.width  = getComputedStyle(panelEl).width;
    activeUI.style.height = getComputedStyle(panelEl).height;
    activeUI.style.left   = getComputedStyle(panelEl).left;
    activeUI.style.top    = getComputedStyle(panelEl).top;
  }

  function syncActiveUIText(w){
    if (!w) return;
    if (amTitle) amTitle.textContent = w.title || "Untitled";
    if (amStatus) amStatus.textContent = w.status || "Unveiling soon";
    if (activeCollect) activeCollect.href = w.collect || "https://collect.nellekristoff.art";
  }

  // Unscaled panel width (no zoom jump)
  function getPanelWFromAny(panelEl){
    if (!panelEl) return 0;
    return parseFloat(getComputedStyle(panelEl).width) || 0;
  }

  function buildT(x, z, rotY, extraZ=0, extraRotY=0, extraRotX=0, extraScale=1){
    return `translate3d(-50%, -50%, 0) translate3d(${x}px, ${0}px, ${z + extraZ}px) rotateY(${rotY + extraRotY}deg) rotateX(${extraRotX}deg) scale(${extraScale}) translateZ(0.01px)`;
  }

  // Theatre feel
  const DURATION = 2850;
  const EASING   = 'cubic-bezier(.10,.88,.16,1)';

  const WAVE_Z     = 120;
  const WAVE_ROT   = 16;
  const WAVE_X     = -7.2;
  const WAVE_S     = 1.022;
  const WAVE_TWIST = 5.0;

  const TRAVEL_SPREAD = 0.22;

  // Extra side depth (helps overlap)
  const SIDE_BACK_Z   = 95;
  const SIDE_BACK_POW = 1.25;
  const SIDE_TUCK     = 0.28;

  function featherFrom(ad){ return clamp(ad / 2, 0, 1); }
  function sideBackFromAd(ad){ return (ad === 0) ? 0 : (SIDE_BACK_Z * Math.pow(ad, SIDE_BACK_POW)); }

  // ===== Create two deck containers inside leporello =====
  const deckTopEl = document.createElement('div');
  deckTopEl.className = 'deck deck-top';
  const deckBottomEl = document.createElement('div');
  deckBottomEl.className = 'deck deck-bottom';
  lep.appendChild(deckTopEl);
  lep.appendChild(deckBottomEl);

  // ===== Deck factory =====
  function createDeck(deckName, hostEl, works){
    const deck = {
      name: deckName,
      hostEl,
      works,
      panels: [],
      activePos: 0,
      animating: false,
      queuedDir: 0,
    };

    function activeIdx(){ return mod(deck.activePos, deck.works.length); }
    function activePanelIdx(){ return mod(deck.activePos, deck.panels.length || deck.works.length); }

    function cancelAll(){
      deck.panels.forEach(cancelAnim);
      cancelAnim(activeUI);
    }

    function getTargets(targetPos){
      const panelW = getPanelWFromAny(deck.panels[0]);
      const angleStep = numDeg(cssVar('--angleStep'));
      const maxAngle  = numDeg(cssVar('--maxAngle'));
      const zStep     = numPx(cssVar('--zStep'));
      const xStepPct  = num(cssVar('--xStep')) / 100;
      const stepX     = panelW * xStepPct;

      const Z_BIAS = 2.6;
      const n = deck.panels.length || deck.works.length;

      return deck.panels.map((_, i) => {
        const iV = nearestVirtual(i, targetPos, n);
        const d  = iV - targetPos;
        const ad = Math.abs(d);

        const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
        const x   = (d === 0) ? 0 : d * stepX;

        const Z_SHIM = (i + 1) * 0.55;
        const sideBack = sideBackFromAd(ad);

        const z = (d === 0) ? 0 : (-ad * zStep) - (i * Z_BIAS) - Z_SHIM - sideBack;
        const op = (d === 0) ? 1 : clamp(1 - ad * 0.05, 0.70, 1);

        return { d, ad, x, z, rot, opacity: String(op), transform: buildT(x, z, rot) };
      });
    }

    function applyInstant(pos){
      cancelAll();
      const t = getTargets(pos);
      deck.panels.forEach((el, i) => {
        el.style.transform = t[i].transform;
        el.style.opacity   = t[i].opacity;
      });

      // Update global UI to this deck’s active
      const w = deck.works[mod(pos, deck.works.length)] || deck.works[0];
      syncActiveUIText(w);
      setActiveUITransformFromPanel(deck.panels[mod(pos, deck.panels.length)]);
    }

    function animateBetween(fromPos, toPos){
      cancelAll();

      const from = getTargets(fromPos);
      const to   = getTargets(toPos);

      deck.panels.forEach((el, i) => {
        el.style.transform = from[i].transform;
        el.style.opacity   = from[i].opacity;
      });

      const wFrom = deck.works[mod(fromPos, deck.works.length)] || deck.works[0];
      syncActiveUIText(wFrom);
      setActiveUITransformFromPanel(deck.panels[mod(fromPos, deck.panels.length)]);

      const BASE_O1 = 0.26, BASE_O2 = 0.52, BASE_O3 = 0.76;
      const maxD  = Math.max(1, ...from.map(p => Math.abs(p.d || 0)));
      const denom = 2 * maxD;

      const anims = deck.panels.map((el, i) => {
        const f = featherFrom(from[i].ad);
        const strength = 0.62 + 0.70 * f;

        const phase = clamp(((from[i].d || 0) + maxD) / denom, 0, 1);
        const shift = (phase - 0.5) * TRAVEL_SPREAD;

        const O1 = clamp(BASE_O1 + shift, 0.10, 0.72);
        const O2 = clamp(BASE_O2 + shift, 0.22, 0.88);
        const O3 = clamp(BASE_O3 + shift, 0.36, 0.95);

        const sideBack = sideBackFromAd(from[i].ad);
        const tuckZ = (from[i].ad === 0) ? 0 : (-sideBack * SIDE_TUCK);

        const z1 = WAVE_Z * (0.22 * strength);
        const z2 = WAVE_Z * (0.70 * strength);
        const z3 = WAVE_Z * (0.38 * strength);

        const ry1 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.18 * strength));
        const ry2 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.55 * strength));
        const ry3 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.28 * strength));

        const rx1 = WAVE_X * (0.22 * strength);
        const rx2 = WAVE_X * (0.82 * strength);
        const rx3 = WAVE_X * (0.36 * strength);

        const s1 = 1 + ((WAVE_S - 1) * (0.22 * strength));
        const s2 = 1 + ((WAVE_S - 1) * (0.85 * strength));
        const s3 = 1 + ((WAVE_S - 1) * (0.38 * strength));

        const twist = (i % 2 === 0 ? 1 : -1) * WAVE_TWIST * f;

        const mid1 = buildT(from[i].x, from[i].z, from[i].rot, z1 + tuckZ, ry1 + twist * 0.20, rx1, s1);
        const mid2 = buildT(from[i].x, from[i].z, from[i].rot, z2 + tuckZ, ry2 + twist * 0.55, rx2, s2);
        const mid3 = buildT(from[i].x, from[i].z, from[i].rot, z3 + tuckZ, ry3 + twist * 0.32, rx3, s3);

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

      return Promise.allSettled(anims.map(a => a.finished)).then(() => {
        cancelAll();
        deck.panels.forEach((el, i) => {
          el.style.transform = to[i].transform;
          el.style.opacity   = to[i].opacity;
        });

        const wTo = deck.works[mod(toPos, deck.works.length)] || deck.works[0];
        syncActiveUIText(wTo);
        setActiveUITransformFromPanel(deck.panels[mod(toPos, deck.panels.length)]);
      });
    }

    function runQueued(){
      if (deck.queuedDir === 0) return;
      const dir = Math.sign(deck.queuedDir);
      deck.queuedDir -= dir;
      step(dir);
    }

    function step(dir){
      if (deck.works.length < 2) return;

      if (deck.animating){
        deck.queuedDir += dir;
        return;
      }

      deck.animating = true;

      const fromPos = deck.activePos;
      const toPos   = deck.activePos + dir;

      animateBetween(fromPos, toPos).then(() => {
        deck.activePos = toPos;
        deck.animating = false;
        runQueued();
      });
    }

    deck.next = () => step(+1);
    deck.prev = () => step(-1);
    deck.applyInstant = applyInstant;
    deck.activePanelIdx = activePanelIdx;

    // Build panels into hostEl
    works.forEach((w, idx) => {
      const el = document.createElement('div');
      el.className = 'panel';
      el.tabIndex = 0;

      el.style.backfaceVisibility = 'hidden';
      el.style.transformStyle = 'preserve-3d';
      el.style.transformOrigin = '50% 50%';

      el.innerHTML = `
        <div class="print">
          <img src="${w.src}" alt="${w.title}" draggable="false">
          <div class="noise"></div>
        </div>
      `;

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

      // Clicking any panel selects that deck.
      // Only ACTIVE panel opens fullscreen.
      el.addEventListener('click', () => {
        if (deck.animating) return;

        // choose deck
        currentDeck = deck.name;
        // if currently zoomed out, snap to this deck’s rest immediately
        snapToDeckIfZoomedOut();

        // open fullscreen only if active in THIS deck
        if (idx !== deck.activePanelIdx()) return;
        const selectButton = document.getElementById('selectBtn');
        if (selectButton) selectButton.click();
      });

      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (deck.animating) return;

        currentDeck = deck.name;
        snapToDeckIfZoomedOut();

        if (idx !== deck.activePanelIdx()) return;
        const selectButton = document.getElementById('selectBtn');
        if (selectButton) selectButton.click();
      });

      hostEl.appendChild(el);
      deck.panels.push(el);
    });

    return deck;
  }

  const deckTop = createDeck('top', deckTopEl, worksTop);
  const deckBottom = createDeck('bottom', deckBottomEl, worksBottom);

  function getCurrentDeck(){
    return currentDeck === 'top' ? deckTop : deckBottom;
  }
  function anyAnimating(){
    return deckTop.animating || deckBottom.animating;
  }

  // Arrow click (right)
  const arrowRight = document.getElementById('arrowRight');
  if (arrowRight){
    arrowRight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (anyAnimating()) return;
      getCurrentDeck().next();
    });
  }

  // Optional left arrow button
  const arrowLeft = document.getElementById('arrowLeft');
  if (arrowLeft){
    arrowLeft.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (anyAnimating()) return;
      getCurrentDeck().prev();
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
    const deck = getCurrentDeck();
    const w = deck.works[mod(deck.activePos, deck.works.length)] || deck.works[0];
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

      // when gesture ends, if user ended at min zoom -> snap to deck
      snapToDeckIfZoomedOut();
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

      // if wheel is zooming out hard, snap once near min
      snapToDeckIfZoomedOut();
    }, { passive:false });
  }

  /* keyboard */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenOpen()){
      closeFullscreen();
      return;
    }
    if (isFullscreenOpen()) return;

    if (e.key === 'ArrowRight'){
      if (anyAnimating()) return;
      getCurrentDeck().next();
    }
    if (e.key === 'ArrowLeft'){
      if (anyAnimating()) return;
      getCurrentDeck().prev();
    }
  });

  function init(){
    // start at min zoom, snapped to bottom deck
    currentDeck = 'bottom';

    zoom = tZoom = zoomMin();
    panX = tPanX = 0;
    panY = tPanY = deckRestPanY(currentDeck);

    clampPanTarget();
    applyView();

    // apply both decks instantly
    requestAnimationFrame(() => {
      deckTop.applyInstant(deckTop.activePos);
      deckBottom.applyInstant(deckBottom.activePos);

      // UI should follow bottom deck initially
      const w = worksBottom[0];
      syncActiveUIText(w);
      setActiveUITransformFromPanel(deckBottom.panels[0]);
    });
  }
  init();

  window.addEventListener('resize', () => {
    clampPanTarget();
    ensureAnim();
    requestAnimationFrame(() => {
      deckTop.applyInstant(deckTop.activePos);
      deckBottom.applyInstant(deckBottom.activePos);
      snapToDeckIfZoomedOut();
    });
  });
});
