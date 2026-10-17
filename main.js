import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const app = document.getElementById('app');
const msg = document.getElementById('msg');
const ampEl = document.getElementById('amp');
const ampVal = document.getElementById('ampVal');
const speedEl = document.getElementById('speed');
const speedVal = document.getElementById('speedVal');
const tilesEl = document.getElementById('tiles');
const rebuildBtn = document.getElementById('rebuild');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d8ff);
scene.fog = new THREE.Fog(0xb9d8ff, 10, 48);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(8, 5.6, 8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(4, 0.35, 4);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 2.5;
controls.maxDistance = 35;

const hemi = new THREE.HemisphereLight(0xf4fbff, 0x5e7948, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(9, 12, 6);
scene.add(sun);

const helperGround = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x7aa860, roughness: 1.0 })
);
helperGround.rotation.x = -Math.PI / 2;
helperGround.position.y = -0.002;
scene.add(helperGround);

const grid = new THREE.GridHelper(80, 40, 0x6b8c59, 0x7ea168);
grid.position.y = 0.001;
scene.add(grid);

let sourceTile = null;
let tileRoot = new THREE.Group();
scene.add(tileRoot);
let clock = new THREE.Clock();
let compiledCount = 0;
const windMaterials = [];

const windSettings = {
  amplitude: Number(ampEl.value),
  speed: Number(speedEl.value),
  dir: new THREE.Vector2(1.0, 0.35).normalize(),
  freq: 2.2,
};

ampEl.addEventListener('input', () => {
  windSettings.amplitude = Number(ampEl.value);
  ampVal.textContent = ampEl.value;
});
speedEl.addEventListener('input', () => {
  windSettings.speed = Number(speedEl.value);
  speedVal.textContent = speedEl.value;
});
rebuildBtn.addEventListener('click', rebuildTiles);
ampVal.textContent = ampEl.value;
speedVal.textContent = speedEl.value;

function patchWindMaterial(material) {
  material = material.clone();
  material.side = THREE.DoubleSide;
  material.vertexColors = false; // keep mesh colors controlled by material palette only
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindAmp = { value: windSettings.amplitude };
    shader.uniforms.uWindSpeed = { value: windSettings.speed };
    shader.uniforms.uWindDir = { value: windSettings.dir };
    shader.uniforms.uWindFreq = { value: windSettings.freq };
    material.userData.shader = shader;
    compiledCount++;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform float uTime;
        uniform float uWindAmp;
        uniform float uWindSpeed;
        uniform vec2 uWindDir;
        uniform float uWindFreq;
      `)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        // Wind is derived from blade height, not optional GLB color data.
        // GLB from Blender uses Y as up in Three.js.
        // Strong continuous displacement: roots fixed, tips move.
        // GLB is converted Z-up -> Y-up at export; blade Y=0..0.12 m.
        float swayWeight = smoothstep(0.008, 0.110, position.y);
        vec2 worldXZ = (modelMatrix * vec4(position, 1.0)).xz;
        float t = uTime * max(uWindSpeed, 0.0);
        float wave = sin(t * 3.2 + dot(worldXZ, vec2(1.3, 0.7)));
        float gust = 0.8 * wave + 0.2 * sin(t * 5.1 + worldXZ.x * 0.6);
        float distanceFromRoot = swayWeight * swayWeight;
        transformed.x += uWindDir.x * uWindAmp * gust * distanceFromRoot;
        transformed.z += uWindDir.y * uWindAmp * gust * distanceFromRoot;
      `);
  };
  material.customProgramCacheKey = () => 'grass-wind-v1-4-4';
  windMaterials.push(material);
  return material;
}

function prepareTile(root) {
  let detectedMeshes = 0;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    // GLTFLoader splits one Blender mesh into six primitives. Child mesh names
    // are not guaranteed to contain Grass_Blades_4m. Identify by material names,
    // original mesh name, OR any ancestor group name.
    let ancestor = obj;
    let inheritedGrassName = false;
    while (ancestor) {
      if (/Grass_Blades_4m|Grass_v1_4_WindRealism_Mesh/i.test(ancestor.name || '')) {
        inheritedGrassName = true;
        break;
      }
      ancestor = ancestor.parent;
    }
    const materialIsGrass = mats.some(m => m && /^Grass_V14_/i.test(m.name || ''));
    const isGrass = materialIsGrass || inheritedGrassName;
    if (isGrass) {
      detectedMeshes++;
      obj.frustumCulled = false;  // allow the tips to move beyond static bounds
      obj.material = Array.isArray(obj.material)
        ? mats.map(m => patchWindMaterial(m))
        : patchWindMaterial(obj.material);
    } else {
      mats.forEach(m => { if (m) m.side = THREE.DoubleSide; });
    }
  });
  window._grassMeshDetected = detectedMeshes;
  console.info('[GRASS v1.4.4] detected grass meshes:', detectedMeshes,
               'patched materials:', windMaterials.length);
  return root;
}

function clearGroup(group) {
  while (group.children.length) {
    group.remove(group.children[0]);
  }
}

function rebuildTiles() {
  if (!sourceTile) return;
  clearGroup(tileRoot);
  const tiles = Math.max(1, Math.min(9, Number(tilesEl.value) || 1));
  const size = 4;
  const half = (tiles - 1) * 0.5;

  for (let z = 0; z < tiles; z++) {
    for (let x = 0; x < tiles; x++) {
      const tile = sourceTile.clone(true);
      tile.position.set((x - half) * size, 0, (z - half) * size);
      tileRoot.add(tile);
    }
  }
  controls.target.set(0, 0.35, 0);
  msg.textContent = `表示中: ${tiles} × ${tiles} タイル`; 
}

new GLTFLoader().load(
  './grass_4m_webxr_wind_realism_v1_4.glb',
  (gltf) => {
    sourceTile = prepareTile(gltf.scene);
    rebuildTiles();
    msg.textContent = 'GLB読み込み成功。風シェーダー起動を確認中…';
  },
  undefined,
  (error) => {
    console.error(error);
    msg.textContent = 'GLBを読み込めません。公開先にGLBが含まれているか確認してください。';
  }
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (const mat of windMaterials) {
    const shader = mat.userData.shader;
    if (!shader) continue;
    shader.uniforms.uTime.value = t;
    shader.uniforms.uWindAmp.value = windSettings.amplitude;
    shader.uniforms.uWindSpeed.value = windSettings.speed;
    shader.uniforms.uWindDir.value.copy(windSettings.dir);
    shader.uniforms.uWindFreq.value = windSettings.freq;
  }
  controls.update();
  renderer.render(scene, camera);
  if (sourceTile && Math.floor(t * 2) !== window._lastStatusTick) {
    window._lastStatusTick = Math.floor(t * 2);
    msg.textContent = `時間 ${t.toFixed(1)}秒 | 芝メッシュ ${window._grassMeshDetected ?? 0} | 芝マテリアル ${windMaterials.length} | シェーダー作成 ${compiledCount} | 風 ${windSettings.amplitude.toFixed(2)}`;
  }
});
