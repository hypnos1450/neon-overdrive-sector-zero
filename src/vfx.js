import * as THREE from 'three';

const MAX_PARTICLES = 1500;
const MAX_RINGS = 32;
const MAX_BEAMS = 48;
const MAX_FCT = 64;

export class VFXManager {
  constructor(scene, fctContainer) {
    this.scene = scene;
    this.fctContainer = fctContainer;

    // Scratch objects for zero-GC updates
    this._dummyMatrix = new THREE.Matrix4();
    this._dummyPos = new THREE.Vector3();
    this._dummyQuat = new THREE.Quaternion();
    this._dummyScale = new THREE.Vector3();
    this._dummyEuler = new THREE.Euler();
    this._dummyColor = new THREE.Color();
    this._projVec = new THREE.Vector3();

    this._initParticles();
    this._initShockwaveRings();
    this._initEnergyBeams();
    this._initFloatingText();
  }

  _initParticles() {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });

    this.particleMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    this.particles = [];
    this.particleCursor = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0, y: -100, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0,
        life: 0,
        maxLife: 0.5,
        scale: 1
      });
      this._dummyMatrix.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, this._dummyMatrix);
      this.particleMesh.setColorAt(i, this._dummyColor.setHex(0x00d4ff));
    }

    this.scene.add(this.particleMesh);
  }

  spawnBurst(x, y, z, colorHex = 0x00d4ff, count = 16, speed = 8.0, baseScale = 1.0) {
    this._dummyColor.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = this.particleCursor;
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
      const p = this.particles[idx];

      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + Math.random() * 0.3;
      p.z = z + (Math.random() - 0.5) * 0.3;
      p.vx = Math.cos(angle) * spd;
      p.vy = 2.5 + Math.random() * speed * 0.75;
      p.vz = Math.sin(angle) * spd;
      p.rx = (Math.random() - 0.5) * 12;
      p.ry = (Math.random() - 0.5) * 12;
      p.maxLife = 0.28 + Math.random() * 0.32;
      p.life = p.maxLife;
      p.scale = baseScale * (0.6 + Math.random() * 0.8);

      this.particleMesh.setColorAt(idx, this._dummyColor);
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  _initShockwaveRings() {
    const ringGeo = new THREE.RingGeometry(0.78, 1.0, 36);
    ringGeo.rotateX(-Math.PI / 2);

    this.rings = [];
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.position.y = 0.06;
      this.scene.add(mesh);

      this.rings.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.35,
        startRadius: 0.5,
        endRadius: 5.0
      });
    }
  }

  spawnShockwave(x, z, colorHex = 0x00d4ff, maxRadius = 6.0, duration = 0.35) {
    const slot = this.rings.find((r) => !r.active) || this.rings[0];
    slot.active = true;
    slot.life = duration;
    slot.maxLife = duration;
    slot.startRadius = 0.4;
    slot.endRadius = maxRadius;
    slot.mat.color.setHex(colorHex);
    slot.mat.opacity = 0.9;
    slot.mesh.position.set(x, 0.08, z);
    slot.mesh.scale.setScalar(slot.startRadius);
    slot.mesh.visible = true;
  }

  _initEnergyBeams() {
    // Unit-length Z-aligned box geometry so we can orient & scale between any 2 points
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0, 0.5);

    this.beams = [];
    for (let i = 0; i < MAX_BEAMS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.beams.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.18,
        thickness: 0.15
      });
    }
  }

  spawnBeam(x1, y1, z1, x2, y2, z2, colorHex = 0x00f0ff, thickness = 0.16, duration = 0.16) {
    const slot = this.beams.find((b) => !b.active) || this.beams[0];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.05) return;

    slot.active = true;
    slot.life = duration;
    slot.maxLife = duration;
    slot.thickness = thickness;
    slot.mat.color.setHex(colorHex);
    slot.mat.opacity = 0.95;

    slot.mesh.position.set(x1, y1, z1);
    slot.mesh.lookAt(x2, y2, z2);
    slot.mesh.scale.set(thickness, thickness, dist);
    slot.mesh.visible = true;
  }

  _initFloatingText() {
    this.fctPool = [];
    this.fctCursor = 0;
    for (let i = 0; i < MAX_FCT; i++) {
      const el = document.createElement('div');
      el.className = 'fct-item hidden';
      this.fctContainer.appendChild(el);
      this.fctPool.push({
        active: false,
        el,
        x: 0, y: 0, z: 0,
        vy: 2.5,
        life: 0,
        maxLife: 0.65,
        scale: 1
      });
    }
  }

  spawnFloatingText(x, y, z, text, color = '#ffffff', scale = 1.0, duration = 0.65) {
    const item = this.fctPool[this.fctCursor];
    this.fctCursor = (this.fctCursor + 1) % MAX_FCT;

    item.active = true;
    item.x = x + (Math.random() - 0.5) * 0.6;
    item.y = y;
    item.z = z + (Math.random() - 0.5) * 0.6;
    item.vy = 2.6 + scale * 0.6;
    item.maxLife = duration;
    item.life = duration;
    item.scale = scale;

    item.el.textContent = text;
    item.el.style.color = color;
    item.el.classList.remove('hidden');
  }

  update(dt, camera) {
    // 1. Update Instanced Particles
    let anyParticleUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyParticleUpdated = true;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this._dummyMatrix.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, this._dummyMatrix);
        continue;
      }

      p.vy -= 22.0 * dt; // Gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      if (p.y < 0.08) {
        p.y = 0.08;
        p.vy = -p.vy * 0.45;
        p.vx *= 0.78;
        p.vz *= 0.78;
      }

      const ratio = p.life / p.maxLife;
      const s = p.scale * ratio;
      this._dummyPos.set(p.x, p.y, p.z);
      this._dummyEuler.set(p.rx * (1 - ratio), p.ry * (1 - ratio), 0);
      this._dummyQuat.setFromEuler(this._dummyEuler);
      this._dummyScale.set(s, s, s);
      this._dummyMatrix.compose(this._dummyPos, this._dummyQuat, this._dummyScale);
      this.particleMesh.setMatrixAt(i, this._dummyMatrix);
    }

    if (anyParticleUpdated) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Update Shockwave Rings
    for (let i = 0; i < MAX_RINGS; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const progress = 1.0 - r.life / r.maxLife;
      const easeOut = 1.0 - Math.pow(1.0 - progress, 3);
      const rad = r.startRadius + (r.endRadius - r.startRadius) * easeOut;
      r.mesh.scale.setScalar(rad);
      r.mat.opacity = (1.0 - progress) * 0.85;
    }

    // 3. Update Energy Beams
    for (let i = 0; i < MAX_BEAMS; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      const ratio = b.life / b.maxLife;
      b.mat.opacity = ratio;
      b.mesh.scale.x = b.thickness * ratio;
      b.mesh.scale.y = b.thickness * ratio;
    }

    // 4. Update Floating Combat Numbers (3D -> 2D Screen Space)
    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;

    for (let i = 0; i < MAX_FCT; i++) {
      const item = this.fctPool[i];
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.el.classList.add('hidden');
        continue;
      }

      item.y += item.vy * dt;
      this._projVec.set(item.x, item.y, item.z).project(camera);

      const sx = this._projVec.x * halfW + halfW;
      const sy = -this._projVec.y * halfH + halfH;
      const alpha = Math.min(1, (item.life / item.maxLife) * 1.6);

      item.el.style.opacity = alpha.toFixed(2);
      item.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${item.scale.toFixed(2)})`;
    }
  }
}
