import * as THREE from 'three';
import { BIKES, PAINT_COLORS } from '../data/catalog';
import { BikeId, PaintColorId, PowerUpKind } from '../types/game';

export interface SuperbikeBuildOptions {
  paintId?: PaintColorId;
  underglow?: boolean;
  turboExhaust?: boolean;
  heavyBumper?: boolean;
}

export interface SuperbikeRig {
  root: THREE.Group;
  leanGroup: THREE.Group;
  wheeliePivot: THREE.Group;
  riderGroup: THREE.Group;
  helmetGroup: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  nitroFlameLeft: THREE.Group;
  nitroFlameRight: THREE.Group;
  nitroParticles: THREE.Mesh[];
  brakeLightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  headBeamMat: THREE.MeshBasicMaterial;
  headBeamMesh: THREE.Mesh;
  underglowMesh: THREE.Mesh;
  shieldDome: THREE.Mesh;
  cockpitAnchor: THREE.Object3D;
}

// Shared lightweight PBR materials for traffic wheels & glass to minimize shader switches
const _sharedTireMat = new THREE.MeshStandardMaterial({
  color: 0x111317,
  roughness: 0.88,
  metalness: 0.06,
});
const _sharedAlloyMat = new THREE.MeshStandardMaterial({
  color: 0xcbd5e1,
  roughness: 0.24,
  metalness: 0.85,
});
const _sharedHubMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.35,
  metalness: 0.7,
});
const _sharedTrimMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.72,
  metalness: 0.2,
});
const _sharedGlassMat = new THREE.MeshStandardMaterial({
  color: 0x09101d,
  roughness: 0.08,
  metalness: 0.88,
  envMapIntensity: 1.4,
});
const _sharedHlMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xfef3c7,
  emissiveIntensity: 1.8,
});
const _sharedTlMat = new THREE.MeshStandardMaterial({
  color: 0xff1e1e,
  emissive: 0xdc2626,
  emissiveIntensity: 2.0,
});

function createSuperbikeWheel(rimColor: string, tireWidth: number, radius: number): THREE.Group {
  const group = new THREE.Group();

  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.18,
    metalness: 0.88,
  });
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.24,
    metalness: 0.92,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.28,
    metalness: 0.85,
  });

  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tireWidth, 12, 24),
    _sharedTireMat
  );
  tire.rotation.y = Math.PI / 2;
  group.add(tire);

  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius - tireWidth * 0.65, 0.022, 8, 22),
    rimMat
  );
  rimRing.rotation.y = Math.PI / 2;
  group.add(rimRing);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, tireWidth * 1.35, 12),
    rimMat
  );
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  const spokeLen = (radius - tireWidth * 0.65) * 1.9;
  const spokeGeo = new THREE.BoxGeometry(0.028, spokeLen, 0.02);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (i / 6) * Math.PI + 0.12;
    group.add(spoke);
  }

  const discGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, 0.014, 18);
  discGeo.rotateZ(Math.PI / 2);
  const discL = new THREE.Mesh(discGeo, discMat);
  discL.position.x = -tireWidth * 0.72;
  const discR = new THREE.Mesh(discGeo, discMat);
  discR.position.x = tireWidth * 0.72;
  group.add(discL, discR);

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.05), caliperMat);
  caliper.position.set(tireWidth * 0.75, 0.13, 0.11);
  group.add(caliper);

  return group;
}

function createExtrudedFairingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.35, 0.34);
  s.lineTo(0.45, 0.34);
  s.quadraticCurveTo(0.84, 0.42, 0.94, 0.78);
  s.quadraticCurveTo(0.88, 0.98, 0.56, 1.02);
  s.lineTo(0.28, 0.88);
  s.quadraticCurveTo(0.05, 0.96, -0.22, 0.82);
  s.lineTo(-0.55, 0.76);
  s.lineTo(-0.88, 0.96);
  s.lineTo(-0.96, 0.88);
  s.lineTo(-0.52, 0.58);
  s.closePath();
  return s;
}

