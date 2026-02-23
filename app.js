// app.js — Deep 3D TWO DECKS, independent controls, strong bend + no overlap,
// smooth focus transitions, faster zoom feel, top deck slides opposite direction.

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

/* Works */
const worksTop = [
  { src:"images/Untitled4.png", title:"Untitled 4", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled5.png", title:"Untitled 5", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled6.png", title:"Untitled 6", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];

const worksBottom = [
  { src:"images/Untitled1.png", title:"Untitled 1", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled2.png", title:"Untitled 2", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled3.png", title:"Untitled 3", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];

// preload
[...worksTop, ...worksBottom].forEach(w => { const i = new Image(); i.src = w.src; });

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

  const viewport = document.getElementById('viewport');
  const spaceBg  = document.getElementById('spaceBg');

  /* ===== Menu ===== */
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');

  function setMenu(open){
    if (!menuBtn || !menu) return;
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }

  if (menuBtn && menu){
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu(!menu.classList.contains('open'));
    });
    document.addEventListener('click', () => setMenu(false));
    menu.addEventListener('click', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ===== Shared Fullscreen ===== */
  const fullscreen = document.getElementById('fullscreen');
  const fsImg = document.getElementById('fsImg');
  const fsTitle = document.getElementById('fsTitle');
  const fsStatus = document.getElementById('fsStatus');
  const fsCollect = document.getElementById('fsCollect');
  const closeBtn = document.getElementById('closeBtn');

  function isFullscreenOpen(){ return fullscreen && fullscreen.classList.contains('open'); }

  function openFullscreenFromWork(w){
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
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenOpen()) closeFullscreen();
  });

  /* ===== Create one deck ===== */
  function createDeck(opts){
    const {
      deckEl,
      lepEl,
      activeUIEl,
      titleEl,
      statusEl,
      collectEl,
      selectBtn,
      arrowBtn,
      works,
      direction,
      mirrorX = 1,         // +1 normal, -1 mirrored “feels opposite”
    } = opts;

    // Pan/zoom state
    let zoom = 1, panX = 0, panY = 0;
    let tZoom = 1, tPanX = 0, tPanY = 0;
    let raf = null;

    // WAAPI state
    const panels = [];
    let activePos = 0;
    let animating = false;
    let queuedDir = 0;

    // Timing (smooth but not too slow)
    const DURATION = 1550;
    const EASING   = 'cubic-bezier(.12,.90,.18,1)';

    // Bubble tuning (dimensional, airy)
    const WAVE_Z     = 170;
    const WAVE_ROT   = 20;
    const WAVE_X     = -9.0;
    const WAVE_S     = 1.026;
    const WAVE_TWIST = 7.0;
    const TRAVEL_SPREAD = 0.16;

    // Helpers
    function zoomMin(){ return num(cssVar('--zoomMin')) || 0.66; }
    function zoomMax(){ return num(cssVar('--zoomMax')) || 1.55; }

    function applyView(){
      const zoomZ = Math.max(0, (zoom - 1)) * 360;
      deckEl.style.setProperty('--zoom', String(zoom));
      deckEl.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
      deckEl.style.setProperty('--panX', panX.toFixed(1) + 'px');
      deckEl.style.setProperty('--panY', panY.toFixed(1) + 'px');
    }

    // Allow some drift even at min zoom
    function clampPanTarget(){
      const rect = deckEl.getBoundingClientRect();
      const slackX = rect.width  * 0.10;
      const slackY = rect.height * 0.10;

      const extraX = Math.max(0, (tZoom - 1)) * rect.width  / 2;
      const extraY = Math.max(0, (tZoom - 1)) * rect.height / 2;

      const maxX = extraX + slackX;
      const maxY = extraY + slackY;

      tPanX = clamp(tPanX, -maxX, maxX);
      tPanY = clamp(tPanY, -maxY, maxY);
    }

    function ensureAnim(){
      if (raf) return;

      // faster follow (less annoying)
      const ease = 0.22;

      const tick = () => {
        zoom += (tZoom - zoom) * ease;
        panX += (tPanX - panX) * ease;
        panY += (tPanY - panY) * ease;

        applyView();

        const done =
          Math.abs(tZoom - zoom) < 0.0012 &&
          Math.abs(tPanX - panX) < 0.22 &&
          Math.abs(tPanY - panY) < 0.22;

        if (done){
          zoom = tZoom; panX = tPanX; panY = tPanY;
          applyView();
          raf = null;

          // return to overview if zoom back to min
          if (Math.abs(zoom - zoomMin()) < 0.004){
            if (viewport) viewport.classList.remove('focus-top', 'focus-bottom');
          }
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    }

    function focusThisDeck(){
      if (!viewport) return;
      viewport.classList.remove('focus-top', 'focus-bottom');
      viewport.classList.add(deckEl.id === 'deckTop' ? 'focus-top' : 'focus-bottom');
    }

    function setZoomAt(newZoom, cx, cy){
      newZoom = clamp(newZoom, zoomMin(), zoomMax());

      const rect = deckEl.getBoundingClientRect();
      const ccx = cx - rect.width  / 2;
      const ccy = cy - rect.height / 2;

      const baseZoom = zoom || 1;
      const k = newZoom / baseZoom;

      tPanX = (panX - ccx) * k + ccx;
      tPanY = (panY - ccy) * k + ccy;

      tZoom = newZoom;

      // Auto-focus as soon as we zoom in (prevents half-deck clipping)
      if (newZoom > zoomMin() + 0.02){
        focusThisDeck();
      }

      clampPanTarget();
      ensureAnim();
    }

    function addPan(dx, dy){
      tPanX += dx;
      tPanY += dy;
      clampPanTarget();
      ensureAnim();
    }

    // stable panel width (layout width, not zoomed)
    function getPanelW(){
      const p = panels[0];
      if (!p) return 0;
      return parseFloat(getComputedStyle(p).width) || 0;
    }

    // Transform builder (keeps rotations < 90deg to avoid “flip” snaps)
    function buildT(x, z, rotY, extraZ = 0, extraRotY = 0, extraRotX = 0, extraScale = 1){
      return `translate3d(-50%, -50%, 0)
              translate3d(${x}px, 0px, ${z + extraZ}px)
              rotateY(${rotY + extraRotY}deg)
              rotateX(${extraRotX}deg)
              scale(${extraScale})`;
    }

    function cancelAnim(el){
      if (!el || typeof el.getAnimations !== 'function') return;
      el.getAnimations().forEach(a => a.cancel());
    }
    function cancelAll(){
      panels.forEach(cancelAnim);
      cancelAnim(activeUIEl);
    }

    function activeIdx(){ return mod(activePos, works.length); }
    function activePanelIdx(){ return mod(activePos, panels.length); }

    function syncActiveUIText(pos){
      const w = works[mod(pos, works.length)] || works[0];
      if (!w) return;
      if (titleEl) titleEl.textContent = w.title || "Untitled";
      if (statusEl) statusEl.textContent = w.status || "Unveiling soon";
      if (collectEl) collectEl.href = w.collect || "https://collect.nellekristoff.art";
    }

    function setActiveUITransformFromPanel(panelEl){
      if (!activeUIEl || !panelEl) return;
      activeUIEl.style.transform = panelEl.style.transform || "";
      activeUIEl.style.width  = getComputedStyle(panelEl).width;
      activeUIEl.style.height = getComputedStyle(panelEl).height;
      activeUIEl.style.left   = getComputedStyle(panelEl).left;
      activeUIEl.style.top    = getComputedStyle(panelEl).top;
    }

    function featherFrom(ad){
      return clamp(ad / 2, 0, 1);
    }

    function getTargets(targetPos){
      const panelW = getPanelW();
      const angleStep = numDeg(cssVar('--angleStep'));
      const maxAngle  = numDeg(cssVar('--maxAngle'));
      const zStep     = numPx(cssVar('--zStep'));
      const xStepPct  = num(cssVar('--xStep')) / 100;
      const stepX     = panelW * xStepPct * mirrorX;

      const n = panels.length;

      // VERY strong depth separation so never overlaps
      const Z_BIAS = 6.2;

      return panels.map((_, i) => {
        const iV = nearestVirtual(i, targetPos, n);
        const d  = iV - targetPos;
        const ad = Math.abs(d);

        // active always flat
        const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
        const x   = (d === 0) ? 0 : d * stepX;

        // side panels go MUCH deeper; extra depth scales with distance
        const Z_SHIM = (i + 1) * 0.9;
        const z = (d === 0)
          ? 0
          : (-ad * zStep) - (ad * 38) - (i * Z_BIAS) - Z_SHIM;

        // opacity a little softer on sides
        const op = (d === 0) ? 1 : clamp(1 - ad * 0.08, 0.62, 0.96);

        // zIndex: active always on top, then near, then far
        const zIndex = String(500 - Math.round(ad * 60) - i);

        return { d, ad, x, z, rot, opacity: String(op), zIndex, transform: buildT(x, z, rot) };
      });
    }

    function applyInstant(pos){
      cancelAll();
      const t = getTargets(pos);
      panels.forEach((el, i) => {
        el.style.transform = t[i].transform;
        el.style.opacity   = t[i].opacity;
        el.style.zIndex    = t[i].zIndex;
      });
      syncActiveUIText(pos);
      setActiveUITransformFromPanel(panels[mod(pos, panels.length)]);
    }

    function animateBetween(fromPos, toPos){
      cancelAll();

      const from = getTargets(fromPos);
      const to   = getTargets(toPos);

      // lock start
      panels.forEach((el, i) => {
        el.style.transform = from[i].transform;
        el.style.opacity   = from[i].opacity;
        el.style.zIndex    = from[i].zIndex;
      });

      syncActiveUIText(fromPos);
      setActiveUITransformFromPanel(panels[mod(fromPos, panels.length)]);

      // bubble peaks
      const BASE_O1 = 0.24, BASE_O2 = 0.50, BASE_O3 = 0.76;

      const maxD = Math.max(1, ...from.map(p => Math.abs(p.d || 0)));
      const denom = 2 * maxD;

      const anims = panels.map((el, i) => {
        const f = featherFrom(from[i].ad);

        // stronger breath on side panels
        const strength = 0.62 + 0.90 * f;

        // traveling wave shift (small)
        const phase = clamp(((from[i].d || 0) + maxD) / denom, 0, 1);
        const shift = (phase - 0.5) * TRAVEL_SPREAD;

        const O1 = clamp(BASE_O1 + shift, 0.10, 0.70);
        const O2 = clamp(BASE_O2 + shift, 0.20, 0.88);
        const O3 = clamp(BASE_O3 + shift, 0.34, 0.95);

        const z1 = WAVE_Z * (0.20 * strength);
        const z2 = WAVE_Z * (0.72 * strength);
        const z3 = WAVE_Z * (0.40 * strength);

        const ry1 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.16 * strength));
        const ry2 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.56 * strength));
        const ry3 = (from[i].rot === 0) ? 0 : (WAVE_ROT * (0.30 * strength));

        const rx1 = WAVE_X * (0.18 * strength);
        const rx2 = WAVE_X * (0.86 * strength);
        const rx3 = WAVE_X * (0.40 * strength);

        const s1 = 1 + ((WAVE_S - 1) * (0.18 * strength));
        const s2 = 1 + ((WAVE_S - 1) * (0.86 * strength));
        const s3 = 1 + ((WAVE_S - 1) * (0.40 * strength));

        const twist = (i % 2 === 0 ? 1 : -1) * WAVE_TWIST * f;

        const mid1 = buildT(from[i].x, from[i].z, from[i].rot, z1, ry1 + twist * 0.18, rx1, s1);
        const mid2 = buildT(from[i].x, from[i].z, from[i].rot, z2, ry2 + twist * 0.55, rx2, s2);
        const mid3 = buildT(from[i].x, from[i].z, from[i].rot, z3, ry3 + twist * 0.30, rx3, s3);

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

      // Active UI follows calmer (anchored)
      let uiAnim = null;
      if (activeUIEl){
        const fromPanelIndex = mod(fromPos, panels.length);
        const toPanelIndex   = mod(toPos, panels.length);

        const uiFrom = from[fromPanelIndex].transform;
        const uiTo   = to[toPanelIndex].transform;

        const uiMid1 = uiFrom;
        const uiMid2 = uiFrom;
        const uiMid3 = uiFrom;

        uiAnim = activeUIEl.animate(
          [
            { transform: uiFrom, offset: 0 },
            { transform: uiMid1, offset: BASE_O1 },
            { transform: uiMid2, offset: BASE_O2 },
            { transform: uiMid3, offset: BASE_O3 },
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
          el.style.zIndex    = to[i].zIndex;
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
      step(+1 * direction);
    }

    // Build panels
    works.forEach((w, idx) => {
      const el = document.createElement('div');
      el.className = 'panel';
      el.tabIndex = 0;

      el.innerHTML = `
        <div class="print">
          <img src="${w.src}" alt="${w.title}" draggable="false">
          <div class="noise"></div>
        </div>
      `;

      // only active panel reacts to click (prevents side “jump”)
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

    // Select -> fullscreen
    if (selectBtn){
      selectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const w = works[activeIdx()] || works[0];
        openFullscreenFromWork(w);
      });
    }

    // Arrow click
    if (arrowBtn){
      arrowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        next();
      });
    }

    // Focus on pointerdown (ignore buttons/arrows)
    deckEl.addEventListener('pointerdown', (e) => {
      if (isFullscreenOpen()) return;
      const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, #menuBtn, #menu');
      if (interactive) return;
      focusThisDeck();
    });

    // Pointer pan/zoom
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

    deckEl.addEventListener('pointerdown', (e) => {
      if (isFullscreenOpen()) return;
      const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, #menuBtn, #menu');
      if (interactive) return;

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

    // Wheel zoom
    deckEl.addEventListener('wheel', (e) => {
      if (isFullscreenOpen()) return;
      e.preventDefault();

      const rect = deckEl.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0022);
      setZoomAt(tZoom * factor, cx, cy);
    }, { passive:false });

    // Focused hover tilt (more 3D)
    deckEl.addEventListener('mousemove', (e) => {
      if (!viewport) return;
      const isFocused =
        viewport.classList.contains(deckEl.id === 'deckTop' ? 'focus-top' : 'focus-bottom');
      if (!isFocused) return;

      const r = deckEl.getBoundingClientRect();
      const nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      const ny = clamp(((e.clientY - r.top)  / r.height) * 2 - 1, -1, 1);

      deckEl.style.setProperty('--tiltY', (nx * 6.2).toFixed(2) + 'deg');
      deckEl.style.setProperty('--tiltX', (-ny * 5.0).toFixed(2) + 'deg');
    });

    deckEl.addEventListener('mouseleave', () => {
      deckEl.style.setProperty('--tiltX', '0deg');
      deckEl.style.setProperty('--tiltY', '0deg');
    });

    // Init
    function init(){
      zoom = tZoom = zoomMin();
      panX = tPanX = 0;
      panY = tPanY = 0;
      clampPanTarget();
      applyView();
      requestAnimationFrame(() => applyInstant(activePos));
    }
    init();

    // Resize
    window.addEventListener('resize', () => {
      clampPanTarget();
      ensureAnim();
      requestAnimationFrame(() => applyInstant(activePos));
    });

    return { applyInstant };
  }

  // Create decks
  createDeck({
    deckEl: document.getElementById('deckTop'),
    lepEl: document.getElementById('leporelloTop'),
    activeUIEl: document.getElementById('activeUITop'),
    titleEl: document.getElementById('amTitleTop'),
    statusEl: document.getElementById('amStatusTop'),
    collectEl: document.getElementById('activeCollectTop'),
    selectBtn: document.getElementById('selectBtnTop'),
    arrowBtn: document.getElementById('arrowTopLeft'),
    works: worksTop,

    // top arrow should feel “opposite”
    direction: -1,
    mirrorX: -1,
  });

  createDeck({
    deckEl: document.getElementById('deckBottom'),
    lepEl: document.getElementById('leporelloBottom'),
    activeUIEl: document.getElementById('activeUIBottom'),
    titleEl: document.getElementById('amTitleBottom'),
    statusEl: document.getElementById('amStatusBottom'),
    collectEl: document.getElementById('activeCollectBottom'),
    selectBtn: document.getElementById('selectBtnBottom'),
    arrowBtn: document.getElementById('arrowBottomRight'),
    works: worksBottom,

    direction: +1,
    mirrorX: +1,
  });

  // ===== Shared overview “horizon drift” (real 3D stage vars) =====
  if (viewport){
    let ovRAF = null;
    let ovTX = 0, ovTY = 0, ovPX = 0, ovPY = 0;
    let ovX = 0, ovY = 0, ovPanX = 0, ovPanY = 0;

    const deckTop = document.getElementById('deckTop');
    const deckBottom = document.getElementById('deckBottom');

    function setOverviewVars(){
      const x = ovX.toFixed(2) + 'deg';
      const y = ovY.toFixed(2) + 'deg';
      const px = ovPanX.toFixed(1) + 'px';
      const py = ovPanY.toFixed(1) + 'px';

      if (deckTop){
        deckTop.style.setProperty('--ovTiltX', x);
        deckTop.style.setProperty('--ovTiltY', y);
        deckTop.style.setProperty('--ovPanX', px);
        deckTop.style.setProperty('--ovPanY', py);
      }
      if (deckBottom){
        deckBottom.style.setProperty('--ovTiltX', x);
        deckBottom.style.setProperty('--ovTiltY', y);
        deckBottom.style.setProperty('--ovPanX', px);
        deckBottom.style.setProperty('--ovPanY', py);
      }
    }

    function isOverview(){
      return !viewport.classList.contains('focus-top') && !viewport.classList.contains('focus-bottom');
    }

    function tickOverview(){
      const ease = 0.10;
      ovX += (ovTX - ovX) * ease;
      ovY += (ovTY - ovY) * ease;
      ovPanX += (ovPX - ovPanX) * ease;
      ovPanY += (ovPY - ovPanY) * ease;

      setOverviewVars();

      const done =
        Math.abs(ovTX - ovX) < 0.03 &&
        Math.abs(ovTY - ovY) < 0.03 &&
        Math.abs(ovPX - ovPanX) < 0.3 &&
        Math.abs(ovPY - ovPanY) < 0.3;

      if (done){
        ovRAF = null;
        return;
      }
      ovRAF = requestAnimationFrame(tickOverview);
    }

    function ensureOverviewRAF(){
      if (ovRAF) return;
      ovRAF = requestAnimationFrame(tickOverview);
    }

    viewport.addEventListener('mousemove', (e) => {
      if (!isOverview()) return;

      const r = viewport.getBoundingClientRect();
      const nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      const ny = clamp(((e.clientY - r.top)  / r.height) * 2 - 1, -1, 1);

      // more readable, still gentle
      ovTX = -ny * 4.6;
      ovTY =  nx * 4.0;
      ovPX =  nx * 18;
      ovPY =  ny * 12;

      ensureOverviewRAF();
    });

    viewport.addEventListener('mouseleave', () => {
      ovTX = 0; ovTY = 0; ovPX = 0; ovPY = 0;
      ensureOverviewRAF();
    });

    // When entering focus mode, clear overview drift so focus feels crisp
    const observer = new MutationObserver(() => {
      if (!isOverview()){
        ovTX = 0; ovTY = 0; ovPX = 0; ovPY = 0;
        ovX = 0; ovY = 0; ovPanX = 0; ovPanY = 0;
        setOverviewVars();
      }
    });
    observer.observe(viewport, { attributes:true, attributeFilter:['class'] });
  }

  // Background “breath” (subtle)
  if (spaceBg){
    let t = 0;
    const tick = () => {
      t += 0.008;
      const bx = Math.sin(t) * 10;
      const by = Math.cos(t * 0.78) * 7;
      spaceBg.style.transform =
        `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
});