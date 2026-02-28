// webgl-decks.js (ES module) — WebGL animated “air/noise/bubbles” inside the viewport canvas
import * as THREE from "./vendor/three/three.module.js";

function makeRenderer(canvas){
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

// Noise shader with tunable intensity/scale/drift
function makeNoiseMaterial(noiseTex, opts = {}){
  const {
    amt = 0.22,     // strength / opacity of the “air”
    scale = 2.2,    // UV scale
    sx = 0.015,     // drift speed X
    sy = -0.010     // drift speed Y
  } = opts;

  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uNoise: { value: noiseTex },
      uTime:  { value: 0 },
      uAmt:   { value: amt },
      uScale: { value: scale },
      uSpd:   { value: new THREE.Vector2(sx, sy) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uNoise;
      uniform float uTime;
      uniform float uAmt;
      uniform float uScale;
      uniform vec2  uSpd;
      varying vec2 vUv;

      float softCircle(vec2 p, vec2 c, float r){
        float d = length(p - c);
        return 1.0 - smoothstep(r, r + 0.08, d);
      }

      void main(){
        vec2 uv = vUv;

        // drifting noise
        vec2 nUv = uv * uScale + vec2(uTime * uSpd.x, uTime * uSpd.y);
        float n  = texture2D(uNoise, nUv).r;

        float air = (n * 0.65 + 0.35) * uAmt;

        // soft bubbles
        float b1 = softCircle(uv, vec2(0.25 + 0.03*sin(uTime*0.30), 0.62), 0.13);
        float b2 = softCircle(uv, vec2(0.72, 0.35 + 0.02*cos(uTime*0.25)), 0.10);
        float b3 = softCircle(uv, vec2(0.52 + 0.02*sin(uTime*0.18), 0.78), 0.08);
        float bubbles = (b1*0.45 + b2*0.35 + b3*0.25) * 0.35;

        // vignette
        float vx = smoothstep(0.0, 0.22, uv.x) * smoothstep(0.0, 0.22, 1.0-uv.x);
        float vy = smoothstep(0.0, 0.22, uv.y) * smoothstep(0.0, 0.22, 1.0-uv.y);
        float vign = vx * vy;

        float a = (air + bubbles) * vign;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `,
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  const canvas = document.getElementById("webglCanvas");
  if (!canvas) return;

  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
  camera.position.set(0, 0, 2.4);

  const loader = new THREE.TextureLoader();
  const noiseTex = await new Promise((res, rej) =>
    loader.load("images/noise.png", res, undefined, rej)
  );

  const planeGeo = new THREE.PlaneGeometry(3.2, 2.0, 1, 1);

  // Layer A (your original)
  const planeMatA = makeNoiseMaterial(noiseTex, {
    amt: 0.22,
    scale: 2.2,
    sx: 0.015,
    sy: -0.010
  });

  const planeA = new THREE.Mesh(planeGeo, planeMatA);
  planeA.position.z = 0.0;
  planeA.renderOrder = 0;
  scene.add(planeA);

  // Layer B (NEW): “dusty-water” plate — smooth, dimensional, not distracting
  const planeMatB = makeNoiseMaterial(noiseTex.clone(), {
    amt: 0.34,    // visible but calm (tune 0.28–0.38)
    scale: 3.0,   // larger structures than A
    sx: -0.008,   // slower drift
    sy:  0.011
  });
  // Keep NORMAL blending to avoid “sparkle” distraction
  // planeMatB.blending = THREE.NormalBlending;

  const planeB = new THREE.Mesh(planeGeo, planeMatB);
  planeB.position.z = -0.14;        // behind A for depth
  planeB.scale.set(1.06, 1.06, 1);  // slightly larger so edges never show
  planeB.renderOrder = -1;
  scene.add(planeB);

  // Bubble meshes (subtle parallax) — unchanged
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  });

  const bubbles = [];
  const bubbleGeo = new THREE.SphereGeometry(0.14, 24, 24);
  for (let i = 0; i < 6; i++){
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    b.position.set(
      (Math.random() * 2 - 1) * 0.9,
      (Math.random() * 2 - 1) * 0.55,
      -0.4 - Math.random() * 0.6
    );
    b.scale.setScalar(0.6 + Math.random() * 1.2);
    scene.add(b);
    bubbles.push(b);
  }

  function resize(){
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    // keep crisp when devicePixelRatio changes (zoom / display changes)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();

  // window resize
  window.addEventListener("resize", resize);

  // resize on layout changes (focus transitions, etc.)
  const parent = canvas.parentElement;
  if (parent && "ResizeObserver" in window){
    const ro = new ResizeObserver(() => resize());
    ro.observe(parent);
  } else {
    window.addEventListener("orientationchange", () => setTimeout(resize, 60));
  }

  let t0 = performance.now();
  function tick(now){
    const t = (now - t0) * 0.001;

    planeMatA.uniforms.uTime.value = t;
    planeMatB.uniforms.uTime.value = t;

    // “breathing” drift — A (slightly more present)
    planeA.rotation.z = Math.sin(t * 0.06) * 0.02;
    planeA.position.x = Math.sin(t * 0.10) * 0.03;
    planeA.position.y = Math.cos(t * 0.08) * 0.02;

    // “breathing” drift — B (slower + smoother)
    planeB.rotation.z = Math.sin(t * 0.040) * 0.020;
    planeB.position.x = Math.sin(t * 0.060) * 0.030;
    planeB.position.y = Math.cos(t * 0.052) * 0.022;

    bubbles.forEach((b, i) => {
      const tt = t + i * 0.8;
      b.position.x += Math.sin(tt * 0.20) * 0.0006;
      b.position.y += Math.cos(tt * 0.16) * 0.0006;
      b.rotation.y = Math.sin(tt * 0.22) * 0.15;
      b.rotation.x = Math.cos(tt * 0.18) * 0.12;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});
