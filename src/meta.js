// Playable Mech Chassis Roster & Persistent Scrap Core Meta-Progression (localStorage)

const STORAGE_KEY = 'NEON_OVERDRIVE_META_V1';

export const CHASSIS_DEFS = {
  valkyrie: {
    id: 'valkyrie',
    code: 'VX-09 VALKYRIE',
    role: 'BALANCED STRIKER // INTERCEPT FRAME',
    badgeColor: 'cyan',
    startingWeapons: { vulcan: 1, missiles: 0, drone: 0, cryo: 0, railgun: 0 },
    startingTags: { PLASMA: 1, BALLISTIC: 1, CRYO: 0, NANO: 0 },
    baseStats: {
      maxHp: 125,
      hpRegen: 0.6,
      moveSpeed: 10.0,
      dashCharges: 2,
      dashCooldown: 2.1,
      critChance: 0.14,
      critMultiplier: 1.9,
      parryRadius: 3.1,
      parryDamageMultiplier: 2.6,
      damageMultiplier: 1.0
    },
    visuals: {
      armorColor: 0xe6f2ff,
      hullColor: 0x1c2838,
      coreColor: 0x00e5ff,
      visorColor: 0x00ff9d,
      torsoScaleX: 1.0,
      torsoScaleY: 1.0
    },
    weaponsLabel: 'Pulse Vulcan L1',
    statsLabel: '125 HP | 10.0 SPD | 2 DASHES',
    passiveTitle: 'AEGIS DEFLECTOR',
    passiveDesc: '+25% EMP Dash-Parry radius and grants 3.5s Overdrive Fire-Rate Haste on every parry.'
  },
  titan: {
    id: 'titan',
    code: 'KR-77 TITAN',
    role: 'HEAVY SIEGE JUGGERNAUT // ORDINANCE',
    badgeColor: 'amber',
    startingWeapons: { vulcan: 1, missiles: 1, drone: 0, cryo: 1, railgun: 0 },
    startingTags: { PLASMA: 0, BALLISTIC: 2, CRYO: 1, NANO: 0 },
    baseStats: {
      maxHp: 210,
      hpRegen: 2.2,
      moveSpeed: 8.5,
      dashCharges: 2,
      dashCooldown: 2.4,
      critChance: 0.1,
      critMultiplier: 1.8,
      parryRadius: 3.4,
      parryDamageMultiplier: 3.0,
      damageMultiplier: 1.22
    },
    visuals: {
      armorColor: 0xffaa22,
      hullColor: 0x2b1e16,
      coreColor: 0xff5500,
      visorColor: 0xff1e6b,
      torsoScaleX: 1.26,
      torsoScaleY: 1.12
    },
    weaponsLabel: 'Micro-Missiles L1 + Cryo-Nova L1 + Vulcan L1',
    statsLabel: '210 HP | 2.2 REGEN | +22% DMG',
    passiveTitle: 'SIEGE JUGGERNAUT',
    passiveDesc: 'Starts with Shoulder Missiles & Cryo-Nova active. Dashing crushes hostiles with +22% base damage.'
  },
  phantom: {
    id: 'phantom',
    code: 'NX-13 PHANTOM',
    role: 'CYBER-ASSASSIN // HYPER-RAIL & DRONES',
    badgeColor: 'magenta',
    startingWeapons: { vulcan: 1, missiles: 0, drone: 1, cryo: 0, railgun: 1 },
    startingTags: { PLASMA: 2, BALLISTIC: 1, CRYO: 0, NANO: 1 },
    baseStats: {
      maxHp: 95,
      hpRegen: 0.4,
      moveSpeed: 11.8,
      dashCharges: 3,
      dashCooldown: 1.65,
      critChance: 0.28,
      critMultiplier: 2.35,
      parryRadius: 2.9,
      parryDamageMultiplier: 3.5,
      damageMultiplier: 1.12
    },
    visuals: {
      armorColor: 0xc87eff,
      hullColor: 0x160f29,
      coreColor: 0xff1e6b,
      visorColor: 0x00f0ff,
      torsoScaleX: 0.88,
      torsoScaleY: 0.96
    },
    weaponsLabel: 'Viper Rail-Lance L1 + Tesla Drone L1 + Vulcan L1',
    statsLabel: '3 DASHES | 11.8 SPD | 28% CRIT',
    passiveTitle: 'PHASE-CLOAK OVERDRIVE',
    passiveDesc: 'Starts with 3 Dash Charges, Dorsal Rail-Lance & Tesla Drone, and +50% EMP Parry lethality.'
  }
};

export const ARMORY_UPGRADES = [
  {
    id: 'hull',
    name: 'Titanium Hull Plating',
    icon: '🛡',
    maxTier: 5,
    baseCost: 30,
    costScale: 25,
    descPerTier: '+20 Max HP & +0.5 HP/s Repair'
  },
  {
    id: 'firepower',
    name: 'Overclocked Munitions',
    icon: '🔥',
    maxTier: 5,
    baseCost: 35,
    costScale: 30,
    descPerTier: '+12% Weapon Damage & +6% Fire Rate'
  },
  {
    id: 'servos',
    name: 'Vector Thruster Servos',
    icon: '⚡',
    maxTier: 5,
    baseCost: 30,
    costScale: 25,
    descPerTier: '+6% Move Speed & -8% Dash Cooldown'
  },
  {
    id: 'parry',
    name: 'EMP Parry Capacitors',
    icon: '💠',
    maxTier: 5,
    baseCost: 35,
    costScale: 25,
    descPerTier: '+30% Parry Damage & +5 HP Heal on Parry'
  },
  {
    id: 'magnet',
    name: 'Graviton Scrap Harvester',
    icon: '🧲',
    maxTier: 5,
    baseCost: 25,
    costScale: 20,
    descPerTier: '+22% Pickup Radius & +15% XP / Scrap Gain'
  },
  {
    id: 'tactical',
    name: 'Neural Targeting & Rerolls',
    icon: '🎯',
    maxTier: 5,
    baseCost: 40,
    costScale: 35,
    descPerTier: '+1 Level-Up Reroll & +5% Crit Chance'
  }
];

