import * as THREE from 'three';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const M = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .85, emissive: e ? c : 0x000000, emissiveIntensity: e });
const TOTAL = 5;
const isTouch = matchMedia('(pointer:coarse)').matches;
if (isTouch) document.body.classList.add('touch');

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bd8ff);
scene.fog = new THREE.Fog(0x9bd8ff, 45, 120);
const cam = new THREE.PerspectiveCamera(60, 1, .1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8a5a, 1.1));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
sun.position.set(10, 20, 8);
scene.add(sun);
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// clouds + distant islands (static dressing)
{
  const r = rng(99);
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + r() * 2, 0), M(0xffffff));
      b.position.set(j * 2.5, r(), r()); c.add(b);
    }
    c.position.set((r() - .5) * 160, -10 + r() * 30, -r() * 220 + 20);
    scene.add(c);
  }
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Mesh(new THREE.ConeGeometry(8 + r() * 8, 14, 5), M(0x7aa6b8));
    k.position.set((r() - .5) * 140, -30, -90 - r() * 120); scene.add(k);
  }
}

// ---------- drone ----------
const drone = new THREE.Group(); scene.add(drone);
const rig = new THREE.Group(); drone.add(rig);
const bodyMat = M(0xf5f5f5);
const body = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 0), bodyMat); body.scale.set(1, .55, 1); rig.add(body);
const rotors = [];
for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, .08, .1), M(0x333a44));
  arm.position.set(x * .4, 0, z * .4); arm.rotation.y = -Math.atan2(z, x); rig.add(arm);
  const rot = new THREE.Mesh(new THREE.BoxGeometry(.9, .03, .12), M(0xffb627));
  rot.position.set(x * .8, .12, z * .8); rig.add(rot); rotors.push(rot);
}
const light = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 4), M(0x4fd18b, 1)); light.position.y = -.28; rig.add(light);
const pkg = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), M(0xff7a1a, .5)); pkg.position.y = -.65; rig.add(pkg); pkg.visible = false;

// ---------- state ----------
const keys = new Set(), joy = { x: 0, y: 0 }, btn = { up: false, down: false };
const st = { mode: 'menu', level: 1, score: 0, battery: 100, health: 100, hasPkg: false, dmg: 0, inv: 0, t: 0, vel: new THREE.Vector3(), standing: null, u: 0 };
let world, plats, cells, hazards, pickup, targetP, minY;

function build(n) {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  plats = []; cells = []; hazards = [];
  const r = rng(n * 7919 + 13);
  const count = Math.min(4 + n, 10);
  let x = 0, y = 0, z = 0;
  const add = (s, moving) => {
    const g = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.BoxGeometry(s, .3, s), M(0x5fbf5a)); grass.position.y = -.15;
    const rock = new THREE.Mesh(new THREE.BoxGeometry(s * .96, .9, s * .96), M(0x8a7b6c)); rock.position.y = -.75;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * .68, 2.2, 4), M(0x6b5e52)); cone.rotation.set(Math.PI, Math.PI / 4, 0); cone.position.y = -2.3;
    g.add(grass, rock, cone); g.position.set(x, y, z); world.add(g);
    const p = { g, x, y, z, s, bx: x, dx: 0, amp: moving ? 3 + r() * 3 : 0, sp: .6 + r() * .6, ph: r() * 6 };
    plats.push(p); return p;
  };
  add(6, false);
  for (let i = 1; i <= count; i++) {
    const prev = plats[plats.length - 1];
    z -= 7 + r() * 3 + Math.min(n, 5) * .5;
    x = clamp(x + (r() - .5) * 12, -12, 12);
    y = clamp(y + (r() - .5) * 4, -5, 7);
    const last = i === count;
    add(last ? 6 : Math.max(3, 5.5 - n * .3 + r() * 2), !last && i > 1 && r() < Math.min(.15 * n, .5));
    const mx = (prev.bx + x) / 2, mz = (prev.z + z) / 2, my = Math.max(prev.y, y);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(.45), M(0xffe14d, .8));
    c.position.set(mx + (r() - .5) * 3, my + 2.2, mz); world.add(c); cells.push({ m: c, on: true });
    if (i > 1 && hazards.length < 7 && r() < .25 + .1 * n) {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 0), M(0x7a2bd1, .6));
      h.position.set(mx, my + 1.2, mz); world.add(h);
      hazards.push({ m: h, bx: mx, amp: 3 + r() * 2, sp: .8 + r() * .8, ph: r() * 6 });
    }
  }
  minY = Math.min(...plats.map(p => p.y)) - 14;
  // pickup on first platform
  pickup = new THREE.Mesh(new THREE.BoxGeometry(.7, .7, .7), M(0xff7a1a, .6));
  const rib = new THREE.Mesh(new THREE.BoxGeometry(.75, .1, .2), M(0xffffff)); pickup.add(rib);
  pickup.position.set(0, .6, -1.2); world.add(pickup);
  // target on last platform
  targetP = plats[plats.length - 1];
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, .12, 6, 20), M(0x4fd18b, .9)); ring.position.set(targetP.x, targetP.y + 1.8, targetP.z); world.add(ring);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, .1, 16), M(0x4fd18b, .8)); pad.position.set(targetP.x, targetP.y + .05, targetP.z); world.add(pad);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x4fd18b, transparent: true, opacity: .25, side: THREE.DoubleSide }));
  beam.position.set(targetP.x, targetP.y + 15, targetP.z); world.add(beam);
}

