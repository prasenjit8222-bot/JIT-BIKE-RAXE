import {
  BikeCustomization,
  BikeId,
  BikeSpec,
  EffectiveBikePhysics,
  GameMode,
  PaintColorId,
  PaintColorSpec,
  RewardItemId,
  RewardItemSpec,
  TrackId,
  TrackSpec,
  WeatherMode,
} from '../types/game';

// 10.8 km curved & elevated circuit (~3 minutes / 180s at normal racing speed)
export const RACE_DISTANCE = 10800;
export const CHECKPOINT_INTERVAL = 1200; // Time Trial checkpoint every 1.2 km
export const KNOCKOUT_INTERVAL_SEC = 35; // Last racer eliminated every 35 seconds

export const UPGRADE_COSTS = [160, 320, 520, 820, 1250];
export const MAX_UPGRADE_LEVEL = 5;

export const PAINT_COLORS: Record<PaintColorId, PaintColorSpec> = {
  red: {
    id: 'red',
    name: 'Crimson Red',
    hex: '#dc2626',
    accentHex: '#f59e0b',
    metalness: 0.74,
    roughness: 0.18,
  },
  neon_green: {
    id: 'neon_green',
    name: 'Neon Green',
    hex: '#22c55e',
    accentHex: '#a3e635',
    metalness: 0.62,
    roughness: 0.2,
  },
  matte_black: {
    id: 'matte_black',
    name: 'Matte Black',
    hex: '#18181b',
    accentHex: '#ef4444',
    metalness: 0.22,
    roughness: 0.72,
  },
  blue: {
    id: 'blue',
    name: 'Electric Blue',
    hex: '#2563eb',
    accentHex: '#38bdf8',
    metalness: 0.78,
    roughness: 0.16,
  },
  gold: {
    id: 'gold',
    name: 'Championship Gold',
    hex: '#eab308',
    accentHex: '#fef08a',
    metalness: 0.9,
    roughness: 0.16,
  },
  white: {
    id: 'white',
    name: 'Pearl White',
    hex: '#f8fafc',
    accentHex: '#0ea5e9',
    metalness: 0.52,
    roughness: 0.2,
  },
};

export const PAINT_COLOR_LIST: PaintColorSpec[] = [
  PAINT_COLORS.red,
  PAINT_COLORS.neon_green,
  PAINT_COLORS.matte_black,
  PAINT_COLORS.blue,
  PAINT_COLORS.gold,
  PAINT_COLORS.white,
];

export const REWARD_ITEMS: Record<RewardItemId, RewardItemSpec> = {
  turbo_exhaust: {
    id: 'turbo_exhaust',
    name: 'Turbo Titanium Exhaust',
    category: 'Performance',
    description: 'Twin high-flow race cans boosting top-end velocity and acceleration punch.',
    bonusLabel: '+14 km/h Top Speed · +8% Accel',
    accentColor: '#f97316',
    equippable: true,
  },
  slick_tires: {
    id: 'slick_tires',
    name: 'Racing Slick Tires',
    category: 'Performance',
    description: 'MotoGP soft-compound slicks for razor grip through sharp S-curves and bends.',
    bonusLabel: '+28% Curve Grip · Faster Lean',
    accentColor: '#22c55e',
    equippable: true,
  },
  extended_nitro: {
    id: 'extended_nitro',
    name: 'Extended Nitro Tank',
    category: 'Performance',
    description: 'High-pressure twin-chamber N2O cylinder delivering longer boost bursts.',
    bonusLabel: '+35% Nitro Duration & Pickup',
    accentColor: '#06b6d4',
    equippable: true,
  },
  neon_underglow: {
    id: 'neon_underglow',
    name: 'Neon Underglow Lights',
    category: 'Visual & Tech',
    description: 'High-output LED under-chassis light strip illuminating the asphalt, especially at night.',
    bonusLabel: 'Live 3D Chassis Neon Glow',
    accentColor: '#a855f7',
    equippable: true,
  },
  heavy_bumper: {
    id: 'heavy_bumper',
    name: 'Heavy Bumper Guard',
    category: 'Protection',
    description: 'Carbon-titanium front ram frame absorbing traffic and barrier impacts.',
    bonusLabel: '-55% Crash Damage & Speed Loss',
    accentColor: '#eab308',
    equippable: true,
  },
  mystery_blueprint: {
    id: 'mystery_blueprint',
    name: 'Titan RR Blueprint',
    category: 'Blueprint',
    description: 'Collect 3 Blueprints to unlock the Prototype Titan RR-1200 for free (+350 Coins if owned).',
    bonusLabel: 'Unlocks Prototype Superbike',
    accentColor: '#38bdf8',
    equippable: false,
  },
};

