// app.js — TWO independent decks (Top + Bottom)
// - Independent WAAPI leporello per deck
// - Independent pan/zoom per deck
// - Focus mode: click deck -> expands to full viewport, zoom centered
// - Zoom-out near min -> returns to split view
// - Top deck arrow moves opposite direction (left)
// - Shared fullscreen (Select opens current deck active work)

document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

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

/* Shared fullscreen */
function setupFullscreen(){
  const fullscreen = document.getElementById('fullscreen');
  const fsImg = document.getElementById('fsImg');
  const fsTitle = document.getElementById('fsTitle');
  const fsStatus = document.getElementById('fsStatus');
  const fsCollect = document.getElementById('fsCollect');
  const closeBtn = document.getElementById('closeBtn');

  function isOpen(){ return fullscreen && fullscreen.classList.contains('open'); }

  function open(work){
    if (!fullscreen || !fsImg || !work) return;
    fsImg.src = work.src;
    fsImg.alt = work.title || "";
    if (fsTitle) fsTitle.textContent = work.title || "Untitled";
    if (fsStatus) fsStatus.textContent = work.status || "Unveiling soon";
    if (fsCollect) fsCollect.href = work.collect || "https://collect.nellekristoff.art";
    fullscreen.classList.add('open');
    fullscreen.setAttribute('aria-hidden', 'false');
  }
  function close(){
    if (!fullscreen) return;
    fullscreen.classList.remove('open');
    fullscreen.setAttribute('aria-hidden', 'true');
  }

  if (closeBtn){
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); close(); });
  }
  if (fullscreen){
    fullscreen.addEventListener('click', (e) => { if (e.target === fullscreen) close(); });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });

  return { open, close, isOpen };
}