function createNitroFlamePlume(): THREE.Group {
  const g = new THREE.Group();

  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outerGeo = new THREE.ConeGeometry(0.095, 0.92, 10);
  outerGeo.rotateX(-Math.PI / 2);
  outerGeo.translate(0, 0, -0.46);
  const outer = new THREE.Mesh(outerGeo, outerMat);

  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerGeo = new THREE.ConeGeometry(0.055, 0.56, 8);
  innerGeo.rotateX(-Math.PI / 2);
  innerGeo.translate(0, 0, -0.28);
  const inner = new THREE.Mesh(innerGeo, innerMat);

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const coreGeo = new THREE.ConeGeometry(0.03, 0.3, 8);
  coreGeo.rotateX(-Math.PI / 2);
  coreGeo.translate(0, 0, -0.15);
  const core = new THREE.Mesh(coreGeo, coreMat);

  g.add(outer, inner, core);
  return g;
}

export function createSuperbikeGroup(
  bikeId: BikeId,
  shadowTex?: THREE.Texture,
  options?: SuperbikeBuildOptions
): SuperbikeRig {
  const spec = BIKES[bikeId];
  const paintSpec = options?.paintId ? PAINT_COLORS[options.paintId] : PAINT_COLORS[spec.defaultPaint];
  const primaryHex = paintSpec?.hex ?? spec.primaryColor;
  const accentHex = paintSpec?.accentHex ?? spec.accentColor;

  const root = new THREE.Group();

  if (shadowTex) {
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 2.9), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    root.add(shadowPlane);
  }

  // Optional Neon Underglow ground strip (visible when Neon Underglow tool is equipped)
  const underglowMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.55), underglowMat);
  underglowMesh.rotation.x = -Math.PI / 2;
  underglowMesh.position.y = 0.035;
  underglowMesh.visible = Boolean(options?.underglow);
  root.add(underglowMesh);

  // Energy Shield protective translucent dome (hidden until Shield Power-Up collected)
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.38, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      wireframe: false,
      side: THREE.DoubleSide,
    })
  );
  shieldDome.scale.set(0.75, 0.85, 1.2);
  shieldDome.position.set(0, 0.92, 0.02);
  shieldDome.visible = false;
  root.add(shieldDome);

  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  const wheeliePivot = new THREE.Group();
  wheeliePivot.position.set(0, 0.37, -0.76);
  leanGroup.add(wheeliePivot);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    metalness: paintSpec?.metalness ?? 0.72,
    roughness: paintSpec?.roughness ?? 0.18,
    envMapIntensity: 1.35,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: spec.secondaryColor,
    metalness: 0.32,
    roughness: 0.48,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.68,
    roughness: 0.24,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.92,
    roughness: 0.22,
  });

  const goldForkMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.18,
  });

  const visorGlassMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    metalness: 0.9,
    roughness: 0.06,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 0.84,
  });

  // 1. Rear Wheel
  const rearWheel = createSuperbikeWheel(spec.wheelColor, 0.115, 0.275);
  wheeliePivot.add(rearWheel);

  const chassis = new THREE.Group();
  chassis.position.set(0, -0.37, 0.76);
  wheeliePivot.add(chassis);

  // 2. Front Wheel
  const frontWheel = createSuperbikeWheel(spec.wheelColor, 0.088, 0.275);
  frontWheel.position.set(0, 0.365, 0.84);
  chassis.add(frontWheel);

  // 3. Sculpted Extruded Aero Fairing Body
  const fairingShape = createExtrudedFairingShape();
  const fairingGeo = new THREE.ExtrudeGeometry(fairingShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  fairingGeo.rotateY(-Math.PI / 2);
  fairingGeo.translate(0.17, 0, 0);
  const mainBody = new THREE.Mesh(fairingGeo, primaryMat);
  chassis.add(mainBody);

  const engineCore = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.56), carbonMat);
  engineCore.position.set(0, 0.48, 0.06);
  chassis.add(engineCore);

  const swingarmL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.78), titaniumMat);
  swingarmL.position.set(-0.145, 0.39, -0.38);
  const swingarmR = swingarmL.clone();
  swingarmR.position.x = 0.145;
  chassis.add(swingarmL, swingarmR);

  const rearHugger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.24, 10, 1, true, 0.2, 1.3),
    carbonMat
  );
  rearHugger.rotation.z = Math.PI / 2;
  rearHugger.position.set(0, 0.37, -0.76);
  chassis.add(rearHugger);

  // 4. Sculpted Fuel Tank & Saddle
  const tankTop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), primaryMat);
  tankTop.scale.set(0.95, 0.65, 1.48);
  tankTop.position.set(0, 0.88, 0.14);
  chassis.add(tankTop);

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.085, 0.44), carbonMat);
  saddle.position.set(0, 0.79, -0.25);
  chassis.add(saddle);

  // 5. Aerodynamic Side Winglets + Distinct Silhouette Attachments per Superbike Model
  const wingSpan =
    bikeId === 'titan' ? 0.84 : bikeId === 'volt' ? 0.78 : bikeId === 'viper' ? 0.56 : 0.66;
  const winglet = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.036, 0.24), accentMat);
  winglet.position.set(0, 0.72, 0.66);
  winglet.rotation.x = 0.16;
  chassis.add(winglet);

  if (spec.bodyStyle === 'proto') {
    // Titan RR-1200: Aggressive dorsal shark-fin tail & dual front ram-air scoop
    const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.44), accentMat);
    sharkFin.position.set(0, 1.04, -0.68);
    sharkFin.rotation.x = -0.35;
    const ramAir = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), carbonMat);
    ramAir.position.set(0, 0.86, 0.88);
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.032, 0.16), primaryMat);
    tailWing.position.set(0, 1.07, -0.84);
    tailWing.rotation.x = 0.2;
    chassis.add(sharkFin, ramAir, tailWing);
  } else if (spec.bodyStyle === 'streetfighter') {
    // Viper RS-900: Exposed tubular trellis frame bars & compact belly pan
    for (const s of [-1, 1]) {
      const trellis = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 6), accentMat);
      trellis.rotation.x = Math.PI / 2 - 0.28;
      trellis.position.set(s * 0.21, 0.68, 0.12);
      chassis.add(trellis);
    }
  } else if (spec.bodyStyle === 'gt') {
    // Phantom GT: Extended touring aero side pods & sleek tail cowl
    const sidePodL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.72), carbonMat);
    sidePodL.position.set(-0.23, 0.58, 0.24);
    const sidePodR = sidePodL.clone();
    sidePodR.position.x = 0.23;
    chassis.add(sidePodL, sidePodR);
  } else if (spec.bodyStyle === 'hyper') {
    // Volt Hyper-X: Twin turbine side intakes
    for (const s of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 10), accentMat);
      intake.rotation.x = Math.PI / 2;
      intake.position.set(s * 0.24, 0.68, 0.46);
      chassis.add(intake);
    }
  }

  // Optional Heavy Bumper Guard (reinforced carbon-steel ram guard on front nose)
  if (options?.heavyBumper) {
    const guardBar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 16, Math.PI), titaniumMat);
    guardBar.rotation.x = Math.PI / 2;
    guardBar.position.set(0, 0.56, 0.98);
    const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.14), carbonMat);
    skidPlate.position.set(0, 0.46, 1.02);
    chassis.add(guardBar, skidPlate);
  }

  // 6. USD Front Forks, Fender, Windscreen & Side Mirrors
  const forkGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.74, 8);
  const forkL = new THREE.Mesh(forkGeo, goldForkMat);
  forkL.position.set(-0.125, 0.68, 0.69);
  forkL.rotation.x = -0.39;
  const forkR = forkL.clone();
  forkR.position.x = 0.125;
  chassis.add(forkL, forkR);

  const frontFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.19, 10, 1, true, -0.5, 1.2),
    carbonMat
  );
  frontFender.rotation.z = Math.PI / 2;
  frontFender.position.set(0, 0.37, 0.84);
  chassis.add(frontFender);

  const windscreen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.25, 0.36, 12, 1, true, -0.85, 1.7),
    visorGlassMat
  );
  windscreen.rotation.set(-0.92, 0, 0);
  windscreen.position.set(0, 1.01, 0.56);
  chassis.add(windscreen);

  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.032), carbonMat);
    stalk.position.set(side * 0.25, 1.03, 0.62);
    stalk.rotation.z = side * 0.38;
    stalk.rotation.y = -side * 0.25;

    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.055), primaryMat);
    mirrorHousing.position.set(side * 0.33, 1.07, 0.6);
    mirrorHousing.rotation.y = -side * 0.22;

    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.042), titaniumMat);
    mirrorGlass.position.set(side * 0.33, 1.07, 0.57);
    mirrorGlass.rotation.y = Math.PI - side * 0.22;
    chassis.add(stalk, mirrorHousing, mirrorGlass);
  }

  // Handlebar Clip-ons & Glowing Digital Dash
  const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), carbonMat);
  barL.rotation.z = Math.PI / 2 + 0.14;
  barL.rotation.y = 0.22;
  barL.position.set(-0.2, 0.96, 0.44);
  const barR = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), carbonMat);
  barR.rotation.z = Math.PI / 2 - 0.14;
  barR.rotation.y = -0.22;
  barR.position.set(0.2, 0.96, 0.44);
  chassis.add(barL, barR);

  const dashScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.085, 0.025),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    })
  );
  dashScreen.position.set(0, 1.0, 0.54);
  dashScreen.rotation.x = -0.55;
  chassis.add(dashScreen);

  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 1.29, 0.3);
  chassis.add(cockpitAnchor);

  // 7. Twin LED Headlights + Dynamic Forward Headlight Beam Cone (brightens in Night Mode!)
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.8,
  });
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.06), hlMat);
  hlL.position.set(-0.1, 0.84, 0.93);
  hlL.rotation.z = 0.22;
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.06), hlMat);
  hlR.position.set(0.1, 0.84, 0.93);
  hlR.rotation.z = -0.22;
  chassis.add(hlL, hlR);

  // Soft LED Headlight Beam Cone projecting ahead
  const beamGeo = new THREE.ConeGeometry(2.35, 16.5, 14, 1, true);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.translate(0, 0, 8.25);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const headBeam = new THREE.Mesh(beamGeo, beamMat);
  headBeam.position.set(0, 0.78, 0.96);
  headBeam.rotation.x = 0.06;
  chassis.add(headBeam);

  // Dual Glowing Red LED Tail Lights
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e1e,
    emissive: 0xef4444,
    emissiveIntensity: 2.4,
  });
  const tailLedL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.08), brakeLightMat);
  tailLedL.position.set(-0.085, 0.91, -0.92);
  tailLedL.rotation.z = 0.24;
  const tailLedR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.08), brakeLightMat);
  tailLedR.position.set(0.085, 0.91, -0.92);
  tailLedR.rotation.z = -0.24;
  chassis.add(tailLedL, tailLedR);

  // 8. Dual / Quad Titanium Exhaust Pipes (Turbo Exhaust adds twin burnt-blue race cans)
  const exRadius = options?.turboExhaust || spec.bodyStyle === 'proto' ? 0.056 : 0.044;
  const exhaustGeo = new THREE.CylinderGeometry(exRadius, exRadius + 0.02, 0.56, 10);
  exhaustGeo.rotateX(Math.PI / 2 - 0.22);
  const exMat = options?.turboExhaust ? goldForkMat : titaniumMat;
  const exL = new THREE.Mesh(exhaustGeo, exMat);
  exL.position.set(-0.2, 0.53, -0.68);
  const exR = exL.clone();
  exR.position.x = 0.2;
  chassis.add(exL, exR);

  if (spec.bodyStyle === 'proto' || options?.turboExhaust) {
    const upperCanL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.38, 8), titaniumMat);
    upperCanL.rotation.x = Math.PI / 2 - 0.18;
    upperCanL.position.set(-0.12, 0.82, -0.78);
    const upperCanR = upperCanL.clone();
    upperCanR.position.x = 0.12;
    chassis.add(upperCanL, upperCanR);
  }

  const tipGeo = new THREE.CylinderGeometry(0.038, 0.044, 0.09, 10);
  tipGeo.rotateX(Math.PI / 2 - 0.22);
  const tipL = new THREE.Mesh(tipGeo, carbonMat);
  tipL.position.set(-0.2, 0.58, -0.92);
  const tipR = tipL.clone();
  tipR.position.x = 0.2;
  chassis.add(tipL, tipR);

  const nitroFlameLeft = createNitroFlamePlume();
  nitroFlameLeft.position.set(-0.2, 0.58, -0.95);
  nitroFlameLeft.rotation.x = 0.22;
  nitroFlameLeft.visible = false;

  const nitroFlameRight = createNitroFlamePlume();
  nitroFlameRight.position.set(0.2, 0.58, -0.95);
  nitroFlameRight.rotation.x = 0.22;
  nitroFlameRight.visible = false;
  chassis.add(nitroFlameLeft, nitroFlameRight);

  // Pooled Nitro Flame Particles (6 lightweight glowing embers streaming behind pipes)
  const nitroParticles: THREE.Mesh[] = [];
  const pGeo = new THREE.SphereGeometry(0.036, 6, 6);
  const pMatBlue = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const pMatOrange = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(pGeo, i % 2 === 0 ? pMatBlue : pMatOrange);
    p.visible = false;
    chassis.add(p);
    nitroParticles.push(p);
  }

  // 9. Realistic Articulated 3D MotoGP Rider with Dynamic Leaning Pivot
  const suitMainMat = new THREE.MeshStandardMaterial({
    color: 0x161b26,
    roughness: 0.62,
    metalness: 0.14,
  });
  const suitColorMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: 0.42,
    metalness: 0.28,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.45,
  });
  const helmetShellMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.65,
    roughness: 0.14,
    envMapIntensity: 1.4,
  });

  // Lower body seated on saddle + knee pads + boots
  const lowerRider = new THREE.Group();
  chassis.add(lowerRider);

  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.12, 6, 10), suitMainMat);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.position.set(0, 0.86, -0.25);
  lowerRider.add(pelvis);

  for (const side of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.26, 6, 8), suitMainMat);
    thigh.position.set(side * 0.17, 0.76, -0.12);
    thigh.rotation.set(0.95, side * 0.22, 0);

    const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), armorMat);
    kneePad.position.set(side * 0.23, 0.65, 0.03);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 6, 8), suitColorMat);
    shin.position.set(side * 0.2, 0.52, -0.1);
    shin.rotation.set(-0.55, 0, 0);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.09, 0.22), armorMat);
    boot.position.set(side * 0.19, 0.39, -0.18);

    lowerRider.add(thigh, kneePad, shin, boot);
  }

  // Dynamic Upper Rider Group pivoted at waist/saddle (0, 0.86, -0.22)
  // Tilts smoothly left/right into turns, leans back during wheelies, tucks low on Nitro!
  const riderGroup = new THREE.Group();
  riderGroup.position.set(0, 0.86, -0.22);
  chassis.add(riderGroup);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 6, 10), suitMainMat);
  torso.position.set(0, 0.22, 0.18);
  torso.rotation.x = 0.78;
  riderGroup.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.14), suitColorMat);
  chestStripe.position.set(0, 0.24, 0.2);
  chestStripe.rotation.x = 0.78;
  riderGroup.add(chestStripe);

  const aeroHump = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 6, 8), suitColorMat);
  aeroHump.position.set(0, 0.33, 0.08);
  aeroHump.rotation.x = 0.92;
  riderGroup.add(aeroHump);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), armorMat);
    shoulder.position.set(side * 0.21, 0.32, 0.34);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.2, 6, 8), suitMainMat);
    upperArm.position.set(side * 0.24, 0.23, 0.47);
    upperArm.rotation.set(1.05, 0, -side * 0.2);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.2, 6, 8), suitColorMat);
    forearm.position.set(side * 0.25, 0.15, 0.6);
    forearm.rotation.set(1.38, -side * 0.24, 0);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), armorMat);
    glove.scale.set(1, 0.85, 1.35);
    glove.position.set(side * 0.26, 0.1, 0.66);

    riderGroup.add(shoulder, upperArm, forearm, glove);
  }

  // Full-Face Aerodynamic Racing Helmet with Reflective Dark Visor
  const helmetGroup = new THREE.Group();
  helmetGroup.position.set(0, 0.48, 0.43);
  helmetGroup.rotation.x = 0.12;
  riderGroup.add(helmetGroup);

  const helmetCrown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), helmetShellMat);
  helmetCrown.scale.set(0.94, 0.98, 1.14);
  helmetGroup.add(helmetCrown);

  const helmetSpoiler = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.1), suitColorMat);
  helmetSpoiler.position.set(0, 0.09, -0.14);
  helmetSpoiler.rotation.x = -0.25;
  helmetGroup.add(helmetSpoiler);

  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.146, 0.146, 0.095, 14, 1, true, -0.95, 1.9),
    visorGlassMat
  );
  visor.position.set(0, -0.01, 0.025);
  helmetGroup.add(visor);

  return {
    root,
    leanGroup,
    wheeliePivot,
    riderGroup,
    helmetGroup,
    frontWheel,
    rearWheel,
    nitroFlameLeft,
    nitroFlameRight,
    nitroParticles,
    brakeLightMat,
    headlightMat: hlMat,
    headBeamMat: beamMat,
    headBeamMesh: headBeam,
    underglowMesh,
    shieldDome,
    cockpitAnchor,
  };
}

