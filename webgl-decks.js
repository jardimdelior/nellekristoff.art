// webgl-decks.js (ES module)
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

function makeDeckRenderer(canvas){
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

function buildPanelMaterial(artTex, noiseTex){
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.repeat.set(4, 4);

  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uArt:    { value: artTex },
      uNoise:  { value: noiseTex },
      uTime:   { value: 0 },
      uBorder: { value: 0.075 }, // white margin thickness (UV)
      uBend:   { value: 0.30 },  // bend intensity
      uTwist:  { value: 0.18 },  // twist intensity
      uNoiseAmt:{ value: 0.10 }, // noise blend
    },
    vertexShader: `
      uniform float uTime;
      uniform float uBend;
      uniform float uTwist;
      varying vec2 vUv;

      void main(){
        vUv = uv;
        vec3 p = position;

        float x = (uv.x - 0.5) * 2.0;
        float y = (uv.y - 0.5) * 2.0;

        // “air bubble” bow: more bend near center, less near edges
        float center = 1.0 - clamp(abs(y), 0.0, 1.0);
        p.z += (x*x) * uBend * (0.65 + 0.35*center);

        // subtle traveling ripple
        p.z += 0.03 * sin(x*3.0 + uTime*1.35) * (0.35 + 0.65*center);

        // small twist
        float twist = uTwist * x;
        float c = cos(twist);
        float s = sin(twist);
        float py = p.y;
        float pz = p.z;
        p.y = py * c - pz * s;
        p.z = py * s + pz * c;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uArt;
      uniform sampler2D uNoise;
      uniform float uTime;
      uniform float uBorder;
      uniform float uNoiseAmt;
      varying vec2 vUv;

      void main(){
        float b = uBorder;

        // border test
        float edge =
          step(vUv.x, b) +
          step(1.0 - b, vUv.x) +
          step(vUv.y, b) +
          step(1.0 - b, vUv.y);

        if(edge > 0.0){
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
          return;
        }

        // map inner UV to artwork UV
        vec2 uvInner = (vUv - vec2(b)) / (1.0 - 2.0*b);
        vec4 art = texture2D(uArt, uvInner);

        // noise overlay (subtle paper texture)
        vec2 nUv = vUv * 3.0 + vec2(uTime*0.02, uTime*0.015);
        float n = texture2D(uNoise, nUv).r;
        art.rgb = mix(art.rgb, art.rgb * (0.85 + 0.30*n), uNoiseAmt);

        gl_FragColor = vec4(art.rgb, 1.0);
      }
    `,
  });
}

async function initDeck({
  canvasId,
  works,           // [{src,title,...}]
  yOffset = 0,     // + for top deck, - for bottom deck
  noiseSrc = "images/noise.png", // add this file (simple seamless noise)
}){
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const renderer = makeDeckRenderer(canvas);
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.6);

  const loader = new THREE.TextureLoader();

  // load noise once
  const noiseTex = await new Promise((res, rej) => {
    loader.load(noiseSrc, res, undefined, rej);
  });

  // build 3 panels
  const group = new THREE.Group();
  group.position.y = yOffset;
  scene.add(group);

  const meshes = [];
  const geo = new THREE.PlaneGeometry(2.4, 3.1, 64, 64);

  for (let i = 0; i < works.length; i++){
    const artTex = await new Promise((res, rej) => {
      loader.load(works[i].src, res, undefined, rej);
    });
    artTex.colorSpace = THREE.SRGBColorSpace;

    const mat = buildPanelMaterial(artTex, noiseTex);
    const m = new THREE.Mesh(geo, mat);

    // spread them “leporello-like” in X and Z with slight rotation
    const d = i - 1; // -1,0,1 for 3 panels
    m.position.x = d * 2.2;
    m.position.z = -Math.abs(d) * 0.9;
    m.rotation.y = d * -0.28;

    group.add(m);
    meshes.push(m);
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  let t0 = performance.now();
  function tick(now){
    const t = (now - t0) * 0.001;

    // gentle “breath” of the whole deck
    group.position.x = Math.sin(t * 0.30) * 0.06;
    group.rotation.y = Math.sin(t * 0.22) * 0.05;

    // each panel floats and updates shader time
    meshes.forEach((m, i) => {
      const tt = t + i * 0.6;
      m.position.y = Math.sin(tt * 0.6) * 0.03;
      m.rotation.x = Math.sin(tt * 0.5) * 0.02;

      m.material.uniforms.uTime.value = t;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.addEventListener("resize", resize);

  return { renderer, scene, camera, group, meshes, resize };
}

// Existing worksTop / worksBottom (already global in app.js)
// We wait until DOM is ready and those arrays exist.
window.addEventListener("DOMContentLoaded", async () => {
  // If app.js is module-scoped, these won't be on window.
  // WorksTop/worksBottom to window in app.js).
  const worksTop = window.worksTop;
  const worksBottom = window.worksBottom;

  if (!Array.isArray(worksTop) || !Array.isArray(worksBottom)){
    console.warn("Expose worksTop/worksBottom on window (see instructions).");
    return;
  }

  await initDeck({ canvasId: "glTop",    works: worksTop,    yOffset: +1.6 });
  await initDeck({ canvasId: "glBottom", works: worksBottom, yOffset: -1.6 });
});
