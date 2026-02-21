import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";

import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";
import { GammaCorrectionShader } from "three/addons/shaders/GammaCorrectionShader.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";

const TEXTURE_PATH = "maps/grid.png";
const HEIGHT_PATH = "maps/height_map.png";
const METALNESS_PATH = "maps/metalness_map.png";
const PYRAMID_PATH = "maps/pyramid_map.png";
const GLYPH_PATH = "maps/glyph_atlas_map.png";

// Load textures
const loader = new THREE.TextureLoader();
const colorMap = loader.load(TEXTURE_PATH);
const heightMap = loader.load(HEIGHT_PATH);
const metalMap = loader.load(METALNESS_PATH);
const pyraMap = loader.load(PYRAMID_PATH);
const glyphAtlasMap = loader.load(GLYPH_PATH);

// colorMap.colorSpace = THREE.SRGBColorSpace; // Set correct color space for the base color map

// Window size
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.01,
  20,
);
camera.position.set(0, 0.07, 1.1);

// Helper to easily plot a line later for multiple eyelashes
function createLash(startX, startY, endX, endY) {
  const pts = [
    new THREE.Vector3(startX, startY, 0), // Base of eyelash
    new THREE.Vector3(endX, endY, 0), // Tip of eyelash
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const lash = new THREE.Line(geo, lash_mat);
  // Push slightly out so it doesn't z-fight with the eye
  lash.position.z = 0.01;
  return lash;
}

/* --------------------
   RENDERING + EFFECTS
   -------------------- */

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: false });
// "ensures the canvas resolution matches the screen's physical pixels, preventing blurriness"
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sizes.width, sizes.height);
document.body.appendChild(renderer.domElement);

// Post-Processing Effects Composer (wraps our renderer)
const composer = new EffectComposer(renderer);
// "ensures the canvas resolution matches the screen's physical pixels, preventing blurriness"
composer.setSize(sizes.width, sizes.height);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Add Render Pass to composer
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

/* ------ SHADERS!!! ------ */

// Add Afterimage Pass to composer
const afterimagePass = new AfterimagePass();
afterimagePass.uniforms["damp"].value = 0.85; // Lower = shorter trails, 0.99 = infinite
composer.addPass(afterimagePass);

// Add Bloom Pass to composer
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(sizes.width, sizes.height),
  1.5, // Strength
  0.45, // Radius
  0.85, // Threshold
);
composer.addPass(bloomPass);

// Add RBG Pass to composer
const rgbPass = new ShaderPass(RGBShiftShader);
rgbPass.uniforms["amount"].value = 0.0015;
composer.addPass(rgbPass);

// Add Gamma Correction to composer (to brighten)
const gammaPass = new ShaderPass(GammaCorrectionShader);
composer.addPass(gammaPass);

// Fog
const fog = new THREE.Fog("#000000", 1, 2.5);
scene.fog = fog;

/* --------------------
     MESHES / OBJECTS
   -------------------- */

/* ------ FLOORS ------ */

// FLOOR 1
const floor_geo = new THREE.PlaneGeometry(1, 2, 24, 24);
const floor_mat = new THREE.MeshStandardMaterial({
  map: colorMap,
  displacementMap: heightMap,
  displacementScale: 0.8,
  metalnessMap: metalMap,
  metalness: 0.96,
  roughness: 0.5,
});
const floor = new THREE.Mesh(floor_geo, floor_mat);
// Rotate floor1 plane to be flat on ground
floor.rotation.x = -Math.PI / 2;

// CLONE FLOOR (FLOOR 2)
const floor2 = floor.clone();

/* --------------------
     BILL CYPHER
   -------------------- */

/* ------ Pyramid ------ */

// Pyramid
const pyramid_geo = new THREE.CylinderGeometry(0.0001, 0.3, 0.4, 4, 1);
const pyramid_mat = new THREE.MeshStandardMaterial({
  map: pyraMap,
  emissive: 0x6a6a33,
  emissiveIntensity: 1.3,
  fog: false,
});
const pyramid = new THREE.Mesh(pyramid_geo, pyramid_mat);
pyramid.rotation.y = Math.PI / 4;
pyramid.rotation.x = Math.PI / 180;

/* ------ Pyramid Fat Outline ------ */

// Outline (LineSegmentGeo from EdgeGeometry, which (wraps pyramid geo) + LineMaterial)
const pyra_edges_geo = new THREE.EdgesGeometry(pyramid_geo);
const pyra_line_geo = new LineSegmentsGeometry().fromEdgesGeometry(
  pyra_edges_geo,
);
const pyra_line_mat = new LineMaterial({
  color: 0xfccf19,
  linewidth: 4,
  resolution: new THREE.Vector2(sizes.width, sizes.height), // Required
});
const pyra_line = new LineSegments2(pyra_line_geo, pyra_line_mat);
pyramid.add(pyra_line);

/* ------ Eye ------ */

