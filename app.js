// app.js — TWO INDEPENDENT DECKS (TOP + BOTTOM) + SHARED CAMERA PAN/ZOOM
// - Bottom deck: bottom-right arrow advances forward (next)
// - Top deck: top-left arrow advances in opposite direction (prev)
// - Each deck has its own active UI attached to its active panel
// - Clicking a deck focuses it; zoom-in uses full viewport; zoom-out returns to its half
// - Uses CSS width measurement (no jump after zoom)
// - Virtual index wrap prevents “triple flap”
// - Extra depth separation reduces overlap artifacts

document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.preventDefault();
});

/* ===== DATA =====
   Put my works here. Split into two arrays (top / bottom).
   This uses 3 + 3; xxx.
*/
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

  /* ===== MENU (unchanged) ===== */
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

  /* =========================================================
     SHARED CAMERA (PAN/ZOOM) — one camera for both decks
     ========================================================= */
  let zoom = 1, panX = 0, panY = 0;
  let tZoom = 1, tPanX = 0, tPanY = 0;
  let animRaf = null;

  function zoomMin(){ return num(cssVar('--zoomMin')) || 0.65; }
  function zoomMax(){ return num(cssVar('--zoomMax')) || 2.2; }

  // “focus” determines where we return when zoomed out to min
  let focusedDeck = null; // will be set to deckTop or deckBottom

  function getViewportRect(){
    return viewport ? viewport.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
  }

  // Allow pan even when zoomed-out (a little slack)
  function clampPanTarget(){
    if (!viewport) return;
    const rect = getViewportRect();

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

  function ensureAnim(){
    if (animRaf) return;

    // softer breath follow
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
        return;
      }
      animRaf = requestAnimationFrame(tick);
    };

    animRaf = requestAnimationFrame(tick);
  }

  function snapToDeckHomeIfZoomMin(){
    // When zoom reaches min, return to that deck’s half position
    if (!focusedDeck) return;
    const zmin = zoomMin();
    if (tZoom <= zmin + 0.0005){
      tZoom = zmin;
      tPanX = focusedDeck.homePanX();
      tPanY = focusedDeck.homePanY();
      clampPanTarget();
      ensureAnim();
    }
  }

  function setZoomAt(newZoom, cx, cy){
    newZoom = clamp(newZoom, zoomMin(), zoomMax());
    if (!viewport) return;

    const rect = getViewportRect();
    const ccx = cx - rect.width  / 2;
    const ccy = cy - rect.height / 2;

    const baseZoom = zoom || 1;
    const k = newZoom / baseZoom;

    tPanX = (panX - ccx) * k + ccx;
    tPanY = (panY - ccy) * k + ccy;

    tZoom = newZoom;

    // If zooming down to min, auto return home
    snapToDeckHomeIfZoomMin();

    clampPanTarget();
    ensureAnim();
  }

  function addPan(dx, dy){
    tPanX += dx;
    tPanY += dy;
    clampPanTarget();
    ensureAnim();
  }

  function focusDeck(deck){
    if (!deck) return;
    focusedDeck = deck;

    // If we're at min zoom, snap immediately to that deck's home
    if (tZoom <= zoomMin() + 0.0005){
      tPanX = deck.homePanX();
      tPanY = deck.homePanY();
      clampPanTarget();
      ensureAnim();
    }
  }

  /* =========================================================
     DECK CLASS (independent leporello + independent UI + independent arrows)
     ========================================================= */
  function buildT(x, z, rotY, extraZ = 0, extraRotY = 0, extraRotX = 0, extraScale = 1){
    // tiny translateZ to reduce z-fighting flicker
    return `translate3d(-50%, -50%, 0) translate3d(${x}px, 0px, ${z + extraZ}px) rotateY(${rotY + extraRotY}deg) rotateX(${extraRotX}deg) scale(${extraScale}) translateZ(0.01px)`;
  }

  class Deck {
    constructor(opts){
      this.name = opts.name;
      this.works = opts.works;
      this.lep = opts.lep;
      this.arrowEl = opts.arrowEl;

      // UI elements (unique per deck)
      this.activeUI = opts.activeUI;
      this.amTitle = opts.amTitle;
      this.amStatus = opts.amStatus;
      this.activeCollect = opts.activeCollect;
      this.selectBtn = opts.selectBtn;

      // “home” position for this deck when zoom is min
      this.homePanX = opts.homePanX;
      this.homePanY = opts.homePanY;

      // direction mapping for that deck’s arrow
      // arrowAction is "next" or "prev"
      this.arrowAction = opts.arrowAction;

      this.panels = [];
      this.activePos = 0;       // virtual position
      this.animating = false;
      this.queuedDir = 0;

      // Motion tuning (shared style)
      this.DURATION = 2850;
      this.EASING   = 'cubic-bezier(.10,.88,.16,1)';

      this.WAVE_Z     = 120;
      this.WAVE_ROT   = 16;
      this.WAVE_X     = -7.2;
      this.WAVE_S     = 1.022;
      this.WAVE_TWIST = 5.0;

      this.TRAVEL_SPREAD = 0.22;

      // depth stability
      this.Z_BIAS = 2.8; // make side panels sit deeper to reduce overlap
    }

    activeIdx(){ return mod(this.activePos, this.works.length); }
    activePanelIdx(){ return mod(this.activePos, (this.panels.length || this.works.length)); }

    cancelAnim(el){
      if (!el || typeof el.getAnimations !== 'function') return;
      el.getAnimations().forEach(a => a.cancel());
    }
    cancelAll(){
      this.panels.forEach(p => this.cancelAnim(p));
      this.cancelAnim(this.activeUI);
    }

    getPanelW(){
      const p = this.panels[0];
      if (!p) return 0;
      // important: CSS layout width, not zoomed width
      return parseFloat(getComputedStyle(p).width) || 0;
    }

    getTargets(targetPos){
      const panelW = this.getPanelW();
      const angleStep = numDeg(cssVar('--angleStep'));
      const maxAngle  = numDeg(cssVar('--maxAngle'));
      const zStep     = numPx(cssVar('--zStep'));
      const xStepPct  = num(cssVar('--xStep')) / 100;
      const stepX     = panelW * xStepPct;

      const n = this.panels.length || this.works.length;

      return this.panels.map((_, i) => {
        const iV = nearestVirtual(i, targetPos, n);
        const d  = iV - targetPos;
        const ad = Math.abs(d);

        const rot = (d === 0) ? 0 : clamp(-d * angleStep, -maxAngle, maxAngle);
        const x   = (d === 0) ? 0 : d * stepX;

        // push non-active panels further back to reduce overlap
        // unique per panel shim avoids exact depth ties
        const Z_SHIM = (i + 1) * 0.65;
        const z = (d === 0) ? 0 : (-ad * zStep) - (i * this.Z_BIAS) - Z_SHIM;

        const op = (d === 0) ? 1 : clamp(1 - ad * 0.05, 0.70, 1);

        return { d, ad, x, z, rot, opacity: String(op), transform: buildT(x, z, rot) };
      });
    }

    syncUI(pos){
      const w = this.works[mod(pos, this.works.length)] || this.works[0];
      if (!w) return;
      if (this.amTitle) this.amTitle.textContent = w.title || "Untitled";
      if (this.amStatus) this.amStatus.textContent = w.status || "Unveiling soon";
      if (this.activeCollect) this.activeCollect.href = w.collect || "https://collect.nellekristoff.art";
    }

    setActiveUIFromPanel(panelEl){
      if (!this.activeUI || !panelEl) return;
      this.activeUI.style.transform = panelEl.style.transform || "";
      this.activeUI.style.width  = getComputedStyle(panelEl).width;
      this.activeUI.style.height = getComputedStyle(panelEl).height;
      this.activeUI.style.left   = getComputedStyle(panelEl).left;
      this.activeUI.style.top    = getComputedStyle(panelEl).top;
    }

    applyInstant(pos){
      if (!this.panels.length) return;
      this.cancelAll();
      const t = this.getTargets(pos);
      this.panels.forEach((el, i) => {
        el.style.transform = t[i].transform;
        el.style.opacity   = t[i].opacity;
      });
      this.syncUI(pos);
      this.setActiveUIFromPanel(this.panels[mod(pos, this.panels.length)]);
    }

    featherFrom(ad){
      // center gets some breath too
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

      this.syncUI(fromPos);
      this.setActiveUIFromPanel(this.panels[mod(fromPos, this.panels.length)]);

      const BASE_O1 = 0.26;
      const BASE_O2 = 0.52;
      const BASE_O3 = 0.76;

      const maxD  = Math.max(1, ...from.map(p => Math.abs(p.d || 0)));
      const denom = 2 * maxD;

      const anims = this.panels.map((el, i) => {
        const f = this.featherFrom(from[i].ad);

        const strength = 0.62 + 0.70 * f; // 0.62..1.32

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
          { duration: this.DURATION, easing: this.EASING, fill: 'forwards' }
        );
      });

      // UI follows active panel, calmer and no travel shift
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

        const uiMid1 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z1, 0, rx1, s1);
        const uiMid2 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z2, 0, rx2, s2);
        const uiMid3 = buildT(from[fromPanelIndex].x, from[fromPanelIndex].z, from[fromPanelIndex].rot, z3, 0, rx3, s3);

        uiAnim = this.activeUI.animate(
          [
            { transform: uiFrom, offset: 0 },
            { transform: uiMid1, offset: BASE_O1 },
            { transform: uiMid2, offset: BASE_O2 },
            { transform: uiMid3, offset: BASE_O3 },
            { transform: uiTo,  offset: 1 }
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
        this.syncUI(toPos);
        this.setActiveUIFromPanel(this.panels[mod(toPos, this.panels.length)]);
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
      const toPos   = this.activePos + dir; // always one step

      this.animateBetween(fromPos, toPos).then(() => {
        this.activePos = toPos;
        this.animating = false;
        this.runQueued();
      });
    }

    next(){ this.step(+1); }
    prev(){ this.step(-1); }

    buildPanels(){
      if (!this.lep) return;
      this.lep.innerHTML = "";
      this.panels.length = 0;

      this.works.forEach((w, idx) => {
        const el = document.createElement('div');
        el.className = 'panel';
        el.tabIndex = 0;

        // GPU stability hints
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

        // Clicking any panel focuses THIS deck
        el.addEventListener('pointerdown', () => focusDeck(this));

        // Only active panel triggers Select (prevents side-jumps)
        el.addEventListener('click', () => {
          if (this.animating) return;
          if (idx !== this.activePanelIdx()) return;
          if (this.selectBtn) this.selectBtn.click();
        });

        el.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          if (this.animating) return;
          if (idx !== this.activePanelIdx()) return;
          if (this.selectBtn) this.selectBtn.click();
        });

        this.lep.appendChild(el);
        this.panels.push(el);
      });
    }

    wireArrow(){
      if (!this.arrowEl) return;
      this.arrowEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        focusDeck(this);

        // Bottom deck arrow: next
        // Top deck arrow: prev (opposite direction)
        if (this.arrowAction === "next") this.next();
        else this.prev();
      });
    }
  }

  /* =========================================================
     FIND DOM ELEMENTS FOR BOTH DECKS
     ========================================================= */
  const lepTop = document.getElementById('leporelloTop');
  const lepBottom = document.getElementById('leporelloBottom');

  const arrowTopLeft = document.getElementById('arrowTopLeft'); // top-left arrow button
  const arrowBottomRight = document.getElementById('arrowRight'); // your existing bottom-right arrow

  // top UI ids
  const activeUITop = document.getElementById('activeUITop');
  const topTitle = document.getElementById('amTitleTop');
  const topStatus = document.getElementById('amStatusTop');
  const topCollect = document.getElementById('activeCollectTop');
  const topSelectBtn = document.getElementById('selectBtnTop');

  // bottom UI ids
  const activeUIBottom = document.getElementById('activeUIBottom');
  const bottomTitle = document.getElementById('amTitleBottom');
  const bottomStatus = document.getElementById('amStatusBottom');
  const bottomCollect = document.getElementById('activeCollectBottom');
  const bottomSelectBtn = document.getElementById('selectBtnBottom');

  // deck home offsets (in pan space) — top is negative Y, bottom positive Y
  function topHomeY(){
    const r = getViewportRect();
    return -Math.round(r.height * 0.22);
  }
  function bottomHomeY(){
    const r = getViewportRect();
    return Math.round(r.height * 0.22);
  }

  const deckTop = new Deck({
    name: "top",
    works: worksTop,
    lep: lepTop,
    arrowEl: arrowTopLeft,
    arrowAction: "prev", // ✅ TOP DECK moves opposite direction
    activeUI: activeUITop,
    amTitle: topTitle,
    amStatus: topStatus,
    activeCollect: topCollect,
    selectBtn: topSelectBtn,
    homePanX: () => 0,
    homePanY: () => topHomeY(),
  });

  const deckBottom = new Deck({
    name: "bottom",
    works: worksBottom,
    lep: lepBottom,
    arrowEl: arrowBottomRight,
    arrowAction: "next", // ✅ BOTTOM DECK moves forward direction
    activeUI: activeUIBottom,
    amTitle: bottomTitle,
    amStatus: bottomStatus,
    activeCollect: bottomCollect,
    selectBtn: bottomSelectBtn,
    homePanX: () => 0,
    homePanY: () => bottomHomeY(),
  });

  // Build both decks + wire arrows
  deckTop.buildPanels();
  deckBottom.buildPanels();
  deckTop.wireArrow();
  deckBottom.wireArrow();

  /* =========================================================
     FULLSCREEN (shared overlay) — opens whichever deck is focused
     ========================================================= */
  const fullscreen = document.getElementById('fullscreen');
  const fsImg = document.getElementById('fsImg');
  const fsTitle = document.getElementById('fsTitle');
  const fsStatus = document.getElementById('fsStatus');
  const fsCollect = document.getElementById('fsCollect');
  const closeBtn = document.getElementById('closeBtn');

  function isFullscreenOpen(){
    return fullscreen && fullscreen.classList.contains('open');
  }

  function openFullscreenFromDeck(deck){
    if (!deck) return;
    const w = deck.works[deck.activeIdx()] || deck.works[0];
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

  // Hook both Select buttons to open fullscreen
  if (topSelectBtn){
    topSelectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      focusDeck(deckTop);
      openFullscreenFromDeck(deckTop);
    });
  }
  if (bottomSelectBtn){
    bottomSelectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      focusDeck(deckBottom);
      openFullscreenFromDeck(deckBottom);
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

  /* =========================================================
     POINTER PAN/ZOOM (shared)
     ========================================================= */
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

      // If user clicks in top half/bottom half, focus the corresponding deck
      const rect = getViewportRect();
      const localY = e.clientY - rect.top;
      if (localY < rect.height * 0.5) focusDeck(deckTop);
      else focusDeck(deckBottom);

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

        const rect = getViewportRect();
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

      // if user ends interaction at min zoom, snap home
      snapToDeckHomeIfZoomMin();
    }

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);

    viewport.addEventListener('wheel', (e) => {
      if (isFullscreenOpen()) return;
      e.preventDefault();

      const rect = getViewportRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const factor = Math.exp(-e.deltaY * 0.0018);
      setZoomAt(tZoom * factor, cx, cy);

      // wheel zoom down to min should snap home
      snapToDeckHomeIfZoomMin();
    }, { passive:false });
  }

  /* =========================================================
     KEYBOARD (optional): Right arrow advances bottom, Left arrow advances top-opposite
     ========================================================= */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreenOpen()){
      closeFullscreen();
      return;
    }
    if (isFullscreenOpen()) return;

    if (e.key === 'ArrowRight'){
      focusDeck(deckBottom);
      deckBottom.next();
    }
    if (e.key === 'ArrowLeft'){
      focusDeck(deckTop);
      deckTop.prev(); // opposite direction
    }
  });

  /* =========================================================
     INIT
     - Start at zoom MIN
     - Start focused on bottom deck (you can change to top if desired)
     ========================================================= */
  function init(){
    focusDeck(deckBottom);

    zoom = tZoom = zoomMin();
    panX = tPanX = 0;
    panY = tPanY = deckBottom.homePanY();

    clampPanTarget();
    applyView();

    requestAnimationFrame(() => {
      deckTop.applyInstant(deckTop.activePos);
      deckBottom.applyInstant(deckBottom.activePos);
    });
  }
  init();

  window.addEventListener('resize', () => {
    // keep home snaps correct when viewport changes
    clampPanTarget();
    ensureAnim();
    requestAnimationFrame(() => {
      deckTop.applyInstant(deckTop.activePos);
      deckBottom.applyInstant(deckBottom.activePos);

      // if at min zoom, re-snap to focused deck
      snapToDeckHomeIfZoomMin();
    });
  });
});
