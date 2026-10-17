# NEON OVERDRIVE: SECTOR ZERO

A 3D isometric mecha horde survival game built with **Three.js (r164)** featuring strict orthographic isometric projection, GPU-instanced horde rendering (500+ active entities at 60 FPS), a custom **EMP Dash-Parry** combat loop, modular hardpoint weapon evolutions, and a procedural Web Audio API dark-synthwave soundtrack & SFX synthesizer.

## Core Features

- **Strict Isometric Orthographic Projection:** Equal-angle `THREE.OrthographicCamera` with smooth exponential damping (`lerp`), cursor look-ahead lead, and directional trauma screen-shake.
- **Thruster Drift & EMP Dash-Parry:** 8-direction camera-aligned isometric movement (`WASD` / `Arrows`), raycasted laser reticle aiming, and a directional **Hyper-Dash** (`Space` / `Shift` / `RMB`) that deflects enemy plasma projectiles at **2.5x damage**, triggers an EMP stun shockwave, and induces tactile hit-stop frames.
- **Modular Hardpoint Chassis & Evolutions:**
  - **Pulse Vulcan** $\rightarrow$ *★ Hyperion Gatling*
  - **Micro-Missile Pods** $\rightarrow$ *★ Valkyrie Barrage*
  - **Tesla Hunter Drone** $\rightarrow$ *★ Storm-Weaver Orbitals*
  - **Cryo-Nova Reactor** $\rightarrow$ *★ Absolute Zero Core*
  - **Viper Rail-Lance** $\rightarrow$ *★ Omega Annihilator*
- **Manufacturer Synergies & System Corruption:** Stack `[PLASMA]`, `[BALLISTIC]`, `[CRYO]`, and `[NANO]` tags to unlock passive chassis bonuses, or accept high-risk **Glitch Overclocks** at level-up.
- **High-Performance GPU Instancing & Spatial Hash Grid:** Zero-allocation 2D spatial hash grid paired with multi-color vertex-baked `THREE.InstancedMesh` pools for Swarmers, Siege-Walkers, Rail-Tripod Snipers, Volatile Tick-Bombers, Projectiles, Data Shards, and 1,500 physics spark particles.

## Quick Start

### Option 1: Zero-Build Static Server (via ES Module Importmap)
```bash
python -m http.server 8123
# Open http://localhost:8123
```

### Option 2: Vite Dev Server
```bash
npm install
npm run dev
```