// Almond shape quadratic curves
const eye_curves = new THREE.Shape();
eye_curves.moveTo(-0.07, 0); // Left corner
eye_curves.quadraticCurveTo(0, 0.1, 0.07, 0); // Top curve to right corner
eye_curves.quadraticCurveTo(0, -0.08, -0.07, 0); // Bottom curve back to left corner
// Convert to Geometry and Mesh
const eye_geo = new THREE.ShapeGeometry(eye_curves);
const eye_mat = new THREE.MeshBasicMaterial({
  color: 0xeeeeee,
  emissive: 0xffffff,
  emissiveIntensity: 2,
  fog: false,
}); // BasicMaterial ignores lighting
const eye = new THREE.Mesh(eye_geo, eye_mat);
eye.position.set(0, -0.03, 0);

/* ------ Eye Outline ------ */

const eye_curves_pts = eye_curves.getPoints(50); // Get points along the curve
const eye_outl_geo = new THREE.BufferGeometry().setFromPoints(eye_curves_pts);
const eye_outl_mat = new THREE.LineBasicMaterial({
  color: 0x000000,
  linewidth: 5,
});
const eye_outl = new THREE.LineLoop(eye_outl_geo, eye_outl_mat);
eye_outl.position.set(0, 0, 0.1);

const eye_outl2 = eye_outl.clone();
eye_outl2.position.set(0, -0.005, 0.1);

const eye_outl3 = eye_outl.clone();
eye_outl3.position.set(0, 0.005, 0.1);

/* ------ Eyelashes ------ */

const lash_mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
// Top 3 Lashes
eye.add(createLash(-0.05, 0.03, -0.07, 0.05)); // Top Left
eye.add(createLash(-0.02, 0.05, -0.03, 0.07)); // Top Left Center
eye.add(createLash(0.02, 0.05, 0.03, 0.07)); // Top Right Center
eye.add(createLash(0.05, 0.03, 0.07, 0.05)); // Top Right
// Bottom 3 Lashes
eye.add(createLash(-0.05, -0.02, -0.07, -0.04)); // Top Left
eye.add(createLash(-0.02, -0.04, -0.03, -0.06)); // Top Left Center
eye.add(createLash(0.02, -0.04, 0.03, -0.06)); // Top Right Center
eye.add(createLash(0.05, -0.02, 0.07, -0.04)); // Top Right

/* ------ Pupil ------ */

// Ellipse shaped Pupil
const pupil_ellipse = new THREE.Shape();
pupil_ellipse.ellipse(0, 0, 0.015, 0.04, 0, 2 * Math.PI, false, 0);
const pupil_geo = new THREE.ShapeGeometry(pupil_ellipse); // Circle for the pupil
const pupil_mat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: false,
  depthTest: true,
  fog: false,
});
const pupil = new THREE.Mesh(pupil_geo, pupil_mat);
pupil.position.set(0, 0, 0.1);

// Add to eye
eye.add(eye_outl, eye_outl2, eye_outl3, pupil);

/* ------ Hat ------ */

//  Create hat_group
const hat_group = new THREE.Group();
const hat_mat = new THREE.MeshStandardMaterial({
  color: 0x222222,
  fog: false,
});

// Brim
const brim_geo = new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16);
const brim = new THREE.Mesh(brim_geo, hat_mat);

// Brim Outline (LineSegmentGeo from EdgeGeometry, which (wraps pyramid geo) + LineMaterial)
const brim_edges_geo = new THREE.EdgesGeometry(brim_geo);
const brim_line_geo = new LineSegmentsGeometry().fromEdgesGeometry(
  brim_edges_geo,
);
const brim_line_mat = new LineMaterial({
  color: 0xf39c1955,
  linewidth: 1,
  resolution: new THREE.Vector2(sizes.width, sizes.height), // Required
});
const brim_line = new LineSegments2(brim_line_geo, brim_line_mat);
// Add outline to brim
brim.add(brim_line);

const top_geo = new THREE.CylinderGeometry(0.025, 0.025, 0.18, 16);
const top = new THREE.Mesh(top_geo, hat_mat);

// Top Outline (LineSegmentGeo from EdgeGeometry, which (wraps pyramid geo) + LineMaterial)
const top_edges_geo = new THREE.EdgesGeometry(top_geo);
const top_line_geo = new LineSegmentsGeometry().fromEdgesGeometry(
  top_edges_geo,
);
const top_line_mat = new LineMaterial({
  color: 0xf39c1955,
  linewidth: 1,
  resolution: new THREE.Vector2(sizes.width, sizes.height), // Required
});
const top_line = new LineSegments2(top_line_geo, top_line_mat);
// Add outline to brim
top.add(top_line);

top.position.y = 0.09; // Rest top on brim

hat_group.add(brim, top);
hat_group.position.set(0, 0.19, 0); // Put on top of pyramid
hat_group.rotation.x = (-10 * Math.PI) / 180;

// Add to bill cypher
const bill = new THREE.Group();
bill.add(pyramid, eye, hat_group);
bill.position.set(0, 0.5, -1.3);

/* --------------------
          LIGHTS
   -------------------- */
// Ambient
const ambient = new THREE.AmbientLight(0xdf3f3f, 10);

/* ------ SPOTLIGHTS ------ */