export const REWARD_ITEM_LIST: RewardItemSpec[] = [
  REWARD_ITEMS.turbo_exhaust,
  REWARD_ITEMS.slick_tires,
  REWARD_ITEMS.extended_nitro,
  REWARD_ITEMS.neon_underglow,
  REWARD_ITEMS.heavy_bumper,
  REWARD_ITEMS.mystery_blueprint,
];

export const BIKES: Record<BikeId, BikeSpec> = {
  apex: {
    id: 'apex',
    name: 'Apex V4-R',
    tagline: 'Track-tuned V4 superbike with balanced aero downforce',
    bodyStyle: 'superbike',
    unlockCost: 0,
    defaultPaint: 'red',
    primaryColor: '#dc2626',
    secondaryColor: '#18181b',
    accentColor: '#f59e0b',
    wheelColor: '#d4d4d8',
    stats: {
      topSpeed: 78,
      acceleration: 78,
      handling: 80,
    },
    physics: {
      maxSpeedMs: 70, // ~252 km/h base
      accelMs2: 24.5,
      steerSpeed: 13.8,
      nitroBonusMs: 16,
      gripFactor: 0.96,
    },
  },
  viper: {
    id: 'viper',
    name: 'Viper RS-900',
    tagline: 'Featherweight streetfighter engineered for razor-sharp switchbacks',
    bodyStyle: 'streetfighter',
    unlockCost: 600,
    defaultPaint: 'neon_green',
    primaryColor: '#22c55e',
    secondaryColor: '#111827',
    accentColor: '#a3e635',
    wheelColor: '#22c55e',
    stats: {
      topSpeed: 80,
      acceleration: 89,
      handling: 94,
    },
    physics: {
      maxSpeedMs: 71.5, // ~257 km/h base
      accelMs2: 28.5,
      steerSpeed: 16.0,
      nitroBonusMs: 16.5,
      gripFactor: 1.12,
    },
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom GT',
    tagline: 'Endurance carbon hyperbike built for relentless 3-minute sprints',
    bodyStyle: 'gt',
    unlockCost: 1100,
    defaultPaint: 'white',
    primaryColor: '#f8fafc',
    secondaryColor: '#1e293b',
    accentColor: '#3b82f6',
    wheelColor: '#94a3b8',
    stats: {
      topSpeed: 88,
      acceleration: 84,
      handling: 87,
    },
    physics: {
      maxSpeedMs: 75, // ~270 km/h base
      accelMs2: 26.5,
      steerSpeed: 14.6,
      nitroBonusMs: 18,
      gripFactor: 1.04,
    },
  },
  volt: {
    id: 'volt',
    name: 'Volt Hyper-X',
    tagline: 'High-voltage twin-rotor interceptor with extreme straight-line speed',
    bodyStyle: 'hyper',
    unlockCost: 1650,
    defaultPaint: 'blue',
    primaryColor: '#2563eb',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    wheelColor: '#0ea5e9',
    stats: {
      topSpeed: 94,
      acceleration: 83,
      handling: 81,
    },
    physics: {
      maxSpeedMs: 78.5, // ~283 km/h base
      accelMs2: 26.0,
      steerSpeed: 13.4,
      nitroBonusMs: 20,
      gripFactor: 0.94,
    },
  },
  titan: {
    id: 'titan',
    name: 'Titan RR-1200',
    tagline: 'Factory MotoGP prototype with quad under-tail exhausts & carbon aero',
    bodyStyle: 'proto',
    unlockCost: 2400,
    blueprintCost: 3,
    defaultPaint: 'gold',
    primaryColor: '#eab308',
    secondaryColor: '#090d17',
    accentColor: '#fef08a',
    wheelColor: '#f59e0b',
    stats: {
      topSpeed: 98,
      acceleration: 94,
      handling: 93,
    },
    physics: {
      maxSpeedMs: 82.5, // ~297 km/h base
      accelMs2: 30.5,
      steerSpeed: 15.8,
      nitroBonusMs: 22,
      gripFactor: 1.14,
    },
  },
};