export type TrafficKind = 'sedan' | 'bus' | 'truck' | 'police';

export interface TrafficRig {
  root: THREE.Group;
  kind: TrafficKind;
  width: number;
  length: number;
  height: number;
  redBeaconMat?: THREE.MeshBasicMaterial;
  blueBeaconMat?: THREE.MeshBasicMaterial;
  redGlowMat?: THREE.MeshBasicMaterial;
  blueGlowMat?: THREE.MeshBasicMaterial;
}

function createCarWheel(radius: number): THREE.Group {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.26, 14), _sharedTireMat);
  tire.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.275, 10),
    _sharedAlloyMat
  );
  rim.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.29, 8),
    _sharedHubMat
  );
  hub.rotation.z = Math.PI / 2;
  g.add(tire, rim, hub);
  return g;
}

function createSedanProfileShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-2.22, 0.34);
  s.lineTo(2.22, 0.34);
  s.lineTo(2.26, 0.72);
  s.quadraticCurveTo(2.15, 0.92, 1.35, 0.98);
  s.lineTo(0.68, 1.44);
  s.lineTo(-0.72, 1.44);
  s.lineTo(-1.55, 1.02);
  s.lineTo(-2.18, 0.94);
  s.lineTo(-2.26, 0.56);
  s.closePath();
  return s;
}

