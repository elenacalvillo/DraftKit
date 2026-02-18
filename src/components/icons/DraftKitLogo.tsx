import { useId } from "react";

export function DraftKitLogo({ size = 32 }: { size?: number }) {
  const uid = useId();
  const patternId = `dk-lines-${uid}`;
  const clipId = `dk-clip-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="8"
          height="8"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="#e29e8d" strokeWidth="3" />
        </pattern>
        <clipPath id={clipId}>
          <circle cx="85" cy="100" r="45" />
        </clipPath>
      </defs>

      {/* Hatched overlap fill — right circle's area clipped to left circle shape */}
      <circle
        cx="115"
        cy="100"
        r="45"
        fill={`url(#${patternId})`}
        clipPath={`url(#${clipId})`}
        opacity="1"
      />
      {/* Left circle outline — dark */}
      <circle cx="85" cy="100" r="45" stroke="#2a2318" strokeWidth="3" />
      {/* Right circle outline — coral */}
      <circle cx="115" cy="100" r="45" stroke="#e07b6c" strokeWidth="3" />
    </svg>
  );
}
