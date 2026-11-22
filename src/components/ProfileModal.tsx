import React, { useRef, useState } from 'react';
import {
  Check,
  Coins,
  Flame,
  LogOut,
  Phone,
  Save,
  Trophy,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { UserProfile } from '../types/game';
import { BUILTIN_AVATARS, DEFAULT_AVATAR, compressAvatarImage } from '../utils/avatars';
import { AvatarBadge } from './AvatarBadge';

interface ProfileModalProps {
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  onSave,
  onLogout,
  onClose,
}) => {
  const [name, setName] = useState<string>(profile.name);
  const [avatar, setAvatar] = useState<string>(profile.avatar || DEFAULT_AVATAR);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const compressed = await compressAvatarImage(file);
      setAvatar(compressed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...profile,
      name: name.trim().slice(0, 18) || profile.name,
      avatar: avatar || DEFAULT_AVATAR,
    });
    onClose();
  };

  return (
    <div
      style={{ zIndex: 10000 }}
      className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#060911]/82 p-4 overflow-y-auto"
    >
      <div className="my-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0b101b] p-5 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              JIT BIKE RACE
            </div>
            <h2 className="font-display text-xl font-bold text-white">My Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Account Summary & Career Stats */}
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              {profile.isGuest ? (
                <>
                  <UserRound className="h-3.5 w-3.5 text-slate-400" />
                  <span>Guest Session</span>
                </>
              ) : (
                <>
                  <Phone className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono-num font-semibold text-white">
                    {profile.phone}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Coins className="h-3.5 w-3.5" />
              <span className="font-mono-num">{profile.coins} Coins</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-white/10 pt-3 text-center">
            <div>
              <div className="font-mono-num text-sm font-bold text-white">
                {profile.stats.races}
              </div>
              <div className="text-[10px] text-slate-400">Races</div>
            </div>
            <div>
              <div className="font-mono-num flex items-center justify-center gap-0.5 text-sm font-bold text-amber-400">
                <Trophy className="h-3 w-3" />
                {profile.stats.wins}
              </div>
              <div className="text-[10px] text-slate-400">Wins</div>
            </div>
            <div>
              <div className="font-mono-num text-sm font-bold text-emerald-400">
                {profile.stats.podiums}
              </div>
              <div className="text-[10px] text-slate-400">Podiums</div>
            </div>
            <div>
              <div className="font-mono-num flex items-center justify-center gap-0.5 text-sm font-bold text-cyan-300">
                <Flame className="h-3 w-3" />
                {profile.stats.bestWheelie}
              </div>
              <div className="text-[10px] text-slate-400">Wheelie</div>
            </div>
          </div>
        </div>

        {/* Editable Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <AvatarBadge src={avatar} name={name || 'Racer'} size="lg" highlight />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">Profile Picture</div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Auto-resized to 100×100 for fast multiplayer sync.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 cursor-pointer disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5 text-amber-400" />
                <span>{uploading ? 'Compressing...' : 'Upload from Device'}</span>
              </button>
              {uploadError && (
                <p className="mt-1 text-[11px] text-rose-400">{uploadError}</p>
              )}
            </div>
          </div>

          {/* 6 Built-in Helmet Avatars */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-300">
              Built-in Biker Avatars
            </div>
            <div className="grid grid-cols-6 gap-2">
              {BUILTIN_AVATARS.map((item) => {
                const selected = avatar === item.dataUrl;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    onClick={() => setAvatar(item.dataUrl)}
                    className={`relative flex aspect-square items-center justify-center rounded-full border-2 p-0.5 transition-transform cursor-pointer ${
                      selected
                        ? 'scale-105 border-amber-400 bg-amber-500/20'
                        : 'border-white/15 bg-slate-900 hover:border-white/40'
                    }`}
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.label}
                      className="h-full w-full rounded-full object-cover"
                    />
                    {selected && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-slate-950">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Name */}
          <div>
            <label
              htmlFor="profile-name-input"
              className="block text-xs font-medium text-slate-300"
            >
              Player Name
            </label>
            <input
              id="profile-name-input"
              type="text"
              maxLength={18}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter racer name"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-amber-400"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/22 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Switch Number / Logout</span>
            </button>

            <button
              type="submit"
              className="font-display flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
