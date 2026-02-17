window.addEventListener("load", () => {
  document.documentElement.classList.add("ready");
});

/* Make these available for inline onclick */
window.contact = function contact(e){
  if (e) e.preventDefault();
  window.location.href = "mailto:nellekristoff@gmail.com";
};

window.closeLightbox = function closeLightbox(){
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.body.classList.remove('noscroll');
};

function openLightbox(src, titleText){
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lightbox || !img) return;

  img.src = src;
  img.alt = titleText || "";
  lightbox.classList.add('open');
  document.body.classList.add('noscroll');
}

/* Menu */
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');

if (menuBtn && menu){
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  });
}

/* Close lightbox on Escape */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeLightbox();
});

/* Works */
const works = [
  { src:"images/Untitled1.png", title:"Untitled 1", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled2.png", title:"Untitled 2", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
  { src:"images/Untitled3.png", title:"Untitled 3", status:"Unveiling soon", collect:"https://collect.nellekristoff.art" },
];

/* preload */
works.forEach(w => { const i = new Image(); i.src = w.src; });

/* Build panels */
const lep = document.getElementById('leporello');
const panels = [];

if (lep){
  works.forEach((w) => {
    const el = document.createElement('div');
    el.className = 'panel';
    el.tabIndex = 0;
    el.innerHTML = `
      <div class="print">
        <img src="${w.src}" alt="${w.title}">
        <div class="noise"></div>
      </div>
    `;
    el.addEventListener('click', () => openLightbox(w.src, w.title));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(w.src, w.title);
      }
    });
    lep.appendChild(el);
    panels.push(el);
  });
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function numPx(v){ return parseFloat(String(v).replace('px','')) || 0; }
function numDeg(v){ return parseFloat(String(v).replace('deg','')) || 0; }
function num(v){ return parseFloat(v) || 0; }

let active = 0;
let animating = false;

/* View (pan/zoom) */
const viewport = document.getElementById('viewport');
const spacePan  = document.getElementById('spacePan');
const spaceZoom = document.getElementById('spaceZoom');

let zoom = 1;
let panX = 0;
let panY = 0;

function zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
function zoomMax(){ return num(cssVar('--zoomMax')) || 2.2; }

function clampPan(){
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const maxX = (rect.width  * (zoom - 1)) * 0.55;
  const maxY = (rect.height * (zoom - 1)) * 0.55;
  panX = clamp(panX, -maxX, maxX);
  panY = clamp(panY, -maxY, maxY);
}

function applyView(){
  if (!spacePan || !spaceZoom) return;
  spaceZoom.style.setProperty('--zoom', zoom);
  spacePan.style.setProperty('--panX', panX + 'px');
  spacePan.style.setProperty('--panY', panY + 'px');

  const zr = document.getElementById('zoomReadout');
  if (zr) zr.textContent = `Zoom ${Math.round(zoom*100)}%`;
}

let rafPending = false;
function applyViewRaf(){
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    applyView();
  });
}

function updateInfo(){
  const w = works[active] || works[0];
  const t = document.getElementById('workTitle');
  const s = document.getElementById('workStatus');
  const c = document.getElementById('collectBtn');
  const i = document.getElementById('indexReadout');

  if (t) t.textContent = w ? w.title : 'Untitled';
  if (s) s.textContent = w ? w.status : '';
  if (c) c.href = w ? w.collect : 'https://collect.nellekristoff.art';
  if (i) i.textContent = `${active+1} / ${works.length}`;
}

/* 3D layout */
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
    el.style.filter = 'none';
    el.style.pointerEvents = 'auto';
  });

  updateInfo();
}

/* Flow */
function next(){
  if (animating || works.length < 2) return;
  animating = true;
  active = (active + 1) % works.length;
  layout3D();
  setTimeout(() => { animating = false; }, 680);
}

const arrowRight = document.getElementById('arrowRight');
if (arrowRight){
  arrowRight.addEventListener('click', (e) => {
    e.preventDefault();
    next();
  });
}

/* Keyboard flow */
window.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  const lbOpen = lb && lb.classList.contains('open');
  if (lbOpen) return;

  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft'){
    active = (active - 1 + works.length) % works.length;
    layout3D();
  }
});

/* Pan + Zoom */
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

function zoomTo(newZoom, cx, cy){
  newZoom = clamp(newZoom, zoomMin(), zoomMax());
  const k = newZoom / zoom;
  panX = (panX - cx) * k + cx;
  panY = (panY - cy) * k + cy;
  zoom = newZoom;
  clampPan();
}

function zoomAt(factor, cx, cy){
  const newZoom = clamp(zoom * factor, zoomMin(), zoomMax());
  const k = newZoom / zoom;
  panX = (panX - cx) * k + cx;
  panY = (panY - cy) * k + cy;
  zoom = newZoom;
  clampPan();
  applyViewRaf();
}

