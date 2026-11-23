import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Flag,
  Flame,
  Gamepad2,
  Gauge,
  Heart,
  LogOut,
  Magnet,
  Mic,
  MicOff,
  Radio,
  RotateCw,
  Shield,
  ShieldAlert,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { RACE_DISTANCE } from '../data/catalog';
import { CameraMode, ControlInputs, GamePhase, HudSnapshot } from '../types/game';
import { AvatarBadge } from './AvatarBadge';

interface RaceHudProps {
  phase: GamePhase;
  countdownValue: number;
  hud: HudSnapshot | null;
  cameraMode: CameraMode;
  onCycleCamera: () => void;
  micEnabled: boolean;
  speakerMuted: boolean;
  isSpeaking: boolean;
  masterMuted: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onToggleMasterAudio: () => void;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  autoGas: boolean;
  onToggleAutoGas: () => void;
  controlsRef: React.MutableRefObject<ControlInputs>;
  onFinishEndlessNow: () => void;
  onExitRace: () => void;
  showRotateHint: boolean;
  onDismissRotateHint: () => void;
}

const RANK_ORDINAL = ['1st', '2nd', '3rd', '4th', '5th'];

export const RaceHud: React.FC<RaceHudProps> = ({
  phase,
  countdownValue,
  hud,
  cameraMode,
  onCycleCamera,
  micEnabled,
  speakerMuted,
  isSpeaking,
  masterMuted,
  onToggleMic,
  onToggleSpeaker,
  onToggleMasterAudio,
  touchEnabled,
  onToggleTouch,
  autoGas,
  onToggleAutoGas,
  controlsRef,
  onFinishEndlessNow,
  onExitRace,
  showRotateHint,
  onDismissRotateHint,
}) => {
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(() => !touchEnabled);
  const rankIdx = Math.max(0, Math.min(4, (hud?.positionRank ?? 1) - 1));
  const rankLabel = RANK_ORDINAL[rankIdx];

  const camLabel =
    cameraMode === 'far' ? 'Full View' : cameraMode === 'close' ? 'Chase Cam' : 'Cockpit';

  const gameMode = hud?.gameMode ?? 'standard';
  const remainingM = hud?.remainingMeters ?? RACE_DISTANCE;
  const remainingLabel =
    gameMode === 'endless'
      ? `${((hud?.distanceM ?? 0) / 1000).toFixed(2)} km`
      : remainingM >= 1000
        ? `${(remainingM / 1000).toFixed(1)} km`
        : `${remainingM} m`;
  const progressPct = Math.round((hud?.progress ?? 0) * 100);
  const policeRedPhase = Math.floor((hud?.elapsedMs ?? 0) / 220) % 2 === 0;
  const bikeHealth = Math.round(hud?.bikeHealth ?? 100);

  return (
    <div
      style={{ zIndex: 9999 }}
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
    >
      {/* Collision Red Screen Vignette */}
      {hud && hud.collisionFlash > 0.05 && (
        <div
          className="pointer-events-none fixed inset-0 border-8 border-rose-500/80 bg-rose-600/15"
          style={{ opacity: hud.collisionFlash }}
        />
      )}

      {/* Nitro Pickup Cyan Screen-Edge Flash */}
      {hud && hud.nitroFlash > 0.05 && (
        <div
          className="pointer-events-none fixed inset-0 border-8 border-cyan-400/75 bg-cyan-500/15"
          style={{ opacity: hud.nitroFlash * 0.68 }}
        />
      )}

      {/* Speed Boost Pad Electric Blue Flash */}
      {hud && hud.boostPadFlash > 0.05 && (
        <div
          className="pointer-events-none fixed inset-0 border-8 border-sky-400/80 bg-sky-400/12"
          style={{ opacity: hud.boostPadFlash * 0.6 }}
        />
      )}

      {/* Floating 3D-Projected Bike Name Tags with Circular Profile Pictures */}
      {hud?.floatingTags.map((tag) => {
        if (!tag.visible) return null;
        const scale = Math.max(0.7, Math.min(1, 1 - tag.distance / 150));
        return (
          <div
            key={tag.id}
            style={{
              transform: `translate3d(${tag.x}px, ${tag.y}px, 0) translate(-50%, -100%) scale(${scale})`,
            }}
            className="pointer-events-none absolute left-0 top-0 flex items-center gap-1.5 rounded-full border border-white/20 bg-[#070b14]/84 py-0.5 pl-1 pr-2 text-[11px] font-semibold text-white whitespace-nowrap"
          >
            <AvatarBadge src={tag.avatar} name={tag.name} size="xs" />
            <span className="font-mono-num text-amber-400">#{tag.positionRank}</span>
            <span>{tag.name}</span>
            {tag.isSpeaking && <Radio className="h-3 w-3 text-emerald-400" />}
          </div>
        );
      })}

      {/* ============================================================
          MOBILE / TOUCH ULTRA-COMPACT TOP HUD (Fits cleanly in landscape)
         ============================================================ */}
      {touchEnabled ? (
        <div
          style={{ zIndex: 9999 }}
          className="pointer-events-none fixed inset-x-2 top-[8px] flex flex-col items-center gap-1"
        >
          <div className="pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-1.5 rounded-xl border border-white/12 bg-[#090d17]/86 px-2.5 py-1">
            {/* Left Compact Telemetry: Pos, Speed, Nitro, Dist, Coins & Health */}
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
              {gameMode !== 'endless' && (
                <>
                  <div className="flex shrink-0 items-baseline gap-0.5">
                    <span className="font-display text-sm font-bold leading-none text-amber-400 sm:text-base">
                      {rankLabel}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      /{hud?.activeRacersCount ?? 5}
                    </span>
                  </div>
                  <div className="h-3.5 w-px shrink-0 bg-white/15" />
                </>
              )}

              <div className="flex shrink-0 items-baseline gap-0.5">
                <span className="font-mono-num text-sm font-bold leading-none text-white sm:text-base">
                  {hud?.speedKmh ?? 0}
                </span>
                <span className="text-[9px] font-semibold text-slate-400">KM/H</span>
              </div>

              <div className="h-3.5 w-px shrink-0 bg-white/15" />

              <div className="flex shrink-0 items-center gap-1">
                <Flame className="h-3 w-3 text-cyan-300" />
                <div className="h-1.5 w-9 overflow-hidden rounded-full bg-slate-800 sm:w-12">
                  <div
                    className={`h-full rounded-full ${
                      hud?.isNitroActive ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${hud?.nitro ?? 0}%` }}
                  />
                </div>
                <span className="font-mono-num text-[10px] font-semibold text-cyan-200">
                  {hud?.nitro ?? 0}%
                </span>
              </div>

              <div className="hidden h-3.5 w-px shrink-0 bg-white/15 sm:block" />

              <div className="hidden shrink-0 items-center gap-1 sm:flex">
                <span className="font-mono-num text-[10px] font-bold text-amber-300">
                  {remainingLabel}
                </span>
              </div>

              <div className="hidden h-3.5 w-px shrink-0 bg-white/15 md:block" />

              <div className="hidden shrink-0 items-center gap-1 text-[10px] font-bold text-amber-300 md:flex">
                <Coins className="h-3 w-3" />
                <span className="font-mono-num">{hud?.coinsCollected ?? 0}</span>
              </div>

              <div className="hidden shrink-0 items-center gap-1 text-[10px] font-bold md:flex">
                <Heart
                  className={`h-3 w-3 ${
                    bikeHealth > 45 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                />
                <span className="font-mono-num text-slate-200">{bikeHealth}%</span>
              </div>
            </div>

            {/* Right Action Icons (Auto Gas, Cam, Voice, SFX, Finish/Exit) */}
            <div className="flex shrink-0 items-center gap-1">
              {gameMode === 'endless' && phase === 'racing' && (
                <button
                  type="button"
                  onClick={onFinishEndlessNow}
                  title="Finish Endless Run & Save Score"
                  className="flex h-7 items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-2 text-[10px] font-bold text-amber-200 whitespace-nowrap cursor-pointer"
                >
                  <Flag className="h-3 w-3" />
                  <span>Finish</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleAutoGas}
                title="Toggle Auto-Gas"
                className={`flex h-7 items-center gap-1 rounded-lg border px-1.5 text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                  autoGas
                    ? 'border-emerald-400/70 bg-emerald-500/25 text-emerald-200'
                    : 'border-white/15 bg-slate-900/85 text-slate-300'
                }`}
              >
                <Gauge className="h-3 w-3" />
                <span className="hidden sm:inline">{autoGas ? 'Auto' : 'Manual'}</span>
              </button>

              <button
                type="button"
                onClick={onCycleCamera}
                title="Switch Camera"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/85 text-white cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={onToggleMic}
                title={micEnabled ? 'Mute Mic' : 'Enable Mic'}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border cursor-pointer ${
                  micEnabled
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/15 bg-slate-900/85 text-slate-200'
                }`}
              >
                {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleSpeaker}
                title={speakerMuted ? 'Unmute Voice' : 'Mute Voice'}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border cursor-pointer ${
                  speakerMuted
                    ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                    : 'border-white/15 bg-slate-900/85 text-slate-200'
                }`}
              >
                {speakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleMasterAudio}
                title="Toggle SFX"
                className="flex h-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/85 px-1.5 text-[10px] font-semibold text-slate-200 cursor-pointer"
              >
                {masterMuted ? 'Mute' : 'SFX'}
              </button>

              <button
                type="button"
                onClick={onToggleTouch}
                title="Switch to Keyboard Mode"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 cursor-pointer"
              >
                <Gamepad2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onExitRace}
                title="Exit to Lobby"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/85 text-slate-200 hover:bg-rose-500/25 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Safe Non-Blocking Portrait Rotation Hint */}
          {showRotateHint && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#090d17]/92 px-3 py-1 text-[11px] font-medium text-amber-200">
              <RotateCw className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>Rotate phone to Landscape for the widest road view</span>
              <button
                type="button"
                onClick={onDismissRotateHint}
                aria-label="Dismiss rotation hint"
                className="ml-1 rounded p-0.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================
           DESKTOP KEYBOARD HUD
           ============================================================ */
        <>
          <div className="flex items-start justify-between gap-3 px-3 pt-[10px] sm:px-4">
            {/* Top-Left: Position, Wheelie, Time, Coins & Health */}
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/12 bg-[#090d17]/88 px-3.5 py-2">
              {gameMode !== 'endless' ? (
                <div>
                  <div className="text-[10px] font-medium uppercase text-slate-400">Position</div>
                  <div className="font-display text-2xl font-bold leading-none text-white">
                    <span className="text-amber-400">{rankLabel}</span>
                    <span className="text-sm font-medium text-slate-400">
                      {' '}
                      / {hud?.activeRacersCount ?? 5}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] font-medium uppercase text-amber-400">Endless</div>
                  <div className="font-mono-num text-xl font-bold leading-none text-white">
                    {remainingLabel}
                  </div>
                </div>
              )}

              <div className="h-8 w-px bg-white/10" />

              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">Time</div>
                <div className="font-mono-num text-base font-bold leading-tight text-white">
                  {formatTime(hud?.elapsedMs ?? 0)}
                </div>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">Coins</div>
                <div className="font-mono-num flex items-center gap-1 text-sm font-bold leading-tight text-amber-300">
                  <Coins className="h-3.5 w-3.5" />
                  <span>{hud?.coinsCollected ?? 0}</span>
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div className="hidden sm:block">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Health</span>
                  <span className="font-mono-num font-bold text-slate-200">{bikeHealth}%</span>
                </div>
                <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      bikeHealth > 50 ? 'bg-emerald-400' : bikeHealth > 25 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${bikeHealth}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Top-Right Controls */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
              {gameMode === 'endless' && phase === 'racing' && (
                <button
                  type="button"
                  onClick={onFinishEndlessNow}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/20 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/30 whitespace-nowrap cursor-pointer"
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>Finish Run</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleAutoGas}
                title="Toggle Optional Auto-Gas"
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                  autoGas
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/15 bg-[#090d17]/88 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Gauge className="h-3.5 w-3.5" />
                <span>{autoGas ? 'Auto Gas: On' : 'Manual Gas'}</span>
              </button>

              <button
                type="button"
                onClick={onCycleCamera}
                title="Switch Camera (C)"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-[#090d17]/88 px-2.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">{camLabel}</span>
              </button>

              <button
                type="button"
                onClick={onToggleMic}
                title={micEnabled ? 'Mute Microphone' : 'Enable Microphone'}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                  micEnabled
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/15 bg-[#090d17]/88 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                {isSpeaking && <span className="hidden text-[11px] sm:inline">Live</span>}
              </button>

              <button
                type="button"
                onClick={onToggleSpeaker}
                title={speakerMuted ? 'Unmute Voice Chat' : 'Mute Voice Chat'}
                className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                  speakerMuted
                    ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                    : 'border-white/15 bg-[#090d17]/88 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {speakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleMasterAudio}
                title="Toggle Master Game Audio"
                className="flex h-9 items-center rounded-lg border border-white/15 bg-[#090d17]/88 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                {masterMuted ? 'Muted' : 'SFX'}
              </button>

              <button
                type="button"
                onClick={onToggleTouch}
                title="Enable On-Screen Touch Controls"
                className="flex h-9 items-center gap-1 rounded-lg border border-white/15 bg-[#090d17]/88 px-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                <Gamepad2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onExitRace}
                title="Return to Garage"
                className="flex h-9 items-center gap-1 rounded-lg border border-white/15 bg-[#090d17]/88 px-2.5 text-xs font-medium text-slate-200 hover:bg-rose-500/25 whitespace-nowrap cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Middle-Right Compact Race Progress & Radar Mini-Map */}
          {phase !== 'lobby' && gameMode !== 'endless' && (
            <div className="pointer-events-none fixed right-4 top-1/2 z-20 flex w-[84px] -translate-y-1/2 flex-col items-center rounded-xl border border-white/12 bg-[#090d17]/88 px-2 py-2.5">
              <div className="font-mono-num text-xs font-bold leading-tight text-amber-400">
                {progressPct}%
              </div>
              <div className="font-mono-num mt-0.5 text-center text-[10px] font-medium leading-tight text-slate-300">
                {remainingLabel}
              </div>

              <div className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                Finish
              </div>

              <div className="relative my-1.5 h-40 w-2 rounded-full bg-slate-800/95">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full bg-amber-500/45"
                  style={{ height: `${Math.max(0, Math.min(100, (hud?.progress ?? 0) * 100))}%` }}
                />
                <div className="absolute -top-0.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-sm bg-white/85" />

                {hud?.standings.map((s) => {
                  if (s.isLocal || s.eliminated) return null;
                  const pct = Math.max(0, Math.min(100, (s.distanceZ / RACE_DISTANCE) * 100));
                  return (
                    <div
                      key={s.id}
                      title={s.name}
                      style={{ bottom: `${pct}%` }}
                      className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border border-slate-950 bg-cyan-400"
                    />
                  );
                })}

                {hud?.police.active && (
                  <div
                    title="Police Pursuit"
                    style={{
                      bottom: `${Math.max(0, Math.min(100, hud.police.progress * 100))}%`,
                      backgroundColor: policeRedPhase ? '#ef4444' : '#3b82f6',
                      borderColor: policeRedPhase ? '#fecaca' : '#bfdbfe',
                    }}
                    className="absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border"
                  />
                )}

                <div
                  title="You"
                  style={{
                    bottom: `${Math.max(0, Math.min(100, (hud?.progress ?? 0) * 100))}%`,
                  }}
                  className="absolute left-1/2 z-20 flex h-4 w-4 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-400 text-slate-950"
                >
                  <ChevronUp className="h-3 w-3 stroke-[3]" />
                </div>
              </div>

              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Start
              </div>
            </div>
          )}

          {/* Desktop Bottom Telemetry Cluster */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-4 rounded-xl border border-white/12 bg-[#090d17]/90 px-5 py-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-num text-3xl font-bold leading-none text-white sm:text-4xl">
                  {hud?.speedKmh ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-400">KM/H</span>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div className="w-24 sm:w-32">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">Gear {hud?.gear ?? 1}</span>
                  <span className="text-cyan-300">
                    {hud?.isWheelie ? 'Wheelie!' : hud?.onFootpath ? 'Shoulder' : 'Road'}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${Math.round((hud?.rpmRatio ?? 0) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div className="w-24 sm:w-32">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 font-semibold text-cyan-300">
                    <Flame className="h-3 w-3" />
                    Nitro
                  </span>
                  <span className="font-mono-num text-slate-200">{hud?.nitro ?? 0}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      hud?.isNitroActive ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${hud?.nitro ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============================================================
          UPPER-CENTER DYNAMIC TELEMETRY STACK:
          - Mode Countdown (Time Trial Checkpoint / Knockout 45s)
          - Active Power-Up Timers (Shield, Magnet)
          - Sharp Turn Warning Chevrons
          - Event Toast & Police Pursuit Banner
         ============================================================ */}
      <div
        className={`pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 ${
          touchEnabled ? 'top-[48px]' : 'top-[72px]'
        }`}
      >
        {/* Mode Specific Timers + Active Power-Ups Row */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {hud?.gameMode === 'timetrial' && phase === 'racing' && (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                hud.checkpointTimerSec <= 10
                  ? 'border-rose-500/70 bg-rose-950/90 text-rose-200'
                  : 'border-cyan-400/50 bg-[#090d17]/88 text-cyan-200'
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>CP #{hud.checkpointIndex}</span>
              <span className="font-mono-num text-amber-300">
                {hud.checkpointTimerSec.toFixed(1)}s
              </span>
            </div>
          )}

          {hud?.gameMode === 'knockout' && phase === 'racing' && (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                hud.knockoutTimerSec <= 10
                  ? 'border-rose-500/70 bg-rose-950/90 text-rose-200'
                  : 'border-amber-400/50 bg-[#090d17]/88 text-amber-200'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>KO in</span>
              <span className="font-mono-num">{hud.knockoutTimerSec.toFixed(1)}s</span>
              <span className="text-slate-400">· {hud.activeRacersCount} left</span>
            </div>
          )}

          {hud && hud.shieldSec > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-sky-400/70 bg-sky-950/90 px-2.5 py-1 text-xs font-bold text-sky-200">
              <Shield className="h-3.5 w-3.5 text-sky-300" />
              <span>Shield</span>
              <span className="font-mono-num">{hud.shieldSec.toFixed(1)}s</span>
            </div>
          )}

          {hud && hud.magnetSec > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-amber-400/70 bg-amber-950/90 px-2.5 py-1 text-xs font-bold text-amber-200">
              <Magnet className="h-3.5 w-3.5 text-amber-300" />
              <span>Magnet</span>
              <span className="font-mono-num">{hud.magnetSec.toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Sharp Curve Warning Chevron Indicator */}
        {hud?.turnWarning && phase === 'racing' && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/80 bg-[#1a1204]/92 px-3 py-1 text-xs font-extrabold tracking-wider text-amber-300 shadow-lg">
            {hud.turnWarning === 'left' ? (
              <>
                <span className="text-sm leading-none">◄◄</span>
                <span>SHARP LEFT</span>
              </>
            ) : (
              <>
                <span>SHARP RIGHT</span>
                <span className="text-sm leading-none">►►</span>
              </>
            )}
          </div>
        )}

        {/* Transient Action / Pickup Event Notice */}
        {hud?.eventNotice && phase === 'racing' && (
          <div className="flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-[#071521]/92 px-3 py-1 text-xs font-bold text-cyan-200 shadow-md">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>{hud.eventNotice}</span>
          </div>
        )}

        {/* City Road Police Pursuit Alert Banner */}
        {hud?.police.active && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/75 bg-[#1a0a10]/92 px-3 py-1 text-white">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <div className="flex items-center gap-2 text-xs">
              <span className="font-display font-bold text-rose-300">Police Pursuit</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num font-bold text-amber-300">
                {hud.police.countdownSec.toFixed(1)}s
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-300">{hud.police.distanceM}m</span>
            </div>
          </div>
        )}

        {hud?.police.escaped && !hud.police.active && (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/90 px-3 py-1 text-xs font-semibold text-emerald-200">
            Police Pursuit Evaded
          </div>
        )}
      </div>

      {/* Live Mini-Leaderboard (Collapsible so mobile landscape road stays completely unobstructed) */}
      {hud && hud.standings.length > 0 && gameMode !== 'endless' && (
        <div
          style={{ zIndex: 9998 }}
          className={`pointer-events-auto fixed left-2 sm:left-4 ${
            touchEnabled ? 'top-[52px]' : 'top-[76px]'
          } w-[148px] sm:w-[190px] rounded-xl border border-white/12 bg-[#090d17]/82 px-2 py-1.5`}
        >
          <button
            type="button"
            onClick={() => setLeaderboardOpen((v) => !v)}
            className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300 cursor-pointer"
          >
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-400" />
              <span>Live Grid</span>
            </span>
            {leaderboardOpen ? (
              <ChevronUp className="h-3 w-3 text-slate-400" />
            ) : (
              <ChevronDown className="h-3 w-3 text-slate-400" />
            )}
          </button>

          {leaderboardOpen && (
            <ul className="mt-1.5 space-y-1">
              {hud.standings.map((row) => (
                <li
                  key={row.id}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] ${
                    row.isLocal
                      ? 'bg-amber-500/20 font-bold text-white'
                      : row.eliminated
                        ? 'text-slate-500 line-through'
                        : 'text-slate-300'
                  }`}
                >
                  <span
                    className={`font-mono-num w-4 shrink-0 text-[10px] font-bold ${
                      row.rank === 1 ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    #{row.rank}
                  </span>
                  <AvatarBadge
                    src={row.avatar}
                    name={row.name}
                    size="xs"
                    highlight={row.isLocal}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Race Start Countdown */}
      {phase === 'countdown' && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center rounded-2xl border border-white/15 bg-[#090d17]/90 px-9 py-5 text-center">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-amber-400/70 bg-white p-0.5">
                <img
                  src="./assets/aistudio/image_74ce4eb9.png"
                  alt="JIT BIKE RACE"
                  className="h-full w-full rounded-full object-contain"
                />
              </div>
              <span className="font-display text-xs font-bold tracking-wider text-white">
                JIT BIKE RACE
              </span>
            </div>
            <div className="text-xs font-medium text-slate-400">Get Ready</div>
            <div className="font-display mt-1 text-6xl font-bold text-amber-400">
              {countdownValue > 0 ? countdownValue : 'GO!'}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MOBILE TOUCH CONTROLS (Mutate controlsRef.current directly)
          Bottom-Left: LEFT / RIGHT Steering
          Bottom-Right: BRAKE, NITRO, WHEELIE & GAS
         ============================================================ */}
      {touchEnabled && phase === 'racing' && (
        <>
          <div
            style={{ zIndex: 9999 }}
            className="pointer-events-auto fixed bottom-[16px] left-[16px] flex items-center gap-3"
          >
            <TouchBtn
              label={<ChevronLeft className="h-8 w-8" />}
              ariaLabel="Steer Left"
              size="steer"
              controlKey="left"
              controlsRef={controlsRef}
            />
            <TouchBtn
              label={<ChevronRight className="h-8 w-8" />}
              ariaLabel="Steer Right"
              size="steer"
              controlKey="right"
              controlsRef={controlsRef}
            />
          </div>

          <div
            style={{ zIndex: 9999 }}
            className="pointer-events-auto fixed bottom-[16px] right-[16px] flex items-end gap-2.5 sm:gap-3.5"
          >
            {/* Secondary Left Column on Right Side: WHEELIE above BRAKE */}
            <div className="flex flex-col items-end gap-2.5">
              <TouchBtn
                label="WHEELIE"
                ariaLabel="Wheelie"
                accent="cyan"
                size="compact"
                controlKey="wheelie"
                controlsRef={controlsRef}
              />
              <TouchBtn
                label="BRAKE"
                ariaLabel="Brake"
                accent="rose"
                size="action"
                controlKey="brake"
                controlsRef={controlsRef}
              />
            </div>

            {/* Primary Right Column: NITRO above GAS */}
            <div className="flex flex-col items-end gap-2.5">
              <TouchBtn
                label={
                  <span className="flex items-center gap-1 leading-tight">
                    <Flame className="h-4 w-4" />
                    <span className="text-[11px]">NITRO</span>
                  </span>
                }
                ariaLabel="Nitro Boost"
                accent="amber"
                size="compact"
                controlKey="nitro"
                controlsRef={controlsRef}
              />
              <TouchBtn
                label={autoGas ? 'GAS (AUTO)' : 'GAS'}
                ariaLabel="Accelerate"
                accent="emerald"
                size="action"
                controlKey="accelerate"
                controlsRef={controlsRef}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface TouchBtnProps {
  label: React.ReactNode;
  ariaLabel: string;
  accent?: 'neutral' | 'amber' | 'rose' | 'emerald' | 'cyan';
  size?: 'steer' | 'action' | 'compact';
  controlKey: keyof ControlInputs;
  controlsRef: React.MutableRefObject<ControlInputs>;
}

const TouchBtn: React.FC<TouchBtnProps> = ({
  label,
  ariaLabel,
  accent = 'neutral',
  size = 'steer',
  controlKey,
  controlsRef,
}) => {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const ref = controlsRef;
    const key = controlKey;
    return () => {
      ref.current[key] = false;
    };
  }, [controlKey, controlsRef]);

  const colorMap: Record<NonNullable<TouchBtnProps['accent']>, string> = {
    neutral: pressed
      ? 'border-white bg-slate-700/95 text-white scale-95'
      : 'border-white/30 bg-[#0b101b]/82 text-slate-100',
    amber: pressed
      ? 'border-amber-300 bg-amber-500 text-slate-950 scale-95'
      : 'border-amber-400/65 bg-[#0b101b]/82 text-amber-300',
    rose: pressed
      ? 'border-rose-300 bg-rose-500 text-white scale-95'
      : 'border-rose-400/65 bg-[#0b101b]/82 text-rose-300',
    emerald: pressed
      ? 'border-emerald-300 bg-emerald-500 text-slate-950 scale-95'
      : 'border-emerald-400/65 bg-[#0b101b]/82 text-emerald-300',
    cyan: pressed
      ? 'border-cyan-300 bg-cyan-500 text-slate-950 scale-95'
      : 'border-cyan-400/65 bg-[#0b101b]/82 text-cyan-200',
  };

  const sizeClass =
    size === 'steer'
      ? 'h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-2xl'
      : size === 'compact'
        ? 'h-11 min-w-[74px] px-2.5 sm:h-12 sm:min-w-[84px] rounded-2xl text-[10px]'
        : 'h-16 min-w-[74px] px-2.5 sm:h-[72px] sm:min-w-[84px] rounded-2xl text-xs';

  const setActive = (active: boolean) => {
    controlsRef.current[controlKey] = active;
    setPressed(active);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        setActive(false);
      }}
      onPointerCancel={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      onTouchStart={(e) => {
        e.stopPropagation();
        setActive(true);
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        setActive(false);
      }}
      onTouchCancel={() => setActive(false)}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      className={`touch-control-btn pointer-events-auto flex items-center justify-center border-2 font-bold transition-transform cursor-pointer ${sizeClass} ${colorMap[accent]}`}
    >
      {label}
    </button>
  );
};

function formatTime(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const tenths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(tenths).padStart(2, '0')}`;
}
