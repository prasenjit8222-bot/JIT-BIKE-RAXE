import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { AI_RACER_PROFILES } from '../data/catalog';
import { BikeId, LobbySlot, NetworkRacerUpdate, TrackId } from '../types/game';

interface RoomMessage {
  type: 'join' | 'leave' | 'state' | 'start' | 'voice' | 'roster';
  senderId: string;
  name?: string;
  bikeId?: BikeId;
  trackId?: TrackId;
  update?: NetworkRacerUpdate;
  isSpeaking?: boolean;
  peers?: Array<{ id: string; name: string; bikeId: BikeId; isSpeaking: boolean }>;
}

export class MultiplayerManager {
  private localId: string;
  private localName = 'Racer 01';
  private localBike: BikeId = 'apex';
  private roomCode = 'GP101';
  private isHost = true;

  private peer: Peer | null = null;
  private dataConns = new Map<string, DataConnection>();
  private mediaConns = new Map<string, MediaConnection>();
  private remoteAudios = new Map<string, HTMLAudioElement>();
  private channel: BroadcastChannel | null = null;

  private remotePlayers = new Map<string, { id: string; name: string; bikeId: BikeId; isSpeaking: boolean; lastSeen: number }>();
  private remoteUpdates = new Map<string, NetworkRacerUpdate>();

  // Voice chat state
  private localStream: MediaStream | null = null;
  private micEnabled = false;
  private speakerMuted = false;
  private localSpeaking = false;
  private vadCtx: AudioContext | null = null;
  private vadAnalyser: AnalyserNode | null = null;
  private vadTimer: number | null = null;

  // Callbacks
  public onSlotsChanged?: (slots: LobbySlot[]) => void;
  public onRemoteRaceStart?: (trackId: TrackId) => void;
  public onVoiceStateChanged?: (micOn: boolean, speakerMuted: boolean, isSpeaking: boolean, error?: string) => void;
  public onConnectionStatus?: (status: string) => void;

  private heartbeatTimer: number | null = null;

  constructor() {
    this.localId = `p_${Math.random().toString(36).slice(2, 9)}`;
  }

  public getLocalId(): string {
    return this.localId;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public isMicEnabled(): boolean {
    return this.micEnabled;
  }

  public isSpeakerMuted(): boolean {
    return this.speakerMuted;
  }

  public isLocalSpeaking(): boolean {
    return this.localSpeaking;
  }

  public setLocalProfile(name: string, bikeId: BikeId): void {
    this.localName = name.trim() || 'Racer 01';
    this.localBike = bikeId;
    this.broadcast({
      type: 'join',
      senderId: this.localId,
      name: this.localName,
      bikeId: this.localBike,
    });
    this.emitSlots();
  }

  public connectRoom(code: string, asHost: boolean): void {
    this.disconnectRoom();

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'GP101';
    this.roomCode = cleanCode;
    this.isHost = asHost;

    // 1. Instant local-tab BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`apex_velocity_room_${cleanCode}`);
      this.channel.onmessage = (ev: MessageEvent<RoomMessage>) => {
        this.handleMessage(ev.data);
      };
    }

    // 2. PeerJS WebRTC P2P (host takes deterministic room ID so peers can dial directly)
    const hostPeerId = `av-gp-host-${cleanCode}`;
    const myPeerId = asHost ? hostPeerId : `av-gp-${cleanCode}-${this.localId}`;

    try {
      const peer = new Peer(myPeerId, { debug: 0 });
      this.peer = peer;

      peer.on('open', () => {
        this.onConnectionStatus?.(asHost ? `Hosting ${cleanCode}` : `Connected ${cleanCode}`);
        if (!asHost) {
          const conn = peer.connect(hostPeerId, { reliable: false });
          this.attachDataConn(conn);
        }
      });

      peer.on('connection', (conn) => {
        this.attachDataConn(conn);
      });

      peer.on('call', (call) => {
        this.handleIncomingCall(call);
      });

      peer.on('error', () => {
        // Fallback gracefully to BroadcastChannel + AI racers if signaling is blocked
        this.onConnectionStatus?.('Solo / Local Grid Ready');
      });
    } catch {
      this.onConnectionStatus?.('Solo / Local Grid Ready');
    }

    // Periodic presence announce & stale cleanup
    this.broadcast({
      type: 'join',
      senderId: this.localId,
      name: this.localName,
      bikeId: this.localBike,
    });

    this.heartbeatTimer = window.setInterval(() => {
      this.broadcast({
        type: 'join',
        senderId: this.localId,
        name: this.localName,
        bikeId: this.localBike,
      });

      const now = Date.now();
      let changed = false;
      for (const [id, info] of this.remotePlayers.entries()) {
        if (now - info.lastSeen > 8000) {
          this.remotePlayers.delete(id);
          this.remoteUpdates.delete(id);
          changed = true;
        }
      }
      if (changed) this.emitSlots();
    }, 2000);

    this.emitSlots();
  }