/* Deck factory */
function createDeck(opts){
  const {
    name,
    viewportRoot,     // #viewport
    deckEl,           // #deckTop / #deckBottom
    panEl,            // #spacePanTop / #spacePanBottom
    zoomEl,           // #spaceZoomTop / #spaceZoomBottom
    lepEl,            // #leporelloTop / #leporelloBottom
    activeUI,
    amTitle,
    amStatus,
    activeCollect,
    selectBtn,
    arrowBtn,
    direction,        // +1 or -1
    works
  } = opts;

  // preload
  works.forEach(w => { const i = new Image(); i.src = w.src; });

  // --- independent pan/zoom state per deck ---
  let zoom = 1, panX = 0, panY = 0;
  let tZoom = 1, tPanX = 0, tPanY = 0;
  let raf = null;

  function zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
  function zoomMax(){ return num(cssVar('--zoomMax')) || 1.35; }

  function applyView(){
    if (!panEl || !zoomEl) return;
    const zoomZ = Math.max(0, (zoom - 1)) * 320;
    zoomEl.style.setProperty('--zoom', zoom);
    zoomEl.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
    panEl.style.setProperty('--panX', panX + 'px');
    panEl.style.setProperty('--panY', panY + 'px');
  }

  function clampPanTarget(){
    if (!deckEl) return;
    const rect = deckEl.getBoundingClientRect();

    // allow a little drift even when zoomed out
    const slackX = rect.width  * 0.08;
    const slackY = rect.height * 0.08;

    const extraX = Math.max(0, (tZoom - 1)) * rect.width  / 2;
    const extraY = Math.max(0, (tZoom - 1)) * rect.height / 2;

    const maxX = extraX + slackX;
    const maxY = extraY + slackY;

    tPanX = clamp(tPanX, -maxX, maxX);
    tPanY = clamp(tPanY, -maxY, maxY);
  }

  function ensureAnim(){
    if (raf) return;
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
        raf = null;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function setZoomCentered(newZoom){
    newZoom = clamp(newZoom, zoomMin(), zoomMax());
    tZoom = newZoom;
    tPanX = 0;
    tPanY = 0;
    clampPanTarget();
    ensureAnim();
  }

  function setZoomAt(newZoom, cx, cy){
    newZoom = clamp(newZoom, zoomMin(), zoomMax());
    if (!deckEl) return;

    const rect = deckEl.getBoundingClientRect();
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

  // --- WAAPI leporello state per deck ---
  const panels = [];
  let activePos = 0;
  let animating = false;
  let queuedDir = 0;

  function activeIdx(){ return mod(activePos, works.length); }
  function activePanelIdx(){ return mod(activePos, panels.length || works.length); }

  // ✅ FIX: measure CSS layout width, not zoomed width
  function getPanelW(){
    const p = panels[0];
    if (!p) return 0;
    return parseFloat(getComputedStyle(p).width) || 0;
  }

  function buildT(x, z, rotY, extraZ = 0, extraRotY = 0, extraRotX = 0, extraScale = 1){
    // single-line transform string: less Safari jitter
    return `translate3d(-50%, -50%, 0) translate3d(${x}px, 0px, ${z + extraZ}px) rotateY(${rotY + extraRotY}deg) rotateX(${extraRotX}deg) scale(${extraScale})`;
  }

  const DURATION = 2850;
  const EASING   = 'cubic-bezier(.10,.88,.16,1)';

  const WAVE_Z     = 120;
  const WAVE_ROT   = 16;
  const WAVE_X     = -7.2;
  const WAVE_S     = 1.022;
  const WAVE_TWIST = 5.0;
  const TRAVEL_SPREAD = 0.22;

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

    const Z_BIAS = 3.1; // stronger separation to reduce overlap
    const n = panels.length || works.length;

    return panels.map((_, i) => {
      const iV = nearestVirtual(i, targetPos, n);
      const d  = iV - targetPos;
      const ad = Math.abs(d);

      const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
      const x   = (d === 0) ? 0 : d * stepX;

      const Z_SHIM = (i + 1) * 0.55;
      const z = (d === 0) ? 0 : (-ad * zStep) - (i * Z_BIAS) - Z_SHIM;

      const op = (d === 0) ? 1 : clamp(1 - ad * 0.05, 0.70, 1);

      return { d, ad, x, z, rot, opacity: String(op), transform: buildT(x, z, rot) };
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
    activeUI.style.width  = getComputedStyle(panelEl).width;
    activeUI.style.height = getComputedStyle(panelEl).height;
    activeUI.style.left   = getComputedStyle(panelEl).left;
    activeUI.style.top    = getComputedStyle(panelEl).top;
  }

  function applyInstant(pos){
    cancelAll();
    const t = getTargets(pos);
    panels.forEach((el, i) => {
      el.style.transform = t[i].transform;
      el.style.opacity   = t[i].opacity;
    });
    syncActiveUIText(pos);
    setActiveUITransformFromPanel(panels[mod(pos, panels.length)]);
  }

  function featherFrom(ad){
    return clamp(ad / 2, 0, 1);
  }

  function animateBetween(fromPos, toPos){
    cancelAll();
    const from = getTargets(fromPos);
    const to   = getTargets(toPos);

    panels.forEach((el, i) => {
      el.style.transform = from[i].transform;
      el.style.opacity   = from[i].opacity;
    });

    syncActiveUIText(fromPos);
    setActiveUITransformFromPanel(panels[mod(fromPos, panels.length)]);

    const BASE_O1 = 0.26, BASE_O2 = 0.52, BASE_O3 = 0.76;
    const maxD = Math.max(1, ...from.map(p => Math.abs(p.d || 0)));
    const denom = 2 * maxD;

    const anims = panels.map((el, i) => {
      const f = featherFrom(from[i].ad);
      const strength = 0.62 + 0.70 * f;

      const phase = clamp(((from[i].d || 0) + maxD) / denom, 0, 1);
      const shift = (phase - 0.5) * TRAVEL_SPREAD;

      const O1 = clamp(BASE_O1 + shift, 0.10, 0.72);
      const O2 = clamp(BASE_O2 + shift, 0.22, 0.88);
      const O3 = clamp(BASE_O3 + shift, 0.36, 0.95);

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

      const mid1 = buildT(from[i].x, from[i].z, from[i].rot, z1, ry1 + twist * 0.20, rx1, s1);
      const mid2 = buildT(from[i].x, from[i].z, from[i].rot, z2, ry2 + twist * 0.55, rx2, s2);
      const mid3 = buildT(from[i].x, from[i].z, from[i].rot, z3, ry3 + twist * 0.32, rx3, s3);

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

    // activeUI follows calmly
    let uiAnim = null;
    if (activeUI){
      const fromPanelIndex = mod(fromPos, panels.length);
      const toPanelIndex   = mod(toPos, panels.length);

      const uiFrom = from[fromPanelIndex].transform;
      const uiTo   = to[toPanelIndex].transform;

      uiAnim = activeUI.animate(
        [
          { transform: uiFrom, offset: 0 },
          { transform: uiFrom, offset: BASE_O1 },
          { transform: uiFrom, offset: BASE_O2 },
          { transform: uiFrom, offset: BASE_O3 },
          { transform: uiTo,   offset: 1 }
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
    const toPos   = activePos + dir;
    animateBetween(fromPos, toPos).then(() => {
      activePos = toPos;
      animating = false;
      runQueued();
    });
  }

  function next(){
    // top deck: direction is -1 (moves opposite)
    step(direction);
  }

  // build panels
  function buildPanels(){
    if (!lepEl) return;
    lepEl.innerHTML = "";
    panels.length = 0;

    works.forEach((w, idx) => {
      const el = document.createElement('div');
      el.className = 'panel';
      el.tabIndex = 0;

      el.style.backfaceVisibility = 'hidden';
      el.style.transformStyle = 'preserve-3d';
      el.style.transformOrigin = '50% 50%';

      el.innerHTML = `
        <div class="print">
          <img src="${w.src}" alt="${w.title || ''}" draggable="false">
          <div class="noise"></div>
        </div>
      `;

      const im = el.querySelector('img');
      if (im){
        im.style.backfaceVisibility = 'hidden';
        im.addEventListener('dragstart', (e) => e.preventDefault());
        im.addEventListener('mousedown', (e) => e.preventDefault());
        im.addEventListener('contextmenu', (e) => e.preventDefault());
      }

      // only active panel triggers select
      el.addEventListener('click', () => {
        if (animating) return;
        if (idx !== activePanelIdx()) return;
        if (selectBtn) selectBtn.click();
      });

      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (animating) return;
        if (idx !== activePanelIdx()) return;
        if (selectBtn) selectBtn.click();
      });

      lepEl.appendChild(el);
      panels.push(el);
    });
  }

  function init(){
    buildPanels();

    zoom = tZoom = zoomMin();
    panX = tPanX = 0;
    panY = tPanY = 0;
    clampPanTarget();
    applyView();

    requestAnimationFrame(() => applyInstant(activePos));
  }

  // pointer handling (independent per deck)
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

  function bindInput(isFullscreenOpen, onFocusRequest, onUnfocusRequest){
    if (!deckEl) return;

    deckEl.addEventListener('pointerdown', (e) => {
      if (isFullscreenOpen()) return;

      const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, .menu, .menu-btn');
      if (interactive) return;

      // click deck -> focus it (smooth expand)
      onFocusRequest();

      deckEl.setPointerCapture(e.pointerId);
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

    deckEl.addEventListener('pointermove', (e) => {
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

        const rect = deckEl.getBoundingClientRect();
        const cx = mNow.x - rect.left;
        const cy = mNow.y - rect.top;

        setZoomAt(pinchStart.z * (dNow / pinchStart.d), cx, cy);
        addPan(mNow.x - pinchStart.m.x, mNow.y - pinchStart.m.y);
        pinchStart.m = mNow;

        // if user zooms back to min-ish, return to split view
        if (tZoom <= zoomMin() + 0.02){
          onUnfocusRequest();
        }
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

    deckEl.addEventListener('pointerup', endPointer);
    deckEl.addEventListener('pointercancel', endPointer);

    deckEl.addEventListener('wheel', (e) => {
      if (isFullscreenOpen()) return;
      e.preventDefault();

      onFocusRequest();

      const rect = deckEl.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0018);
      setZoomAt(tZoom * factor, cx, cy);

      if (tZoom <= zoomMin() + 0.02){
        onUnfocusRequest();
      }
    }, { passive:false });
  }

  function bindArrow(){
    if (!arrowBtn) return;
    arrowBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      next();
    });
  }

  function bindSelect(openFullscreen){
    if (!selectBtn) return;
    selectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openFullscreen(works[activeIdx()]);
    });
  }

  function onResize(){
    clampPanTarget();
    ensureAnim();
    requestAnimationFrame(() => applyInstant(activePos));
  }

  return {
    name,
    init,
    onResize,
    bindInput,
    bindArrow,
    bindSelect,
    setZoomCentered,
    zoomMin
  };
}

document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("ready");

  const viewportRoot = document.getElementById('viewport');

  /* Menu */
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

  const FS = setupFullscreen();

  // ✅ Works (bottom: 1–3, top: 4–6)
  // Replace src paths with your real images.
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

  // Focus logic (one deck expands to full viewport)
  let focused = null; // "top" | "bottom" | null
  function focusTop(){
    if (!viewportRoot) return;
    focused = "top";
    viewportRoot.classList.add('focus-top');
    viewportRoot.classList.remove('focus-bottom');
  }
  function focusBottom(){
    if (!viewportRoot) return;
    focused = "bottom";
    viewportRoot.classList.add('focus-bottom');
    viewportRoot.classList.remove('focus-top');
  }
  function clearFocus(){
    if (!viewportRoot) return;
    focused = null;
    viewportRoot.classList.remove('focus-top');
    viewportRoot.classList.remove('focus-bottom');
  }

  const deckTop = createDeck({
    name: "top",
    viewportRoot,
    deckEl: document.getElementById('deckTop'),
    panEl: document.getElementById('spacePanTop'),
    zoomEl: document.getElementById('spaceZoomTop'),
    lepEl: document.getElementById('leporelloTop'),
    activeUI: document.getElementById('activeUITop'),
    amTitle: document.getElementById('amTitleTop'),
    amStatus: document.getElementById('amStatusTop'),
    activeCollect: document.getElementById('activeCollectTop'),
    selectBtn: document.getElementById('selectBtnTop'),
    arrowBtn: document.getElementById('arrowTopLeft'),
    direction: -1, // ✅ moves opposite direction
    works: worksTop
  });

  const deckBottom = createDeck({
    name: "bottom",
    viewportRoot,
    deckEl: document.getElementById('deckBottom'),
    panEl: document.getElementById('spacePanBottom'),
    zoomEl: document.getElementById('spaceZoomBottom'),
    lepEl: document.getElementById('leporelloBottom'),
    activeUI: document.getElementById('activeUIBottom'),
    amTitle: document.getElementById('amTitleBottom'),
    amStatus: document.getElementById('amStatusBottom'),
    activeCollect: document.getElementById('activeCollectBottom'),
    selectBtn: document.getElementById('selectBtnBottom'),
    arrowBtn: document.getElementById('arrowBottomRight'),
    direction: +1,
    works: worksBottom
  });

  deckTop.init();
  deckBottom.init();

  deckTop.bindArrow();
  deckBottom.bindArrow();

  deckTop.bindSelect(FS.open);
  deckBottom.bindSelect(FS.open);

  deckTop.bindInput(
    FS.isOpen,
    () => {
      if (focused !== "top"){
        focusTop();
        deckTop.setZoomCentered(1); // zoom in centered when focusing
      }
    },
    () => {
      // zooming out near min returns to split
      clearFocus();
      deckTop.setZoomCentered(deckTop.zoomMin());
    }
  );

  deckBottom.bindInput(
    FS.isOpen,
    () => {
      if (focused !== "bottom"){
        focusBottom();
        deckBottom.setZoomCentered(1);
      }
    },
    () => {
      clearFocus();
      deckBottom.setZoomCentered(deckBottom.zoomMin());
    }
  );

  // keyboard: arrows control the focused deck; if none focused -> bottom deck by default
  window.addEventListener('keydown', (e) => {
    if (FS.isOpen()) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;

    // If you want keyboard control later, we can wire prev/next both directions.
    // For now: keep it simple (click arrows).
    e.preventDefault();
  });

  window.addEventListener('resize', () => {
    deckTop.onResize();
    deckBottom.onResize();
  });
});
