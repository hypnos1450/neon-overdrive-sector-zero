// Modular Hardpoint Weapons, Manufacturer Synergies, & System Corruption Overclocks

export const WEAPON_DEFS = {
  vulcan: {
    id: 'vulcan',
    name: 'Pulse Vulcan',
    evolvedName: 'HYPERION GATLING',
    slot: 'ARM CANNON',
    tags: ['PLASMA', 'BALLISTIC'],
    maxLevel: 5,
    descriptions: [
      'Rapid-fire twin plasma-kinetic cannons.',
      'LVL 2: +25% Damage & +15% Fire Rate.',
      'LVL 3: Fires 3 bolts per burst in a tight spread.',
      'LVL 4: Bolts pierce +1 additional hostile & +25% Damage.',
      'EVOLUTION // HYPERION GATLING: Unleashes a 5-bolt hyper-velocity piercing plasma barrage!'
    ]
  },
  missiles: {
    id: 'missiles',
    name: 'Micro-Missile Pods',
    evolvedName: 'VALKYRIE BARRAGE',
    slot: 'SHOULDER PODS',
    tags: ['BALLISTIC'],
    maxLevel: 5,
    descriptions: [
      'Launches homing micro-missiles that detonate for AoE splash damage.',
      'LVL 2: +1 Missile per salvo & +20% Blast Radius.',
      'LVL 3: +35% Explosion Damage & faster reload.',
      'LVL 4: +2 Missiles per salvo & larger shockwaves.',
      'EVOLUTION // VALKYRIE BARRAGE: Fires 6 thermobaric warheads that obliterate clustered swarms!'
    ]
  },
  drone: {
    id: 'drone',
    name: 'Tesla Hunter Drone',
    evolvedName: 'STORM-WEAVER ORBITALS',
    slot: 'AUTONOMOUS DRONE',
    tags: ['NANO', 'PLASMA'],
    maxLevel: 5,
    descriptions: [
      'Deploys an orbiting cyber-drone that slices foes and zaps nearby targets with lightning.',
      'LVL 2: Deploys 2 orbiting drones & +25% Arc Damage.',
      'LVL 3: +1 Chain Lightning bounce & faster orbital velocity.',
      'LVL 4: Deploys 3 orbiting drones & +30% Arc Frequency.',
      'EVOLUTION // STORM-WEAVER ORBITALS: 4 hyper-speed orbital blades chaining high-voltage lightning across 5 targets!'
    ]
  },
  cryo: {
    id: 'cryo',
    name: 'Cryo-Nova Reactor',
    evolvedName: 'ABSOLUTE ZERO CORE',
    slot: 'REACTOR AURA',
    tags: ['CRYO'],
    maxLevel: 5,
    descriptions: [
      'Periodically emits a sub-zero hexagonal shockwave that damages and slows nearby hostiles.',
      'LVL 2: +25% Nova Radius & stronger movement slow.',
      'LVL 3: +40% Nova Damage & -15% Pulse Cooldown.',
      'LVL 4: Chilled enemies take +20% bonus damage from all weapons.',
      'EVOLUTION // ABSOLUTE ZERO CORE: Massive cryo-singularity pulse that freezes hostiles solid and shatters them!'
    ]
  },
  railgun: {
    id: 'railgun',
    name: 'Viper Rail-Lance',
    evolvedName: 'OMEGA ANNIHILATOR',
    slot: 'DORSAL LANCE',
    tags: ['PLASMA', 'BALLISTIC'],
    maxLevel: 5,
    descriptions: [
      'Locks onto high-threat targets and fires an instant hyper-piercing railgun beam.',
      'LVL 2: +35% Rail Damage & -15% Charge Time.',
      'LVL 3: Wider beam bore & guaranteed Critical Hit against full-HP targets.',
      'LVL 4: Fires 2 consecutive rail lances per cycle.',
      'EVOLUTION // OMEGA ANNIHILATOR: Twin hyper-rail beams that trigger secondary EMP blasts along the beam path!'
    ]
  }
};

