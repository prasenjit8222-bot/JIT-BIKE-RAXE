import React from 'react';
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
  ShieldAlert,
  Volume2,
  VolumeX,
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
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
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
            className="pointer-events-none absolute left-0 top-0 flex items-center gap-1.5 rounded bg-[#070b14]/80 px-2 py-0.5 text-[11px] font-semibold text-white border border-white/15 whitespace-nowrap"
          >
            <span className="font-mono-num text-amber-400">#{tag.positionRank}</span>
            <span>{tag.name}</span>
            {tag.isSpeaking && <Radio className="h-3 w-3 text-emerald-400" />}
          </div>
        );
      })}

      {/* Top HUD Strip */}
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
        {/* Top-Left: Position & Elapsed Time */}
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
            title="Toggle On-Screen Touch Controls"
            className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
              touchEnabled
                ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                : 'border-white/15 bg-[#090d17]/88 text-slate-300 hover:bg-slate-800'
            }`}
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

      {/* City Road Police Pursuit Alert Banner */}
      {hud?.police.active && (
        <div className="mx-auto mt-1 flex w-fit items-center gap-3 rounded-xl border border-rose-500/70 bg-[#1a0a10]/92 px-4 py-2 text-white">
          <ShieldAlert className="h-5 w-5 text-rose-400" />
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="font-display font-bold text-rose-300">
              Police Pursuit · Wanted
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num font-bold text-amber-300">
              Outrun {hud.police.countdownSec.toFixed(1)}s
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-xs text-slate-300">
              {hud.police.distanceM}m behind
            </span>
          </div>
        </div>
      )}

      {hud?.police.escaped && !hud.police.active && (
        <div className="mx-auto mt-1 flex w-fit items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/90 px-4 py-1.5 text-xs font-semibold text-emerald-200">
          Police Pursuit Evaded
        </div>
      )}

      {/* Middle-Right Compact Race Progress & Player Radar Mini-Map */}
      {phase !== 'lobby' && (
        <div
          className={`pointer-events-none fixed right-3 z-20 flex w-[74px] flex-col items-center rounded-xl border border-white/12 bg-[#090d17]/88 px-2 py-2.5 sm:right-4 sm:w-[82px] ${
            touchEnabled ? 'top-[38%] -translate-y-1/2' : 'top-1/2 -translate-y-1/2'
          }`}
        >
          <div className="font-mono-num text-xs font-bold leading-tight text-amber-400">
            {progressPct}%
          </div>
          <div className="font-mono-num mt-0.5 text-center text-[10px] font-medium leading-tight text-slate-300">
            {remainingLabel}
          </div>

          <div className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Finish
          </div>

          <div className="relative my-1.5 h-32 w-2 rounded-full bg-slate-800/95 sm:h-40">
            {/* Completed progress fill from Start (bottom) */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full bg-amber-500/45"
              style={{ height: `${Math.max(0, Math.min(100, (hud?.progress ?? 0) * 100))}%` }}
            />

            {/* Finish line marker at top */}
            <div className="absolute -top-0.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-sm bg-white/85" />

            {/* Rival racer dots */}
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

            {/* Active Police pursuit dot (flashing red/blue) */}
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

            {/* Local player highlighted arrow/dot */}
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

      {/* Race Start Countdown */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/15 bg-[#090d17]/90 px-10 py-6 text-center">
            <div className="text-xs font-medium text-slate-400">Get Ready</div>
            <div className="font-display mt-1 text-6xl font-bold text-amber-400">
              {countdownValue > 0 ? countdownValue : 'GO!'}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Telemetry Cluster (Speedometer, Nitro Bar, Status) */}
      <div
        className={`fixed bottom-3 left-1/2 -translate-x-1/2 transition-transform ${
          touchEnabled ? 'bottom-32 sm:bottom-5' : 'bottom-4'
        }`}
      >
        <div className="flex items-center gap-4 rounded-xl border border-white/12 bg-[#090d17]/90 px-5 py-2.5">
          {/* Speedometer */}
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono-num text-3xl font-bold leading-none text-white sm:text-4xl">
              {hud?.speedKmh ?? 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">KM/H</span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          {/* Gear & RPM Bar */}
          <div className="w-24 sm:w-32">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-300">
                Gear {hud?.gear ?? 1}
              </span>
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

          {/* Nitro Meter */}
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

      {/* Responsive Mobile Touch Controls */}
      {touchEnabled && phase === 'racing' && (
        <>
          {/* Bottom-Left: Steer Left / Right */}
          <div className="pointer-events-auto fixed bottom-4 left-4 flex items-center gap-3">
            <TouchBtn
              label={<ChevronLeft className="h-7 w-7" />}
              ariaLabel="Steer Left"
              onChange={(active) => onTouchInput('left', active)}
            />
            <TouchBtn
              label={<ChevronRight className="h-7 w-7" />}
              ariaLabel="Steer Right"
              onChange={(active) => onTouchInput('right', active)}
            />
          </div>

          {/* Bottom-Right: Brake, Wheelie, Nitro, Accelerate */}
          <div className="pointer-events-auto fixed bottom-4 right-4 grid grid-cols-2 gap-2.5">
            <TouchBtn
              label="Wheelie"
              ariaLabel="Wheelie"
              accent="cyan"
              onChange={(active) => onTouchInput('wheelie', active)}
            />
            <TouchBtn
              label="Nitro"
              ariaLabel="Nitro Boost"
              accent="amber"
              onChange={(active) => onTouchInput('nitro', active)}
            />
            <TouchBtn
              label="Brake"
              ariaLabel="Brake"
              accent="rose"
              onChange={(active) => onTouchInput('brake', active)}
            />
            <TouchBtn
              label="Gas"
              ariaLabel="Accelerate"
              accent="emerald"
              onChange={(active) => onTouchInput('accelerate', active)}
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
  accent?: 'neutral' | 'amber' | 'cyan' | 'emerald' | 'rose';
  onChange: (active: boolean) => void;
}

const TouchBtn: React.FC<TouchBtnProps> = ({
  label,
  ariaLabel,
  accent = 'neutral',
  onChange,
}) => {
  const [pressed, setPressed] = React.useState(false);

  const colorMap: Record<NonNullable<TouchBtnProps['accent']>, string> = {
    neutral: pressed ? 'border-white bg-slate-700' : 'border-white/25 bg-[#0b101b]/88',
    amber: pressed ? 'border-amber-300 bg-amber-500 text-slate-950' : 'border-amber-400/50 bg-[#0b101b]/88 text-amber-300',
    cyan: pressed ? 'border-cyan-300 bg-cyan-500 text-slate-950' : 'border-cyan-400/50 bg-[#0b101b]/88 text-cyan-300',
    emerald: pressed ? 'border-emerald-300 bg-emerald-500 text-slate-950' : 'border-emerald-400/50 bg-[#0b101b]/88 text-emerald-300',
    rose: pressed ? 'border-rose-300 bg-rose-500 text-white' : 'border-rose-400/50 bg-[#0b101b]/88 text-rose-300',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setPressed(true);
        onChange(true);
      }}
      onPointerUp={() => {
        setPressed(false);
        onChange(false);
      }}
      onPointerCancel={() => {
        setPressed(false);
        onChange(false);
      }}
      className={`flex h-14 min-w-14 items-center justify-center rounded-xl border px-3 text-xs font-bold select-none touch-none transition-colors ${colorMap[accent]}`}
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
