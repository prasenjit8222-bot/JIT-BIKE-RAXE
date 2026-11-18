import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundEngine } from './audio/SoundEngine';
import { GarageLobby } from './components/GarageLobby';
import { PodiumModal } from './components/PodiumModal';
import { RaceHud } from './components/RaceHud';
import { RaceEngine } from './engine/RaceEngine';
import { MultiplayerManager } from './network/MultiplayerManager';
import {
  BikeId,
  CameraMode,
  ControlInputs,
  GamePhase,
  HudSnapshot,
  LobbySlot,
  RaceStanding,
  TrackId,
} from './types/game';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const netRef = useRef<MultiplayerManager | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('av_gp_name') || 'Racer 01';
    } catch {
      return 'Racer 01';
    }
  });
  const [selectedBike, setSelectedBike] = useState<BikeId>('apex');
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('city');
  const [roomCode, setRoomCode] = useState<string>('GP101');
  const [connectionStatus, setConnectionStatus] = useState<string>('Solo / Local Grid Ready');
  const [slots, setSlots] = useState<LobbySlot[]>([]);

  const [phase, setPhase] = useState<GamePhase>('lobby');
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [standings, setStandings] = useState<RaceStanding[]>([]);
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

  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)')?.matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });

  // Launch Race Helper (used by local Start button and remote host broadcast)
  const launchRaceRef = useRef<(trackId: TrackId, broadcastStart: boolean) => void>(() => {});

  const enterFullscreenAndLandscape = useCallback(async () => {
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
  }, []);

  const launchRace = useCallback(
    (trackId: TrackId, broadcastStart: boolean) => {
      const engine = engineRef.current;
      const sound = soundRef.current;
      const net = netRef.current;
      if (!engine || !sound || !net || !engineReady) return;

      if (broadcastStart) {
        sound.init();
        void enterFullscreenAndLandscape();
        net.sendRaceStart(trackId);
      }

      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      const activeSlots = net.getSlots();
      setStandings([]);
      setPhase('countdown');
      setCountdownValue(3);

      engine.setAutoAccelerate(touchEnabled);
      engine.startRace(
        trackId,
        activeSlots,
        () => net.getRemoteUpdates(),
        (id) => {
          const currentSlots = net.getSlots();
          return currentSlots.find((s) => s.id === id)?.isSpeaking ?? false;
        }
      );

      sound.playCountdownBeep(false);
      let count = 3;
      countdownTimerRef.current = window.setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdownValue(count);
          sound.playCountdownBeep(false);
        } else if (count === 0) {
          setCountdownValue(0);
          sound.playCountdownBeep(true);
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
    [engineReady, enterFullscreenAndLandscape, touchEnabled]
  );

  launchRaceRef.current = launchRace;

  // Initialize Sound, Multiplayer & 3D WebGL Engine asynchronously (no black screen freeze)
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
    net.onRemoteRaceStart = (remoteTrackId) => {
      setSelectedTrack(remoteTrackId);
      launchRaceRef.current(remoteTrackId, false);
    };

    engine.onHudUpdate = (snapshot) => setHud(snapshot);
    engine.onRaceFinished = (finalStandings) => {
      setStandings(finalStandings);
      setPhase('finished');
    };
    engine.onNetworkSend = (update) => net.sendRacerUpdate(update);
    engine.onContextLost = (lost) => setContextLost(lost);
    engine.onInitFailed = (msg) => setInitError(msg);

    net.setLocalProfile(playerName, selectedBike);
    net.connectRoom(roomCode, true);

    void engine
      .initializeAsync((pct, label) => {
        setLoadingProgress(pct);
        setLoadingLabel(label);
      })
      .then(() => {
        engine.setGarageSelection(selectedBike, selectedTrack);
        engine.setAutoAccelerate(touchEnabled);
        setEngineReady(true);
      });

    // Safe one-time user gesture audio unlock for mobile browsers
    const unlockAudio = () => {
      sound.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
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

  // Sync Garage preview & Multiplayer profile on selection change
  useEffect(() => {
    try {
      localStorage.setItem('av_gp_name', playerName);
    } catch {
      // ignore storage errors
    }
    netRef.current?.setLocalProfile(playerName, selectedBike);
    engineRef.current?.setGarageSelection(selectedBike, selectedTrack);
  }, [playerName, selectedBike, selectedTrack]);

  // Sync mobile auto-acceleration when touch mode toggles
  useEffect(() => {
    engineRef.current?.setAutoAccelerate(touchEnabled);
  }, [touchEnabled, engineReady]);

  // Keyboard Controls during Race
  useEffect(() => {
    const updateKey = (code: string, down: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;

      switch (code) {
        case 'KeyW':
        case 'ArrowUp':
          engine.setInputs({ accelerate: down });
          break;
        case 'KeyS':
        case 'ArrowDown':
          engine.setInputs({ brake: down });
          break;
        case 'KeyA':
        case 'ArrowLeft':
          engine.setInputs({ left: down });
          break;
        case 'KeyD':
        case 'ArrowRight':
          engine.setInputs({ right: down });
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'Space':
          engine.setInputs({ nitro: down });
          break;
        case 'KeyE':
          engine.setInputs({ wheelie: down });
          break;
        case 'KeyC':
          if (down && phase !== 'lobby') {
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
      engineRef.current?.setInputs({
        accelerate: false,
        brake: false,
        left: false,
        right: false,
        nitro: false,
        wheelie: false,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [phase]);

  const handleJoinRoom = (code: string, asHost: boolean) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'GP101';
    setRoomCode(clean);
    netRef.current?.connectRoom(clean, asHost);
  };

  const handleSelectBike = (id: BikeId) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setSelectedBike(id);
  };

  const handleSelectTrack = (id: TrackId) => {
    soundRef.current?.init();
    soundRef.current?.playUiClick();
    setSelectedTrack(id);
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

  const handleTouchInput = (key: keyof ControlInputs, active: boolean) => {
    engineRef.current?.setInputs({ [key]: active });
  };

  const handleExitToGarage = () => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
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
  };

  return (
    <div className="relative h-screen h-dvh w-screen overflow-hidden bg-[#070a12]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

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

      {phase === 'lobby' && engineReady && (
        <GarageLobby
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          selectedBike={selectedBike}
          onSelectBike={handleSelectBike}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
          roomCode={roomCode}
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
          onTouchInput={handleTouchInput}
          onExitRace={handleExitToGarage}
          showRotateHint={showRotateHint}
          onDismissRotateHint={() => setShowRotateHint(false)}
        />
      )}

      {phase === 'finished' && (
        <PodiumModal
          trackId={selectedTrack}
          standings={standings}
          onPlayAgain={() => launchRace(selectedTrack, true)}
          onChangeTrack={handleExitToGarage}
        />
      )}
    </div>
  );
}
