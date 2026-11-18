import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from '../audio/SoundEngine';
import { AI_RACER_PROFILES, BIKES, RACE_DISTANCE, TRACKS } from '../data/catalog';
import {
  BikeId,
  CameraMode,
  ControlInputs,
  FloatingTag,
  GamePhase,
  HudSnapshot,
  LobbySlot,
  NetworkRacerUpdate,
  RaceStanding,
  TrackId,
} from '../types/game';
import { InstancedPropPool } from './InstancedProps';
import {
  createNitroPickupGroup,
  createSuperbikeGroup,
  createTrafficVehicle,
  SuperbikeRig,
  TrafficKind,
  TrafficRig,
} from './Models';
import {
  createBuildingFacadeTexture,
  createContactShadowTexture,
  createFinishBannerTexture,
  createFootpathTexture,
  createLampPoolTexture,
  createRoadTexture,
  createSpeedBreakerTexture,
} from './Textures';
import {
  FOOTPATH_OUTER_X,
  getRoadSurfaceY,
  getTrackCenterX,
  getTrackYaw,
  ROAD_HALF_WIDTH,
  SEGMENT_LENGTH,
  SEGMENT_POOL_COUNT,
  SPEED_BREAKER_Z,
} from './TrackMath';

// Pre-allocated math scratchpads (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();

const SKY_GRADIENTS: Record<TrackId, { zenith: string; horizon: string }> = {
  city: { zenith: '#0a1024', horizon: '#1e2c4a' },
  village: { zenith: '#2e7bc4', horizon: '#a3d5f5' },
  forest: { zenith: '#284a42', horizon: '#689385' },
  coastal: { zenith: '#1d76c4', horizon: '#93d6f7' },
};

interface RacerActor {
  id: string;
  name: string;
  bikeId: BikeId;
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

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface RoadSegmentSlot {
  group: THREE.Group;
  segIndex: number;
  oceanMesh?: THREE.Mesh;
}

export class RaceEngine {
  private container: HTMLElement;
  private sound: SoundEngine;
  private isSoftwareGl = false;
  private isMobile = false;
  private autoAccelerate = false;
  private initialized = false;

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

  // Mode & lifecycle
  private mode: 'garage' | 'race' = 'garage';
  private phase: GamePhase = 'lobby';
  private frameId = 0;
  private lastTime = performance.now();
  private disposed = false;

  // Garage objects
  private garageGroup = new THREE.Group();
  private garageBikeRig: SuperbikeRig | null = null;
  private garageBikeId: BikeId = 'apex';
  private garageTrackId: TrackId = 'city';
  private garageAngle = 0.55;

  // Race world objects
  private raceGroup = new THREE.Group();
  private currentTrackId: TrackId = 'city';
  private roadTextures: THREE.Texture[] = [];
  private segments: RoadSegmentSlot[] = [];
  private propPool: InstancedPropPool | null = null;
  private speedBreakers: THREE.Mesh[] = [];
  private trafficPool: TrafficActor[] = [];
  private nitroPool: NitroPickupActor[] = [];
  private sparkPool: SparkParticle[] = [];
  private finishArch: THREE.Group | null = null;

  // Pre-instantiated Police Chase unit (never recreated/compiled during gameplay!)
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

  // Controls & Camera (higher & further back MotoGP/arcade default chase angle)
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
  public onRaceFinished?: (standings: RaceStanding[]) => void;
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

    onProgress(48, 'Generating Environment & Lighting...');
    await this.yieldFrame(16);
    if (this.disposed) return;

    this.initSceneCore();

