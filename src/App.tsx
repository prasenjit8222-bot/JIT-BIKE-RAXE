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

  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  // Launch Race Helper (used by local Start button and remote host broadcast)
  const launchRaceRef = useRef<(trackId: TrackId, broadcastStart: boolean) => void>(() => {});

  const launchRace = useCallback((trackId: TrackId, broadcastStart: boolean) => {
    const engine = engineRef.current;
    const sound = soundRef.current;
    const net = netRef.current;
    if (!engine || !sound || !net) return;

    sound.init();
    if (broadcastStart) {
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
  }, []);

  launchRaceRef.current = launchRace;

  // Initialize Sound, Multiplayer & 3D WebGL Engine once
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

    net.setLocalProfile(playerName, selectedBike);
    net.connectRoom(roomCode, true);

    return () => {
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      engine.dispose();
      net.dispose();
      sound.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    engineRef.current?.returnToGarage();
    setHud(null);
    setPhase('lobby');
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070a12]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

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

      {phase === 'lobby' && (
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