export const PASSIVE_DEFS = {
  thrusters: {
    id: 'thrusters',
    name: 'Thruster Drift Jets',
    slot: 'CHASSIS MOBILITY',
    tags: ['NANO'],
    maxLevel: 4,
    desc: '+14% Move Speed, -15% Dash Cooldown, & +25% EMP Dash-Parry Blast Radius.'
  },
  magnet: {
    id: 'magnet',
    name: 'Graviton Tractor Core',
    slot: 'TELEMETRY MODULE',
    tags: ['NANO'],
    maxLevel: 4,
    desc: '+45% Data Shard Magnet Radius & +18% XP Gain.'
  },
  targeting: {
    id: 'targeting',
    name: 'Neural Crit Matrix',
    slot: 'OPTICS MODULE',
    tags: ['PLASMA'],
    maxLevel: 4,
    desc: '+10% Critical Hit Chance & +35% Critical Hit Multiplier.'
  },
  overclock: {
    id: 'overclock',
    name: 'Cryo-Flux Capacitor',
    slot: 'COOLING MODULE',
    tags: ['CRYO'],
    maxLevel: 4,
    desc: '+18% Global Fire Rate & -12% Weapon Cooldowns.'
  },
  plating: {
    id: 'plating',
    name: 'Reactive Nano-Plating',
    slot: 'ARMOR MODULE',
    tags: ['BALLISTIC'],
    maxLevel: 4,
    desc: '+35 Max Hull Integrity, restores 35 HP immediately, & +1.5 HP/s Hull Repair.'
  }
};

export const CORRUPTED_DEFS = [
  {
    id: 'glitch_multishot',
    name: 'GLITCH // BIFURCATED CHAMBER',
    slot: 'CORRUPTED OVERCLOCK',
    tags: ['BALLISTIC', 'PLASMA'],
    corruptionCost: 20,
    desc: '+1 Bonus Projectile to Vulcan & Missile salvos and +20% Global Damage. (+20% System Corruption)'
  },
  {
    id: 'glitch_vamp',
    name: 'GLITCH // PARASITIC SIPHON',
    slot: 'CORRUPTED OVERCLOCK',
    tags: ['NANO'],
    corruptionCost: 15,
    desc: 'EMP Dash-Parries and Elite kills restore +12 Hull Integrity and grant 3s Overdrive Haste. (+15% System Corruption)'
  },
  {
    id: 'glitch_hyper',
    name: 'GLITCH // UNSHACKLED REACTOR',
    slot: 'CORRUPTED OVERCLOCK',
    tags: ['CRYO', 'PLASMA'],
    corruptionCost: 25,
    desc: '+30% Global Fire Rate and +40% EMP Dash-Parry Deflection Damage. (+25% System Corruption)'
  }
];

export const SYNERGY_INFO = [
  { tag: 'PLASMA', threshold: 3, label: 'PLASMA (3): +22% DMG' },
  { tag: 'BALLISTIC', threshold: 3, label: 'BALLISTIC (3): +25% PROJ SPD' },
  { tag: 'CRYO', threshold: 2, label: 'CRYO (2): +20% SHATTER' },
  { tag: 'NANO', threshold: 3, label: 'NANO (3): +1 DASH CHARGE' }
];

export class UpgradeSystem {
  constructor(playerState) {
    this.player = playerState;
  }