export function createTrafficVehicle(kind: TrafficKind, colorHex: number, shadowTex?: THREE.Texture): TrafficRig {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: kind === 'police' ? 0x0f172a : colorHex,
    roughness: 0.22,
    metalness: 0.6,
    envMapIntensity: 1.2,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.25,
  });

  let width = 2.08;
  let length = 4.55;
  let height = 1.5;

  if (kind === 'bus') {
    width = 2.58;
    length = 9.4;
    height = 3.15;

    const hull = new THREE.Mesh(new THREE.BoxGeometry(width, 2.45, length), bodyMat);
    hull.position.y = 1.66;
    root.add(hull);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.92, length - 0.6), _sharedGlassMat);
    sideGlass.position.set(0, 2.12, 0.1);
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.25, 1.15, 0.12), _sharedGlassMat);
    frontGlass.position.set(0, 2.02, length / 2 + 0.02);
    root.add(sideGlass, frontGlass);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(width - 0.18, 0.16, length - 0.4), whiteMat);
    roof.position.y = 2.94;
    const ac1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.8), _sharedTrimMat);
    ac1.position.set(0, 3.1, 1.2);
    const ac2 = ac1.clone();
    ac2.position.z = -1.8;
    root.add(roof, ac1, ac2);

    const bF = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.34, 0.28), _sharedTrimMat);
    bF.position.set(0, 0.46, length / 2);
    const bR = bF.clone();
    bR.position.z = -length / 2;
    root.add(bF, bR);
  } else if (kind === 'truck') {
    width = 2.48;
    length = 7.8;
    height = 3.05;

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.32, 1.85, 2.25), bodyMat);
    cab.position.set(0, 1.36, 2.45);
    root.add(cab);

    const aeroCap = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.55, 1.5), bodyMat);
    aeroCap.position.set(0, 2.45, 2.15);
    aeroCap.rotation.x = 0.28;
    root.add(aeroCap);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.72, 0.1), _sharedGlassMat);
    windshield.position.set(0, 1.72, 3.58);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.08), _sharedTrimMat);
    grille.position.set(0, 0.92, 3.58);
    root.add(windshield, grille);

    const cargo = new THREE.Mesh(new THREE.BoxGeometry(width, 2.45, 5.15), whiteMat);
    cargo.position.set(0, 1.74, -1.25);
    root.add(cargo);

    const bF = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.24), _sharedTrimMat);
    bF.position.set(0, 0.45, 3.62);
    const bR = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, 0.22), _sharedTrimMat);
    bR.position.set(0, 0.48, -3.85);
    root.add(bF, bR);
  } else {
    width = 2.08;
    length = 4.55;
    height = 1.5;

    const profile = createSedanProfileShape();
    const carGeo = new THREE.ExtrudeGeometry(profile, {
      depth: 1.78,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    carGeo.rotateY(-Math.PI / 2);
    carGeo.translate(0.89, 0, 0);

    const body = new THREE.Mesh(carGeo, bodyMat);
    root.add(body);

    if (kind === 'police') {
      const doors = new THREE.Mesh(new THREE.BoxGeometry(width - 0.02, 0.58, 1.82), whiteMat);
      doors.position.set(0, 0.68, 0.05);
      const roofWhite = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.08, 1.38), whiteMat);
      roofWhite.position.set(0, 1.5, -0.02);
      const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.18), _sharedTrimMat);
      pushBar.position.set(0, 0.6, length / 2 + 0.06);
      root.add(doors, roofWhite, pushBar);
    }

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.56, 0.08), _sharedGlassMat);
    frontGlass.position.set(0, 1.24, 0.96);
    frontGlass.rotation.x = -0.96;

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.62, 0.08), _sharedGlassMat);
    rearGlass.position.set(0, 1.24, -1.14);
    rearGlass.rotation.x = 1.06;

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.36, 1.55), _sharedGlassMat);
    sideGlass.position.set(0, 1.22, -0.05);
    root.add(frontGlass, rearGlass, sideGlass);

    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.12), bodyMat);
      m.position.set(s * 1.06, 1.04, 0.72);
      root.add(m);
    }

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.08), _sharedTrimMat);
    grille.position.set(0, 0.64, length / 2 + 0.01);
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(width - 0.06, 0.22, 0.2), _sharedTrimMat);
    bumperF.position.set(0, 0.38, length / 2 - 0.04);
    const bumperR = bumperF.clone();
    bumperR.position.z = -length / 2 + 0.04;
    root.add(grille, bumperF, bumperR);
  }

  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.08), _sharedHlMat);
  hl1.position.set(-width * 0.33, 0.68, length / 2 + 0.02);
  const hl2 = hl1.clone();
  hl2.position.x = width * 0.33;

  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), _sharedTlMat);
  tl1.position.set(-width * 0.33, 0.74, -length / 2 - 0.02);
  const tl2 = tl1.clone();
  tl2.position.x = width * 0.33;
  root.add(hl1, hl2, tl1, tl2);

  const wheelRadius = kind === 'bus' || kind === 'truck' ? 0.44 : 0.36;
  const wheelZ = length * 0.31;
  const wheelX = width * 0.46;
  const positions = [
    [-wheelX, wheelRadius, wheelZ],
    [wheelX, wheelRadius, wheelZ],
    [-wheelX, wheelRadius, -wheelZ],
    [wheelX, wheelRadius, -wheelZ],
  ];
  for (const [wx, wy, wz] of positions) {
    const w = createCarWheel(wheelRadius);
    w.position.set(wx, wy, wz);
    root.add(w);
  }

  if (shadowTex) {
    const sMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
    });
    const sPlane = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.28, length * 1.15), sMat);
    sPlane.rotation.x = -Math.PI / 2;
    sPlane.position.y = 0.025;
    root.add(sPlane);
  }

  let redBeaconMat: THREE.MeshBasicMaterial | undefined;
  let blueBeaconMat: THREE.MeshBasicMaterial | undefined;
  let redGlowMat: THREE.MeshBasicMaterial | undefined;
  let blueGlowMat: THREE.MeshBasicMaterial | undefined;

  if (kind === 'police') {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.08, 0.28), _sharedTrimMat);
    barBase.position.set(0, 1.58, -0.02);
    root.add(barBase);

    redBeaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    blueBeaconMat = new THREE.MeshBasicMaterial({ color: 0x1e3a8a });

    const redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.24), redBeaconMat);
    redLamp.position.set(-0.32, 1.66, -0.02);
    const blueLamp = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.24), blueBeaconMat);
    blueLamp.position.set(0.32, 1.66, -0.02);
    root.add(redLamp, blueLamp);

    // Lightweight additive glow halos (no dynamic PointLight shader recompilation!)
    redGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff2a2a,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    blueGlowMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const haloGeo = new THREE.SphereGeometry(0.46, 10, 8);
    const redHalo = new THREE.Mesh(haloGeo, redGlowMat);
    redHalo.position.set(-0.32, 1.68, -0.02);
    const blueHalo = new THREE.Mesh(haloGeo, blueGlowMat);
    blueHalo.position.set(0.32, 1.68, -0.02);
    root.add(redHalo, blueHalo);
  }

  return {
    root,
    kind,
    width,
    length,
    height,
    redBeaconMat,
    blueBeaconMat,
    redGlowMat,
    blueGlowMat,
  };
}

