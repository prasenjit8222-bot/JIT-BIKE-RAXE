import * as THREE from 'three';
import { TrackId } from '../types/game';
import { getTrackCenterX, getTrackElevationY, getTrackYaw } from './TrackMath';

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

interface PropRecord {
  z: number;
  lateralOffset: number;
  yawOffset: number;
  sx: number;
  sy: number;
  sz: number;
  side: number;
}

interface InstancedLayer {
  mesh: THREE.InstancedMesh;
  localOffset: THREE.Vector3;
  localRotY: number;
  scaleWithProp: boolean;
  scaleYWithProp: boolean;
}

export class InstancedPropPool {
  public readonly group = new THREE.Group();
  private trackId: TrackId;
  private layers: InstancedLayer[][] = [];
  private records: PropRecord[][] = [];
  private lampLightMat: THREE.MeshBasicMaterial | null = null;
  private lampPoolMat: THREE.MeshBasicMaterial | null = null;
  private spanZ = 560;

  constructor(
    trackId: TrackId,
    facadeTex: THREE.Texture,
    lampPoolTex: THREE.Texture
  ) {
    this.trackId = trackId;

    if (trackId === 'city') {
      this.buildCityProps(facadeTex);
    } else if (trackId === 'village') {
      this.buildVillageProps();
    } else if (trackId === 'forest') {
      this.buildForestProps();
    } else {
      this.buildCoastalProps();
    }

    // Illuminated roadside streetlamps across ALL 4 tracks (glow intensely in Night Mode!)
    this.buildStreetLamps(lampPoolTex);
  }

  private createLayer(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    localOffset = new THREE.Vector3(0, 0, 0),
    localRotY = 0,
    scaleWithProp = true,
    scaleYWithProp = true
  ): InstancedLayer {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false; // instances dynamically recycle along curved/elevated tracks
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    return { mesh, localOffset, localRotY, scaleWithProp, scaleYWithProp };
  }