  /**
   * Generates 3 distinct upgrade choices tailored to the player's current build.
   */
  generateChoices(count = 3) {
    const pool = [];

    // 1. Add Weapon unlocks & upgrades
    for (const key of Object.keys(WEAPON_DEFS)) {
      const def = WEAPON_DEFS[key];
      const currentLvl = this.player.weapons[key] || 0;
      if (currentLvl < def.maxLevel) {
        const nextLvl = currentLvl + 1;
        const isEvo = nextLvl === def.maxLevel;
        pool.push({
          kind: 'weapon',
          id: key,
          title: isEvo ? `★ ${def.evolvedName}` : def.name,
          slot: isEvo ? 'ULTIMATE EVOLUTION' : def.slot,
          levelText: currentLvl === 0 ? 'NEW HARDPOINT' : `LVL ${currentLvl} → ${nextLvl}`,
          desc: def.descriptions[nextLvl - 1],
          tags: def.tags,
          isEvolution: isEvo,
          isCorrupted: false,
          weight: isEvo ? 4.0 : currentLvl > 0 ? 2.2 : 1.5
        });
      }
    }

    // 2. Add Passive modules
    for (const key of Object.keys(PASSIVE_DEFS)) {
      const def = PASSIVE_DEFS[key];
      const currentLvl = this.player.passives[key] || 0;
      if (currentLvl < def.maxLevel) {
        const nextLvl = currentLvl + 1;
        pool.push({
          kind: 'passive',
          id: key,
          title: def.name,
          slot: def.slot,
          levelText: currentLvl === 0 ? 'INSTALL MODULE' : `TIER ${currentLvl} → ${nextLvl}`,
          desc: def.desc,
          tags: def.tags,
          isEvolution: false,
          isCorrupted: false,
          weight: 1.35
        });
      }
    }

    // 3. Add Corrupted Glitch Overclock option (if corruption < 100%)
    if (this.player.corruption < 100) {
      for (const cDef of CORRUPTED_DEFS) {
        const taken = this.player.corruptedPerks[cDef.id] || 0;
        if (taken < 2) {
          pool.push({
            kind: 'corrupted',
            id: cDef.id,
            title: cDef.name,
            slot: cDef.slot,
            levelText: `+${cDef.corruptionCost}% CORRUPTION`,
            desc: cDef.desc,
            tags: cDef.tags,
            corruptionCost: cDef.corruptionCost,
            isEvolution: false,
            isCorrupted: true,
            weight: 1.15
          });
        }
      }
    }

    // Weighted random selection without duplicates
    const selected = [];
    const candidates = [...pool];
    while (selected.length < count && candidates.length > 0) {
      const totalWeight = candidates.reduce((acc, c) => acc + c.weight, 0);
      let r = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let i = 0; i < candidates.length; i++) {
        r -= candidates[i].weight;
        if (r <= 0) {
          chosenIdx = i;
          break;
        }
      }
      selected.push(candidates[chosenIdx]);
      candidates.splice(chosenIdx, 1);
    }

    return selected;
  }

  applyChoice(choice) {
    // Increment manufacturer synergy tags
    for (const t of choice.tags) {
      this.player.tagCounts[t] = (this.player.tagCounts[t] || 0) + 1;
    }

    if (choice.kind === 'weapon') {
      this.player.weapons[choice.id] = (this.player.weapons[choice.id] || 0) + 1;
    } else if (choice.kind === 'passive') {
      this.player.passives[choice.id] = (this.player.passives[choice.id] || 0) + 1;
      if (choice.id === 'thrusters') {
        this.player.moveSpeed *= 1.14;
        this.player.dashCooldown *= 0.85;
        this.player.parryRadius *= 1.25;
      } else if (choice.id === 'magnet') {
        this.player.pickupRadius *= 1.45;
        this.player.xpMultiplier *= 1.18;
      } else if (choice.id === 'targeting') {
        this.player.critChance += 0.1;
        this.player.critMultiplier += 0.35;
      } else if (choice.id === 'overclock') {
        this.player.fireRateMultiplier *= 1.18;
      } else if (choice.id === 'plating') {
        this.player.maxHp += 35;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
        this.player.hpRegen += 1.5;
      }
    } else if (choice.kind === 'corrupted') {
      this.player.corruptedPerks[choice.id] = (this.player.corruptedPerks[choice.id] || 0) + 1;
      this.player.corruption = Math.min(100, this.player.corruption + choice.corruptionCost);

      if (choice.id === 'glitch_multishot') {
        this.player.bonusProjectiles += 1;
        this.player.damageMultiplier *= 1.2;
      } else if (choice.id === 'glitch_vamp') {
        this.player.parryHeal += 12;
      } else if (choice.id === 'glitch_hyper') {
        this.player.fireRateMultiplier *= 1.3;
        this.player.parryDamageMultiplier *= 1.4;
      }
    }

    // Recompute Manufacturer Tag Synergies
    this.player.synergyDamageBonus = (this.player.tagCounts.PLASMA || 0) >= 3 ? 1.22 : 1.0;
    this.player.synergyProjSpeedBonus = (this.player.tagCounts.BALLISTIC || 0) >= 3 ? 1.25 : 1.0;
    this.player.synergyCryoBonus = (this.player.tagCounts.CRYO || 0) >= 2 ? 1.2 : 1.0;
    this.player.maxDashCharges = (this.player.tagCounts.NANO || 0) >= 3 ? 3 : 2;
  }
}
