import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundEngine } from './audio/SoundEngine';
import { GarageLobby } from './components/GarageLobby';
import { GarageModal } from './components/GarageModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { LoginModal } from './components/LoginModal';
import { PodiumModal } from './components/PodiumModal';
import { ProfileModal } from './components/ProfileModal';
import { RaceHud } from './components/RaceHud';
import { RaceEngine } from './engine/RaceEngine';
import { MultiplayerManager } from './network/MultiplayerManager';
import {
  BikeId,
  CameraMode,
  ControlInputs,
  GameMode,
  GamePhase,
  HudSnapshot,
  LobbySlot,
  PaintColorId,
  RaceFinishSummary,
  RewardItemId,
  TrackId,
  UserProfile,
  WeatherMode,
} from './types/game';
import { DEFAULT_AVATAR } from './utils/avatars';
import {
  clearActiveSession,
  getBikeCustomization,
  getGlobalLeaderboard,
  loadActiveSession,
  recordRaceResult,
  saveProfile,
  setBikePaintInProfile,
  toggleToolEquipInProfile,
  unlockBikeInProfile,
  upgradeBikeStatInProfile,
} from './utils/profileStorage';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const netRef = useRef<MultiplayerManager | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const [savedSession, setSavedSession] = useState<UserProfile | null>(() => loadActiveSession());
  const [profile, setProfile] = useState<UserProfile>(() => {
    const existing = loadActiveSession();
    if (existing) return existing;
    return {
      phone: null,
      isGuest: true,
      name: 'Racer 01',
      avatar: DEFAULT_AVATAR,
      coins: 500,
      unlockedBikes: ['apex'],
      bikeCustomizations: {},
      inventoryTools: [],
      blueprints: 0,
      stats: {
        races: 0,
        wins: 0,
        podiums: 0,
        bestWheelie: 0,
        bestRaceTimeMs: null,
        bestEndlessMeters: 0,
        topSpeedKmh: 0,
      },
      createdAt: Date.now(),
    };
  });
  const profileRef = useRef<UserProfile>(profile);
  profileRef.current = profile;

  const [showLoginModal, setShowLoginModal] = useState<boolean>(true);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showGarageModal, setShowGarageModal] = useState<boolean>(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);

  const [selectedBike, setSelectedBike] = useState<BikeId>('apex');
  const selectedBikeRef = useRef<BikeId>(selectedBike);
  selectedBikeRef.current = selectedBike;

  const [selectedTrack, setSelectedTrack] = useState<TrackId>('city');
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;

  const [weatherMode, setWeatherMode] = useState<WeatherMode>('day');
  const weatherModeRef = useRef<WeatherMode>(weatherMode);
  weatherModeRef.current = weatherMode;

  const [roomCode, setRoomCode] = useState<string>('1042');
  const [connectionStatus, setConnectionStatus] = useState<string>('Solo / Local Grid Ready');
  const [slots, setSlots] = useState<LobbySlot[]>([]);

  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [raceSummary, setRaceSummary] = useState<RaceFinishSummary | null>(null);
  const [lastReward, setLastReward] = useState<{
    coinsEarned: number;
    wonItem: RewardItemId | null;
    wonItemDuplicateBonus: number;
  }>({ coinsEarned: 0, wonItem: null, wonItemDuplicateBonus: 0 });
  const [cameraMode, setCameraMode] = useState<CameraMode>('far');

  // Audio & Voice Chat states
  const [masterMuted, setMasterMuted] = useState<boolean>(false);
  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const [speakerMuted, setSpeakerMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | undefined>(undefined);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(8);
  const [loadingLabel, setLoadingLabel] = useState<string>('Preparing 3D Engine...');
  const [initError, setInitError] = useState<string | null>(null);
  const [showRotateHint, setShowRotateHint] = useState<boolean>(false);

  const [autoGas, setAutoGas] = useState<boolean>(false);

  const controlsRef = useRef<ControlInputs>({
    accelerate: false,
    brake: false,
    left: false,
    right: false,
    nitro: false,
    wheelie: false,
  });

  const resetControls = useCallback(() => {
    controlsRef.current.accelerate = false;
    controlsRef.current.brake = false;
    controlsRef.current.left = false;
    controlsRef.current.right = false;
    controlsRef.current.nitro = false;
    controlsRef.current.wheelie = false;
  }, []);

  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)')?.matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });

  // Launch Race Helper (used by local Start button and remote host broadcast)
  const launchRaceRef = useRef<
    (
      trackId: TrackId,
      broadcastStart: boolean,
      overrideMode?: GameMode,
      overrideWeather?: WeatherMode
    ) => void
  >(() => {});

  const enterFullscreenAndLandscape = useCallback(() => {
    // Non-blocking fire-and-forget so mobile browsers NEVER delay or stall race countdown
    void (async () => {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      try {
        if (!document.fullscreenElement) {
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
          } else if (docEl.webkitRequestFullscreen) {
            await docEl.webkitRequestFullscreen();
          }
        }
      } catch {
        // Mobile Safari / embedded iframes may block fullscreen; continue seamlessly
      }

      let locked = false;
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape');
          locked = true;
        }
      } catch {
        locked = false;
      }

      const isMobileViewport =
        window.matchMedia?.('(pointer: coarse)')?.matches ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMobileViewport && !locked && window.innerHeight > window.innerWidth) {
        setShowRotateHint(true);
      } else {
        setShowRotateHint(false);
      }
    })();
  }, []);

  const launchRace = useCallback(
    (
      trackId: TrackId,
      broadcastStart: boolean,
      overrideMode?: GameMode,
      overrideWeather?: WeatherMode
    ) => {
      const engine = engineRef.current;
      const sound = soundRef.current;
      const net = netRef.current;
      if (!engine || !sound || !net || !engineReady) return;

      const activeMode = overrideMode ?? gameModeRef.current;
      const activeWeather = overrideWeather ?? weatherModeRef.current;
      const activeBikeId = selectedBikeRef.current;
      const localCustom = getBikeCustomization(profileRef.current, activeBikeId);

      // Safe audio init & fullscreen attempt (completely non-blocking on mobile!)
      if (broadcastStart) {
        try {
          sound.init();
        } catch {
          // Ignore mobile audio restrictions
        }
        enterFullscreenAndLandscape();
        net.sendRaceStart(trackId, activeMode, activeWeather);
      }

      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      const activeSlots = net.getSlots();
      resetControls();
      setShowGarageModal(false);
      setShowLeaderboardModal(false);
      setShowProfileModal(false);
      setRaceSummary(null);
      setPhase('countdown');
      setCountdownValue(3);

      engine.setControlsRef(controlsRef);
      engine.setAutoAccelerate(autoGas);
      engine.startRace(
        trackId,
        activeSlots,
        activeMode,
        activeWeather,
        localCustom,
        () => net.getRemoteUpdates(),
        (id) => {
          const currentSlots = net.getSlots();
          return currentSlots.find((s) => s.id === id)?.isSpeaking ?? false;
        }
      );

      // Countdown runs 100% independently of Web Audio API so mobile browsers NEVER freeze
      try {
        sound.playCountdownBeep(false);
      } catch {
        // Ignore suspended audio
      }
      let count = 3;
      countdownTimerRef.current = window.setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownValue(count);
          try {
            sound.playCountdownBeep(false);
          } catch {
            // Ignore suspended audio
          }
        } else if (count === 0) {
          setCountdownValue(0);
          try {
            sound.playCountdownBeep(true);
          } catch {
            // Ignore suspended audio
          }
          engine.beginRacingGo();
          setPhase('racing');
        } else {
          if (countdownTimerRef.current) {
            window.clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
        }
      }, 850);
    },
    [autoGas, engineReady, enterFullscreenAndLandscape, resetControls]
  );

  launchRaceRef.current = launchRace;

  // Initialize Sound, Multiplayer & 3D WebGL Engine asynchronously
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const sound = new SoundEngine();
    const net = new MultiplayerManager();
    const engine = new RaceEngine(mount, sound);

    soundRef.current = sound;
    netRef.current = net;
    engineRef.current = engine;

    net.onSlotsChanged = (nextSlots) => setSlots(nextSlots);
    net.onConnectionStatus = (status) => setConnectionStatus(status);
    net.onVoiceStateChanged = (micOn, spkMuted, speaking, err) => {
      setMicEnabled(micOn);
      setSpeakerMuted(spkMuted);
      setIsSpeaking(speaking);
      setVoiceError(err);
    };
    net.onRemoteRaceStart = (remoteTrackId, remoteMode, remoteWeather) => {
      setSelectedTrack(remoteTrackId);
      if (remoteMode) setGameMode(remoteMode);
      if (remoteWeather) setWeatherMode(remoteWeather);
      launchRaceRef.current(remoteTrackId, false, remoteMode, remoteWeather);
    };

    engine.onHudUpdate = (snapshot) => setHud(snapshot);
    engine.onRaceFinished = (summary) => {
      resetControls();
      const localResult = summary.standings.find((s) => s.isLocal);
      const rank = localResult?.rank ?? 1;
      const wheelieScore = localResult?.wheelieScore ?? 0;
      const completedFullTrack = summary.endReason === 'finished' || summary.endReason === 'knockout_win';

      const reward = recordRaceResult(profileRef.current, {
        rank,
        wheelieScore,
        gameMode: summary.gameMode,
        elapsedMs: summary.elapsedMs,
        distanceM: summary.distanceM,
        topSpeedKmh: summary.topSpeedKmh,
        coinsCollected: summary.coinsCollected,
        completedFullTrack,
      });

      setProfile(reward.updated);
      setSavedSession(reward.updated);
      setLastReward({
        coinsEarned: reward.coinsEarned,
        wonItem: reward.wonItem,
        wonItemDuplicateBonus: reward.wonItemDuplicateBonus,
      });
      if (reward.wonItem) {
        try {
          sound.playRewardCrateOpen();
        } catch {
          // Ignore suspended audio
        }
      }
      setRaceSummary(summary);
      setPhase('finished');
    };
    engine.onNetworkSend = (update) => net.sendRacerUpdate(update);
    engine.onContextLost = (lost) => setContextLost(lost);
    engine.onInitFailed = (msg) => setInitError(msg);
    engine.setControlsRef(controlsRef);

    const initCustom = getBikeCustomization(profileRef.current, selectedBikeRef.current);
    net.setLocalProfile(
      profileRef.current.name,
      selectedBikeRef.current,
      profileRef.current.avatar,
      initCustom.paintId,
      initCustom.equippedTools.includes('neon_underglow')
    );
    net.connectRoom(roomCode, true);

    void engine
      .initializeAsync((pct, label) => {
        setLoadingProgress(pct);
        setLoadingLabel(label);
      })
      .then(() => {
        engine.setGarageSelection(
          selectedBikeRef.current,
          selectedTrack,
          getBikeCustomization(profileRef.current, selectedBikeRef.current)
        );
        engine.setAutoAccelerate(autoGas);
        setEngineReady(true);
      });

    // Silently unlock/resume mobile Web Audio on user interaction without blocking anything
    const unlockAudio = () => {
      try {
        sound.init();
      } catch {
        // Ignore restricted Web Audio
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      engine.dispose();
      net.dispose();
      sound.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide landscape hint once device rotates to landscape
  useEffect(() => {
    const checkOrientation = () => {
      if (window.innerWidth >= window.innerHeight) {
        setShowRotateHint(false);
      }
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Sync Garage 3D preview & Multiplayer profile (name + bike + avatar + paint + underglow)
  useEffect(() => {
    const custom = getBikeCustomization(profile, selectedBike);
    const hasUnderglow = custom.equippedTools.includes('neon_underglow');
    netRef.current?.setLocalProfile(profile.name, selectedBike, profile.avatar, custom.paintId, hasUnderglow);
    engineRef.current?.setGarageSelection(selectedBike, selectedTrack, custom);
  }, [profile, selectedBike, selectedTrack]);

  // Sync optional toggleable Auto-Gas with engine
  useEffect(() => {
    engineRef.current?.setAutoAccelerate(autoGas);
  }, [autoGas, engineReady]);

  // Keyboard Controls during Race (mutate controlsRef directly for zero stale closures)
  useEffect(() => {
    const updateKey = (code: string, down: boolean) => {
      const engine = engineRef.current;

      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          controlsRef.current.accelerate = down;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controlsRef.current.brake = down;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controlsRef.current.left = down;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controlsRef.current.right = down;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'Space':
          controlsRef.current.nitro = down;
          break;
        case 'KeyE':
          controlsRef.current.wheelie = down;
          break;
        case 'KeyC':
          if (down && phase !== 'lobby' && engine) {
            setCameraMode(engine.cycleCamera());
          }
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat && e.code === 'KeyC') return;
      updateKey(e.code, true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      updateKey(e.code, false);
    };

    const onBlur = () => {
      resetControls();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [phase, resetControls]);

  const handleLoginComplete = (nextProfile: UserProfile) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setProfile(nextProfile);
    setSavedSession(nextProfile);
    if (!nextProfile.unlockedBikes.includes(selectedBike)) {
      setSelectedBike(nextProfile.unlockedBikes[0] ?? 'apex');
    }
    setShowLoginModal(false);
  };

  const handleSaveProfile = (updated: UserProfile) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    const persisted = saveProfile(updated);
    setProfile(persisted);
    setSavedSession(persisted);
  };

  const handleQuickNameChange = (nextName: string) => {
    const clean = nextName.slice(0, 18);
    const updated: UserProfile = { ...profile, name: clean };
    setProfile(updated);
    if (clean.trim().length > 0) {
      const persisted = saveProfile(updated);
      setSavedSession(persisted);
    }
  };

  const handleLogout = () => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    clearActiveSession();
    setSavedSession(null);
    setShowProfileModal(false);
    setShowLoginModal(true);
  };

  const handleCreatePrivateRoom = () => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    const nextCode = netRef.current?.createPrivateRoom() ?? String(Math.floor(1000 + Math.random() * 9000));
    setRoomCode(nextCode);
  };

  const handleJoinRoom = (code: string, asHost: boolean) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || '1042';
    setRoomCode(clean);
    netRef.current?.connectRoom(clean, asHost);
  };

  const handleSelectBike = (id: BikeId) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setSelectedBike(id);
  };

  const handleUnlockBike = (id: BikeId, useBlueprints = false): string | null => {
    soundRef.current?.init();
    const res = unlockBikeInProfile(profileRef.current, id, useBlueprints);
    if (!res.success) {
      return res.message ?? 'Cannot unlock this bike yet.';
    }
    soundRef.current?.playRewardCrateOpen();
    setProfile(res.updated);
    setSavedSession(res.updated);
    return null;
  };

  const handleSelectPaint = (bikeId: BikeId, paintId: PaintColorId) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    const updated = setBikePaintInProfile(profileRef.current, bikeId, paintId);
    setProfile(updated);
    setSavedSession(updated);
  };

  const handleUpgradeStat = (
    bikeId: BikeId,
    stat: 'engine' | 'handling' | 'nitro'
  ): string | null => {
    soundRef.current?.init();
    const res = upgradeBikeStatInProfile(profileRef.current, bikeId, stat);
    if (!res.success) {
      return res.message ?? 'Cannot upgrade right now.';
    }
    soundRef.current?.playPowerUpPickup();
    setProfile(res.updated);
    setSavedSession(res.updated);
    return null;
  };

  const handleToggleTool = (bikeId: BikeId, toolId: RewardItemId) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    const updated = toggleToolEquipInProfile(profileRef.current, bikeId, toolId);
    setProfile(updated);
    setSavedSession(updated);
  };

  const handleSelectTrack = (id: TrackId) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setSelectedTrack(id);
  };

  const handleSelectGameMode = (mode: GameMode) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setGameMode(mode);
  };

  const handleSelectWeatherMode = (weather: WeatherMode) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setWeatherMode(weather);
  };

  const handleToggleMasterAudio = () => {
    soundRef.current?.init();
    const next = !masterMuted;
    setMasterMuted(next);
    soundRef.current?.setMuted(next);
  };

  const handleToggleMic = () => {
    soundRef.current?.init();
    void netRef.current?.toggleMic();
  };

  const handleToggleSpeaker = () => {
    soundRef.current?.init();
    netRef.current?.toggleSpeaker();
  };

  const handleCycleCamera = () => {
    if (!engineRef.current) return;
    setCameraMode(engineRef.current.cycleCamera());
  };

  const handleFinishEndlessNow = () => {
    engineRef.current?.finishCurrentRunNow();
  };

  const handleExitToGarage = (openGarageImmediately = false) => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    resetControls();
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      screen.orientation?.unlock?.();
    } catch {
      // ignore orientation unlock errors
    }
    setShowRotateHint(false);
    engineRef.current?.returnToGarage();
    setHud(null);
    setPhase('lobby');
    if (openGarageImmediately) {
      setShowGarageModal(true);
    }
  };

  return (
    <div className="relative h-screen h-dvh w-screen overflow-hidden bg-[#070a12]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Lightweight Loading Progress Indicator before 3D Scene Starts */}
      {!engineReady && !initError && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#070a12] px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-white p-1 shadow-xl">
            <img
              src="./assets/aistudio/image_74ce4eb9.png"
              alt="JIT BIKE RACE Logo"
              className="h-full w-full rounded-full object-contain"
            />
          </div>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-wide text-white">
            JIT BIKE RACE
          </h1>
          <p className="mt-1 text-xs text-slate-400">{loadingLabel}</p>

          <div className="mt-5 w-full max-w-xs">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="font-mono-num mt-2 text-xs font-semibold text-amber-400">
              {loadingProgress}%
            </div>
          </div>
        </div>
      )}

      {/* WebGL Initialization Error Fallback */}
      {initError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070a12] p-6 text-center">
          <div className="max-w-sm rounded-xl border border-white/15 bg-slate-900 p-6">
            <h2 className="font-display text-lg font-bold text-white">3D Graphics Unavailable</h2>
            <p className="mt-2 text-xs text-slate-300">{initError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 cursor-pointer"
            >
              Reload Game
            </button>
          </div>
        </div>
      )}

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6 text-center">
          <div className="max-w-sm rounded-xl border border-white/15 bg-slate-900 p-6">
            <h2 className="font-display text-lg font-bold text-white">Graphics Context Paused</h2>
            <p className="mt-2 text-xs text-slate-300">
              Restoring WebGL rendering pipeline. If this persists, reload the page.
            </p>
          </div>
        </div>
      )}

      {/* Main Lobby (hidden while Full Garage Modal is docked open so 3D turntable shines) */}
      {phase === 'lobby' && engineReady && !showGarageModal && (
        <GarageLobby
          profile={profile}
          onOpenProfile={() => {
            soundRef.current?.init();
            soundRef.current?.playUiClick();
            setShowProfileModal(true);
          }}
          onOpenGarage={() => {
            soundRef.current?.init();
            soundRef.current?.playUiClick();
            setShowGarageModal(true);
          }}
          onOpenLeaderboard={() => {
            soundRef.current?.init();
            soundRef.current?.playUiClick();
            setShowLeaderboardModal(true);
          }}
          playerName={profile.name}
          onPlayerNameChange={handleQuickNameChange}
          selectedBike={selectedBike}
          onSelectBike={handleSelectBike}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
          gameMode={gameMode}
          onSelectGameMode={handleSelectGameMode}
          weatherMode={weatherMode}
          onSelectWeatherMode={handleSelectWeatherMode}
          roomCode={roomCode}
          onCreatePrivateRoom={handleCreatePrivateRoom}
          onJoinRoom={handleJoinRoom}
          slots={slots}
          connectionStatus={connectionStatus}
          micEnabled={micEnabled}
          speakerMuted={speakerMuted}
          isSpeaking={isSpeaking}
          voiceError={voiceError}
          masterMuted={masterMuted}
          onToggleMic={handleToggleMic}
          onToggleSpeaker={handleToggleSpeaker}
          onToggleMasterAudio={handleToggleMasterAudio}
          onStartRace={() => launchRace(selectedTrack, true)}
        />
      )}

      {/* Full Superbike Garage, Paint & Upgrade Workshop Modal */}
      {phase === 'lobby' && engineReady && showGarageModal && !showLoginModal && (
        <GarageModal
          profile={profile}
          selectedBike={selectedBike}
          onSelectBike={handleSelectBike}
          onUnlockBike={handleUnlockBike}
          onSelectPaint={handleSelectPaint}
          onUpgradeStat={handleUpgradeStat}
          onToggleTool={handleToggleTool}
          onClose={() => {
            soundRef.current?.playUiClick();
            setShowGarageModal(false);
          }}
        />
      )}

      {/* Global Leaderboard Modal */}
      {phase === 'lobby' && engineReady && showLeaderboardModal && !showLoginModal && (
        <LeaderboardModal
          entries={getGlobalLeaderboard(profile)}
          onClose={() => {
            soundRef.current?.playUiClick();
            setShowLeaderboardModal(false);
          }}
        />
      )}

      {/* In-Race HUD & Mobile Touch Controls */}
      {(phase === 'countdown' || phase === 'racing') && (
        <RaceHud
          phase={phase}
          countdownValue={countdownValue}
          hud={hud}
          cameraMode={cameraMode}
          onCycleCamera={handleCycleCamera}
          micEnabled={micEnabled}
          speakerMuted={speakerMuted}
          isSpeaking={isSpeaking}
          masterMuted={masterMuted}
          onToggleMic={handleToggleMic}
          onToggleSpeaker={handleToggleSpeaker}
          onToggleMasterAudio={handleToggleMasterAudio}
          touchEnabled={touchEnabled}
          onToggleTouch={() => setTouchEnabled((v) => !v)}
          autoGas={autoGas}
          onToggleAutoGas={() => setAutoGas((v) => !v)}
          controlsRef={controlsRef}
          onFinishEndlessNow={handleFinishEndlessNow}
          onExitRace={() => handleExitToGarage(false)}
          showRotateHint={showRotateHint}
          onDismissRotateHint={() => setShowRotateHint(false)}
        />
      )}

      {/* Victory Reward Crate, Podium Standings & Shareable Scorecard Modal */}
      {phase === 'finished' && raceSummary && (
        <PodiumModal
          summary={raceSummary}
          playerName={profile.name}
          playerAvatar={profile.avatar}
          bikeId={selectedBike}
          coinsEarned={lastReward.coinsEarned}
          wonItem={lastReward.wonItem}
          wonItemDuplicateBonus={lastReward.wonItemDuplicateBonus}
          onOpenGarage={() => handleExitToGarage(true)}
          onPlayAgain={() => launchRace(selectedTrack, true)}
          onChangeTrack={() => handleExitToGarage(false)}
        />
      )}

      {/* Startup Contact Number Login & New Racer Setup Modal */}
      {engineReady && showLoginModal && phase === 'lobby' && (
        <LoginModal savedSession={savedSession} onComplete={handleLoginComplete} />
      )}

      {/* My Profile Modal (Opened from Top-Left Profile Badge) */}
      {engineReady && showProfileModal && !showLoginModal && phase === 'lobby' && (
        <ProfileModal
          profile={profile}
          onSave={handleSaveProfile}
          onLogout={handleLogout}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
