export type BikeId = 'apex' | 'volt' | 'viper' | 'phantom';

export type TrackId = 'city' | 'village' | 'forest' | 'coastal';

export type CameraMode = 'far' | 'close' | 'cockpit';

export type GamePhase = 'lobby' | 'countdown' | 'racing' | 'finished';

export interface BikeSpec {
  id: BikeId;
  name: string;
  tagline: string;
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

export interface LobbySlot {
  slotIndex: number;
  id: string;
  name: string;
  bikeId: BikeId;
  isLocal: boolean;
  isHuman: boolean;
  isAI: boolean;
  isSpeaking: boolean;
  pingMs?: number;
}

export interface FloatingTag {
  id: string;
  name: string;
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
  bikeId: BikeId;
  isLocal: boolean;
  isAI: boolean;
  rank: number;
  distanceZ: number;
  finishTimeMs: number | null;
  wheelieScore: number;
  speedKmh: number;
}

export interface PoliceState {
  active: boolean;
  escaped: boolean;
  countdownSec: number; // 15s to escape
  distanceM: number;
  progress: number; // 0-1 along track for mini-map radar
}

export interface HudSnapshot {
  speedKmh: number;
  rpmRatio: number; // 0-1
  gear: number; // 1-6
  nitro: number; // 0-100
  isNitroActive: boolean;
  isWheelie: boolean;
  wheelieScore: number;
  positionRank: number; // 1-5
  progress: number; // 0-1
  remainingMeters: number;
  elapsedMs: number;
  police: PoliceState;
  standings: RaceStanding[];
  floatingTags: FloatingTag[];
  onFootpath: boolean;
  collisionFlash: number; // 0-1
  nitroFlash: number; // 0-1
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
  bikeId: BikeId;
  z: number;
  lateralX: number;
  speedMs: number;
  leanAngle: number;
  wheeliePitch: number;
  isNitro: boolean;
  finishTimeMs: number | null;
  wheelieScore: number;
}