if (viewport){
  viewport.addEventListener('pointerdown', (e) => {
    viewport.setPointerCapture(e.pointerId);
    setPointer(e);

    if (pointers.size === 1){
      lastPan = { x: e.clientX, y: e.clientY };
      pinchStart = null;
    } else if (pointers.size === 2){
      const [p1, p2] = getTwoPointers();
      pinchStart = { d: dist(p1,p2), z: zoom, m: mid(p1,p2) };
      lastPan = null;
    }
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    updatePointer(e);

    if (pointers.size === 1 && lastPan){
      const dx = e.clientX - lastPan.x;
      const dy = e.clientY - lastPan.y;
      panX += dx;
      panY += dy;
      lastPan = { x: e.clientX, y: e.clientY };
      clampPan();
      applyViewRaf();
    }

    if (pointers.size >= 2){
      const two = getTwoPointers();
      if (!two) return;
      const [p1, p2] = two;

      const dNow = dist(p1,p2);
      const mNow = mid(p1,p2);

      if (!pinchStart){
        pinchStart = { d: dNow, z: zoom, m: mNow };
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const cx = mNow.x - rect.left;
      const cy = mNow.y - rect.top;

      const newZoom = pinchStart.z * (dNow / pinchStart.d);
      zoomTo(newZoom, cx, cy);

      const mdx = mNow.x - pinchStart.m.x;
      const mdy = mNow.y - pinchStart.m.y;

      panX += mdx;
      panY += mdy;

      pinchStart.m = mNow;

      clampPan();
      applyViewRaf();
    }
  });

  function endPointer(e){
    pointers.delete(e.pointerId);
    if (pointers.size === 0){
      lastPan = null;
      pinchStart = null;
    }
    if (pointers.size === 1){
      const remaining = Array.from(pointers.values())[0];
      lastPan = remaining ? { x: remaining.x, y: remaining.y } : null;
      pinchStart = null;
    }
  }

  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = (e.deltaY < 0) ? 1.08 : 0.92;
    zoomAt(factor, cx, cy);
  }, { passive:false });
}

/* Reset */
const resetBtn = document.getElementById('resetView');
if (resetBtn){
  resetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    zoom = 1;
    panX = 0;
    panY = 0;
    applyView();
  });
}

/* init AFTER full load (prevents forced-layout warning) */
function init(){
  clampPan();
  applyView();
  layout3D();
}

window.addEventListener('load', () => {
  init();
});

window.addEventListener('resize', () => {
  requestAnimationFrame(() => {
    clampPan();
    applyView();
    layout3D();
  });
});

/* Motion background */
const bg = document.getElementById('spaceBg');
const motionBtn = document.getElementById('motionBtn');

let motionEnabled = false;

let tRx = 0, tRy = 0, tPx = 0, tPy = 0;
let cRx = 0, cRy = 0, cPx = 0, cPy = 0;
let bgRaf = null;

const inertia = 0.12;

function setBgTarget(rx, ry, px, py){
  tRx = rx; tRy = ry; tPx = px; tPy = py;
  ensureBgAnim();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && bgRaf){
    cancelAnimationFrame(bgRaf);
    bgRaf = null;
  }
});

function tickBg(){
  cRx += (tRx - cRx) * inertia;
  cRy += (tRy - cRy) * inertia;
  cPx += (tPx - cPx) * inertia;
  cPy += (tPy - cPy) * inertia;
  setBgMotion(cRx, cRy, cPx, cPy);

  const still =
    Math.abs(tRx - cRx) < 0.01 &&
    Math.abs(tRy - cRy) < 0.01 &&
    Math.abs(tPx - cPx) < 0.1  &&
    Math.abs(tPy - cPy) < 0.1;

  if (!motionEnabled && still){
    bgRaf = null;
    return;
  }

  bgRaf = requestAnimationFrame(tickBg);
}

function ensureBgAnim(){
  if (bgRaf) return;
  bgRaf = requestAnimationFrame(tickBg);
}

function setBgMotion(rxDeg, ryDeg, px, py){
  if (!bg) return;
  const rx = Math.max(-6, Math.min(6, rxDeg));
  const ry = Math.max(-8, Math.min(8, ryDeg));
  bg.style.setProperty('--bgTiltX', rx.toFixed(2) + 'deg');
  bg.style.setProperty('--bgTiltY', ry.toFixed(2) + 'deg');
  bg.style.setProperty('--bgPanX', (px || 0).toFixed(1) + 'px');
  bg.style.setProperty('--bgPanY', (py || 0).toFixed(1) + 'px');
}

function startMotion(){
  if (motionEnabled) return;
  motionEnabled = true;

  window.addEventListener('deviceorientation', (e) => {
    const beta  = e.beta ?? 0;
    const gamma = e.gamma ?? 0;

    const rx = (beta - 20) * 0.08;
    const ry = gamma * 0.10;

    const px = gamma * 0.35;
    const py = (beta - 20) * 0.25;

    setBgTarget(rx, ry, px, py);
  }, { passive:true });

  if (motionBtn){
    motionBtn.textContent = 'Motion enabled';
    motionBtn.style.opacity = '0.75';
  }
}

async function requestMotionPermission(){
  try{
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'){
      const res = await DeviceMotionEvent.requestPermission();
      if (res === 'granted') { startMotion(); return; }
    }
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'){
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') { startMotion(); return; }
    }
    startMotion();
  } catch (err){
    alert('Motion permission blocked. On iPhone: Settings → Safari → Motion & Orientation Access → ON, and open on HTTPS in Safari.');
  }
}

if (motionBtn){
  motionBtn.addEventListener('click', (e) => {
    e.preventDefault();
    requestMotionPermission();
  });
}

/* Fallback parallax (finger) */
if (viewport){
  viewport.addEventListener('pointermove', (e) => {
    if (motionEnabled) return;
    const rect = viewport.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width  - 0.5;
    const ny = (e.clientY - rect.top)  / rect.height - 0.5;
    setBgTarget(ny * -7, nx * 10, nx * 26, ny * 20);
  }, { passive:true });
}