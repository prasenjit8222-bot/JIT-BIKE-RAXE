import { BikeId, BikeSpec, TrackId, TrackSpec } from '../types/game';

export const RACE_DISTANCE = 2600; // meters to finish line

export const BIKES: Record<BikeId, BikeSpec> = {
  apex: {
    id: 'apex',
    name: 'Apex V4-R',
    tagline: 'Track-tuned V4 superbike with balanced aero downforce',
    primaryColor: '#dc2626',
    secondaryColor: '#18181b',
    accentColor: '#f59e0b',
    wheelColor: '#d4d4d8',
    stats: {
      topSpeed: 88,
      acceleration: 86,
      handling: 85,
    },
    physics: {
      maxSpeedMs: 75, // 270 km/h
      accelMs2: 26,
      steerSpeed: 13.5,
      nitroBonusMs: 17,
    },
  },
  volt: {
    id: 'volt',
    name: 'Volt Hyper-X',
    tagline: 'High-voltage twin-rotor interceptor built for top-end velocity',
    primaryColor: '#06b6d4',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    wheelColor: '#0ea5e9',
    stats: {
      topSpeed: 96,
      acceleration: 80,
      handling: 78,
    },
    physics: {
      maxSpeedMs: 80, // 288 km/h
      accelMs2: 24,
      steerSpeed: 12.2,
      nitroBonusMs: 19,
    },
  },
  viper: {
    id: 'viper',
    name: 'Viper RS-900',
    tagline: 'Featherweight streetfighter engineered for razor-sharp cornering',
    primaryColor: '#f59e0b',
    secondaryColor: '#111827',
    accentColor: '#fef08a',
    wheelColor: '#f59e0b',
    stats: {
      topSpeed: 82,
      acceleration: 94,
      handling: 95,
    },
    physics: {
      maxSpeedMs: 72, // 259 km/h
      accelMs2: 30,
      steerSpeed: 15.6,
      nitroBonusMs: 16,
    },
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom GT',
    tagline: 'Endurance carbon hyperbike with relentless straight-line stability',
    primaryColor: '#f8fafc',
    secondaryColor: '#1e293b',
    accentColor: '#3b82f6',
    wheelColor: '#94a3b8',
    stats: {
      topSpeed: 92,
      acceleration: 84,
      handling: 88,
    },
    physics: {
      maxSpeedMs: 77, // 277 km/h
      accelMs2: 25.5,
      steerSpeed: 14.0,
      nitroBonusMs: 18,
    },
  },
};

export const BIKE_LIST: BikeSpec[] = [
  BIKES.apex,
  BIKES.volt,
  BIKES.viper,
  BIKES.phantom,
];

export const TRACKS: Record<TrackId, TrackSpec> = {
  city: {
    id: 'city',
    name: 'City Road',
    subtitle: 'Urban Expressway · Police Pursuit Zone',
    description: 'High-rise towers, illuminated intersections, dense traffic, and active Police Interceptor pursuit on traffic collisions.',
    hasPoliceChase: true,
    skyColor: '#152038',
    fogColor: '#1c2a46',
    fogDensity: 0.0038,
    sunColor: '#ffe8c2',
    sunIntensity: 2.1,
    hemiSky: '#6b93d6',
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
    subtitle: 'Countryside Meadows · Rustic Cottages',
    description: 'Sunlit rural tarmac flanked by green pastures, village cottages, timber fences, and dirt footpaths.',
    hasPoliceChase: false,
    skyColor: '#78b8e6',
    fogColor: '#9fd0ef',
    fogDensity: 0.003,
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
    subtitle: 'Timberland Pass · Dense Canopy',
    description: 'Sweeping mountain curves carved through towering pine groves, granite boulders, and golden sunbeams.',
    hasPoliceChase: false,
    skyColor: '#4f7a6d',
    fogColor: '#648f82',
    fogDensity: 0.0046,
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
    subtitle: 'Oceanfront Highway · Waves & Palms',
    description: 'Breezy seaside asphalt bordered by animated turquoise ocean surf on one side and sandy cliffs with palms on the other.',
    hasPoliceChase: false,
    skyColor: '#5cb3e8',
    fogColor: '#8ed0f5',
    fogDensity: 0.0028,
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

export const AI_RACER_PROFILES: Array<{ name: string; bikeId: BikeId; skill: number }> = [
  { name: 'Kaito Takahashi', bikeId: 'volt', skill: 0.96 },
  { name: 'Elena Vance', bikeId: 'apex', skill: 0.92 },
  { name: 'Marcus Cole', bikeId: 'phantom', skill: 0.89 },
  { name: 'Sora Lindqvist', bikeId: 'viper', skill: 0.94 },
  { name: 'Devon Reyes', bikeId: 'apex', skill: 0.87 },
];
