import React, { useState } from 'react';
import {
  Check,
  Coins,
  Cpu,
  Flame,
  Gauge,
  Lock,
  Palette,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  BIKE_LIST,
  BIKES,
  computeEffectiveBikePhysics,
  MAX_UPGRADE_LEVEL,
  PAINT_COLOR_LIST,
  REWARD_ITEM_LIST,
  UPGRADE_COSTS,
} from '../data/catalog';
import { BikeId, PaintColorId, RewardItemId, UserProfile } from '../types/game';
import { getBikeCustomization } from '../utils/profileStorage';

interface GarageModalProps {
  profile: UserProfile;
  selectedBike: BikeId;
  onSelectBike: (id: BikeId) => void;
  onUnlockBike: (id: BikeId, useBlueprints?: boolean) => string | null;
  onSelectPaint: (bikeId: BikeId, paintId: PaintColorId) => void;
  onUpgradeStat: (bikeId: BikeId, stat: 'engine' | 'handling' | 'nitro') => string | null;
  onToggleTool: (bikeId: BikeId, toolId: RewardItemId) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  profile,
  selectedBike,
  onSelectBike,
  onUnlockBike,
  onSelectPaint,
  onUpgradeStat,
  onToggleTool,
  onClose,
}) => {
  const [inspectBikeId, setInspectBikeId] = useState<BikeId>(selectedBike);
  const [tab, setTab] = useState<'bikes' | 'customize' | 'tools'>('bikes');
  const [feedback, setFeedback] = useState<string | null>(null);

  const spec = BIKES[inspectBikeId];
  const isUnlocked = profile.unlockedBikes.includes(inspectBikeId);
  const custom = getBikeCustomization(profile, inspectBikeId);
  const effective = computeEffectiveBikePhysics(inspectBikeId, custom);

  const handleInspect = (id: BikeId) => {
    setInspectBikeId(id);
    setFeedback(null);
    if (profile.unlockedBikes.includes(id)) {
      onSelectBike(id);
    }
  };

  const handleUnlock = (useBlueprints = false) => {
    const err = onUnlockBike(inspectBikeId, useBlueprints);
    if (err) {
      setFeedback(err);
    } else {
      setFeedback(`${spec.name} unlocked and selected!`);
      onSelectBike(inspectBikeId);
    }
  };

  const handleUpgrade = (stat: 'engine' | 'handling' | 'nitro') => {
    const err = onUpgradeStat(inspectBikeId, stat);
    if (err) {
      setFeedback(err);
    } else {
      setFeedback(null);
    }
  };

  const equippableTools = REWARD_ITEM_LIST.filter((i) => i.equippable);

  return (
    <div
      style={{ zIndex: 10000 }}
      className="pointer-events-none fixed inset-0 flex items-center justify-end p-3 sm:p-5"
    >
      {/* Side-docked Garage Panel leaves left/center 3D turntable visible for live paint & bike preview! */}
      <div className="pointer-events-auto flex max-h-full w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b101b]/94 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              JIT Superbike Workshop
            </div>
            <h2 className="font-display text-lg font-bold text-white sm:text-xl">
              Garage &amp; Upgrades
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
              <Coins className="h-3.5 w-3.5" />
              <span className="font-mono-num">{profile.coins}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Garage"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-slate-950/60 p-1.5">
          <button
            type="button"
            onClick={() => setTab('bikes')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'bikes' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            5 Superbikes
          </button>
          <button
            type="button"
            onClick={() => setTab('customize')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'customize' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Paint &amp; Tuning
          </button>
          <button
            type="button"
            onClick={() => setTab('tools')}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'tools' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Won Tools ({profile.inventoryTools.length})
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="custom-scroll flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {feedback && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-200">
              {feedback}
            </div>
          )}

          {/* Bike Summary & Live Stats */}
          <div className="rounded-xl border border-white/10 bg-slate-900/75 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-base font-bold text-white">{spec.name}</div>
                <p className="mt-0.5 text-[11px] text-slate-400">{spec.tagline}</p>
              </div>
              {isUnlocked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 whitespace-nowrap">
                  <Check className="h-3.5 w-3.5" />
                  Owned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 whitespace-nowrap">
                  <Lock className="h-3.5 w-3.5" />
                  Locked
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <MiniStatBar label="Top Speed" value={effective.displayStats.topSpeed} accent="#f59e0b" />
              <MiniStatBar label="Accel" value={effective.displayStats.acceleration} accent="#06b6d4" />
              <MiniStatBar label="Handling" value={effective.displayStats.handling} accent="#22c55e" />
              <MiniStatBar label="Nitro Cap" value={effective.displayStats.nitro} accent="#a855f7" />
            </div>

            {!isUnlocked && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => handleUnlock(false)}
                  className="font-display flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>Unlock for {spec.unlockCost} Coins</span>
                </button>
                {spec.blueprintCost && (
                  <button
                    type="button"
                    disabled={profile.blueprints < spec.blueprintCost}
                    onClick={() => handleUnlock(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-45 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      Blueprints ({profile.blueprints}/{spec.blueprintCost})
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: 5 SUPERBIKES */}
          {tab === 'bikes' && (
            <div className="space-y-2">
              {BIKE_LIST.map((b) => {
                const owned = profile.unlockedBikes.includes(b.id);
                const active = inspectBikeId === b.id;
                const equipped = selectedBike === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleInspect(b.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/12'
                        : 'border-white/10 bg-slate-900/65 hover:border-white/25'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-8 w-8 shrink-0 rounded-lg border border-white/25"
                        style={{ backgroundColor: b.primaryColor }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-white">
                            {b.name}
                          </span>
                          {equipped && (
                            <span className="text-[10px] font-bold uppercase text-amber-400">
                              Equipped
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">{b.tagline}</div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {owned ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="font-mono-num inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Lock className="h-3 w-3" />
                          {b.unlockCost}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: PAINT COLORS & UPGRADES */}
          {tab === 'customize' && (
            <div className="space-y-4">
              {/* Paint Color Picker */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Palette className="h-3.5 w-3.5 text-amber-400" />
                  <span>Superbike Paint Finish</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PAINT_COLOR_LIST.map((paint) => {
                    const active = custom.paintId === paint.id;
                    return (
                      <button
                        key={paint.id}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => onSelectPaint(inspectBikeId, paint.id)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors cursor-pointer disabled:opacity-45 ${
                          active
                            ? 'border-amber-400 bg-amber-500/15 text-white'
                            : 'border-white/10 bg-slate-900/70 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-white/35"
                          style={{ backgroundColor: paint.hex }}
                        />
                        <span className="truncate font-medium">{paint.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Performance Upgrades */}
              <div className="border-t border-white/10 pt-3">
                <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Wrench className="h-3.5 w-3.5 text-amber-400" />
                  <span>Performance Upgrades (Lv. 0 – {MAX_UPGRADE_LEVEL})</span>
                </div>

                <div className="space-y-2.5">
                  <UpgradeRow
                    icon={<Gauge className="h-4 w-4 text-amber-400" />}
                    label="Engine (Top Speed)"
                    level={custom.upgrades.engine}
                    disabled={!isUnlocked}
                    coins={profile.coins}
                    onUpgrade={() => handleUpgrade('engine')}
                  />
                  <UpgradeRow
                    icon={<Cpu className="h-4 w-4 text-emerald-400" />}
                    label="Handling (Sharp Curve Grip)"
                    level={custom.upgrades.handling}
                    disabled={!isUnlocked}
                    coins={profile.coins}
                    onUpgrade={() => handleUpgrade('handling')}
                  />
                  <UpgradeRow
                    icon={<Flame className="h-4 w-4 text-cyan-400" />}
                    label="Nitro Tank Capacity"
                    level={custom.upgrades.nitro}
                    disabled={!isUnlocked}
                    coins={profile.coins}
                    onUpgrade={() => handleUpgrade('nitro')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WON REWARD TOOLS & BLUEPRINTS */}
          {tab === 'tools' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs">
                <span className="font-medium text-cyan-200">Titan RR-1200 Blueprints</span>
                <span className="font-mono-num font-bold text-white">
                  {profile.blueprints} / 3
                </span>
              </div>

              {equippableTools.map((tool) => {
                const owned = profile.inventoryTools.includes(tool.id);
                const equipped = custom.equippedTools.includes(tool.id);
                return (
                  <div
                    key={tool.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      equipped
                        ? 'border-emerald-400/60 bg-emerald-500/12'
                        : owned
                          ? 'border-white/15 bg-slate-900/75'
                          : 'border-white/8 bg-slate-900/40 opacity-70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tool.accentColor }}
                        />
                        <span className="truncate text-xs font-bold text-white">
                          {tool.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{tool.bonusLabel}</p>
                    </div>

                    {owned ? (
                      <button
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => onToggleTool(inspectBikeId, tool.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 ${
                          equipped
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'border border-white/20 bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                      >
                        {equipped ? 'Equipped' : 'Equip'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                        <Lock className="h-3 w-3" />
                        Win Podium
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/75 px-4 py-3 sm:px-5">
          <div className="text-xs text-slate-400">
            Selected: <span className="font-semibold text-white">{BIKES[selectedBike].name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-display rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const MiniStatBar: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div>
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono-num font-bold text-white">{value}</span>
    </div>
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${value}%`, backgroundColor: accent }}
      />
    </div>
  </div>
);

const UpgradeRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  level: number;
  disabled: boolean;
  coins: number;
  onUpgrade: () => void;
}> = ({ icon, label, level, disabled, coins, onUpgrade }) => {
  const isMax = level >= MAX_UPGRADE_LEVEL;
  const cost = UPGRADE_COSTS[level] ?? 1250;
  const canAfford = coins >= cost;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/75 p-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-white">{label}</div>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: MAX_UPGRADE_LEVEL }).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 flex-1 rounded-full ${
                  idx < level ? 'bg-amber-400' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || isMax || !canAfford}
        onClick={onUpgrade}
        className="font-mono-num flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
      >
        {isMax ? (
          'MAX'
        ) : (
          <>
            <Coins className="h-3 w-3" />
            {cost}
          </>
        )}
      </button>
    </div>
  );
};