  private buildStreetLamps(lampPoolTex: THREE.Texture): void {
    const lCount = 18;
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.78,
      roughness: 0.34,
    });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
    const poolMat = new THREE.MeshBasicMaterial({
      map: lampPoolTex,
      transparent: true,
      opacity: this.trackId === 'city' ? 0.42 : 0.08,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lampLightMat = lampMat;
    this.lampPoolMat = poolMat;

    const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 6.4, 6);
    poleGeo.translate(0, 3.2, 0);
    const armGeo = new THREE.BoxGeometry(2.6, 0.1, 0.1);
    armGeo.translate(1.15, 6.25, 0);
    const lampGeo = new THREE.BoxGeometry(0.68, 0.15, 0.3);
    lampGeo.translate(2.2, 6.18, 0);
    const poolGeo = new THREE.PlaneGeometry(10.5, 10.5);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.translate(2.2, 0.06, 0);

    const lLayers: InstancedLayer[] = [
      this.createLayer(poleGeo, poleMat, lCount, new THREE.Vector3(), 0, false),
      this.createLayer(armGeo, poleMat, lCount, new THREE.Vector3(), 0, false),
      this.createLayer(lampGeo, lampMat, lCount, new THREE.Vector3(), 0, false),
      this.createLayer(poolGeo, poolMat, lCount, new THREE.Vector3(), 0, false),
    ];

    const lRecords: PropRecord[] = [];
    for (let i = 0; i < lCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      lRecords.push({
        z: -10 + i * (this.spanZ / lCount),
        lateralOffset: side * 9.2,
        yawOffset: side === -1 ? 0 : Math.PI,
        sx: 1,
        sy: 1,
        sz: 1,
        side,
      });
    }
    this.layers.push(lLayers);
    this.records.push(lRecords);
  }

  public setNightIntensity(nightFactor: number): void {
    const f = THREE.MathUtils.clamp(nightFactor, 0, 1);
    if (this.lampLightMat) {
      this.lampLightMat.color.setHex(f > 0.35 ? 0xfff7cc : 0x94a3b8);
    }
    if (this.lampPoolMat) {
      const base = this.trackId === 'city' ? 0.25 : 0.0;
      this.lampPoolMat.opacity = base + f * 0.85;
      this.lampPoolMat.visible = this.lampPoolMat.opacity > 0.04;
    }
  }

  private buildCityProps(facadeTex: THREE.Texture): void {
    const bCount = 24;
    const bodyMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      color: 0xdbeafe,
      roughness: 0.42,
      metalness: 0.35,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.4,
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const bodyGeo = new THREE.BoxGeometry(10, 1, 10);
    bodyGeo.translate(0, 0.5, 0);
    const capGeo = new THREE.BoxGeometry(7.2, 1.8, 7.2);
    const spireGeo = new THREE.BoxGeometry(1.1, 3.2, 1.1);

    const bLayers: InstancedLayer[] = [
      this.createLayer(bodyGeo, bodyMat, bCount, new THREE.Vector3(0, 0, 0), 0, true, true),
      this.createLayer(capGeo, trimMat, bCount, new THREE.Vector3(0, 1.0, 0), 0, true, false),
      this.createLayer(spireGeo, beaconMat, bCount, new THREE.Vector3(0, 1.04, 0), 0, true, false),
    ];

    const bRecords: PropRecord[] = [];
    for (let i = 0; i < bCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 22 + ((i * 7) % 28);
      bRecords.push({
        z: -20 + i * (this.spanZ / bCount),
        lateralOffset: side * (16.5 + (i % 4) * 3.8),
        yawOffset: 0,
        sx: 0.9 + (i % 3) * 0.25,
        sy: h,
        sz: 0.9 + ((i + 1) % 3) * 0.28,
        side,
      });
    }
    this.layers.push(bLayers);
    this.records.push(bRecords);
  }

  private buildVillageProps(): void {
    const hCount = 16;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });

    const wallGeo = new THREE.BoxGeometry(5.6, 3.4, 5.0);
    wallGeo.translate(0, 1.7, 0);
    const roofGeo = new THREE.ConeGeometry(4.4, 2.2, 4);
    roofGeo.rotateY(Math.PI / 4);
    roofGeo.translate(0, 4.5, 0);
    const doorGeo = new THREE.BoxGeometry(0.95, 1.8, 0.15);
    doorGeo.translate(0, 0.9, 2.52);

    const hLayers: InstancedLayer[] = [
      this.createLayer(wallGeo, wallMat, hCount),
      this.createLayer(roofGeo, roofMat, hCount),
      this.createLayer(doorGeo, doorMat, hCount),
    ];
    const hRecords: PropRecord[] = [];
    for (let i = 0; i < hCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      hRecords.push({
        z: -15 + i * (this.spanZ / hCount),
        lateralOffset: side * (15.0 + (i % 3) * 4.5),
        yawOffset: side === -1 ? Math.PI / 2 : -Math.PI / 2,
        sx: 0.95 + (i % 3) * 0.12,
        sy: 0.95 + (i % 2) * 0.15,
        sz: 0.95 + (i % 3) * 0.12,
        side,
      });
    }
    this.layers.push(hLayers);
    this.records.push(hRecords);

    this.addOakLayer(26, 12.0);
  }

  private buildForestProps(): void {
    this.addPineLayer(30, 11.2);
    this.addRockLayer(14, 10.8);
  }

  private buildCoastalProps(): void {
    const pCount = 26;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.9 });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 6.2, 6);
    trunkGeo.rotateZ(0.08);
    trunkGeo.translate(0, 3.0, 0);

    const frondGeo = new THREE.ConeGeometry(2.6, 1.35, 6);
    frondGeo.scale(1, -1, 1);
    frondGeo.translate(-0.22, 5.8, 0);

    const pLayers: InstancedLayer[] = [
      this.createLayer(trunkGeo, trunkMat, pCount),
      this.createLayer(frondGeo, frondMat, pCount),
    ];
    const pRecords: PropRecord[] = [];
    for (let i = 0; i < pCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lat = side === 1 ? 10.6 + (i % 2) * 2.0 : -(11.8 + (i % 4) * 3.5);
      const s = 0.88 + (i % 4) * 0.1;
      pRecords.push({
        z: -20 + i * (this.spanZ / pCount),
        lateralOffset: lat,
        yawOffset: (i * 1.1) % (Math.PI * 2),
        sx: s,
        sy: s,
        sz: s,
        side,
      });
    }
    this.layers.push(pLayers);
    this.records.push(pRecords);

    this.addRockLayer(14, 13.0, -1);
  }

  private addOakLayer(count: number, minLat: number): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x3b7a3e, roughness: 0.85 });

    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 3.0, 6);
    trunkGeo.translate(0, 1.5, 0);
    const crownGeo = new THREE.IcosahedronGeometry(2.15, 1);
    crownGeo.translate(0, 4.3, 0);

    const layers: InstancedLayer[] = [
      this.createLayer(trunkGeo, trunkMat, count),
      this.createLayer(crownGeo, crownMat, count),
    ];
    const records: PropRecord[] = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const s = 0.88 + (i % 4) * 0.12;
      records.push({
        z: -20 + i * (this.spanZ / count),
        lateralOffset: side * (minLat + (i % 5) * 3.6),
        yawOffset: (i * 0.9) % (Math.PI * 2),
        sx: s,
        sy: s,
        sz: s,
        side,
      });
    }
    this.layers.push(layers);
    this.records.push(records);
  }

  private addPineLayer(count: number, minLat: number): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.92 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.85 });

    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 3.2, 6);
    trunkGeo.translate(0, 1.6, 0);
    const c1Geo = new THREE.ConeGeometry(2.3, 4.5, 6);
    c1Geo.translate(0, 4.6, 0);
    const c2Geo = new THREE.ConeGeometry(1.6, 3.8, 6);
    c2Geo.translate(0, 7.2, 0);

    const layers: InstancedLayer[] = [
      this.createLayer(trunkGeo, trunkMat, count),
      this.createLayer(c1Geo, leafMat, count),
      this.createLayer(c2Geo, leafMat, count),
    ];
    const records: PropRecord[] = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const s = 0.85 + (i % 5) * 0.12;
      records.push({
        z: -20 + i * (this.spanZ / count),
        lateralOffset: side * (minLat + (i % 5) * 3.4),
        yawOffset: (i * 0.7) % (Math.PI * 2),
        sx: s,
        sy: s,
        sz: s,
        side,
      });
    }
    this.layers.push(layers);
    this.records.push(records);
  }

  private addRockLayer(count: number, minLat: number, fixedSide?: number): void {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.92,
      flatShading: true,
    });
    const rockGeo = new THREE.DodecahedronGeometry(1.3, 0);
    rockGeo.scale(1.3, 0.8, 1.1);
    rockGeo.translate(0, 0.65, 0);

    const layers: InstancedLayer[] = [this.createLayer(rockGeo, rockMat, count)];
    const records: PropRecord[] = [];
    for (let i = 0; i < count; i++) {
      const side = fixedSide ?? (i % 2 === 0 ? -1 : 1);
      const s = 0.85 + (i % 4) * 0.18;
      records.push({
        z: -10 + i * (this.spanZ / count),
        lateralOffset: side * (minLat + (i % 4) * 2.8),
        yawOffset: (i * 1.3) % (Math.PI * 2),
        sx: s,
        sy: s,
        sz: s,
        side,
      });
    }
    this.layers.push(layers);
    this.records.push(records);
  }

  public syncAll(): void {
    for (let g = 0; g < this.records.length; g++) {
      const recs = this.records[g];
      const lays = this.layers[g];
      for (let i = 0; i < recs.length; i++) {
        this.applyRecord(lays, recs[i], i);
      }
      for (const l of lays) l.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public update(refZ: number): void {
    for (let g = 0; g < this.records.length; g++) {
      const recs = this.records[g];
      const lays = this.layers[g];
      let dirty = false;

      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        if (rec.z < refZ - 55) {
          rec.z += this.spanZ;
          this.applyRecord(lays, rec, i);
          dirty = true;
        }
      }

      if (dirty) {
        for (const l of lays) l.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  private applyRecord(lays: InstancedLayer[], rec: PropRecord, index: number): void {
    const cx = getTrackCenterX(rec.z, this.trackId);
    const cy = getTrackElevationY(rec.z, this.trackId);
    const yaw = getTrackYaw(rec.z, this.trackId);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const wx = cx + rec.lateralOffset * cosY;
    const wz = rec.z - rec.lateralOffset * sinY;

    _euler.set(0, yaw + rec.yawOffset, 0);
    _quat.setFromEuler(_euler);

    for (const layer of lays) {
      if (layer.scaleWithProp) {
        _pos.set(
          wx + layer.localOffset.x * rec.sx,
          cy + layer.localOffset.y * rec.sy,
          wz + layer.localOffset.z * rec.sz
        );
        _scale.set(rec.sx, layer.scaleYWithProp ? rec.sy : 1, rec.sz);
      } else {
        _pos.set(wx, cy, wz);
        _scale.set(1, 1, 1);
      }
      _mat4.compose(_pos, _quat, _scale);
      layer.mesh.setMatrixAt(index, _mat4);
    }
  }

  public dispose(): void {
    for (const lays of this.layers) {
      for (const layer of lays) {
        layer.mesh.geometry.dispose();
        if (Array.isArray(layer.mesh.material)) {
          layer.mesh.material.forEach((m) => m.dispose());
        } else {
          layer.mesh.material.dispose();
        }
      }
    }
  }
}
