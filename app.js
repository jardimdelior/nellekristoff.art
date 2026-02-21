// app.js
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("ready");
});

/* Contact */
window.contact = function contact(e){
  if (e) e.preventDefault();
  window.location.href = "mailto:nellekristoff@gmail.com";
};

/* Works */
const works = [
  { src:"images/Untitled1.png", title:"Untitled 1", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled2.png", title:"Untitled 2", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled3.png", title:"Untitled 3", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];

/* preload */
works.forEach(w => { const i = new Image(); i.src = w.src; });

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

  // don't close when clicking inside
  menu.addEventListener('click', (e) => e.stopPropagation());
  if (header) header.addEventListener('click', (e) => e.stopPropagation());

  // click anywhere else closes
  document.addEventListener('click', () => setMenu(false));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenu(false);
  });
}

/* helpers */
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function numPx(v){ return parseFloat(String(v).replace('px','')) || 0; }
function numDeg(v){ return parseFloat(String(v).replace('deg','')) || 0; }
function num(v){ return parseFloat(v) || 0; }

/* Elements */
const viewport = document.getElementById('viewport');
const spacePan  = document.getElementById('spacePan');
const spaceZoom = document.getElementById('spaceZoom');

/* ===== Smooth pan/zoom ===== */
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
  const zoomZ = Math.max(0, (zoom - 1)) * 210;
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

function setZoomAt(newZoom, cx, cy){
  newZoom = clamp(newZoom, zoomMin(), zoomMax());
  const baseZoom = zoom;
  const k = newZoom / baseZoom;
  tPanX = (panX - cx) * k + cx;
  tPanY = (panY - cy) * k + cy;
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
        <img src="${w.src}" alt="${w.title}">
        <div class="noise"></div>
      </div>
    `;
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

window.addEventListener('keydown', (e) => {
  if (isFullscreenOpen()) return;
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft'){
    active = (active - 1 + works.length) % works.length;
    layout3D();
    syncActiveUI();
  }
});

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
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isFullscreenOpen()) closeFullscreen();
});

/* ===== Pointer pan/zoom ===== */
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
    const factor = (e.deltaY < 0) ? 1.08 : 0.92;
    setZoomAt(tZoom * factor, cx, cy);
  }, { passive:false });
}

/* init */
function init(){
  zoom = tZoom = 1;
  panX = tPanX = 0;
  panY = tPanY = 0;
  applyView();
  layout3D();
  syncActiveUI();
}
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', () => {
  clampPanTarget();
  ensureAnim();
  layout3D();
  syncActiveUI();
});

(() => {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lightbox || !img) return;

  // ---- Hard block native drag/selection/context menu ----
  img.setAttribute('draggable', 'false');
  ['dragstart','contextmenu'].forEach(evt =>
    img.addEventListener(evt, (e) => e.preventDefault())
  );

  // Prevent “blue selection” on desktop in weird cases
  img.addEventListener('mousedown', (e) => e.preventDefault());

  // ---- Our pan/zoom state ----
  let x = 0, y = 0, s = 1;
  let isPanning = false;
  let startX = 0, startY = 0;
  let lastTouchDist = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function apply(){
    // “Toward me” feeling: we add a small translateZ that increases with scale.
    // It’s still a 2D image, but with perspective it feels like it comes forward.
    const z = (s - 1) * 420; // tweak 300–700 if you want stronger/weaker depth
    img.style.transformOrigin = '50% 50%';
    img.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${s})`;
  }

  function reset(){
    x = 0; y = 0; s = 1;
    lastTouchDist = null;
    apply();
  }

  // Call reset whenever you open the lightbox (optional but recommended)
  // If you already have openLightbox(), just add `reset()` inside it.
  // Otherwise, this will reset when lightbox becomes open by click.
  const obs = new MutationObserver(() => {
    if (lightbox.classList.contains('open')) reset();
  });
  obs.observe(lightbox, { attributes:true, attributeFilter:['class'] });

  // Add perspective to parent for the Z effect
  // (Safe to set inline; if you already do perspective in CSS, keep yours.)
  lightbox.style.perspective = lightbox.style.perspective || '1200px';
  lightbox.style.transformStyle = 'preserve-3d';
  img.style.transformStyle = 'preserve-3d';

  // ---- Pointer pan (mouse + touch via pointer events) ----
  img.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    img.setPointerCapture(e.pointerId);
    isPanning = true;
    startX = e.clientX - x;
    startY = e.clientY - y;
  });

  img.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    e.preventDefault();
    x = e.clientX - startX;
    y = e.clientY - startY;
    apply();
  });

  img.addEventListener('pointerup', (e) => {
    isPanning = false;
    lastTouchDist = null;
  });
  img.addEventListener('pointercancel', () => {
    isPanning = false;
    lastTouchDist = null;
  });

  // ---- Wheel zoom (desktop) ----
  img.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoom = delta > 0 ? 1.08 : 0.92;
    s = clamp(s * zoom, 1, 6);
    apply();
  }, { passive:false });

  // ---- Pinch zoom (mobile Safari/Chrome) ----
  img.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();

    const [t1, t2] = e.touches;
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const dist = Math.hypot(dx, dy);

    if (lastTouchDist == null) lastTouchDist = dist;

    const ratio = dist / lastTouchDist;
    s = clamp(s * ratio, 1, 6);
    lastTouchDist = dist;

    apply();
  }, { passive:false });

})();