    onProgress(78, 'Preparing Superbikes & Track Assets...');
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
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    );
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = false;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
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
    // Reduce shadow map resolution on mobile devices to preserve GPU memory
    const shadowSize = this.isMobile ? 512 : 1024;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    const rawAniso = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 1;
    const maxAniso = this.isMobile ? Math.min(4, rawAniso) : rawAniso;
    this.contactShadowTex = createContactShadowTexture();
    this.facadeTex = createBuildingFacadeTexture(maxAniso);
    this.lampPoolTex = createLampPoolTexture();
    this.breakerTex = createSpeedBreakerTexture(maxAniso);
    this.finishTex = createFinishBannerTexture(maxAniso);
  }

  private initPoolsAndGarage(): void {
    // Pre-instantiate & warm Police Interceptor once at startup (zero mid-race lag!)
    this.policeRig = createTrafficVehicle('police', 0x0f172a, this.contactShadowTex);
    this.policeRig.root.visible = false;
    this.policeRig.root.position.set(0, -100, -200);
    this.scene.add(this.policeRig.root);

    // Pre-instantiate lightweight Spark Burst Pool (14 pooled additive spark particles)
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
    this.applyTrackAtmosphere(this.garageTrackId, true);
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

  public setGarageSelection(bikeId: BikeId, trackId: TrackId): void {
    const bikeChanged = !this.garageBikeRig || this.garageBikeId !== bikeId;
    this.garageBikeId = bikeId;
    this.garageTrackId = trackId;

    if (!this.contactShadowTex || !this.scene) return;

    if (bikeChanged) {
      if (this.garageBikeRig) {
        this.garageGroup.remove(this.garageBikeRig.root);
      }
      this.garageBikeRig = createSuperbikeGroup(bikeId, this.contactShadowTex);
      this.garageBikeRig.root.position.y = 0.22;
      this.garageGroup.add(this.garageBikeRig.root);
    }

    if (this.mode === 'garage') {
      this.applyTrackAtmosphere(trackId, true);
    }
  }

  private applyTrackAtmosphere(trackId: TrackId, isGarage = false): void {
    if (!this.scene || !this.skyDome) return;
    const spec = TRACKS[trackId];
    const grad = SKY_GRADIENTS[trackId];
    const fogHex = isGarage ? '#0b101d' : spec.fogColor;
    const fogDensity = isGarage ? 0.025 : spec.fogDensity;

    this.skyDome.visible = !isGarage;
    this.skyMat.uniforms.uZenith.value.set(grad.zenith);
    this.skyMat.uniforms.uHorizon.value.set(spec.fogColor);

    this.scene.background = new THREE.Color(isGarage ? '#0b101d' : spec.skyColor);
    this.scene.fog = new THREE.FogExp2(fogHex, fogDensity);
    this.sunLight.color.set(spec.sunColor);
    this.sunLight.intensity = isGarage ? 1.85 : spec.sunIntensity;
    this.hemiLight.color.set(spec.hemiSky);
    this.hemiLight.groundColor.set(spec.hemiGround);
  }

  public returnToGarage(): void {
    if (!this.initialized) return;
    this.mode = 'garage';
    this.phase = 'lobby';
    this.sound.setEngineActive(false);
    this.policeActive = false;
    this.policeRig.root.visible = false;
    this.hideSparks();
    this.raceGroup.visible = false;
    this.garageGroup.visible = true;
    this.skyDome.position.set(0, 0, 0);
    this.applyTrackAtmosphere(this.garageTrackId, true);
    this.setGarageSelection(this.garageBikeId, this.garageTrackId);
  }

  public startRace(
    trackId: TrackId,
    slots: LobbySlot[],
    remoteProvider: () => Map<string, NetworkRacerUpdate>,
    speakingProvider: (id: string) => boolean
  ): void {
    if (!this.initialized) return;
    this.remoteUpdatesProvider = remoteProvider;
    this.speakingProvider = speakingProvider;

    this.clearRaceWorld();
    this.currentTrackId = trackId;
    this.mode = 'race';
    this.phase = 'countdown';
    this.garageGroup.visible = false;
    this.raceGroup.visible = true;
    this.applyTrackAtmosphere(trackId, false);

    this.buildRaceWorld(trackId);
    this.spawnRacers(slots);

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

    if (this.localRacer) {
      const gz = this.localRacer.z;
      const gx = getTrackCenterX(gz) + this.localRacer.lateralX;
      this.camPos.set(gx, 2.05, gz - 4.6);
      this.camLook.set(gx, 1.02, gz + 14);
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

  private clearRaceWorld(): void {
    for (const tex of this.roadTextures) tex.dispose();
    this.roadTextures = [];
    if (this.propPool) {
      this.propPool.dispose();
      this.propPool = null;
    }
    while (this.raceGroup.children.length > 0) {
      this.raceGroup.remove(this.raceGroup.children[0]);
    }
    this.segments = [];
    this.speedBreakers = [];
    this.trafficPool = [];
    this.nitroPool = [];
    this.racers = [];
    this.localRacer = null;
    this.finishArch = null;
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
      metalness: 0.05,
    });
    const footpathMat = new THREE.MeshStandardMaterial({
      map: footpathTex,
      roughness: 0.9,
      metalness: 0.02,
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: spec.curbColor,
      roughness: 0.85,
    });
    const groundMat = new THREE.MeshStandardMaterial({
      color: spec.groundColor,
      roughness: 0.96,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color:
        trackId === 'city'
          ? 0x94a3b8
          : trackId === 'village'
            ? 0x78350f
            : trackId === 'forest'
              ? 0x475569
              : 0xe2e8f0,
      roughness: 0.6,
      metalness: trackId === 'city' ? 0.65 : 0.1,
    });
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.18,
      metalness: 0.35,
      envMapIntensity: 1.3,
    });

    const segGeoLen = SEGMENT_LENGTH + 1.4;
    const roadGeo = new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, segGeoLen);
    roadGeo.rotateX(-Math.PI / 2);

    const fpWidth = 2.6;
    const fpGeo = new THREE.BoxGeometry(fpWidth, 0.18, segGeoLen);
    const curbGeo = new THREE.BoxGeometry(0.26, 0.2, segGeoLen);
    const wallGeo = new THREE.BoxGeometry(0.32, 0.75, segGeoLen);
    const shoulderGeo = new THREE.PlaneGeometry(110, segGeoLen);
    shoulderGeo.rotateX(-Math.PI / 2);

    const oceanGeo = trackId === 'coastal' ? new THREE.PlaneGeometry(140, segGeoLen, 4, 2) : null;
    if (oceanGeo) oceanGeo.rotateX(-Math.PI / 2);

    // 1. Pooled Road Segments
    for (let i = 0; i < SEGMENT_POOL_COUNT; i++) {
      const segGroup = new THREE.Group();

      const road = new THREE.Mesh(roadGeo, roadMat);
      segGroup.add(road);

      const fpL = new THREE.Mesh(fpGeo, footpathMat);
      fpL.position.set(-(ROAD_HALF_WIDTH + fpWidth / 2), 0.09, 0);
      const fpR = new THREE.Mesh(fpGeo, footpathMat);
      fpR.position.set(ROAD_HALF_WIDTH + fpWidth / 2, 0.09, 0);
      segGroup.add(fpL, fpR);

      const curbL = new THREE.Mesh(curbGeo, curbMat);
      curbL.position.set(-ROAD_HALF_WIDTH - 0.1, 0.1, 0);
      const curbR = new THREE.Mesh(curbGeo, curbMat);
      curbR.position.set(ROAD_HALF_WIDTH + 0.1, 0.1, 0);
      segGroup.add(curbL, curbR);

      const wallL = new THREE.Mesh(wallGeo, wallMat);
      wallL.position.set(-(FOOTPATH_OUTER_X + 0.35), 0.375, 0);
      const wallR = new THREE.Mesh(wallGeo, wallMat);
      wallR.position.set(FOOTPATH_OUTER_X + 0.35, 0.375, 0);
      segGroup.add(wallL, wallR);

      const shoulder = new THREE.Mesh(shoulderGeo, groundMat);
      shoulder.position.y = -0.05;
      segGroup.add(shoulder);

      let oceanMesh: THREE.Mesh | undefined;
      if (oceanGeo) {
        oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
        oceanMesh.position.set(82, -0.35, 0);
        segGroup.add(oceanMesh);
      }

      this.raceGroup.add(segGroup);
      const slot: RoadSegmentSlot = { group: segGroup, segIndex: i - 2, oceanMesh };
      this.positionSegment(slot, i - 2);
      this.segments.push(slot);
    }

    // 2. Pooled Speed Breakers (8 reusable meshes)
    const breakerGeo = new THREE.CylinderGeometry(0.45, 0.45, ROAD_HALF_WIDTH * 2, 10, 1, false, 0, Math.PI);
    breakerGeo.rotateZ(Math.PI / 2);
    const breakerMat = new THREE.MeshStandardMaterial({
      map: this.breakerTex,
      roughness: 0.7,
    });
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(breakerGeo, breakerMat);
      mesh.scale.set(1, 0.48, 1.35);
      mesh.visible = false;
      this.raceGroup.add(mesh);
      this.speedBreakers.push(mesh);
    }

    // 3. InstancedMesh Roadside Props Pool
    this.propPool = new InstancedPropPool(trackId, this.facadeTex, this.lampPoolTex);
    this.propPool.syncAll();
    this.raceGroup.add(this.propPool.group);

    // 4. Pooled Traffic Vehicles (14 vehicles)
    const vehicleColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xe2e8f0, 0x8b5cf6];
    const kinds: TrafficKind[] = ['sedan', 'sedan', 'bus', 'truck', 'sedan'];
    const lanes = [-3.8, 0, 3.8];
    for (let i = 0; i < 14; i++) {
      const kind = kinds[i % kinds.length];
      const color = vehicleColors[i % vehicleColors.length];
      const rig = createTrafficVehicle(kind, color, this.contactShadowTex);
      const lane = lanes[i % lanes.length];
      const actor: TrafficActor = {
        rig,
        z: 65 + i * 34 + Math.random() * 12,
        lateralX: lane,
        targetLaneX: lane,
        speedMs: kind === 'bus' ? 20 : kind === 'truck' ? 23 : 27 + (i % 4) * 3,
        laneTimer: 2 + Math.random() * 4,
      };
      this.raceGroup.add(rig.root);
      this.trafficPool.push(actor);
    }

    // 5. Pooled Collectible Road Nitro Canisters (12 canisters)
    for (let i = 0; i < 12; i++) {
      const group = createNitroPickupGroup();
      const lane = lanes[(i * 2 + 1) % lanes.length];
      const pickup: NitroPickupActor = {
        group,
        z: 85 + i * 36 + Math.random() * 10,
        lateralX: lane,
        spinPhase: i * 0.7,
      };
      this.raceGroup.add(group);
      this.nitroPool.push(pickup);
    }

    // 6. Checkered Finish Line Arch
    this.finishArch = this.createFinishArch();
    const fX = getTrackCenterX(RACE_DISTANCE);
    const fYaw = getTrackYaw(RACE_DISTANCE);
    this.finishArch.position.set(fX, 0, RACE_DISTANCE);
    this.finishArch.rotation.y = fYaw;
    this.raceGroup.add(this.finishArch);
  }

  private createFinishArch(): THREE.Group {
    const g = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 });
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.2, 0.6), pillarMat);
    pL.position.set(-7.6, 3.6, 0);
    const pR = pL.clone();
    pR.position.x = 7.6;
    g.add(pL, pR);

    const bannerMat = new THREE.MeshStandardMaterial({ map: this.finishTex, roughness: 0.4 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(15.6, 2.2, 0.4), bannerMat);
    banner.position.set(0, 6.4, 0);
    g.add(banner);
    return g;
  }

  private positionSegment(slot: RoadSegmentSlot, segIndex: number): void {
    slot.segIndex = segIndex;
    const midZ = segIndex * SEGMENT_LENGTH + SEGMENT_LENGTH * 0.5;
    const cx = getTrackCenterX(midZ);
    const yaw = getTrackYaw(midZ);
    slot.group.position.set(cx, 0, midZ);
    slot.group.rotation.y = yaw;
  }

  private spawnRacers(slots: LobbySlot[]): void {
    const gridLanes = [-3.6, 0, 3.6, -2.0, 2.0];
    const gridZ = [0, -2.5, -2.5, -5.5, -5.5];

    slots.forEach((slot, idx) => {
      const rig = createSuperbikeGroup(slot.bikeId, this.contactShadowTex);
      this.raceGroup.add(rig.root);

      const profile = AI_RACER_PROFILES[idx % AI_RACER_PROFILES.length];
      const racer: RacerActor = {
        id: slot.id,
        name: slot.name,
        bikeId: slot.bikeId,
        isLocal: slot.isLocal,
        isHuman: slot.isHuman,
        isAI: slot.isAI,
        skill: profile ? profile.skill : 0.91,
        rig,
        z: gridZ[idx],
        lateralX: gridLanes[idx],
        lateralVx: 0,
        y: 0,
        vy: 0,
        speedMs: 0,
        leanAngle: 0,
        wheeliePitch: 0,
        wheelRot: 0,
        nitro: 0, // Must collect road Nitro canisters (no auto-refill)
        isNitro: false,
        isWheelie: false,
        wheelieScore: 0,
        finishTimeMs: null,
        aiTargetLane: gridLanes[idx],
        aiLaneTimer: 1.5 + Math.random() * 2.5,
        crashTimer: 0,
        crashDir: 1,
        lastBumperIndex: -1,
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
    const cx = getTrackCenterX(racer.z);
    const yaw = getTrackYaw(racer.z);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    racer.rig.root.position.set(
      cx + racer.lateralX * cosY,
      racer.y,
      racer.z - racer.lateralX * sinY
    );
    racer.rig.root.rotation.y = yaw;
    racer.rig.leanGroup.rotation.z = racer.leanAngle;
    racer.rig.wheeliePivot.rotation.x = -racer.wheeliePitch;
    racer.rig.frontWheel.rotation.x = racer.wheelRot;
    racer.rig.rearWheel.rotation.x = racer.wheelRot;

    racer.rig.riderGroup.rotation.z = racer.leanAngle * 0.42;
    racer.rig.riderGroup.rotation.x = racer.isNitro ? 0.16 : -racer.wheeliePitch * 0.48;
    racer.rig.helmetGroup.rotation.z = -racer.leanAngle * 0.65;

    const showFlame = racer.isNitro;
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

  private spawnSparks(worldX: number, worldY: number, worldZ: number): void {
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
      sp.mesh.position.y = Math.max(0.05, sp.mesh.position.y + sp.vy * dt);
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
    window.addEventListener('orientationchange', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
  }

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
    }

    this.updateRacers(dt, nowMs);
    this.updateTrackPooling(nowMs);
    this.updateNitroPickups(dt, nowMs);
    this.updateTraffic(dt);
    this.updatePoliceChase(dt);
    this.updateSparks(dt);
    this.updateCameraAndSun(dt, nowMs);

    if (this.localRacer && this.phase === 'racing') {
      const spec = BIKES[this.localRacer.bikeId];
      const speedRatio = this.localRacer.speedMs / spec.physics.maxSpeedMs;
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
        bikeId: this.localRacer.bikeId,
        z: this.localRacer.z,
        lateralX: this.localRacer.lateralX,
        speedMs: this.localRacer.speedMs,
        leanAngle: this.localRacer.leanAngle,
        wheeliePitch: this.localRacer.wheeliePitch,
        isNitro: this.localRacer.isNitro,
        finishTimeMs: this.localRacer.finishTimeMs,
        wheelieScore: Math.round(this.localRacer.wheelieScore),
      });
    }

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.042) {
      this.hudSyncAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private updateGarage(dt: number): void {
    this.garageAngle += dt * 0.42;
    if (this.garageBikeRig) {
      this.garageBikeRig.root.rotation.y = this.garageAngle;
    }
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 44, 5, dt);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0.24, 1.38, 3.25);
    this.camera.lookAt(0, 0.72, 0);
    this.sunLight.position.set(5, 8, 5);
    this.sunLight.target.position.set(0, 0.6, 0);
  }

  private updateRacers(dt: number, nowMs: number): void {
    const remoteMap = this.remoteUpdatesProvider?.();

    for (const r of this.racers) {
      r.isSpeaking = this.speakingProvider ? this.speakingProvider(r.id) : false;

      if (r.isLocal) {
        this.updateLocalPlayer(r, dt, nowMs);
      } else if (r.isHuman && remoteMap && remoteMap.has(r.id)) {
        const u = remoteMap.get(r.id)!;
        r.z = THREE.MathUtils.damp(r.z, u.z, 12, dt);
        r.lateralX = THREE.MathUtils.damp(r.lateralX, u.lateralX, 12, dt);
        r.speedMs = u.speedMs;
        r.leanAngle = THREE.MathUtils.damp(r.leanAngle, u.leanAngle, 10, dt);
        r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, u.wheeliePitch, 10, dt);
        r.isNitro = u.isNitro;
        r.wheelieScore = u.wheelieScore;
        r.finishTimeMs = u.finishTimeMs;
        r.y = getRoadSurfaceY(r.lateralX);
        r.wheelRot += r.speedMs * dt * 2.1;
      } else {
        this.updateAiRacer(r, dt, nowMs);
      }

      this.placeRacerTransform(r, nowMs);
    }
  }

  private updateLocalPlayer(r: RacerActor, dt: number, nowMs: number): void {
    const spec = BIKES[r.bikeId];
    if (this.phase === 'countdown') {
      r.speedMs = 0;
      return;
    }

    if (this.phase === 'finished') {
      r.speedMs = THREE.MathUtils.damp(r.speedMs, 18, 1.6, dt);
      r.z += r.speedMs * dt;
      r.wheelRot += r.speedMs * dt * 2.1;
      r.leanAngle = THREE.MathUtils.damp(r.leanAngle, 0, 5, dt);
      r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, 0, 5, dt);
      r.isNitro = false;
      return;
    }

    // Collectible Nitro ONLY (zero passive auto-regeneration!)
    const wantsNitro = this.inputs.nitro && r.nitro > 1 && r.speedMs > 8;
    r.isNitro = wantsNitro;
    if (wantsNitro) {
      r.nitro = Math.max(0, r.nitro - 24 * dt);
    }

    const onFootpath = Math.abs(r.lateralX) > ROAD_HALF_WIDTH + 0.1;
    const maxSpeed =
      (spec.physics.maxSpeedMs + (r.isNitro ? spec.physics.nitroBonusMs : 0)) *
      (onFootpath ? 0.88 : 1.0);

    const wantsThrottle =
      this.inputs.accelerate || (this.autoAccelerate && !this.inputs.brake) || r.isNitro;

    if (this.inputs.brake) {
      r.speedMs -= 44 * dt;
    } else if (wantsThrottle) {
      const boostFactor = r.isNitro ? 1.55 : 1.0;
      r.speedMs += spec.physics.accelMs2 * boostFactor * dt;
    } else {
      r.speedMs -= (3.5 + r.speedMs * 0.08) * dt;
    }
    r.speedMs = THREE.MathUtils.clamp(r.speedMs, -6, maxSpeed);

    r.rig.brakeLightMat.emissiveIntensity = this.inputs.brake ? 4.5 : 1.5;

    let steerDir = 0;
    if (this.inputs.left) steerDir += 1;
    if (this.inputs.right) steerDir -= 1;

    const speedSteerFactor = Math.min(1, Math.abs(r.speedMs) / 14);
    const targetLatV = steerDir * spec.physics.steerSpeed * speedSteerFactor;
    r.lateralVx = THREE.MathUtils.damp(r.lateralVx, targetLatV, 9.5, dt);
    r.lateralX += r.lateralVx * dt;

    if (r.lateralX > FOOTPATH_OUTER_X) {
      r.lateralX = FOOTPATH_OUTER_X;
      if (r.lateralVx > 0) r.lateralVx = -r.lateralVx * 0.35;
      r.speedMs *= 0.985;
    } else if (r.lateralX < -FOOTPATH_OUTER_X) {
      r.lateralX = -FOOTPATH_OUTER_X;
      if (r.lateralVx < 0) r.lateralVx = -r.lateralVx * 0.35;
      r.speedMs *= 0.985;
    }

    const targetLean = -steerDir * 0.44 * speedSteerFactor;
    r.leanAngle = THREE.MathUtils.damp(r.leanAngle, targetLean, 9.0, dt);

    const canWheelie = this.inputs.wheelie && r.speedMs > 10;
    r.isWheelie = canWheelie;
    const targetPitch = canWheelie ? 0.43 : 0;
    r.wheeliePitch = THREE.MathUtils.damp(r.wheeliePitch, targetPitch, 7.5, dt);
    if (canWheelie) {
      r.wheelieScore += dt * 120 * (r.speedMs / 35);
    }

    r.z += r.speedMs * dt;
    r.wheelRot += r.speedMs * dt * 2.1;

    const groundY = getRoadSurfaceY(r.lateralX);

    if (Math.abs(r.lateralX) <= ROAD_HALF_WIDTH) {
      for (let i = 0; i < SPEED_BREAKER_Z.length; i++) {
        const bz = SPEED_BREAKER_Z[i];
        if (Math.abs(r.z - bz) < 0.85 && r.lastBumperIndex !== i && r.y <= groundY + 0.12) {
          r.lastBumperIndex = i;
          const speedKmh = r.speedMs * 3.6;
          r.vy = Math.min(5.2, 2.2 + (r.speedMs / 65) * 2.8);
          r.wheeliePitch = Math.max(r.wheeliePitch, 0.22);
          if (speedKmh > 165) {
            r.speedMs *= 0.92;
          }
          this.sound.playBumperThud(speedKmh);
          break;
        }
      }
    }

    r.vy -= 18.5 * dt;
    r.y += r.vy * dt;
    if (r.y < groundY) {
      r.y = groundY;
      r.vy = 0;
    }

    this.collisionFlash = Math.max(0, this.collisionFlash - dt * 2.6);
    this.nitroFlash = Math.max(0, this.nitroFlash - dt * 3.2);

    if (r.z >= RACE_DISTANCE && r.finishTimeMs === null) {
      r.finishTimeMs = nowMs - this.raceStartTimeMs;
      this.phase = 'finished';
      this.sound.playFinishFanfare();
      this.sound.setEngineActive(false);

      for (const other of this.racers) {
        if (other.finishTimeMs === null) {
          const remaining = Math.max(5, RACE_DISTANCE - other.z);
          const estSpeed = Math.max(35, other.speedMs);
          other.finishTimeMs = r.finishTimeMs + (remaining / estSpeed) * 1000;
        }
      }
      this.onRaceFinished?.(this.computeStandings());
    }
  }

  private updateAiRacer(r: RacerActor, dt: number, nowMs: number): void {
    if (this.phase === 'countdown') {
      r.speedMs = 0;
      return;
    }

    const spec = BIKES[r.bikeId];
    let targetSpeed = spec.physics.maxSpeedMs * r.skill;

    if (r.crashTimer > 0) {
      r.crashTimer = Math.max(0, r.crashTimer - dt);
      targetSpeed *= 0.46; // Slowed down while recovering from traffic crash
    } else if (this.localRacer && this.phase === 'racing') {
      const gap = r.z - this.localRacer.z;
      if (gap < -45) targetSpeed *= 1.13;
      else if (gap > 55) targetSpeed *= 0.91;
    }

    if (r.isNitro && r.nitro > 1) {
      r.nitro = Math.max(0, r.nitro - 22 * dt);
      targetSpeed += 12;
    } else {
      r.isNitro = r.nitro >= 30 && r.crashTimer <= 0 && Math.sin(nowMs * 0.002 + r.z * 0.01) > 0.6;
    }

    r.speedMs = THREE.MathUtils.damp(r.speedMs, targetSpeed, r.crashTimer > 0 ? 4.5 : 1.9, dt);

    // Active obstacle avoidance for traffic vehicles AND speed breakers
    r.aiLaneTimer -= dt;
    if (r.aiLaneTimer <= 0) {
      r.aiLaneTimer = 1.4 + Math.random() * 2.2;
      const lanes = [-3.8, 0, 3.8];
      r.aiTargetLane = lanes[Math.floor(Math.random() * lanes.length)];
    }

    // Scan ahead for traffic to dodge
    const lanes = [-3.8, 0, 3.8];
    for (let i = 0; i < this.trafficPool.length; i++) {
      const t = this.trafficPool[i];
      if (!t.rig.root.visible) continue;
      const dz = t.z - r.z;
      if (dz > 2 && dz < 42 && Math.abs(t.lateralX - r.lateralX) < t.rig.width * 0.55 + 0.85) {
        // Pick the clearest adjacent lane
        let bestLane = r.lateralX > 0 ? -3.8 : 3.8;
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
      // Realistic crash wobble oscillation
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

    // Speed breaker bounce for AI racers
    const groundY = getRoadSurfaceY(r.lateralX);
    if (Math.abs(r.lateralX) <= ROAD_HALF_WIDTH) {
      for (let i = 0; i < SPEED_BREAKER_Z.length; i++) {
        const bz = SPEED_BREAKER_Z[i];
        if (Math.abs(r.z - bz) < 0.85 && r.lastBumperIndex !== i && r.y <= groundY + 0.12) {
          r.lastBumperIndex = i;
          r.vy = Math.min(4.6, 2.0 + (r.speedMs / 65) * 2.4);
          break;
        }
      }
    }

    r.vy -= 18.5 * dt;
    r.y += r.vy * dt;
    if (r.y < groundY) {
      r.y = groundY;
      r.vy = 0;
    }

    if (r.z >= RACE_DISTANCE && r.finishTimeMs === null && this.phase === 'racing') {
      r.finishTimeMs = nowMs - this.raceStartTimeMs;
    }
  }

  private updateTrackPooling(nowMs: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const minSegIndex = Math.floor(refZ / SEGMENT_LENGTH) - 2;

    for (const slot of this.segments) {
      if (slot.segIndex < minSegIndex) {
        this.positionSegment(slot, slot.segIndex + SEGMENT_POOL_COUNT);
      }
      if (slot.oceanMesh) {
        slot.oceanMesh.position.y = -0.35 + Math.sin(nowMs * 0.0024 + slot.segIndex * 0.7) * 0.22;
      }
    }

    this.propPool?.update(refZ);

    let sbPoolIdx = 0;
    for (const bz of SPEED_BREAKER_Z) {
      if (bz >= refZ - 30 && bz <= refZ + 500 && sbPoolIdx < this.speedBreakers.length) {
        const mesh = this.speedBreakers[sbPoolIdx++];
        mesh.visible = true;
        mesh.position.set(getTrackCenterX(bz), 0.01, bz);
        mesh.rotation.y = getTrackYaw(bz);
      }
    }
    for (let i = sbPoolIdx; i < this.speedBreakers.length; i++) {
      this.speedBreakers[i].visible = false;
    }
  }

  private updateNitroPickups(dt: number, nowMs: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const lanes = [-3.8, 0, 3.8];

    for (let i = 0; i < this.nitroPool.length; i++) {
      const p = this.nitroPool[i];

      // Recycle passed canisters ahead of player
      if (p.z < refZ - 25 && refZ < RACE_DISTANCE - 90) {
        p.z = refZ + 330 + Math.random() * 140;
        p.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
      }

      p.group.visible = p.z < RACE_DISTANCE - 15;
      if (!p.group.visible) continue;

      const cx = getTrackCenterX(p.z);
      const yaw = getTrackYaw(p.z);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const bobY = 0.78 + Math.sin(nowMs * 0.004 + p.spinPhase) * 0.14;
      p.group.position.set(cx + p.lateralX * cosY, bobY, p.z - p.lateralX * sinY);
      p.group.rotation.y += dt * 2.5;

      // Check pickup by all racers (player + AI)
      if (this.phase === 'racing') {
        for (let rIdx = 0; rIdx < this.racers.length; rIdx++) {
          const r = this.racers[rIdx];
          if (Math.abs(r.z - p.z) < 2.4 && Math.abs(r.lateralX - p.lateralX) < 1.35) {
            r.nitro = Math.min(100, r.nitro + 30);
            if (r.isLocal) {
              this.nitroFlash = 1.0;
              this.sound.playNitroPickup();
            }
            // Recycle immediately ahead
            p.z = Math.max(p.z, refZ) + 340 + Math.random() * 140;
            p.lateralX = lanes[Math.floor(Math.random() * lanes.length)];
            break;
          }
        }
      }
    }
  }

  private updateTraffic(dt: number): void {
    const refZ = this.localRacer ? this.localRacer.z : 0;
    const lanes = [-3.8, 0, 3.8];

    for (const t of this.trafficPool) {
      t.z += t.speedMs * dt;

      t.laneTimer -= dt;
      if (t.laneTimer <= 0) {
        t.laneTimer = 3.5 + Math.random() * 4.5;
        t.targetLaneX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      t.lateralX = THREE.MathUtils.damp(t.lateralX, t.targetLaneX, 2.4, dt);

      if (t.z < refZ - 55 && refZ < RACE_DISTANCE - 120) {
        t.z = refZ + 320 + Math.random() * 200;
        const nextLane = lanes[Math.floor(Math.random() * lanes.length)];
        t.lateralX = nextLane;
        t.targetLaneX = nextLane;
      }

      t.rig.root.visible = t.z < RACE_DISTANCE - 25;

      const cx = getTrackCenterX(t.z);
      const yaw = getTrackYaw(t.z);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      t.rig.root.position.set(cx + t.lateralX * cosY, 0, t.z - t.lateralX * sinY);
      t.rig.root.rotation.y = yaw;

      if (!t.rig.root.visible || this.phase !== 'racing') continue;

      // Lightweight AABB collision detection for ALL 5 bike racers (player + 4 rivals)
      const hitLen = t.rig.length * 0.5 + 0.85;
      const hitWidth = t.rig.width * 0.5 + 0.32;

      for (let rIdx = 0; rIdx < this.racers.length; rIdx++) {
        const r = this.racers[rIdx];
        if (r.isHuman && !r.isLocal) continue; // remote peers resolve on their own client

        const dz = Math.abs(r.z - t.z);
        const dx = Math.abs(r.lateralX - t.lateralX);

        if (dz < hitLen && dx < hitWidth && r.y < t.rig.height) {
          const pushDir = r.lateralX >= t.lateralX ? 1 : -1;
          r.speedMs = Math.max(12, r.speedMs * 0.45);
          r.z = t.z - hitLen - 0.55;

          const worldX = cx + r.lateralX * cosY;
          const worldZ = r.z - r.lateralX * sinY;
          this.spawnSparks(worldX, r.y, worldZ);

          if (r.isLocal) {
            r.lateralVx = pushDir * 11;
            this.collisionFlash = 1.0;
            this.sound.playCrashImpact();

            if (TRACKS[this.currentTrackId].hasPoliceChase && !this.policeActive) {
              this.triggerPoliceChase();
            }
          } else if (r.isAI) {
            // Rival AI crash physics: wobble, bounce into adjacent clear space, recover
            r.crashTimer = 0.9;
            r.crashDir = pushDir;
            r.lateralX = THREE.MathUtils.clamp(
              r.lateralX + pushDir * 1.4,
              -FOOTPATH_OUTER_X + 0.4,
              FOOTPATH_OUTER_X - 0.4
            );
            r.aiTargetLane = pushDir > 0 ? 3.8 : -3.8;
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
    // Offset to adjacent lane immediately so pursuit enters smoothly beside/behind camera
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

    // Zero-cost emissive/basic color flashing on roof lightbar (no PointLight!)
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

    // Pursuit speed & anti-camera-blocking lane positioning
    const playerZ = this.localRacer.z;
    const playerLat = this.localRacer.lateralX;
    const gap = playerZ - this.policeZ;

    const desiredSpeed = gap > 22 ? 80 : gap > 9 ? 71 : 62;
    this.policeSpeedMs = THREE.MathUtils.damp(this.policeSpeedMs, desiredSpeed, 2.2, dt);
    this.policeZ += this.policeSpeedMs * dt;

    // Keep police car either cleanly behind camera near-clip OR offset in adjacent lane so it NEVER blocks camera!
    const nearCameraZone = playerZ - this.policeZ < 9.5;
    let targetPoliceLat = playerLat;
    if (nearCameraZone) {
      targetPoliceLat = playerLat >= 0 ? Math.max(-5.0, playerLat - 3.6) : Math.min(5.0, playerLat + 3.6);
    }
    this.policeLateralX = THREE.MathUtils.damp(this.policeLateralX, targetPoliceLat, 3.6, dt);

    // Hard safety guard: if police car is still aligned in the player's camera lane, clamp behind camera near plane
    if (Math.abs(this.policeLateralX - playerLat) < 2.5 && this.policeZ > playerZ - 8.8) {
      this.policeZ = playerZ - 8.8;
    }

    const cx = getTrackCenterX(this.policeZ);
    const yaw = getTrackYaw(this.policeZ);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    this.policeRig.root.position.set(
      cx + this.policeLateralX * cosY,
      0,
      this.policeZ - this.policeLateralX * sinY
    );
    this.policeRig.root.rotation.y = yaw;

    // Side-swipe / ram check if police closes alongside
    if (
      Math.abs(playerZ - this.policeZ) < 3.0 &&
      Math.abs(playerLat - this.policeLateralX) < 1.65
    ) {
      this.localRacer.speedMs = Math.max(18, this.localRacer.speedMs * 0.76);
      this.policeZ -= 7.5;
      this.policeTimerSec = Math.min(15.0, this.policeTimerSec + 2.5);
      this.collisionFlash = 0.85;
      this.sound.playCrashImpact();
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

    const px = r.rig.root.position.x;
    const pz = r.rig.root.position.z;
    this.sunLight.position.set(px + 28, 46, pz + 18);
    this.sunLight.target.position.set(px, 0, pz + 14);

    if (this.phase === 'finished') {
      this.finishOrbitAngle += dt * 0.65;
      const ox = px + Math.sin(this.finishOrbitAngle) * 4.8;
      const oz = pz + Math.cos(this.finishOrbitAngle) * 4.8;
      this.camPos.lerp(_vec3A.set(ox, 2.05, oz), 1 - Math.exp(-4 * dt));
      this.camLook.lerp(_vec3B.set(px, 0.95, pz), 1 - Math.exp(-6 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.skyDome.position.copy(this.camera.position);
      return;
    }

    const yaw = getTrackYaw(r.z);
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

      _vec3B.set(
        _vec3A.x + sinY * 22,
        _vec3A.y + r.wheeliePitch * 8.5 - 0.45,
        _vec3A.z + cosY * 22
      );
      this.camera.lookAt(_vec3B);
      this.camera.rotateZ(this.camRoll * 1.4);

      const targetFov = 78 + (r.isNitro ? 12 : (r.speedMs / 80) * 6);
      this.camFov = THREE.MathUtils.damp(this.camFov, targetFov, 7, dt);
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
      this.skyDome.position.copy(this.camera.position);
      return;
    }

    // Crisp MotoGP/Arcade Third-Person Chase Camera (higher & further back for full bike + traffic view)
    const isFar = this.cameraMode === 'far';
    const dist = isFar ? 4.6 : 3.25;
    const height = isFar ? 2.05 : 1.62;
    const baseFov = isFar ? 65 : 68;

    // Prevent camera from clipping outside footpath walls
    const safeLat = THREE.MathUtils.clamp(r.lateralX, -(FOOTPATH_OUTER_X - 0.8), FOOTPATH_OUTER_X - 0.8);
    const camTrackZ = r.z - dist;
    const camTrackCx = getTrackCenterX(camTrackZ);
    const camTrackYaw = getTrackYaw(camTrackZ);

    const targetCamX = camTrackCx + safeLat * Math.cos(camTrackYaw);
    const targetCamZ = camTrackZ - safeLat * Math.sin(camTrackYaw);
    let targetCamY = Math.max(getRoadSurfaceY(safeLat) + 1.05, r.y + height);

    // Smooth camera collision prevention against traffic vehicles behind the bike
    for (let i = 0; i < this.trafficPool.length; i++) {
      const t = this.trafficPool[i];
      if (!t.rig.root.visible) continue;
      if (
        Math.abs(t.z - camTrackZ) < t.rig.length * 0.5 + 1.8 &&
        Math.abs(t.lateralX - safeLat) < t.rig.width * 0.5 + 1.0
      ) {
        targetCamY = Math.max(targetCamY, t.rig.height + 0.75);
      }
    }

    const dampLambda = 12.5;
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetCamX, dampLambda, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetCamY, 10.0, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetCamZ, dampLambda, dt);

    // Minimum distance guard so camera never enters bike mesh
    const dzFromBike = pz - this.camPos.z;
    if (dzFromBike < 2.2) {
      this.camPos.z = pz - 2.2;
    }

    const lookDist = isFar ? 14 : 13;
    _vec3C.set(px + sinY * lookDist, r.y + 1.02, pz + cosY * lookDist);
    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, _vec3C.x, 15, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, _vec3C.y, 13, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, _vec3C.z, 15, dt);

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.camera.rotateZ(this.camRoll);

    const targetFov = baseFov + (r.speedMs / 80) * 6.0 + (r.isNitro ? 12.5 : 0);
    this.camFov = THREE.MathUtils.damp(this.camFov, targetFov, 7.5, dt);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();

    this.skyDome.position.copy(this.camera.position);
  }

  private computeStandings(): RaceStanding[] {
    const sorted = [...this.racers].sort((a, b) => {
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
      bikeId: r.bikeId,
      isLocal: r.isLocal,
      isAI: r.isAI,
      rank: idx + 1,
      distanceZ: r.z,
      finishTimeMs: r.finishTimeMs,
      wheelieScore: Math.round(r.wheelieScore),
      speedKmh: Math.round(Math.max(0, r.speedMs * 3.6)),
    }));
  }

  private emitHudSnapshot(): void {
    if (!this.localRacer || !this.onHudUpdate) return;
    const r = this.localRacer;
    const spec = BIKES[r.bikeId];
    const standings = this.computeStandings();
    const myStanding = standings.find((s) => s.isLocal);
    const rankMap = new Map<string, number>();
    for (const s of standings) rankMap.set(s.id, s.rank);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const floatingTags: FloatingTag[] = [];
    for (const racer of this.racers) {
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
        isLocal: racer.isLocal,
        isSpeaking: racer.isSpeaking,
        positionRank: rankMap.get(racer.id) ?? 1,
        x: sx,
        y: sy,
        visible,
        distance: dist,
      });
    }

    const speedRatio = Math.max(0, r.speedMs / spec.physics.maxSpeedMs);
    const gear = r.speedMs < 2 ? 1 : Math.min(6, Math.floor(speedRatio * 5.8) + 1);
    const rpmRatio =
      r.speedMs < 1 ? 0.14 : Math.min(1, 0.22 + ((speedRatio * 5.8) % 1) * 0.62 + speedRatio * 0.22);

    this.onHudUpdate({
      speedKmh: Math.round(Math.max(0, r.speedMs * 3.6)),
      rpmRatio,
      gear,
      nitro: Math.round(r.nitro),
      isNitroActive: r.isNitro,
      isWheelie: r.isWheelie,
      wheelieScore: Math.round(r.wheelieScore),
      positionRank: myStanding?.rank ?? 1,
      progress: THREE.MathUtils.clamp(r.z / RACE_DISTANCE, 0, 1),
      remainingMeters: Math.max(0, Math.round(RACE_DISTANCE - r.z)),
      elapsedMs: this.elapsedMs,
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
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    this.clearRaceWorld();
    this.skyDome?.geometry.dispose();
    this.skyMat?.dispose();
    this.contactShadowTex?.dispose();
    this.facadeTex?.dispose();
    this.lampPoolTex?.dispose();
    this.breakerTex?.dispose();
    this.finishTex?.dispose();
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
