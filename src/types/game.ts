export type BikeId = 'apex' | 'volt' | 'viper' | 'phantom' | 'titan';

export type TrackId = 'city' | 'village' | 'forest' | 'coastal';

export type CameraMode = 'far' | 'close' | 'cockpit';

export type GamePhase = 'lobby' | 'countdown' | 'racing' | 'finished';

export type GameMode = 'standard' | 'timetrial' | 'knockout' | 'endless';

export type WeatherMode = 'day' | 'night' | 'rainy' | 'foggy' | 'dynamic';

export type ActiveWeather = 'day' | 'night' | 'rainy' | 'foggy';

export type PaintColorId = 'red' | 'neon_green' | 'matte_black' | 'blue' | 'gold' | 'white';

export type RewardItemId =
  | 'turbo_exhaust'
  | 'slick_tires'
  | 'extended_nitro'
  | 'neon_underglow'
  | 'heavy_bumper'
  | 'mystery_blueprint';

export type PowerUpKind = 'shield' | 'magnet' | 'repair';

export interface PaintColorSpec {
  id: PaintColorId;
  name: string;
  hex: string;
  accentHex: string;
  metalness: number;
  roughness: number;
}

export interface RewardItemSpec {
  id: RewardItemId;
  name: string;
  category: 'Performance' | 'Visual & Tech' | 'Protection' | 'Blueprint';
  description: string;
  bonusLabel: string;
  accentColor: string;
  equippable: boolean;
}

export interface BikeUpgradeLevels {
  engine: number; // 0..5
  handling: number; // 0..5
  nitro: number; // 0..5
}

export interface BikeCustomization {
  paintId: PaintColorId;
  upgrades: BikeUpgradeLevels;
  equippedTools: RewardItemId[];
}

export interface BikeSpec {
  id: BikeId;
  name: string;
  tagline: string;
  bodyStyle: 'superbike' | 'hyper' | 'streetfighter' | 'gt' | 'proto';
  unlockCost: number; // 0 = starter
  blueprintCost?: number; // optional alternate unlock via mystery blueprints
  defaultPaint: PaintColorId;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  wheelColor: string;
  stats: {
    topSpeed: number; // 0-100 display bar
    acceleration: number; // 0-100 display bar
    handling: number; // 0-100 display bar
  };
  physics: {
    maxSpeedMs: number; // m/s
    accelMs2: number; // m/s^2
    steerSpeed: number; // lateral responsiveness
    nitroBonusMs: number; // extra m/s on nitro
    gripFactor: number; // 0.85..1.15 cornering stability
  };
}

export interface EffectiveBikePhysics {
  maxSpeedMs: number;
  accelMs2: number;
  steerSpeed: number;
  nitroBonusMs: number;
  nitroBurnRate: number;
  nitroPickupGain: number;
  gripFactor: number;
  crashMitigation: number; // 0..0.55
  hasUnderglow: boolean;
  hasTurboExhaust: boolean;
  hasHeavyBumper: boolean;
  displayStats: {
    topSpeed: number;
    acceleration: number;
    handling: number;
    nitro: number;
  };
}

export interface TrackSpec {
  id: TrackId;
  name: string;
  subtitle: string;
  description: string;
  hasPoliceChase: boolean;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  roadColor: string;
  footpathColor: string;
  curbColor: string;
  groundColor: string;
  previewGradient: string;
}

export interface UserProfile {
  phone: string | null;
  isGuest: boolean;
  name: string;
  avatar: string;
  coins: number;
  unlockedBikes: BikeId[];
  bikeCustomizations: Partial<Record<BikeId, BikeCustomization>>;
  inventoryTools: RewardItemId[];
  blueprints: number;
  stats: {
    races: number;
    wins: number;
    podiums: number;
    bestWheelie: number;
    bestRaceTimeMs: number | null;
    bestEndlessMeters: number;
    topSpeedKmh: number;
  };
  createdAt: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  wins: number;
  bestRaceTimeMs: number | null;
  bestEndlessMeters: number;
  topSpeedKmh: number;
  isLocal?: boolean;
}

export interface LobbySlot {
  slotIndex: number;
  id: string;
  name: string;
  avatar: string;
  bikeId: BikeId;
  paintId?: PaintColorId;
  underglow?: boolean;
  isLocal: boolean;
  isHuman: boolean;
  isAI: boolean;
  isSpeaking: boolean;
  pingMs?: number;
}

export interface FloatingTag {
  id: string;
  name: string;
  avatar: string;
  isLocal: boolean;
  isSpeaking: boolean;
  positionRank: number;
  x: number;
  y: number;
  visible: boolean;
  distance: number;
}

export interface RaceStanding {
  id: string;
  name: string;
  avatar: string;
  bikeId: BikeId;
  isLocal: boolean;
  isAI: boolean;
  rank: number;
  distanceZ: number;
  finishTimeMs: number | null;
  wheelieScore: number;
  speedKmh: number;
  eliminated?: boolean;
}

export interface PoliceState {
  active: boolean;
  escaped: boolean;
  countdownSec: number; // 15s to escape
  distanceM: number;
  progress: number; // 0-1 along track for mini-map radar
}

export interface RaceFinishSummary {
  standings: RaceStanding[];
  gameMode: GameMode;
  trackId: TrackId;
  weather: WeatherMode;
  elapsedMs: number;
  topSpeedKmh: number;
  distanceM: number;
  coinsCollected: number;
  endReason?: 'finished' | 'knockout_win' | 'eliminated' | 'time_up' | 'wrecked' | 'ended';
}

export interface HudSnapshot {
  speedKmh: number;
  topSpeedKmh: number;
  rpmRatio: number; // 0-1
  gear: number; // 1-6
  nitro: number; // 0-100
  isNitroActive: boolean;
  isWheelie: boolean;
  wheelieScore: number;
  positionRank: number; // 1-5
  progress: number; // 0-1
  distanceM: number;
  remainingMeters: number;
  elapsedMs: number;
  gameMode: GameMode;
  activeWeather: ActiveWeather;
  bikeHealth: number; // 0-100
  coinsCollected: number;
  shieldSec: number;
  magnetSec: number;
  turnWarning: 'left' | 'right' | null;
  turnIntensity: number; // 0..1
  slopeDeg: number;
  checkpointTimerSec: number;
  checkpointIndex: number;
  knockoutTimerSec: number;
  activeRacersCount: number;
  eventNotice: string | null;
  police: PoliceState;
  standings: RaceStanding[];
  floatingTags: FloatingTag[];
  onFootpath: boolean;
  collisionFlash: number; // 0-1
  nitroFlash: number; // 0-1
  boostPadFlash: number; // 0-1
}

export interface ControlInputs {
  accelerate: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  nitro: boolean;
  wheelie: boolean;
}

export interface NetworkRacerUpdate {
  id: string;
  name: string;
  avatar: string;
  bikeId: BikeId;
  paintId?: PaintColorId;
  underglow?: boolean;
  z: number;
  lateralX: number;
  speedMs: number;
  leanAngle: number;
  wheeliePitch: number;
  isNitro: boolean;
  finishTimeMs: number | null;
  wheelieScore: number;
  eliminated?: boolean;
}
