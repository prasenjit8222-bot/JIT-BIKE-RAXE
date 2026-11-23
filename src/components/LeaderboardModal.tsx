import React from 'react';
import { Gauge, Route, Trophy, X } from 'lucide-react';
import { LeaderboardEntry } from '../types/game';
import { AvatarBadge } from './AvatarBadge';

interface LeaderboardModalProps {
  entries: LeaderboardEntry[];
  onClose: () => void;
}

function formatBestTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '--:--.--';
  const totalSec = Math.max(0, ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ entries, onClose }) => {
  return (
    <div
      style={{ zIndex: 10000 }}
      className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#060911]/84 p-4 overflow-y-auto"
    >
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0b101b] p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                JIT BIKE RACE
              </div>
              <h2 className="font-display text-xl font-bold text-white">Global Leaderboard</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Leaderboard"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scroll mt-4 max-h-[62vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-3 py-2.5 font-medium">Rank</th>
                <th className="px-3 py-2.5 font-medium">Racer</th>
                <th className="px-3 py-2.5 text-right font-medium">Wins</th>
                <th className="px-3 py-2.5 text-right font-medium">Best Race</th>
                <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-3 w-3" /> Endless
                  </span>
                </th>
                <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3 w-3" /> Top Speed
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((entry, idx) => (
                <tr
                  key={entry.id}
                  className={
                    entry.isLocal
                      ? 'bg-amber-500/14 font-semibold text-white'
                      : 'text-slate-300'
                  }
                >
                  <td className="font-mono-num px-3 py-2.5 font-bold text-amber-400">
                    #{idx + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <AvatarBadge
                        src={entry.avatar}
                        name={entry.name}
                        size="sm"
                        highlight={entry.isLocal || idx === 0}
                      />
                      <span className="truncate">
                        {entry.name}
                        {entry.isLocal && (
                          <span className="ml-1.5 text-[11px] font-normal text-amber-300">
                            (You)
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono-num px-3 py-2.5 text-right font-bold text-emerald-400">
                    {entry.wins}
                  </td>
                  <td className="font-mono-num px-3 py-2.5 text-right text-white">
                    {formatBestTime(entry.bestRaceTimeMs)}
                  </td>
                  <td className="font-mono-num hidden px-3 py-2.5 text-right text-cyan-300 sm:table-cell">
                    {(entry.bestEndlessMeters / 1000).toFixed(1)} km
                  </td>
                  <td className="font-mono-num hidden px-3 py-2.5 text-right text-slate-300 md:table-cell">
                    {entry.topSpeedKmh > 0 ? `${entry.topSpeedKmh} km/h` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
