import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarBadgeProps {
  src?: string;
  name: string;
  size?: AvatarSize;
  highlight?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

const ICON_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-7 w-7',
  xl: 'h-9 w-9',
};

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  src,
  name,
  size = 'sm',
  highlight = false,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const borderClass = highlight
    ? 'border-amber-400 ring-1 ring-amber-400/50'
    : 'border-white/25';

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border bg-slate-900 ${SIZE_CLASSES[size]} ${borderClass} ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-300">
          <User className={ICON_CLASSES[size]} />
        </div>
      )}
    </div>
  );
};
