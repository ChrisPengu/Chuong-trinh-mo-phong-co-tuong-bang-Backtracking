// Presentation only: the engine remains the single source of truth for legal moves.
import * as T from "../vendor/three.js";
import { CONTACT, PIECE_FX, movePose } from "./experience.js";

const GLYPHS = { red: { K: "帥", A: "仕", E: "相", H: "馬", R: "車", C: "炮", P: "兵" }, black: { K: "將", A: "士", E: "象", H: "馬", R: "車", C: "砲", P: "卒" } };
const FACTION = { red: 0xff674c, black: 0x4fffd0 };
const clamp = T.MathUtils.clamp;

export function createArena(canvas, { onContextLost } = {}) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  if (renderer.getContext().isContextLost()) { renderer.dispose(); throw new Error("GPU context is lost; reload to retry 3D."); }
  renderer.setClearColor(0x050d19, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new T.Scene();
  const overheadCamera = new T.OrthographicCamera(-7, 7, 7, -7, .1, 80);
  const cinematicCamera = new T.PerspectiveCamera(40, 1, .1, 80);
  let camera = cinematicCamera;
  camera.position.set(0, 17, 10.2); camera.lookAt(0, 0, 0);
  const composer = new T.EffectComposer(renderer);
  const renderPass = new T.RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new T.UnrealBloomPass(new T.Vector2(800, 800), .32, .35, 1.3);
  composer.addPass(bloom); composer.addPass(new T.OutputPass());
  const resources = new Set();
  const own = x => (resources.add(x), x);
  const standard = (color, props = {}) => own(new T.MeshStandardMaterial({ color, roughness: .55, metalness: .55, ...props }));
  const luminous = (color, opacity = 1) => own(new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  const mesh = (geometry, material, parent = scene) => { const m = new T.Mesh(geometry, material); parent.add(m); return m; };
  const box = own(new T.BoxGeometry(1, 1, 1));
  const ringGeo = own(new T.TorusGeometry(1, .018, 6, 96));
  const shardGeo = own(new T.OctahedronGeometry(1, 0));
  const discGeo = own(new T.CylinderGeometry(.365, .4, .22, 48, 1));
  const capGeo = own(new T.CircleGeometry(.337, 48));
  const gold = standard(0xbca777, { metalness: .82, roughness: .3 });
  const stone = standard(0x233244, { roughness: .84, metalness: .3 });
  const dark = standard(0x0d1928, { roughness: .65 });
  const lightRing = luminous(0x63d6cf, .55);
  function block(x, y, z, sx, sy, sz, mat = stone) {
    const m = mesh(box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.receiveShadow = m.castShadow = true; return m;
  }
  function ring(parent, radius, mat, y = 0) {
    const m = mesh(ringGeo, mat, parent); m.rotation.x = -Math.PI / 2; m.scale.setScalar(radius); m.position.y = y; return m;
  }
  scene.add(new T.HemisphereLight(0xc6e8ff, 0x233f48, 2.4));
  const sun = new T.DirectionalLight(0xffecd1, 3.8); sun.position.set(-5, 12, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 9, bottom: -9 }); sun.shadow.bias = -.0005;
  sun.shadow.normalBias = .035;
  own(sun.shadow);
  scene.add(sun);
  const rim = new T.DirectionalLight(0x47c8ff, 2.5); rim.position.set(7, 4, -8); scene.add(rim);
  const strikeLight = new T.PointLight(0xffaa44, 0, 5, 2); scene.add(strikeLight);

  // Layered floating stone dais, luminous inlays and a readable slate playing surface.
  block(0, -.74, 0, 10.3, .38, 11.6, dark);
  block(0, -.47, 0, 10, .22, 11.3, gold);
  block(0, -.28, 0, 9.8, .3, 11.1, stone);
  block(0, -.09, 0, 9.3, .15, 10.4, dark);
  for (const x of [-4.83, 4.83]) block(x, -.25, 0, .035, .08, 10.7, lightRing);
  for (const z of [-5.43, 5.43]) block(0, -.25, z, 9.65, .08, .035, lightRing);
  const boardCanvas = document.createElement("canvas"); boardCanvas.width = 1536; boardCanvas.height = 1728;
  const g = boardCanvas.getContext("2d");
  const w = 1536, h = 1728, unitX = w / 9.2, unitY = h / 10.2;
  const px = c => (c + .6) * unitX, py = r => (r + .6) * unitY;
  g.fillStyle = "#2d414f"; g.fillRect(0, 0, w, h);
  for (let row = 0; row < 9; row++) for (let col = 0; col < 8; col++) {
    if (row === 4) continue;
    g.fillStyle = (row + col) % 2 ? "#354b56" : "#2d414d";
    g.fillRect(px(col), py(row), unitX, unitY);
  }
  // Deterministic fine stone grain; no external textures or network at runtime.
  let seed = 31;
  for (let i = 0; i < 19000; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed % w; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; g.fillStyle = i % 2 ? "#ffffff05" : "#00000009"; g.fillRect(x, seed % h, 2, 2); }
  g.fillStyle = "#162e3f"; g.fillRect(px(0), py(4), unitX * 8, unitY);
  g.strokeStyle = "#c4b58c"; g.lineWidth = 2.4;
  const line = (a, b, c, d) => { g.beginPath(); g.moveTo(px(a), py(b)); g.lineTo(px(c), py(d)); g.stroke(); };
  for (let r = 0; r < 10; r++) line(0, r, 8, r);
  for (let c = 0; c < 9; c++) { line(c, 0, c, 4); line(c, 5, c, 9); }
  line(0, 4, 0, 5); line(8, 4, 8, 5);
  for (let r of [0, 7]) { line(3, r, 5, r + 2); line(5, r, 3, r + 2); }
  g.strokeStyle = "#77aeaf"; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40);
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#9bc8c9"; g.font = "36px serif";
  g.fillText("楚 河", px(2), py(4.5)); g.fillText("漢 界", px(6), py(4.5));
  g.font = "18px sans-serif"; g.fillStyle = "#adbea9";
  for (let c = 0; c < 9; c++) { g.fillText(String(9 - c), px(c), h - 39); g.fillText(String(c + 1), px(c), 39); }
  const boardTexture = own(new T.CanvasTexture(boardCanvas)); boardTexture.colorSpace = T.SRGBColorSpace; boardTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const surface = mesh(own(new T.PlaneGeometry(9.2, 10.2)), standard(0xffffff, { map: boardTexture, roughness: .88, metalness: .15 }));
  surface.rotation.x = -Math.PI / 2; surface.receiveShadow = true;
  // Energy river, tucked beneath the grid so it never obscures glyphs.
  const river = mesh(own(new T.PlaneGeometry(7.95, .025)), luminous(0x43d9d6, .55)); river.rotation.x = -Math.PI / 2; river.position.set(0, .015, 0);
  const outerSeal = new T.Group(); scene.add(outerSeal); outerSeal.position.y = -.92;
  const sealGeo = own(new T.TorusGeometry(6.6, .012, 6, 160));
  const seal = mesh(sealGeo, luminous(0x347d99, .35), outerSeal); seal.rotation.x = -Math.PI / 2;
  const secondSeal = mesh(sealGeo, luminous(0x62cfb7, .18), outerSeal); secondSeal.rotation.x = -Math.PI / 2; secondSeal.scale.setScalar(1.035);
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const m = mesh(box, lightRing, outerSeal); m.position.set(Math.cos(a) * 7.08, 0, Math.sin(a) * 7.08); m.scale.set(.018, .018, i % 4 ? .07 : .2); m.rotation.y = -a + Math.PI / 2; }
  const crystals = [];
  for (const x of [-5.3, 5.3]) for (const z of [-4.6, 4.6]) {
    const color = z > 0 ? FACTION.red : FACTION.black;
    block(x, -.55, z, .9, .65, .9, dark);
    block(x, -.17, z, .78, .12, .78, gold);
    const m = mesh(shardGeo, standard(color, { emissive: color, emissiveIntensity: .55, metalness: .25, roughness: .2 }));
    m.position.set(x, .65, z); m.scale.set(.29, .73, .29); m.rotation.z = x * .025; crystals.push(m);
    const collar = new T.Group(); collar.position.set(x, .1, z); scene.add(collar); ring(collar, .5, luminous(color, .75));
    const light = new T.PointLight(color, 4, 3, 2); light.position.set(x, .7, z); scene.add(light);
    for (let j = 0; j < 3; j++) { const s = mesh(shardGeo, stone); s.position.set(x + Math.sin(j * 2.2) * .6, -.45, z + Math.cos(j * 2.2) * .5); s.scale.set(.22, .5 + j * .08, .23); s.rotation.set(j, j * .7, .4); }
  }
  // Sparse floating motes outside the board, never a full-screen flash.
  const motePositions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) { const a = i * 2.39996, r = 6.2 + (i % 11) * .15; motePositions.set([Math.cos(a) * r, (i % 19) * .12 - .8, Math.sin(a) * r], i * 3); }
  const moteGeo = own(new T.BufferGeometry()); moteGeo.setAttribute("position", new T.BufferAttribute(motePositions, 3));
  const motes = new T.Points(moteGeo, own(new T.PointsMaterial({ color: 0x6fd8c9, size: .045, transparent: true, opacity: .65, blending: T.AdditiveBlending, depthWrite: false }))); scene.add(motes);

  const pieceMaterials = new Map();
  function faceMaterial(piece) {
    const key = piece.color + piece.type;
    if (pieceMaterials.has(key)) return pieceMaterials.get(key);
    const c = document.createElement("canvas"); c.width = c.height = 256; const p = c.getContext("2d");
    const red = piece.color === "red";
    const grad = p.createRadialGradient(100, 75, 10, 128, 128, 145); grad.addColorStop(0, red ? "#fff0c9" : "#defef2"); grad.addColorStop(1, red ? "#ac8552" : "#639b8f");
    p.fillStyle = grad; p.fillRect(0, 0, 256, 256);
    p.strokeStyle = red ? "#91523d" : "#245f56"; p.lineWidth = 5; p.beginPath(); p.arc(128, 128, 115, 0, Math.PI * 2); p.stroke();
    p.lineWidth = 1.5; p.beginPath(); p.arc(128, 128, 105, 0, Math.PI * 2); p.stroke();
    p.fillStyle = red ? "#9f221d" : "#102e2c"; p.textAlign = "center"; p.textBaseline = "middle"; p.font = 'bold 148px "Noto Serif", "Microsoft YaHei", serif'; p.fillText(GLYPHS[piece.color][piece.type], 128, 133);
    const tex = own(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const mat = standard(0xffffff, { map: tex, roughness: .42, metalness: .15 }); pieceMaterials.set(key, mat); return mat;
  }
  const bodyMats = { red: standard(0x713a2b, { metalness: .7, roughness: .3 }), black: standard(0x1c6059, { metalness: .7, roughness: .3 }) };
  const rimMats = { red: luminous(FACTION.red, .65), black: luminous(FACTION.black, .55) };
  function makePiece(piece) {
    const group = new T.Group();
    const body = mesh(discGeo, bodyMats[piece.color], group); body.position.y = .14; body.castShadow = true; body.receiveShadow = true;
    const face = mesh(capGeo, faceMaterial(piece), group); face.rotation.x = -Math.PI / 2; face.position.y = .253;
    ring(group, .365, gold, .25); ring(group, .39, rimMats[piece.color], .055);
    group.userData.piece = piece; return group;
  }
  const pieces = new T.Group(); scene.add(pieces); const slots = new Map();
  const markers = new T.Group(); scene.add(markers);
  const markMats = [luminous(0xffd48a, .9), luminous(0x6affd2, .85), luminous(0xff8162, .9)];
  for (let i = 0; i < 110; i++) { const m = ring(markers, .42, markMats[0], .035); m.visible = false; }
  const trail = new T.Group(); scene.add(trail);
  const trailMats = Array.from({ length: 18 }, (_, i) => luminous(0xffac54, (1 - i / 18) * .5));
  for (let i = 0; i < 18; i++) { const m = mesh(shardGeo, trailMats[i], trail); m.visible = false; }
  const projectile = mesh(shardGeo, luminous(0xffb34e)); projectile.visible = false;
  const effectGroups = new Map();
  const slashGeo = own(new T.TorusGeometry(.8, .032, 6, 48, Math.PI * 1.3));
  const columnGeo = own(new T.CylinderGeometry(.12, .62, 3.5, 24, 1, true));
  const sealCanvas = document.createElement("canvas"); sealCanvas.width = sealCanvas.height = 512;
  const sg = sealCanvas.getContext("2d"); sg.translate(256, 256); sg.strokeStyle = "white"; sg.lineWidth = 2;
  for (const radius of [170, 196, 235]) { sg.beginPath(); sg.arc(0, 0, radius, 0, Math.PI * 2); sg.stroke(); }
  for (let i = 0; i < 12; i++) {
    sg.save(); sg.rotate(i * Math.PI / 6); sg.strokeRect(-5, 203, 10, 15); sg.beginPath(); sg.moveTo(-8, 226); sg.lineTo(0, 239); sg.lineTo(8, 226); sg.stroke(); sg.restore();
  }
  sg.beginPath();
  for (let i = 0; i <= 7; i++) { const a = i * Math.PI * 6 / 7; const x = Math.sin(a) * 165, y = Math.cos(a) * 165; if (!i) sg.moveTo(x, y); else sg.lineTo(x, y); } sg.stroke();
  const sealTexture = own(new T.CanvasTexture(sealCanvas));
  const sealPlane = own(new T.PlaneGeometry(3.2, 3.2));
  const smokeCanvas = document.createElement("canvas"); smokeCanvas.width = smokeCanvas.height = 128;
  const sc = smokeCanvas.getContext("2d"), gradient = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "#ffffff9c"); gradient.addColorStop(.35, "#ffffff50"); gradient.addColorStop(1, "#ffffff00"); sc.fillStyle = gradient; sc.fillRect(0, 0, 128, 128);
  const smokeTexture = own(new T.CanvasTexture(smokeCanvas));
  let state = null, previousAnimation = null, ghost = null, signature = "", frame = 0, disposed = false;
  let lastTime = 0, lastQuality = "", view = "cinematic", introAt = performance.now(), ceremonyWasActive = false;
  const world = (row, col) => new T.Vector3(state?.flipped ? 4 - col : col - 4, 0, state?.flipped ? 4.5 - row : row - 4.5);
  function resize() {
    const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return;
    const aspect = width / height, half = Math.max(6.5, 6.25 / aspect);
    camera = view === "top" ? overheadCamera : cinematicCamera; renderPass.camera = camera;
    if (view === "top") {
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
      camera.position.set(0, 20, .001);
    } else {
      camera.aspect = aspect;
      camera.position.set(0, 15, 12).normalize().multiplyScalar(half / Math.tan(Math.PI / 9));
    }
    camera.lookAt(0, -.1, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, state?.fxLevel === "high" ? 1.7 : state?.fxLevel === "low" ? 1 : 1.3));
    renderer.setSize(width, height, false); composer.setSize(width, height);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  function removeEffect(group) { scene.remove(group); group.traverse(o => { if (o.userData.ownedMaterial) { o.material.dispose(); resources.delete(o.material); } }); }
  function impactGroup(impact) {
    const group = new T.Group(); group.position.copy(world(impact.row, impact.col)); group.position.y = .04;
    const tint = new T.Color(`rgb(${PIECE_FX[impact.type]?.tint || "242,142,52"})`);
    const makeMat = opacity => { const m = luminous(tint, opacity); return m; };
    for (let i = 0; i < 3; i++) { const m = ring(group, .2, makeMat(.8)); m.userData.ownedMaterial = true; }
    const count = state.fxLevel === "low" ? 8 : impact.kind === "move" ? 18 : state.fxLevel === "high" ? 58 : 30;
    for (let i = 0; i < count; i++) { const m = mesh(shardGeo, makeMat(.8), group); m.userData.ownedMaterial = true; m.userData.angle = i * 2.39996; m.userData.speed = .7 + (i % 9) * .18; }
    if (impact.kind !== "move" && state.fxLevel !== "low") {
      const sealMat = own(new T.MeshBasicMaterial({ color: tint, map: sealTexture, transparent: true, opacity: .7, depthWrite: false, blending: T.AdditiveBlending }));
      const decal = mesh(sealPlane, sealMat, group); decal.rotation.x = -Math.PI / 2; decal.position.y = .025; decal.userData = { ownedMaterial: true, role: "seal" };
      if (impact.type === "R") for (let i = 0; i < 3; i++) { const blade = mesh(slashGeo, makeMat(.9), group); blade.userData = { ownedMaterial: true, role: "blade", index: i }; }
      if (impact.type === "C" || impact.type === "E") for (let i = 0; i < 9; i++) {
        const mat = own(new T.SpriteMaterial({ map: smokeTexture, color: impact.type === "C" ? 0xc9997b : 0x7fafa7, transparent: true, opacity: .3, depthWrite: false }));
        const cloud = new T.Sprite(mat); cloud.userData = { ownedMaterial: true, role: "smoke", index: i }; group.add(cloud);
      }
      if (impact.kind === "finale" || impact.kind === "check" || impact.type === "K") {
        const beam = mesh(columnGeo, makeMat(.15), group); beam.userData = { ownedMaterial: true, role: "beam" }; beam.position.y = 1.75;
      }
    }
    scene.add(group); return group;
  }
  function update(now) {
    if (!state) return;
    const reduced = state.reducedMotion, time = reduced ? 0 : now / 1000;
    const qualityKey = `${state.fxLevel}:${reduced}`;
    if (lastQuality !== qualityKey) { lastQuality = qualityKey; bloom.enabled = state.fxLevel === "high" && !reduced; renderer.shadowMap.enabled = state.fxLevel !== "low"; resize(); }
    if (state.ceremonyActive && !ceremonyWasActive) introAt = now;
    ceremonyWasActive = state.ceremonyActive;
    const key = state.board.flat().map(p => p ? p.color[0] + p.type : "-").join("");
    if (key !== signature) {
      signature = key; pieces.clear(); slots.clear();
      state.board.forEach((row, r) => row.forEach((p, c) => { if (p) { const m = makePiece(p); slots.set(r * 9 + c, m); pieces.add(m); } }));
    }
    for (const [slot, m] of slots) {
      const row = Math.floor(slot / 9), col = slot % 9; m.position.copy(world(row, col)); m.scale.setScalar(1);
      if (state.ceremonyActive && !reduced) { const p = clamp((now - introAt - row * 42 - col * 14) / 650, 0, 1); m.position.y = (1 - p) ** 2 * 2.6; m.scale.setScalar(.25 + .75 * p); }
    }
    let markerCount = 0;
    function mark(row, col, size, mat = 0) { const m = markers.children[markerCount++]; if (!m) return; m.visible = true; m.position.copy(world(row, col)); m.position.y = .037; m.scale.setScalar(size); m.material = markMats[mat]; }
    if (state.lastMove) { const m = state.lastMove; mark(m.fromRow, m.fromCol, .42); mark(m.toRow, m.toCol, .44); }
    if (state.selected) mark(state.selected.row, state.selected.col, .49 + Math.sin(time * 3) * .015, 1);
    for (const m of state.legalTargets) mark(m.toRow, m.toCol, state.board[m.toRow][m.toCol] ? .48 : .12, state.board[m.toRow][m.toCol] ? 2 : 1);
    if (state.hintMove) { mark(state.hintMove.fromRow, state.hintMove.fromCol, .49, 1); mark(state.hintMove.toRow, state.hintMove.toCol, .3, 1); }
    for (let i = markerCount; i < markers.children.length; i++) markers.children[i].visible = false;
    trail.visible = !reduced && Boolean(state.animation); projectile.visible = false;
    if (state.animation !== previousAnimation) {
      if (ghost) { scene.remove(ghost); ghost = null; }
      previousAnimation = state.animation;
      if (state.animation?.captured) { ghost = makePiece(state.animation.captured); scene.add(ghost); }
    }
    if (state.animation) {
      const a = state.animation, m = a.move, pose = movePose(a.piece.type, a.progress, Boolean(a.captured));
      const start = world(m.fromRow, m.fromCol), end = world(m.toRow, m.toCol), moving = slots.get(m.toRow * 9 + m.toCol);
      const y = pose.lift / 58;
      if (moving) { moving.position.lerpVectors(start, end, pose.travel); moving.position.y = y; moving.scale.set(pose.scaleX, pose.scaleY, pose.scaleX); }
      if (ghost) { ghost.position.copy(end); const shrink = 1 - clamp((a.progress - CONTACT) / (1 - CONTACT), 0, 1); ghost.scale.setScalar(shrink); ghost.position.y = (1 - shrink) * .7; }
      const color = new T.Color(`rgb(${PIECE_FX[a.piece.type].tint})`);
      for (let i = 0; i < trail.children.length; i++) {
        const p = a.progress - i * .014, part = trail.children[i]; part.visible = p > .08 && a.progress < CONTACT;
        const trailPose = movePose(a.piece.type, p, Boolean(a.captured)); part.position.lerpVectors(start, end, trailPose.travel); part.position.y = trailPose.lift / 58 + .18;
        part.scale.setScalar((1 - i / 18) * (a.captured ? .12 : .075)); part.rotation.set(time * 4, i, time * 2); part.material.color.copy(color);
      }
      if (a.piece.type === "C" && a.progress < CONTACT && !reduced) { projectile.visible = true; projectile.position.lerpVectors(start, end, pose.travel); projectile.position.y = y + .55; projectile.scale.setScalar(.14 + Math.sin(a.progress * Math.PI) * .13); projectile.rotation.set(time * 6, time * 4, 0); }
    }
    strikeLight.intensity = 0;
    for (const [impact, group] of effectGroups) if (!state.impacts.includes(impact) || reduced) { removeEffect(group); effectGroups.delete(impact); }
    if (!reduced) for (const impact of state.impacts) {
      let group = effectGroups.get(impact); if (!group) { group = impactGroup(impact); effectGroups.set(impact, group); }
      group.position.copy(world(impact.row, impact.col)); group.position.y = .04;
      const p = clamp((now - impact.created) / impact.duration, 0, 1), power = impact.kind === "move" ? .55 : impact.kind === "finale" ? 1.75 : 1;
      for (let i = 0; i < group.children.length; i++) {
        const part = group.children[i]; part.material.opacity = (1 - p) ** 2 * .85;
        const role = part.userData.role, index = part.userData.index || 0;
        if (role === "seal") { part.scale.setScalar(.75 + p * .5); part.rotation.z = p * .6; part.material.opacity = Math.sin(p * Math.PI) * .5; }
        else if (role === "blade") { part.scale.setScalar(.6 + p * 1.5); part.rotation.set(Math.PI / 2 + index * .38, index * 1.2 + p * 3, p * 2); part.position.y = .3 + Math.sin(p * Math.PI) * .4; }
        else if (role === "smoke") { const a = index * 2.39996; part.position.set(Math.cos(a) * p * 1.1, .2 + p * (1 + index % 3 * .25), Math.sin(a) * p * 1.1); part.scale.setScalar(.25 + p * 1.4); part.material.opacity = Math.sin(p * Math.PI) * .32; }
        else if (role === "beam") { part.scale.set(1 + p, Math.sin(p * Math.PI), 1 + p); part.material.opacity = (1 - p) * .17; }
        else if (i < 3) { part.scale.setScalar((.3 + Math.sqrt(p) * (1.5 + i * .45)) * power); part.position.y = i * .075; if (i === 2) { part.rotation.x = -Math.PI / 2 + p * .55; part.rotation.y = p; } }
        else { const a = part.userData.angle, r = p * part.userData.speed * power * 1.8; part.position.set(Math.cos(a) * r, Math.max(0, Math.sin(p * Math.PI) * (i % 4 + 1) * .35 * power), Math.sin(a) * r); part.scale.set(.045 * (1 - p), (.08 + i % 3 * .035) * (1 - p), .045 * (1 - p)); part.rotation.set(p * 5 + i, a, p * 7); }
      }
      strikeLight.position.copy(group.position); strikeLight.position.y = .8; strikeLight.intensity = Math.max(strikeLight.intensity, (1 - p) ** 3 * (impact.kind === "move" ? .5 : 4));
    }
    crystals.forEach((m, i) => { m.position.y = .65 + Math.sin(time * 1.15 + i) * .09; m.rotation.y = time * .25 + i; });
    outerSeal.rotation.y = time * .012; motes.rotation.y = time * .025; motes.visible = !reduced && state.fxLevel !== "low";
    river.material.opacity = .45 + Math.sin(time * 1.3) * .1;
  }
  function render(now) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (document.hidden || now - lastTime < (state?.fxLevel === "low" ? 32 : 15)) return;
    lastTime = now; update(now); composer.render();
  }
  const raycaster = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const lost = event => { event.preventDefault(); api.dispose(); onContextLost?.(); };
  canvas.addEventListener("webglcontextlost", lost);
  const api = {
    sync(next) { state = next; },
    setView(next) { view = next === "top" ? "top" : "cinematic"; resize(); },
    pick(clientX, clientY) {
      update(performance.now()); scene.updateMatrixWorld(true);
      const rect = canvas.getBoundingClientRect(); raycaster.setFromCamera(new T.Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2), camera);
      // Hit the raised discs before the ground plane to avoid parallax misclicks.
      const hit = raycaster.intersectObjects(pieces.children, true)[0];
      if (hit) { let group = hit.object; while (group.parent !== pieces) group = group.parent; for (const [slot, m] of slots) if (m === group) return { row: Math.floor(slot / 9), col: slot % 9 }; }
      const p = raycaster.ray.intersectPlane(plane, new T.Vector3()); if (!p) return null;
      let col = Math.round(p.x + 4), row = Math.round(p.z + 4.5); if (state?.flipped) { col = 8 - col; row = 9 - row; }
      return col >= 0 && col <= 8 && row >= 0 && row <= 9 ? { row, col } : null;
    },
    dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener("webglcontextlost", lost); for (const group of effectGroups.values()) removeEffect(group); resources.forEach(r => r.dispose()); composer.passes.forEach(p => p.dispose?.()); composer.dispose(); renderer.dispose(); },
  };
  resize(); frame = requestAnimationFrame(render); return api;
}
