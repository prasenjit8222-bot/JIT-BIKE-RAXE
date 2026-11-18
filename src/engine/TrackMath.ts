export const ROAD_HALF_WIDTH = 6.0;
export const FOOTPATH_OUTER_X = 8.15;
export const FOOTPATH_CURB_HEIGHT = 0.18;

export const SEGMENT_LENGTH = 40;
export const SEGMENT_POOL_COUNT = 16; // 640m visible track window

// Speed breaker positions along the 2600m track
export const SPEED_BREAKER_Z: number[] = [
  180, 360, 560, 740, 940, 1140, 1340, 1540, 1740, 1940, 2140, 2340,
];

/**
 * Smooth multi-harmonic curved highway spline X(z).
 * Starts cleanly at x = 0 at z = 0.
 */
export function getTrackCenterX(z: number): number {
  return Math.sin(z * 0.0085) * 20 + Math.sin(z * 0.0033) * 14;
}

/**
 * Analytical dX/dZ derivative along track.
 */
export function getTrackSlope(z: number): number {
  return (
    0.0085 * 20 * Math.cos(z * 0.0085) +
    0.0033 * 14 * Math.cos(z * 0.0033)
  );
}

/**
 * Tangent heading angle (radians) at longitudinal distance z.
 */
export function getTrackYaw(z: number): number {
  return Math.atan(getTrackSlope(z));
}

/**
 * Returns smooth ground surface elevation at lateral offset from road center.
 * Main road: 0m; Curb ramp: 0..0.18m; Footpath: 0.18m.
 */
export function getRoadSurfaceY(lateralX: number): number {
  const absX = Math.abs(lateralX);
  if (absX <= ROAD_HALF_WIDTH) return 0;
  if (absX < ROAD_HALF_WIDTH + 0.35) {
    const t = (absX - ROAD_HALF_WIDTH) / 0.35;
    return t * FOOTPATH_CURB_HEIGHT;
  }
  return FOOTPATH_CURB_HEIGHT;
}
