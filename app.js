// app.js

/* ===== Global hard-blocks (desktop drag-to-desktop + context menu) ===== */
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

/* preload */
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

/* ===== Main init after DOM is ready ===== */
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("ready");

  /* Elements */
  const viewport = document.getElementById('viewport');
  const spacePan  = document.getElementById('spacePan');
  const spaceZoom = document.getElementById('spaceZoom');

  /* ===== Menu (About/Contact/Posts live in #menu; CSS anchors it LEFT now) ===== */
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const header = document.querySelector('.film-header');

  function setMenu(open){
    if (!menuBtn || !menu) return;
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (header) header.classList.toggle('menu-open', open); // drives fold/unfold CSS
  }

  if (menuBtn && menu){
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu(!menu.classList.contains('open'));
    });

    // don't close when clicking inside menu
    menu.addEventListener('click', (e) => e.stopPropagation());
    if (header) header.addEventListener('click', (e) => e.stopPropagation());

    // extra: right cluster (brand + burger) should not trigger "outside click closes"
    const headerRight = document.querySelector('.header-right');
    if (headerRight) headerRight.addEventListener('click', (e) => e.stopPropagation());

    // click anywhere else closes
    document.addEventListener('click', () => setMenu(false));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });
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

    // “toward me” feel: translateZ increases with zoom
    const zoomZ = Math.max(0, (zoom - 1)) * 320;

    spaceZoom.style.setProperty('--zoom', zoom);
    spaceZoom.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
    spacePan.style.setProperty('--panX', panX + 'px');
    spacePan.style.setProperty('--panY', panY + 'px');
  }

  function ensureAnim(){
    if (animRaf) return;
    const ease = 0.16;

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

  // Center-anchored zoom (prevents drift / corner jump)
  function setZoomAt(newZoom, cx, cy){
    newZoom = clamp(newZoom, zoomMin(), zoomMax());
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();

    // convert top-left coords to center coords
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

  /* ===== Leporello ===== */
  const lep = document.getElementById('leporello');
  const panels = [];
  let active = 0;
  let animating = false;

  if (lep){
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

      // hard-block native drag/select on panel images
      const im = el.querySelector('img');
      if (im){
        im.addEventListener('dragstart', (e) => e.preventDefault());
        im.addEventListener('mousedown', (e) => e.preventDefault());
        im.addEventListener('contextmenu', (e) => e.preventDefault());
      }

      el.addEventListener('click', () => {
        active = idx;
        layout3D();
        syncActiveUI();
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          active = idx;
          layout3D();
          syncActiveUI();
        }
      });

      lep.appendChild(el);
      panels.push(el);
    });
  }

  function layout3D(){
    if (!panels.length) return;

    const panelW = numPx(cssVar('--panelW'));
    const angleStep = numDeg(cssVar('--angleStep'));
    const maxAngle  = numDeg(cssVar('--maxAngle'));
    const zStep     = numPx(cssVar('--zStep'));
    const xStepPct  = num(cssVar('--xStep')) / 100;
    const stepX     = panelW * xStepPct;

    panels.forEach((el, i) => {
      const d = i - active;
      const ad = Math.abs(d);

      const rot = clamp(-d * angleStep, -maxAngle, maxAngle);
      const x   = d * stepX;
      const z   = -ad * zStep;
      const op  = clamp(1 - ad * 0.05, 0.72, 1);

      el.style.transform = `translate3d(${x}px, 0px, ${z}px) rotateY(${rot}deg)`;
      el.style.opacity = op;
    });
  }

  /* Flow next */
  function next(){
    if (animating || works.length < 2) return;
    animating = true;
    active = (active + 1) % works.length;
    layout3D();
    syncActiveUI();
    setTimeout(() => { animating = false; }, 680);
  }

  const arrowRight = document.getElementById('arrowRight');
  if (arrowRight){
    arrowRight.addEventListener('click', (e) => { e.preventDefault(); next(); });
  }

  /* ===== Active UI positioning ===== */
  const activeUI = document.getElementById('activeUI');
  const amTitle = document.getElementById('amTitle');
  const amStatus = document.getElementById('amStatus');
  const activeCollect = document.getElementById('activeCollect');

  function syncActiveUI(){
    const w = works[active] || works[0];
    if (!w || !activeUI) return;

    if (amTitle) amTitle.textContent = w.title || "Untitled";
    if (amStatus) amStatus.textContent = w.status || "Unveiling soon";
    if (activeCollect) activeCollect.href = w.collect || "https://collect.nellekristoff.art";

    const p = panels[active];
    if (!p) return;

    activeUI.style.transform = p.style.transform || "";
    activeUI.style.width = getComputedStyle(p).width;
    activeUI.style.height = getComputedStyle(p).height;
    activeUI.style.left = getComputedStyle(p).left;
    activeUI.style.top  = getComputedStyle(p).top;
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
    const w = works[active] || works[0];
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

    // smooth wheel zoom (trackpad-friendly)
    viewport.addEventListener('wheel', (e) => {
      if (isFullscreenOpen()) return;
      e.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoomAt(tZoom * factor, cx, cy);
    }, { passive:false });
  }

  /* ===== Fullscreen image: pan/zoom + hard block native drag/select ===== */
  if (fullscreen && fsImg){
    fsImg.setAttribute('draggable', 'false');
    ['dragstart','contextmenu'].forEach(evt =>
      fsImg.addEventListener(evt, (e) => e.preventDefault())
    );
    fsImg.addEventListener('mousedown', (e) => e.preventDefault());

    let x = 0, y = 0, s = 1;
    let isPanning = false;
    let startX = 0, startY = 0;
    let lastTouchDist = null;

    const clamp2 = (v, a, b) => Math.max(a, Math.min(b, v));

    function applyFS(){
      const z = (s - 1) * 420;
      fsImg.style.transformOrigin = '50% 50%';
      fsImg.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${s})`;
    }

    function resetFS(){
      x = 0; y = 0; s = 1;
      lastTouchDist = null;
      applyFS();
    }

    const obs = new MutationObserver(() => {
      if (fullscreen.classList.contains('open')) resetFS();
    });
    obs.observe(fullscreen, { attributes:true, attributeFilter:['class'] });

    fullscreen.style.perspective = fullscreen.style.perspective || '1200px';
    fullscreen.style.transformStyle = 'preserve-3d';
    fsImg.style.transformStyle = 'preserve-3d';

    fsImg.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fsImg.setPointerCapture(e.pointerId);
      isPanning = true;
      startX = e.clientX - x;
      startY = e.clientY - y;
    });

    fsImg.addEventListener('pointermove', (e) => {
      if (!isPanning) return;
      e.preventDefault();
      x = e.clientX - startX;
      y = e.clientY - startY;
      applyFS();
    });

    fsImg.addEventListener('pointerup', () => { isPanning = false; lastTouchDist = null; });
    fsImg.addEventListener('pointercancel', () => { isPanning = false; lastTouchDist = null; });

    fsImg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = (e.deltaY < 0) ? 1.08 : 0.92;
      s = clamp2(s * zoomFactor, 1, 6);
      applyFS();
    }, { passive:false });

    fsImg.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();

      const [t1, t2] = e.touches;
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const distNow = Math.hypot(dx, dy);

      if (lastTouchDist == null) lastTouchDist = distNow;

      const ratio = distNow / lastTouchDist;
      s = clamp2(s * ratio, 1, 6);
      lastTouchDist = distNow;

      applyFS();
    }, { passive:false });
  }

  /* ===== Keyboard ===== */
  window.addEventListener('keydown', (e) => {
    // ESC closes fullscreen first
    if (e.key === 'Escape' && isFullscreenOpen()){
      closeFullscreen();
      return;
    }
    if (isFullscreenOpen()) return;

    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft'){
      active = (active - 1 + works.length) % works.length;
      layout3D();
      syncActiveUI();
    }
  });

  /* init */
  function init(){
    zoom = tZoom = 1;
    panX = tPanX = 0;
    panY = tPanY = 0;
    applyView();
    layout3D();
    syncActiveUI();
  }
  init();

  window.addEventListener('resize', () => {
    clampPanTarget();
    ensureAnim();
    layout3D();
    syncActiveUI();
  });
});
