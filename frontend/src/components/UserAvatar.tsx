import { useState, useEffect } from 'react';
import './UserAvatar.css';

export type UserAvatarVariant = 'accent' | 'muted';

export interface UserAvatarProps {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md';
  variant?: UserAvatarVariant;
}

function initialLetter(username: string, displayName?: string | null): string {
  const from = displayName?.trim() || username;
  return from.charAt(0).toUpperCase() || '?';
}

function hasUsableSrc(src: string | null | undefined): boolean {
  return typeof src === 'string' && src.trim().length > 0;
}

export function UserAvatar({
  username,
  displayName,
  avatarUrl,
  className = '',
  size = 'sm',
  variant = 'muted',
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);
  const showImg = hasUsableSrc(avatarUrl) && !failed;
  const letter = initialLetter(username, displayName);
  const sizeClass = size === 'md' ? 'user-avatar--md' : 'user-avatar--sm';
  const variantClass = variant === 'accent' ? 'user-avatar--accent' : 'user-avatar--muted';

  return (
    <div className={`user-avatar ${sizeClass} ${variantClass} ${className}`.trim()}>
      {showImg ? (
        <img
          src={avatarUrl!.trim()}
          alt=""
          className="user-avatar-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="user-avatar-fallback">{letter}</span>
      )}
    </div>
  );
}
