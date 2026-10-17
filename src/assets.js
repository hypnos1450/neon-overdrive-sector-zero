import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Merges an array of { geo, color } into a single non-indexed BufferGeometry
 * with vertex colors baked in. This allows InstancedMesh to render multi-part,
 * multi-colored 3D mecha models in a single draw call while still supporting
 * per-instance hit-flash and cryo tinting via instanceColor!
 */
export function buildColoredCompositeGeometry(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const tempColor = new THREE.Color();

  for (const part of parts) {
    const nonIndexed = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    const posAttr = nonIndexed.getAttribute('position');
    const normAttr = nonIndexed.getAttribute('normal');
    tempColor.setHex(part.color);

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) {
        normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      } else {
        normals.push(0, 1, 0);
      }
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }
    if (nonIndexed !== part.geo) nonIndexed.dispose();
    part.geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

function transformedBox(w, h, d, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(tx, ty, tz), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

function transformedCylinder(rt, rb, h, segs, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, segs);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(tx, ty, tz), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

export class AssetManager {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.loadedGLTFs = new Map();
    this.statusText = 'LOADING CC0 / PROCEDURAL MECHA RIGS...';
  }

  /**
   * Attempts to load optional local or remote CC0 GLB assets with a fast non-blocking timeout,
   * while guaranteeing immediate availability of our stylized low-poly procedural mecha rigs.
   */
  async preloadAssets() {
    // Candidate permissive GLB URLs (local override or official Three.js Khronos sample drone/robot)
    const manifest = [
      {
        key: 'drone_companion',
        urls: [
          'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r164/examples/models/gltf/RobotExpressive/RobotExpressive.glb'
        ]
      }
    ];

    const loadWithTimeout = (url, timeoutMs = 2200) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
        this.gltfLoader.load(
          url,
          (gltf) => {
            clearTimeout(timer);
            resolve(gltf);
          },
          undefined,
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

    let loadedCount = 0;
    for (const item of manifest) {
      for (const url of item.urls) {
        try {
          const gltf = await loadWithTimeout(url, 1800);
          if (gltf && gltf.scene) {
            this.loadedGLTFs.set(item.key, gltf.scene);
            loadedCount++;
            break;
          }
        } catch (_) {
          // Gracefully fall back to procedural low-poly geometry
        }
      }
    }

    this.statusText =
      loadedCount > 0
        ? `GLTF (${loadedCount}) + INSTANCED LOW-POLY MECHA ENGINE`
        : `PROCEDURAL LOW-POLY MECHA + INSTANCED GPU ENGINE`;
    return this.statusText;
  }

  /**
   * Creates the Player Striker Mech (VX-09 VALKYRIE) hierarchical 3D rig.
   */
  createPlayerMech() {
    const root = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1c2838,
      metalness: 0.65,
      roughness: 0.32
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0xe6f2ff,
      metalness: 0.45,
      roughness: 0.25
    });
    const cyanEmissive = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const greenEmissive = new THREE.MeshBasicMaterial({ color: 0x00ff9d });
    const magentaEmissive = new THREE.MeshBasicMaterial({ color: 0xff1e6b });

    // Ground drop shadow
    const shadowGeo = new THREE.CircleGeometry(1.15, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.02;
    root.add(shadowMesh);

    // Subtle Holographic Ground Ring under Player
    const ringGeo = new THREE.RingGeometry(0.95, 1.08, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });
    const baseRing = new THREE.Mesh(ringGeo, ringMat);
    baseRing.position.y = 0.03;
    root.add(baseRing);

    // Articulated Legs
    const legL = new THREE.Group();
    legL.position.set(-0.36, 0.75, 0);
    const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.3), hullMat);
    thighL.position.y = -0.15;
    const shinL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.26), armorMat);
    shinL.position.set(0, -0.5, 0.04);
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.48), hullMat);
    footL.position.set(0, -0.7, 0.1);
    legL.add(thighL, shinL, footL);

    const legR = legL.clone();
    legR.position.set(0.36, 0.75, 0);
    root.add(legL, legR);

    // Rotating Upper Torso (tracks aim direction)
    const torso = new THREE.Group();
    torso.position.y = 1.05;
    root.add(torso);

    // Core Chest Block
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.78, 0.72), armorMat);
    chest.castShadow = true;
    torso.add(chest);

    // Dark Carbon Breastplate & Reactor Vent
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.52, 0.78), hullMat);
    plate.position.set(0, 0.04, 0.04);
    torso.add(plate);

    const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.82), cyanEmissive);
    coreGlow.position.set(0, 0.06, 0.05);
    torso.add(coreGlow);

    // Mecha Head & Visor
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.52), armorMat);
    head.position.set(0, 0.56, 0.04);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.56), greenEmissive);
    visor.position.set(0, 0.57, 0.06);
    torso.add(head, visor);

    // Shoulder Pauldrons
    const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.62), armorMat);
    pauldronL.position.set(-0.68, 0.24, 0);
    pauldronL.rotation.z = 0.18;
    const pauldronR = pauldronL.clone();
    pauldronR.position.set(0.68, 0.24, 0);
    pauldronR.rotation.z = -0.18;
    torso.add(pauldronL, pauldronR);

    // Dual Arm Pulse Vulcan Cannons
    const armL = new THREE.Group();
    armL.position.set(-0.72, -0.05, 0.35);
    const gunHousingL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.75), hullMat);
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), cyanEmissive);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.z = 0.42;
    armL.add(gunHousingL, barrelL);

    const armR = armL.clone();
    armR.position.set(0.72, -0.05, 0.35);
    torso.add(armL, armR);

    // Upgradable Hardpoint Visuals (Hidden until unlocked)
    // 1. Shoulder Micro-Missile Pods
    const missilePods = new THREE.Group();
    const podGeo = new THREE.BoxGeometry(0.32, 0.34, 0.42);
    const podL = new THREE.Mesh(podGeo, hullMat);
    podL.position.set(-0.68, 0.58, -0.05);
    const podWarheadL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.45), magentaEmissive);
    podWarheadL.position.copy(podL.position);
    const podR = podL.clone();
    podR.position.x = 0.68;
    const podWarheadR = podWarheadL.clone();
    podWarheadR.position.x = 0.68;
    missilePods.add(podL, podWarheadL, podR, podWarheadR);
    missilePods.visible = false;
    torso.add(missilePods);

    // 2. Dorsal Viper Rail-Lance Cannon
    const railLance = new THREE.Group();
    const railBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.9), hullMat);
    railBase.position.set(0, 0.76, -0.1);
    const railBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 1.55), cyanEmissive);
    railBarrel.position.set(0, 0.78, 0.48);
    railLance.add(railBase, railBarrel);
    railLance.visible = false;
    torso.add(railLance);

    // Jetpack & Thruster Plumes
    const jetpack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.54, 0.36), hullMat);
    jetpack.position.set(0, 0.1, -0.46);
    torso.add(jetpack);

    const thrusterFlameGeo = new THREE.ConeGeometry(0.16, 0.75, 8);
    thrusterFlameGeo.rotateX(-Math.PI / 2);
    const flameL = new THREE.Mesh(thrusterFlameGeo, cyanEmissive);
    flameL.position.set(-0.2, 0.0, -0.85);
    const flameR = flameL.clone();
    flameR.position.x = 0.2;
    torso.add(flameL, flameR);

    // EMP Dash-Parry Dome Shield (Flashes on Dash / Parry)
    const shieldGeo = new THREE.IcosahedronGeometry(1.55, 1);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const shieldDome = new THREE.Mesh(shieldGeo, shieldMat);
    shieldDome.position.y = 1.05;
    root.add(shieldDome);

    // Orbiting Autonomous Tesla Drones Group
    const droneOrbitGroup = new THREE.Group();
    droneOrbitGroup.position.y = 1.35;
    root.add(droneOrbitGroup);

    return {
      root,
      torso,
      legL,
      legR,
      armL,
      armR,
      flameL,
      flameR,
      missilePods,
      railLance,
      shieldDome,
      shieldMat,
      droneOrbitGroup,
      baseRing
    };
  }

  /**
   * Creates an Orbiting Autonomous Tesla Drone mesh for the player's drone hardpoint.
   */
  createDroneMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: 0x1b2838, metalness: 0.7, roughness: 0.2 })
    );
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0x00ff9d })
    );
    core.position.y = 0.05;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 6),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(body, core, ring);
    return g;
  }

  /**
   * Builds the multi-colored composite BufferGeometries for the 4 instanced enemy archetypes:
   * 0: Scarab Swarm-Bot
   * 1: Goliath Siege-Walker (Bruiser)
   * 2: Viper Rail-Tripod (Sniper)
   * 3: Tick-Bomber (Volatile Kamikaze)
   */
  createEnemyArchetypeGeometries() {
    // 0: SCARAB SWARM-BOT (Fast 4-legged cyber-beetle with neon magenta visor)
    const swarmerGeo = buildColoredCompositeGeometry([
      // Carapace hull
      { geo: transformedBox(0.78, 0.36, 0.88, 0, 0.38, 0), color: 0x3b4d6e },
      // Upper armor ridge
      { geo: transformedBox(0.54, 0.18, 0.64, 0, 0.57, -0.04), color: 0x647ea8 },
      // Glowing Magenta Visor Eye & Core
      { geo: transformedBox(0.62, 0.18, 0.28, 0, 0.43, 0.36), color: 0xff1e6b },
      { geo: transformedBox(0.32, 0.14, 0.45, 0, 0.65, -0.05), color: 0xff5c97 },
      // 4 Angled Skittering Legs
      { geo: transformedBox(0.15, 0.44, 0.15, -0.45, 0.22, 0.26, 0, 0, 0.35), color: 0x28344a },
      { geo: transformedBox(0.15, 0.44, 0.15, 0.45, 0.22, 0.26, 0, 0, -0.35), color: 0x28344a },
      { geo: transformedBox(0.15, 0.44, 0.15, -0.45, 0.22, -0.26, 0, 0, 0.35), color: 0x28344a },
      { geo: transformedBox(0.15, 0.44, 0.15, 0.45, 0.22, -0.26, 0, 0, -0.35), color: 0x28344a }
    ]);

    // 1: GOLIATH SIEGE-WALKER (Heavy armored bruiser with glowing amber furnace core)
    const bruiserGeo = buildColoredCompositeGeometry([
      // Legs
      { geo: transformedBox(0.38, 0.75, 0.42, -0.42, 0.38, 0), color: 0x38465e },
      { geo: transformedBox(0.38, 0.75, 0.42, 0.42, 0.38, 0), color: 0x38465e },
      // Hulking Torso
      { geo: transformedBox(1.35, 1.05, 0.95, 0, 1.15, 0), color: 0x5c7094 },
      // Heavy Pauldrons
      { geo: transformedBox(0.46, 0.6, 0.84, -0.82, 1.38, 0, 0, 0, 0.15), color: 0x869ec4 },
      { geo: transformedBox(0.46, 0.6, 0.84, 0.82, 1.38, 0, 0, 0, -0.15), color: 0x869ec4 },
      // Glowing Amber Furnace Core & Visor Slit
      { geo: transformedBox(0.68, 0.44, 0.25, 0, 1.15, 0.42), color: 0xffb700 },
      { geo: transformedBox(0.58, 0.18, 0.26, 0, 1.54, 0.38), color: 0xff3b00 },
      // Dual Siege Fist Rams
      { geo: transformedBox(0.38, 0.38, 0.88, -0.85, 0.85, 0.35), color: 0x2d384c },
      { geo: transformedBox(0.38, 0.38, 0.88, 0.85, 0.85, 0.35), color: 0x2d384c }
    ]);

    // 2: VIPER RAIL-TRIPOD (Long-range sniper mech with neon purple/cyan rail barrel)
    const sniperGeo = buildColoredCompositeGeometry([
      // Tripod Struts
      { geo: transformedBox(0.17, 0.95, 0.17, -0.4, 0.45, -0.3, 0.25, 0, 0.3), color: 0x374663 },
      { geo: transformedBox(0.17, 0.95, 0.17, 0.4, 0.45, -0.3, 0.25, 0, -0.3), color: 0x374663 },
      { geo: transformedBox(0.17, 0.95, 0.17, 0, 0.45, 0.42, -0.32, 0, 0), color: 0x374663 },
      // Turret Housing
      { geo: transformedBox(0.7, 0.54, 0.84, 0, 1.05, 0), color: 0x566c96 },
      // Long Sniper Rail Barrel
      { geo: transformedBox(0.18, 0.2, 1.58, 0, 1.06, 0.72), color: 0xd442ff },
      // Neon Optic Lens
      { geo: transformedBox(0.4, 0.24, 0.24, 0, 1.28, 0.38), color: 0x00f0ff }
    ]);

    // 3: VOLATILE TICK-BOMBER (Unstable plasma walker with glowing acid-green/orange dome)
    const bomberGeo = buildColoredCompositeGeometry([
      // Base ring
      { geo: transformedBox(0.68, 0.24, 0.68, 0, 0.25, 0), color: 0x3a475e },
      // Unstable Plasma Payload Core
      { geo: transformedCylinder(0.4, 0.44, 0.54, 8, 0, 0.56, 0), color: 0x00ff9d },
      { geo: transformedBox(0.54, 0.24, 0.54, 0, 0.78, 0, 0, Math.PI / 4, 0), color: 0xff6600 },
      // Skitter legs
      { geo: transformedBox(0.98, 0.16, 0.18, 0, 0.16, 0, 0, Math.PI / 4, 0), color: 0x263142 },
      { geo: transformedBox(0.98, 0.16, 0.18, 0, 0.16, 0, 0, -Math.PI / 4, 0), color: 0x263142 }
    ]);

    return {
      swarmerGeo,
      bruiserGeo,
      sniperGeo,
      bomberGeo
    };
  }

  /**
   * Creates an Elite Mini-Boss (APEX DREADNOUGHT) hierarchical 3D rig.
   */
  createBossMesh() {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1f1429,
      metalness: 0.7,
      roughness: 0.28
    });
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x4a235a,
      metalness: 0.5,
      roughness: 0.3
    });
    const magentaCore = new THREE.MeshBasicMaterial({ color: 0xff1e6b });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    // Boss Ground Warning Ring
    const ringGeo = new THREE.RingGeometry(2.3, 2.55, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff1e6b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });
    const warningRing = new THREE.Mesh(ringGeo, ringMat);
    warningRing.position.y = 0.04;
    group.add(warningRing);

    // Heavy Quad-Legs Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 2.4), hullMat);
    base.position.y = 0.65;
    group.add(base);

    // Main Dreadnought Citadel Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 1.8), plateMat);
    torso.position.y = 1.85;
    group.add(torso);

    // Glowing Reactor Core
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), magentaCore);
    core.position.set(0, 1.85, 0.65);
    group.add(core);

    // Twin Heavy Siege Plasma Cannons
    const cannonL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 2.2), hullMat);
    cannonL.position.set(-1.35, 2.0, 0.5);
    const muzzleL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.4), cyanGlow);
    muzzleL.position.set(-1.35, 2.0, 1.65);

    const cannonR = cannonL.clone();
    cannonR.position.x = 1.35;
    const muzzleR = muzzleL.clone();
    muzzleR.position.x = 1.35;
    group.add(cannonL, muzzleL, cannonR, muzzleR);

    // Orbiting Shield Pylons
    const shieldRing = new THREE.Group();
    shieldRing.position.y = 1.6;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), cyanGlow);
      pylon.position.set(Math.cos(angle) * 2.1, 0, Math.sin(angle) * 2.1);
      shieldRing.add(pylon);
    }
    group.add(shieldRing);

    return { group, core, shieldRing, warningRing };
  }

  /**
   * Builds the Sector Zero Cyber-Industrial Reactor Deck Environment.
   */
  createReactorEnvironment(scene, arenaHalfSize = 64) {
    // 1. Procedural High-Contrast Hexagonal Cyber-Grid Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep carbon steel background
    ctx.fillStyle = '#090d18';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle sub-grid
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.09)';
    ctx.lineWidth = 2;
    const step = 64;
    for (let i = 0; i <= 512; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Glowing diagonal circuit traces & corner nodes
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.14)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 504);

    ctx.fillStyle = 'rgba(0, 212, 255, 0.28)';
    for (let x = 0; x <= 512; x += 128) {
      for (let y = 0; y <= 512; y += 128) {
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
    }

    const floorTex = new THREE.CanvasTexture(canvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(22, 22);
    floorTex.anisotropy = 8;

    const floorGeo = new THREE.PlaneGeometry(arenaHalfSize * 2.4, arenaHalfSize * 2.4);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.45,
      metalness: 0.55
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 2. Laser Containment Perimeter Fence at +/- arenaHalfSize
    const borderGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(arenaHalfSize * 2, 1.4, arenaHalfSize * 2)
    );
    const borderMat = new THREE.LineBasicMaterial({ color: 0xff1e6b });
    const borderLines = new THREE.LineSegments(borderGeo, borderMat);
    borderLines.position.y = 0.7;
    scene.add(borderLines);

    // 3. Reactor Pylons scattered across the arena (Obstacle/Visual Landmarks)
    const pylonGroup = new THREE.Group();
    const pylonBodyMat = new THREE.MeshStandardMaterial({
      color: 0x161f30,
      metalness: 0.7,
      roughness: 0.3
    });
    const pylonGlowMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });

    const pylonPositions = [
      [-24, -24], [24, -24], [-24, 24], [24, 24],
      [-46, 0], [46, 0], [0, -46], [0, 46],
      [-46, -46], [46, -46], [-46, 46], [46, 46]
    ];

    const pylons = [];
    for (const [px, pz] of pylonPositions) {
      const g = new THREE.Group();
      g.position.set(px, 0, pz);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.6, 6), pylonBodyMat);
      base.position.y = 0.3;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 3.6, 6), pylonBodyMat);
      tower.position.y = 2.1;
      tower.castShadow = true;

      const coreRing = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.7, 6), pylonGlowMat);
      coreRing.position.y = 2.4;

      g.add(base, tower, coreRing);
      pylonGroup.add(g);
      pylons.push({ x: px, z: pz, radius: 1.45, mesh: g, coreRing });
    }
    scene.add(pylonGroup);

    return { floorMesh, borderLines, pylons, pylonGlowMat };
  }
}
