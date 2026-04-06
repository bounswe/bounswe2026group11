import { useState } from 'react';
import './EventCoverImage.css';

function MountainMark() {
  return (
    <svg
      className="event-cover-mountain-svg"
      viewBox="0 0 80 56"
      aria-hidden
      focusable="false"
    >
      <path
        className="event-cover-mountain-sun"
        d="M58 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0z"
      />
      <path
        className="event-cover-mountain-back"
        d="M8 52 L32 18 L52 52 H8 Z"
      />
      <path
        className="event-cover-mountain-front"
        d="M28 52 L44 28 L72 52 H28 Z"
      />
    </svg>
  );
}

function hasUsableSrc(src: string | null | undefined): boolean {
  return typeof src === 'string' && src.trim().length > 0;
}

type Variant = 'card' | 'hero';

export interface EventCoverImageProps {
  src: string | null | undefined;
  alt: string;
  /** Applied to the real `<img>` when shown */
  imgClassName: string;
  variant: Variant;
}

export function EventCoverImage({ src, alt, imgClassName, variant }: EventCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const show = hasUsableSrc(src) && !failed;

  if (!show) {
    return (
      <div
        className={`event-cover-placeholder event-cover-placeholder--${variant}`}
        aria-hidden
      >
        <MountainMark />
      </div>
    );
  }

  return (
    <img
      src={src!.trim()}
      alt={alt}
      className={imgClassName}
      onError={() => setFailed(true)}
    />
  );
}