function startLevel(n) {
  build(n);
  Object.assign(st, { mode: 'play', level: n, battery: 100, health: 100, hasPkg: false, dmg: 0, inv: 0, standing: plats[0] });
  st.vel.set(0, 0, 0); drone.position.set(0, 1.2, 1.5); rig.rotation.set(0, 0, 0);
  pkg.visible = false; $('ov').classList.add('hide');
}

// ---------- overlay ----------
function overlay(title, text, label, fn) {
  $('ovT').textContent = title; $('ovP').textContent = text; $('ovB').textContent = label;
  $('ovB').onclick = fn; $('ov').classList.remove('hide');
}
const controlsText = isTouch
  ? 'Left stick: fly\n▲ rise   ▼ descend\nGrab the orange package, then reach the green ring.'
  : 'WASD / arrows: fly\nSpace: rise   Shift: descend\nGrab the orange package, then reach the green ring.';
function menu() {
  st.score = 0; build(1); st.mode = 'menu'; drone.position.set(0, 1.2, 1.5);
  overlay('Sky Courier', controlsText + '\nCollect yellow cells for battery. Avoid purple storm orbs.', 'Start flying', () => startLevel(1));
}
function lose(why) {
  if (st.mode !== 'play') return;
  st.mode = 'lost';
  overlay('Delivery failed', why + '\nScore ' + st.score, 'Try again', () => startLevel(st.level));
}
function win() {
  st.score += 100 + Math.floor(st.battery) * 2 + Math.floor(st.health);
  if (st.level >= TOTAL) {
    st.mode = 'won';
    overlay('All deliveries done!', 'Final score ' + st.score, 'Play again', () => { st.score = 0; startLevel(1); });
  } else {
    st.mode = 'won';
    overlay('Delivered!', 'Score ' + st.score, 'Next delivery', () => startLevel(st.level + 1));
  }
}

// ---------- input ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if ((k === 'enter' || k === 'r') && !$('ov').classList.contains('hide')) { $('ovB').click(); return; }
  if (k === 'r' && st.mode === 'play') startLevel(st.level);
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const stick = $('stick'), knob = $('knob'); let sid = null;
function setJoy(e) {
  const r = stick.getBoundingClientRect();
  let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  joy.x = Math.abs(dx) < .1 ? 0 : dx; joy.y = Math.abs(dy) < .1 ? 0 : dy;
  knob.style.transform = `translate(${dx * 45}px,${dy * 45}px)`;
}
stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(sid); setJoy(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setJoy(e); });
const endJoy = e => { if (e.pointerId === sid) { sid = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);
for (const [id, key] of [['bUp', 'up'], ['bDn', 'down']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); btn[key] = true; });
  ['pointerup', 'pointercancel'].forEach(t => b.addEventListener(t, () => btn[key] = false));
}
function input() {
  const has = (...a) => a.some(k => keys.has(k));
  let x = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0) + joy.x;
  let z = (has('s', 'arrowdown') ? 1 : 0) - (has('w', 'arrowup') ? 1 : 0) + joy.y;
  const u = (has(' ', 'e') || btn.up ? 1 : 0) - (has('shift', 'q') || btn.down ? 1 : 0);
  const m = Math.hypot(x, z); if (m > 1) { x /= m; z /= m; }
  return { x, z, u };
}

