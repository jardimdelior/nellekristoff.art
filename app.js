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

window.worksTop = worksTop;
window.worksBottom = worksBottom;

/* preload */
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

  /* ===== Chrome fullscreen UI guard (tabs overlay) ===== */
  function updateFsTopPad(){
    const isFsLike = window.innerHeight >= screen.height * 0.92;
    const ui = isFsLike ? Math.max(0, screen.height - window.innerHeight) : 0;
    const pad = Math.min(Math.max(ui, 0), 120);
    document.documentElement.style.setProperty('--fsTopPad', pad + 'px');
  }
  updateFsTopPad();
  window.addEventListener('resize', updateFsTopPad, { passive:true });

  /* ===== Menu toggle ===== */
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const header = document.getElementById('siteHeader');

  function setMenu(open){
    if (!menuBtn || !menu) return;
    menu.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (header) header.classList.toggle('menu-open', open);
  }

  if (menu) menu.addEventListener('click', (e) => e.stopPropagation());

  if (menuBtn){
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = !(header && header.classList.contains('menu-open'));
      setMenu(open);
    });
    document.addEventListener('click', () => setMenu(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ===== Fullscreen ===== */
  const fullscreen = document.getElementById('fullscreen');
  const fsImg = document.getElementById('fsImg');
  const fsTitle = document.getElementById('fsTitle');
  const fsStatus = document.getElementById('fsStatus');
  const fsCollect = document.getElementById('fsCollect');

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
    document.body.classList.add('noscroll');
  }

  function closeFullscreen(){
    if (!fullscreen) return;
    fullscreen.classList.remove('open');
    fullscreen.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('noscroll');
  }

  if (fullscreen){
    fullscreen.addEventListener('click', (e) => {
      if (e.target.closest('#fsCollect')) return; // don't close on Collect
      closeFullscreen(); // close on ANY click otherwise
    });
  }
  if (fsCollect){
    fsCollect.addEventListener('click', (e) => e.stopPropagation());
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenOpen()) closeFullscreen();
  });

  /* ===== Build a deck ===== */
  function createDeck(opts){
    const {
      deckEl,
      lepEl,
      activeUIEl,
      titleEl,
      statusEl,
      selectBtn,
      arrowBtn,
      works,
      direction,
      focusClass
    } = opts;

    if (!deckEl || !lepEl || !works || !works.length) return null;

    // per deck pan/zoom
    let zoom = 1, panX = 0, panY = 0;
    let tZoom = 1, tPanX = 0, tPanY = 0;
    let raf = null;

    // slideshow state
    const panels = [];
    let activePos = 0;
    let animating = false;

    const DURATION = 1100;
    const EASING   = 'cubic-bezier(.10,.88,.16,1)';

    function zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
    function zoomMax(){ return num(cssVar('--zoomMax')) || 1.35; }

    function applyView(){
      const zoomZ = Math.max(0, (zoom - 1)) * 320;
      deckEl.style.setProperty('--zoom', String(zoom));
      deckEl.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
      deckEl.style.setProperty('--panX', panX.toFixed(1) + 'px');
      deckEl.style.setProperty('--panY', panY.toFixed(1) + 'px');
    }

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

    // Improved smoothing + early defocus (removes “pepper jump”)
    function ensureAnim(){
      if (raf) return;

      let lastT = performance.now();

      const tick = (now) => {
        const dt = Math.min(32, now - lastT);
        lastT = now;

        const k = 1 - Math.pow(1 - 0.22, dt / 16.67);

        zoom += (tZoom - zoom) * k;
        panX += (tPanX - panX) * k;
        panY += (tPanY - panY) * k;

        applyView();

        if (viewport){
          const zMin = zoomMin();
          const wantsOverview = (tZoom <= zMin + 0.002);
          const closeEnough   = (zoom  <= zMin + 0.020);
          if (wantsOverview && closeEnough){
            viewport.classList.remove('focus-top', 'focus-bottom');
          }
        }

        const done =
          Math.abs(tZoom - zoom) < 0.0012 &&
          Math.abs(tPanX - panX) < 0.18 &&
          Math.abs(tPanY - panY) < 0.18;

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

    function getPanelW(){
      const p = panels[0];
      if (!p) return 0;
      return parseFloat(getComputedStyle(p).width) || 0;
    }

    function buildT(x, z, rotY){
      return `translate3d(-50%, -50%, 0) translate3d(${x}px, 0px, ${z}px) rotateY(${rotY}deg)`;
    }

    function activeIdx(){ return mod(activePos, works.length); }
    function activePanelIdx(){ return mod(activePos, panels.length); }

    function syncActiveUIText(pos){
      const w = works[mod(pos, works.length)] || works[0];
      if (!w) return;
      if (titleEl) titleEl.textContent = w.title || "Untitled";
      if (statusEl) statusEl.textContent = w.status || "Unveiling soon";
    }

    function setActiveUITransformFromPanel(panelEl){
      if (!activeUIEl || !panelEl) return;
      activeUIEl.style.transform = panelEl.style.transform || "";
      activeUIEl.style.width  = getComputedStyle(panelEl).width;
      activeUIEl.style.height = getComputedStyle(panelEl).height;
      activeUIEl.style.left   = getComputedStyle(panelEl).left;
      activeUIEl.style.top    = getComputedStyle(panelEl).top;
    }

    function getTargets(targetPos){
      const panelW = getPanelW();
      const angleStep = numDeg(cssVar('--angleStep'));
      const maxAngle  = numDeg(cssVar('--maxAngle'));
      const zStep     = numPx(cssVar('--zStep'));
      const xStepPct  = num(cssVar('--xStep')) / 100;
      const stepX     = panelW * xStepPct;

      const sideAngleMult = num(cssVar('--sideAngleMult')) || 1;
      const sideDepthMult = num(cssVar('--sideDepthMult')) || 1;
      const sideXMult     = num(cssVar('--sideXMult'))     || 1;

      const n = panels.length;

      return panels.map((_, i) => {
        const iV = nearestVirtual(i, targetPos, n);
        const d  = iV - targetPos;
        const ad = Math.abs(d);

        const rot = (d === 0) ? 0 : clamp(-d * angleStep * sideAngleMult, -maxAngle, maxAngle);
        const x   = (d === 0) ? 0 : d * stepX * sideXMult;
        const z   = (d === 0) ? 0 : (-ad * zStep * sideDepthMult);

        const op  = (d === 0) ? 1 : clamp(1 - ad * 0.08, 0.68, 1);
        const zIndex = String(100 - Math.round(ad * 10));

        return { transform: buildT(x, z, rot), opacity: String(op), zIndex };
      });
    }

    function applyInstant(pos){
      const t = getTargets(pos);
      panels.forEach((el, i) => {
        el.style.transform = t[i].transform;
        el.style.opacity   = t[i].opacity;
        el.style.zIndex    = t[i].zIndex;
      });
      syncActiveUIText(pos);
      setActiveUITransformFromPanel(panels[mod(pos, panels.length)]);
    }

    function animateTo(toPos){
      if (animating) return;
      animating = true;

      const fromPos = activePos;
      const from = getTargets(fromPos);
      const to   = getTargets(toPos);

      panels.forEach((el, i) => {
        el.style.transform = from[i].transform;
        el.style.opacity   = from[i].opacity;
        el.style.zIndex    = from[i].zIndex;
      });

      const anims = panels.map((el, i) => el.animate(
        [
          { transform: from[i].transform, opacity: from[i].opacity },
          { transform: to[i].transform,   opacity: to[i].opacity }
        ],
        { duration: DURATION, easing: EASING, fill: 'forwards' }
      ));

      const uiAnim = activeUIEl ? activeUIEl.animate(
        [
          { transform: from[mod(fromPos, panels.length)].transform },
          { transform: to[mod(toPos, panels.length)].transform }
        ],
        { duration: DURATION, easing: EASING, fill: 'forwards' }
      ) : null;

      Promise.allSettled([...anims.map(a => a.finished), uiAnim ? uiAnim.finished : Promise.resolve()])
        .then(() => {
          activePos = toPos;
          animating = false;
          applyInstant(activePos);
        });
    }

    function next(){
      if (works.length < 2) return;
      animateTo(activePos + direction);
    }

    // Build panels
    works.forEach((w, idx) => {
      const el = document.createElement('div');
      el.className = 'panel';
      el.tabIndex = 0;
      el.innerHTML = `
        <div class="print">
          <img src="${w.src}" alt="${w.title || ''}" draggable="false">
          <div class="noise"></div>
        </div>
      `;

      // only active opens fullscreen
      el.addEventListener('click', () => {
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

    // Focus on pointerdown in deck (ignore UI/buttons)
    function isInteractiveTarget(target){
      return !!target.closest('button, a, .tabBtn, .film-arrow, .arrow-slot, .menu, .menu-btn, .edgeTab');
    }

    deckEl.addEventListener('pointerdown', (e) => {
      if (isFullscreenOpen()) return;
      if (isInteractiveTarget(e.target)) return;

      if (viewport){
        viewport.classList.remove('focus-top', 'focus-bottom');
        viewport.classList.add(focusClass);
      }
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
      if (isInteractiveTarget(e.target)) return;

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

      const factor = Math.exp(-e.deltaY * 0.0024);
      setZoomAt(tZoom * factor, cx, cy);
    }, { passive:false });

    
    // ===== Smooth “sphere drift” hover (orbit XY + tilt + Z depth) =====
    let hoverRAF = null;
    let hoverActive = false;
    
    // current values
    let curTX = 0, curTY = 0;
    let curX = 0, curY = 0, curZ = 0;
    
    // targets
    let tgtTX = 0, tgtTY = 0;
    let tgtX = 0, tgtY = 0, tgtZ = 0;
    
    function setSphereTargetsFromEvent(e){
      const r = deckEl.getBoundingClientRect();
    
      // normalize mouse to -1..+1
      let nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      let ny = ((e.clientY - r.top)  / r.height) * 2 - 1;
      nx = clamp(nx, -1, 1);
      ny = clamp(ny, -1, 1);
    
      // deadzone removes micro jitter around center
      const dz = 0.08;
      const dx = Math.abs(nx) < dz ? 0 : (nx - Math.sign(nx) * dz) / (1 - dz);
      const dy = Math.abs(ny) < dz ? 0 : (ny - Math.sign(ny) * dz) / (1 - dz);
    
      // ===== AMPLITUDES (tune these) =====
      const rotY = 6.5;    // degrees
      const rotX = 5.0;    // degrees
      const orbX = 18;     // px (horizontal drift)
      const orbY = 14;     // px (vertical drift)
      const depZ = 70;     // px (depth “breathing”)
    
      // symmetric tilt
      tgtTY = dx * rotY;
      tgtTX = -dy * rotX;
    
      // orbit drift (feels like sphere moving under glass)
      tgtX = dx * orbX;
      tgtY = dy * orbY;
    
      // depth: forward near center, less at edges
      const rr = Math.min(1, Math.hypot(dx, dy)); // 0 center -> 1 edges
      const ease = 1 - (rr * rr);                // smooth falloff
      tgtZ = ease * depZ;
    
      hoverActive = true;
      ensureSphereAnim();
    }
    
    function ensureSphereAnim(){
      if (hoverRAF) return;
    
      let lastT = performance.now();
      const tick = (now) => {
        const dt = Math.min(32, now - lastT);
        lastT = now;
    
        // slow + smooth easing (lower = floatier)
        const k = 1 - Math.pow(1 - 0.07, dt / 16.67);
    
        curTX += (tgtTX - curTX) * k;
        curTY += (tgtTY - curTY) * k;
    
        curX  += (tgtX  - curX ) * k;
        curY  += (tgtY  - curY ) * k;
        curZ  += (tgtZ  - curZ ) * k;
    
        deckEl.style.setProperty('--tiltX',  curTX.toFixed(3) + 'deg');
        deckEl.style.setProperty('--tiltY',  curTY.toFixed(3) + 'deg');
        deckEl.style.setProperty('--hoverX', curX.toFixed(2)  + 'px');
        deckEl.style.setProperty('--hoverY', curY.toFixed(2)  + 'px');
        deckEl.style.setProperty('--hoverZ', curZ.toFixed(2)  + 'px');
    
        const done =
          Math.abs(tgtTX - curTX) < 0.01 &&
          Math.abs(tgtTY - curTY) < 0.01 &&
          Math.abs(tgtX  - curX ) < 0.20 &&
          Math.abs(tgtY  - curY ) < 0.20 &&
          Math.abs(tgtZ  - curZ ) < 0.40;
    
        if (!hoverActive && done){
          hoverRAF = null;
          return;
        }
        hoverRAF = requestAnimationFrame(tick);
      };
    
      hoverRAF = requestAnimationFrame(tick);
    }
    
    function resetSphere(){
      hoverActive = false;
      tgtTX = 0; tgtTY = 0;
      tgtX  = 0; tgtY  = 0; tgtZ = 0;
      ensureSphereAnim();
    }
    
    // don’t fight with pan/zoom/fullscreen
    function isInteracting(){
      return pointers.size > 0 || isFullscreenOpen();
    }
    
    deckEl.addEventListener('mousemove', (e) => {
      if (isInteracting()) return;
      setSphereTargetsFromEvent(e);
    });
    
    deckEl.addEventListener('mouseleave', resetSphere);

    // Arrow (freeze drift during slide moments)
    function setViewStraight(){
      hoverActive = false;
      tgtTX = tgtTY = 0;
      tgtX = tgtY = tgtZ = 0;
    
      curTX = curTY = 0;
      curX = curY = curZ = 0;
    
      deckEl.style.setProperty('--tiltX', '0deg');
      deckEl.style.setProperty('--tiltY', '0deg');
      deckEl.style.setProperty('--hoverX', '0px');
      deckEl.style.setProperty('--hoverY', '0px');
      deckEl.style.setProperty('--hoverZ', '0px');
    }
    
    if (arrowBtn){
      arrowBtn.addEventListener('mouseenter', setViewStraight);
      arrowBtn.addEventListener('pointerdown', setViewStraight);
    
      arrowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setViewStraight();
        next();
      });
    }

    function focus(){
      if (!viewport) return;
      viewport.classList.remove('focus-top', 'focus-bottom');
      viewport.classList.add(focusClass);

      tZoom = Math.max(1.0, zoomMin());
      tPanX = 0; tPanY = 0;
      clampPanTarget();
      ensureAnim();

      // IMPORTANT: resync active UI immediately (fixes “gap until arrow click”)
      requestAnimationFrame(() => {
        applyInstant(activePos);
        requestAnimationFrame(() => applyInstant(activePos));
      });
    }

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

    window.addEventListener('resize', () => {
      clampPanTarget();
      ensureAnim();
      requestAnimationFrame(() => applyInstant(activePos));
    });

    return { focus };
  }

  const topDeck = createDeck({
    deckEl: document.getElementById('deckTop'),
    lepEl: document.getElementById('leporelloTop'),
    activeUIEl: document.getElementById('activeUITop'),
    titleEl: document.getElementById('amTitleTop'),
    statusEl: document.getElementById('amStatusTop'),
    selectBtn: document.getElementById('selectBtnTop'),
    arrowBtn: document.getElementById('arrowTopLeft'),
    works: worksTop,
    direction: +1,
    focusClass: 'focus-top',
  });

  const bottomDeck = createDeck({
    deckEl: document.getElementById('deckBottom'),
    lepEl: document.getElementById('leporelloBottom'),
    activeUIEl: document.getElementById('activeUIBottom'),
    titleEl: document.getElementById('amTitleBottom'),
    statusEl: document.getElementById('amStatusBottom'),
    selectBtn: document.getElementById('selectBtnBottom'),
    arrowBtn: document.getElementById('arrowBottomRight'),
    works: worksBottom,
    direction: +1,
    focusClass: 'focus-bottom',
  });

  // Edge label clicks => focus deck
  const openTopDeck = document.getElementById('openTopDeck');
  const openBottomDeck = document.getElementById('openBottomDeck');

  if (openTopDeck && topDeck){
    openTopDeck.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      topDeck.focus();
    });
  }

  if (openBottomDeck && bottomDeck){
    openBottomDeck.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      bottomDeck.focus();
    });
  }

  // subtle background drift
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
