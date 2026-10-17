import * as THREE from 'three';
import { SoundEngine } from './audio.js';
import { AssetManager } from './assets.js';
import { SpatialHashGrid } from './spatialGrid.js';
import { VFXManager } from './vfx.js';
import { WEAPON_DEFS, PASSIVE_DEFS, SYNERGY_INFO, UpgradeSystem } from './upgrades.js';

// ==================== ENGINE CONSTANTS ====================
const ARENA_HALF_SIZE = 62;
const MAX_ENEMIES = 850;
const MAX_PROJECTILES = 500;
const MAX_GEMS = 650;
const MAX_AFTERIMAGES = 14;

// Isometric Camera Configuration (Equal Angle Orthographic Projection)
const FRUSTUM_SIZE = 30;
const ISO_DIST = 34; // camera positioned at (target.x + 34, 34, target.z + 34)

// Camera-Aligned Isometric Movement Vectors
// Since camera looks from (+1, +1, +1) toward (0, 0, 0):
// Screen UP = (-1, 0, -1), Screen DOWN = (+1, 0, +1), Screen LEFT = (-1, 0, +1), Screen RIGHT = (+1, 0, -1)
const INV_SQRT2 = Math.SQRT1_2;

class NeonOverdriveGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.fctContainer = document.getElementById('fct-container');
    this.screenFx = document.getElementById('screen-fx');

    this.audio = new SoundEngine();
    this.assets = new AssetManager();
    this.spatialGrid = new SpatialHashGrid(4.0);

    // Game State
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'LEVEL_UP' | 'PAUSED' | 'GAME_OVER'
    this.elapsedTime = 0;
    this.hitStopTimer = 0;
    this.screenShake = 0;
    this.rerollsLeft = 2;

    // Input State
    this.keys = new Set();
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.aimWorldPoint = new THREE.Vector3(0, 0, 8);
    this.autoAimPrimary = false; // Toggleable with [Q]

    // FPS & Telemetry
    this.frameCount = 0;
    this.fpsTimer = 0;
    this.currentFps = 60;

    // Scratch Math Objects (Zero-GC)
    this._mat4 = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._scale = new THREE.Vector3();
    this._euler = new THREE.Euler();
    this._color = new THREE.Color();
    this._raycaster = new THREE.Raycaster();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
    this._queryBuffer = [];

    this._initThree();
    this._initEnvironmentAndAssets();
    this._initInstancedPools();
    this._initPlayerState();
    this._bindEvents();
    this._startLoop();
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060811);
    this.scene.fog = new THREE.FogExp2(0x060811, 0.0065);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      (-FRUSTUM_SIZE * aspect) / 2,
      (FRUSTUM_SIZE * aspect) / 2,
      FRUSTUM_SIZE / 2,
      -FRUSTUM_SIZE / 2,
      0.1,
      260
    );

    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.camera.position.set(ISO_DIST, ISO_DIST, ISO_DIST);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.container.appendChild(this.renderer.domElement);

    // Cyber-Industrial Lighting Palette
    const ambient = new THREE.HemisphereLight(0x6b96ff, 0x1b102e, 2.15);
    this.scene.add(ambient);

    this.dirLight = new THREE.DirectionalLight(0xe6f6ff, 2.55);
    this.dirLight.position.set(28, 48, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    const d = 32;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 110;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Player Mech Accent Point Light
    this.playerLight = new THREE.PointLight(0x00d4ff, 3.5, 16, 1.5);
    this.playerLight.position.set(0, 2.4, 0);
    this.scene.add(this.playerLight);

    this.vfx = new VFXManager(this.scene, this.fctContainer);
  }

  _initEnvironmentAndAssets() {
    this.env = this.assets.createReactorEnvironment(this.scene, ARENA_HALF_SIZE);
    this.playerRig = this.assets.createPlayerMech();
    this.scene.add(this.playerRig.root);

    // 3D Laser Aim Reticle on Ground + Sight Line
    const reticleGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.68, 24),
      new THREE.MeshBasicMaterial({ color: 0x00ff9d, side: THREE.DoubleSide })
    );
    outerRing.rotation.x = -Math.PI / 2;
    const innerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff1e6b, side: THREE.DoubleSide })
    );
    innerDot.rotation.x = -Math.PI / 2;
    innerDot.position.y = 0.01;
    reticleGroup.add(outerRing, innerDot);
    reticleGroup.position.y = 0.05;
    this.reticle = reticleGroup;
    this.scene.add(this.reticle);

    // Subtle Laser Sight Line from Mech to Cursor
    const sightGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1.0, 0),
      new THREE.Vector3(0, 1.0, 5)
    ]);
    const sightMat = new THREE.LineBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.32
    });
    this.sightLine = new THREE.Line(sightGeo, sightMat);
    this.scene.add(this.sightLine);

    // Dash Hologram Afterimages Pool
    this.afterimages = [];
    const ghostGeo = new THREE.BoxGeometry(0.95, 1.4, 0.75);
    for (let i = 0; i < MAX_AFTERIMAGES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(ghostGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.afterimages.push({ active: false, mesh, mat, life: 0, maxLife: 0.35 });
    }

    // Async Preload Optional GLB Assets (Non-blocking)
    this.assets.preloadAssets().then((status) => {
      const el = document.getElementById('hud-asset-status');
      if (el) el.textContent = status;
    });
  }

  _initInstancedPools() {
    // 1. Enemy Archetype Instanced Meshes (4 Archetypes + Shared Ground Shadow InstancedMesh)
    const geos = this.assets.createEnemyArchetypeGeometries();
    const enemyMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.18
    });

    this.enemyArchetypeMeshes = [
      new THREE.InstancedMesh(geos.swarmerGeo, enemyMat, MAX_ENEMIES),
      new THREE.InstancedMesh(geos.bruiserGeo, enemyMat, MAX_ENEMIES),
      new THREE.InstancedMesh(geos.sniperGeo, enemyMat, MAX_ENEMIES),
      new THREE.InstancedMesh(geos.bomberGeo, enemyMat, MAX_ENEMIES)
    ];

    for (const im of this.enemyArchetypeMeshes) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Shared Enemy Ground Drop Shadows
    const shadowGeo = new THREE.CircleGeometry(0.75, 12);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    this.enemyShadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, MAX_ENEMIES);
    this.enemyShadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyShadowMesh.frustumCulled = false;
    this.scene.add(this.enemyShadowMesh);

    // Elite Mini-Boss Hierarchical Mesh Pool (up to 3 simultaneous bosses)
    this.bossRigs = [];
    for (let i = 0; i < 3; i++) {
      const rig = this.assets.createBossMesh();
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.bossRigs.push({ inUse: false, ...rig });
    }

    this.enemies = [];
    for (let i = 0; i < MAX_ENEMIES; i++) {
      this.enemies.push({
        id: i,
        active: false,
        type: 0, // 0: Swarmer, 1: Bruiser, 2: Sniper, 3: Bomber, 4: Boss
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        rotY: 0,
        radius: 0.65,
        hp: 30,
        maxHp: 30,
        speed: 5.5,
        damage: 12,
        xpValue: 15,
        threatWeight: 1.0,
        hitFlash: 0,
        slowTimer: 0,
        stunTimer: 0,
        attackTimer: 0,
        phaseOffset: Math.random() * Math.PI * 2,
        bossRig: null
      });
    }

    // 2. Projectile InstancedMesh Pool (Player Bolts, Missiles, Enemy Plasma Orbs, Parried Bolts)
    const projGeo = new THREE.BoxGeometry(0.24, 0.24, 0.95);
    const projMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.projectileMesh = new THREE.InstancedMesh(projGeo, projMat, MAX_PROJECTILES);
    this.projectileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileMesh.frustumCulled = false;
    this.scene.add(this.projectileMesh);

    this.projectiles = [];
    this._mat4.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectileMesh.setMatrixAt(i, this._mat4);
      this.projectileMesh.setColorAt(i, this._color.setHex(0x00f0ff));
      this.projectiles.push({
        id: i,
        active: false,
        isEnemy: false,
        isParried: false,
        kind: 'vulcan', // 'vulcan' | 'missile' | 'enemy_orb' | 'parried'
        x: 0,
        y: 0.9,
        z: 0,
        vx: 0,
        vz: 0,
        radius: 0.35,
        damage: 20,
        pierce: 1,
        aoeRadius: 0,
        life: 0,
        colorHex: 0x00f0ff,
        scaleX: 1,
        scaleZ: 1,
        lastHitEnemyId: -1,
        targetEnemy: null
      });
    }

    // 3. Data Shards (XP Gems) InstancedMesh Pool
    const gemGeo = new THREE.OctahedronGeometry(0.32, 0);
    const gemMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.gemMesh = new THREE.InstancedMesh(gemGeo, gemMat, MAX_GEMS);
    this.gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gemMesh.frustumCulled = false;
    this.scene.add(this.gemMesh);

    this.gems = [];
    for (let i = 0; i < MAX_GEMS; i++) {
      this.gemMesh.setMatrixAt(i, this._mat4);
      this.gemMesh.setColorAt(i, this._color.setHex(0x00ff9d));
      this.gems.push({
        id: i,
        active: false,
        x: 0,
        z: 0,
        value: 15,
        isVacuumCore: false,
        isHealCore: false,
        magnetized: false,
        colorHex: 0x00ff9d,
        scale: 1.0
      });
    }
  }

  _initPlayerState() {
    this.player = {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      aimAngle: 0,
      walkCycle: 0,
      radius: 0.75,

      // Vitals & Leveling
      hp: 120,
      maxHp: 120,
      hpRegen: 0.5,
      level: 1,
      xp: 0,
      xpToNext: 80,
      xpMultiplier: 1.0,
      pickupRadius: 4.5,

      // Movement & EMP Dash-Parry
      moveSpeed: 9.8,
      dashCharges: 2,
      maxDashCharges: 2,
      dashCooldown: 2.2,
      dashRechargeTimer: 0,
      dashActiveTimer: 0,
      dashDirX: 0,
      dashDirZ: 1,
      iFrameTimer: 0,
      parryRadius: 2.75,
      parryDamageMultiplier: 2.5,
      parryHeal: 0,
      parryCount: 0,
      overdriveHasteTimer: 0,

      // Combat Multipliers
      damageMultiplier: 1.0,
      fireRateMultiplier: 1.0,
      critChance: 0.12,
      critMultiplier: 1.85,
      bonusProjectiles: 0,
      corruption: 0,

      // Synergies
      tagCounts: { PLASMA: 1, BALLISTIC: 1, CRYO: 0, NANO: 0 },
      synergyDamageBonus: 1.0,
      synergyProjSpeedBonus: 1.0,
      synergyCryoBonus: 1.0,

      // Hardpoints & Passives
      weapons: {
        vulcan: 1,
        missiles: 0,
        drone: 0,
        cryo: 0,
        railgun: 0
      },
      passives: {},
      corruptedPerks: {},

      // Weapon Cooldown Timers
      timers: {
        vulcan: 0,
        missiles: 0,
        droneArc: 0,
        cryo: 0,
        railgun: 0
      },

      // Telemetry
      kills: 0,
      totalDamageDealt: 0,
      gemCombo: 0,
      gemComboTimer: 0
    };

    this.upgradeSystem = new UpgradeSystem(this.player);
    this.droneMeshes = [];

    // Wave / Horde Director State
    this.wave = {
      number: 1,
      spawnTimer: 0,
      bossSpawnTimer: 55, // First Elite Boss at 55s
      activeEnemiesCount: 0,
      activeBoss: null
    };
  }

  resetRun() {
    // Clear pools
    this._mat4.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_ENEMIES; i++) {
      this.enemies[i].active = false;
      this.enemyShadowMesh.setMatrixAt(i, this._mat4);
      for (const im of this.enemyArchetypeMeshes) {
        im.setMatrixAt(i, this._mat4);
      }
    }
    for (const b of this.bossRigs) {
      b.inUse = false;
      b.group.visible = false;
    }
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles[i].active = false;
      this.projectileMesh.setMatrixAt(i, this._mat4);
    }
    for (let i = 0; i < MAX_GEMS; i++) {
      this.gems[i].active = false;
      this.gemMesh.setMatrixAt(i, this._mat4);
    }

    this.enemyShadowMesh.instanceMatrix.needsUpdate = true;
    for (const im of this.enemyArchetypeMeshes) im.instanceMatrix.needsUpdate = true;
    this.projectileMesh.instanceMatrix.needsUpdate = true;
    this.gemMesh.instanceMatrix.needsUpdate = true;

    // Clear Drone meshes
    for (const dm of this.droneMeshes) {
      this.playerRig.droneOrbitGroup.remove(dm);
    }
    this.droneMeshes.length = 0;
    this.playerRig.missilePods.visible = false;
    this.playerRig.railLance.visible = false;

    this._initPlayerState();
    this.elapsedTime = 0;
    this.rerollsLeft = 2;
    this.playerRig.root.position.set(0, 0, 0);
    this.cameraTarget.set(0, 0, 0);

    // Spawn initial perimeter wave so action begins immediately
    this.spawnWaveBurst(28, false);
    this.updateHUD();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);

      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        if (this.state === 'PLAYING') {
          e.preventDefault();
          this.triggerDash();
        }
      } else if (code === 'KeyQ' && this.state === 'PLAYING') {
        this.toggleAimMode();
      } else if (code === 'KeyB' && this.state === 'PLAYING') {
        this.triggerSwarmSurge(200);
      } else if (code === 'KeyM') {
        this.toggleAudio();
      } else if (code === 'KeyR' && this.state === 'LEVEL_UP') {
        this.rerollUpgrades();
      } else if (code === 'Escape') {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.state === 'PLAYING') {
        this.triggerDash();
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 2 && this.state === 'PLAYING') {
        this.triggerDash();
      }
    });

    // UI Buttons
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init();
      document.getElementById('start-modal').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      this.resetRun();
      this.state = 'PLAYING';
    });

    document.getElementById('btn-aim-mode').addEventListener('click', () => this.toggleAimMode());
    document.getElementById('btn-swarm-surge').addEventListener('click', () => this.triggerSwarmSurge(200));
    document.getElementById('btn-audio-toggle').addEventListener('click', () => this.toggleAudio());
    document.getElementById('btn-reroll').addEventListener('click', () => this.rerollUpgrades());

    document.getElementById('btn-resume-game').addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-restart-game').addEventListener('click', () => {
      document.getElementById('gameover-modal').classList.add('hidden');
      this.resetRun();
      this.state = 'PLAYING';
    });
  }

  toggleAimMode() {
    this.autoAimPrimary = !this.autoAimPrimary;
    const btn = document.getElementById('btn-aim-mode');
    btn.textContent = this.autoAimPrimary ? '[Q] AIM: AUTO-LOCK' : '[Q] AIM: CURSOR';
    btn.classList.toggle('active', !this.autoAimPrimary);
  }

  toggleAudio() {
    const on = this.audio.toggleMute();
    const btn = document.getElementById('btn-audio-toggle');
    btn.textContent = on ? '[M] AUDIO: ON' : '[M] AUDIO: MUTED';
    btn.classList.toggle('active', on);
  }

  triggerSwarmSurge(count = 200) {
    if (this.state !== 'PLAYING') return;
    this.spawnWaveBurst(count, true);
    this.vfx.spawnFloatingText(
      this.player.x,
      2.6,
      this.player.z,
      `⚠ +${count} SWARM SURGE DEPLOYED!`,
      '#ff1e6b',
      1.35,
      1.1
    );
    this.audio.playBossAlert();
    this.screenShake = Math.max(this.screenShake, 0.45);
  }

  _onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = (-FRUSTUM_SIZE * aspect) / 2;
    this.camera.right = (FRUSTUM_SIZE * aspect) / 2;
    this.camera.top = FRUSTUM_SIZE / 2;
    this.camera.bottom = -FRUSTUM_SIZE / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ==================== PLAYER MOVEMENT & EMP DASH-PARRY ====================
  triggerDash() {
    const p = this.player;
    if (p.dashCharges <= 0 || p.dashActiveTimer > 0) return;

    p.dashCharges--;
    p.dashActiveTimer = 0.22;
    p.iFrameTimer = 0.34;

    // Dash in current movement direction, or toward aim direction if stationary
    const moveLen = Math.hypot(p.vx, p.vz);
    if (moveLen > 0.1) {
      p.dashDirX = p.vx / moveLen;
      p.dashDirZ = p.vz / moveLen;
    } else {
      p.dashDirX = Math.sin(p.aimAngle);
      p.dashDirZ = Math.cos(p.aimAngle);
    }

    this.audio.playDash();
    this.playerRig.shieldMat.color.setHex(0x00f0ff);
    this.playerRig.shieldMat.opacity = 0.55;
    this.vfx.spawnBurst(p.x, 0.9, p.z, 0x00d4ff, 14, 7.5, 1.0);
  }

  _spawnDashAfterimage(x, z, rotY) {
    const slot = this.afterimages.find((a) => !a.active) || this.afterimages[0];
    slot.active = true;
    slot.life = 0.28;
    slot.maxLife = 0.28;
    slot.mesh.position.set(x, 1.0, z);
    slot.mesh.rotation.y = rotY;
    slot.mat.opacity = 0.55;
    slot.mesh.visible = true;
  }

  /**
   * Checks for enemy projectiles or charging enemies inside the player's EMP Dash-Parry window.
   */
  _checkEmpDashParry() {
    const p = this.player;
    let parriedCount = 0;
    const parryRadSq = p.parryRadius * p.parryRadius;

    // 1. Deflect Enemy Plasma Projectiles within parry radius
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || !proj.isEnemy) continue;

      const dx = proj.x - p.x;
      const dz = proj.z - p.z;
      if (dx * dx + dz * dz <= parryRadSq) {
        proj.isEnemy = false;
        proj.isParried = true;
        proj.kind = 'parried';
        proj.pierce = 4;
        proj.damage = 95 * p.damageMultiplier * p.parryDamageMultiplier;
        proj.life = 1.8;
        proj.colorHex = 0xff1e6b;
        proj.scaleX = 1.8;
        proj.scaleZ = 1.8;
        this.projectileMesh.setColorAt(proj.id, this._color.setHex(0x00ff9d));

        // Aim deflected bolt at nearest high-threat enemy, or reverse its velocity
        const target = this.spatialGrid.findBestTarget(p.x, p.z, 26, true);
        const speed = 34.0;
        if (target) {
          const tx = target.x - proj.x;
          const tz = target.z - proj.z;
          const dist = Math.hypot(tx, tz) || 1;
          proj.vx = (tx / dist) * speed;
          proj.vz = (tz / dist) * speed;
        } else {
          const curSpd = Math.hypot(proj.vx, proj.vz) || 1;
          proj.vx = (-proj.vx / curSpd) * speed;
          proj.vz = (-proj.vz / curSpd) * speed;
        }

        parriedCount++;
      }
    }

    // 2. Also allow Dash-Parry when dashing directly through an enemy Sniper/Bruiser/Bomber/Boss
    const nearbyEnemies = this.spatialGrid.queryRadius(p.x, p.z, p.parryRadius * 0.85, this._queryBuffer);
    for (let i = 0; i < nearbyEnemies.length; i++) {
      const e = nearbyEnemies[i];
      if (e.stunTimer <= 0 && (e.type >= 1 || parriedCount > 0)) {
        parriedCount++;
        break;
      }
    }

    if (parriedCount > 0) {
      this._executeEmpParryBlast(parriedCount);
    }
  }

  _executeEmpParryBlast(parriedCount) {
    const p = this.player;
    p.parryCount += parriedCount;

    // Refund 45% of a dash charge & grant brief overdrive fire-rate haste
    p.dashCharges = Math.min(p.maxDashCharges, p.dashCharges + 1);
    p.overdriveHasteTimer = 3.0;

    if (p.parryHeal > 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.parryHeal);
    }

    // EMP Nova AoE stun & damage around player
    const empRadius = p.parryRadius * 2.4;
    const empDamage = 65 * p.damageMultiplier * p.parryDamageMultiplier;
    const victims = this.spatialGrid.queryRadius(p.x, p.z, empRadius, this._queryBuffer);

    for (let i = 0; i < victims.length; i++) {
      const e = victims[i];
      e.stunTimer = Math.max(e.stunTimer, 1.8);
      this.damageEnemy(e, empDamage, true, 0x00ff9d);
    }

    // Audio & Visual Juice
    this.audio.playDashParry();
    this.hitStopTimer = 0.045; // Crisp 45ms tactile freeze-frame
    this.screenShake = Math.max(this.screenShake, 0.55);
    this.playerRig.shieldMat.color.setHex(0x00ff9d);
    this.playerRig.shieldMat.opacity = 0.95;

    this.vfx.spawnShockwave(p.x, p.z, 0x00ff9d, empRadius, 0.42);
    this.vfx.spawnShockwave(p.x, p.z, 0x00d4ff, empRadius * 0.7, 0.3);
    this.vfx.spawnBurst(p.x, 1.1, p.z, 0x00ff9d, 26, 12.0, 1.3);
    this.vfx.spawnFloatingText(
      p.x,
      2.4,
      p.z,
      `⚡ EMP DASH-PARRY!`,
      '#00ff9d',
      1.35,
      0.85
    );

    this.screenFx.classList.add('parry-flash');
    setTimeout(() => this.screenFx.classList.remove('parry-flash'), 160);
    if (this.projectileMesh.instanceColor) {
      this.projectileMesh.instanceColor.needsUpdate = true;
    }
  }

  updatePlayer(dt) {
    const p = this.player;

    // Hull Regeneration
    if (p.hpRegen > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.hpRegen * dt);
    }

    // Timers
    if (p.iFrameTimer > 0) p.iFrameTimer -= dt;
    if (p.overdriveHasteTimer > 0) p.overdriveHasteTimer -= dt;
    if (p.gemComboTimer > 0) {
      p.gemComboTimer -= dt;
      if (p.gemComboTimer <= 0) p.gemCombo = 0;
    }

    // Dash Charge Regeneration
    if (p.dashCharges < p.maxDashCharges) {
      p.dashRechargeTimer += dt;
      if (p.dashRechargeTimer >= p.dashCooldown) {
        p.dashRechargeTimer -= p.dashCooldown;
        p.dashCharges++;
      }
    } else {
      p.dashRechargeTimer = 0;
    }

    // 8-Direction Camera-Aligned Isometric Input
    let inX = 0;
    let inY = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inY += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inY -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inX += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inX -= 1;

    // Convert (inX, inY) screen input to isometric world (wx, wz):
    // Up (+inY) = (-1, -1), Right (+inX) = (+1, -1)
    let wx = (inX - inY) * INV_SQRT2;
    let wz = (-inX - inY) * INV_SQRT2;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }

    if (p.dashActiveTimer > 0) {
      p.dashActiveTimer -= dt;
      const dashSpeed = p.moveSpeed * 2.85;
      p.vx = p.dashDirX * dashSpeed;
      p.vz = p.dashDirZ * dashSpeed;

      // Spawn holographic trail afterimage
      if (Math.random() < 0.65) {
        this._spawnDashAfterimage(p.x, p.z, p.aimAngle);
      }

      // Check EMP Dash-Parry collisions
      this._checkEmpDashParry();
    } else {
      const accel = 16.0;
      const targetVx = wx * p.moveSpeed;
      const targetVz = wz * p.moveSpeed;
      p.vx += (targetVx - p.vx) * Math.min(1, accel * dt);
      p.vz += (targetVz - p.vz) * Math.min(1, accel * dt);
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Pylon Obstacle Soft Collision
    for (const pylon of this.env.pylons) {
      const dx = p.x - pylon.x;
      const dz = p.z - pylon.z;
      const dist = Math.hypot(dx, dz);
      const minDist = p.radius + pylon.radius;
      if (dist < minDist && dist > 0.001) {
        const push = (minDist - dist) / dist;
        p.x += dx * push;
        p.z += dz * push;
      }
    }

    // Clamp to Sector Zero Reactor Arena Boundary
    const bound = ARENA_HALF_SIZE - 1.2;
    p.x = Math.max(-bound, Math.min(bound, p.x));
    p.z = Math.max(-bound, Math.min(bound, p.z));

    // Raycast Mouse Cursor onto Invisible Ground Plane
    this._raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this.aimWorldPoint);
    if (!hit) {
      this.aimWorldPoint.set(p.x, 0.9, p.z + 6);
    }

    // Determine Torso Aim Angle
    if (this.autoAimPrimary) {
      const target = this.spatialGrid.findBestTarget(p.x, p.z, 22, true);
      if (target) {
        p.aimAngle = Math.atan2(target.x - p.x, target.z - p.z);
        this.reticle.position.set(target.x, 0.05, target.z);
      } else if (len > 0.1) {
        p.aimAngle = Math.atan2(wx, wz);
        this.reticle.position.set(p.x + wx * 6, 0.05, p.z + wz * 6);
      }
    } else {
      const ax = this.aimWorldPoint.x - p.x;
      const az = this.aimWorldPoint.z - p.z;
      if (ax * ax + az * az > 0.04) {
        p.aimAngle = Math.atan2(ax, az);
      }
      this.reticle.position.set(this.aimWorldPoint.x, 0.05, this.aimWorldPoint.z);
    }

    this.reticle.rotation.y += dt * 2.5;

    // Update Sight Line
    const sightPos = this.sightLine.geometry.attributes.position;
    sightPos.setXYZ(0, p.x, 1.05, p.z);
    sightPos.setXYZ(1, this.reticle.position.x, 0.2, this.reticle.position.z);
    sightPos.needsUpdate = true;

    // Update 3D Player Mech Rig & Procedural Walk Animation
    this.playerRig.root.position.set(p.x, 0, p.z);
    this.playerRig.torso.rotation.y = p.aimAngle;

    const speedMag = Math.hypot(p.vx, p.vz);
    if (speedMag > 0.4) {
      p.walkCycle += dt * speedMag * 1.45;
      const swing = Math.sin(p.walkCycle) * 0.55;
      this.playerRig.legL.rotation.x = swing;
      this.playerRig.legR.rotation.x = -swing;
      const legHeading = Math.atan2(p.vx, p.vz);
      this.playerRig.legL.rotation.y = legHeading;
      this.playerRig.legR.rotation.y = legHeading;
      this.playerRig.torso.position.y = 1.05 + Math.abs(Math.cos(p.walkCycle)) * 0.08;
    } else {
      this.playerRig.legL.rotation.x *= 0.85;
      this.playerRig.legR.rotation.x *= 0.85;
      this.playerRig.torso.position.y = 1.05 + Math.sin(this.elapsedTime * 3.5) * 0.03;
    }

    // Thruster Plume Scale
    const flameScale = p.dashActiveTimer > 0 ? 2.2 : 0.7 + (speedMag / p.moveSpeed) * 0.6;
    this.playerRig.flameL.scale.set(1, flameScale, 1);
    this.playerRig.flameR.scale.set(1, flameScale, 1);

    // Shield Dome Decay
    if (this.playerRig.shieldMat.opacity > 0.01) {
      this.playerRig.shieldMat.opacity = Math.max(0, this.playerRig.shieldMat.opacity - dt * 2.2);
      this.playerRig.shieldDome.rotation.y += dt * 4.0;
    }

    // Update Dash Afterimages
    for (const ghost of this.afterimages) {
      if (!ghost.active) continue;
      ghost.life -= dt;
      if (ghost.life <= 0) {
        ghost.active = false;
        ghost.mesh.visible = false;
      } else {
        ghost.mat.opacity = (ghost.life / ghost.maxLife) * 0.5;
      }
    }

    // Sync Light Position
    this.playerLight.position.set(p.x, 2.8, p.z);
    this.dirLight.position.set(p.x + 28, 48, p.z + 22);
    this.dirLight.target.position.set(p.x, 0, p.z);
  }

  // ==================== MODULAR HARDPOINT WEAPONS & COMBAT ====================
  updateWeapons(dt) {
    const p = this.player;
    const hasteMult = (p.overdriveHasteTimer > 0 ? 1.35 : 1.0) * p.fireRateMultiplier;

    // 1. PRIMARY CANNON: PULSE VULCAN (or HYPERION GATLING at Lv.5)
    const vulcanLvl = p.weapons.vulcan || 1;
    p.timers.vulcan -= dt * hasteMult;
    if (p.timers.vulcan <= 0) {
      const baseCd = vulcanLvl >= 5 ? 0.13 : vulcanLvl >= 2 ? 0.18 : 0.22;
      p.timers.vulcan = baseCd;
      this._firePulseVulcan(vulcanLvl);
    }

    // 2. SHOULDER PODS: MICRO-MISSILE SWARM (or VALKYRIE BARRAGE at Lv.5)
    const missileLvl = p.weapons.missiles || 0;
    if (missileLvl > 0) {
      this.playerRig.missilePods.visible = true;
      p.timers.missiles -= dt * hasteMult;
      if (p.timers.missiles <= 0) {
        p.timers.missiles = missileLvl >= 3 ? 1.45 : 1.85;
        this._fireMicroMissiles(missileLvl);
      }
    }

    // 3. AUTONOMOUS DRONE: TESLA HUNTER DRONE (or STORM-WEAVER ORBITALS at Lv.5)
    const droneLvl = p.weapons.drone || 0;
    if (droneLvl > 0) {
      this._updateTeslaDrones(dt, droneLvl, hasteMult);
    }

    // 4. REACTOR AURA: CRYO-NOVA REACTOR (or ABSOLUTE ZERO CORE at Lv.5)
    const cryoLvl = p.weapons.cryo || 0;
    if (cryoLvl > 0) {
      p.timers.cryo -= dt * hasteMult;
      if (p.timers.cryo <= 0) {
        p.timers.cryo = cryoLvl >= 3 ? 3.1 : 3.8;
        this._triggerCryoNova(cryoLvl);
      }
    }

    // 5. DORSAL LANCE: VIPER RAIL-LANCE (or OMEGA ANNIHILATOR at Lv.5)
    const railLvl = p.weapons.railgun || 0;
    if (railLvl > 0) {
      this.playerRig.railLance.visible = true;
      p.timers.railgun -= dt * hasteMult;
      if (p.timers.railgun <= 0) {
        p.timers.railgun = railLvl >= 2 ? 2.1 : 2.6;
        this._fireViperRailgun(railLvl);
      }
    }
  }

  _spawnProjectile(opts) {
    const slot = this.projectiles.find((pr) => !pr.active);
    if (!slot) return null;

    slot.active = true;
    slot.isEnemy = Boolean(opts.isEnemy);
    slot.isParried = Boolean(opts.isParried);
    slot.kind = opts.kind || 'vulcan';
    slot.x = opts.x;
    slot.y = opts.y ?? 0.95;
    slot.z = opts.z;
    slot.vx = opts.vx;
    slot.vz = opts.vz;
    slot.radius = opts.radius ?? 0.35;
    slot.damage = opts.damage ?? 20;
    slot.pierce = opts.pierce ?? 1;
    slot.aoeRadius = opts.aoeRadius ?? 0;
    slot.life = opts.life ?? 1.4;
    slot.colorHex = opts.colorHex ?? 0x00f0ff;
    slot.scaleX = opts.scaleX ?? 1.0;
    slot.scaleZ = opts.scaleZ ?? 1.0;
    slot.lastHitEnemyId = -1;
    slot.targetEnemy = opts.targetEnemy || null;

    this.projectileMesh.setColorAt(slot.id, this._color.setHex(slot.colorHex));
    if (this.projectileMesh.instanceColor) {
      this.projectileMesh.instanceColor.needsUpdate = true;
    }
    return slot;
  }

  _firePulseVulcan(lvl) {
    const p = this.player;
    const isEvo = lvl >= 5;
    const baseCount = isEvo ? 5 : lvl >= 3 ? 3 : 2;
    const count = baseCount + p.bonusProjectiles;
    const speed = (isEvo ? 32.0 : 25.0) * p.synergyProjSpeedBonus;
    const dmg =
      (isEvo ? 36 : lvl >= 4 ? 28 : lvl >= 2 ? 22 : 16) *
      p.damageMultiplier *
      p.synergyDamageBonus;
    const pierce = isEvo ? 3 : lvl >= 4 ? 2 : 1;
    const spreadArc = isEvo ? 0.36 : 0.22;

    for (let i = 0; i < count; i++) {
      const offsetFrac = count === 1 ? 0 : i / (count - 1) - 0.5;
      const angle = p.aimAngle + offsetFrac * spreadArc;
      const lateralOffset = (i % 2 === 0 ? -0.45 : 0.45) * (count === 2 ? 1 : 0.4);
      const perpX = Math.cos(p.aimAngle) * lateralOffset;
      const perpZ = -Math.sin(p.aimAngle) * lateralOffset;

      this._spawnProjectile({
        kind: 'vulcan',
        x: p.x + Math.sin(p.aimAngle) * 0.8 + perpX,
        z: p.z + Math.cos(p.aimAngle) * 0.8 + perpZ,
        vx: Math.sin(angle) * speed,
        vz: Math.cos(angle) * speed,
        damage: dmg,
        pierce,
        life: 1.15,
        colorHex: isEvo ? 0x00ff9d : 0x00e5ff,
        scaleX: isEvo ? 1.3 : 1.0,
        scaleZ: isEvo ? 1.4 : 1.0
      });
    }

    // Subtle arm recoil animation
    this.playerRig.armL.position.z = 0.22;
    this.playerRig.armR.position.z = 0.22;
    this.audio.playWeaponFire('vulcan');
  }

  _fireMicroMissiles(lvl) {
    const p = this.player;
    const isEvo = lvl >= 5;
    const salvoCount = (isEvo ? 6 : lvl >= 4 ? 4 : lvl >= 2 ? 3 : 2) + p.bonusProjectiles;
    const dmg =
      (isEvo ? 78 : lvl >= 3 ? 54 : 38) * p.damageMultiplier * p.synergyDamageBonus;
    const aoeRadius = isEvo ? 4.4 : lvl >= 2 ? 3.4 : 2.7;
    const speed = 16.5 * p.synergyProjSpeedBonus;

    for (let i = 0; i < salvoCount; i++) {
      const target = this.spatialGrid.findBestTarget(
        p.x + (Math.random() - 0.5) * 8,
        p.z + (Math.random() - 0.5) * 8,
        26,
        true
      );
      const angle = target
        ? Math.atan2(target.x - p.x, target.z - p.z) + (Math.random() - 0.5) * 0.45
        : p.aimAngle + (i - (salvoCount - 1) * 0.5) * 0.35;

      this._spawnProjectile({
        kind: 'missile',
        x: p.x,
        y: 1.4,
        z: p.z,
        vx: Math.sin(angle) * speed,
        vz: Math.cos(angle) * speed,
        damage: dmg,
        pierce: 1,
        aoeRadius,
        life: 1.8,
        colorHex: isEvo ? 0xffaa00 : 0xff1e6b,
        scaleX: 1.5,
        scaleZ: 1.25,
        targetEnemy: target
      });
    }

    this.audio.playWeaponFire('missile');
  }

  _updateTeslaDrones(dt, lvl, hasteMult) {
    const p = this.player;
    const isEvo = lvl >= 5;
    const desiredDrones = isEvo ? 4 : lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1;

    while (this.droneMeshes.length < desiredDrones) {
      const dm = this.assets.createDroneMesh();
      this.playerRig.droneOrbitGroup.add(dm);
      this.droneMeshes.push(dm);
    }

    const orbitRadius = 3.2;
    const orbitSpeed = isEvo ? 4.8 : lvl >= 3 ? 3.6 : 2.8;
    this.playerRig.droneOrbitGroup.rotation.y += dt * orbitSpeed;

    const bladeDmg = (isEvo ? 42 : 24) * p.damageMultiplier * p.synergyDamageBonus;

    for (let i = 0; i < this.droneMeshes.length; i++) {
      const angle = (i * Math.PI * 2) / this.droneMeshes.length;
      const dm = this.droneMeshes[i];
      dm.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
      dm.rotation.y += dt * 6.0;

      // World position of this drone for contact blade slicing
      const worldAngle = angle + this.playerRig.droneOrbitGroup.rotation.y;
      const wx = p.x + Math.cos(worldAngle) * orbitRadius;
      const wz = p.z + Math.sin(worldAngle) * orbitRadius;

      const hits = this.spatialGrid.queryRadius(wx, wz, 0.85, this._queryBuffer);
      for (let h = 0; h < hits.length; h++) {
        const e = hits[h];
        if (Math.random() < dt * 7.5) {
          this.damageEnemy(e, bladeDmg, false, 0x00ff9d);
        }
      }
    }

    // Periodic Chain-Lightning Arc from Drones
    p.timers.droneArc -= dt * hasteMult;
    if (p.timers.droneArc <= 0) {
      p.timers.droneArc = isEvo ? 0.55 : lvl >= 4 ? 0.75 : 0.95;
      const firstTarget = this.spatialGrid.findBestTarget(p.x, p.z, 13.0, true);
      if (firstTarget) {
        const bounces = isEvo ? 5 : lvl >= 3 ? 3 : 2;
        const arcDmg = (isEvo ? 48 : lvl >= 2 ? 32 : 22) * p.damageMultiplier * p.synergyDamageBonus;
        let prevX = p.x;
        let prevZ = p.z;
        let curr = firstTarget;
        const visited = new Set();

        for (let b = 0; b < bounces && curr; b++) {
          visited.add(curr.id);
          this.vfx.spawnBeam(prevX, 1.2, prevZ, curr.x, 1.0, curr.z, 0x00ff9d, 0.14, 0.14);
          this.damageEnemy(curr, arcDmg, false, 0x00ff9d);
          prevX = curr.x;
          prevZ = curr.z;

          // Find next neighbor for chain lightning
          const neighbors = this.spatialGrid.queryRadius(curr.x, curr.z, 6.5, this._queryBuffer);
          curr = neighbors.find((n) => !visited.has(n.id)) || null;
        }
        this.audio.playWeaponFire('tesla');
      }
    }
  }

  _triggerCryoNova(lvl) {
    const p = this.player;
    const isEvo = lvl >= 5;
    const radius = isEvo ? 9.5 : lvl >= 2 ? 7.2 : 5.6;
    const dmg = (isEvo ? 75 : lvl >= 3 ? 46 : 30) * p.damageMultiplier * p.synergyDamageBonus;

    this.vfx.spawnShockwave(p.x, p.z, 0x00d4ff, radius, 0.45);
    if (isEvo) {
      this.vfx.spawnShockwave(p.x, p.z, 0xffffff, radius * 0.75, 0.35);
    }

    const targets = this.spatialGrid.queryRadius(p.x, p.z, radius, this._queryBuffer);
    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      e.slowTimer = Math.max(e.slowTimer, isEvo ? 3.8 : 2.6);
      if (isEvo) {
        e.stunTimer = Math.max(e.stunTimer, 1.2);
      }
      this.damageEnemy(e, dmg, false, 0x00d4ff);
    }

    this.audio.playWeaponFire('cryo');
  }

  _fireViperRailgun(lvl) {
    const p = this.player;
    const isEvo = lvl >= 5;
    const shots = isEvo || lvl >= 4 ? 2 : 1;
    const baseDmg = (isEvo ? 135 : lvl >= 2 ? 90 : 65) * p.damageMultiplier * p.synergyDamageBonus;

    for (let s = 0; s < shots; s++) {
      const target = this.spatialGrid.findBestTarget(p.x, p.z, 28, true);
      const angle = target
        ? Math.atan2(target.x - p.x, target.z - p.z) + (s === 1 ? 0.08 : 0)
        : p.aimAngle + (s === 1 ? 0.08 : 0);

      const range = 30.0;
      const endX = p.x + Math.sin(angle) * range;
      const endZ = p.z + Math.cos(angle) * range;

      this.vfx.spawnBeam(
        p.x,
        1.35,
        p.z,
        endX,
        1.0,
        endZ,
        isEvo ? 0xff1e6b : 0xb829ff,
        isEvo ? 0.34 : 0.22,
        0.24
      );

      // Line-segment intersection check against active enemies
      const dirX = Math.sin(angle);
      const dirZ = Math.cos(angle);
      const beamHalfWidth = isEvo ? 1.15 : 0.85;

      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = this.enemies[i];
        if (!e.active) continue;
        const rx = e.x - p.x;
        const rz = e.z - p.z;
        const proj = rx * dirX + rz * dirZ;
        if (proj < 0 || proj > range) continue;
        const perpDist = Math.abs(rx * dirZ - rz * dirX);
        if (perpDist <= e.radius + beamHalfWidth) {
          const forceCrit = lvl >= 3 && e.hp >= e.maxHp * 0.9;
          this.damageEnemy(e, baseDmg, forceCrit, 0xb829ff);
          if (isEvo) {
            this.vfx.spawnShockwave(e.x, e.z, 0xff1e6b, 2.8, 0.22);
          }
        }
      }
    }

    this.audio.playWeaponFire('railgun');
    this.screenShake = Math.max(this.screenShake, 0.22);
  }

  // ==================== PROJECTILES UPDATE ====================
  updateProjectiles(dt) {
    // Gently recover player arm recoil
    this.playerRig.armL.position.z += (0.35 - this.playerRig.armL.position.z) * 12 * dt;
    this.playerRig.armR.position.z += (0.35 - this.playerRig.armR.position.z) * 12 * dt;

    const p = this.player;
    let activeProjCount = 0;

    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const proj = this.projectiles[i];
      if (!proj.active) continue;

      proj.life -= dt;
      if (proj.life <= 0) {
        proj.active = false;
        continue;
      }

      // Homing guidance for Micro-Missiles
      if (proj.kind === 'missile') {
        if (!proj.targetEnemy || !proj.targetEnemy.active) {
          proj.targetEnemy = this.spatialGrid.findBestTarget(proj.x, proj.z, 18, true);
        }
        if (proj.targetEnemy && proj.targetEnemy.active) {
          const dx = proj.targetEnemy.x - proj.x;
          const dz = proj.targetEnemy.z - proj.z;
          const dist = Math.hypot(dx, dz) || 1;
          const spd = Math.hypot(proj.vx, proj.vz) || 16;
          const turn = 7.5 * dt;
          proj.vx += ((dx / dist) * spd - proj.vx) * turn;
          proj.vz += ((dz / dist) * spd - proj.vz) * turn;
        }
      }

      proj.x += proj.vx * dt;
      proj.z += proj.vz * dt;

      if (proj.isEnemy) {
        // Enemy Plasma Bolt vs Player Collision
        const dx = proj.x - p.x;
        const dz = proj.z - p.z;
        const hitR = proj.radius + p.radius;
        if (dx * dx + dz * dz <= hitR * hitR) {
          if (p.dashActiveTimer > 0) {
            // Automatic Dash-Parry if player dashes into bolt!
            this._checkEmpDashParry();
            continue;
          } else {
            this.damagePlayer(proj.damage);
            proj.active = false;
            continue;
          }
        }
      } else {
        // Player / Parried Projectile vs Enemy Collision via Spatial Hash Grid
        const candidates = this.spatialGrid.queryRadius(
          proj.x,
          proj.z,
          proj.radius + 0.85,
          this._queryBuffer
        );

        let hitOccurred = false;
        for (let c = 0; c < candidates.length; c++) {
          const e = candidates[c];
          if (!e.active || e.id === proj.lastHitEnemyId) continue;

          const dx = e.x - proj.x;
          const dz = e.z - proj.z;
          const maxR = e.radius + proj.radius;
          if (dx * dx + dz * dz <= maxR * maxR) {
            proj.lastHitEnemyId = e.id;

            if (proj.aoeRadius > 0) {
              // Explosive AoE Micro-Missile Detonation
              this.vfx.spawnShockwave(proj.x, proj.z, proj.colorHex, proj.aoeRadius, 0.3);
              this.vfx.spawnBurst(proj.x, 0.9, proj.z, proj.colorHex, 14, 9.0, 1.1);
              const blastTargets = this.spatialGrid.queryRadius(
                proj.x,
                proj.z,
                proj.aoeRadius,
                this._queryBuffer
              );
              for (let b = 0; b < blastTargets.length; b++) {
                this.damageEnemy(blastTargets[b], proj.damage, false, proj.colorHex);
              }
              proj.pierce = 0;
            } else {
              this.damageEnemy(e, proj.damage, proj.isParried, proj.colorHex);
              proj.pierce--;
            }

            if (proj.pierce <= 0) {
              proj.active = false;
              hitOccurred = true;
              break;
            }
          }
        }
        if (hitOccurred) continue;
      }

      // Update InstancedMesh Matrix & Color for active projectile
      const instIdx = activeProjCount++;
      const heading = Math.atan2(proj.vx, proj.vz);
      this._pos.set(proj.x, proj.y, proj.z);
      this._euler.set(0, heading, 0);
      this._quat.setFromEuler(this._euler);
      this._scale.set(proj.scaleX, proj.scaleX, proj.scaleZ);
      this._mat4.compose(this._pos, this._quat, this._scale);
      this.projectileMesh.setMatrixAt(instIdx, this._mat4);
      this.projectileMesh.setColorAt(instIdx, this._color.setHex(proj.colorHex));
    }

    this.projectileMesh.count = activeProjCount;
    this.projectileMesh.instanceMatrix.needsUpdate = true;
    if (this.projectileMesh.instanceColor) {
      this.projectileMesh.instanceColor.needsUpdate = true;
    }
  }

  // ==================== HORDE DIRECTOR & ENEMY AI ====================
  updateHordeDirector(dt) {
    const p = this.player;
    const minutes = this.elapsedTime / 60;
    this.wave.number = Math.floor(this.elapsedTime / 25) + 1;

    // Corruption accelerates spawn density for higher XP/loot rewards
    const corruptionMult = 1.0 + (p.corruption / 100) * 0.45;
    const densityMult = (1.0 + minutes * 0.85) * corruptionMult;

    this.wave.spawnTimer -= dt;
    if (this.wave.spawnTimer <= 0) {
      this.wave.spawnTimer = Math.max(0.28, 0.85 / densityMult);
      const batchCount = Math.min(18, Math.ceil(3 * densityMult));
      this.spawnWaveBurst(batchCount, false);
    }

    // Elite Mini-Boss Spawn Timer
    this.wave.bossSpawnTimer -= dt;
    if (this.wave.bossSpawnTimer <= 0) {
      this.wave.bossSpawnTimer = 55;
      this.spawnEliteBoss();
    }
  }

  spawnWaveBurst(count = 6, forceSwarmer = false) {
    const p = this.player;
    const t = this.elapsedTime;

    for (let i = 0; i < count; i++) {
      const slot = this.enemies.find((e) => !e.active);
      if (!slot) break;

      const angle = Math.random() * Math.PI * 2;
      const dist = 21 + Math.random() * 10;
      const sx = Math.max(-ARENA_HALF_SIZE + 2, Math.min(ARENA_HALF_SIZE - 2, p.x + Math.cos(angle) * dist));
      const sz = Math.max(-ARENA_HALF_SIZE + 2, Math.min(ARENA_HALF_SIZE - 2, p.z + Math.sin(angle) * dist));

      // Select Enemy Archetype (balanced mix of Swarmers, Snipers, Bruisers, and Volatile Bombers)
      let type = 0; // 0: Scarab Swarmer
      const r = Math.random();
      if (r < (t > 30 ? 0.14 : 0.07)) {
        type = 3; // Volatile Tick-Bomber
      } else if (r < (t > 20 ? 0.30 : 0.18)) {
        type = 1; // Goliath Siege-Walker (Bruiser)
      } else if (r < (t > 10 ? 0.48 : 0.34)) {
        type = 2; // Viper Rail-Tripod (Sniper)
      }

      const hpScale = 1.0 + (t / 60) * 0.65 + (p.corruption / 100) * 0.25;
      slot.active = true;
      slot.type = type;
      slot.x = sx;
      slot.z = sz;
      slot.vx = 0;
      slot.vz = 0;
      slot.rotY = 0;
      slot.hitFlash = 0;
      slot.slowTimer = 0;
      slot.stunTimer = 0;
      slot.attackTimer = 1.2 + Math.random() * 1.5;
      slot.bossRig = null;

      if (type === 0) {
        // Scarab Swarm-Bot
        slot.radius = 0.58;
        slot.maxHp = 26 * hpScale;
        slot.speed = 6.2 + Math.random() * 1.2;
        slot.damage = 10;
        slot.xpValue = 16;
        slot.threatWeight = 1.0;
      } else if (type === 1) {
        // Goliath Siege-Walker (Bruiser)
        slot.radius = 0.92;
        slot.maxHp = 95 * hpScale;
        slot.speed = 4.1;
        slot.damage = 22;
        slot.xpValue = 42;
        slot.threatWeight = 2.4;
      } else if (type === 2) {
        // Viper Rail-Tripod (Ranged Sniper)
        slot.radius = 0.72;
        slot.maxHp = 48 * hpScale;
        slot.speed = 4.4;
        slot.damage = 16;
        slot.xpValue = 32;
        slot.threatWeight = 3.0;
      } else if (type === 3) {
        // Volatile Tick-Bomber
        slot.radius = 0.62;
        slot.maxHp = 32 * hpScale;
        slot.speed = 7.8;
        slot.damage = 28;
        slot.xpValue = 28;
        slot.threatWeight = 2.6;
      }

      slot.hp = slot.maxHp;
    }
  }

  spawnEliteBoss() {
    const rigSlot = this.bossRigs.find((r) => !r.inUse);
    const enemySlot = this.enemies.find((e) => !e.active);
    if (!rigSlot || !enemySlot) return;

    const p = this.player;
    const angle = Math.random() * Math.PI * 2;
    const sx = Math.max(-ARENA_HALF_SIZE + 4, Math.min(ARENA_HALF_SIZE - 4, p.x + Math.cos(angle) * 20));
    const sz = Math.max(-ARENA_HALF_SIZE + 4, Math.min(ARENA_HALF_SIZE - 4, p.z + Math.sin(angle) * 20));

    const hpScale = 1.0 + (this.elapsedTime / 60) * 0.9;
    rigSlot.inUse = true;
    rigSlot.group.visible = true;
    rigSlot.group.position.set(sx, 0, sz);

    enemySlot.active = true;
    enemySlot.type = 4; // Boss
    enemySlot.x = sx;
    enemySlot.z = sz;
    enemySlot.radius = 1.85;
    enemySlot.maxHp = Math.round(1400 * hpScale);
    enemySlot.hp = enemySlot.maxHp;
    enemySlot.speed = 3.8;
    enemySlot.damage = 30;
    enemySlot.xpValue = 350;
    enemySlot.threatWeight = 8.0;
    enemySlot.hitFlash = 0;
    enemySlot.slowTimer = 0;
    enemySlot.stunTimer = 0;
    enemySlot.attackTimer = 2.2;
    enemySlot.bossRig = rigSlot;

    this.wave.activeBoss = enemySlot;
    this.audio.playBossAlert();
    this.vfx.spawnFloatingText(
      p.x,
      2.8,
      p.z,
      '⚠ APEX DREADNOUGHT INBOUND!',
      '#ff1e6b',
      1.45,
      1.4
    );
  }

  updateEnemies(dt) {
    const p = this.player;

    // Rebuild Spatial Hash Grid
    this.spatialGrid.clear();
    let activeCount = 0;

    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;
      activeCount++;
      this.spatialGrid.insert(e);
    }
    this.wave.activeEnemiesCount = activeCount;

    // Reset per-archetype compact instance counters
    const archCounts = [0, 0, 0, 0];
    let shadowCount = 0;

    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;

      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.slowTimer > 0) e.slowTimer -= dt;
      if (e.stunTimer > 0) e.stunTimer -= dt;

      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const distToPlayer = Math.hypot(dx, dz) || 0.001;
      const dirX = dx / distToPlayer;
      const dirZ = dz / distToPlayer;

      if (e.stunTimer <= 0) {
        const moveMult = e.slowTimer > 0 ? 0.45 : 1.0;
        let desiredSpeed = e.speed * moveMult;

        // Ranged Sniper (type 2) stops at mid-range to fire plasma bolts (prime Dash-Parry fodder!)
        if (e.type === 2) {
          if (distToPlayer < 13.5 && distToPlayer > 7.5) {
            desiredSpeed = 0.2;
          } else if (distToPlayer <= 7.5) {
            desiredSpeed = -e.speed * 0.5;
          }

          e.attackTimer -= dt * moveMult;
          if (e.attackTimer <= 0 && distToPlayer < 22) {
            e.attackTimer = 2.4;
            const orbSpd = 12.5;
            this._spawnProjectile({
              isEnemy: true,
              kind: 'enemy_orb',
              x: e.x + dirX * 0.9,
              y: 1.0,
              z: e.z + dirZ * 0.9,
              vx: dirX * orbSpd,
              vz: dirZ * orbSpd,
              radius: 0.42,
              damage: e.damage,
              life: 2.6,
              colorHex: 0xff1e6b,
              scaleX: 1.45,
              scaleZ: 0.85
            });
          }
        } else if (e.type === 4) {
          // Boss Radial Plasma Ring Attack
          e.attackTimer -= dt * moveMult;
          if (e.attackTimer <= 0) {
            e.attackTimer = 3.2;
            const bolts = 10;
            for (let b = 0; b < bolts; b++) {
              const ang = (b * Math.PI * 2) / bolts + this.elapsedTime;
              this._spawnProjectile({
                isEnemy: true,
                kind: 'enemy_orb',
                x: e.x + Math.cos(ang) * 1.6,
                y: 1.1,
                z: e.z + Math.sin(ang) * 1.6,
                vx: Math.cos(ang) * 11.0,
                vz: Math.sin(ang) * 11.0,
                radius: 0.48,
                damage: 18,
                life: 3.0,
                colorHex: 0xff1e6b,
                scaleX: 1.6,
                scaleZ: 0.9
              });
            }
          }
        }

        e.vx = dirX * desiredSpeed;
        e.vz = dirZ * desiredSpeed;
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.rotY = Math.atan2(dirX, dirZ);
      }

      // Fast Soft Separation against nearby enemies
      const neighbors = this.spatialGrid.queryRadius(e.x, e.z, e.radius * 1.7, this._queryBuffer);
      for (let n = 0; n < neighbors.length; n++) {
        const other = neighbors[n];
        if (other.id <= e.id) continue;
        const nx = e.x - other.x;
        const nz = e.z - other.z;
        const nDistSq = nx * nx + nz * nz;
        const minSep = e.radius + other.radius;
        if (nDistSq < minSep * minSep && nDistSq > 0.0001) {
          const nDist = Math.sqrt(nDistSq);
          const overlap = (minSep - nDist) * 0.35;
          const ox = (nx / nDist) * overlap;
          const oz = (nz / nDist) * overlap;
          e.x += ox;
          e.z += oz;
          other.x -= ox;
          other.z -= oz;
        }
      }

      // Enemy vs Player Melee / Contact Check
      const contactDist = e.radius + p.radius;
      if (dx * dx + dz * dz <= contactDist * contactDist) {
        if (p.dashActiveTimer > 0) {
          this._checkEmpDashParry();
        } else if (e.type === 3) {
          // Volatile Tick-Bomber explodes on contact!
          this.vfx.spawnShockwave(e.x, e.z, 0x00ff9d, 3.8, 0.32);
          this.vfx.spawnBurst(e.x, 0.8, e.z, 0x00ff9d, 20, 10, 1.2);
          this.damagePlayer(e.damage);
          this.killEnemy(e, false);
          continue;
        } else {
          this.damagePlayer(e.damage);
        }
      }

      // Update Visual Transform
      if (e.type === 4 && e.bossRig) {
        e.bossRig.group.position.set(e.x, 0, e.z);
        e.bossRig.group.rotation.y = e.rotY;
        e.bossRig.core.rotation.y += dt * 3.0;
        e.bossRig.shieldRing.rotation.y -= dt * 2.2;
      } else if (e.type >= 0 && e.type < 4) {
        const t = e.type;
        const instIdx = archCounts[t]++;

        // Procedural walk/hop bobbing
        const bob = Math.abs(Math.sin(this.elapsedTime * 9.0 + e.phaseOffset)) * 0.14;
        const tilt = Math.sin(this.elapsedTime * 9.0 + e.phaseOffset) * 0.08;

        this._pos.set(e.x, bob, e.z);
        this._euler.set(0, e.rotY, tilt);
        this._quat.setFromEuler(this._euler);

        // Pulse scale if Volatile Tick-Bomber is close to player
        const pulse =
          t === 3 && distToPlayer < 5.5
            ? 1.0 + Math.sin(this.elapsedTime * 24) * 0.18
            : 1.0;
        this._scale.set(pulse, pulse, pulse);
        this._mat4.compose(this._pos, this._quat, this._scale);

        const mesh = this.enemyArchetypeMeshes[t];
        mesh.setMatrixAt(instIdx, this._mat4);

        // Set per-instance hit-flash or cryo tint
        if (e.hitFlash > 0) {
          this._color.setRGB(3.0, 3.0, 3.0);
        } else if (e.stunTimer > 0) {
          this._color.setRGB(0.3, 2.0, 1.4);
        } else if (e.slowTimer > 0) {
          this._color.setRGB(0.4, 1.3, 2.2);
        } else {
          this._color.setRGB(1.0, 1.0, 1.0);
        }
        mesh.setColorAt(instIdx, this._color);

        // Ground shadow matrix
        const sIdx = shadowCount++;
        this._pos.set(e.x, 0.02, e.z);
        this._euler.set(-Math.PI / 2, 0, 0);
        this._quat.setFromEuler(this._euler);
        const sRad = e.radius * 1.35;
        this._scale.set(sRad, sRad, 1);
        this._mat4.compose(this._pos, this._quat, this._scale);
        this.enemyShadowMesh.setMatrixAt(sIdx, this._mat4);
      }
    }

    this.enemyShadowMesh.count = shadowCount;
    this.enemyShadowMesh.instanceMatrix.needsUpdate = true;

    for (let t = 0; t < 4; t++) {
      const im = this.enemyArchetypeMeshes[t];
      im.count = archCounts[t];
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  damageEnemy(enemy, rawAmount, forceCrit = false, colorHex = 0x00d4ff) {
    if (!enemy.active) return;
    const p = this.player;

    const isCrit = forceCrit || Math.random() < p.critChance;
    let amount = rawAmount * (isCrit ? p.critMultiplier : 1.0);
    if (enemy.slowTimer > 0) {
      amount *= p.synergyCryoBonus * ((p.weapons.cryo || 0) >= 4 ? 1.2 : 1.0);
    }

    enemy.hp -= amount;
    enemy.hitFlash = 0.09;
    p.totalDamageDealt += amount;

    this.audio.playHit(isCrit);
    this.vfx.spawnBurst(enemy.x, 0.9, enemy.z, colorHex, isCrit ? 6 : 3, 6.0, 0.75);

    const rounded = Math.max(1, Math.round(amount));
    this.vfx.spawnFloatingText(
      enemy.x,
      1.6,
      enemy.z,
      isCrit ? `${rounded}!` : `${rounded}`,
      isCrit ? '#00ff9d' : '#e8f4ff',
      isCrit ? 1.22 : 0.92,
      0.52
    );

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, true);
    }
  }

  killEnemy(enemy, grantRewards = true) {
    if (!enemy.active) return;
    enemy.active = false;

    const isBoss = enemy.type === 4;
    if (isBoss && enemy.bossRig) {
      enemy.bossRig.inUse = false;
      enemy.bossRig.group.visible = false;
      if (this.wave.activeBoss === enemy) {
        this.wave.activeBoss = null;
      }
    }

    // Volatile Tick-Bombers chain-detonate on death, damaging nearby enemies!
    if (enemy.type === 3 && grantRewards) {
      this.vfx.spawnShockwave(enemy.x, enemy.z, 0x00ff9d, 3.6, 0.3);
      const chainVictims = this.spatialGrid.queryRadius(enemy.x, enemy.z, 3.6, this._queryBuffer);
      for (let i = 0; i < chainVictims.length; i++) {
        const v = chainVictims[i];
        if (v.id !== enemy.id && v.active) {
          this.damageEnemy(v, 45 * this.player.damageMultiplier, false, 0x00ff9d);
        }
      }
    }

    if (grantRewards) {
      this.player.kills++;
      const burstColors = [0xff1e6b, 0xffaa00, 0xb829ff, 0x00ff9d, 0xff1e6b];
      this.vfx.spawnBurst(
        enemy.x,
        1.0,
        enemy.z,
        burstColors[enemy.type] || 0xff1e6b,
        isBoss ? 45 : 14,
        isBoss ? 14.0 : 8.5,
        isBoss ? 1.6 : 1.0
      );
      this.audio.playEnemyKill(isBoss);

      if (isBoss) {
        this.hitStopTimer = 0.06;
        this.screenShake = Math.max(this.screenShake, 0.7);
        this.vfx.spawnShockwave(enemy.x, enemy.z, 0xff1e6b, 9.0, 0.55);
        // Drop Vacuum Overdrive Core + Heal Core
        this.spawnGem(enemy.x, enemy.z, enemy.xpValue, true, true);
        if (this.player.parryHeal > 0) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.parryHeal);
        }
      } else {
        this.spawnGem(enemy.x, enemy.z, enemy.xpValue, false, Math.random() < 0.025);
      }
    }
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.iFrameTimer > 0 || this.state !== 'PLAYING') return;

    p.hp -= amount;
    p.iFrameTimer = 0.55;
    this.screenShake = Math.max(this.screenShake, 0.45);
    this.audio.playPlayerDamage();

    this.vfx.spawnBurst(p.x, 1.0, p.z, 0xff1e6b, 18, 9.0, 1.1);
    this.vfx.spawnFloatingText(p.x, 2.2, p.z, `-${Math.round(amount)} HP`, '#ff1e6b', 1.2, 0.75);

    this.screenFx.classList.add('damage-flash');
    setTimeout(() => this.screenFx.classList.remove('damage-flash'), 180);

    if (p.hp <= 0) {
      p.hp = 0;
      this.triggerGameOver();
    }
  }

  // ==================== DATA SHARDS (XP GEMS) & LEVEL UP ====================
  spawnGem(x, z, value = 15, isVacuumCore = false, isHealCore = false) {
    const slot = this.gems.find((g) => !g.active);
    if (!slot) return;

    slot.active = true;
    slot.x = x;
    slot.z = z;
    slot.value = value;
    slot.isVacuumCore = isVacuumCore;
    slot.isHealCore = isHealCore;
    slot.magnetized = isVacuumCore;
    slot.colorHex = isVacuumCore
      ? 0xffaa00
      : isHealCore
      ? 0x00ff9d
      : value >= 30
      ? 0xff1e6b
      : 0x00d4ff;
    slot.scale = isVacuumCore ? 1.7 : value >= 30 ? 1.25 : 0.95;

    this.gemMesh.setColorAt(slot.id, this._color.setHex(slot.colorHex));
    if (this.gemMesh.instanceColor) {
      this.gemMesh.instanceColor.needsUpdate = true;
    }
  }

  updateGems(dt) {
    const p = this.player;
    const pickupRadSq = p.pickupRadius * p.pickupRadius;
    let activeGemCount = 0;

    for (let i = 0; i < MAX_GEMS; i++) {
      const g = this.gems[i];
      if (!g.active) continue;

      const dx = p.x - g.x;
      const dz = p.z - g.z;
      const distSq = dx * dx + dz * dz;

      if (!g.magnetized && distSq <= pickupRadSq) {
        g.magnetized = true;
      }

      if (g.magnetized) {
        const dist = Math.sqrt(distSq) || 0.001;
        const pullSpeed = 24.0;
        g.x += (dx / dist) * pullSpeed * dt;
        g.z += (dz / dist) * pullSpeed * dt;

        if (dist < 0.95) {
          g.active = false;

          if (g.isVacuumCore) {
            // Magnetize ALL active Data Shards across Sector Zero!
            for (const other of this.gems) {
              if (other.active) other.magnetized = true;
            }
            this.vfx.spawnFloatingText(p.x, 2.5, p.z, '★ VACUUM OVERDRIVE!', '#ffaa00', 1.35, 1.0);
          }

          if (g.isHealCore) {
            p.hp = Math.min(p.maxHp, p.hp + 25);
            this.vfx.spawnFloatingText(p.x, 2.1, p.z, '+25 HULL REPAIR', '#00ff9d', 1.15, 0.8);
          }

          p.gemCombo++;
          p.gemComboTimer = 0.85;
          this.audio.playGemPickup(p.gemCombo);

          p.xp += g.value * p.xpMultiplier;
          if (p.xp >= p.xpToNext && this.state === 'PLAYING') {
            p.xp -= p.xpToNext;
            p.level++;
            p.xpToNext = Math.round(p.xpToNext * 1.24 + 35);
            this.triggerLevelUpModal();
          }
          continue;
        }
      }

      const instIdx = activeGemCount++;
      const bobY = 0.45 + Math.sin(this.elapsedTime * 5.0 + i) * 0.14;
      this._pos.set(g.x, bobY, g.z);
      this._euler.set(0, this.elapsedTime * 3.2 + i, 0.4);
      this._quat.setFromEuler(this._euler);
      this._scale.setScalar(g.scale);
      this._mat4.compose(this._pos, this._quat, this._scale);
      this.gemMesh.setMatrixAt(instIdx, this._mat4);
      this.gemMesh.setColorAt(instIdx, this._color.setHex(g.colorHex));
    }

    this.gemMesh.count = activeGemCount;
    this.gemMesh.instanceMatrix.needsUpdate = true;
    if (this.gemMesh.instanceColor) {
      this.gemMesh.instanceColor.needsUpdate = true;
    }
  }

  triggerLevelUpModal() {
    this.state = 'LEVEL_UP';
    this.audio.playLevelUp();
    this.vfx.spawnShockwave(this.player.x, this.player.z, 0x00ff9d, 7.5, 0.45);
    this.renderUpgradeCards();
    document.getElementById('levelup-modal').classList.remove('hidden');
  }

  rerollUpgrades() {
    if (this.rerollsLeft <= 0) return;
    this.rerollsLeft--;
    this.audio.playGemPickup(4);
    this.renderUpgradeCards();
  }

  renderUpgradeCards() {
    const container = document.getElementById('upgrade-cards-container');
    container.innerHTML = '';
    document.getElementById('reroll-count').textContent = this.rerollsLeft;
    document.getElementById('btn-reroll').disabled = this.rerollsLeft <= 0;

    const choices = this.upgradeSystem.generateChoices(3);
    choices.forEach((choice) => {
      const card = document.createElement('div');
      card.className = `perk-card ${choice.isCorrupted ? 'corrupted' : ''} ${
        choice.isEvolution ? 'evolution' : ''
      }`;

      const tagsHtml = choice.tags
        .map((t) => `<span class="perk-synergy-pill">[${t}]</span>`)
        .join('');

      card.innerHTML = `
        <div>
          <div class="perk-top-row">
            <span class="perk-type-tag">${choice.slot}</span>
            <span class="perk-lvl-badge">${choice.levelText}</span>
          </div>
          <div class="perk-title">${choice.title}</div>
          <div class="perk-desc">${choice.desc}</div>
        </div>
        <div class="perk-tags">${tagsHtml}</div>
      `;

      card.addEventListener('click', () => {
        this.upgradeSystem.applyChoice(choice);
        this.audio.setCorruption(this.player.corruption);
        this.audio.playDashParry();
        document.getElementById('levelup-modal').classList.add('hidden');
        this.state = 'PLAYING';
        this.updateHUD();
      });

      container.appendChild(card);
    });
  }

  // ==================== CAMERA & HUD UPDATES ====================
  updateCamera(dt) {
    const p = this.player;

    // Subtle look-ahead toward cursor/reticle
    const leadX = (this.reticle.position.x - p.x) * 0.14;
    const leadZ = (this.reticle.position.z - p.z) * 0.14;

    const desiredX = p.x + Math.max(-4.5, Math.min(4.5, leadX));
    const desiredZ = p.z + Math.max(-4.5, Math.min(4.5, leadZ));

    // Smooth exponential damping
    const damp = 1.0 - Math.exp(-8.5 * dt);
    this.cameraTarget.x += (desiredX - this.cameraTarget.x) * damp;
    this.cameraTarget.z += (desiredZ - this.cameraTarget.z) * damp;

    // Screen-Shake Trauma
    let shakeX = 0;
    let shakeZ = 0;
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 2.4);
      const mag = this.screenShake * this.screenShake * 1.4;
      shakeX = (Math.random() - 0.5) * mag;
      shakeZ = (Math.random() - 0.5) * mag;
    }

    // Strict Equal-Angle Isometric Orthographic Camera Position
    this.camera.position.set(
      this.cameraTarget.x + ISO_DIST + shakeX,
      ISO_DIST,
      this.cameraTarget.z + ISO_DIST + shakeZ
    );
    this.camera.lookAt(
      this.cameraTarget.x + shakeX,
      0,
      this.cameraTarget.z + shakeZ
    );
  }

  updateHUD() {
    const p = this.player;

    // XP Bar
    const xpPct = Math.min(100, (p.xp / p.xpToNext) * 100);
    document.getElementById('xp-bar-fill').style.width = `${xpPct.toFixed(1)}%`;
    document.getElementById('hud-level').textContent = `LVL ${String(p.level).padStart(2, '0')}`;
    document.getElementById('hud-xp-text').textContent = `DATA SHARDS: ${Math.floor(p.xp)} / ${p.xpToNext}`;

    // Clock & Wave
    const mins = Math.floor(this.elapsedTime / 60);
    const secs = Math.floor(this.elapsedTime % 60);
    document.getElementById('hud-timer').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('hud-wave-name').textContent = `WAVE ${String(this.wave.number).padStart(2, '0')} // SECTOR ZERO`;

    const density = (1.0 + (this.elapsedTime / 60) * 0.85) * (1.0 + (p.corruption / 100) * 0.45);
    document.getElementById('hud-threat-rate').textContent = `SWARM DENSITY: ${density.toFixed(1)}x`;

    // Telemetry
    document.getElementById('hud-fps').textContent = this.currentFps;
    document.getElementById('hud-entities').textContent = this.wave.activeEnemiesCount;
    document.getElementById('hud-kills').textContent = p.kills;
    document.getElementById('hud-parry-count').textContent = `EMP PARRIES: ${p.parryCount}`;

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const hpFill = document.getElementById('hud-hp-fill');
    hpFill.style.width = `${hpPct.toFixed(1)}%`;
    hpFill.classList.toggle('low', hpPct < 32);
    document.getElementById('hud-hp-text').textContent = `HULL INTEGRITY: ${Math.ceil(p.hp)} / ${p.maxHp}`;

    // Dash Pips
    const dashContainer = document.getElementById('hud-dash-pips');
    if (dashContainer.children.length !== p.maxDashCharges) {
      dashContainer.innerHTML = '';
      for (let i = 0; i < p.maxDashCharges; i++) {
        const pip = document.createElement('div');
        pip.className = 'dash-pip';
        pip.innerHTML = '<div class="dash-pip-fill"></div>';
        dashContainer.appendChild(pip);
      }
    }
    for (let i = 0; i < p.maxDashCharges; i++) {
      const fill = dashContainer.children[i].firstElementChild;
      if (i < p.dashCharges) {
        fill.style.width = '100%';
      } else if (i === p.dashCharges) {
        const prog = (p.dashRechargeTimer / p.dashCooldown) * 100;
        fill.style.width = `${prog.toFixed(0)}%`;
      } else {
        fill.style.width = '0%';
      }
    }

    // Hardpoints & Synergies
    const weaponsEl = document.getElementById('hud-weapons-list');
    let wHtml = '';
    for (const key of Object.keys(WEAPON_DEFS)) {
      const lvl = p.weapons[key] || 0;
      if (lvl > 0) {
        const def = WEAPON_DEFS[key];
        const isEvo = lvl >= def.maxLevel;
        wHtml += `<div class="weapon-chip ${isEvo ? 'evolved' : ''}">
          <span>${isEvo ? `★ ${def.evolvedName}` : def.name}</span>
          <span class="w-lvl">${isEvo ? 'MAX' : `L${lvl}`}</span>
        </div>`;
      }
    }
    weaponsEl.innerHTML = wHtml;

    const synEl = document.getElementById('hud-synergies-list');
    synEl.innerHTML = SYNERGY_INFO.map((s) => {
      const count = p.tagCounts[s.tag] || 0;
      const active = count >= s.threshold;
      return `<span class="synergy-badge ${active ? 'active' : ''}">${s.tag} [${count}/${s.threshold}]</span>`;
    }).join('');

    // System Corruption Meter
    document.getElementById('hud-corruption-pct').textContent = `${p.corruption}%`;
    document.getElementById('hud-corruption-fill').style.width = `${p.corruption}%`;
    document.getElementById('hud-corruption-desc').textContent =
      p.corruption === 0
        ? 'STATUS: NOMINAL // ACCEPT GLITCH OVERCLOCKS AT LEVEL-UP FOR MASSIVE POWER SPIKES'
        : `OVERCLOCK ACTIVE // +${Math.round(p.corruption * 0.45)}% THREAT DENSITY & HIGH-VALUE LOOT`;

    // Boss Bar
    const bossBar = document.getElementById('boss-bar-container');
    if (this.wave.activeBoss && this.wave.activeBoss.active) {
      bossBar.classList.remove('hidden');
      const b = this.wave.activeBoss;
      const bPct = Math.max(0, (b.hp / b.maxHp) * 100);
      document.getElementById('boss-hp-fill').style.width = `${bPct.toFixed(1)}%`;
      document.getElementById('boss-hp-text').textContent = `${Math.ceil(b.hp)} / ${b.maxHp}`;
    } else {
      bossBar.classList.add('hidden');
    }
  }

  // ==================== PAUSE & GAME OVER ====================
  pauseGame() {
    this.state = 'PAUSED';
    this._populateEndModal('SYSTEM PAUSED', 'Reactor simulation suspended.', true);
  }

  resumeGame() {
    document.getElementById('gameover-modal').classList.add('hidden');
    this.state = 'PLAYING';
  }

  triggerGameOver() {
    this.state = 'GAME_OVER';
    this._populateEndModal(
      'CHASSIS CRITICAL FAILURE',
      'VX-09 Valkyrie overwhelmed in Sector Zero.',
      false
    );
  }

  _populateEndModal(title, subtitle, showResume) {
    const p = this.player;
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-subtitle').textContent = subtitle;
    document.getElementById('btn-resume-game').classList.toggle('hidden', !showResume);

    const mins = Math.floor(this.elapsedTime / 60);
    const secs = Math.floor(this.elapsedTime % 60);
    document.getElementById('stat-time').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('stat-level').textContent = p.level;
    document.getElementById('stat-kills').textContent = p.kills;
    document.getElementById('stat-parries').textContent = p.parryCount;
    document.getElementById('stat-corruption').textContent = `${p.corruption}%`;
    const dps = this.elapsedTime > 1 ? Math.round(p.totalDamageDealt / this.elapsedTime) : 0;
    document.getElementById('stat-damage').textContent = `${dps.toLocaleString()} /s`;

    document.getElementById('gameover-modal').classList.remove('hidden');
  }

  // ==================== MAIN ANIMATION LOOP ====================
  _startLoop() {
    let lastTime = performance.now();

    const tick = (now) => {
      requestAnimationFrame(tick);

      const actualDt = (now - lastTime) / 1000;
      lastTime = now;
      const rawDt = Math.min(0.05, actualDt);

      // FPS counter (only sample active foreground frames, ignoring background tab suspension)
      if (actualDt > 0 && actualDt < 0.12) {
        this.frameCount++;
        this.fpsTimer += actualDt;
        if (this.fpsTimer >= 0.35) {
          this.currentFps = Math.min(144, Math.round(this.frameCount / this.fpsTimer));
          this.frameCount = 0;
          this.fpsTimer = 0;
        }
      }

      if (this.state === 'PLAYING') {
        if (this.hitStopTimer > 0) {
          this.hitStopTimer -= rawDt;
          this.vfx.update(rawDt * 0.2, this.camera);
        } else {
          this.elapsedTime += rawDt;
          this.updatePlayer(rawDt);
          this.updateHordeDirector(rawDt);
          this.updateEnemies(rawDt);
          this.updateWeapons(rawDt);
          this.updateProjectiles(rawDt);
          this.updateGems(rawDt);
          this.vfx.update(rawDt, this.camera);
        }

        this.updateCamera(rawDt);
        this.updateHUD();
      } else {
        // Subtle idle camera orbit on Start Menu
        this.vfx.update(rawDt * 0.3, this.camera);
      }

      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(tick);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__NEON_OVERDRIVE__ = new NeonOverdriveGame();
});
