// app.js — TWO independent decks (top + bottom), WAAPI 3D,
// per-deck pan/zoom + per-deck hover tilt + focus mode,
// fixed: top deck buttons, top select opens fullscreen, top can drag.

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

/* Works (split into top + bottom) */
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
    document.addEventListener('click', () => setMenu(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    menu.addEventListener('click', (e) => e.stopPropagation());
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
    document.body.classList.add('noscroll');   // ✅ add
  }

  function closeFullscreen(){
    if (!fullscreen) return;
    fullscreen.classList.remove('open');
    fullscreen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('noscroll'); // ✅ add
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

  /* ===== Build a deck (independent) ===== */
  function createDeck(opts){
    const {
      deckEl,
      panEl,
      zoomEl,
      lepEl,
      activeUIEl,
      titleEl,
      statusEl,
      collectEl,
      selectBtn,
      arrowBtn,
      works,
      direction,           // +1 or -1 for what “next” means
    } = opts;

    // Pan/zoom state (per deck)
    let zoom = 1, panX = 0, panY = 0;
    let tZoom = 1, tPanX = 0, tPanY = 0;
    let raf = null;

    // WAAPI state (per deck)
    const panels = [];
    let activePos = 0;
    let animating = false;
    let queuedDir = 0;

    // Motion feel
    const DURATION = 2650;
    const EASING   = 'cubic-bezier(.10,.88,.16,1)';

    // Bubble tuning
    const WAVE_Z     = 120;
    const WAVE_ROT   = 16;
    const WAVE_X     = -7.2;
    const WAVE_S     = 1.020;
    const WAVE_TWIST = 5.0;
    const TRAVEL_SPREAD = 0.22;

    function zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
    function zoomMax(){ return num(cssVar('--zoomMax')) || 1.35; }

    function applyView(){
      const zoomZ = Math.max(0, (zoom - 1)) * 320;
      deckEl.style.setProperty('--zoom', String(zoom));
      deckEl.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
      deckEl.style.setProperty('--panX', panX.toFixed(1) + 'px');
      deckEl.style.setProperty('--panY', panY.toFixed(1) + 'px');
    }

    // Allow a little pan even at min zoom (“feel-good drift”)
    function clampPanTarget(){
      const rect = deckEl.getBoundingClientRect();
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

          // ✅ if user zoomed back to min: exit focus (show both decks again)
          if (Math.abs(zoom - zoomMin()) < 0.002){
            if (viewport) viewport.classList.remove('focus-top', 'focus-bottom');
          }
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
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
      clampPanTarget();
      ensureAnim();
    }

    function addPan(dx, dy){
      tPanX += dx;
      tPanY += dy;
      clampPanTarget();
      ensureAnim();
    }

    // ✅ stable panel width (not zoomed)
    function getPanelW(){
      const p = panels[0];
      if (!p) return 0;
      return parseFloat(getComputedStyle(p).width) || 0;
    }

    function buildT(x, z, rotY, extraZ = 0, extraRotY = 0, extraRotX = 0, extraScale = 1){
      return `translate3d(-50%, -50%, 0) translate3d(${x}px, 0px, ${z + extraZ}px) rotateY(${rotY + extraRotY}deg) rotateX(${extraRotX}deg) scale(${extraScale})`;
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
      const stepX     = panelW * xStepPct;

      const n = panels.length;

      // ✅ stronger depth separation (reduces overlap)
      const Z_BIAS = 3.4;

      return panels.map((_, i) => {
        const iV = nearestVirtual(i, targetPos, n);
        const d  = iV - targetPos;
        const ad = Math.abs(d);

        // ✅ active is flat always
        const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
        const x   = (d === 0) ? 0 : d * stepX;

        // ✅ side panels go deeper (more negative Z), active stays near
        const Z_SHIM = (i + 1) * 0.65;
        const z = (d === 0) ? 0 : (-ad * zStep) - (ad * 18) - (i * Z_BIAS) - Z_SHIM;

        const op = (d === 0) ? 1 : clamp(1 - ad * 0.06, 0.68, 1);

        // ✅ stable stacking hint: active always highest
        const zIndex = String(100 - Math.round(ad * 10));

        return {
          d, ad, x, z, rot,
          opacity: String(op),
          zIndex,
          transform: buildT(x, z, rot)
        };
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

      panels.forEach((el, i) => {
        el.style.transform = from[i].transform;
        el.style.opacity   = from[i].opacity;
        el.style.zIndex    = from[i].zIndex;
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

      // Active UI follows calmly
      let uiAnim = null;
      if (activeUIEl){
        const fromPanelIndex = mod(fromPos, panels.length);
        const toPanelIndex   = mod(toPos, panels.length);

        const uiFrom = from[fromPanelIndex].transform;
        const uiTo   = to[toPanelIndex].transform;

        const z1 = WAVE_Z * 0.16;
        const z2 = WAVE_Z * 0.34;
        const z3 = WAVE_Z * 0.20;

        const rx1 = WAVE_X * 0.16;
        const rx2 = WAVE_X * 0.30;
        const rx3 = WAVE_X * 0.20;

        const s1  = 1 + ((WAVE_S - 1) * 0.16);
        const s2  = 1 + ((WAVE_S - 1) * 0.30);
        const s3  = 1 + ((WAVE_S - 1) * 0.20);

        const uiMid1 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z1, 0, rx1, s1);
        const uiMid2 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z2, 0, rx2, s2);
        const uiMid3 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z3, 0, rx3, s3);

        uiAnim = activeUIEl.animate(
          [
            { transform: uiFrom, offset: 0 },
            { transform: uiMid1, offset: BASE_O1 },
            { transform: uiMid2, offset: BASE_O2 },
            { transform: uiMid3, offset: BASE_O3 },
            { transform: uiTo,  offset: 1 }
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

    function next(){ step(+1 * direction); }

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

      // only active panel reacts to click/enter (prevents side jump)
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

    // Select -> fullscreen (THIS FIXES TOP DECK)
    if (selectBtn){
      selectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const w = works[activeIdx()] || works[0];
        openFullscreenFromWork(w);
      });
    }

    // Arrow
    if (arrowBtn){
      arrowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        next();
      });
    }

    // Focus on pointerdown inside deck (but ignore buttons/arrows)
    deckEl.addEventListener('pointerdown', (e) => {
      if (isFullscreenOpen()) return;
      const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, .menu, .menu-btn');
      if (interactive) return;

      // focus this deck
      if (viewport){
        viewport.classList.remove('focus-top', 'focus-bottom');
        viewport.classList.add(deckEl.id === 'deckTop' ? 'focus-top' : 'focus-bottom');
      }
    });

    // Pointer pan/zoom (per deck)
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

      const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, .menu, .menu-btn');
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

    // Wheel zoom (per deck)
    deckEl.addEventListener('wheel', (e) => {
      if (isFullscreenOpen()) return;
      e.preventDefault();

      const rect = deckEl.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0018);
      setZoomAt(tZoom * factor, cx, cy);
    }, { passive:false });

    // Desktop hover tilt (per deck)
    deckEl.addEventListener('mousemove', (e) => {
      const r = deckEl.getBoundingClientRect();
      const nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      const ny = clamp(((e.clientY - r.top)  / r.height) * 2 - 1, -1, 1);

      // subtle tilt
      deckEl.style.setProperty('--tiltY', (nx * 5).toFixed(2) + 'deg');
      deckEl.style.setProperty('--tiltX', (-ny * 4).toFixed(2) + 'deg');
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

    // resize
    window.addEventListener('resize', () => {
      clampPanTarget();
      ensureAnim();
      requestAnimationFrame(() => applyInstant(activePos));
    });

    // public API (if needed)
    return { next, applyInstant };
  }

  // Create decks
  const top = createDeck({
    deckEl: document.getElementById('deckTop'),
    panEl: document.getElementById('spacePanTop'),
    zoomEl: document.getElementById('spaceZoomTop'),
    lepEl: document.getElementById('leporelloTop'),
    activeUIEl: document.getElementById('activeUITop'),
    titleEl: document.getElementById('amTitleTop'),
    statusEl: document.getElementById('amStatusTop'),
    collectEl: document.getElementById('activeCollectTop'),
    selectBtn: document.getElementById('selectBtnTop'),
    arrowBtn: document.getElementById('arrowTopLeft'),
    works: worksTop,

    // ✅ “left arrow should slide left” feel:
    // (this means the content advances in the opposite direction of bottom)
    direction: +1,
  });

  const bottom = createDeck({
    deckEl: document.getElementById('deckBottom'),
    panEl: document.getElementById('spacePanBottom'),
    zoomEl: document.getElementById('spaceZoomBottom'),
    lepEl: document.getElementById('leporelloBottom'),
    activeUIEl: document.getElementById('activeUIBottom'),
    titleEl: document.getElementById('amTitleBottom'),
    statusEl: document.getElementById('amStatusBottom'),
    collectEl: document.getElementById('activeCollectBottom'),
    selectBtn: document.getElementById('selectBtnBottom'),
    arrowBtn: document.getElementById('arrowBottomRight'),
    works: worksBottom,

    // bottom right arrow: “next to the right”
    direction: +1,
  });

  // Optional: background “breath” shift (very subtle)
  if (spaceBg){
    let t = 0;
    const tick = () => {
      t += 0.008;
      const bx = Math.sin(t) * 8;
      const by = Math.cos(t * 0.8) * 6;
      spaceBg.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
});