  private attachDataConn(conn: DataConnection): void {
    conn.on('open', () => {
      this.dataConns.set(conn.peer, conn);
      conn.send({
        type: 'join',
        senderId: this.localId,
        name: this.localName,
        bikeId: this.localBike,
      } satisfies RoomMessage);

      // If mic is already enabled, establish WebRTC voice stream
      if (this.micEnabled && this.localStream && this.peer) {
        const mediaCall = this.peer.call(conn.peer, this.localStream);
        this.attachMediaConn(mediaCall);
      }
    });

    conn.on('data', (raw) => {
      if (raw && typeof raw === 'object') {
        this.handleMessage(raw as RoomMessage);
      }
    });

    conn.on('close', () => {
      this.dataConns.delete(conn.peer);
    });
  }

  private handleMessage(msg: RoomMessage): void {
    if (!msg || msg.senderId === this.localId) return;

    if (msg.type === 'join') {
      const existed = this.remotePlayers.has(msg.senderId);
      this.remotePlayers.set(msg.senderId, {
        id: msg.senderId,
        name: msg.name || 'Remote Rider',
        bikeId: msg.bikeId || 'volt',
        isSpeaking: this.remotePlayers.get(msg.senderId)?.isSpeaking ?? false,
        lastSeen: Date.now(),
      });
      if (!existed) {
        // Reply immediately so newcomer knows about us
        this.broadcast({
          type: 'join',
          senderId: this.localId,
          name: this.localName,
          bikeId: this.localBike,
        });
        this.emitSlots();
      }
    } else if (msg.type === 'leave') {
      this.remotePlayers.delete(msg.senderId);
      this.remoteUpdates.delete(msg.senderId);
      this.emitSlots();
    } else if (msg.type === 'state' && msg.update) {
      this.remoteUpdates.set(msg.senderId, msg.update);
    } else if (msg.type === 'voice') {
      const p = this.remotePlayers.get(msg.senderId);
      if (p) {
        p.isSpeaking = Boolean(msg.isSpeaking);
        this.emitSlots();
      }
    } else if (msg.type === 'start' && msg.trackId) {
      this.onRemoteRaceStart?.(msg.trackId);
    }
  }

