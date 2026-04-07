import React from 'react';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

interface SemLogoProps {
  height?: number;
  color?: string;
}

export default function SemLogo({
  height = 32,
  color = '#111827',
}: SemLogoProps) {
  const width = Math.round(height * (470 / 200));

  return (
    <Svg
      width={width}
      height={height}
      viewBox="88 0 470 200"
      testID="sem-logo"
      accessibilityLabel="SEM – Social Event Mapper"
    >
      <G transform="translate(140, 100) scale(0.48) translate(-55, -80)">
        <Path
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
      </G>

      <SvgText
        x="180"
        y="145"
        fontSize="110"
        fontWeight="900"
        fontStyle="italic"
        fill={color}
        letterSpacing="-3"
      >
        SEM
      </SvgText>
    </Svg>
  );
}