// ---------- update ----------
const SPEED = 9;
function update(dt) {
  st.t += dt; const t = st.t;
  for (const p of plats) { const ox = p.x; if (p.amp) p.x = p.bx + Math.sin(t * p.sp + p.ph) * p.amp; p.dx = p.x - ox; p.g.position.x = p.x; }
  for (const c of cells) if (c.on) { c.m.rotation.y += dt * 2; c.m.position.y += Math.sin(t * 3) * .004; }
  for (const h of hazards) { h.m.position.x = h.bx + Math.sin(t * h.sp + h.ph) * h.amp; h.m.rotation.x += dt; h.m.rotation.y += dt * 1.3; }
  if (pickup.visible) { pickup.rotation.y += dt; pickup.position.y = .6 + Math.sin(t * 2) * .12; }
  const pos = drone.position, vel = st.vel;
  let I = { x: 0, z: 0, u: 0 }, name = 'Hover';

  if (st.mode === 'play') {
    I = input();
    const k = 1 - Math.exp(-dt * 4);
    vel.x += (I.x * SPEED - vel.x) * k; vel.z += (I.z * SPEED - vel.z) * k;
    vel.y += ((I.u > 0 ? 6.5 : I.u < 0 ? -6 : -1.3) - vel.y) * (1 - Math.exp(-dt * 3.5));
    if (st.dmg > 0) { vel.x += (Math.random() - .5) * dt * 30; vel.z += (Math.random() - .5) * dt * 30; }
    if (st.standing) pos.x += st.standing.dx;
    const off = st.hasPkg ? .9 : .4, prevBottom = pos.y - off;
    pos.addScaledVector(vel, dt); pos.y = Math.min(pos.y, 32);
    st.standing = null;
    for (const p of plats) {
      const half = p.s / 2 + .25;
      if (Math.abs(pos.x - p.x) < half && Math.abs(pos.z - p.z) < half && prevBottom >= p.y - .1 && pos.y - off <= p.y && vel.y <= 0) {
        pos.y = p.y + off; vel.y = 0; st.standing = p;
      }
    }
    // battery
    const moving = Math.hypot(vel.x, vel.z) > 1;
    const drain = st.standing && !moving && I.u <= 0 ? .4 : 1 + (I.u > 0 ? 1.2 : 0);
    st.battery -= drain * (1 + .1 * st.level) * dt;
    st.dmg = Math.max(0, st.dmg - dt); st.inv = Math.max(0, st.inv - dt);
    // pickup
    if (!st.hasPkg && pos.distanceTo(pickup.position) < 1.6) {
      st.hasPkg = true; pickup.visible = false; pkg.visible = true; pos.y += .5;
    }
    // cells
    for (const c of cells) if (c.on && pos.distanceTo(c.m.position) < 1.2) { c.on = false; c.m.visible = false; st.battery = Math.min(100, st.battery + 25); }
    // hazards
    for (const h of hazards) {
      if (st.inv <= 0 && pos.distanceTo(h.m.position) < 1.5) {
        if (st.hasPkg) st.health -= 34; else st.battery -= 12;
        st.inv = 1.5; st.dmg = 1.2;
        const kb = pos.clone().sub(h.m.position).normalize().multiplyScalar(9); vel.add(kb); vel.y = Math.max(vel.y, 3);
      }
    }
    // delivery
    if (st.hasPkg && Math.hypot(pos.x - targetP.x, pos.z - targetP.z) < 1.9 && pos.y - targetP.y > .3 && pos.y - targetP.y < 4) {
      st.hasPkg = false; pkg.visible = false; win();
    }
    if (st.battery <= 0) lose('Battery ran out.');
    else if (st.health <= 0) lose('The package was destroyed.');
    else if (pos.y < minY) lose('You fell into the void.');
    name = st.dmg > 0 ? 'Damaged' : st.battery < 20 ? 'Low battery' : I.u > 0 ? 'Boost' : st.hasPkg ? 'Carrying' : moving ? 'Flying' : 'Hover';
  } else if (st.mode === 'lost') {
    vel.y -= 15 * dt; pos.addScaledVector(vel, dt); rig.rotation.x += dt * 4; rig.rotation.z += dt * 3; name = 'Crashed';
  } else {
    name = st.mode === 'won' ? 'Delivered' : 'Ready';
  }

  // visuals
  if (st.mode !== 'lost') {
    const k = 1 - Math.exp(-dt * 8);
    rig.rotation.z += (-vel.x * .035 - rig.rotation.z) * k; rig.rotation.x += (vel.z * .035 - rig.rotation.x) * k;
    rig.position.y = Math.sin(t * 3) * .06;
  }
  const spin = (20 + Math.hypot(vel.x, vel.z) * 2 + (I.u > 0 ? 25 : 0)) * (st.battery < 20 ? .7 : 1);
  rotors.forEach((r, i) => r.rotation.y += dt * spin * (i % 2 ? -1 : 1));
  bodyMat.emissive.setHex(st.dmg > 0 && Math.floor(t * 12) % 2 ? 0xff2020 : 0x000000);
  light.material.color.setHex(st.battery < 20 && Math.floor(t * 4) % 2 ? 0xff5a5f : 0x4fd18b);
  light.material.emissive.copy(light.material.color);

  // camera
  const want = new THREE.Vector3(pos.x, pos.y + 5.5, pos.z + 9);
  cam.position.lerp(want, 1 - Math.exp(-dt * 4));
  cam.lookAt(pos.x, pos.y + .5, pos.z - 4);

  // HUD
  const bat = clamp(st.battery, 0, 100), hp = clamp(st.health, 0, 100);
  $('bat').style.width = bat + '%'; $('bat').style.background = bat < 20 ? 'var(--bad)' : 'var(--ok)';
  $('hp').style.width = hp + '%'; $('hp').style.background = hp < 40 ? 'var(--bad)' : 'var(--ok)';
  $('state').textContent = name; $('lvl').textContent = st.level; $('score').textContent = st.score;
  $('goal').textContent = st.hasPkg ? 'Reach the green ring' : 'Pick up the package';
}

const clock = new THREE.Clock();
menu(); cam.position.set(0, 6, 10);
(function loop() {
  const dt = Math.min(clock.getDelta(), .05);
  update(dt); renderer.render(scene, cam); requestAnimationFrame(loop);
})();