// Shared geometries/materials for pooled glowing Nitro Canisters
const _nitroCanisterGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.72, 12);
const _nitroCapGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.14, 12);
const _nitroRingGeo = new THREE.TorusGeometry(0.46, 0.045, 8, 20);
const _nitroBodyMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
const _nitroCoreMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
const _nitroGlowMat = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  transparent: true,
  opacity: 0.42,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

export function createNitroPickupGroup(): THREE.Group {
  const g = new THREE.Group();

  const canister = new THREE.Mesh(_nitroCanisterGeo, _nitroBodyMat);
  canister.rotation.z = 0.28;
  g.add(canister);

  const capTop = new THREE.Mesh(_nitroCapGeo, _nitroCoreMat);
  capTop.position.set(-0.11, 0.39, 0);
  capTop.rotation.z = 0.28;
  g.add(capTop);

  const ring = new THREE.Mesh(_nitroRingGeo, _nitroCoreMat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), _nitroGlowMat);
  g.add(aura);

  return g;
}

// ======================================================
// Pooled Track Obstacles, Jump Ramps, Boost Pads & Power-Ups
// ======================================================

export function createJumpRampGroup(rampTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(6.8, 0);
  shape.lineTo(6.8, 1.35);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.1, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  geo.translate(1.55, 0, -3.4);

  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.5,
  });
  const rampBody = new THREE.Mesh(geo, sideMat);
  g.add(rampBody);

  // Sloped top launch deck with chevron arrows
  const deckLen = Math.hypot(6.8, 1.35);
  const slopeAngle = Math.atan2(1.35, 6.8);
  const deckGeo = new THREE.PlaneGeometry(3.15, deckLen);
  deckGeo.rotateX(-Math.PI / 2 - slopeAngle);
  const deckMat = new THREE.MeshBasicMaterial({ map: rampTex });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, 0.72, 0);
  g.add(deck);

  // Glowing side LED rails
  const railMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const railGeo = new THREE.BoxGeometry(0.12, 0.14, deckLen);
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(s * 1.56, 0.74, 0);
    rail.rotation.x = -slopeAngle;
    g.add(rail);
  }
  return g;
}

