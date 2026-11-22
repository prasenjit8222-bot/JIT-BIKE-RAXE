import { BIKES, GAME_MODE_LIST, REWARD_ITEMS, TRACKS, WEATHER_MODE_LIST } from '../data/catalog';
import { BikeId, GameMode, RewardItemId, TrackId, WeatherMode } from '../types/game';

export interface ScorecardData {
  playerName: string;
  playerAvatar: string;
  rank: number;
  bikeId: BikeId;
  trackId: TrackId;
  gameMode: GameMode;
  weather: WeatherMode;
  elapsedMs: number;
  topSpeedKmh: number;
  distanceM: number;
  coinsEarned: number;
  wonItem: RewardItemId | null;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateScorecardBlob(data: ScorecardData): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Racing Obsidian Gradient Background
  const bg = ctx.createLinearGradient(0, 0, 960, 540);
  bg.addColorStop(0, '#070b14');
  bg.addColorStop(0.55, '#0f172a');
  bg.addColorStop(1, '#1e1b2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 960, 540);

  // Subtle Diagonal Racing Stripes
  ctx.save();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
  ctx.beginPath();
  ctx.moveTo(640, 0);
  ctx.lineTo(840, 0);
  ctx.lineTo(660, 540);
  ctx.lineTo(460, 540);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Outer Card Border
  drawRoundedRect(ctx, 24, 24, 912, 492, 24);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top Header: JIT Logo + Title + Track / Mode
  const [logoImg, avatarImg] = await Promise.all([
    loadImageSafe('./assets/aistudio/image_74ce4eb9.png'),
    loadImageSafe(data.playerAvatar),
  ]);

  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(82, 82, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logoImg, 52, 52, 60, 60);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(82, 82, 33, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('OFFICIAL RACE SCORECARD', 132, 68);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('JIT BIKE RACE', 132, 102);

  const trackName = TRACKS[data.trackId].name;
  const modeName = GAME_MODE_LIST.find((m) => m.id === data.gameMode)?.name ?? data.gameMode;
  const weatherName = WEATHER_MODE_LIST.find((w) => w.id === data.weather)?.name ?? data.weather;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${trackName} · ${modeName}`, 904, 78);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Weather: ${weatherName} · Machine: ${BIKES[data.bikeId].name}`, 904, 103);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(52, 134);
  ctx.lineTo(908, 134);
  ctx.stroke();

  // Player Profile Block
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(108, 214, 48, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, 60, 166, 96, 96);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(108, 214, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(108, 214, 49, 0, Math.PI * 2);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('RIDER', 178, 192);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(data.playerName, 178, 232);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`+${data.coinsEarned} COINS EARNED`, 178, 258);

  // Rank Badge on Right
  drawRoundedRect(ctx, 730, 162, 174, 104, 18);
  ctx.fillStyle = data.rank === 1 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.85)';
  ctx.fill();
  ctx.strokeStyle = data.rank <= 3 ? '#f59e0b' : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(data.gameMode === 'endless' ? 'HIGHWAY RUN' : 'FINAL RANK', 817, 192);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(data.gameMode === 'endless' ? `${(data.distanceM / 1000).toFixed(1)}k` : `#${data.rank}`, 817, 248);
  ctx.textAlign = 'left';

  // 4 Telemetry Metric Boxes
  const stats = [
    { label: 'RACE TIME', value: formatTime(data.elapsedMs), color: '#ffffff' },
    { label: 'TOP SPEED', value: `${Math.round(data.topSpeedKmh)} KM/H`, color: '#38bdf8' },
    { label: 'DISTANCE', value: `${(data.distanceM / 1000).toFixed(2)} KM`, color: '#34d399' },
    {
      label: 'CRATE REWARD',
      value: data.wonItem ? REWARD_ITEMS[data.wonItem].name : 'No Crate Drop',
      color: data.wonItem ? '#fbbf24' : '#94a3b8',
    },
  ];

  stats.forEach((st, idx) => {
    const bx = 52 + idx * 218;
    const by = 304;
    const bw = 202;
    const bh = 112;
    drawRoundedRect(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(st.label, bx + 16, by + 32);

    ctx.fillStyle = st.color;
    ctx.font = idx === 3 ? 'bold 17px sans-serif' : 'bold 26px sans-serif';
    ctx.fillText(st.value.slice(0, 19), bx + 16, by + 76);
  });

  // Footer Bar
  ctx.fillStyle = '#64748b';
  ctx.font = '14px sans-serif';
  ctx.fillText('Can you beat this time? Challenge me in JIT BIKE RACE 3D Multiplayer!', 52, 476);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('JIT BIKE RACE · 3D SUPERBIKE CHAMPIONSHIP', 904, 476);
  ctx.textAlign = 'left';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

export async function shareOrDownloadScorecard(data: ScorecardData): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await generateScorecardBlob(data);
  if (!blob) return 'failed';

  const filename = `jit-bike-race-scorecard-${Date.now()}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  const shareText = `I finished #${data.rank} in JIT BIKE RACE on ${TRACKS[data.trackId].name} (${formatTime(data.elapsedMs)}, Top Speed ${Math.round(data.topSpeedKmh)} KM/H)!`;

  // Try native Web Share API (works seamlessly with WhatsApp / Social on mobile)
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: 'JIT BIKE RACE Scorecard',
        text: shareText,
        files: [file],
      });
      return 'shared';
    } catch {
      // User cancelled or share blocked -> fall back to PNG download
    }
  }

  // Direct PNG Download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
