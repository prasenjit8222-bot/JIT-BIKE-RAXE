import React from 'react';
import {
  Check,
  Mic,
  MicOff,
  Play,
  Radio,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BIKE_LIST, TRACK_LIST } from '../data/catalog';
import { BikeId, LobbySlot, TrackId } from '../types/game';

interface GarageLobbyProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedBike: BikeId;
  onSelectBike: (id: BikeId) => void;
  selectedTrack: TrackId;
  onSelectTrack: (id: TrackId) => void;
  roomCode: string;
  onJoinRoom: (code: string, asHost: boolean) => void;
  slots: LobbySlot[];
  connectionStatus: string;
  micEnabled: boolean;
  speakerMuted: boolean;
  isSpeaking: boolean;
  voiceError?: string;
  masterMuted: boolean;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onToggleMasterAudio: () => void;
  onStartRace: () => void;
}

export const GarageLobby: React.FC<GarageLobbyProps> = ({
  playerName,
  onPlayerNameChange,
  selectedBike,
  onSelectBike,
  selectedTrack,
  onSelectTrack,
  roomCode,
  onJoinRoom,
  slots,
  connectionStatus,
  micEnabled,
  speakerMuted,
  isSpeaking,
  voiceError,
  masterMuted,
  onToggleMic,
  onToggleSpeaker,
  onToggleMasterAudio,
  onStartRace,
}) => {
  const [roomInput, setRoomInput] = React.useState(roomCode);
  const [mobileTab, setMobileTab] = React.useState<'garage' | 'track'>('garage');

  const activeBike = BIKE_LIST.find((b) => b.id === selectedBike) ?? BIKE_LIST[0];
  const activeTrack = TRACK_LIST.find((t) => t.id === selectedTrack) ?? TRACK_LIST[0];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Bar: Clean 3-Zone Header */}
      <header className="pointer-events-auto mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0b101b]/90 px-4 py-2.5 sm:px-6">
        <div className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 sm:text-xl">
          APEX VELOCITY GP
        </div>

        <div className="hidden items-center gap-3 text-xs text-slate-300 md:flex">
          <span>5-Player Online Grid</span>
          <span aria-hidden="true">·</span>
          <span>{activeTrack.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num text-amber-400">Room {roomCode}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMic}
            title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              micEnabled
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                : 'border-white/15 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{micEnabled ? (isSpeaking ? 'Speaking' : 'Mic On') : 'Mic Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSpeaker}
            title={speakerMuted ? 'Unmute Voice Chat' : 'Mute Voice Chat'}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              speakerMuted
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                : 'border-white/15 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            {speakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{speakerMuted ? 'Chat Muted' : 'Speaker'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMasterAudio}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800/80 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/80 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {masterMuted ? 'Audio Off' : 'Audio On'}
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher so center 3D bike remains visible */}
      <div className="pointer-events-auto mx-auto mt-2 flex w-full max-w-md items-center gap-1 rounded-lg border border-white/10 bg-[#0b101b]/90 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('garage')}
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            mobileTab === 'garage' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
          }`}
        >
          Rider & Bike
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('track')}
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            mobileTab === 'track' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
          }`}
        >
          Track & Grid
        </button>
      </div>

      {/* Main Side Columns leaving the Center 3D Bike Turntable Clear */}
      <div className="mx-auto my-auto flex w-full max-w-[1400px] flex-1 items-center justify-between gap-4 overflow-hidden py-3">
        {/* Left Column: Rider Name + 4 Superbikes + Stat Bars */}
        <aside
          className={`pointer-events-auto custom-scroll max-h-full w-full flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-[#0b101b]/88 p-4 lg:flex lg:w-[350px] ${
            mobileTab === 'garage' ? 'flex' : 'hidden'
          }`}
        >
          <div>
            <label htmlFor="rider-name-input" className="block text-xs font-medium text-slate-400">
              Rider Name
            </label>
            <input
              id="rider-name-input"
              type="text"
              maxLength={18}
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="Enter racer name"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-amber-400"
            />
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Superbike Garage
              </h2>
              <span className="text-xs text-slate-400">4 Machines</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {BIKE_LIST.map((bike) => {
                const active = bike.id === selectedBike;
                return (
                  <button
                    key={bike.id}
                    type="button"
                    onClick={() => onSelectBike(bike.id)}
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/12'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                        style={{ backgroundColor: bike.primaryColor }}
                      />
                      {active && <Check className="h-3.5 w-3.5 text-amber-400" />}
                    </div>
                    <span className="mt-1.5 font-display text-xs font-bold text-white whitespace-nowrap truncate w-full">
                      {bike.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Bike Stats */}
          <div className="border-t border-white/10 pt-3">
            <div className="font-display text-sm font-bold text-white">{activeBike.name}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{activeBike.tagline}</p>

            <div className="mt-3 space-y-2.5">
              <StatBar label="Top Speed" value={activeBike.stats.topSpeed} accent="#f59e0b" />
              <StatBar label="Acceleration" value={activeBike.stats.acceleration} accent="#06b6d4" />
              <StatBar label="Handling" value={activeBike.stats.handling} accent="#22c55e" />
            </div>
          </div>
        </aside>

        {/* Center Viewport Spacer */}
        <div className="hidden flex-1 lg:block" />

        {/* Right Column: Track Selector + 5-Player Lobby Grid */}
        <aside
          className={`pointer-events-auto custom-scroll max-h-full w-full flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-[#0b101b]/88 p-4 lg:flex lg:w-[365px] ${
            mobileTab === 'track' ? 'flex' : 'hidden'
          }`}
        >
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Select Circuit
              </h2>
              <span className="text-xs text-slate-400">2.6 km Sprint</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {TRACK_LIST.map((track) => {
                const active = track.id === selectedTrack;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onSelectTrack(track.id)}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/12'
                        : 'border-white/10 bg-slate-900/60 hover:border-white/25'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ background: track.previewGradient }}
                        />
                        <span className="font-display text-xs font-bold text-white whitespace-nowrap">
                          {track.name}
                        </span>
                        {track.hasPoliceChase && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 whitespace-nowrap">
                            <ShieldAlert className="h-3 w-3" />
                            Police Pursuit
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {track.subtitle}
                      </p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-Player Room & Starting Grid */}
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span>5-Player Grid</span>
              </div>
              <span className="text-[11px] text-slate-400">{connectionStatus}</span>
            </div>

            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                maxLength={8}
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                aria-label="Room Code"
                className="font-mono-num min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-900/90 px-2.5 py-1.5 text-xs text-white uppercase outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => onJoinRoom(roomInput, true)}
                className="rounded-lg border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Host
              </button>
              <button
                type="button"
                onClick={() => onJoinRoom(roomInput, false)}
                className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/30 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Join
              </button>
            </div>

            {voiceError && (
              <p className="mt-1.5 text-[11px] text-rose-300">{voiceError}</p>
            )}

            <ul className="mt-2.5 space-y-1">
              {slots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center justify-between rounded-md bg-slate-900/75 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono-num text-[11px] text-slate-400">
                      0{slot.slotIndex + 1}
                    </span>
                    <span className="truncate font-medium text-white">
                      {slot.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
                    {slot.isSpeaking && (
                      <Radio className="h-3 w-3 text-emerald-400" />
                    )}
                    <span>{slot.isLocal ? 'You' : slot.isHuman ? 'Online' : 'AI'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Bottom Launch Bar */}
      <footer className="pointer-events-auto mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b101b]/90 px-4 py-3 sm:px-6">
        <div className="hidden items-center gap-3 text-xs text-slate-400 sm:flex">
          <span>W/Up: Throttle</span>
          <span aria-hidden="true">·</span>
          <span>A/D: Lean & Steer</span>
          <span aria-hidden="true">·</span>
          <span>Shift/Space: Nitro</span>
          <span aria-hidden="true">·</span>
          <span>E: Wheelie</span>
          <span aria-hidden="true">·</span>
          <span>C: Camera</span>
        </div>

        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">{activeBike.name}</span>
            <span className="mx-1.5 text-slate-500">·</span>
            <span>{activeTrack.name}</span>
          </div>

          <button
            type="button"
            onClick={onStartRace}
            className="font-display flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold tracking-wide text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Race</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div>
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono-num font-semibold text-white">{value}</span>
    </div>
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${value}%`, backgroundColor: accent }}
      />
    </div>
  </div>
);
