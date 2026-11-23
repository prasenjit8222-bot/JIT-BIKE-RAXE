import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from '../audio/SoundEngine';
import {
  AI_RACER_PROFILES,
  BIKES,
  CHECKPOINT_INTERVAL,
  computeEffectiveBikePhysics,
  getDefaultBikeCustomization,
  KNOCKOUT_INTERVAL_SEC,
  RACE_DISTANCE,
  TRACKS,
} from '../data/catalog';
import {
  ActiveWeather,
  BikeCustomization,
  BikeId,
  CameraMode,
  ControlInputs,
  EffectiveBikePhysics,
  FloatingTag,
  GameMode,
  GamePhase,
  HudSnapshot,
  LobbySlot,
  NetworkRacerUpdate,
  PowerUpKind,
  RaceFinishSummary,
  RaceStanding,
  TrackId,
  WeatherMode,
} from '../types/game';
import { InstancedPropPool } from './InstancedProps';
import {
  createBoostPadMesh,
  createChevronSignGroup,
  createJumpRampGroup,
  createNitroPickupGroup,
  createPowerUpGroup,
  createRoadCoinGroup,
  createSuperbikeGroup,
  createTrafficVehicle,
  SuperbikeRig,
  TrafficKind,
  TrafficRig,
} from './Models';
import {
  createBoostPadTexture,
  createBuildingFacadeTexture,
  createCheckpointBannerTexture,
  createChevronSignTexture,
  createContactShadowTexture,
  createFinishBannerTexture,
  createFootpathTexture,
  createLampPoolTexture,
  createRampTexture,
  createRoadTexture,
  createSpeedBreakerTexture,
} from './Textures';
import {
  FOOTPATH_CURB_HEIGHT,
  FOOTPATH_OUTER_X,
  getRoadSurfaceY,
  getSpeedBreakerIndex,
  getTrackCenterX,
  getTrackCurvature,
  getTrackElevationY,
  getTrackPitch,
  getTrackYaw,
  RIBBON_SLICE_COUNT,
  RIBBON_SLICE_STEP,
  ROAD_HALF_WIDTH,
  SPEED_BREAKER_SPACING,
} from './TrackMath';

// Pre-allocated math scratchpads (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();

const SKY_GRADIENTS: Record<TrackId, { zenith: string; horizon: string }> = {
  city: { zenith: '#0e1b38', horizon: '#2a4572' },
  village: { zenith: '#2e7bc4', horizon: '#a3d5f5' },
  forest: { zenith: '#284a42', horizon: '#689385' },
  coastal: { zenith: '#1d76c4', horizon: '#93d6f7' },
};

interface RacerActor {
  id: string;
  name: string;
  avatar: string;
  bikeId: BikeId;
  physics: EffectiveBikePhysics;
  isLocal: boolean;
  isHuman: boolean;
  isAI: boolean;
  skill: number;
  rig: SuperbikeRig;
  z: number;
  lateralX: number;
  lateralVx: number;
  y: number;
  vy: number;
  speedMs: number;
  steerSmooth: number;
  leanAngle: number;
  wheeliePitch: number;
  wheelRot: number;
  nitro: number;
  isNitro: boolean;
  isWheelie: boolean;
  wheelieScore: number;
  finishTimeMs: number | null;
  aiTargetLane: number;
  aiLaneTimer: number;
  crashTimer: number;
  crashDir: number;
  lastBumperIndex: number;
  airborneFromRamp: boolean;
  eliminated: boolean;
  isSpeaking: boolean;
}

interface TrafficActor {
  rig: TrafficRig;
  z: number;
  lateralX: number;
  targetLaneX: number;
  speedMs: number;
  laneTimer: number;
}

interface NitroPickupActor {
  group: THREE.Group;
  z: number;
  lateralX: number;
  spinPhase: number;
}

interface PowerUpActor {
  kind: PowerUpKind;
  group: THREE.Group;
  z: number;
  lateralX: number;
  spinPhase: number;
}

interface CoinActor {
  group: THREE.Group;
  z: number;
  lateralX: number;
  spinPhase: number;
}

interface RampActor {
  group: THREE.Group;
  z: number;
  lateralX: number;
  cooldown: number;
}

interface BoostPadActor {
  mesh: THREE.Mesh;
  z: number;
  lateralX: number;
  cooldown: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface RibbonLayer {
  mesh: THREE.Mesh;
  geo: THREE.BufferGeometry;
  posAttr: THREE.BufferAttribute;
  uvAttr: THREE.BufferAttribute;
  leftLat: number;
  rightLat: number;
  leftY: number;
  rightY: number;
  uvVScale: number;
  isOcean?: boolean;
}

export class RaceEngine {
  private container: HTMLElement;
  private sound: SoundEngine;
  private isSoftwareGl = false;
  private isMobile = false;
  private touchTuningEnabled = false;
  private autoAccelerate = false;
  private initialized = false;
  private lastSparkMs = 0;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private envMap!: THREE.Texture;

  private skyDome!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;

  private contactShadowTex!: THREE.Texture;
  private facadeTex!: THREE.Texture;
  private lampPoolTex!: THREE.Texture;
  private breakerTex!: THREE.Texture;
  private finishTex!: THREE.Texture;
  private checkpointTex!: THREE.Texture;
  private chevronLeftTex!: THREE.Texture;
  private chevronRightTex!: THREE.Texture;
  private boostPadTex!: THREE.Texture;
  private rampTex!: THREE.Texture;

  // Mode & lifecycle
  private mode: 'garage' | 'race' = 'garage';
  private phase: GamePhase = 'lobby';
  private gameMode: GameMode = 'standard';
  private weatherMode: WeatherMode = 'day';
  private activeWeather: ActiveWeather = 'day';
  private frameId = 0;
  private lastTime = performance.now();
  private disposed = false;

  // Garage objects
  private garageGroup = new THREE.Group();
  private garageBikeRig: SuperbikeRig | null = null;
  private garageBikeId: BikeId = 'apex';
  private garageTrackId: TrackId = 'city';
  private garageCustomKey = '';
  private garageAngle = 0.55;

  // Race world objects
  private raceGroup = new THREE.Group();
  private currentTrackId: TrackId = 'city';
  private roadTextures: THREE.Texture[] = [];
  private roadMat: THREE.MeshStandardMaterial | null = null;
  private ribbonLayers: RibbonLayer[] = [];
  private lastRibbonStartZ = Number.NaN;
  private propPool: InstancedPropPool | null = null;
  private speedBreakers: THREE.Mesh[] = [];
  private chevronLeftPool: THREE.Group[] = [];
  private chevronRightPool: THREE.Group[] = [];
  private trafficPool: TrafficActor[] = [];
  private nitroPool: NitroPickupActor[] = [];
  private powerUpPool: PowerUpActor[] = [];
  private coinPool: CoinActor[] = [];
  private rampPool: RampActor[] = [];
  private boostPadPool: BoostPadActor[] = [];
  private sparkPool: SparkParticle[] = [];
  private finishArch: THREE.Group | null = null;
  private checkpointArch: THREE.Group | null = null;

  // Rain particle system (1 draw call LineSegments)
  private rainLines: THREE.LineSegments | null = null;
  private rainPositions: Float32Array | null = null;
  private rainCount = 320;

  // Pre-instantiated Police Chase unit
  private policeRig!: TrafficRig;
  private policeActive = false;
  private policeEscaped = false;
  private policeZ = -200;
  private policeLateralX = 0;
  private policeSpeedMs = 0;
  private policeTimerSec = 15;
  private policeFlashPhase = 0;

  // Racers
  private racers: RacerActor[] = [];
  private localRacer: RacerActor | null = null;
  private localCustomization: BikeCustomization = getDefaultBikeCustomization('apex');

  // Race gameplay states
  private bikeHealth = 100;
  private topSpeedKmh = 0;
  private coinsCollected = 0;
  private shieldSec = 0;
  private magnetSec = 0;
  private boostPadFlash = 0;
  private eventNotice: string | null = null;
  private eventNoticeTimer = 0;

  // Time Trial & Knockout states
  private checkpointTimerSec = 42;
  private nextCheckpointIndex = 1;
  private knockoutTimerSec = KNOCKOUT_INTERVAL_SEC;

  // Controls & Camera
  private controlsRef: { current: ControlInputs } | null = null;
  private inputs: ControlInputs = {
    accelerate: false,
    brake: false,
    left: false,
    right: false,
    nitro: false,
    wheelie: false,
  };
  private cameraMode: CameraMode = 'far';
  private camPos = new THREE.Vector3(0, 2.05, -4.6);
  private camLook = new THREE.Vector3(0, 1.02, 14);
  private camFov = 65;
  private camRoll = 0;
  private raceStartTimeMs = 0;
  private elapsedMs = 0;
  private collisionFlash = 0;
  private nitroFlash = 0;
  private finishOrbitAngle = 0;

  // Callbacks to React
  public onHudUpdate?: (snapshot: HudSnapshot) => void;
  public onRaceFinished?: (summary: RaceFinishSummary) => void;
  public onNetworkSend?: (update: NetworkRacerUpdate) => void;
  public onContextLost?: (lost: boolean) => void;
  public onInitFailed?: (reason: string) => void;

  private hudSyncAccum = 0;
  private netSyncAccum = 0;
  private remoteUpdatesProvider?: () => Map<string, NetworkRacerUpdate>;
  private speakingProvider?: (id: string) => boolean;

  constructor(container: HTMLElement, sound: SoundEngine) {
    this.container = container;
    this.sound = sound;
    this.isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)')?.matches ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
    this.rainCount = this.isMobile ? 110 : 190;
  }

  private yieldFrame(ms = 16): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  public async initializeAsync(onProgress: (pct: number, label: string) => void): Promise<void> {
    if (this.disposed || this.initialized) return;

    onProgress(15, 'Initializing 3D Graphics...');
    await this.yieldFrame(16);
    if (this.disposed) return;

    const ok = this.initRenderer();
    if (!ok || this.disposed) return;

    onProgress(48, 'Generating Curved Tracks & Weather...');
    await this.yieldFrame(16);
    if (this.disposed) return;

    this.initSceneCore();

    onProgress(78, 'Preparing 5 Superbikes & Power-Ups...');
    await this.yieldFrame(16);
    if (this.disposed) return;

    this.initPoolsAndGarage();

    onProgress(100, 'Ready to Race');
    this.bindEvents();
    this.initialized = true;
    this.startLoop();
  }

  public setAutoAccelerate(enabled: boolean): void {
    this.autoAccelerate = enabled;
  }

  public setTouchMode(enabled: boolean): void {
    this.touchTuningEnabled = enabled;
  }

  public setControlsRef(ref: { current: ControlInputs }): void {
    this.controlsRef = ref;
  }

