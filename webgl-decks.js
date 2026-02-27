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

function makeNoiseMaterial(noiseTex){
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.repeat.set(1.0, 1.0);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uNoise: { value: noiseTex },
      uTime:  { value: 0 },
      uAmt:   { value: 0.22 },
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
      varying vec2 vUv;

      float softCircle(vec2 p, vec2 c, float r){
        float d = length(p - c);
        return 1.0 - smoothstep(r, r + 0.08, d);
      }

      void main(){
        vec2 uv = vUv;

        // drifting noise
        vec2 nUv = uv * 2.2 + vec2(uTime * 0.015, -uTime * 0.010);
        float n  = texture2D(uNoise, nUv).r;

        float air = (n * 0.65 + 0.35) * uAmt;

        // soft bubbles
        float b1 = softCircle(uv, vec2(0.25 + 0.03*sin(uTime*0.30), 0.62), 0.13);
        float b2 = softCircle(uv, vec2(0.72, 0.35 + 0.02*cos(uTime*0.25)), 0.10);
        float b3 = softCircle(uv, vec2(0.52 + 0.02*sin(uTime*0.18), 0.78), 0.08);
        float bubbles = (b1*0.45 + b2*0.35 + b3*0.25) * 0.35;

        // soft vignette
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
  const planeMat = makeNoiseMaterial(noiseTex);
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.position.z = 0;
  scene.add(plane);

  // extra bubble meshes (subtle parallax)
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
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let t0 = performance.now();
  function tick(now){
    const t = (now - t0) * 0.001;

    planeMat.uniforms.uTime.value = t;

    // “breathing” drift
    plane.rotation.z = Math.sin(t * 0.06) * 0.02;
    plane.position.x = Math.sin(t * 0.10) * 0.03;
    plane.position.y = Math.cos(t * 0.08) * 0.02;

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