export const BIKE_LIST: BikeSpec[] = [
  BIKES.apex,
  BIKES.viper,
  BIKES.phantom,
  BIKES.volt,
  BIKES.titan,
];

export function getDefaultBikeCustomization(bikeId: BikeId): BikeCustomization {
  return {
    paintId: BIKES[bikeId].defaultPaint,
    upgrades: { engine: 0, handling: 0, nitro: 0 },
    equippedTools: [],
  };
}

export function computeEffectiveBikePhysics(
  bikeId: BikeId,
  custom?: BikeCustomization
): EffectiveBikePhysics {
  const spec = BIKES[bikeId];
  const cfg = custom ?? getDefaultBikeCustomization(bikeId);
  const tools = new Set(cfg.equippedTools ?? []);

  const engLv = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, cfg.upgrades?.engine ?? 0));
  const hanLv = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, cfg.upgrades?.handling ?? 0));
  const nitLv = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, cfg.upgrades?.nitro ?? 0));

  const hasTurbo = tools.has('turbo_exhaust');
  const hasSlicks = tools.has('slick_tires');
  const hasExtNitro = tools.has('extended_nitro');
  const hasUnderglow = tools.has('neon_underglow');
  const hasHeavyBumper = tools.has('heavy_bumper');

  const maxSpeedMs = spec.physics.maxSpeedMs + engLv * 2.2 + (hasTurbo ? 3.9 : 0);
  const accelMs2 = spec.physics.accelMs2 * (1 + engLv * 0.045 + (hasTurbo ? 0.08 : 0));
  const steerSpeed = spec.physics.steerSpeed + hanLv * 0.65 + (hasSlicks ? 1.35 : 0);
  const gripFactor = spec.physics.gripFactor + hanLv * 0.055 + (hasSlicks ? 0.28 : 0);
  const nitroBonusMs = spec.physics.nitroBonusMs + nitLv * 1.4 + (hasTurbo ? 2.0 : 0);
  const nitroBurnRate = Math.max(11, 24 - nitLv * 1.9 - (hasExtNitro ? 6.0 : 0));
  const nitroPickupGain = 30 + nitLv * 4 + (hasExtNitro ? 14 : 0);
  const crashMitigation = hasHeavyBumper ? 0.55 : 0;

  return {
    maxSpeedMs,
    accelMs2,
    steerSpeed,
    nitroBonusMs,
    nitroBurnRate,
    nitroPickupGain,
    gripFactor,
    crashMitigation,
    hasUnderglow,
    hasTurboExhaust: hasTurbo,
    hasHeavyBumper,
    displayStats: {
      topSpeed: Math.min(100, Math.round(spec.stats.topSpeed + engLv * 3.2 + (hasTurbo ? 5 : 0))),
      acceleration: Math.min(
        100,
        Math.round(spec.stats.acceleration + engLv * 2.4 + (hasTurbo ? 4 : 0))
      ),
      handling: Math.min(
        100,
        Math.round(spec.stats.handling + hanLv * 3.0 + (hasSlicks ? 8 : 0))
      ),
      nitro: Math.min(100, Math.round(62 + nitLv * 6 + (hasExtNitro ? 14 : 0))),
    },
  };
}

export const GAME_MODE_LIST: Array<{
  id: GameMode;
  name: string;
  shortDesc: string;
  badge: string;
}> = [
  {
    id: 'standard',
    name: 'Standard Race',
    shortDesc: 'Full 10.8 km (~3 min) curved circuit vs 4 racers',
    badge: '~3 Min',
  },
  {
    id: 'timetrial',
    name: 'Time Trial',
    shortDesc: 'Beat every 1.2 km checkpoint timer to the finish',
    badge: 'Checkpoints',
  },
  {
    id: 'knockout',
    name: 'Knockout',
    shortDesc: 'Last racer eliminated every 35s until 1 winner survives',
    badge: '35s Elim',
  },
  {
    id: 'endless',
    name: 'Endless Highway',
    shortDesc: 'Infinite curved road with rising speed & distance score',
    badge: 'Infinite',
  },
];

export const WEATHER_MODE_LIST: Array<{
  id: WeatherMode;
  name: string;
  detail: string;
}> = [
  { id: 'day', name: 'Day', detail: 'Crisp sunlight & clear curves' },
  { id: 'night', name: 'Night', detail: '3D headlights & lit streetlamps' },
  { id: 'rainy', name: 'Rainy', detail: 'Rain streaks & wet reflections' },
  { id: 'foggy', name: 'Foggy', detail: 'Low-visibility mountain mist' },
  { id: 'dynamic', name: 'Dynamic', detail: 'Transitions Day → Night → Rain' },
];

