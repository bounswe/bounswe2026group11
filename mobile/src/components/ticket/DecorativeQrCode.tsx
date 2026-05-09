import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'qrcode';

interface DecorativeQrCodeProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function DecorativeQrCode({
  value,
  size = 180,
  color = '#111827',
  backgroundColor = '#FFFFFF',
}: DecorativeQrCodeProps) {
  const qrCode = React.useMemo(() => {
    try {
      return QRCode.create(value, {
        errorCorrectionLevel: 'M',
        margin: 0,
      });
    } catch {
      return null;
    }
  }, [value]);

  const cellCount = qrCode?.modules.size ?? 21;
  const padding = 8;
  const cellSize = (size - padding * 2) / cellCount;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} rx={18} fill={backgroundColor} />
      {Array.from({ length: cellCount }, (_, row) =>
        Array.from({ length: cellCount }, (_, col) => {
          const shouldFill = qrCode?.modules.get?.(row, col) ?? false;
          if (!shouldFill) {
            return null;
          }

          return (
            <Rect
              key={`${row}-${col}`}
              x={padding + col * cellSize}
              y={padding + row * cellSize}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={2}
              fill={color}
            />
          );
        }),
      )}
    </Svg>
  );
}
