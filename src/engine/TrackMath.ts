import { TrackId } from '../types/game';

export const ROAD_HALF_WIDTH = 6.2;
export const FOOTPATH_OUTER_X = 8.4;
export const FOOTPATH_CURB_HEIGHT = 0.18;

// Continuous curved ribbon mesh resolution (64 slices * 9m = 576m seamless curved road & barriers)
export const RIBBON_SLICE_COUNT = 64;
export const RIBBON_SLICE_STEP = 9.0;

// Periodic speed breakers every 260m so both 17.6km tracks and Endless Highway have them
export const SPEED_BREAKER_SPACING = 260;

interface TrackCurveProfile {
  a1: number;
  f1: number;
  a2: number;
  f2: number;
  a3: number;
  f3: number;
  // Elevation hills (uphill/downhill slopes)
  e1: number;
  ef1: number;
  e2: number;
  ef2: number;
}

const CURVE_PROFILES: Record<TrackId, TrackCurveProfile> = {
  city: {
    // Sweeping expressway S-curves + sharp cloverleaf bends + overpass rises
    a1: 36,
    f1: 0.0052,
    a2: 22,
    f2: 0.0115,
    a3: 11,
    f3: 0.021,
    e1: 5.5,
    ef1: 0.0038,
    e2: 2.6,
    ef2: 0.0086,
  },
  village: {
    // Rolling countryside hills + continuous sweeping left/right turns
    a1: 42,
    f1: 0.0048,
    a2: 24,
    f2: 0.0122,
    a3: 12,
    f3: 0.0225,
    e1: 8.2,
    ef1: 0.0044,
    e2: 3.8,
    ef2: 0.0102,
  },
  forest: {
    // Tight mountain switchbacks + steep uphill/downhill alpine slopes
    a1: 48,
    f1: 0.0056,
    a2: 27,
    f2: 0.0138,
    a3: 13.5,
    f3: 0.0245,
    e1: 11.5,
    ef1: 0.0048,
    e2: 5.0,
    ef2: 0.0115,
  },
  coastal: {
    // High-speed cliffside sweeping S-bends + coastal rises
    a1: 44,
    f1: 0.0044,
    a2: 25,
    f2: 0.0108,
    a3: 11.5,
    f3: 0.0195,
    e1: 7.4,
    ef1: 0.0036,
    e2: 3.2,
    ef2: 0.0084,
  },
};

// Smooth ramp-in over the first 60m so starting grid is cleanly aligned
function startRamp(z: number): number {
  if (z <= 0) return 0;
  if (z >= 70) return 1;
  const t = z / 70;
  return t * t * (3 - 2 * t);
}

/**
 * Continuous challenging curved road centerline X(z) with sharp turns,
 * S-curves, and sweeping bends tailored per environment.
 */
export function getTrackCenterX(z: number, trackId: TrackId = 'city'): number {
  const p = CURVE_PROFILES[trackId];
  const r = startRamp(z);
  const raw =
    Math.sin(z * p.f1) * p.a1 +
    Math.sin(z * p.f2) * p.a2 +
    Math.sin(z * p.f3) * p.a3;
  return raw * r;
}

/**
 * Analytical / central-difference dX/dZ slope along track.
 */
export function getTrackSlope(z: number, trackId: TrackId = 'city'): number {
  const h = 1.25;
  return (getTrackCenterX(z + h, trackId) - getTrackCenterX(z - h, trackId)) / (2 * h);
}

/**
 * Tangent heading angle (radians) at longitudinal distance z.
 */
export function getTrackYaw(z: number, trackId: TrackId = 'city'): number {
  return Math.atan(getTrackSlope(z, trackId));
}

/**
 * Curvature proxy d²X/dZ²:
 * Positive => road bends toward +X (left in our +Z-forward right-handed view);
 * Negative => road bends toward -X (right).
 */
export function getTrackCurvature(z: number, trackId: TrackId = 'city'): number {
  const h = 4.0;
  const xm = getTrackCenterX(z - h, trackId);
  const x0 = getTrackCenterX(z, trackId);
  const xp = getTrackCenterX(z + h, trackId);
  return (xp - 2 * x0 + xm) / (h * h);
}

/**
 * Continuous road elevation Y(z) providing realistic uphill climbs & downhill drops.
 */
export function getTrackElevationY(z: number, trackId: TrackId = 'city'): number {
  const p = CURVE_PROFILES[trackId];
  const r = startRamp(z);
  const raw =
    (Math.sin(z * p.ef1) + 0.35 * Math.sin(z * p.ef1 * 0.45)) * p.e1 +
    Math.sin(z * p.ef2) * p.e2;
  return raw * r;
}

/**
 * Longitudinal pitch angle (radians) for hills (positive = climbing uphill).
 */
export function getTrackPitch(z: number, trackId: TrackId = 'city'): number {
  const h = 1.5;
  const dy = getTrackElevationY(z + h, trackId) - getTrackElevationY(z - h, trackId);
  return Math.atan(dy / (2 * h));
}

/**
 * Returns total ground height at longitudinal z and lateral offset from road center.
 */
export function getRoadSurfaceY(lateralX: number, z = 0, trackId: TrackId = 'city'): number {
  const baseY = getTrackElevationY(z, trackId);
  const absX = Math.abs(lateralX);
  if (absX <= ROAD_HALF_WIDTH) return baseY;
  if (absX < ROAD_HALF_WIDTH + 0.35) {
    const t = (absX - ROAD_HALF_WIDTH) / 0.35;
    return baseY + t * FOOTPATH_CURB_HEIGHT;
  }
  return baseY + FOOTPATH_CURB_HEIGHT;
}

/**
 * Returns the nearest speed breaker Z index if within threshold, or -1.
 */
export function getSpeedBreakerIndex(z: number): number {
  if (z < 180) return -1;
  const idx = Math.round(z / SPEED_BREAKER_SPACING);
  const bz = idx * SPEED_BREAKER_SPACING;
  return Math.abs(z - bz) < 0.9 ? idx : -1;
}
