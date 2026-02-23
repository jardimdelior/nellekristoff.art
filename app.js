// app.js — TWO independent decks + focus-to-full-viewport zoom
// - Top deck controlled by TOP-LEFT arrow (moves in opposite direction)
// - Bottom deck controlled by BOTTOM-RIGHT arrow
// - Each deck has its own pan/zoom state (no “together zoom”)
// - Clicking a deck focuses it (expands to full viewport). Zoom always centered.
// - Zooming back to min auto-unfocuses to split view.

document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

/* ===== Works (split into 2 decks) ===== */
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
[...worksTop, ...worksBottom].forEach(w => { const i = new Image(); i.src = w.src; });

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

  const rootViewport = document.getElementById('viewport');

  /* ===== Menu (your original) ===== */
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

  /* ===== Fullscreen (shared) ===== */
  const fullscreen = document.getElementById('fullscreen');
  const fsImg = document.getElementById('fsImg');
  const fsTitle = document.getElementById('fsTitle');
  const fsStatus = document.getElementById('fsStatus');
  const fsCollect = document.getElementById('fsCollect');
  const closeBtn = document.getElementById('closeBtn');

  function isFullscreenOpen(){
    return fullscreen && fullscreen.classList.contains('open');
  }
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

  /* ===== Focus mode (deck expands to full viewport) ===== */
  let focused = null; // "top" | "bottom" | null

  function setFocus(which){
    focused = which; // can be null
    if (!rootViewport) return;
    rootViewport.classList.toggle('focus-top', which === 'top');
    rootViewport.classList.toggle('focus-bottom', which === 'bottom');
  }

  /* ===== Deck Controller (WAAPI + pan/zoom) ===== */
  class Deck {
    constructor(opts){
      this.name = opts.name; // "top" | "bottom"
      this.works = opts.works;
      this.dir = opts.dir; // +1 or -1 for arrow direction
      this.deckEl = opts.deckEl; // .deck-viewport
      this.spacePan = opts.spacePan;
      this.spaceZoom = opts.spaceZoom;
      this.lep = opts.lep;

      // UI
      this.activeUI = opts.activeUI;
      this.amTitle = opts.amTitle;
      this.amStatus = opts.amStatus;
      this.activeCollect = opts.activeCollect;
      this.selectBtn = opts.selectBtn;

      // Panels
      this.panels = [];

      // WAAPI motion tuning (your “breathing” version)
      this.DURATION = 2850;
      this.EASING = 'cubic-bezier(.10,.88,.16,1)';

      this.WAVE_Z = 120;
      this.WAVE_ROT = 16;
      this.WAVE_X = -7.2;
      this.WAVE_S = 1.022;
      this.WAVE_TWIST = 5.0;
      this.TRAVEL_SPREAD = 0.22;

      // Virtual index
      this.activePos = 0;
      this.animating = false;
      this.queuedDir = 0;

      // Pan/zoom
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.tZoom = 1;
      this.tPanX = 0;
      this.tPanY = 0;
      this.animRaf = null;

      // pointers
      this.pointers = new Map();
      this.lastPan = null;
      this.pinchStart = null;

      this.init();
    }

    zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
    zoomMax(){ return num(cssVar('--zoomMax')) || 2.2; }

    // measure unscaled CSS width (prevents jump after zoom)
    getPanelW(){
      const p = this.panels[0];
      if (!p) return 0;
      return parseFloat(getComputedStyle(p).width) || 0;
    }

    buildT(x, z, rotY, extraZ = 0, extraRotY = 0, extraRotX = 0, extraScale = 1){
      return `translate3d(-50%, -50%, 0) translate3d(${x}px, 0px, ${z + extraZ}px) rotateY(${rotY + extraRotY}deg) rotateX(${extraRotX}deg) scale(${extraScale})`;
    }

    cancelAnim(el){
      if (!el || typeof el.getAnimations !== 'function') return;
      el.getAnimations().forEach(a => a.cancel());
    }
    cancelAll(){
      this.panels.forEach(el => this.cancelAnim(el));
      this.cancelAnim(this.activeUI);
    }

    clampPanTarget(){
      if (!this.deckEl) return;
      const rect = this.deckEl.getBoundingClientRect();

      // allow a little drift even when zoomed out
      const slackX = rect.width  * 0.08;
      const slackY = rect.height * 0.08;

      const extraX = Math.max(0, (this.tZoom - 1)) * rect.width  / 2;
      const extraY = Math.max(0, (this.tZoom - 1)) * rect.height / 2;

      const maxX = extraX + slackX;
      const maxY = extraY + slackY;

      this.tPanX = clamp(this.tPanX, -maxX, maxX);
      this.tPanY = clamp(this.tPanY, -maxY, maxY);
    }

    applyView(){
      if (!this.spacePan || !this.spaceZoom) return;
      const zoomZ = Math.max(0, (this.zoom - 1)) * 320;
      this.spaceZoom.style.setProperty('--zoom', this.zoom);
      this.spaceZoom.style.setProperty('--zoomZ', zoomZ.toFixed(1) + 'px');
      this.spacePan.style.setProperty('--panX', this.panX + 'px');
      this.spacePan.style.setProperty('--panY', this.panY + 'px');
    }

    ensureAnim(){
      if (this.animRaf) return;

      const ease = 0.14; // soft breathing

      const tick = () => {
        this.zoom += (this.tZoom - this.zoom) * ease;
        this.panX += (this.tPanX - this.panX) * ease;
        this.panY += (this.tPanY - this.panY) * ease;
        this.applyView();

        // auto-unfocus when returning to min zoom (feels natural)
        if (focused === this.name && this.tZoom <= this.zoomMin() + 0.002){
          setFocus(null);
        }

        const done =
          Math.abs(this.tZoom - this.zoom) < 0.0008 &&
          Math.abs(this.tPanX - this.panX) < 0.10 &&
          Math.abs(this.tPanY - this.panY) < 0.10;

        if (done){
          this.zoom = this.tZoom; this.panX = this.tPanX; this.panY = this.tPanY;
          this.applyView();
          this.animRaf = null;
          return;
        }
        this.animRaf = requestAnimationFrame(tick);
      };

      this.animRaf = requestAnimationFrame(tick);
    }

    // Always zoom centered in THIS deck viewport
    setZoomCentered(newZoom){
      newZoom = clamp(newZoom, this.zoomMin(), this.zoomMax());
      if (!this.deckEl) return;

      const rect = this.deckEl.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const ccx = cx - rect.width / 2; // 0
      const ccy = cy - rect.height / 2; // 0

      const baseZoom = this.zoom || 1;
      const k = newZoom / baseZoom;

      this.tPanX = (this.panX - ccx) * k + ccx;
      this.tPanY = (this.panY - ccy) * k + ccy;

      this.tZoom = newZoom;
      this.clampPanTarget();
      this.ensureAnim();
    }

    // For wheel/pinch (still centered around pointer position, but when focused we keep it calmer)
    setZoomAt(newZoom, clientX, clientY){
      newZoom = clamp(newZoom, this.zoomMin(), this.zoomMax());
      if (!this.deckEl) return;

      const rect = this.deckEl.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const ccx = cx - rect.width / 2;
      const ccy = cy - rect.height / 2;

      const baseZoom = this.zoom || 1;
      const k = newZoom / baseZoom;

      this.tPanX = (this.panX - ccx) * k + ccx;
      this.tPanY = (this.panY - ccy) * k + ccy;

      this.tZoom = newZoom;
      this.clampPanTarget();
      this.ensureAnim();
    }

    addPan(dx, dy){
      this.tPanX += dx;
      this.tPanY += dy;
      this.clampPanTarget();
      this.ensureAnim();
    }

    activeIdx(){ return mod(this.activePos, this.works.length); }
    activePanelIdx(){ return mod(this.activePos, (this.panels.length || this.works.length)); }

    syncActiveUIText(pos){
      const w = this.works[mod(pos, this.works.length)] || this.works[0];
      if (!w) return;
      if (this.amTitle) this.amTitle.textContent = w.title || "Untitled";
      if (this.amStatus) this.amStatus.textContent = w.status || "Unveiling soon";
      if (this.activeCollect) this.activeCollect.href = w.collect || "https://collect.nellekristoff.art";
    }

    setActiveUITransformFromPanel(panelEl){
      if (!this.activeUI || !panelEl) return;
      this.activeUI.style.transform = panelEl.style.transform || "";
      this.activeUI.style.width  = getComputedStyle(panelEl).width;
      this.activeUI.style.height = getComputedStyle(panelEl).height;
      this.activeUI.style.left   = getComputedStyle(panelEl).left;
      this.activeUI.style.top    = getComputedStyle(panelEl).top;
    }

    getTargets(targetPos){
      const panelW = this.getPanelW();
      const angleStep = numDeg(cssVar('--angleStep'));
      const maxAngle  = numDeg(cssVar('--maxAngle'));
      const zStep     = numPx(cssVar('--zStep'));
      const xStepPct  = num(cssVar('--xStep')) / 100;
      const stepX     = panelW * xStepPct;

      // Stronger stable separation to reduce overlap
      const Z_BIAS = 3.2;

      const n = this.panels.length || this.works.length;

      return this.panels.map((_, i) => {
        const iV = nearestVirtual(i, targetPos, n);
        const d  = iV - targetPos;
        const ad = Math.abs(d);

        const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
        const x   = (d === 0) ? 0 : d * stepX;

        // Unique depth shim per panel
        const Z_SHIM = (i + 1) * 0.65;

        // ✅ push sides further back to prevent overlap
        const zDepthBoost = ad * 0.55 * zStep; // extra behind as it moves away
        const z = (d === 0) ? 0 : (-(ad * zStep) - zDepthBoost) - (i * Z_BIAS) - Z_SHIM;

        const op = (d === 0) ? 1 : clamp(1 - ad * 0.05, 0.70, 1);

        return {
          d, ad, x, z, rot,
          opacity: String(op),
          transform: this.buildT(x, z, rot)
        };
      });
    }

    applyInstant(pos){
      this.cancelAll();
      const t = this.getTargets(pos);
      this.panels.forEach((el, i) => {
        el.style.transform = t[i].transform;
        el.style.opacity   = t[i].opacity;
      });
      this.syncActiveUIText(pos);
      this.setActiveUITransformFromPanel(this.panels[mod(pos, this.panels.length)]);
    }

    featherFrom(ad){
      return clamp(ad / 2, 0, 1);
    }

    animateBetween(fromPos, toPos){
      this.cancelAll();

      const from = this.getTargets(fromPos);
      const to   = this.getTargets(toPos);

      this.panels.forEach((el, i) => {
        el.style.transform = from[i].transform;
        el.style.opacity   = from[i].opacity;
      });

      this.syncActiveUIText(fromPos);
      this.setActiveUITransformFromPanel(this.panels[mod(fromPos, this.panels.length)]);

      const BASE_O1 = 0.26;
      const BASE_O2 = 0.52;
      const BASE_O3 = 0.76;

      const maxD = Math.max(1, ...from.map(p => Math.abs(p.d || 0)));
      const denom = 2 * maxD;

      const anims = this.panels.map((el, i) => {
        const f = this.featherFrom(from[i].ad);

        const strength = 0.62 + 0.70 * f;

        const phase = clamp(((from[i].d || 0) + maxD) / denom, 0, 1);
        const shift = (phase - 0.5) * this.TRAVEL_SPREAD;

        const O1 = clamp(BASE_O1 + shift, 0.10, 0.72);
        const O2 = clamp(BASE_O2 + shift, 0.22, 0.88);
        const O3 = clamp(BASE_O3 + shift, 0.36, 0.95);

        const z1 = this.WAVE_Z * (0.22 * strength);
        const z2 = this.WAVE_Z * (0.70 * strength);
        const z3 = this.WAVE_Z * (0.38 * strength);

        const ry1 = (from[i].rot === 0) ? 0 : (this.WAVE_ROT * (0.18 * strength));
        const ry2 = (from[i].rot === 0) ? 0 : (this.WAVE_ROT * (0.55 * strength));
        const ry3 = (from[i].rot === 0) ? 0 : (this.WAVE_ROT * (0.28 * strength));

        const rx1 = this.WAVE_X * (0.22 * strength);
        const rx2 = this.WAVE_X * (0.82 * strength);
        const rx3 = this.WAVE_X * (0.36 * strength);

        const s1 = 1 + ((this.WAVE_S - 1) * (0.22 * strength));
        const s2 = 1 + ((this.WAVE_S - 1) * (0.85 * strength));
        const s3 = 1 + ((this.WAVE_S - 1) * (0.38 * strength));

        const twist = (i % 2 === 0 ? 1 : -1) * this.WAVE_TWIST * f;

        const mid1 = this.buildT(from[i].x, from[i].z, from[i].rot, z1, ry1 + twist * 0.20, rx1, s1);
        const mid2 = this.buildT(from[i].x, from[i].z, from[i].rot, z2, ry2 + twist * 0.55, rx2, s2);
        const mid3 = this.buildT(from[i].x, from[i].z, from[i].rot, z3, ry3 + twist * 0.32, rx3, s3);

        return el.animate(
          [
            { transform: from[i].transform, opacity: from[i].opacity, offset: 0 },
            { transform: mid1,              opacity: from[i].opacity, offset: O1 },
            { transform: mid2,              opacity: from[i].opacity, offset: O2 },
            { transform: mid3,              opacity: from[i].opacity, offset: O3 },
            { transform: to[i].transform,   opacity: to[i].opacity,   offset: 1 }
          ],
          { duration: this.DURATION, easing: this.EASING, fill: 'forwards' }
        );
      });

      // Active UI follows active panel with calmer wave
      let uiAnim = null;
      if (this.activeUI){
        const fromPanelIndex = mod(fromPos, this.panels.length);
        const toPanelIndex   = mod(toPos, this.panels.length);

        const uiFrom = from[fromPanelIndex].transform;
        const uiTo   = to[toPanelIndex].transform;

        const fUI = 0.55;

        const z1 = this.WAVE_Z * (0.14 + 0.26 * fUI);
        const z2 = this.WAVE_Z * (0.30 + 0.52 * fUI);
        const z3 = this.WAVE_Z * (0.18 + 0.34 * fUI);

        const rx1 = this.WAVE_X * (0.12 + 0.22 * fUI);
        const rx2 = this.WAVE_X * (0.26 + 0.46 * fUI);
        const rx3 = this.WAVE_X * (0.16 + 0.30 * fUI);

        const s1  = 1 + ((this.WAVE_S - 1) * (0.12 + 0.22 * fUI));
        const s2  = 1 + ((this.WAVE_S - 1) * (0.26 + 0.46 * fUI));
        const s3  = 1 + ((this.WAVE_S - 1) * (0.16 + 0.30 * fUI));

        const uiMid1 = this.buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z1, 0, rx1, s1);
        const uiMid2 = this.buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z2, 0, rx2, s2);
        const uiMid3 = this.buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z3, 0, rx3, s3);

        uiAnim = this.activeUI.animate(
          [
            { transform: uiFrom, offset: 0 },
            { transform: uiMid1, offset: BASE_O1 },
            { transform: uiMid2, offset: BASE_O2 },
            { transform: uiMid3, offset: BASE_O3 },
            { transform: uiTo,   offset: 1 }
          ],
          { duration: this.DURATION, easing: this.EASING, fill: 'forwards' }
        );
      }

      return Promise.allSettled([
        ...anims.map(a => a.finished),
        uiAnim ? uiAnim.finished : Promise.resolve()
      ]).then(() => {
        this.cancelAll();
        this.panels.forEach((el, i) => {
          el.style.transform = to[i].transform;
          el.style.opacity   = to[i].opacity;
        });
        this.syncActiveUIText(toPos);
        this.setActiveUITransformFromPanel(this.panels[mod(toPos, this.panels.length)]);
      });
    }

    runQueued(){
      if (this.queuedDir === 0) return;
      const dir = Math.sign(this.queuedDir);
      this.queuedDir -= dir;
      this.step(dir);
    }

    step(dir){
      if (this.works.length < 2) return;
      if (this.animating){
        this.queuedDir += dir;
        return;
      }
      this.animating = true;
      const fromPos = this.activePos;
      const toPos = this.activePos + dir;
      this.animateBetween(fromPos, toPos).then(() => {
        this.activePos = toPos;
        this.animating = false;
        this.runQueued();
      });
    }

    next(){
      // deck direction applied here (top deck reverses)
      this.step(this.dir);
    }

    buildPanels(){
      if (!this.lep) return;

      this.lep.innerHTML = "";
      this.panels.length = 0;

      this.works.forEach((w, idx) => {
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

        const im = el.querySelector('img');
        if (im){
          im.style.backfaceVisibility = 'hidden';
          im.addEventListener('dragstart', (e) => e.preventDefault());
          im.addEventListener('mousedown', (e) => e.preventDefault());
          im.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        // Only ACTIVE panel opens fullscreen
        el.addEventListener('click', () => {
          if (this.animating) return;
          if (idx !== this.activePanelIdx()) return;
          if (!this.selectBtn) return;
          this.selectBtn.click();
        });

        el.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          if (this.animating) return;
          if (idx !== this.activePanelIdx()) return;
          if (!this.selectBtn) return;
          this.selectBtn.click();
        });

        this.lep.appendChild(el);
        this.panels.push(el);
      });
    }

    bindUI(){
      if (this.selectBtn){
        this.selectBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const w = this.works[this.activeIdx()] || this.works[0];
          openFullscreenFromWork(w);
        });
      }

      // focusing: click background area of deck
      if (this.deckEl){
        this.deckEl.addEventListener('pointerdown', (e) => {
          if (isFullscreenOpen()) return;

          // ignore clicks on interactive elements
          const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, .menu, .menu-btn');
          if (interactive) return;

          // focus this deck
          if (focused !== this.name){
            setFocus(this.name);

            // when focusing, re-center this deck view at current zoom (or start at min)
            // and make zoom centered
            this.tPanX = 0;
            this.tPanY = 0;
            this.clampPanTarget();
            this.ensureAnim();
          }
        }, { passive:true });
      }
    }

    bindPointerPanZoom(){
      if (!this.deckEl) return;

      const setPointer = (e) => this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const updatePointer = (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      };
      const getTwoPointers = () => {
        const arr = Array.from(this.pointers.values());
        if (arr.length < 2) return null;
        return [arr[0], arr[1]];
      };
      const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
      const mid = (a,b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });

      this.deckEl.addEventListener('pointerdown', (e) => {
        if (isFullscreenOpen()) return;

        // If not focused and user starts interacting, focus it first
        const interactive = e.target.closest('button, a, .abtn, .film-arrow, .arrow-slot, .menu, .menu-btn');
        if (!interactive && focused !== this.name){
          setFocus(this.name);
        }

        if (interactive) return;

        this.deckEl.setPointerCapture(e.pointerId);
        setPointer(e);

        if (this.pointers.size === 1){
          this.lastPan = { x: e.clientX, y: e.clientY };
          this.pinchStart = null;
        } else if (this.pointers.size === 2){
          const two = getTwoPointers();
          if (!two) return;
          const [p1, p2] = two;
          this.pinchStart = { d: dist(p1,p2), z: this.tZoom, m: mid(p1,p2) };
          this.lastPan = null;
        }
      });

      this.deckEl.addEventListener('pointermove', (e) => {
        if (isFullscreenOpen()) return;
        if (!this.pointers.has(e.pointerId)) return;
        updatePointer(e);

        if (this.pointers.size === 1 && this.lastPan){
          this.addPan(e.clientX - this.lastPan.x, e.clientY - this.lastPan.y);
          this.lastPan = { x: e.clientX, y: e.clientY };
        }

        if (this.pointers.size >= 2){
          const two = getTwoPointers();
          if (!two) return;
          const [p1, p2] = two;

          const dNow = dist(p1,p2);
          const mNow = mid(p1,p2);

          if (!this.pinchStart){
            this.pinchStart = { d: dNow, z: this.tZoom, m: mNow };
            return;
          }

          // If focused, we keep zoom centered calmer; if not, standard pinch
          if (focused === this.name){
            const newZ = this.pinchStart.z * (dNow / this.pinchStart.d);
            this.setZoomCentered(newZ);
          } else {
            this.setZoomAt(this.pinchStart.z * (dNow / this.pinchStart.d), mNow.x, mNow.y);
          }

          this.addPan(mNow.x - this.pinchStart.m.x, mNow.y - this.pinchStart.m.y);
          this.pinchStart.m = mNow;
        }
      });

      const endPointer = (e) => {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size === 0){ this.lastPan = null; this.pinchStart = null; }
        if (this.pointers.size === 1){
          const remaining = Array.from(this.pointers.values())[0];
          this.lastPan = remaining ? { x: remaining.x, y: remaining.y } : null;
          this.pinchStart = null;
        }
      };

      this.deckEl.addEventListener('pointerup', endPointer);
      this.deckEl.addEventListener('pointercancel', endPointer);

      // Wheel zoom (desktop)
      this.deckEl.addEventListener('wheel', (e) => {
        if (isFullscreenOpen()) return;
        e.preventDefault();

        // focus on wheel as well
        if (focused !== this.name) setFocus(this.name);

        const factor = Math.exp(-e.deltaY * 0.0018);
        const newZ = this.tZoom * factor;

        // When focused, keep zoom centered
        if (focused === this.name) this.setZoomCentered(newZ);
        else this.setZoomAt(newZ, e.clientX, e.clientY);

      }, { passive:false });
    }

    init(){
      this.buildPanels();
      this.bindUI();
      this.bindPointerPanZoom();

      // Start at min zoom, centered, split view
      this.zoom = this.tZoom = this.zoomMin();
      this.panX = this.tPanX = 0;
      this.panY = this.tPanY = 0;
      this.clampPanTarget();
      this.applyView();

      requestAnimationFrame(() => this.applyInstant(this.activePos));

      window.addEventListener('resize', () => {
        this.clampPanTarget();
        this.ensureAnim();
        requestAnimationFrame(() => this.applyInstant(this.activePos));
      });
    }
  }

  // Build decks
  const deckTop = new Deck({
    name: 'top',
    works: worksTop,
    dir: -1, // top arrow moves opposite direction
    deckEl: document.getElementById('deckTop'),
    spacePan: document.getElementById('spacePanTop'),
    spaceZoom: document.getElementById('spaceZoomTop'),
    lep: document.getElementById('leporelloTop'),

    activeUI: document.getElementById('activeUITop'),
    amTitle: document.getElementById('amTitleTop'),
    amStatus: document.getElementById('amStatusTop'),
    activeCollect: document.getElementById('activeCollectTop'),
    selectBtn: document.getElementById('selectBtnTop')
  });

  const deckBottom = new Deck({
    name: 'bottom',
    works: worksBottom,
    dir: +1,
    deckEl: document.getElementById('deckBottom'),
    spacePan: document.getElementById('spacePanBottom'),
    spaceZoom: document.getElementById('spaceZoomBottom'),
    lep: document.getElementById('leporelloBottom'),

    activeUI: document.getElementById('activeUIBottom'),
    amTitle: document.getElementById('amTitleBottom'),
    amStatus: document.getElementById('amStatusBottom'),
    activeCollect: document.getElementById('activeCollectBottom'),
    selectBtn: document.getElementById('selectBtnBottom')
  });

  // Arrows
  const arrowTopLeft = document.getElementById('arrowTopLeft');
  if (arrowTopLeft){
    arrowTopLeft.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFocus('top');     // ensure focus
      deckTop.next();
    });
  }

  const arrowBottomRight = document.getElementById('arrowBottomRight');
  if (arrowBottomRight){
    arrowBottomRight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFocus('bottom');  // ensure focus
      deckBottom.next();
    });
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenOpen()){
      closeFullscreen();
      return;
    }
    if (isFullscreenOpen()) return;

    // When focused, arrow keys control the focused deck
    if (e.key === 'ArrowRight'){
      if (focused === 'bottom') deckBottom.next();
    }
    if (e.key === 'ArrowLeft'){
      if (focused === 'top') deckTop.next();
    }
  });

  // Start in split view (both centered at min zoom)
  setFocus(null);
});
