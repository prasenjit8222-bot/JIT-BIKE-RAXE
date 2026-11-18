import React from 'react';
import { Award, RotateCcw, SlidersHorizontal, Trophy } from 'lucide-react';
import { BIKES, TRACKS } from '../data/catalog';
import { RaceStanding, TrackId } from '../types/game';

interface PodiumModalProps {
  trackId: TrackId;
  standings: RaceStanding[];
  onPlayAgain: () => void;
  onChangeTrack: () => void;
}

export const PodiumModal: React.FC<PodiumModalProps> = ({
  trackId,
  standings,
  onPlayAgain,
  onChangeTrack,
}) => {
  const localPlayer = standings.find((s) => s.isLocal);
  const track = TRACKS[trackId];

  return (
    <div
      style={{ zIndex: 9999 }}
      className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-slate-950/70 p-4"
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#0b101b] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/70 bg-white p-0.5 shadow-md">
              <img
                src="./assets/aistudio/image_74ce4eb9.png"
                alt="JIT BIKE RACE Logo"
                className="h-full w-full rounded-full object-contain"
              />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-amber-400">
                JIT BIKE RACE · {track.name} · Official Results
              </div>
              <h2 className="font-display mt-0.5 text-2xl font-bold text-white">
                {localPlayer && localPlayer.rank <= 3
                  ? `Podium Finish — #${localPlayer.rank}`
                  : `Race Complete — #${localPlayer?.rank ?? 1}`}
              </h2>
            </div>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            {localPlayer?.rank === 1 ? <Trophy className="h-6 w-6" /> : <Award className="h-6 w-6" />}
          </div>
        </div>

        {/* 1st - 5th Standings Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-3.5 py-2.5 font-medium">Pos</th>
                <th className="px-3.5 py-2.5 font-medium">Rider</th>
                <th className="hidden px-3.5 py-2.5 font-medium sm:table-cell">Machine</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Wheelie</th>
                <th className="px-3.5 py-2.5 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {standings.map((row) => (
                <tr
                  key={row.id}
                  className={row.isLocal ? 'bg-amber-500/12 font-semibold text-white' : 'text-slate-300'}
                >
                  <td className="font-mono-num px-3.5 py-2.5 text-amber-400">
                    #{row.rank}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {row.name}
                    {row.isLocal && (
                      <span className="ml-1.5 text-[11px] font-normal text-amber-300">(You)</span>
                    )}
                  </td>
                  <td className="hidden px-3.5 py-2.5 text-slate-400 sm:table-cell">
                    {BIKES[row.bikeId].name}
                  </td>
                  <td className="font-mono-num px-3.5 py-2.5 text-right text-cyan-300">
                    {row.wheelieScore}
                  </td>
                  <td className="font-mono-num px-3.5 py-2.5 text-right text-white">
                    {formatMs(row.finishTimeMs ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onChangeTrack}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 whitespace-nowrap cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Change Track / Garage</span>
          </button>

          <button
            type="button"
            onClick={onPlayAgain}
            className="font-display flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function formatMs(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
