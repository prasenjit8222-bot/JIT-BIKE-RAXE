export interface BuiltinAvatar {
  id: string;
  label: string;
  dataUrl: string;
}

function makeHelmetSvg(opts: {
  bg1: string;
  bg2: string;
  shell: string;
  stripe: string;
  visor: string;
  glow: string;
}): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${opts.bg1}"/>
      <stop offset="100%" stop-color="${opts.bg2}"/>
    </linearGradient>
    <linearGradient id="vis" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${opts.glow}"/>
      <stop offset="55%" stop-color="${opts.visor}"/>
      <stop offset="100%" stop-color="#090d17"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg)"/>
  <circle cx="50" cy="50" r="46" fill="none" stroke="${opts.stripe}" stroke-opacity="0.35" stroke-width="2.5"/>
  <!-- Racing Suit Shoulders -->
  <path d="M16 92 C20 74, 34 69, 50 69 C66 69, 80 74, 84 92 Z" fill="#111827"/>
  <path d="M32 72 L50 84 L68 72" fill="none" stroke="${opts.stripe}" stroke-width="3.5" stroke-linecap="round"/>
  <!-- Aerodynamic Full-Face Helmet Shell -->
  <path d="M23 53 C22 30, 35 17, 52 17 C70 17, 79 30, 78 52 C78 65, 69 75, 53 76 L37 76 C28 75, 23 66, 23 53 Z" fill="${opts.shell}" stroke="#090d17" stroke-width="2"/>
  <!-- Helmet Racing Stripe -->
  <path d="M46 18 L55 18 L52 40 L44 40 Z" fill="${opts.stripe}"/>
  <path d="M26 39 C36 33, 56 32, 75 37" fill="none" stroke="${opts.stripe}" stroke-width="3" stroke-linecap="round"/>
  <!-- Reflective Tinted Visor -->
  <path d="M32 45 C42 40, 62 40, 74 46 C73 56, 65 62, 51 62 C39 62, 33 56, 32 45 Z" fill="url(#vis)" stroke="#0f172a" stroke-width="1.8"/>
  <!-- Visor Specular Glint -->
  <path d="M38 46 C46 43, 55 43, 62 45" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Chin Vent -->
  <rect x="46" y="66" width="12" height="4" rx="2" fill="#0f172a"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const BUILTIN_AVATARS: BuiltinAvatar[] = [
  {
    id: 'crimson_aero',
    label: 'Crimson Aero',
    dataUrl: makeHelmetSvg({
      bg1: '#2a0a12',
      bg2: '#0f172a',
      shell: '#dc2626',
      stripe: '#f59e0b',
      visor: '#b45309',
      glow: '#fde047',
    }),
  },
  {
    id: 'volt_cyber',
    label: 'Volt Cyber',
    dataUrl: makeHelmetSvg({
      bg1: '#082f49',
      bg2: '#090d17',
      shell: '#06b6d4',
      stripe: '#e0f2fe',
      visor: '#1d4ed8',
      glow: '#38bdf8',
    }),
  },
  {
    id: 'viper_gold',
    label: 'Viper Gold',
    dataUrl: makeHelmetSvg({
      bg1: '#2c1d06',
      bg2: '#111827',
      shell: '#f59e0b',
      stripe: '#18181b',
      visor: '#334155',
      glow: '#fcd34d',
    }),
  },
  {
    id: 'phantom_stealth',
    label: 'Phantom Stealth',
    dataUrl: makeHelmetSvg({
      bg1: '#1e293b',
      bg2: '#020617',
      shell: '#e2e8f0',
      stripe: '#3b82f6',
      visor: '#0f172a',
      glow: '#93c5fd',
    }),
  },
  {
    id: 'emerald_apex',
    label: 'Emerald Apex',
    dataUrl: makeHelmetSvg({
      bg1: '#062c22',
      bg2: '#0b101b',
      shell: '#10b981',
      stripe: '#f8fafc',
      visor: '#0f766e',
      glow: '#6ee7b7',
    }),
  },
  {
    id: 'solar_flare',
    label: 'Solar Flare',
    dataUrl: makeHelmetSvg({
      bg1: '#3b0764',
      bg2: '#0f172a',
      shell: '#f97316',
      stripe: '#ffffff',
      visor: '#9f1239',
      glow: '#fb7185',
    }),
  },
];

export const DEFAULT_AVATAR = BUILTIN_AVATARS[0].dataUrl;

export function getAiAvatar(index: number): string {
  return BUILTIN_AVATARS[(index + 1) % BUILTIN_AVATARS.length].dataUrl;
}

/**
 * Center-crops and compresses a user-selected image file to a 100x100 JPEG
 * at 0.7 quality so the resulting base64 string stays lightweight for
 * localStorage and multiplayer room sync.
 */
export function compressAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or unsupported image format.'));
      img.onload = () => {
        try {
          const size = 100;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable.'));
            return;
          }

          // Center square crop
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        } catch {
          reject(new Error('Failed to process image.'));
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