// Left Light (will point right)
const light_left = new THREE.SpotLight(0xd53c3d, 20, 25, Math.PI * 0.1, 0.25);
light_left.position.set(-0.5, 0.75, 2.2);
// Left target
const left_target = new THREE.Object3D();
left_target.position.set(0.25, 0.25, 0.25);
light_left.target = left_target;

// Right Light (will point left)
const light_right = new THREE.SpotLight(0xd53c3d, 20, 25, Math.PI * 0.1, 0.25);
light_right.position.set(0.5, 0.75, 2.2);
// Right target
const right_target = new THREE.Object3D();
right_target.position.set(-0.25, 0.25, 0.25);
light_right.target = right_target;

/* ------ GLYPH ORBIT RING ------ */

// Glyph Pivot Group
const glyph_group = new THREE.Group();

// Glyph Master Material
const glyph_geo = new THREE.PlaneGeometry(0.1, 0.1);
const glyph_master_mat = new THREE.MeshStandardMaterial({
  color: 0x00aaff,
  emissive: 0x00aaff,
  emissiveIntensity: 4, // Triggers bright blue bloom
  transparent: true,
  side: THREE.DoubleSide, // So you can see them from behind
  map: glyphAtlasMap, // Uncomment when you have your transparent PNGs ready
});

const num_glyphs = 10; // 10 total glyphs
const orbit_radius = 0.4;
const cols = 4; // 4x4 grid

for (let i = 0; i < num_glyphs; i++) {
  // Clone texture so this glyph has its own independent UV coordinates
  const glyph_map = glyphAtlasMap.clone();
  glyph_map.needsUpdate = true; // Tell the GPU this is a new texture instance

  // Shrink "window" of texture to 25% so it only focuses on one grid square
  glyph_map.repeat.set(0.25, 0.25);

  // Calc grid position
  const col = i % cols; // 0, 1, 2, 3, 0, 1...
  const row = Math.floor(i / cols); // 0, 0, 0, 0, 1, 1...

  // Shift/offset texture window to the correct Row, Column square
  // Since WebGL reads from BL->TR, we invert the row using (3 - row) to map glyphs TL->BR.
  glyph_map.offset.set(col * 0.25, (3 - row) * 0.25);

  const glyph_mat = new THREE.MeshStandardMaterial({
    map: glyph_map,
    transparent: true,
    alphaTest: 0.5,
    color: 0x00aaff,
    emissive: 0x00aaff,
    emissiveIntensity: 7,
    side: THREE.DoubleSide,
  });

  // Create glyph mesh and place it in orbit group
  const glyph = new THREE.Mesh(glyph_geo, glyph_mat);

  // Circle trig (from Polygon vertices creation code)
  const angle = (i / num_glyphs) * Math.PI * 2;
  glyph.position.x = Math.cos(angle) * orbit_radius;
  glyph.position.y = Math.sin(angle) * orbit_radius;

  glyph_group.add(glyph);
}

glyph_group.position.set(0, 0.5, -1.3);

scene.add(
  floor,
  floor2,
  bill,
  glyph_group,
  light_left,
  left_target,
  light_right,
  right_target,
);

// Orbit Controls for smoother development
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const light_l_helper = new THREE.SpotLightHelper(light_left);
const light_r_helper = new THREE.SpotLightHelper(light_right);

scene.add(light_l_helper, light_r_helper);

// Resize updater for renderer/composer sizing
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // renderer.setSize(sizes.width, sizes.height);
  composer.setSize(sizes.width, sizes.height);
  pyra_line_mat.resolution.set(sizes.width, sizes.height);
  brim_line_mat.resolution.set(sizes.width, sizes.height);
  top_line_mat.resolution.set(sizes.width, sizes.height);
});

let time = 0;
function animate() {
  time += 0.01;
  let eye_z_s = 0.02 * Math.cos(time);
  let pupil_x_s = 0.01 * Math.sin(time * 2);
  let eye_x_s = 0.01 * Math.sin(time * 2);
  let bill_z_s = 0.5 * Math.sin(time * 1.5);
  let bill_x_s = 0.08 * Math.sin(time * 1.5);
  let bill_y_s = 0.2 * Math.cos(time * 1.5);
  let bill_rz_s = 0.01 * Math.cos(time * 1.5);
  let glyph_z_s = 0.3 * Math.sin(time * 1.5);

  controls.update();
  renderer.render(scene, camera);
  //   composer.render(); // render while keeping effects
  floor.position.z = (time * 0.15) % 2;
  floor2.position.z = ((time * 0.15) % 2) - 2;

  pupil.position.x = pupil_x_s;
  eye.position.x = eye_x_s;
  eye.position.z = eye_z_s + 0.19;

  hat_group.rotation.y += 0.005;
  bill.position.z = bill_z_s - 1.3;
  bill.rotation.x = bill_x_s + 0.1;
  bill.rotation.y = bill_y_s;
  bill.rotation.z = bill_rz_s;

  glyph_group.position.z = glyph_z_s - 1;
  glyph_group.rotation.z += 0.007;

  requestAnimationFrame(animate);
}

animate();
