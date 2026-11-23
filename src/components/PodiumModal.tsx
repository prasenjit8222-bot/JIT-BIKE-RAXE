import React, { useState } from 'react';
import {
  Award,
  Check,
  Coins,
  Download,
  Gift,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Wrench,
} from 'lucide-react';
import { BIKES, GAME_MODE_LIST, REWARD_ITEMS, TRACKS } from '../data/catalog';
import { BikeId, RaceFinishSummary, RewardItemId } from '../types/game';
import { shareOrDownloadScorecard } from '../utils/scorecard';
import { AvatarBadge } from './AvatarBadge';

interface PodiumModalProps {
  summary: RaceFinishSummary;
  playerName: string;
  playerAvatar: string;
  bikeId: BikeId;
  coinsEarned: number;
  wonItem: RewardItemId | null;
  wonItemDuplicateBonus: number;
  onOpenGarage: () => void;
  onPlayAgain: () => void;
  onChangeTrack: () => void;
}

export const PodiumModal: React.FC<PodiumModalProps> = ({
  summary,
  playerName,
  playerAvatar,
  bikeId,
  coinsEarned,
  wonItem,
  wonItemDuplicateBonus,
  onOpenGarage,
  onPlayAgain,
  onChangeTrack,
}) => {
  const [crateOpened, setCrateOpened] = useState<boolean>(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'shared' | 'downloaded'>('idle');

  const localPlayer = summary.standings.find((s) => s.isLocal);
  const winner = summary.standings[0];
  const track = TRACKS[summary.trackId];
  const modeInfo = GAME_MODE_LIST.find((m) => m.id === summary.gameMode) ?? GAME_MODE_LIST[0];
  const rewardSpec = wonItem ? REWARD_ITEMS[wonItem] : null;
  const localRank = localPlayer?.rank ?? 1;

  const headline = (() => {
    if (summary.gameMode === 'endless') {
      return `Endless Run — ${(summary.distanceM / 1000).toFixed(2)} km`;
    }
    if (summary.endReason === 'eliminated') {
      return `Knocked Out — Finished #${localRank}`;
    }
    if (summary.endReason === 'time_up') {
      return `Checkpoint Time Up — ${(summary.distanceM / 1000).toFixed(1)} km`;
    }
    if (summary.endReason === 'wrecked') {
      return `Bike Wrecked — ${(summary.distanceM / 1000).toFixed(1)} km`;
    }
    if (localRank <= 3) {
      return `Podium Finish — #${localRank}`;
    }
    return `Race Complete — #${localRank}`;
  })();

  const handleShareScorecard = async () => {
    if (shareStatus === 'working') return;
    setShareStatus('working');
    const result = await shareOrDownloadScorecard({
      playerName,
      playerAvatar,
      rank: localRank,
      bikeId,
      trackId: summary.trackId,
      gameMode: summary.gameMode,
      weather: summary.weather,
      elapsedMs: summary.elapsedMs,
      topSpeedKmh: summary.topSpeedKmh,
      distanceM: summary.distanceM,
      coinsEarned,
      wonItem,
    });
    if (result === 'shared') {
      setShareStatus('shared');
    } else if (result === 'downloaded') {
      setShareStatus('downloaded');
    } else {
      setShareStatus('idle');
    }
    window.setTimeout(() => setShareStatus('idle'), 3000);
  };

  return (
    <div
      style={{ zIndex: 9999 }}
      className="pointer-events-auto fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-950/78 p-3 sm:p-4"
    >
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0b101b] p-4 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/75 bg-white p-0.5 shadow-md">
              <img
                src="./assets/aistudio/image_74ce4eb9.png"
                alt="JIT BIKE RACE Logo"
                className="h-full w-full rounded-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold tracking-wide text-amber-400">
                JIT BIKE RACE · {track.name} · {modeInfo.name}
              </div>
              <h2 className="font-display mt-0.5 truncate text-lg font-bold text-white sm:text-2xl">
                {headline}
              </h2>
            </div>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            {localRank === 1 ? <Trophy className="h-6 w-6" /> : <Award className="h-6 w-6" />}
          </div>
        </div>

        {/* Interactive Victory Reward Crate / Tool Drop */}
        {rewardSpec && (
          <div className="mt-3.5 rounded-xl border border-amber-400/45 bg-gradient-to-r from-amber-500/15 via-slate-900/95 to-cyan-500/12 p-3.5">
            {!crateOpened ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-500/20 text-amber-300">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                      Victory Reward Crate Earned!
                    </div>
                    <div className="text-xs text-slate-300">
                      Tap to unlock a rare performance tool or superbike blueprint.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCrateOpened(true)}
                  className="font-display flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition-transform hover:scale-[1.02] hover:bg-amber-300 whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Open Reward Crate</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25"
                    style={{ backgroundColor: `${rewardSpec.accentColor}26`, color: rewardSpec.accentColor }}
                  >
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Unlocked Tool
                      </span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                        {rewardSpec.bonusLabel}
                      </span>
                    </div>
                    <div className="font-display mt-0.5 truncate text-sm font-bold text-white">
                      {rewardSpec.name}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {wonItemDuplicateBonus > 0
                        ? `Already owned — converted to +${wonItemDuplicateBonus} Bonus Coins!`
                        : rewardSpec.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenGarage}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 whitespace-nowrap cursor-pointer"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Equip in Garage</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* JIT BIKE RACE Scorecard Telemetry Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Race Time" value={formatMs(summary.elapsedMs)} />
          <MetricCard label="Top Speed" value={`${Math.round(summary.topSpeedKmh)} KM/H`} accent="text-cyan-300" />
          <MetricCard label="Distance" value={`${(summary.distanceM / 1000).toFixed(2)} km`} />
          <MetricCard
            label="Coins Earned"
            value={`+${coinsEarned}`}
            accent="text-amber-300"
            icon={<Coins className="h-3.5 w-3.5 text-amber-400" />}
          />
        </div>

        {/* Winner Showcase Strip */}
        {winner && summary.gameMode !== 'endless' && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <AvatarBadge src={winner.avatar} name={winner.name} size="md" highlight />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Trophy className="h-3 w-3" />
                  <span>Race Winner</span>
                </div>
                <div className="font-display truncate text-sm font-bold text-white">
                  {winner.name}
                  {winner.isLocal && (
                    <span className="ml-1.5 text-xs font-normal text-amber-300">(You)</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-300">
              <div>{BIKES[winner.bikeId].name}</div>
              <div className="font-mono-num font-semibold text-white">
                {formatMs(winner.finishTimeMs ?? summary.elapsedMs)}
              </div>
            </div>
          </div>
        )}

        {/* 1st - 5th Standings Table */}
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-3 py-2 font-medium">Pos</th>
                <th className="px-3 py-2 font-medium">Rider</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Machine</th>
                <th className="px-3 py-2 text-right font-medium">Wheelie</th>
                <th className="px-3 py-2 text-right font-medium">
                  {summary.gameMode === 'endless' ? 'Distance' : 'Time / Status'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {summary.standings.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.isLocal
                      ? 'bg-amber-500/12 font-semibold text-white'
                      : row.eliminated
                        ? 'text-slate-500'
                        : 'text-slate-300'
                  }
                >
                  <td className="font-mono-num px-3 py-2 text-amber-400">#{row.rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AvatarBadge
                        src={row.avatar}
                        name={row.name}
                        size="xs"
                        highlight={row.isLocal || row.rank === 1}
                      />
                      <span className="truncate">
                        {row.name}
                        {row.isLocal && (
                          <span className="ml-1 text-[10px] font-normal text-amber-300">(You)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-slate-400 sm:table-cell">
                    {BIKES[row.bikeId].name}
                  </td>
                  <td className="font-mono-num px-3 py-2 text-right text-cyan-300">
                    {row.wheelieScore}
                  </td>
                  <td className="font-mono-num px-3 py-2 text-right text-white">
                    {summary.gameMode === 'endless'
                      ? `${(row.distanceZ / 1000).toFixed(2)} km`
                      : row.eliminated
                        ? 'KO'
                        : formatMs(row.finishTimeMs ?? summary.elapsedMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions including Share / Download Scorecard */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleShareScorecard}
            disabled={shareStatus === 'working'}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            {shareStatus === 'shared' || shareStatus === 'downloaded' ? (
              <Check className="h-4 w-4 text-emerald-300" />
            ) : shareStatus === 'working' ? (
              <Download className="h-4 w-4" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            <span>
              {shareStatus === 'shared'
                ? 'Scorecard Shared!'
                : shareStatus === 'downloaded'
                  ? 'Scorecard PNG Saved!'
                  : shareStatus === 'working'
                    ? 'Generating...'
                    : 'Share / Download Scorecard'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenGarage}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3.5 py-2.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/25 whitespace-nowrap cursor-pointer"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Garage</span>
            </button>

            <button
              type="button"
              onClick={onChangeTrack}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Lobby</span>
            </button>

            <button
              type="button"
              onClick={onPlayAgain}
              className="font-display flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Play Again</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
}> = ({ label, value, accent = 'text-white', icon }) => (
  <div className="rounded-xl border border-white/10 bg-slate-900/75 px-3 py-2">
    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
    <div className={`font-mono-num mt-0.5 flex items-center gap-1 text-sm font-bold ${accent}`}>
      {icon}
      <span>{value}</span>
    </div>
  </div>
);

function formatMs(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
