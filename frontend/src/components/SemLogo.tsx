interface SemLogoProps {
  height?: number;
  color?: string;
  className?: string;
}

export default function SemLogo({ height = 40, color = 'currentColor', className }: SemLogoProps) {
  const width = Math.round(height * (620 / 200));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 620 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SEM – Social Event Mapper"
      role="img"
    >
      {/* Location pin */}
      <g transform="translate(140, 100) scale(0.48) translate(-55, -80)">
        <path
          d="
            M55,0
            C24.6,0 0,24.6 0,55
            C0,85.4 55,164 55,164
            C55,164 110,85.4 110,55
            C110,24.6 85.4,0 55,0 Z

            M55,57
            m-30,0
            a30,30 0 1,0 60,0
            a30,30 0 1,0 -60,0
          "
          fill={color}
          fillRule="evenodd"
        />
      </g>

      {/* SEM text */}
      <text
        x="180"
        y="110"
        dominantBaseline="middle"
        fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        fontSize="110"
        fontWeight="900"
        fontStyle="italic"
        fill={color}
        letterSpacing="-3"
      >
        SEM
      </text>
    </svg>
  );
}
