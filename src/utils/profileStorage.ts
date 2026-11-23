import {
  BIKES,
  getDefaultBikeCustomization,
  MAX_UPGRADE_LEVEL,
  REWARD_ITEM_LIST,
  UPGRADE_COSTS,
} from '../data/catalog';
import {
  BikeCustomization,
  BikeId,
  GameMode,
  LeaderboardEntry,
  PaintColorId,
  RewardItemId,
  UserProfile,
} from '../types/game';
import { DEFAULT_AVATAR, getAiAvatar } from './avatars';

const PROFILES_KEY = 'jit_bike_race_profiles_v1';
const SESSION_KEY = 'jit_bike_race_session_v1';

interface StoredSession {
  phone: string | null;
  isGuest: boolean;
  guestProfile?: UserProfile;
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

export function isValidPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

function hydrateProfile(raw: Partial<UserProfile>, fallbackPhone: string | null): UserProfile {
  const unlocked: BikeId[] =
    Array.isArray(raw.unlockedBikes) && raw.unlockedBikes.length > 0
      ? Array.from(new Set<BikeId>(['apex', ...raw.unlockedBikes]))
      : ['apex'];

  const customizations: Partial<Record<BikeId, BikeCustomization>> = {
    ...(raw.bikeCustomizations ?? {}),
  };

  const inventoryTools: RewardItemId[] = Array.isArray(raw.inventoryTools)
    ? Array.from(new Set<RewardItemId>(raw.inventoryTools))
    : [];

  return {
    phone: raw.isGuest ? null : (raw.phone ?? fallbackPhone),
    isGuest: Boolean(raw.isGuest),
    name: (raw.name || 'Racer 01').trim().slice(0, 18) || 'Racer 01',
    avatar: raw.avatar || DEFAULT_AVATAR,
    coins: typeof raw.coins === 'number' && Number.isFinite(raw.coins) ? Math.max(0, Math.round(raw.coins)) : 500,
    unlockedBikes: unlocked,
    bikeCustomizations: customizations,
    inventoryTools,
    blueprints: typeof raw.blueprints === 'number' ? Math.max(0, raw.blueprints) : 0,
    stats: {
      races: raw.stats?.races ?? 0,
      wins: raw.stats?.wins ?? 0,
      podiums: raw.stats?.podiums ?? 0,
      bestWheelie: raw.stats?.bestWheelie ?? 0,
      bestRaceTimeMs:
        typeof raw.stats?.bestRaceTimeMs === 'number' ? raw.stats.bestRaceTimeMs : null,
      bestEndlessMeters: raw.stats?.bestEndlessMeters ?? 0,
      topSpeedKmh: raw.stats?.topSpeedKmh ?? 0,
    },
    createdAt: raw.createdAt ?? Date.now(),
  };
}

function readAllProfiles(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<UserProfile>>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, UserProfile> = {};
    for (const [phone, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object') {
        out[phone] = hydrateProfile(val, phone);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAllProfiles(map: Record<string, UserProfile>): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function getBikeCustomization(profile: UserProfile, bikeId: BikeId): BikeCustomization {
  const existing = profile.bikeCustomizations?.[bikeId];
  const def = getDefaultBikeCustomization(bikeId);
  if (!existing) return def;
  return {
    paintId: existing.paintId || def.paintId,
    upgrades: {
      engine: existing.upgrades?.engine ?? 0,
      handling: existing.upgrades?.handling ?? 0,
      nitro: existing.upgrades?.nitro ?? 0,
    },
    equippedTools: Array.isArray(existing.equippedTools) ? existing.equippedTools : [],
  };
}

export function getProfileByPhone(phone: string): UserProfile | null {
  const clean = normalizePhone(phone);
  if (!isValidPhone(clean)) return null;
  const all = readAllProfiles();
  const found = all[clean];
  if (!found) return null;
  return hydrateProfile(found, clean);
}

export function createNewPhoneProfile(
  phone: string,
  name?: string,
  avatar?: string
): UserProfile {
  const clean = normalizePhone(phone);
  const suffix = clean.slice(-4) || '01';
  const profile = hydrateProfile(
    {
      phone: clean,
      isGuest: false,
      name: (name || '').trim() || `Racer ${suffix}`,
      avatar: avatar || DEFAULT_AVATAR,
      coins: 500,
      unlockedBikes: ['apex'],
      bikeCustomizations: {},
      inventoryTools: [],
      blueprints: 0,
      createdAt: Date.now(),
    },
    clean
  );
  saveProfile(profile);
  return profile;
}

export function createGuestProfile(): UserProfile {
  const profile = hydrateProfile(
    {
      phone: null,
      isGuest: true,
      name: `Guest ${Math.floor(10 + Math.random() * 89)}`,
      avatar: DEFAULT_AVATAR,
      coins: 500,
      unlockedBikes: ['apex'],
      bikeCustomizations: {},
      inventoryTools: [],
      blueprints: 0,
      createdAt: Date.now(),
    },
    null
  );
  saveActiveSession(profile);
  return profile;
}

export function saveProfile(profile: UserProfile): UserProfile {
  const sanitized = hydrateProfile(profile, profile.phone);

  if (!sanitized.isGuest && sanitized.phone && isValidPhone(sanitized.phone)) {
    const all = readAllProfiles();
    all[sanitized.phone] = sanitized;
    writeAllProfiles(all);
  }
  saveActiveSession(sanitized);
  return sanitized;
}

export function saveActiveSession(profile: UserProfile): void {
  try {
    const session: StoredSession = profile.isGuest
      ? { phone: null, isGuest: true, guestProfile: profile }
      : { phone: profile.phone, isGuest: false };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

export function loadActiveSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (session.isGuest && session.guestProfile) {
      return hydrateProfile(session.guestProfile, null);
    }
    if (session.phone) {
      return getProfileByPhone(session.phone);
    }
    return null;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function unlockBikeInProfile(
  profile: UserProfile,
  bikeId: BikeId,
  useBlueprints = false
): { updated: UserProfile; success: boolean; message?: string } {
  if (profile.unlockedBikes.includes(bikeId)) {
    return { updated: profile, success: true };
  }
  const spec = BIKES[bikeId];
  if (useBlueprints && spec.blueprintCost && profile.blueprints >= spec.blueprintCost) {
    const updated = saveProfile({
      ...profile,
      blueprints: profile.blueprints - spec.blueprintCost,
      unlockedBikes: [...profile.unlockedBikes, bikeId],
    });
    return { updated, success: true };
  }
  if (profile.coins < spec.unlockCost) {
    return { updated: profile, success: false, message: 'Not enough coins to unlock this superbike.' };
  }
  const updated = saveProfile({
    ...profile,
    coins: profile.coins - spec.unlockCost,
    unlockedBikes: [...profile.unlockedBikes, bikeId],
  });
  return { updated, success: true };
}

export function setBikePaintInProfile(
  profile: UserProfile,
  bikeId: BikeId,
  paintId: PaintColorId
): UserProfile {
  const cur = getBikeCustomization(profile, bikeId);
  return saveProfile({
    ...profile,
    bikeCustomizations: {
      ...profile.bikeCustomizations,
      [bikeId]: { ...cur, paintId },
    },
  });
}

export function upgradeBikeStatInProfile(
  profile: UserProfile,
  bikeId: BikeId,
  stat: 'engine' | 'handling' | 'nitro'
): { updated: UserProfile; success: boolean; message?: string } {
  const cur = getBikeCustomization(profile, bikeId);
  const level = cur.upgrades[stat] ?? 0;
  if (level >= MAX_UPGRADE_LEVEL) {
    return { updated: profile, success: false, message: 'Already at Max Level.' };
  }
  const cost = UPGRADE_COSTS[level] ?? 1250;
  if (profile.coins < cost) {
    return { updated: profile, success: false, message: `Need ${cost} coins to upgrade.` };
  }
  const updated = saveProfile({
    ...profile,
    coins: profile.coins - cost,
    bikeCustomizations: {
      ...profile.bikeCustomizations,
      [bikeId]: {
        ...cur,
        upgrades: {
          ...cur.upgrades,
          [stat]: level + 1,
        },
      },
    },
  });
  return { updated, success: true };
}

export function toggleToolEquipInProfile(
  profile: UserProfile,
  bikeId: BikeId,
  toolId: RewardItemId
): UserProfile {
  if (!profile.inventoryTools.includes(toolId)) return profile;
  const cur = getBikeCustomization(profile, bikeId);
  const exists = cur.equippedTools.includes(toolId);
  const nextTools = exists
    ? cur.equippedTools.filter((t) => t !== toolId)
    : [...cur.equippedTools, toolId];
  return saveProfile({
    ...profile,
    bikeCustomizations: {
      ...profile.bikeCustomizations,
      [bikeId]: {
        ...cur,
        equippedTools: nextTools,
      },
    },
  });
}

export interface RaceRewardResult {
  updated: UserProfile;
  coinsEarned: number;
  wonItem: RewardItemId | null;
  wonItemDuplicateBonus: number;
}

export function recordRaceResult(
  profile: UserProfile,
  params: {
    rank: number;
    wheelieScore: number;
    gameMode: GameMode;
    elapsedMs: number;
    distanceM: number;
    topSpeedKmh: number;
    coinsCollected: number;
    completedFullTrack: boolean;
  }
): RaceRewardResult {
  const rankRewards = [320, 220, 150, 85, 55];
  let baseCoins = rankRewards[Math.max(0, Math.min(4, params.rank - 1))] ?? 55;
  if (params.gameMode === 'endless') {
    baseCoins = Math.max(40, Math.round(params.distanceM / 45));
  } else if (params.gameMode === 'timetrial') {
    baseCoins = params.completedFullTrack ? 350 : Math.max(45, Math.round(params.distanceM / 65));
  }
  const wheelieBonus = Math.min(100, Math.floor(Math.max(0, params.wheelieScore) / 25));

  // Victory Reward Crate / Tool Drop for finishing 1st, 2nd, or 3rd (or long Endless > 2500m)
  const qualifiesForCrate =
    (params.gameMode === 'standard' && params.rank <= 3) ||
    (params.gameMode === 'knockout' && params.rank <= 3) ||
    (params.gameMode === 'timetrial' && (params.completedFullTrack || params.distanceM >= 3200)) ||
    (params.gameMode === 'endless' && params.distanceM >= 2500);

  let wonItem: RewardItemId | null = null;
  let wonItemDuplicateBonus = 0;
  const nextTools = [...profile.inventoryTools];
  let nextBlueprints = profile.blueprints;

  if (qualifiesForCrate) {
    // Prioritize unowned equippable tools so players feel rapid exciting progression
    const unownedTools = REWARD_ITEM_LIST.filter(
      (item) => item.equippable && !nextTools.includes(item.id)
    );
    const roll = Math.random();
    if (unownedTools.length > 0 && roll < 0.78) {
      const picked = unownedTools[Math.floor(Math.random() * unownedTools.length)];
      wonItem = picked.id;
      nextTools.push(picked.id);
    } else {
      // Roll across all 6 items (including Mystery Bike Blueprint)
      const picked = REWARD_ITEM_LIST[Math.floor(Math.random() * REWARD_ITEM_LIST.length)];
      wonItem = picked.id;
      if (picked.id === 'mystery_blueprint') {
        if (profile.unlockedBikes.includes('titan')) {
          wonItemDuplicateBonus = 350;
        } else {
          nextBlueprints += 1;
        }
      } else if (!nextTools.includes(picked.id)) {
        nextTools.push(picked.id);
      } else {
        wonItemDuplicateBonus = 180;
      }
    }
  }

  const coinsEarned = baseCoins + wheelieBonus + params.coinsCollected + wonItemDuplicateBonus;

  const isWin =
    (params.gameMode === 'standard' && params.rank === 1) ||
    (params.gameMode === 'knockout' && params.rank === 1) ||
    (params.gameMode === 'timetrial' && params.completedFullTrack);

  const prevBestTime = profile.stats.bestRaceTimeMs;
  const nextBestTime =
    params.completedFullTrack && params.gameMode !== 'endless'
      ? prevBestTime === null
        ? Math.round(params.elapsedMs)
        : Math.min(prevBestTime, Math.round(params.elapsedMs))
      : prevBestTime;

  const updated = saveProfile({
    ...profile,
    coins: profile.coins + coinsEarned,
    inventoryTools: nextTools,
    blueprints: nextBlueprints,
    stats: {
      races: profile.stats.races + 1,
      wins: profile.stats.wins + (isWin ? 1 : 0),
      podiums: profile.stats.podiums + (params.rank <= 3 ? 1 : 0),
      bestWheelie: Math.max(profile.stats.bestWheelie, Math.round(params.wheelieScore)),
      bestRaceTimeMs: nextBestTime,
      bestEndlessMeters:
        params.gameMode === 'endless'
          ? Math.max(profile.stats.bestEndlessMeters, Math.round(params.distanceM))
          : profile.stats.bestEndlessMeters,
      topSpeedKmh: Math.max(profile.stats.topSpeedKmh, Math.round(params.topSpeedKmh)),
    },
  });

  return {
    updated,
    coinsEarned,
    wonItem,
    wonItemDuplicateBonus,
  };
}

const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed_1',
    name: 'Aarav Sharma',
    avatar: getAiAvatar(0),
    wins: 24,
    bestRaceTimeMs: 166400, // 02:46.40
    bestEndlessMeters: 14820,
    topSpeedKmh: 342,
  },
  {
    id: 'seed_2',
    name: 'Kaito Takahashi',
    avatar: getAiAvatar(1),
    wins: 19,
    bestRaceTimeMs: 171150, // 02:51.15
    bestEndlessMeters: 12450,
    topSpeedKmh: 336,
  },
  {
    id: 'seed_3',
    name: 'Elena Vance',
    avatar: getAiAvatar(2),
    wins: 16,
    bestRaceTimeMs: 176900, // 02:56.90
    bestEndlessMeters: 10940,
    topSpeedKmh: 328,
  },
  {
    id: 'seed_4',
    name: 'Rohan Verma',
    avatar: getAiAvatar(3),
    wins: 13,
    bestRaceTimeMs: 181320, // 03:01.32
    bestEndlessMeters: 9600,
    topSpeedKmh: 322,
  },
  {
    id: 'seed_5',
    name: 'Sora Lindqvist',
    avatar: getAiAvatar(4),
    wins: 11,
    bestRaceTimeMs: 186600, // 03:06.60
    bestEndlessMeters: 8420,
    topSpeedKmh: 315,
  },
  {
    id: 'seed_6',
    name: 'Marcus Cole',
    avatar: getAiAvatar(5),
    wins: 8,
    bestRaceTimeMs: 192100, // 03:12.10
    bestEndlessMeters: 7350,
    topSpeedKmh: 309,
  },
];

export function getGlobalLeaderboard(activeProfile: UserProfile): LeaderboardEntry[] {
  const allSaved = readAllProfiles();
  const entries: LeaderboardEntry[] = [...SEED_LEADERBOARD];

  const addedPhones = new Set<string>();
  for (const p of Object.values(allSaved)) {
    const key = p.phone ?? p.name;
    addedPhones.add(key);
    entries.push({
      id: `user_${key}`,
      name: p.name,
      avatar: p.avatar,
      wins: p.stats.wins,
      bestRaceTimeMs: p.stats.bestRaceTimeMs,
      bestEndlessMeters: p.stats.bestEndlessMeters,
      topSpeedKmh: p.stats.topSpeedKmh,
      isLocal: activeProfile.phone !== null && activeProfile.phone === p.phone,
    });
  }

  // Include active guest profile if not already listed
  if (activeProfile.isGuest) {
    entries.push({
      id: 'active_guest',
      name: activeProfile.name,
      avatar: activeProfile.avatar,
      wins: activeProfile.stats.wins,
      bestRaceTimeMs: activeProfile.stats.bestRaceTimeMs,
      bestEndlessMeters: activeProfile.stats.bestEndlessMeters,
      topSpeedKmh: activeProfile.stats.topSpeedKmh,
      isLocal: true,
    });
  } else if (activeProfile.phone && !addedPhones.has(activeProfile.phone)) {
    entries.push({
      id: `user_${activeProfile.phone}`,
      name: activeProfile.name,
      avatar: activeProfile.avatar,
      wins: activeProfile.stats.wins,
      bestRaceTimeMs: activeProfile.stats.bestRaceTimeMs,
      bestEndlessMeters: activeProfile.stats.bestEndlessMeters,
      topSpeedKmh: activeProfile.stats.topSpeedKmh,
      isLocal: true,
    });
  }

  return entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.bestRaceTimeMs !== null && b.bestRaceTimeMs !== null) {
      return a.bestRaceTimeMs - b.bestRaceTimeMs;
    }
    if (a.bestRaceTimeMs !== null) return -1;
    if (b.bestRaceTimeMs !== null) return 1;
    return b.bestEndlessMeters - a.bestEndlessMeters;
  });
}
