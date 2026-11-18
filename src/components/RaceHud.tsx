import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flame,
  Gamepad2,
  LogOut,
  Mic,
  MicOff,
  Radio,
  RotateCw,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { RACE_DISTANCE } from '../data/catalog';
import { CameraMode, ControlInputs, GamePhase, HudSnapshot } from '../types/game';

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
  onTouchInput: (key: keyof ControlInputs, active: boolean) => void;
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
  onTouchInput,
  onExitRace,
  showRotateHint,
  onDismissRotateHint,
}) => {
  const rankIdx = Math.max(0, Math.min(4, (hud?.positionRank ?? 1) - 1));
  const rankLabel = RANK_ORDINAL[rankIdx];

  const camLabel =
    cameraMode === 'far' ? 'Full View' : cameraMode === 'close' ? 'Chase Cam' : 'Cockpit';

  const remainingM = hud?.remainingMeters ?? RACE_DISTANCE;
  const remainingLabel =
    remainingM >= 1000 ? `${(remainingM / 1000).toFixed(1)} km left` : `${remainingM} m left`;
  const progressPct = Math.round((hud?.progress ?? 0) * 100);
  const policeRedPhase = Math.floor((hud?.elapsedMs ?? 0) / 220) % 2 === 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none">
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
          style={{ opacity: hud.nitroFlash * 0.7 }}
        />
      )}

      {/* Floating 3D-Projected Bike Name Tags */}
      {hud?.floatingTags.map((tag) => {
        if (!tag.visible) return null;
        const scale = Math.max(0.72, Math.min(1, 1 - tag.distance / 150));
        return (
          <div
            key={tag.id}
            style={{
              transform: `translate3d(${tag.x}px, ${tag.y}px, 0) translate(-50%, -100%) scale(${scale})`,
            }}
            className="pointer-events-none absolute left-0 top-0 flex items-center gap-1.5 rounded border border-white/15 bg-[#070b14]/80 px-2 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap"
          >
            <span className="font-mono-num text-amber-400">#{tag.positionRank}</span>
            <span>{tag.name}</span>
            {tag.isSpeaking && <Radio className="h-3 w-3 text-emerald-400" />}
          </div>
        );
      })}

      {/* ============================================================
          MOBILE / TOUCH MODE HEADER HUD (Pinned cleanly at top: 10px)
         ============================================================ */}
      {touchEnabled ? (
        <div className="pointer-events-none fixed inset-x-2.5 top-[10px] z-30 flex flex-col items-center gap-1.5 sm:inset-x-4">
          <div className="pointer-events-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl border border-white/12 bg-[#090d17]/82 px-3 py-1.5">
            {/* Rank, Time, Speed & Nitro */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-base font-bold leading-none text-amber-400 sm:text-lg">
                  {rankLabel}
                </span>
                <span className="text-[11px] font-medium text-slate-400">/5</span>
              </div>

              <div className="h-4 w-px bg-white/15" />

              <div className="flex items-baseline gap-1">
                <span className="font-mono-num text-base font-bold leading-none text-white sm:text-lg">
                  {hud?.speedKmh ?? 0}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">KM/H</span>
              </div>

              <div className="h-4 w-px bg-white/15" />

              <div className="flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-cyan-300" />
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800 sm:w-16">
                  <div
                    className={`h-full rounded-full ${
                      hud?.isNitroActive ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${hud?.nitro ?? 0}%` }}
                  />
                </div>
                <span className="font-mono-num text-[11px] font-semibold text-cyan-200">
                  {hud?.nitro ?? 0}%
                </span>
              </div>

              <span className="hidden font-mono-num text-[11px] text-slate-300 md:inline">
                {formatTime(hud?.elapsedMs ?? 0)}
              </span>
            </div>

            {/* Compact Horizontal Mini-Map inside Top Bar */}
            <div className="order-3 flex w-full items-center gap-2 sm:order-2 sm:w-auto sm:min-w-[190px] sm:flex-1 sm:max-w-[260px]">
              <span className="font-mono-num text-[10px] font-bold text-amber-400 whitespace-nowrap">
                {progressPct}%
              </span>
              <div className="relative h-2 flex-1 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-500/45"
                  style={{ width: `${Math.max(0, Math.min(100, (hud?.progress ?? 0) * 100))}%` }}
                />
                {hud?.standings.map((s) => {
                  if (s.isLocal) return null;
                  const pct = Math.max(0, Math.min(100, (s.distanceZ / RACE_DISTANCE) * 100));
                  return (
                    <div
                      key={s.id}
                      style={{ left: `${pct}%` }}
                      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950 bg-cyan-400"
                    />
                  );
                })}
                {hud?.police.active && (
                  <div
                    style={{
                      left: `${Math.max(0, Math.min(100, hud.police.progress * 100))}%`,
                      backgroundColor: policeRedPhase ? '#ef4444' : '#3b82f6',
                    }}
                    className="absolute top-1/2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
                  />
                )}
                <div
                  style={{ left: `${Math.max(0, Math.min(100, (hud?.progress ?? 0) * 100))}%` }}
                  className="absolute top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-amber-400"
                />
              </div>
              <span className="font-mono-num text-[10px] font-medium text-slate-300 whitespace-nowrap">
                {remainingLabel}
              </span>
            </div>

            {/* Voice Chat, Camera, Touch & Exit Controls */}
            <div className="order-2 flex items-center gap-1 sm:order-3">
              <button
                type="button"
                onClick={onCycleCamera}
                title="Switch Camera"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-white cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={onToggleMic}
                title={micEnabled ? 'Mute Microphone' : 'Enable Microphone'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                  micEnabled
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/15 bg-slate-900/80 text-slate-200'
                }`}
              >
                {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleSpeaker}
                title={speakerMuted ? 'Unmute Voice Chat' : 'Mute Voice Chat'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                  speakerMuted
                    ? 'border-rose-500/50 bg-rose-500/20 text-rose-200'
                    : 'border-white/15 bg-slate-900/80 text-slate-200'
                }`}
              >
                {speakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onToggleMasterAudio}
                title="Toggle Audio"
                className="flex h-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 px-2 text-[10px] font-semibold text-slate-200 cursor-pointer"
              >
                {masterMuted ? 'Mute' : 'SFX'}
              </button>

              <button
                type="button"
                onClick={onToggleTouch}
                title="Switch to Keyboard Mode"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 cursor-pointer"
              >
                <Gamepad2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onExitRace}
                title="Exit to Garage"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900/80 text-slate-200 hover:bg-rose-500/25 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Safe Fallback Landscape Rotation Prompt (non-blocking) */}
          {showRotateHint && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#090d17]/90 px-3 py-1 text-[11px] font-medium text-amber-200">
              <RotateCw className="h-3.5 w-3.5 text-amber-400 shrink-0" />
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
            {/* Top-Left: Position, Wheelie & Elapsed Time */}
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/12 bg-[#090d17]/88 px-3.5 py-2">
              <div>
                <div className="text-[11px] font-medium text-slate-400">Position</div>
                <div className="font-display text-2xl font-bold leading-none text-white">
                  <span className="text-amber-400">{rankLabel}</span>
                  <span className="text-sm font-medium text-slate-400"> / 5</span>
                </div>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div>
                <div className="text-[11px] font-medium text-slate-400">Wheelie</div>
                <div className="font-mono-num text-base font-bold leading-tight text-cyan-300">
                  {hud?.wheelieScore ?? 0}
                </div>
              </div>

              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div className="hidden sm:block">
                <div className="text-[11px] font-medium text-slate-400">Time</div>
                <div className="font-mono-num text-base font-bold leading-tight text-white">
                  {formatTime(hud?.elapsedMs ?? 0)}
                </div>
              </div>
            </div>

            {/* Top-Right: Camera, Voice Chat, Master Audio, Touch Toggle & Exit */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
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

          {/* Middle-Right Compact Race Progress & Player Radar Mini-Map */}
          {phase !== 'lobby' && (
            <div className="pointer-events-none fixed right-4 top-1/2 z-20 flex w-[82px] -translate-y-1/2 flex-col items-center rounded-xl border border-white/12 bg-[#090d17]/88 px-2 py-2.5">
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
                  if (s.isLocal) return null;
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
                    {hud?.isWheelie ? 'Wheelie!' : hud?.onFootpath ? 'Footpath' : 'Road'}
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

      {/* City Road Police Pursuit Alert Banner (clear below top header) */}
      {hud?.police.active && (
        <div
          className={`mx-auto flex w-fit items-center gap-2.5 rounded-xl border border-rose-500/70 bg-[#1a0a10]/90 px-3.5 py-1.5 text-white ${
            touchEnabled ? 'mt-[92px] sm:mt-[58px]' : 'mt-2'
          }`}
        >
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
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
        <div
          className={`mx-auto flex w-fit items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/90 px-3.5 py-1 text-xs font-semibold text-emerald-200 ${
            touchEnabled ? 'mt-[92px] sm:mt-[58px]' : 'mt-2'
          }`}
        >
          Police Pursuit Evaded
        </div>
      )}

      {/* Race Start Countdown */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center rounded-2xl border border-white/15 bg-[#090d17]/90 px-10 py-6 text-center">
            <div className="mb-2 flex items-center gap-2">
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
          MOBILE TOUCH CONTROLS (Auto-Accelerate Active)
          Bottom-Left: LEFT / RIGHT Steering (bottom: 20px, left: 20px)
          Bottom-Right: BRAKE / NITRO Action (bottom: 20px, right: 20px)
         ============================================================ */}
      {touchEnabled && phase === 'racing' && (
        <>
          <div className="pointer-events-auto fixed bottom-[20px] left-[20px] z-30 flex items-center gap-3.5">
            <TouchBtn
              label={<ChevronLeft className="h-8 w-8" />}
              ariaLabel="Steer Left"
              size="steer"
              onChange={(active) => onTouchInput('left', active)}
            />
            <TouchBtn
              label={<ChevronRight className="h-8 w-8" />}
              ariaLabel="Steer Right"
              size="steer"
              onChange={(active) => onTouchInput('right', active)}
            />
          </div>

          <div className="pointer-events-auto fixed bottom-[20px] right-[20px] z-30 flex items-center gap-4 sm:gap-5">
            <TouchBtn
              label="BRAKE"
              ariaLabel="Brake"
              accent="rose"
              size="action"
              onChange={(active) => onTouchInput('brake', active)}
            />
            <TouchBtn
              label={
                <span className="flex flex-col items-center leading-tight">
                  <Flame className="h-5 w-5" />
                  <span className="mt-0.5 text-[11px]">NITRO</span>
                </span>
              }
              ariaLabel="Nitro Boost"
              accent="amber"
              size="action"
              onChange={(active) => onTouchInput('nitro', active)}
            />
          </div>
        </>
      )}
    </div>
  );
};

interface TouchBtnProps {
  label: React.ReactNode;
  ariaLabel: string;
  accent?: 'neutral' | 'amber' | 'rose';
  size?: 'steer' | 'action';
  onChange: (active: boolean) => void;
}

const TouchBtn: React.FC<TouchBtnProps> = ({
  label,
  ariaLabel,
  accent = 'neutral',
  size = 'steer',
  onChange,
}) => {
  const [pressed, setPressed] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pointerIdRef.current !== null) {
        onChange(false);
      }
    };
  }, [onChange]);

  const colorMap: Record<NonNullable<TouchBtnProps['accent']>, string> = {
    neutral: pressed
      ? 'border-white bg-slate-700/95 text-white scale-95'
      : 'border-white/30 bg-[#0b101b]/80 text-slate-100',
    amber: pressed
      ? 'border-amber-300 bg-amber-500 text-slate-950 scale-95'
      : 'border-amber-400/60 bg-[#0b101b]/80 text-amber-300',
    rose: pressed
      ? 'border-rose-300 bg-rose-500 text-white scale-95'
      : 'border-rose-400/60 bg-[#0b101b]/80 text-rose-300',
  };

  const sizeClass =
    size === 'steer'
      ? 'h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-2xl'
      : 'h-16 min-w-[78px] px-4 sm:h-[72px] sm:min-w-[88px] rounded-2xl';

  const releasePointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current === e.pointerId) {
      pointerIdRef.current = null;
      setPressed(false);
      onChange(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore if capture unsupported
        }
        setPressed(true);
        onChange(true);
      }}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onLostPointerCapture={releasePointer}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      className={`touch-control-btn flex items-center justify-center border-2 text-xs font-bold transition-transform ${sizeClass} ${colorMap[accent]}`}
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
