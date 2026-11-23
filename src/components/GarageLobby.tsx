import React, { useEffect, useState } from 'react';
import {
  Check,
  CloudFog,
  CloudRain,
  Coins,
  Copy,
  KeyRound,
  Lock,
  Mic,
  MicOff,
  Moon,
  Pencil,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import {
  BIKE_LIST,
  computeEffectiveBikePhysics,
  GAME_MODE_LIST,
  PAINT_COLORS,
  TRACK_LIST,
  WEATHER_MODE_LIST,
} from '../data/catalog';
import {
  BikeId,
  GameMode,
  LobbySlot,
  TrackId,
  UserProfile,
  WeatherMode,
} from '../types/game';
import { getBikeCustomization } from '../utils/profileStorage';
import { AvatarBadge } from './AvatarBadge';

interface GarageLobbyProps {
  profile: UserProfile;
  onOpenProfile: () => void;
  onOpenGarage: () => void;
  onOpenLeaderboard: () => void;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedBike: BikeId;
  onSelectBike: (id: BikeId) => void;
  selectedTrack: TrackId;
  onSelectTrack: (id: TrackId) => void;
  gameMode: GameMode;
  onSelectGameMode: (mode: GameMode) => void;
  weatherMode: WeatherMode;
  onSelectWeatherMode: (weather: WeatherMode) => void;
  roomCode: string;
  onCreatePrivateRoom: () => void;
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
  profile,
  onOpenProfile,
  onOpenGarage,
  onOpenLeaderboard,
  playerName,
  onPlayerNameChange,
  selectedBike,
  onSelectBike,
  selectedTrack,
  onSelectTrack,
  gameMode,
  onSelectGameMode,
  weatherMode,
  onSelectWeatherMode,
  roomCode,
  onCreatePrivateRoom,
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
  const [roomInput, setRoomInput] = useState(roomCode);
  const [copiedCode, setCopiedCode] = useState(false);
  const [mobileTab, setMobileTab] = useState<'garage' | 'track'>('garage');

  useEffect(() => {
    setRoomInput(roomCode);
  }, [roomCode]);

  const activeBike = BIKE_LIST.find((b) => b.id === selectedBike) ?? BIKE_LIST[0];
  const activeTrack = TRACK_LIST.find((t) => t.id === selectedTrack) ?? TRACK_LIST[0];
  const activeMode = GAME_MODE_LIST.find((m) => m.id === gameMode) ?? GAME_MODE_LIST[0];
  const activeCustom = getBikeCustomization(profile, activeBike.id);
  const effective = computeEffectiveBikePhysics(activeBike.id, activeCustom);
  const totalUpgradeLevels =
    activeCustom.upgrades.engine + activeCustom.upgrades.handling + activeCustom.upgrades.nitro;

  const handleCopyRoomCode = () => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(roomCode).catch(() => {});
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  return (
    <div
      style={{ zIndex: 9999 }}
      className="pointer-events-none fixed inset-0 flex flex-col justify-between p-2.5 sm:p-4"
    >
      {/* Top Bar: Profile Badge (Top-Left) + JIT Branding + Garage / Leaderboard + Voice/Audio */}
      <header className="pointer-events-auto mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b101b]/92 px-2.5 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Top-Left Clickable Profile Badge */}
          <button
            type="button"
            onClick={onOpenProfile}
            title="Open My Profile"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-slate-900/90 py-1 pl-1.5 pr-2.5 text-left transition-colors hover:border-amber-400/60 hover:bg-slate-800/90 cursor-pointer"
          >
            <AvatarBadge src={profile.avatar} name={profile.name} size="md" highlight />
            <div className="min-w-0 max-w-[100px] sm:max-w-[135px]">
              <div className="flex items-center gap-1">
                <span className="truncate text-xs font-bold leading-tight text-white">
                  {profile.name}
                </span>
                <Pencil className="h-2.5 w-2.5 shrink-0 text-slate-400" />
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                <Coins className="h-3 w-3 shrink-0" />
                <span className="font-mono-num leading-none">{profile.coins}</span>
              </div>
            </div>
          </button>

          <div className="hidden h-7 w-px bg-white/10 sm:block" />

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/75 bg-white p-0.5 shadow-md sm:h-9 sm:w-9">
              <img
                src="./assets/aistudio/image_74ce4eb9.png"
                alt="JIT BIKE RACE Logo"
                className="h-full w-full rounded-full object-contain"
              />
            </div>
            <div className="hidden font-display text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 lg:block">
              JIT BIKE RACE
            </div>
          </div>
        </div>

        {/* Center Quick Action Buttons: Garage & Leaderboard */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenGarage}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-400/55 bg-amber-500/20 px-2.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/30 whitespace-nowrap shrink-0 cursor-pointer sm:px-3.5"
          >
            <Wrench className="h-3.5 w-3.5 text-amber-400" />
            <span>Garage</span>
            <span className="font-mono-num hidden rounded bg-slate-950/75 px-1.5 py-0.5 text-[10px] text-amber-300 sm:inline">
              {profile.unlockedBikes.length}/5
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800/85 px-2.5 text-xs font-semibold text-slate-100 transition-colors hover:border-amber-400/40 hover:bg-slate-700/85 whitespace-nowrap shrink-0 cursor-pointer sm:px-3"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
        </div>

        {/* Right Voice & Master Audio Controls */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMic}
            title={micEnabled ? 'Turn Microphone Off' : 'Turn Microphone On'}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              micEnabled
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                : 'border-white/15 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">
              {micEnabled ? (isSpeaking ? 'Speaking' : 'Mic On') : 'Mic Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleSpeaker}
            title={speakerMuted ? 'Unmute Voice Chat' : 'Mute Voice Chat'}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              speakerMuted
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                : 'border-white/15 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            {speakerMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={onToggleMasterAudio}
            className="flex h-9 items-center rounded-lg border border-white/15 bg-slate-800/80 px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/80 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {masterMuted ? 'Mute' : 'SFX'}
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher so center 3D bike remains clearly inspectable */}
      <div className="pointer-events-auto mx-auto mt-2 flex w-full max-w-md items-center gap-1 rounded-lg border border-white/10 bg-[#0b101b]/92 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('garage')}
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mobileTab === 'garage' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
          }`}
        >
          Rider, Bike &amp; Mode
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('track')}
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mobileTab === 'track' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
          }`}
        >
          Track, Weather &amp; Room
        </button>
      </div>

      {/* Main Side Columns leaving the Center 3D Bike Turntable Clear */}
      <div className="mx-auto my-auto flex w-full max-w-[1440px] flex-1 items-center justify-between gap-4 overflow-hidden py-2.5">
        {/* Left Column: Rider Name + 5 Superbikes + Tuned Stats + Game Mode Selector */}
        <aside
          className={`pointer-events-auto custom-scroll max-h-full w-full flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-[#0b101b]/90 p-3.5 lg:flex lg:w-[355px] ${
            mobileTab === 'garage' ? 'flex' : 'hidden'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="rider-name-input" className="block text-xs font-medium text-slate-400">
                Rider Name
              </label>
              <button
                type="button"
                onClick={onOpenProfile}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Edit Photo &amp; Profile
              </button>
            </div>
            <input
              id="rider-name-input"
              type="text"
              maxLength={18}
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="Enter racer name"
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/90 px-3 py-1.5 text-sm font-medium text-white outline-none transition-colors focus:border-amber-400"
            />
          </div>

          {/* 5 Superbikes Quick Picker + Full Garage Shortcut */}
          <div className="border-t border-white/10 pt-2.5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Superbikes ({profile.unlockedBikes.length}/5)
              </h2>
              <button
                type="button"
                onClick={onOpenGarage}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                <Wrench className="h-3 w-3" />
                <span>Upgrade &amp; Paint</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {BIKE_LIST.map((bike) => {
                const active = bike.id === selectedBike;
                const unlocked = profile.unlockedBikes.includes(bike.id);
                const custom = getBikeCustomization(profile, bike.id);
                const paint = PAINT_COLORS[custom.paintId] ?? PAINT_COLORS[bike.defaultPaint];
                return (
                  <button
                    key={bike.id}
                    type="button"
                    onClick={() => (unlocked ? onSelectBike(bike.id) : onOpenGarage())}
                    className={`flex flex-col items-start rounded-lg border p-2 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/14'
                        : unlocked
                          ? 'border-white/10 bg-slate-900/65 hover:border-white/25'
                          : 'border-white/10 bg-slate-950/65 opacity-80 hover:border-amber-400/40'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-white/25"
                        style={{ backgroundColor: paint.hex }}
                      />
                      {active ? (
                        <Check className="h-3.5 w-3.5 text-amber-400" />
                      ) : !unlocked ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                          <Lock className="h-2.5 w-2.5" />
                          <span className="font-mono-num">{bike.unlockCost}</span>
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-1 w-full truncate font-display text-[11px] font-bold text-white">
                      {bike.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Machine Effective Specs */}
          <div className="border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-display truncate text-xs font-bold text-white">
                {activeBike.name}
              </div>
              <span className="font-mono-num shrink-0 text-[10px] font-semibold text-amber-300">
                Tune Lv.{totalUpgradeLevels}/15
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <StatBar label="Top Speed" value={effective.displayStats.topSpeed} accent="#f59e0b" />
              <StatBar label="Acceleration" value={effective.displayStats.acceleration} accent="#06b6d4" />
              <StatBar label="Handling" value={effective.displayStats.handling} accent="#22c55e" />
            </div>
          </div>

          {/* 4 Game Modes Selector */}
          <div className="border-t border-white/10 pt-2.5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Game Mode
              </h2>
              <span className="text-[11px] text-amber-300">{activeMode.badge}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {GAME_MODE_LIST.map((mode) => {
                const active = mode.id === gameMode;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onSelectGameMode(mode.id)}
                    className={`rounded-lg border p-2 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/14'
                        : 'border-white/10 bg-slate-900/65 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-[11px] font-bold text-white truncate">
                        {mode.name}
                      </span>
                      {active && <Check className="h-3 w-3 shrink-0 text-amber-400" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400">
                      {mode.shortDesc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Viewport Spacer */}
        <div className="hidden flex-1 lg:block" />

        {/* Right Column: Track Selector + Weather Selector + Private Room & 5-Player Grid */}
        <aside
          className={`pointer-events-auto custom-scroll max-h-full w-full flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-[#0b101b]/90 p-3.5 lg:flex lg:w-[370px] ${
            mobileTab === 'track' ? 'flex' : 'hidden'
          }`}
        >
          {/* 4 Extended Curved Tracks */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Select Circuit
              </h2>
              <span className="text-[11px] text-slate-400">
                {gameMode === 'endless' ? 'Infinite Highway' : '10.8 km · ~3 Min Curves'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {TRACK_LIST.map((track) => {
                const active = track.id === selectedTrack;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onSelectTrack(track.id)}
                    className={`flex items-center justify-between gap-2.5 rounded-lg border p-2 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/14'
                        : 'border-white/10 bg-slate-900/65 hover:border-white/25'
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 whitespace-nowrap">
                            <ShieldAlert className="h-3 w-3" />
                            Police
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

          {/* Weather & Time of Day Selector */}
          <div className="border-t border-white/10 pt-2.5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                Weather &amp; Time
              </h2>
              <span className="text-[11px] text-slate-400">Live Lighting</span>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {WEATHER_MODE_LIST.map((w) => {
                const active = w.id === weatherMode;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSelectWeatherMode(w.id)}
                    title={w.detail}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/18 text-amber-200'
                        : 'border-white/10 bg-slate-900/70 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <WeatherIcon mode={w.id} />
                    <span>{w.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Private Room Code & 5-Player Grid */}
          <div className="border-t border-white/10 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span>Multiplayer Room</span>
              </div>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                title="Copy 4-digit room code"
                className="flex items-center gap-1 rounded border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 cursor-pointer"
              >
                <span className="font-mono-num">#{roomCode}</span>
                <Copy className="h-3 w-3" />
                {copiedCode && <span className="text-[10px] text-emerald-300">Copied</span>}
              </button>
            </div>

            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={onCreatePrivateRoom}
                className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <KeyRound className="h-3 w-3" />
                <span>Create Private</span>
              </button>
              <input
                type="text"
                maxLength={8}
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="4-DIGIT"
                aria-label="Room Code"
                className="font-mono-num min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-900/90 px-2 py-1.5 text-xs text-white uppercase outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => onJoinRoom(roomInput, false)}
                className="rounded-lg border border-amber-400/45 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Join Room
              </button>
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>{connectionStatus}</span>
              {voiceError && <span className="text-rose-300">{voiceError}</span>}
            </div>

            <ul className="mt-2 space-y-1">
              {slots.map((slot) => (
                <li
                  key={slot.id}
                  className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                    slot.isLocal
                      ? 'border border-amber-400/35 bg-amber-500/10'
                      : 'bg-slate-900/75'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono-num text-[10px] text-slate-400">
                      0{slot.slotIndex + 1}
                    </span>
                    <AvatarBadge
                      src={slot.avatar}
                      name={slot.name}
                      size="xs"
                      highlight={slot.isLocal}
                    />
                    <span className="truncate text-[11px] font-medium text-white">
                      {slot.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-400">
                    {slot.isSpeaking && <Radio className="h-3 w-3 text-emerald-400" />}
                    <span className={slot.isLocal ? 'font-semibold text-amber-300' : ''}>
                      {slot.isLocal ? 'You' : slot.isHuman ? 'Online' : 'AI'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Bottom Launch Bar */}
      <footer className="pointer-events-auto mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-[#0b101b]/92 px-3.5 py-2.5 sm:px-5">
        <div className="hidden items-center gap-2.5 text-xs text-slate-400 xl:flex">
          <span>W/Up: Throttle</span>
          <span aria-hidden="true">·</span>
          <span>A/D: Steer</span>
          <span aria-hidden="true">·</span>
          <span>Shift/Space: Nitro</span>
          <span aria-hidden="true">·</span>
          <span>E: Wheelie</span>
          <span aria-hidden="true">·</span>
          <span>C: Camera</span>
        </div>

        <div className="flex w-full items-center justify-between gap-3 xl:w-auto xl:justify-end">
          <div className="min-w-0 text-xs text-slate-300">
            <span className="font-semibold text-white">{activeBike.name}</span>
            <span className="mx-1.5 text-slate-500">·</span>
            <span>{activeTrack.name}</span>
            <span className="mx-1.5 hidden text-slate-500 sm:inline">·</span>
            <span className="hidden text-amber-300 sm:inline">{activeMode.name}</span>
          </div>

          <button
            type="button"
            onClick={onStartRace}
            className="font-display flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold tracking-wide text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Race</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

const WeatherIcon: React.FC<{ mode: WeatherMode }> = ({ mode }) => {
  switch (mode) {
    case 'day':
      return <Sun className="h-3.5 w-3.5 text-amber-300" />;
    case 'night':
      return <Moon className="h-3.5 w-3.5 text-indigo-300" />;
    case 'rainy':
      return <CloudRain className="h-3.5 w-3.5 text-cyan-300" />;
    case 'foggy':
      return <CloudFog className="h-3.5 w-3.5 text-slate-300" />;
    case 'dynamic':
      return <Sparkles className="h-3.5 w-3.5 text-amber-400" />;
  }
};

const StatBar: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div>
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono-num font-semibold text-white">{value}</span>
    </div>
    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: accent }}
      />
    </div>
  </div>
);