  private detectSoftwareGlFromRenderer(renderer: THREE.WebGLRenderer): boolean {
    try {
      const gl = renderer.getContext();
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private initRenderer(): boolean {
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !this.isMobile,
        powerPreference: this.isMobile ? 'default' : 'high-performance',
        alpha: false,
        stencil: false,
      });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          powerPreference: 'default',
        });
      } catch {
        this.onInitFailed?.('WebGL 3D graphics could not be initialized on this device.');
        return false;
      }
    }

    this.isSoftwareGl = this.detectSoftwareGlFromRenderer(renderer);

    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    );
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = false;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;

    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost?.(true);
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.onContextLost?.(false);
    });

    return true;
  }

  private initSceneCore(): void {
    const scene = new THREE.Scene();
    this.scene = scene;

    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(65, w / h, 0.2, 650);

    if (this.renderer) {
      try {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = this.envMap;
        pmrem.dispose();
      } catch {
        // Fallback smoothly without PMREM on restricted mobile GPUs
      }
    }

    // Gradient Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#0a1024') },
        uHorizon: { value: new THREE.Color('#1e2c4a') },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = position;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = clamp(pow(max(h, 0.0), 0.65), 0.0, 1.0);
          gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(540, 20, 14), this.skyMat);
    scene.add(this.skyDome);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1e293b, 0.92);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe8c2, 2.15);
    this.sunLight.position.set(28, 46, 18);
    this.sunLight.castShadow = false;
    this.sunLight.shadow.mapSize.set(512, 512);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    const rawAniso = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 1;
    const maxAniso = this.isMobile ? Math.min(4, rawAniso) : rawAniso;
    this.contactShadowTex = createContactShadowTexture();
    this.facadeTex = createBuildingFacadeTexture(maxAniso);
    this.lampPoolTex = createLampPoolTexture();
    this.breakerTex = createSpeedBreakerTexture(maxAniso);
    this.finishTex = createFinishBannerTexture(maxAniso);
    this.checkpointTex = createCheckpointBannerTexture(maxAniso);
    this.chevronLeftTex = createChevronSignTexture('left');
    this.chevronRightTex = createChevronSignTexture('right');
    this.boostPadTex = createBoostPadTexture(maxAniso);
    this.rampTex = createRampTexture(maxAniso);

    this.initRainSystem();
  }

  private initRainSystem(): void {
    const positions = new Float32Array(this.rainCount * 2 * 3);
    for (let i = 0; i < this.rainCount; i++) {
      const rx = (Math.random() - 0.5) * 44;
      const ry = Math.random() * 18;
      const rz = (Math.random() - 0.5) * 48;
      const idx = i * 6;
      positions[idx] = rx;
      positions[idx + 1] = ry;
      positions[idx + 2] = rz;
      positions[idx + 3] = rx - 0.14;
      positions[idx + 4] = ry - 0.95;
      positions[idx + 5] = rz - 0.3;
    }
    this.rainPositions = positions;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(geo, mat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  private initPoolsAndGarage(): void {
    this.policeRig = createTrafficVehicle('police', 0x0f172a, this.contactShadowTex);
    this.policeRig.root.visible = false;
    this.policeRig.root.position.set(0, -100, -200);
    this.scene.add(this.policeRig.root);

    const sparkGeo = new THREE.BoxGeometry(0.11, 0.11, 0.24);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparkPool.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }

    this.scene.add(this.garageGroup);
    this.scene.add(this.raceGroup);
    this.raceGroup.visible = false;

    this.setupGarage();
    this.applyTrackAtmosphere(this.garageTrackId, 'day', true);
  }

  private setupGarage(): void {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 42),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.garageGroup.add(floor);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.6, 0.22, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.78 })
    );
    plinth.position.y = 0.11;
    this.garageGroup.add(plinth);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.36, 0.035, 10, 42),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.22;
    this.garageGroup.add(rimRing);

    this.setGarageSelection(this.garageBikeId, this.garageTrackId);
  }

  public setGarageSelection(
    bikeId: BikeId,
    trackId: TrackId,
    customization?: BikeCustomization
  ): void {
    const custom = customization ?? getDefaultBikeCustomization(bikeId);
    const hasUnderglow = custom.equippedTools.includes('neon_underglow');
    const hasTurbo = custom.equippedTools.includes('turbo_exhaust');
    const hasBumper = custom.equippedTools.includes('heavy_bumper');
    const key = `${bikeId}_${custom.paintId}_${hasUnderglow}_${hasTurbo}_${hasBumper}`;

    const bikeChanged = !this.garageBikeRig || this.garageCustomKey !== key;
    this.garageBikeId = bikeId;
    this.garageTrackId = trackId;
    this.garageCustomKey = key;

    if (!this.contactShadowTex || !this.scene) return;

    if (bikeChanged) {
      if (this.garageBikeRig) {
        this.garageGroup.remove(this.garageBikeRig.root);
        this.disposeObject3D(this.garageBikeRig.root);
      }
      this.garageBikeRig = createSuperbikeGroup(bikeId, this.contactShadowTex, {
        paintId: custom.paintId,
        underglow: hasUnderglow,
        turboExhaust: hasTurbo,
        heavyBumper: hasBumper,
      });
      this.garageBikeRig.root.position.y = 0.22;
      this.garageGroup.add(this.garageBikeRig.root);
    }

    if (this.mode === 'garage') {
      this.applyTrackAtmosphere(trackId, 'day', true);
    }
  }

  private applyTrackAtmosphere(
    trackId: TrackId,
    weather: ActiveWeather,
    isGarage = false
  ): void {
    if (!this.scene || !this.skyDome) return;
    const spec = TRACKS[trackId];
    const grad = SKY_GRADIENTS[trackId];

    this.activeWeather = weather;

    if (isGarage) {
      this.skyDome.visible = false;
      this.scene.background = new THREE.Color('#0b101d');
      this.scene.fog = new THREE.FogExp2('#0b101d', 0.025);
      this.sunLight.color.set('#ffe8c2');
      this.sunLight.intensity = 1.95;
      this.hemiLight.color.set('#93c5fd');
      this.hemiLight.groundColor.set('#1e293b');
      this.hemiLight.intensity = 0.95;
      if (this.rainLines) this.rainLines.visible = false;
      return;
    }

    this.skyDome.visible = true;

    let zenith = grad.zenith;
    let horizon = spec.fogColor;
    let fogColor = spec.fogColor;
    let fogDensity = spec.fogDensity;
    let sunCol = spec.sunColor;
    let sunInt = spec.sunIntensity;
    let hemiSky = spec.hemiSky;
    let hemiGround = spec.hemiGround;
    let hemiInt = 0.95;
    let nightFactor = 0;

    if (weather === 'night') {
      zenith = '#02040a';
      horizon = '#0b1429';
      fogColor = '#091022';
      fogDensity = 0.0052;
      sunCol = '#93c5fd';
      sunInt = 0.55;
      hemiSky = '#1e3a8a';
      hemiGround = '#090d17';
      hemiInt = 0.45;
      nightFactor = 1.0;
    } else if (weather === 'rainy') {
      zenith = '#1e293b';
      horizon = '#475569';
      fogColor = '#475569';
      fogDensity = 0.0068;
      sunCol = '#cbd5e1';
      sunInt = 1.05;
      hemiSky = '#94a3b8';
      hemiGround = '#1e293b';
      hemiInt = 0.72;
      nightFactor = 0.35;
    } else if (weather === 'foggy') {
      zenith = '#94a3b8';
      horizon = '#cbd5e1';
      fogColor = '#b8c4d0';
      fogDensity = 0.0138;
      sunCol = '#e2e8f0';
      sunInt = 1.15;
      hemiSky = '#cbd5e1';
      hemiGround = '#475569';
      hemiInt = 0.85;
      nightFactor = 0.25;
    }

    this.skyMat.uniforms.uZenith.value.set(zenith);
    this.skyMat.uniforms.uHorizon.value.set(horizon);
    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    this.sunLight.color.set(sunCol);
    this.sunLight.intensity = sunInt;
    this.hemiLight.color.set(hemiSky);
    this.hemiLight.groundColor.set(hemiGround);
    this.hemiLight.intensity = hemiInt;

    // Wet road reflections in Rainy mode
    if (this.roadMat) {
      this.roadMat.roughness = weather === 'rainy' ? 0.16 : 0.78;
      this.roadMat.metalness = weather === 'rainy' ? 0.46 : 0.06;
      this.roadMat.envMapIntensity = weather === 'rainy' ? 1.65 : 1.0;
    }

    // Illuminated roadside streetlamps
    this.propPool?.setNightIntensity(nightFactor);

    // Rain particle visibility
    if (this.rainLines) {
      this.rainLines.visible = weather === 'rainy';
    }

    // Update all racers' 3D headlights, headlight beam cones, and tail lights
    for (const r of this.racers) {
      r.rig.headlightMat.emissiveIntensity = nightFactor > 0.5 ? 5.2 : 2.6;
      r.rig.headBeamMat.opacity =
        weather === 'night' ? 0.26 : weather === 'foggy' ? 0.16 : weather === 'rainy' ? 0.14 : 0.04;
      r.rig.headBeamMesh.visible = weather !== 'day';
    }
  }

  public returnToGarage(): void {
    if (!this.initialized) return;
    this.mode = 'garage';
    this.phase = 'lobby';
    this.sound.setEngineActive(false);
    this.policeActive = false;
    this.policeRig.root.visible = false;
    if (this.rainLines) this.rainLines.visible = false;
    this.hideSparks();
    this.raceGroup.visible = false;
    this.garageGroup.visible = true;
    this.skyDome.position.set(0, 0, 0);
    this.applyTrackAtmosphere(this.garageTrackId, 'day', true);
    this.setGarageSelection(this.garageBikeId, this.garageTrackId, this.localCustomization);
  }

  public finishCurrentRunNow(): void {
    if (this.phase !== 'racing' || !this.localRacer) return;
    this.concludeRace('ended');
  }

  public startRace(
    trackId: TrackId,
    slots: LobbySlot[],
    gameMode: GameMode,
    weatherMode: WeatherMode,
    localCustomization: BikeCustomization,
    remoteProvider: () => Map<string, NetworkRacerUpdate>,
    speakingProvider: (id: string) => boolean
  ): void {
    if (!this.initialized) return;
    this.remoteUpdatesProvider = remoteProvider;
    this.speakingProvider = speakingProvider;
    this.gameMode = gameMode;
    this.weatherMode = weatherMode;
    this.localCustomization = localCustomization;

    this.clearRaceWorld();
    this.currentTrackId = trackId;
    this.mode = 'race';
    this.phase = 'countdown';
    this.garageGroup.visible = false;
    this.raceGroup.visible = true;

    const initialWeather: ActiveWeather = weatherMode === 'dynamic' ? 'day' : weatherMode;
    this.buildRaceWorld(trackId);
    this.spawnRacers(slots, gameMode);
    this.applyTrackAtmosphere(trackId, initialWeather, false);

    // Reset race mode & power-up states
    this.bikeHealth = 100;
    this.topSpeedKmh = 0;
    this.coinsCollected = 0;
    this.shieldSec = 0;
    this.magnetSec = 0;
    this.boostPadFlash = 0;
    this.checkpointTimerSec = 42;
    this.nextCheckpointIndex = 1;
    this.knockoutTimerSec = KNOCKOUT_INTERVAL_SEC;
    this.eventNotice = null;
    this.eventNoticeTimer = 0;

    // Reset pre-instantiated Police & Spark pools
    this.policeActive = false;
    this.policeEscaped = false;
    this.policeTimerSec = 15;
    this.policeRig.root.visible = false;
    this.policeRig.root.position.set(0, -100, -200);
    this.hideSparks();

    this.elapsedMs = 0;
    this.collisionFlash = 0;
    this.nitroFlash = 0;
    this.camRoll = 0;
    this.lastRibbonStartZ = Number.NaN;

    // Ensure aspect ratio & renderer size match current viewport immediately
    this.handleResize();

    // Synchronously place road ribbon, traffic, pickups, ramps, props & camera BEFORE countdown starts
    const startZ = this.localRacer ? this.localRacer.z : 0;
    const now = performance.now();
    this.updateRoadRibbon(startZ, now, true);
    this.updateTraffic(0);
    this.updateNitroPickups(0, now);
    this.updatePowerUpsAndCoins(0, now);
    this.updateRampsAndBoostPads(0);

    if (this.localRacer) {
      const r = this.localRacer;
      r.y = getRoadSurfaceY(r.lateralX, r.z, trackId);
      this.placeRacerTransform(r, now);

      const gz = r.z;
      const gx = getTrackCenterX(gz, trackId) + r.lateralX;
      const gy = r.y;
      const wideMobile = this.camera.aspect > 1.75;
      const initDist = wideMobile ? 4.9 : 4.5;
      const initHeight = wideMobile ? 1.88 : 2.05;
      this.camPos.set(gx, gy + initHeight, gz - initDist);
      this.camLook.set(gx, gy + 0.92, gz + 14);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.skyDome.position.copy(this.camera.position);
    }

    if (this.renderer && !this.isSoftwareGl && !this.isMobile) {
      try {
        this.renderer.compile(this.scene, this.camera);
      } catch {
        // Ignore shader compile errors on restricted drivers
      }
    }
  }

  public beginRacingGo(): void {
    this.phase = 'racing';
    this.raceStartTimeMs = performance.now();
    this.sound.setEngineActive(true);
  }

  private disposeObject3D(root: THREE.Object3D): void {
    const sharedTextures = new Set<THREE.Texture | undefined>([
      this.contactShadowTex,
      this.facadeTex,
      this.lampPoolTex,
      this.breakerTex,
      this.finishTex,
      this.checkpointTex,
      this.chevronLeftTex,
      this.chevronRightTex,
      this.boostPadTex,
      this.rampTex,
      this.envMap,
    ]);
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
        disposedGeos.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (disposedMats.has(m)) continue;
          disposedMats.add(m);
          const std = m as THREE.MeshStandardMaterial;
          if (std.map && !sharedTextures.has(std.map)) {
            std.map.dispose();
          }
          m.dispose();
        }
      }
    });
  }

  private clearRaceWorld(): void {
    for (const tex of this.roadTextures) tex.dispose();
    this.roadTextures = [];
    for (const layer of this.ribbonLayers) {
      layer.geo.dispose();
      if (Array.isArray(layer.mesh.material)) {
        layer.mesh.material.forEach((m) => m.dispose());
      } else {
        layer.mesh.material.dispose();
      }
    }
    this.ribbonLayers = [];
    this.roadMat = null;

    if (this.propPool) {
      this.propPool.dispose();
      this.propPool = null;
    }
    while (this.raceGroup.children.length > 0) {
      const child = this.raceGroup.children[0];
      this.raceGroup.remove(child);
      this.disposeObject3D(child);
    }
    this.speedBreakers = [];
    this.chevronLeftPool = [];
    this.chevronRightPool = [];
    this.trafficPool = [];
    this.nitroPool = [];
    this.powerUpPool = [];
    this.coinPool = [];
    this.rampPool = [];
    this.boostPadPool = [];
    this.racers = [];
    this.localRacer = null;
    this.finishArch = null;
    this.checkpointArch = null;
  }

  private createRibbonLayer(
    mat: THREE.Material,
    leftLat: number,
    rightLat: number,
    leftY: number,
    rightY: number,
    uvVScale: number,
    isOcean = false
  ): RibbonLayer {
    const vertCount = (RIBBON_SLICE_COUNT + 1) * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices: number[] = [];

    for (let i = 0; i < RIBBON_SLICE_COUNT; i++) {
      const v0 = i * 2;
      const v1 = v0 + 1;
      const v2 = v0 + 2;
      const v3 = v0 + 3;
      indices.push(v0, v2, v1, v1, v2, v3);
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const uvAttr = new THREE.BufferAttribute(uvs, 2);
    uvAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('uv', uvAttr);
    geo.setIndex(indices);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.raceGroup.add(mesh);

    return { mesh, geo, posAttr, uvAttr, leftLat, rightLat, leftY, rightY, uvVScale, isOcean };
  }

  private updateRoadRibbon(refZ: number, nowMs: number, force = false): void {
    const startZ = Math.floor(refZ / RIBBON_SLICE_STEP) * RIBBON_SLICE_STEP - 36;
    const trackId = this.currentTrackId;
    const geomDirty = force || startZ !== this.lastRibbonStartZ;
    if (!geomDirty && trackId !== 'coastal') {
      return;
    }
    this.lastRibbonStartZ = startZ;

    for (let lIdx = 0; lIdx < this.ribbonLayers.length; lIdx++) {
      const layer = this.ribbonLayers[lIdx];
      // When only ocean wave animates, skip rebuilding static road/barrier layers!
      if (!geomDirty && !layer.isOcean) continue;

      const posArr = layer.posAttr.array as Float32Array;
      const uvArr = layer.uvAttr.array as Float32Array;

      for (let i = 0; i <= RIBBON_SLICE_COUNT; i++) {
        const z = startZ + i * RIBBON_SLICE_STEP;
        const cx = getTrackCenterX(z, trackId);
        const cy = getTrackElevationY(z, trackId);
        const yaw = getTrackYaw(z, trackId);
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);

        const waveOffset = layer.isOcean
          ? Math.sin(nowMs * 0.0024 + z * 0.03) * 0.22
          : 0;

        const lx = cx + layer.leftLat * cosY;
        const lz = z - layer.leftLat * sinY;
        const ly = cy + layer.leftY + waveOffset;

        const rx = cx + layer.rightLat * cosY;
        const rz = z - layer.rightLat * sinY;
        const ry = cy + layer.rightY + waveOffset;

        const pIdx = i * 6;
        posArr[pIdx] = lx;
        posArr[pIdx + 1] = ly;
        posArr[pIdx + 2] = lz;
        posArr[pIdx + 3] = rx;
        posArr[pIdx + 4] = ry;
        posArr[pIdx + 5] = rz;

        const vCoord = z * layer.uvVScale;
        const uIdx = i * 4;
        uvArr[uIdx] = 0;
        uvArr[uIdx + 1] = vCoord;
        uvArr[uIdx + 2] = 1;
        uvArr[uIdx + 3] = vCoord;
      }

      layer.posAttr.needsUpdate = true;
      layer.uvAttr.needsUpdate = true;
      if (geomDirty) {
        layer.geo.computeVertexNormals();
      }
    }
  }

  private buildRaceWorld(trackId: TrackId): void {
    const spec = TRACKS[trackId];
    const rawAniso = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 1;
    const maxAniso = this.isMobile ? Math.min(4, rawAniso) : rawAniso;

    const roadTex = createRoadTexture(spec, maxAniso);
    const footpathTex = createFootpathTexture(spec, maxAniso);
    this.roadTextures.push(roadTex, footpathTex);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.78,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    this.roadMat = roadMat;

    const footpathMat = new THREE.MeshStandardMaterial({
      map: footpathTex,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const groundMat = new THREE.MeshStandardMaterial({
      color: spec.groundColor,
      roughness: 0.96,
      side: THREE.DoubleSide,
    });
    const barrierMat = new THREE.MeshStandardMaterial({
      color:
        trackId === 'city'
          ? 0x94a3b8
          : trackId === 'village'
            ? 0x92400e
            : trackId === 'forest'
              ? 0x64748b
              : 0xe2e8f0,
      roughness: 0.52,
      metalness: trackId === 'city' ? 0.65 : 0.2,
      side: THREE.DoubleSide,
    });

    // 1. Seamless Continuous Curved & Elevated Road Ribbon Layers (7 draw calls total!)
    // Ground terrain skirt
    this.ribbonLayers.push(this.createRibbonLayer(groundMat, -64, 64, -0.14, -0.14, 0.05));
    // Main Asphalt Highway
    this.ribbonLayers.push(
      this.createRibbonLayer(roadMat, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0.0, 0.0, 0.045)
    );
    // Left & Right Raised Footpaths
    this.ribbonLayers.push(
      this.createRibbonLayer(
        footpathMat,
        -(FOOTPATH_OUTER_X + 0.3),
        -ROAD_HALF_WIDTH,
        FOOTPATH_CURB_HEIGHT,
        FOOTPATH_CURB_HEIGHT,
        0.08
      )
    );
    this.ribbonLayers.push(
      this.createRibbonLayer(
        footpathMat,
        ROAD_HALF_WIDTH,
        FOOTPATH_OUTER_X + 0.3,
        FOOTPATH_CURB_HEIGHT,
        FOOTPATH_CURB_HEIGHT,
        0.08
      )
    );
    // Curved Left & Right Roadside Safety Guardrail Barriers
    this.ribbonLayers.push(
      this.createRibbonLayer(
        barrierMat,
        -(FOOTPATH_OUTER_X + 0.35),
        -(FOOTPATH_OUTER_X + 0.35),
        0.15,
        1.02,
        0.1
      )
    );
    this.ribbonLayers.push(
      this.createRibbonLayer(
        barrierMat,
        FOOTPATH_OUTER_X + 0.35,
        FOOTPATH_OUTER_X + 0.35,
        1.02,
        0.15,
        0.1
      )
    );

    if (trackId === 'coastal') {
      const oceanMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.16,
        metalness: 0.38,
        envMapIntensity: 1.35,
        side: THREE.DoubleSide,
      });
      this.ribbonLayers.push(
        this.createRibbonLayer(oceanMat, 14, 155, -0.55, -0.55, 0.04, true)
      );
    }

    this.updateRoadRibbon(0, performance.now());

    // 2. Pooled Speed Breakers (4 reusable meshes)
    const breakerGeo = new THREE.CylinderGeometry(0.42, 0.42, ROAD_HALF_WIDTH * 2, 10, 1, false, 0, Math.PI);
    breakerGeo.rotateZ(Math.PI / 2);
    const breakerMat = new THREE.MeshStandardMaterial({ map: this.breakerTex, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(breakerGeo, breakerMat);
      mesh.scale.set(1, 0.45, 1.3);
      mesh.visible = false;
      this.raceGroup.add(mesh);
      this.speedBreakers.push(mesh);
    }

    // 3. Pooled Warning Chevron Turn Signs (6 Left + 6 Right)
    for (let i = 0; i < 6; i++) {
      const signL = createChevronSignGroup(this.chevronLeftTex);
      signL.visible = false;
      this.raceGroup.add(signL);
      this.chevronLeftPool.push(signL);

      const signR = createChevronSignGroup(this.chevronRightTex);
      signR.visible = false;
      this.raceGroup.add(signR);
      this.chevronRightPool.push(signR);
    }

    // 4. InstancedMesh Roadside Props & Streetlamps Pool
    this.propPool = new InstancedPropPool(trackId, this.facadeTex, this.lampPoolTex);
    this.propPool.syncAll();
    this.raceGroup.add(this.propPool.group);

    // 5. Pooled Traffic Vehicles (14 vehicles)
    const vehicleColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xe2e8f0, 0x8b5cf6];
    const kinds: TrafficKind[] = ['sedan', 'sedan', 'bus', 'truck', 'sedan'];
    const lanes = [-3.9, 0, 3.9];
    for (let i = 0; i < 14; i++) {
      const kind = kinds[i % kinds.length];
      const color = vehicleColors[i % vehicleColors.length];
      const rig = createTrafficVehicle(kind, color, this.contactShadowTex);
      const lane = lanes[i % lanes.length];
      const actor: TrafficActor = {
        rig,
        z: 75 + i * 36 + Math.random() * 14,
        lateralX: lane,
        targetLaneX: lane,
        speedMs: kind === 'bus' ? 21 : kind === 'truck' ? 24 : 28 + (i % 4) * 3,
        laneTimer: 2 + Math.random() * 4,
      };
      this.raceGroup.add(rig.root);
      this.trafficPool.push(actor);
    }

    // 6. Pooled Collectible Road Nitro Canisters (10 canisters)
    for (let i = 0; i < 10; i++) {
      const group = createNitroPickupGroup();
      const lane = lanes[(i * 2 + 1) % lanes.length];
      const pickup: NitroPickupActor = {
        group,
        z: 95 + i * 44 + Math.random() * 10,
        lateralX: lane,
        spinPhase: i * 0.7,
      };
      this.raceGroup.add(group);
      this.nitroPool.push(pickup);
    }

    // 7. Pooled Collectible Power-Ups (Shield, Magnet, Repair Wrench)
    const powerKinds: PowerUpKind[] = ['shield', 'magnet', 'repair', 'shield', 'magnet', 'repair'];
    for (let i = 0; i < powerKinds.length; i++) {
      const kind = powerKinds[i];
      const group = createPowerUpGroup(kind);
      const lane = lanes[(i + 1) % lanes.length];
      this.raceGroup.add(group);
      this.powerUpPool.push({
        kind,
        group,
        z: 140 + i * 95 + Math.random() * 20,
        lateralX: lane,
        spinPhase: i * 1.1,
      });
    }

    // 8. Pooled Spinning Road Coins (18 coins arranged in arcs along curves)
    for (let i = 0; i < 18; i++) {
      const group = createRoadCoinGroup();
      const cluster = Math.floor(i / 6);
      const sub = i % 6;
      const lane = lanes[cluster % lanes.length];
      this.raceGroup.add(group);
      this.coinPool.push({
        group,
        z: 65 + cluster * 110 + sub * 7.5,
        lateralX: lane,
        spinPhase: i * 0.4,
      });
    }

    // 9. Pooled 3D Jump Ramps (4 ramps)
    for (let i = 0; i < 4; i++) {
      const group = createJumpRampGroup(this.rampTex);
      const lane = lanes[(i * 2) % lanes.length];
      this.raceGroup.add(group);
      this.rampPool.push({
        group,
        z: 170 + i * 145,
        lateralX: lane,
        cooldown: 0,
      });
    }

    // 10. Pooled Glowing Blue Speed Boost Pads (6 pads)
    for (let i = 0; i < 6; i++) {
      const mesh = createBoostPadMesh(this.boostPadTex);
      const lane = lanes[(i + 2) % lanes.length];
      this.raceGroup.add(mesh);
      this.boostPadPool.push({
        mesh,
        z: 115 + i * 90,
        lateralX: lane,
        cooldown: 0,
      });
    }

    // 11. Grand Prix Checkered Finish Line Arch & Road Strip (hidden in Endless Highway mode)
    if (this.gameMode !== 'endless') {
      this.finishArch = this.createBannerArch(this.finishTex, true);
      const fX = getTrackCenterX(RACE_DISTANCE, trackId);
      const fY = getTrackElevationY(RACE_DISTANCE, trackId);
      const fYaw = getTrackYaw(RACE_DISTANCE, trackId);
      this.finishArch.position.set(fX, fY, RACE_DISTANCE);
      this.finishArch.rotation.y = fYaw;
      this.raceGroup.add(this.finishArch);
    }

    // 12. Time Trial Checkpoint Arch (recycles every CHECKPOINT_INTERVAL)
    if (this.gameMode === 'timetrial') {
      this.checkpointArch = this.createBannerArch(this.checkpointTex, false);
      this.positionCheckpointArch(CHECKPOINT_INTERVAL);
      this.raceGroup.add(this.checkpointArch);
    }
  }

  private createBannerArch(bannerTex: THREE.Texture, isFinishLine: boolean): THREE.Group {
    const g = new THREE.Group();
    const towerHeight = isFinishLine ? 8.6 : 7.4;
    const pillarMat = new THREE.MeshStandardMaterial({
      color: isFinishLine ? 0xf8fafc : 0x1e293b,
      metalness: 0.65,
      roughness: 0.28,
    });
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.85, towerHeight, 0.85), pillarMat);
    pL.position.set(-7.8, towerHeight * 0.5, 0);
    const pR = pL.clone();
    pR.position.x = 7.8;
    g.add(pL, pR);

    // High-contrast racing accent bands on the towers
    const bandMat = new THREE.MeshBasicMaterial({
      color: isFinishLine ? 0xef4444 : 0x06b6d4,
    });
    const bandGeo = new THREE.BoxGeometry(0.92, 0.9, 0.92);
    for (const h of [1.8, 4.2, 6.6]) {
      if (h < towerHeight - 0.5) {
        const bL = new THREE.Mesh(bandGeo, bandMat);
        bL.position.set(-7.8, h, 0);
        const bR = new THREE.Mesh(bandGeo, bandMat);
        bR.position.set(7.8, h, 0);
        g.add(bL, bR);
      }
    }

    // Glowing overhead checkered banner (MeshBasicMaterial so always unmistakable day or night)
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(16.6, isFinishLine ? 2.55 : 2.15, 0.45),
      bannerMat
    );
    banner.position.set(0, towerHeight - 1.15, 0);
    g.add(banner);

    if (isFinishLine) {
      // Glowing emerald/amber gantry beacons atop each tower (no PointLight lag)
      const beaconGeo = new THREE.BoxGeometry(1.1, 0.42, 1.1);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const topL = new THREE.Mesh(beaconGeo, beaconMat);
      topL.position.set(-7.8, towerHeight + 0.25, 0);
      const topR = new THREE.Mesh(beaconGeo, beaconMat);
      topR.position.set(7.8, towerHeight + 0.25, 0);
      g.add(topL, topR);

      // Painted checkered tarmac finish line directly on the road surface
      const stripGeo = new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2 + 0.4, 3.2);
      const stripMat = new THREE.MeshBasicMaterial({
        map: bannerTex,
        side: THREE.DoubleSide,
      });
      const roadStrip = new THREE.Mesh(stripGeo, stripMat);
      roadStrip.rotation.x = -Math.PI / 2;
      roadStrip.position.set(0, 0.08, 0);
      g.add(roadStrip);
    }

    return g;
  }

  private positionCheckpointArch(z: number): void {
    if (!this.checkpointArch) return;
    if (z >= RACE_DISTANCE) {
      this.checkpointArch.visible = false;
      return;
    }
    this.checkpointArch.visible = true;
    this.checkpointArch.position.set(
      getTrackCenterX(z, this.currentTrackId),
      getTrackElevationY(z, this.currentTrackId),
      z
    );
    this.checkpointArch.rotation.y = getTrackYaw(z, this.currentTrackId);
  }

  private spawnRacers(slots: LobbySlot[], gameMode: GameMode): void {
    const gridLanes = [-3.6, 0, 3.6, -2.0, 2.0];
    const gridZ = [0, -2.5, -2.5, -5.5, -5.5];

    // Solo player in Time Trial & Endless Highway; 5-player grid in Standard & Knockout
    const activeSlots =
      gameMode === 'timetrial' || gameMode === 'endless'
        ? slots.filter((s) => s.isLocal)
        : slots;

    activeSlots.forEach((slot, idx) => {
      const custom = slot.isLocal ? this.localCustomization : getDefaultBikeCustomization(slot.bikeId);
      const physics = computeEffectiveBikePhysics(slot.bikeId, slot.isLocal ? custom : undefined);

      const rig = createSuperbikeGroup(slot.bikeId, this.contactShadowTex, {
        paintId: slot.isLocal ? custom.paintId : slot.paintId,
        underglow: slot.isLocal ? physics.hasUnderglow : Boolean(slot.underglow),
        turboExhaust: slot.isLocal ? physics.hasTurboExhaust : false,
        heavyBumper: slot.isLocal ? physics.hasHeavyBumper : false,
      });
      this.raceGroup.add(rig.root);

      const aiProf = AI_RACER_PROFILES[idx % AI_RACER_PROFILES.length];
      const startZ = activeSlots.length === 1 ? 0 : gridZ[idx];
      const startLat = activeSlots.length === 1 ? 0 : gridLanes[idx];

      const racer: RacerActor = {
        id: slot.id,
        name: slot.name,
        avatar: slot.avatar,
        bikeId: slot.bikeId,
        physics,
        isLocal: slot.isLocal,
        isHuman: slot.isHuman,
        isAI: slot.isAI,
        skill: aiProf ? aiProf.skill : 0.91,
        rig,
        z: startZ,
        lateralX: startLat,
        lateralVx: 0,
        y: getRoadSurfaceY(startLat, startZ, this.currentTrackId),
        vy: 0,
        speedMs: 0,
        steerSmooth: 0,
        leanAngle: 0,
        wheeliePitch: 0,
        wheelRot: 0,
        nitro: 0,
        isNitro: false,
        isWheelie: false,
        wheelieScore: 0,
        finishTimeMs: null,
        aiTargetLane: startLat,
        aiLaneTimer: 1.5 + Math.random() * 2.5,
        crashTimer: 0,
        crashDir: 1,
        lastBumperIndex: -1,
        airborneFromRamp: false,
        eliminated: false,
        isSpeaking: slot.isSpeaking,
      };

      this.placeRacerTransform(racer, performance.now());
      this.racers.push(racer);
      if (slot.isLocal) {
        this.localRacer = racer;
      }
    });
  }

  private placeRacerTransform(racer: RacerActor, nowMs: number): void {
    const cx = getTrackCenterX(racer.z, this.currentTrackId);
    const yaw = getTrackYaw(racer.z, this.currentTrackId);
    const pitch = getTrackPitch(racer.z, this.currentTrackId);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    racer.rig.root.position.set(
      cx + racer.lateralX * cosY,
      racer.y,
      racer.z - racer.lateralX * sinY
    );
    racer.rig.root.rotation.order = 'YXZ';
    racer.rig.root.rotation.y = yaw;
    racer.rig.root.rotation.x = -pitch * 0.82;

    racer.rig.leanGroup.rotation.z = racer.leanAngle;
    racer.rig.wheeliePivot.rotation.x = -racer.wheeliePitch;
    racer.rig.frontWheel.rotation.x = racer.wheelRot;
    racer.rig.rearWheel.rotation.x = racer.wheelRot;

    racer.rig.riderGroup.rotation.z = racer.leanAngle * 0.42;
    racer.rig.riderGroup.rotation.x = racer.isNitro ? 0.16 : -racer.wheeliePitch * 0.48;
    racer.rig.helmetGroup.rotation.z = -racer.leanAngle * 0.65;

    if (racer.isLocal) {
      racer.rig.shieldDome.visible = this.shieldSec > 0;
      if (this.shieldSec > 0) {
        racer.rig.shieldDome.rotation.y = nowMs * 0.0025;
      }
    }

    const showFlame = racer.isNitro && !racer.eliminated;
    racer.rig.nitroFlameLeft.visible = showFlame;
    racer.rig.nitroFlameRight.visible = showFlame;
    if (showFlame) {
      const flicker = 0.85 + Math.random() * 0.45;
      racer.rig.nitroFlameLeft.scale.set(1, 1, flicker);
      racer.rig.nitroFlameRight.scale.set(1, 1, flicker);

      const tBase = nowMs * 0.018;
      for (let i = 0; i < racer.rig.nitroParticles.length; i++) {
        const p = racer.rig.nitroParticles[i];
        p.visible = true;
        const phase = (tBase + i * 0.34) % 1;
        const sideX = i % 2 === 0 ? -0.2 : 0.2;
        p.position.set(
          sideX + Math.sin(nowMs * 0.05 + i) * 0.03,
          0.58 + phase * 0.14,
          -1.05 - phase * 1.1
        );
        const s = (1 - phase) * 1.15;
        p.scale.set(s, s, s);
      }
    } else {
      for (let i = 0; i < racer.rig.nitroParticles.length; i++) {
        racer.rig.nitroParticles[i].visible = false;
      }
    }
  }

  private showNotice(text: string, durationSec = 2.6): void {
    this.eventNotice = text;
    this.eventNoticeTimer = durationSec;
  }

  private spawnSparks(worldX: number, worldY: number, worldZ: number): void {
    const now = performance.now();
    if (now - this.lastSparkMs < 120) return;
    this.lastSparkMs = now;
    for (let i = 0; i < this.sparkPool.length; i++) {
      const sp = this.sparkPool[i];
      sp.mesh.visible = true;
      sp.mesh.position.set(worldX, worldY + 0.55, worldZ);
      sp.vx = (Math.random() - 0.5) * 11;
      sp.vy = 2.5 + Math.random() * 5.5;
      sp.vz = (Math.random() - 0.5) * 10;
      sp.life = 0.42 + Math.random() * 0.2;
    }
  }

  private hideSparks(): void {
    for (let i = 0; i < this.sparkPool.length; i++) {
      this.sparkPool[i].mesh.visible = false;
      this.sparkPool[i].life = 0;
    }
  }

  private updateSparks(dt: number): void {
    for (let i = 0; i < this.sparkPool.length; i++) {
      const sp = this.sparkPool[i];
      if (sp.life <= 0) continue;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.mesh.visible = false;
        continue;
      }
      sp.vy -= 18 * dt;
      sp.mesh.position.x += sp.vx * dt;
      sp.mesh.position.y += sp.vy * dt;
      sp.mesh.position.z += sp.vz * dt;
      const s = Math.max(0.2, sp.life * 2);
      sp.mesh.scale.set(s, s, s);
    }
  }

  public setInputs(next: Partial<ControlInputs>): void {
    Object.assign(this.inputs, next);
  }

  public cycleCamera(): CameraMode {
    const order: CameraMode[] = ['far', 'close', 'cockpit'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    return next;
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleOrientationResize);
    document.addEventListener('fullscreenchange', this.handleOrientationResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
  }

  private handleOrientationResize = (): void => {
    this.handleResize();
    window.setTimeout(() => this.handleResize(), 140);
    window.setTimeout(() => this.handleResize(), 320);
  };

  private handleResize = (): void => {
    if (this.disposed || !this.renderer || !this.camera) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    );
  };

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = () => {
      if (this.disposed || !this.renderer) return;
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      this.update(dt, now);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    if (!this.renderer) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number, nowMs: number): void {
    if (this.mode === 'garage') {
      this.updateGarage(dt);
      return;
    }

    if (this.phase === 'racing') {
      this.elapsedMs = nowMs - this.raceStartTimeMs;
      this.updateDynamicWeather();
      this.updateModeTimers(dt);
    }

    if (this.eventNoticeTimer > 0) {
      this.eventNoticeTimer = Math.max(0, this.eventNoticeTimer - dt);
      if (this.eventNoticeTimer === 0) this.eventNotice = null;
    }

    if (this.shieldSec > 0) this.shieldSec = Math.max(0, this.shieldSec - dt);
    if (this.magnetSec > 0) this.magnetSec = Math.max(0, this.magnetSec - dt);

    this.updateRacers(dt, nowMs);
    this.updateTrackPooling(nowMs);
    this.updateNitroPickups(dt, nowMs);
    this.updatePowerUpsAndCoins(dt, nowMs);
    this.updateRampsAndBoostPads(dt);
    this.updateTraffic(dt);
    this.updatePoliceChase(dt);
    this.updateSparks(dt);
    this.updateRain(dt);
    this.updateCameraAndSun(dt, nowMs);

    if (this.localRacer && this.phase === 'racing') {
      const speedRatio = this.localRacer.speedMs / this.localRacer.physics.maxSpeedMs;
      const gearBand = (speedRatio * 5.8) % 1;
      const rpmRatio = 0.25 + gearBand * 0.55 + speedRatio * 0.25;
      const policeDist = this.policeActive ? Math.abs(this.localRacer.z - this.policeZ) : 999;

      this.sound.updateContinuous(
        rpmRatio,
        this.localRacer.speedMs * 3.6,
        this.localRacer.isNitro,
        this.policeActive,
        policeDist
      );
    }

    this.netSyncAccum += dt;
    if (this.netSyncAccum >= 0.066 && this.localRacer && this.phase === 'racing') {
      this.netSyncAccum = 0;
      this.onNetworkSend?.({
        id: this.localRacer.id,
        name: this.localRacer.name,
        avatar: this.localRacer.avatar,
        bikeId: this.localRacer.bikeId,
        paintId: this.localCustomization.paintId,
        underglow: this.localRacer.physics.hasUnderglow,
        z: this.localRacer.z,
        lateralX: this.localRacer.lateralX,
        speedMs: this.localRacer.speedMs,
        leanAngle: this.localRacer.leanAngle,
        wheeliePitch: this.localRacer.wheeliePitch,
        isNitro: this.localRacer.isNitro,
        finishTimeMs: this.localRacer.finishTimeMs,
        wheelieScore: Math.round(this.localRacer.wheelieScore),
        eliminated: this.localRacer.eliminated,
      });
    }

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.05) {
      this.hudSyncAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private updateDynamicWeather(): void {
    if (this.weatherMode !== 'dynamic') return;
    // Cycle every 45 seconds through Day -> Foggy -> Night -> Rainy across the 3-minute race
    const cycle: ActiveWeather[] = ['day', 'foggy', 'night', 'rainy'];
    const idx = Math.floor(this.elapsedMs / 45000) % cycle.length;
    const next = cycle[idx];
    if (next !== this.activeWeather) {
      this.applyTrackAtmosphere(this.currentTrackId, next, false);
      const label =
        next === 'night'
          ? 'Nightfall — Headlights Activated'
          : next === 'rainy'
            ? 'Rain Storm Incoming!'
            : next === 'foggy'
              ? 'Heavy Fog Rolling In'
              : 'Clear Daylight Ahead';
      this.showNotice(label, 3.0);
    }
  }

  private updateModeTimers(dt: number): void {
    if (!this.localRacer) return;

    if (this.gameMode === 'timetrial') {
      this.checkpointTimerSec = Math.max(0, this.checkpointTimerSec - dt);
      const cpZ = this.nextCheckpointIndex * CHECKPOINT_INTERVAL;
      if (this.localRacer.z >= cpZ && cpZ < RACE_DISTANCE) {
        this.nextCheckpointIndex += 1;
        this.checkpointTimerSec += 34;
        this.sound.playCheckpointPass();
        this.showNotice(`CHECKPOINT ${this.nextCheckpointIndex - 1} CLEARED! +34s`, 2.5);
        this.positionCheckpointArch(this.nextCheckpointIndex * CHECKPOINT_INTERVAL);
      }
      if (this.checkpointTimerSec <= 0) {
        this.concludeRace('time_up');
      }
    } else if (this.gameMode === 'knockout') {
      this.knockoutTimerSec -= dt;
      if (this.knockoutTimerSec <= 0) {
        this.knockoutTimerSec = KNOCKOUT_INTERVAL_SEC;
        const active = this.racers.filter((r) => !r.eliminated);
        if (active.length > 1) {
          active.sort((a, b) => b.z - a.z);
          const lastRacer = active[active.length - 1];
          lastRacer.eliminated = true;
          lastRacer.rig.root.visible = false;
          this.sound.playKnockoutElimination();

          if (lastRacer.isLocal) {
            this.concludeRace('eliminated');
            return;
          }
          this.showNotice(`KNOCKOUT! ${lastRacer.name} Eliminated`, 3.2);
          const remaining = this.racers.filter((r) => !r.eliminated);
          if (remaining.length === 1 && remaining[0].isLocal) {
            this.localRacer.finishTimeMs = this.elapsedMs;
            this.concludeRace('knockout_win');
          }
        }
      }
    }
  }

  private updateRain(dt: number): void {
    if (!this.rainLines || !this.rainLines.visible || !this.rainPositions) return;
    const cx = this.camera.position.x;
    const cy = this.camera.position.y;
    const cz = this.camera.position.z;
    const arr = this.rainPositions;
    const fallSpeed = 34 * dt;

    for (let i = 0; i < this.rainCount; i++) {
      const idx = i * 6;
      arr[idx + 1] -= fallSpeed;
      arr[idx + 4] -= fallSpeed;

      if (arr[idx + 1] < cy - 5) {
        const rx = cx + (Math.random() - 0.5) * 42;
        const ry = cy + 9 + Math.random() * 10;
        const rz = cz + (Math.random() - 0.3) * 48;
        arr[idx] = rx;
        arr[idx + 1] = ry;
        arr[idx + 2] = rz;
        arr[idx + 3] = rx - 0.14;
        arr[idx + 4] = ry - 1.05;
        arr[idx + 5] = rz - 0.35;
      }
    }
    (this.rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private updateGarage(dt: number): void {
    this.garageAngle += dt * 0.42;
    if (this.garageBikeRig) {
      this.garageBikeRig.root.rotation.y = this.garageAngle;
    }
    const nextFov = THREE.MathUtils.damp(this.camera.fov, 44, 5, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.015) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(0.24, 1.38, 3.25);
    this.camera.lookAt(0, 0.72, 0);
    this.sunLight.position.set(5, 8, 5);
    this.sunLight.target.position.set(0, 0.6, 0);
  }

  private updateRacers(dt: number, nowMs: number): void {
    const remoteMap = this.remoteUpdatesProvider?.();

    for (const r of this.racers) {
      if (r.eliminated) continue;
      r.isSpeaking = this.speakingProvider ? this.speakingProvider(r.id) : false;

      if (r.isLocal) {
        this.updateLocalPlayer(r, dt, nowMs);
      } else if (r.isHuman && remoteMap && remoteMap.has(r.id)) {
        const u = remoteMap.get(r.id)!;
        if (u.name) r.name = u.name;
        if (u.avatar) r.avatar = u.avatar;
        r.z = THREE.MathUtils.damp(r.z, u.z, 12, dt);
        r.lateralX = THREE.MathUtils.damp(r.lateralX, u.lateralX, 12, dt);
        r.speedMs = u.speedMs;
        r.leanAngle = THREE.MathUtils.damp(r.leanAngle, u.leanAngle, 10, dt);
        r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, u.wheeliePitch, 10, dt);
        r.isNitro = u.isNitro;
        r.wheelieScore = u.wheelieScore;
        r.finishTimeMs = u.finishTimeMs;
        r.y = getRoadSurfaceY(r.lateralX, r.z, this.currentTrackId);
        r.wheelRot += r.speedMs * dt * 2.1;
      } else {
        this.updateAiRacer(r, dt, nowMs);
      }

      this.placeRacerTransform(r, nowMs);
    }
  }

  private updateLocalPlayer(r: RacerActor, dt: number, nowMs: number): void {
    const phys = r.physics;
    if (this.phase === 'countdown') {
      r.speedMs = 0;
      r.y = getRoadSurfaceY(r.lateralX, r.z, this.currentTrackId);
      return;
    }

    if (this.phase === 'finished') {
      r.speedMs = THREE.MathUtils.damp(r.speedMs, 18, 1.6, dt);
      r.z += r.speedMs * dt;
      r.wheelRot += r.speedMs * dt * 2.1;
      r.y = getRoadSurfaceY(r.lateralX, r.z, this.currentTrackId);
      r.leanAngle = THREE.MathUtils.damp(r.leanAngle, 0, 5, dt);
      r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, 0, 5, dt);
      r.isNitro = false;
      return;
    }

    const ctrl = this.controlsRef ? this.controlsRef.current : this.inputs;

    // Collectible Nitro
    const wantsNitro = ctrl.nitro && r.nitro > 1 && r.speedMs > 8;
    r.isNitro = wantsNitro;
    if (wantsNitro) {
      r.nitro = Math.max(0, r.nitro - phys.nitroBurnRate * dt);
    }

    const mobileTuning = this.isMobile || this.touchTuningEnabled;
    // Mobile devices get a 32% top-speed & 34% acceleration reduction for realistic, controllable racing
    const speedScale = mobileTuning ? 0.68 : 1.0;
    const accelScale = mobileTuning ? 0.66 : 1.0;
    const nitroBonusScale = mobileTuning ? 0.7 : 1.0;

    const onFootpath = Math.abs(r.lateralX) > ROAD_HALF_WIDTH + 0.1;
    const rainGripPenalty = this.activeWeather === 'rainy' ? 0.94 : 1.0;
    const slope = getTrackPitch(r.z, this.currentTrackId); // uphill slows slightly, downhill speeds up
    const slopeAccel = -Math.sin(slope) * (mobileTuning ? 6.0 : 8.5);

    const maxSpeed =
      (phys.maxSpeedMs * speedScale + (r.isNitro ? phys.nitroBonusMs * nitroBonusScale : 0)) *
      (onFootpath ? 0.87 : 1.0);

    const wantsThrottle =
      ctrl.accelerate || (this.autoAccelerate && !ctrl.brake) || r.isNitro;

    if (ctrl.brake) {
      r.speedMs -= (mobileTuning ? 36 : 46) * dt;
    } else if (wantsThrottle) {
      const boostFactor = r.isNitro ? 1.5 : 1.0;
      r.speedMs += (phys.accelMs2 * accelScale * boostFactor + slopeAccel) * dt;
    } else {
      r.speedMs -= (3.6 + r.speedMs * 0.08 - slopeAccel * 0.5) * dt;
    }
    r.speedMs = THREE.MathUtils.clamp(r.speedMs, -6, maxSpeed + (mobileTuning ? 13 : 18));

    // Smoothly bleed excess speed above maxSpeed after boost pads / ramps
    if (r.speedMs > maxSpeed) {
      r.speedMs = THREE.MathUtils.damp(r.speedMs, maxSpeed, 1.9, dt);
    }

    const curSpeedKmh = r.speedMs * 3.6;
    if (curSpeedKmh > this.topSpeedKmh) {
      this.topSpeedKmh = curSpeedKmh;
    }

    r.rig.brakeLightMat.emissiveIntensity = ctrl.brake ? 5.2 : this.activeWeather === 'night' ? 3.2 : 1.6;

    // Frame-rate-independent smooth steering + cornering centrifugal drift (tuned for smooth sharp turns on mobile)
    let steerDir = 0;
    if (ctrl.left) steerDir += 1;
    if (ctrl.right) steerDir -= 1;

    r.steerSmooth = THREE.MathUtils.damp(r.steerSmooth, steerDir, mobileTuning ? 6.8 : 13.5, dt);

    const speedSteerFactor = Math.min(1, Math.abs(r.speedMs) / 10);
    const curvature = getTrackCurvature(r.z, this.currentTrackId);
    const effectiveGrip = phys.gripFactor * rainGripPenalty;
    const driftFactor = mobileTuning ? 0.025 : 0.04;
    const centrifugalPush =
      -curvature * (r.speedMs * r.speedMs) * (driftFactor / Math.max(0.7, effectiveGrip));

    const steerRate = phys.steerSpeed * (mobileTuning ? 0.74 : 1.0);
    const targetLatV =
      r.steerSmooth * steerRate * speedSteerFactor +
      THREE.MathUtils.clamp(centrifugalPush, mobileTuning ? -4.2 : -6.5, mobileTuning ? 4.2 : 6.5);
    r.lateralVx = THREE.MathUtils.damp(r.lateralVx, targetLatV, mobileTuning ? 7.8 : 10.2, dt);
    r.lateralX += r.lateralVx * dt;

    // Curved Roadside Barrier collision (strict delta-time speed decay so 60Hz/144Hz/240Hz PC behave identically)
    const barrierDecay = Math.exp(-1.55 * (1 - phys.crashMitigation) * dt);
    if (r.lateralX > FOOTPATH_OUTER_X) {
      r.lateralX = FOOTPATH_OUTER_X;
      if (r.lateralVx > 0) r.lateralVx = -r.lateralVx * 0.35;
      if (this.shieldSec <= 0) {
        r.speedMs *= barrierDecay;
      }
    } else if (r.lateralX < -FOOTPATH_OUTER_X) {
      r.lateralX = -FOOTPATH_OUTER_X;
      if (r.lateralVx < 0) r.lateralVx = -r.lateralVx * 0.35;
      if (this.shieldSec <= 0) {
        r.speedMs *= barrierDecay;
      }
    }

    const targetLean = -r.steerSmooth * 0.48 * speedSteerFactor;
    r.leanAngle = THREE.MathUtils.damp(r.leanAngle, targetLean, 9.2, dt);

    const canWheelie = ctrl.wheelie && r.speedMs > 10 && !r.airborneFromRamp;
    r.isWheelie = canWheelie;
    const targetPitch = r.airborneFromRamp ? 0.32 : canWheelie ? 0.43 : 0;
    r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, targetPitch, 7.5, dt);
    if (canWheelie) {
      r.wheelieScore += dt * 120 * (r.speedMs / 35);
    }

    r.z += r.speedMs * dt;
    r.wheelRot += r.speedMs * dt * 2.1;

    const groundY = getRoadSurfaceY(r.lateralX, r.z, this.currentTrackId);

    // Speed breakers
    if (Math.abs(r.lateralX) <= ROAD_HALF_WIDTH) {
      const sbIdx = getSpeedBreakerIndex(r.z);
      if (sbIdx !== -1 && r.lastBumperIndex !== sbIdx && r.y <= groundY + 0.16) {
        r.lastBumperIndex = sbIdx;
        const speedKmh = r.speedMs * 3.6;
        r.vy = Math.min(5.2, 2.2 + (r.speedMs / 65) * 2.6);
        r.wheeliePitch = Math.max(r.wheeliePitch, 0.22);
        if (speedKmh > 175 && this.shieldSec <= 0) {
          r.speedMs *= 0.93;
        }
        this.sound.playBumperThud(speedKmh);
      }
    }

    r.vy -= 19.5 * dt;
    r.y += r.vy * dt;
    if (r.y <= groundY) {
      if (r.airborneFromRamp && r.vy < -3) {
        // Landing speed boost from 3D Jump Ramp!
        r.airborneFromRamp = false;
        r.speedMs = Math.min(maxSpeed + 14, r.speedMs + (mobileTuning ? 10 : 14));
        this.boostPadFlash = 0.85;
        this.sound.playBoostPad();
        this.showNotice('STUNT LANDING BOOST!', 1.8);
      } else {
        r.airborneFromRamp = false;
      }
      r.y = groundY;
      r.vy = 0;
    }

    this.collisionFlash = Math.max(0, this.collisionFlash - dt * 2.6);
    this.nitroFlash = Math.max(0, this.nitroFlash - dt * 3.2);
    this.boostPadFlash = Math.max(0, this.boostPadFlash - dt * 2.8);

    // Finish line crossing check (Standard, Time Trial, Knockout)
    if (this.gameMode !== 'endless' && r.z >= RACE_DISTANCE && r.finishTimeMs === null) {
      r.finishTimeMs = this.elapsedMs;
      this.concludeRace('finished');
    }
  }

  private concludeRace(
    reason: 'finished' | 'knockout_win' | 'eliminated' | 'time_up' | 'wrecked' | 'ended'
  ): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.sound.setEngineActive(false);

    if (reason === 'finished' || reason === 'knockout_win') {
      this.sound.playFinishFanfare();
    } else {
      this.sound.playKnockoutElimination();
    }

    const baseTime = this.elapsedMs;
    if (this.gameMode !== 'endless') {
      for (const other of this.racers) {
        if (other.finishTimeMs === null && !other.eliminated) {
          const remaining = Math.max(5, RACE_DISTANCE - other.z);
          const estSpeed = Math.max(32, other.speedMs);
          other.finishTimeMs = baseTime + (remaining / estSpeed) * 1000;
        }
      }
    }

    // Push final stopped-timer HUD snapshot before opening scorecard
    this.emitHudSnapshot();

    this.onRaceFinished?.({
      standings: this.computeStandings(),
      gameMode: this.gameMode,
      trackId: this.currentTrackId,
      weather: this.weatherMode,
      elapsedMs: this.elapsedMs,
      topSpeedKmh: Math.round(this.topSpeedKmh),
      distanceM: Math.round(this.localRacer?.z ?? 0),
      coinsCollected: this.coinsCollected,
      endReason: reason,
    });
  }

  private updateAiRacer(r: RacerActor, dt: number, nowMs: number): void {
    if (this.phase === 'countdown') {
      r.speedMs = 0;
      r.y = getRoadSurfaceY(r.lateralX, r.z, this.currentTrackId);
      return;
    }

    const mobileTuning = this.isMobile || this.touchTuningEnabled;
    const hasRemoteHumans = this.racers.some((x) => x.isHuman && !x.isLocal);
    const aiPaceScale = mobileTuning && !hasRemoteHumans ? 0.69 : 1.0;

    const spec = BIKES[r.bikeId];
    let targetSpeed = spec.physics.maxSpeedMs * r.skill * aiPaceScale;

    if (r.crashTimer > 0) {
      r.crashTimer = Math.max(0, r.crashTimer - dt);
      targetSpeed *= 0.48;
    } else if (this.localRacer && this.phase === 'racing') {
      const gap = r.z - this.localRacer.z;
      if (gap < -65) targetSpeed *= 1.14;
      else if (gap > 75) targetSpeed *= 0.9;
    }

    if (r.isNitro && r.nitro > 1) {
      r.nitro = Math.max(0, r.nitro - 22 * dt);
      targetSpeed += 12;
    } else {
      r.isNitro = r.nitro >= 30 && r.crashTimer <= 0 && Math.sin(nowMs * 0.002 + r.z * 0.01) > 0.6;
    }

    r.speedMs = THREE.MathUtils.damp(r.speedMs, targetSpeed, r.crashTimer > 0 ? 4.5 : 1.9, dt);

    r.aiLaneTimer -= dt;
    if (r.aiLaneTimer <= 0) {
      r.aiLaneTimer = 1.4 + Math.random() * 2.2;
      const lanes = [-3.9, 0, 3.9];
      r.aiTargetLane = lanes[Math.floor(Math.random() * lanes.length)];
    }

    const lanes = [-3.9, 0, 3.9];
    for (let i = 0; i < this.trafficPool.length; i++) {
      const t = this.trafficPool[i];
      if (!t.rig.root.visible) continue;
      const dz = t.z - r.z;
      if (dz > 2 && dz < 42 && Math.abs(t.lateralX - r.lateralX) < t.rig.width * 0.55 + 0.85) {
        let bestLane = r.lateralX > 0 ? -3.9 : 3.9;
        for (const cand of lanes) {
          if (Math.abs(cand - t.lateralX) > 2.2) {
            bestLane = cand;
            break;
          }
        }
        r.aiTargetLane = bestLane;
        break;
      }
    }

    const dx = r.aiTargetLane - r.lateralX;
    r.lateralX += THREE.MathUtils.clamp(dx * 2.6, -7.5, 7.5) * dt;
    r.lateralX = THREE.MathUtils.clamp(r.lateralX, -FOOTPATH_OUTER_X + 0.3, FOOTPATH_OUTER_X - 0.3);

    if (r.crashTimer > 0) {
      r.leanAngle = Math.sin(nowMs * 0.025 + r.z) * 0.42 * r.crashTimer;
      r.wheeliePitch = Math.abs(Math.cos(nowMs * 0.018)) * 0.14 * r.crashTimer;
    } else {
      r.leanAngle = THREE.MathUtils.damp(
        r.leanAngle,
        THREE.MathUtils.clamp(-dx * 0.15, -0.38, 0.38),
        7,
        dt
      );
      r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, 0, 6, dt);
    }

    r.z += r.speedMs * dt;
    r.wheelRot += r.speedMs * dt * 2.1;

    const groundY = getRoadSurfaceY(r.lateralX, r.z, this.currentTrackId);
    if (Math.abs(r.lateralX) <= ROAD_HALF_WIDTH) {
      const sbIdx = getSpeedBreakerIndex(r.z);
      if (sbIdx !== -1 && r.lastBumperIndex !== sbIdx && r.y <= groundY + 0.16) {
        r.lastBumperIndex = sbIdx;
        r.vy = Math.min(4.6, 2.0 + (r.speedMs / 65) * 2.4);
      }
    }

    r.vy -= 19.5 * dt;
    r.y += r.vy * dt;
    if (r.y < groundY) {
      r.y = groundY;
      r.vy = 0;
    }

    if (this.gameMode !== 'endless' && r.z >= RACE_DISTANCE && r.finishTimeMs === null && this.phase === 'racing') {
      r.finishTimeMs = nowMs - this.raceStartTimeMs;
    }
  }

  private updateTrackPooling(nowMs: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const trackId = this.currentTrackId;

    this.updateRoadRibbon(refZ, nowMs);
    this.propPool?.update(refZ);

    // Pooled speed breakers ahead of player
    const firstSbIdx = Math.max(1, Math.floor((refZ - 20) / SPEED_BREAKER_SPACING));
    for (let i = 0; i < this.speedBreakers.length; i++) {
      const bz = (firstSbIdx + i) * SPEED_BREAKER_SPACING;
      const mesh = this.speedBreakers[i];
      if (this.gameMode === 'endless' || bz < RACE_DISTANCE - 40) {
        mesh.visible = true;
        mesh.position.set(
          getTrackCenterX(bz, trackId),
          getTrackElevationY(bz, trackId) + 0.02,
          bz
        );
        mesh.rotation.y = getTrackYaw(bz, trackId);
      } else {
        mesh.visible = false;
      }
    }

    // Dynamic Warning Turn Chevron Signs placed on the outer edge of sharp upcoming curves!
    let leftIdx = 0;
    let rightIdx = 0;
    const scanStart = Math.floor(refZ / 25) * 25 + 25;
    for (let z = scanStart; z <= scanStart + 420; z += 25) {
      const curv = getTrackCurvature(z, trackId);
      if (Math.abs(curv) < 0.0044) continue;
      // curv > 0 => road bends +X (Left); outer edge is -X (Right side of road)
      if (curv > 0 && leftIdx < this.chevronLeftPool.length) {
        const sign = this.chevronLeftPool[leftIdx++];
        const cx = getTrackCenterX(z, trackId);
        const cy = getTrackElevationY(z, trackId);
        const yaw = getTrackYaw(z, trackId);
        const lat = -(FOOTPATH_OUTER_X + 0.65);
        sign.visible = true;
        sign.position.set(cx + lat * Math.cos(yaw), cy, z - lat * Math.sin(yaw));
        sign.rotation.y = yaw + Math.PI; // face approaching racer
      } else if (curv < 0 && rightIdx < this.chevronRightPool.length) {
        const sign = this.chevronRightPool[rightIdx++];
        const cx = getTrackCenterX(z, trackId);
        const cy = getTrackElevationY(z, trackId);
        const yaw = getTrackYaw(z, trackId);
        const lat = FOOTPATH_OUTER_X + 0.65;
        sign.visible = true;
        sign.position.set(cx + lat * Math.cos(yaw), cy, z - lat * Math.sin(yaw));
        sign.rotation.y = yaw + Math.PI;
      }
    }
    for (let i = leftIdx; i < this.chevronLeftPool.length; i++) {
      this.chevronLeftPool[i].visible = false;
    }
    for (let i = rightIdx; i < this.chevronRightPool.length; i++) {
      this.chevronRightPool[i].visible = false;
    }
  }

  private updateNitroPickups(dt: number, nowMs: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const lanes = [-3.9, 0, 3.9];
    const trackId = this.currentTrackId;
    const isEndless = this.gameMode === 'endless';

    for (let i = 0; i < this.nitroPool.length; i++) {
      const p = this.nitroPool[i];
      if (p.z < refZ - 25 && (isEndless || refZ < RACE_DISTANCE - 90)) {
        p.z = refZ + 320 + Math.random() * 140;
        p.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
      }

      p.group.visible = isEndless || p.z < RACE_DISTANCE - 15;
      if (!p.group.visible) continue;

      const cx = getTrackCenterX(p.z, trackId);
      const cy = getTrackElevationY(p.z, trackId);
      const yaw = getTrackYaw(p.z, trackId);
      const bobY = cy + 0.8 + Math.sin(nowMs * 0.004 + p.spinPhase) * 0.14;
      p.group.position.set(cx + p.lateralX * Math.cos(yaw), bobY, p.z - p.lateralX * Math.sin(yaw));
      p.group.rotation.y += dt * 2.5;

      if (this.phase === 'racing') {
        for (let rIdx = 0; rIdx < this.racers.length; rIdx++) {
          const r = this.racers[rIdx];
          if (r.eliminated) continue;
          if (Math.abs(r.z - p.z) < 2.5 && Math.abs(r.lateralX - p.lateralX) < 1.45) {
            r.nitro = Math.min(100, r.nitro + r.physics.nitroPickupGain);
            if (r.isLocal) {
              this.nitroFlash = 1.0;
              this.sound.playNitroPickup();
            }
            p.z = Math.max(p.z, refZ) + 330 + Math.random() * 140;
            p.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
            break;
          }
        }
      }
    }
  }

  private updatePowerUpsAndCoins(dt: number, nowMs: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const trackId = this.currentTrackId;
    const lanes = [-3.9, 0, 3.9];
    const isEndless = this.gameMode === 'endless';

    // Power-Ups (Energy Shield, Coin Magnet, Repair Wrench & Nitro)
    for (let i = 0; i < this.powerUpPool.length; i++) {
      const pu = this.powerUpPool[i];
      if (pu.z < refZ - 25 && (isEndless || refZ < RACE_DISTANCE - 120)) {
        pu.z = refZ + 380 + Math.random() * 180;
        pu.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      pu.group.visible = isEndless || pu.z < RACE_DISTANCE - 25;
      if (!pu.group.visible) continue;

      const cx = getTrackCenterX(pu.z, trackId);
      const cy = getTrackElevationY(pu.z, trackId);
      const yaw = getTrackYaw(pu.z, trackId);
      const bobY = cy + 0.95 + Math.sin(nowMs * 0.005 + pu.spinPhase) * 0.18;
      pu.group.position.set(
        cx + pu.lateralX * Math.cos(yaw),
        bobY,
        pu.z - pu.lateralX * Math.sin(yaw)
      );
      pu.group.rotation.y += dt * 3.0;

      if (this.phase === 'racing' && this.localRacer) {
        const r = this.localRacer;
        if (Math.abs(r.z - pu.z) < 2.7 && Math.abs(r.lateralX - pu.lateralX) < 1.65) {
          this.sound.playPowerUpPickup();
          if (pu.kind === 'shield') {
            this.shieldSec = 10.0;
            this.showNotice('ENERGY SHIELD ACTIVE (10s)', 2.4);
          } else if (pu.kind === 'magnet') {
            this.magnetSec = 12.0;
            this.showNotice('COIN MAGNET ACTIVE (12s)', 2.4);
          } else {
            this.bikeHealth = 100;
            r.nitro = Math.min(100, r.nitro + 55);
            this.nitroFlash = 0.85;
            this.showNotice('REPAIR WRENCH: +100% HEALTH & +55% NITRO', 2.4);
          }
          pu.z = refZ + 440 + Math.random() * 190;
          pu.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
        }
      }
    }

    // Golden Road Coins (pulled in automatically when Coin Magnet is active!)
    for (let i = 0; i < this.coinPool.length; i++) {
      const c = this.coinPool[i];
      if (c.z < refZ - 20 && (isEndless || refZ < RACE_DISTANCE - 90)) {
        c.z = refZ + 240 + Math.random() * 190;
        c.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      c.group.visible = isEndless || c.z < RACE_DISTANCE - 15;
      if (!c.group.visible) continue;

      if (this.phase === 'racing' && this.localRacer) {
        const r = this.localRacer;
        const dz = c.z - r.z;
        // Coin Magnet pulls coins within 34m ahead smoothly toward bike!
        if (this.magnetSec > 0 && dz > -2 && dz < 34) {
          c.lateralX = THREE.MathUtils.damp(c.lateralX, r.lateralX, 9.5, dt);
          c.z = THREE.MathUtils.damp(c.z, r.z, 7.5, dt);
        }

        if (Math.abs(r.z - c.z) < 2.2 && Math.abs(r.lateralX - c.lateralX) < 1.45) {
          this.coinsCollected += 10;
          this.sound.playCoinPickup();
          c.z = refZ + 250 + Math.random() * 190;
          c.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
          continue;
        }
      }

      const cx = getTrackCenterX(c.z, trackId);
      const cy = getTrackElevationY(c.z, trackId);
      const yaw = getTrackYaw(c.z, trackId);
      c.group.position.set(
        cx + c.lateralX * Math.cos(yaw),
        cy + 0.72 + Math.sin(nowMs * 0.005 + c.spinPhase) * 0.1,
        c.z - c.lateralX * Math.sin(yaw)
      );
      c.group.rotation.y += dt * 3.8;
    }
  }

  private updateRampsAndBoostPads(dt: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const trackId = this.currentTrackId;
    const lanes = [-3.9, 0, 3.9];
    const isEndless = this.gameMode === 'endless';

    // 3D Jump Ramps
    for (let i = 0; i < this.rampPool.length; i++) {
      const ramp = this.rampPool[i];
      if (ramp.cooldown > 0) ramp.cooldown = Math.max(0, ramp.cooldown - dt);

      if (ramp.z < refZ - 35 && (isEndless || refZ < RACE_DISTANCE - 140)) {
        ramp.z = refZ + 380 + Math.random() * 190;
        ramp.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      ramp.group.visible = isEndless || ramp.z < RACE_DISTANCE - 40;
      if (!ramp.group.visible) continue;

      const cx = getTrackCenterX(ramp.z, trackId);
      const cy = getTrackElevationY(ramp.z, trackId);
      const yaw = getTrackYaw(ramp.z, trackId);
      const pitch = getTrackPitch(ramp.z, trackId);
      ramp.group.position.set(
        cx + ramp.lateralX * Math.cos(yaw),
        cy + 0.02,
        ramp.z - ramp.lateralX * Math.sin(yaw)
      );
      ramp.group.rotation.order = 'YXZ';
      ramp.group.rotation.y = yaw;
      ramp.group.rotation.x = -pitch;

      if (this.phase === 'racing' && this.localRacer && ramp.cooldown <= 0) {
        const r = this.localRacer;
        if (Math.abs(r.z - ramp.z) < 3.4 && Math.abs(r.lateralX - ramp.lateralX) < 1.75) {
          ramp.cooldown = 1.5;
          r.vy = Math.max(10.5, Math.min(13.2, 8.2 + (r.speedMs / 75) * 4.5));
          r.airborneFromRamp = true;
          r.wheelieScore += 180;
          this.sound.playRampJump();
          this.showNotice('MEGA RAMP LAUNCH!', 1.6);
        }
      }
    }

    // Glowing Blue Speed Boost Pads
    for (let i = 0; i < this.boostPadPool.length; i++) {
      const pad = this.boostPadPool[i];
      if (pad.cooldown > 0) pad.cooldown = Math.max(0, pad.cooldown - dt);

      if (pad.z < refZ - 30 && (isEndless || refZ < RACE_DISTANCE - 100)) {
        pad.z = refZ + 320 + Math.random() * 180;
        pad.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      pad.mesh.visible = isEndless || pad.z < RACE_DISTANCE - 30;
      if (!pad.mesh.visible) continue;

      const cx = getTrackCenterX(pad.z, trackId);
      const cy = getTrackElevationY(pad.z, trackId);
      const yaw = getTrackYaw(pad.z, trackId);
      const pitch = getTrackPitch(pad.z, trackId);
      pad.mesh.position.set(
        cx + pad.lateralX * Math.cos(yaw),
        cy + 0.04,
        pad.z - pad.lateralX * Math.sin(yaw)
      );
      pad.mesh.rotation.order = 'YXZ';
      pad.mesh.rotation.y = yaw;
      pad.mesh.rotation.x = -pitch;

      if (this.phase === 'racing' && this.localRacer && pad.cooldown <= 0) {
        const r = this.localRacer;
        if (Math.abs(r.z - pad.z) < 4.5 && Math.abs(r.lateralX - pad.lateralX) < 1.8 && r.y < cy + 0.8) {
          pad.cooldown = 1.2;
          r.speedMs = Math.min(r.physics.maxSpeedMs + r.physics.nitroBonusMs + 18, r.speedMs + 24);
          r.nitro = Math.min(100, r.nitro + 12);
          this.boostPadFlash = 1.0;
          this.sound.playBoostPad();
        }
      }
    }
  }

  private updateTraffic(dt: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const trackId = this.currentTrackId;
    const lanes = [-3.9, 0, 3.9];
    const isEndless = this.gameMode === 'endless';
    // Endless Highway gradually ramps traffic speed with distance
    const endlessSpeedScale = isEndless ? 1 + Math.min(0.65, refZ / 16000) : 1;

    for (const t of this.trafficPool) {
      t.z += t.speedMs * endlessSpeedScale * dt;

      t.laneTimer -= dt;
      if (t.laneTimer <= 0) {
        t.laneTimer = 3.5 + Math.random() * 4.5;
        t.targetLaneX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      t.lateralX = THREE.MathUtils.damp(t.lateralX, t.targetLaneX, 2.4, dt);

      if (t.z < refZ - 55 && (isEndless || refZ < RACE_DISTANCE - 120)) {
        t.z = refZ + 320 + Math.random() * 200;
        const nextLane = lanes[Math.floor(Math.random() * lanes.length)];
        t.lateralX = nextLane;
        t.targetLaneX = nextLane;
      }

      t.rig.root.visible = isEndless || t.z < RACE_DISTANCE - 25;

      const cx = getTrackCenterX(t.z, trackId);
      const cy = getTrackElevationY(t.z, trackId);
      const yaw = getTrackYaw(t.z, trackId);
      const pitch = getTrackPitch(t.z, trackId);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      t.rig.root.position.set(cx + t.lateralX * cosY, cy, t.z - t.lateralX * sinY);
      t.rig.root.rotation.order = 'YXZ';
      t.rig.root.rotation.y = yaw;
      t.rig.root.rotation.x = -pitch;

      if (!t.rig.root.visible || this.phase !== 'racing') continue;

      const hitLen = t.rig.length * 0.5 + 0.85;
      const hitWidth = t.rig.width * 0.5 + 0.32;

      for (let rIdx = 0; rIdx < this.racers.length; rIdx++) {
        const r = this.racers[rIdx];
        if (r.eliminated) continue;
        if (r.isHuman && !r.isLocal) continue;

        const dz = Math.abs(r.z - t.z);
        const dx = Math.abs(r.lateralX - t.lateralX);

        if (dz < hitLen && dx < hitWidth && r.y < cy + t.rig.height) {
          const pushDir = r.lateralX >= t.lateralX ? 1 : -1;

          // Energy Shield protects local player from traffic crash damage & speed loss!
          if (r.isLocal && this.shieldSec > 0) {
            r.lateralVx = pushDir * 8.5;
            this.spawnSparks(cx + r.lateralX * cosY, r.y, r.z - r.lateralX * sinY);
            t.z -= 12; // deflect traffic safely
            this.sound.playBumperThud(140);
            continue;
          }

          const mitigation = r.physics.crashMitigation;
          const speedKeep = 0.46 + mitigation * 0.36;
          r.speedMs = Math.max(14, r.speedMs * speedKeep);
          r.z = t.z - hitLen - 0.55;

          const worldX = cx + r.lateralX * cosY;
          const worldZ = r.z - r.lateralX * sinY;
          this.spawnSparks(worldX, r.y, worldZ);

          if (r.isLocal) {
            r.lateralVx = pushDir * 11;
            this.collisionFlash = 1.0;
            this.sound.playCrashImpact();

            const dmg = Math.round(24 * (1 - mitigation));
            this.bikeHealth = Math.max(0, this.bikeHealth - dmg);
            if (this.gameMode === 'endless' && this.bikeHealth <= 0) {
              this.concludeRace('wrecked');
              return;
            }

            if (TRACKS[this.currentTrackId].hasPoliceChase && !this.policeActive) {
              this.triggerPoliceChase();
            }
          } else if (r.isAI) {
            r.crashTimer = 0.9;
            r.crashDir = pushDir;
            r.lateralX = THREE.MathUtils.clamp(
              r.lateralX + pushDir * 1.4,
              -FOOTPATH_OUTER_X + 0.4,
              FOOTPATH_OUTER_X - 0.4
            );
            r.aiTargetLane = pushDir > 0 ? 3.9 : -3.9;
          }
        }
      }
    }
  }

  private triggerPoliceChase(): void {
    if (!this.localRacer) return;
    this.policeActive = true;
    this.policeEscaped = false;
    this.policeTimerSec = 15.0;
    this.policeZ = Math.max(0, this.localRacer.z - 36);
    this.policeLateralX = this.localRacer.lateralX > 0 ? -3.2 : 3.2;
    this.policeSpeedMs = Math.max(40, this.localRacer.speedMs + 12);
    this.policeRig.root.visible = true;
  }

  private updatePoliceChase(dt: number): void {
    if (!this.policeActive || !this.localRacer) return;

    if (this.phase !== 'racing') {
      this.policeActive = false;
      this.policeRig.root.visible = false;
      return;
    }

    this.policeFlashPhase += dt * 12;
    const redOn = Math.sin(this.policeFlashPhase) > 0;
    if (
      this.policeRig.redBeaconMat &&
      this.policeRig.blueBeaconMat &&
      this.policeRig.redGlowMat &&
      this.policeRig.blueGlowMat
    ) {
      this.policeRig.redBeaconMat.color.setHex(redOn ? 0xff2a2a : 0x550a0a);
      this.policeRig.blueBeaconMat.color.setHex(redOn ? 0x1e3a8a : 0x3b82f6);
      this.policeRig.redGlowMat.opacity = redOn ? 0.58 : 0.05;
      this.policeRig.blueGlowMat.opacity = redOn ? 0.05 : 0.58;
    }

    const playerZ = this.localRacer.z;
    const playerLat = this.localRacer.lateralX;
    const gap = playerZ - this.policeZ;

    const policeScale = this.isMobile || this.touchTuningEnabled ? 0.68 : 1.0;
    const desiredSpeed = (gap > 22 ? 82 : gap > 9 ? 72 : 62) * policeScale;
    this.policeSpeedMs = THREE.MathUtils.damp(this.policeSpeedMs, desiredSpeed, 2.2, dt);
    this.policeZ += this.policeSpeedMs * dt;

    // Never block the chase camera
    const nearCameraZone = playerZ - this.policeZ < 9.5;
    let targetPoliceLat = playerLat;
    if (nearCameraZone) {
      targetPoliceLat =
        playerLat >= 0 ? Math.max(-5.0, playerLat - 3.6) : Math.min(5.0, playerLat + 3.6);
    }
    this.policeLateralX = THREE.MathUtils.damp(this.policeLateralX, targetPoliceLat, 3.6, dt);

    if (Math.abs(this.policeLateralX - playerLat) < 2.5 && this.policeZ > playerZ - 8.8) {
      this.policeZ = playerZ - 8.8;
    }

    const cx = getTrackCenterX(this.policeZ, this.currentTrackId);
    const cy = getTrackElevationY(this.policeZ, this.currentTrackId);
    const yaw = getTrackYaw(this.policeZ, this.currentTrackId);
    const pitch = getTrackPitch(this.policeZ, this.currentTrackId);
    this.policeRig.root.position.set(
      cx + this.policeLateralX * Math.cos(yaw),
      cy,
      this.policeZ - this.policeLateralX * Math.sin(yaw)
    );
    this.policeRig.root.rotation.order = 'YXZ';
    this.policeRig.root.rotation.y = yaw;
    this.policeRig.root.rotation.x = -pitch;

    if (
      Math.abs(playerZ - this.policeZ) < 3.0 &&
      Math.abs(playerLat - this.policeLateralX) < 1.65
    ) {
      if (this.shieldSec > 0) {
        this.policeZ -= 11;
        this.sound.playBumperThud(150);
      } else {
        const keep = 0.76 + this.localRacer.physics.crashMitigation * 0.14;
        this.localRacer.speedMs = Math.max(18, this.localRacer.speedMs * keep);
        this.policeZ -= 7.5;
        this.policeTimerSec = Math.min(15.0, this.policeTimerSec + 2.5);
        this.collisionFlash = 0.85;
        this.sound.playCrashImpact();
      }
    }

    this.policeTimerSec -= dt;
    if (this.policeTimerSec <= 0) {
      this.policeActive = false;
      this.policeEscaped = true;
      this.policeRig.root.visible = false;
    }
  }

  private updateCameraAndSun(dt: number, nowMs: number): void {
    if (!this.localRacer) return;
    const r = this.localRacer;
    const trackId = this.currentTrackId;

    const px = r.rig.root.position.x;
    const py = r.rig.root.position.y;
    const pz = r.rig.root.position.z;
    this.sunLight.position.set(px + 28, py + 46, pz + 18);
    this.sunLight.target.position.set(px, py, pz + 14);

    if (this.phase === 'finished') {
      this.finishOrbitAngle += dt * 0.65;
      const ox = px + Math.sin(this.finishOrbitAngle) * 4.8;
      const oz = pz + Math.cos(this.finishOrbitAngle) * 4.8;
      this.camPos.lerp(_vec3A.set(ox, py + 2.05, oz), 1 - Math.exp(-4 * dt));
      this.camLook.lerp(_vec3B.set(px, py + 0.95, pz), 1 - Math.exp(-6 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.skyDome.position.copy(this.camera.position);
      return;
    }

    const yaw = getTrackYaw(r.z, trackId);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    const speedShake = Math.max(0, (r.speedMs - 40) / 45) * 0.018;
    const nitroShake = r.isNitro ? 0.024 : 0;
    const impactShake = this.collisionFlash * 0.12;
    const totalShake = speedShake + nitroShake + impactShake;
    const shakeX = totalShake > 0 ? Math.sin(nowMs * 0.043) * totalShake : 0;
    const shakeY = totalShake > 0 ? Math.cos(nowMs * 0.061) * totalShake * 0.75 : 0;

    this.camRoll = THREE.MathUtils.damp(this.camRoll, -r.leanAngle * 0.14, 7.5, dt);

    if (this.cameraMode === 'cockpit') {
      r.rig.cockpitAnchor.getWorldPosition(_vec3A);
      this.camera.position.set(_vec3A.x + shakeX * 0.4, _vec3A.y + shakeY * 0.4, _vec3A.z);

      const lookY = getTrackElevationY(r.z + 22, trackId) + 0.95;
      _vec3B.set(_vec3A.x + sinY * 22, lookY + r.wheeliePitch * 7.5, _vec3A.z + cosY * 22);
      this.camera.lookAt(_vec3B);
      this.camera.rotateZ(this.camRoll * 1.4);

      const targetFov = 78 + (r.isNitro ? 12 : (r.speedMs / 85) * 6);
      this.camFov = THREE.MathUtils.damp(this.camFov, targetFov, 7, dt);
      if (Math.abs(this.camera.fov - this.camFov) > 0.015) {
        this.camera.fov = this.camFov;
        this.camera.updateProjectionMatrix();
      }
      this.skyDome.position.copy(this.camera.position);
      return;
    }

    const isFar = this.cameraMode === 'far';
    const aspect = this.camera.aspect || 1.6;
    const isWideMobile = aspect > 1.78;
    const isPortrait = aspect < 0.95;

    // Responsive aspect-ratio chase framing so bike & rider stay large and centered on all screens
    const dist = isFar
      ? isWideMobile
        ? 4.95
        : isPortrait
          ? 5.6
          : 4.6
      : isWideMobile
        ? 3.55
        : 3.25;
    const height = isFar
      ? isWideMobile
        ? 1.88
        : isPortrait
          ? 2.25
          : 2.05
      : isWideMobile
        ? 1.54
        : 1.62;
    const baseFov = isFar ? (isWideMobile ? 58 : isPortrait ? 74 : 65) : isWideMobile ? 62 : 68;

    const safeLat = THREE.MathUtils.clamp(
      r.lateralX,
      -(FOOTPATH_OUTER_X - 0.8),
      FOOTPATH_OUTER_X - 0.8
    );
    const camTrackZ = r.z - dist;
    const camTrackCx = getTrackCenterX(camTrackZ, trackId);
    const camTrackCy = getTrackElevationY(camTrackZ, trackId);
    const camTrackYaw = getTrackYaw(camTrackZ, trackId);

    const targetCamX = camTrackCx + safeLat * Math.cos(camTrackYaw);
    const targetCamZ = camTrackZ - safeLat * Math.sin(camTrackYaw);
    let targetCamY = Math.max(camTrackCy + 1.15, r.y + height);

    for (let i = 0; i < this.trafficPool.length; i++) {
      const t = this.trafficPool[i];
      if (!t.rig.root.visible) continue;
      if (
        Math.abs(t.z - camTrackZ) < t.rig.length * 0.5 + 1.8 &&
        Math.abs(t.lateralX - safeLat) < t.rig.width * 0.5 + 1.0
      ) {
        targetCamY = Math.max(targetCamY, camTrackCy + t.rig.height + 0.75);
      }
    }

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetCamX, 12.5, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetCamY, 10.0, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetCamZ, 12.5, dt);

    const lookZ = r.z + (isFar ? 15 : 13);
    const lookCx = getTrackCenterX(lookZ, trackId);
    const lookCy = getTrackElevationY(lookZ, trackId);
    const lookYaw = getTrackYaw(lookZ, trackId);
    _vec3C.set(
      lookCx + safeLat * 0.55 * Math.cos(lookYaw),
      Math.max(lookCy + 1.05, r.y + 0.9),
      lookZ - safeLat * 0.55 * Math.sin(lookYaw)
    );
    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, _vec3C.x, 15, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, _vec3C.y, 13, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, _vec3C.z, 15, dt);

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.camera.rotateZ(this.camRoll);

    const targetFov = baseFov + (r.speedMs / 85) * 6.0 + (r.isNitro ? 12.5 : 0);
    this.camFov = THREE.MathUtils.damp(this.camFov, targetFov, 7.5, dt);
    if (Math.abs(this.camera.fov - this.camFov) > 0.015) {
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
    }

    this.skyDome.position.copy(this.camera.position);
  }

  private computeStandings(): RaceStanding[] {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.finishTimeMs !== null && b.finishTimeMs !== null) {
        return a.finishTimeMs - b.finishTimeMs;
      }
      if (a.finishTimeMs !== null) return -1;
      if (b.finishTimeMs !== null) return 1;
      return b.z - a.z;
    });

    return sorted.map((r, idx) => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      bikeId: r.bikeId,
      isLocal: r.isLocal,
      isAI: r.isAI,
      rank: idx + 1,
      distanceZ: r.z,
      finishTimeMs: r.finishTimeMs,
      wheelieScore: Math.round(r.wheelieScore),
      speedKmh: Math.round(Math.max(0, r.speedMs * 3.6)),
      eliminated: r.eliminated,
    }));
  }

  private emitHudSnapshot(): void {
    if (!this.localRacer || !this.onHudUpdate) return;
    const r = this.localRacer;
    const standings = this.computeStandings();
    const myStanding = standings.find((s) => s.isLocal);
    const rankMap = new Map<string, number>();
    for (const s of standings) rankMap.set(s.id, s.rank);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const floatingTags: FloatingTag[] = [];
    for (const racer of this.racers) {
      if (racer.eliminated) continue;
      if (this.cameraMode === 'cockpit' && racer.isLocal) continue;
      _vec3A.copy(racer.rig.root.position);
      _vec3A.y += 2.15;
      const dist = _vec3A.distanceTo(this.camera.position);
      _vec3A.project(this.camera);

      const visible = _vec3A.z > 0 && _vec3A.z < 1 && dist < 135;
      const sx = (_vec3A.x * 0.5 + 0.5) * width;
      const sy = (-_vec3A.y * 0.5 + 0.5) * height;

      floatingTags.push({
        id: racer.id,
        name: racer.name,
        avatar: racer.avatar,
        isLocal: racer.isLocal,
        isSpeaking: racer.isSpeaking,
        positionRank: rankMap.get(racer.id) ?? 1,
        x: sx,
        y: sy,
        visible,
        distance: dist,
      });
    }

    const speedRatio = Math.max(0, r.speedMs / r.physics.maxSpeedMs);
    const gear = r.speedMs < 2 ? 1 : Math.min(6, Math.floor(speedRatio * 5.8) + 1);
    const rpmRatio =
      r.speedMs < 1 ? 0.14 : Math.min(1, 0.22 + ((speedRatio * 5.8) % 1) * 0.62 + speedRatio * 0.22);

    // Look 65m ahead to warn the player of sharp upcoming turns
    const aheadCurv = getTrackCurvature(r.z + 65, this.currentTrackId);
    const absCurv = Math.abs(aheadCurv);
    const turnWarning: 'left' | 'right' | null =
      absCurv > 0.0046 ? (aheadCurv > 0 ? 'left' : 'right') : null;
    const turnIntensity = THREE.MathUtils.clamp((absCurv - 0.0046) / 0.008, 0, 1);
    const slopeDeg = Math.round((getTrackPitch(r.z, this.currentTrackId) * 180) / Math.PI);

    this.onHudUpdate({
      speedKmh: Math.round(Math.max(0, r.speedMs * 3.6)),
      topSpeedKmh: Math.round(this.topSpeedKmh),
      rpmRatio,
      gear,
      nitro: Math.round(r.nitro),
      isNitroActive: r.isNitro,
      isWheelie: r.isWheelie,
      wheelieScore: Math.round(r.wheelieScore),
      positionRank: myStanding?.rank ?? 1,
      progress:
        this.gameMode === 'endless'
          ? (r.z % 2000) / 2000
          : THREE.MathUtils.clamp(r.z / RACE_DISTANCE, 0, 1),
      distanceM: Math.max(0, Math.round(r.z)),
      remainingMeters:
        this.gameMode === 'endless' ? 0 : Math.max(0, Math.round(RACE_DISTANCE - r.z)),
      elapsedMs: this.elapsedMs,
      gameMode: this.gameMode,
      activeWeather: this.activeWeather,
      bikeHealth: Math.round(this.bikeHealth),
      coinsCollected: this.coinsCollected,
      shieldSec: this.shieldSec,
      magnetSec: this.magnetSec,
      turnWarning,
      turnIntensity,
      slopeDeg,
      checkpointTimerSec: this.checkpointTimerSec,
      checkpointIndex: this.nextCheckpointIndex - 1,
      knockoutTimerSec: this.knockoutTimerSec,
      activeRacersCount: this.racers.filter((x) => !x.eliminated).length,
      eventNotice: this.eventNotice,
      police: {
        active: this.policeActive,
        escaped: this.policeEscaped,
        countdownSec: Math.max(0, this.policeTimerSec),
        distanceM: this.policeActive ? Math.round(Math.abs(r.z - this.policeZ)) : 0,
        progress: this.policeActive ? THREE.MathUtils.clamp(this.policeZ / RACE_DISTANCE, 0, 1) : 0,
      },
      standings,
      floatingTags,
      onFootpath: Math.abs(r.lateralX) > ROAD_HALF_WIDTH + 0.1,
      collisionFlash: this.collisionFlash,
      nitroFlash: this.nitroFlash,
      boostPadFlash: this.boostPadFlash,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationResize);
    document.removeEventListener('fullscreenchange', this.handleOrientationResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    this.clearRaceWorld();
    this.disposeObject3D(this.garageGroup);
    if (this.policeRig) this.disposeObject3D(this.policeRig.root);
    for (const sp of this.sparkPool) {
      this.disposeObject3D(sp.mesh);
    }
    this.sparkPool = [];
    this.skyDome?.geometry.dispose();
    this.skyMat?.dispose();
    this.rainLines?.geometry.dispose();
    if (this.rainLines) {
      (this.rainLines.material as THREE.Material).dispose();
    }
    this.contactShadowTex?.dispose();
    this.facadeTex?.dispose();
    this.lampPoolTex?.dispose();
    this.breakerTex?.dispose();
    this.finishTex?.dispose();
    this.checkpointTex?.dispose();
    this.chevronLeftTex?.dispose();
    this.chevronRightTex?.dispose();
    this.boostPadTex?.dispose();
    this.rampTex?.dispose();
    this.envMap?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
  }
}