export class MetaProgression {
  constructor() {
    this.data = {
      selectedChassis: 'valkyrie',
      scrapCores: 120, // Initial starter grant so players can customize immediately
      totalRuns: 0,
      bestKills: 0,
      upgrades: {
        hull: 0,
        firepower: 0,
        servos: 0,
        parry: 0,
        magnet: 0,
        tactical: 0
      }
    };
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data.selectedChassis = CHASSIS_DEFS[parsed.selectedChassis]
          ? parsed.selectedChassis
          : 'valkyrie';
        if (typeof parsed.scrapCores === 'number') {
          this.data.scrapCores = Math.max(0, Math.floor(parsed.scrapCores));
        }
        this.data.totalRuns = parsed.totalRuns || 0;
        this.data.bestKills = parsed.bestKills || 0;
        if (parsed.upgrades) {
          for (const u of ARMORY_UPGRADES) {
            this.data.upgrades[u.id] = Math.min(
              u.maxTier,
              Math.max(0, parsed.upgrades[u.id] || 0)
            );
          }
        }
      }
    } catch (_) {
      // Fallback to in-memory defaults if localStorage is restricted
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (_) {
      // Ignore storage quota errors
    }
  }

  selectChassis(chassisId) {
    if (!CHASSIS_DEFS[chassisId]) return;
    this.data.selectedChassis = chassisId;
    this.save();
  }

  getSelectedChassisDef() {
    return CHASSIS_DEFS[this.data.selectedChassis] || CHASSIS_DEFS.valkyrie;
  }

  getUpgradeTier(id) {
    return this.data.upgrades[id] || 0;
  }

  getUpgradeCost(def) {
    const tier = this.getUpgradeTier(def.id);
    if (tier >= def.maxTier) return Infinity;
    return def.baseCost + tier * def.costScale;
  }

  buyUpgrade(id) {
    const def = ARMORY_UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const cost = this.getUpgradeCost(def);
    if (this.data.scrapCores < cost) return false;

    this.data.scrapCores -= cost;
    this.data.upgrades[id] = (this.data.upgrades[id] || 0) + 1;
    this.save();
    return true;
  }

  refundAllUpgrades() {
    let refunded = 0;
    for (const def of ARMORY_UPGRADES) {
      const tier = this.getUpgradeTier(def.id);
      for (let t = 0; t < tier; t++) {
        refunded += def.baseCost + t * def.costScale;
      }
      this.data.upgrades[def.id] = 0;
    }
    this.data.scrapCores += refunded;
    this.save();
    return refunded;
  }

  addScrap(amount) {
    const mult = 1.0 + this.getUpgradeTier('magnet') * 0.15;
    const gained = Math.max(1, Math.round(amount * mult));
    this.data.scrapCores += gained;
    this.save();
    return gained;
  }

  /**
   * Computes combined starting player stats from Selected Chassis + Persistent Armory Upgrades.
   */
  computeStartingStats() {
    const chassis = this.getSelectedChassisDef();
    const b = chassis.baseStats;
    const u = this.data.upgrades;

    return {
      chassisId: chassis.id,
      chassisCode: chassis.code,
      maxHp: Math.round(b.maxHp + (u.hull || 0) * 20),
      hpRegen: +(b.hpRegen + (u.hull || 0) * 0.5).toFixed(2),
      moveSpeed: +(b.moveSpeed * (1 + (u.servos || 0) * 0.06)).toFixed(2),
      dashCharges: b.dashCharges,
      maxDashCharges: b.dashCharges,
      dashCooldown: +(b.dashCooldown * Math.pow(0.92, u.servos || 0)).toFixed(2),
      critChance: +(b.critChance + (u.tactical || 0) * 0.05).toFixed(2),
      critMultiplier: b.critMultiplier,
      parryRadius: b.parryRadius,
      parryDamageMultiplier: +(b.parryDamageMultiplier * (1 + (u.parry || 0) * 0.3)).toFixed(2),
      parryHeal: (u.parry || 0) * 5,
      damageMultiplier: +(b.damageMultiplier * (1 + (u.firepower || 0) * 0.12)).toFixed(2),
      fireRateMultiplier: +(1.0 + (u.firepower || 0) * 0.06).toFixed(2),
      pickupRadius: +(4.5 * (1 + (u.magnet || 0) * 0.22)).toFixed(2),
      xpMultiplier: +(1.0 + (u.magnet || 0) * 0.15).toFixed(2),
      rerolls: 2 + (u.tactical || 0),
      startingWeapons: { ...chassis.startingWeapons },
      startingTags: { ...chassis.startingTags },
      visuals: chassis.visuals
    };
  }
}