  private broadcast(msg: RoomMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // ignore closed channel
      }
    }
    for (const conn of this.dataConns.values()) {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {
          // ignore send errors
        }
      }
    }
  }

  public sendRaceStart(trackId: TrackId): void {
    this.broadcast({
      type: 'start',
      senderId: this.localId,
      trackId,
    });
  }

  public sendRacerUpdate(update: NetworkRacerUpdate): void {
    this.broadcast({
      type: 'state',
      senderId: this.localId,
      update,
    });
  }

  public getRemoteUpdates(): Map<string, NetworkRacerUpdate> {
    return this.remoteUpdates;
  }

  public getSlots(): LobbySlot[] {
    const slots: LobbySlot[] = [];

    // Slot 0: Local Player
    slots.push({
      slotIndex: 0,
      id: this.localId,
      name: this.localName,
      bikeId: this.localBike,
      isLocal: true,
      isHuman: true,
      isAI: false,
      isSpeaking: this.localSpeaking,
    });

    // Connected Human Peers (up to 4)
    for (const remote of this.remotePlayers.values()) {
      if (slots.length >= 5) break;
      slots.push({
        slotIndex: slots.length,
        id: remote.id,
        name: remote.name,
        bikeId: remote.bikeId,
        isLocal: false,
        isHuman: true,
        isAI: false,
        isSpeaking: remote.isSpeaking,
      });
    }

    // Fill remaining slots with competitive named AI racers so race always has 5 bikes
    let aiIdx = 0;
    while (slots.length < 5 && aiIdx < AI_RACER_PROFILES.length) {
      const profile = AI_RACER_PROFILES[aiIdx];
      slots.push({
        slotIndex: slots.length,
        id: `ai_${aiIdx}`,
        name: profile.name,
        bikeId: profile.bikeId,
        isLocal: false,
        isHuman: false,
        isAI: true,
        isSpeaking: false,
      });
      aiIdx++;
    }

    return slots;
  }

  private emitSlots(): void {
    this.onSlotsChanged?.(this.getSlots());
  }

  // ========================
  // WebRTC Real-Time Voice Chat
  // ========================
  public async toggleMic(): Promise<void> {
    if (this.micEnabled) {
      this.micEnabled = false;
      this.localSpeaking = false;
      if (this.localStream) {
        for (const t of this.localStream.getAudioTracks()) {
          t.enabled = false;
        }
      }
      if (this.vadTimer) {
        window.clearInterval(this.vadTimer);
        this.vadTimer = null;
      }
      this.broadcast({ type: 'voice', senderId: this.localId, isSpeaking: false });
      this.onVoiceStateChanged?.(false, this.speakerMuted, false);
      this.emitSlots();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onVoiceStateChanged?.(false, this.speakerMuted, false, 'Microphone API unavailable in this browser');
      return;
    }

    try {
      if (!this.localStream) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } else {
        for (const t of this.localStream.getAudioTracks()) {
          t.enabled = true;
        }
      }

      this.micEnabled = true;
      this.startVad(this.localStream);

      // Call any already-connected peers
      if (this.peer) {
        for (const remotePeerId of this.dataConns.keys()) {
          if (!this.mediaConns.has(remotePeerId)) {
            const call = this.peer.call(remotePeerId, this.localStream);
            this.attachMediaConn(call);
          }
        }
      }

      this.onVoiceStateChanged?.(true, this.speakerMuted, this.localSpeaking);
    } catch {
      this.micEnabled = false;
      this.onVoiceStateChanged?.(false, this.speakerMuted, false, 'Microphone permission denied');
    }
  }

  public toggleSpeaker(): void {
    this.speakerMuted = !this.speakerMuted;
    for (const audio of this.remoteAudios.values()) {
      audio.muted = this.speakerMuted;
    }
    this.onVoiceStateChanged?.(this.micEnabled, this.speakerMuted, this.localSpeaking);
  }

  private startVad(stream: MediaStream): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.vadCtx) {
        this.vadCtx = new AudioCtx();
      }
      if (this.vadCtx.state === 'suspended') {
        void this.vadCtx.resume().catch(() => {});
      }

      const src = this.vadCtx.createMediaStreamSource(stream);
      const analyser = this.vadCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      this.vadAnalyser = analyser;
    } catch {
      return;
    }

    if (!this.vadAnalyser) return;
    const data = new Uint8Array(this.vadAnalyser.frequencyBinCount);
    if (this.vadTimer) window.clearInterval(this.vadTimer);

    this.vadTimer = window.setInterval(() => {
      if (!this.micEnabled || !this.vadAnalyser) return;
      this.vadAnalyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      const speaking = avg > 14;
      if (speaking !== this.localSpeaking) {
        this.localSpeaking = speaking;
        this.broadcast({ type: 'voice', senderId: this.localId, isSpeaking: speaking });
        this.onVoiceStateChanged?.(this.micEnabled, this.speakerMuted, speaking);
        this.emitSlots();
      }
    }, 120);
  }

  private handleIncomingCall(call: MediaConnection): void {
    // Answer with local audio stream if mic is active, otherwise empty stream
    if (this.localStream) {
      call.answer(this.localStream);
    } else {
      call.answer();
    }
    this.attachMediaConn(call);
  }

  private attachMediaConn(call: MediaConnection): void {
    this.mediaConns.set(call.peer, call);
    call.on('stream', (remoteStream) => {
      let audio = this.remoteAudios.get(call.peer);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        this.remoteAudios.set(call.peer, audio);
      }
      audio.srcObject = remoteStream;
      audio.muted = this.speakerMuted;
      void audio.play().catch(() => {
        // autoplay policy may defer until user gesture
      });
    });
    call.on('close', () => {
      this.mediaConns.delete(call.peer);
      const audio = this.remoteAudios.get(call.peer);
      if (audio) {
        audio.srcObject = null;
        this.remoteAudios.delete(call.peer);
      }
    });
  }

  public disconnectRoom(): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.broadcast({ type: 'leave', senderId: this.localId });

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    for (const conn of this.dataConns.values()) conn.close();
    this.dataConns.clear();
    for (const mc of this.mediaConns.values()) mc.close();
    this.mediaConns.clear();
    for (const audio of this.remoteAudios.values()) {
      audio.srcObject = null;
    }
    this.remoteAudios.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.remotePlayers.clear();
    this.remoteUpdates.clear();
  }

  public dispose(): void {
    this.disconnectRoom();
    if (this.vadTimer) {
      window.clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    if (this.vadCtx) {
      void this.vadCtx.close();
      this.vadCtx = null;
    }
  }
}
