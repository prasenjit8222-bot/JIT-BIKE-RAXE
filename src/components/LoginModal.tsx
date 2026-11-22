import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Coins,
  Phone,
  Upload,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { UserProfile } from '../types/game';
import { BUILTIN_AVATARS, DEFAULT_AVATAR, compressAvatarImage } from '../utils/avatars';
import {
  createGuestProfile,
  createNewPhoneProfile,
  getProfileByPhone,
  isValidPhone,
  normalizePhone,
  saveProfile,
} from '../utils/profileStorage';
import { AvatarBadge } from './AvatarBadge';

interface LoginModalProps {
  savedSession: UserProfile | null;
  onComplete: (profile: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ savedSession, onComplete }) => {
  const [step, setStep] = useState<'login' | 'setup'>('login');
  const [phoneInput, setPhoneInput] = useState<string>(
    savedSession && !savedSession.isGuest && savedSession.phone ? savedSession.phone : ''
  );
  const [error, setError] = useState<string | null>(null);

  // Step 2: New Mobile Number Profile Setup
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);
  const [setupName, setSetupName] = useState<string>('');
  const [setupAvatar, setSetupAvatar] = useState<string>(DEFAULT_AVATAR);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = normalizePhone(e.target.value);
    setPhoneInput(clean);
    if (error) setError(null);
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizePhone(phoneInput);
    if (!isValidPhone(clean)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    const existing = getProfileByPhone(clean);
    if (existing) {
      const saved = saveProfile(existing);
      onComplete(saved);
      return;
    }

    // New mobile number -> award 500 welcome coins and prompt for Name + Profile Picture
    const created = createNewPhoneProfile(clean);
    setPendingProfile(created);
    setSetupName(created.name);
    setSetupAvatar(created.avatar);
    setStep('setup');
  };

  const handlePlayAsGuest = () => {
    const guest = createGuestProfile();
    onComplete(guest);
  };

  const handleResumeSession = () => {
    if (!savedSession) return;
    const saved = saveProfile(savedSession);
    onComplete(saved);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const compressed = await compressAvatarImage(file);
      setSetupAvatar(compressed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingProfile) return;
    const updated = saveProfile({
      ...pendingProfile,
      name: setupName.trim() || pendingProfile.name,
      avatar: setupAvatar || DEFAULT_AVATAR,
    });
    onComplete(updated);
  };

  const handleSkipSetup = () => {
    if (!pendingProfile) return;
    const saved = saveProfile({
      ...pendingProfile,
      avatar: DEFAULT_AVATAR,
    });
    onComplete(saved);
  };

  return (
    <div
      style={{ zIndex: 10000 }}
      className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#060911]/88 p-4 overflow-y-auto"
    >
      <div className="my-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0b101b] p-5 shadow-2xl sm:p-6">
        {/* Branding Header */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-white p-0.5 shadow-md">
            <img
              src="./assets/aistudio/image_74ce4eb9.png"
              alt="JIT BIKE RACE Logo"
              className="h-full w-full rounded-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              JIT BIKE RACE
            </div>
            <h2 className="font-display text-xl font-bold text-white">
              {step === 'login' ? 'Player Login' : 'Racer Profile Setup'}
            </h2>
          </div>
        </div>

        {step === 'login' ? (
          <div className="mt-4 space-y-4">
            {/* Optional Quick-Resume for Returning Session */}
            {savedSession && (
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarBadge
                      src={savedSession.avatar}
                      name={savedSession.name}
                      size="md"
                      highlight
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {savedSession.name}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-300">
                        <span className="font-mono-num">
                          {savedSession.isGuest ? 'Guest Racer' : savedSession.phone}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num inline-flex items-center gap-1 font-semibold text-amber-300">
                          <Coins className="h-3 w-3" />
                          {savedSession.coins}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResumeSession}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Continue</span>
                  </button>
                </div>
              </div>
            )}

            {/* Instant 10-Digit Mobile Number Form */}
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-mobile-input"
                    className="text-xs font-medium text-slate-300"
                  >
                    10-Digit Mobile Number
                  </label>
                  <span className="font-mono-num text-[11px] text-slate-400">
                    {phoneInput.length} / 10
                  </span>
                </div>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-mobile-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    placeholder="Enter 10-digit number"
                    className="font-mono-num w-full rounded-lg border border-white/15 bg-slate-900/90 py-2.5 pl-9 pr-3 text-sm font-semibold tracking-wider text-white outline-none transition-colors focus:border-amber-400"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Instant login with no OTP or PIN. Returning numbers restore saved coins, stats, and photo; new numbers start with 500 coins.
                </p>
                {error && <p className="mt-1.5 text-xs font-medium text-rose-400">{error}</p>}
              </div>

              <button
                type="submit"
                className="font-display flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold tracking-wide text-slate-950 transition-colors hover:bg-amber-400 cursor-pointer"
              >
                <span>Enter Garage</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] font-medium text-slate-500">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handlePlayAsGuest}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 cursor-pointer"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              <span>Play as Guest</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveSetup} className="mt-4 space-y-4">
            {/* Welcome Bonus Strip */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3.5 py-2.5">
              <div>
                <div className="text-xs font-bold text-emerald-300">
                  New Profile Created!
                </div>
                <div className="font-mono-num text-[11px] text-slate-300">
                  Mobile: {pendingProfile?.phone}
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300">
                <Coins className="h-3.5 w-3.5" />
                <span className="font-mono-num">+500 Coins</span>
              </div>
            </div>

            {/* Avatar Preview + Upload Button */}
            <div className="flex items-center gap-4">
              <AvatarBadge src={setupAvatar} name={setupName || 'Racer'} size="lg" highlight />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white">Profile Picture</div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Visible above your bike and on multiplayer leaderboards.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 cursor-pointer disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5 text-amber-400" />
                  <span>{uploading ? 'Compressing...' : 'Upload Photo'}</span>
                </button>
                {uploadError && (
                  <p className="mt-1 text-[11px] text-rose-400">{uploadError}</p>
                )}
              </div>
            </div>

            {/* 6 Built-in Biker/Helmet Avatars */}
            <div>
              <div className="mb-2 text-xs font-medium text-slate-300">
                Or Pick a Biker Helmet Avatar
              </div>
              <div className="grid grid-cols-6 gap-2">
                {BUILTIN_AVATARS.map((item) => {
                  const selected = setupAvatar === item.dataUrl;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => setSetupAvatar(item.dataUrl)}
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

            {/* Player Name Input */}
            <div>
              <label
                htmlFor="setup-player-name"
                className="block text-xs font-medium text-slate-300"
              >
                Player Name
              </label>
              <input
                id="setup-player-name"
                type="text"
                maxLength={18}
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="Enter your racer name"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900/90 px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-amber-400"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleSkipSetup}
                className="rounded-lg border border-white/15 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 whitespace-nowrap cursor-pointer"
              >
                Skip (Default)
              </button>
              <button
                type="submit"
                className="font-display flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
              >
                <span>Save &amp; Race</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
