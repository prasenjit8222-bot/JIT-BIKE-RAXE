import * as THREE from 'three';
import { TrackSpec } from '../types/game';

export function createRoadTexture(track: TrackSpec, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base asphalt
  ctx.fillStyle = track.roadColor;
  ctx.fillRect(0, 0, 512, 512);

  // Fine asphalt mineral grain (fast, crisp, zero blur)
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle =
      Math.random() > 0.52 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Subtle tire wear tracks along all 3 lanes
  const laneCenters = [98, 256, 414];
  for (const cx of laneCenters) {
    const wearGrad = ctx.createLinearGradient(cx - 38, 0, cx + 38, 0);
    wearGrad.addColorStop(0, 'rgba(0,0,0,0)');
    wearGrad.addColorStop(0.28, 'rgba(0,0,0,0.16)');
    wearGrad.addColorStop(0.5, 'rgba(0,0,0,0.04)');
    wearGrad.addColorStop(0.72, 'rgba(0,0,0,0.16)');
    wearGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wearGrad;
    ctx.fillRect(cx - 38, 0, 76, 512);
  }

  // Subtle curb shadow gradient
  const edgeL = ctx.createLinearGradient(0, 0, 26, 0);
  edgeL.addColorStop(0, 'rgba(0,0,0,0.34)');
  edgeL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeL;
  ctx.fillRect(0, 0, 26, 512);

  const edgeR = ctx.createLinearGradient(486, 0, 512, 0);
  edgeR.addColorStop(0, 'rgba(0,0,0,0)');
  edgeR.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = edgeR;
  ctx.fillRect(486, 0, 26, 512);

  // Crisp reflective edge lines
  ctx.fillStyle = track.id === 'city' ? '#f1f5f9' : '#f8fafc';
  ctx.fillRect(17, 0, 6, 512);
  ctx.fillRect(489, 0, 6, 512);

  // Shoulder rumble markings
  ctx.fillStyle = track.id === 'city' ? 'rgba(251, 191, 36, 0.55)' : 'rgba(255, 255, 255, 0.25)';
  for (let y = 0; y < 512; y += 24) {
    ctx.fillRect(7, y, 6, 12);
    ctx.fillRect(499, y, 6, 12);
  }

  // Dashed lane dividers (3 lanes)
  ctx.fillStyle = track.id === 'city' ? '#fbbf24' : '#f8fafc';
  for (let y = 12; y < 512; y += 64) {
    ctx.fillRect(172, y, 7, 34);
    ctx.fillRect(333, y, 7, 34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFootpathTexture(track: TrackSpec, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = track.footpathColor;
  ctx.fillRect(0, 0, 256, 256);

  if (track.id === 'city' || track.id === 'coastal') {
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 64) {
        ctx.fillStyle = (x + y) % 64 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
        ctx.fillRect(x + 2, y + 2, 60, 28);
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, 64, 32);
      }
    }
  } else {
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLampPoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 224, 150, 0.38)');
  grad.addColorStop(0.45, 'rgba(253, 186, 116, 0.14)');
  grad.addColorStop(1, 'rgba(253, 186, 116, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSpeedBreakerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 512, 64);

  ctx.fillStyle = '#111827';
  for (let x = -64; x < 576; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 48, 64);
    ctx.lineTo(x + 24, 64);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFinishBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const dark = ((x / sq) + (y / sq)) % 2 === 0;
      ctx.fillStyle = dark ? '#0f172a' : '#f8fafc';
      ctx.fillRect(x, y, sq, sq);
    }
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(136, 30, 240, 68);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(138, 32, 236, 64);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FINISH', 256, 65);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBuildingFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark architectural concrete/steel cladding with horizontal floor spandrels
  ctx.fillStyle = '#151e30';
  ctx.fillRect(0, 0, 256, 512);

  for (let row = 0; row < 512; row += 24) {
    // Structural floor slab band
    ctx.fillStyle = '#0c1322';
    ctx.fillRect(0, row, 256, 5);

    for (let col = 8; col < 248; col += 20) {
      const rnd = Math.random();
      if (rnd > 0.48) {
        ctx.fillStyle = rnd > 0.84 ? '#fde68a' : rnd > 0.65 ? '#93c5fd' : '#38bdf8';
      } else {
        ctx.fillStyle = '#0f172a';
      }
      ctx.fillRect(col, row + 7, 13, 13);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