export const TRACKS: Record<TrackId, TrackSpec> = {
  city: {
    id: 'city',
    name: 'City Road',
    subtitle: 'Urban S-Curves · Police Pursuit Zone',
    description:
      'High-rise expressway with sharp urban bends, elevated overpasses, dense traffic, and active Police Interceptor pursuits.',
    hasPoliceChase: true,
    skyColor: '#1e355c',
    fogColor: '#2b456e',
    fogDensity: 0.0028,
    sunColor: '#ffe8c2',
    sunIntensity: 2.15,
    hemiSky: '#7da7e6',
    hemiGround: '#1e293b',
    roadColor: '#232833',
    footpathColor: '#64748b',
    curbColor: '#cbd5e1',
    groundColor: '#161b26',
    previewGradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #f59e0b 140%)',
  },
  village: {
    id: 'village',
    name: 'Village Road',
    subtitle: 'Rolling Hills · Sweeping Country Bends',
    description:
      'Sunlit rural tarmac winding across rolling hilltops, village cottages, timber guardrails, and technical S-turns.',
    hasPoliceChase: false,
    skyColor: '#78b8e6',
    fogColor: '#9fd0ef',
    fogDensity: 0.0024,
    sunColor: '#fff3d6',
    sunIntensity: 2.4,
    hemiSky: '#b6e2ff',
    hemiGround: '#4a6b35',
    roadColor: '#353942',
    footpathColor: '#8d7356',
    curbColor: '#a89074',
    groundColor: '#4c7c34',
    previewGradient: 'linear-gradient(135deg, #1f4d2e 0%, #3b7a48 55%, #84cc16 140%)',
  },
  forest: {
    id: 'forest',
    name: 'Forest Road',
    subtitle: 'Mountain Switchbacks · Steep Slopes',
    description:
      'Challenging alpine pass carved through towering pines with tight hairpins, climbs, and rapid downhill descents.',
    hasPoliceChase: false,
    skyColor: '#4f7a6d',
    fogColor: '#648f82',
    fogDensity: 0.0036,
    sunColor: '#ffdfa8',
    sunIntensity: 2.0,
    hemiSky: '#8cc7b0',
    hemiGround: '#243b29',
    roadColor: '#2c3138',
    footpathColor: '#5c5346',
    curbColor: '#7a7267',
    groundColor: '#28472e',
    previewGradient: 'linear-gradient(135deg, #132a1e 0%, #24523b 60%, #10b981 140%)',
  },
  coastal: {
    id: 'coastal',
    name: 'Coastal Road',
    subtitle: 'Cliffside Curves · Ocean Highway',
    description:
      'Sweeping oceanfront cliff highway with high-speed seaside bends, animated surf, palm groves, and coastal rises.',
    hasPoliceChase: false,
    skyColor: '#5cb3e8',
    fogColor: '#8ed0f5',
    fogDensity: 0.0023,
    sunColor: '#fff6e0',
    sunIntensity: 2.5,
    hemiSky: '#b8e8ff',
    hemiGround: '#c9a973',
    roadColor: '#303640',
    footpathColor: '#d4c3a3',
    curbColor: '#e5dccb',
    groundColor: '#d9be8b',
    previewGradient: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 60%, #f59e0b 140%)',
  },
};

export const TRACK_LIST: TrackSpec[] = [
  TRACKS.city,
  TRACKS.village,
  TRACKS.forest,
  TRACKS.coastal,
];

export const AI_RACER_PROFILES: Array<{
  name: string;
  bikeId: BikeId;
  paintId: PaintColorId;
  skill: number;
}> = [
  { name: 'Kaito Takahashi', bikeId: 'volt', paintId: 'blue', skill: 0.96 },
  { name: 'Elena Vance', bikeId: 'apex', paintId: 'red', skill: 0.92 },
  { name: 'Marcus Cole', bikeId: 'phantom', paintId: 'white', skill: 0.9 },
  { name: 'Sora Lindqvist', bikeId: 'viper', paintId: 'neon_green', skill: 0.94 },
  { name: 'Vikram Singh', bikeId: 'titan', paintId: 'gold', skill: 0.97 },
];