export function createBoostPadMesh(boostTex: THREE.Texture): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(3.2, 9.5);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: boostTex,
    transparent: true,
    opacity: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  return new THREE.Mesh(geo, mat);
}

const _coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.11, 14);
_coinGeo.rotateZ(Math.PI / 2);
const _coinMat = new THREE.MeshStandardMaterial({
  color: 0xfacc15,
  emissive: 0xb45309,
  emissiveIntensity: 0.75,
  metalness: 0.88,
  roughness: 0.18,
});
const _coinRimGeo = new THREE.TorusGeometry(0.42, 0.055, 6, 14);
_coinRimGeo.rotateY(Math.PI / 2);

export function createRoadCoinGroup(): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(_coinGeo, _coinMat);
  const rim = new THREE.Mesh(_coinRimGeo, _coinMat);
  g.add(disc, rim);
  return g;
}

export function createPowerUpGroup(kind: PowerUpKind): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'shield') {
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.44, 0),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.055, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.74, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    g.add(core, ring, aura);
  } else if (kind === 'magnet') {
    // Horseshoe magnet shape
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.11, 8, 16, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xec4899 })
    );
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), tipMat);
    tipL.position.set(-0.34, -0.1, 0);
    const tipR = tipL.clone();
    tipR.position.x = 0.34;
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xd946ef,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    g.add(arc, tipL, tipR, aura);
  } else {
    // Repair Wrench & Nitro Refill Kit (Emerald cross + wrench bar)
    const mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.22), mat);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.22), mat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.05, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
    );
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    g.add(bar1, bar2, ring, aura);
  }

  return g;
}

const _chevronPoleGeo = new THREE.CylinderGeometry(0.08, 0.09, 2.8, 6);
_chevronPoleGeo.translate(0, 1.4, 0);
const _chevronPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
const _chevronBoardGeo = new THREE.BoxGeometry(2.2, 1.1, 0.12);

export function createChevronSignGroup(tex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(_chevronPoleGeo, _chevronPoleMat);
  const board = new THREE.Mesh(
    _chevronBoardGeo,
    new THREE.MeshBasicMaterial({ map: tex })
  );
  board.position.set(0, 2.45, 0);
  g.add(pole, board);
  return g;
}
