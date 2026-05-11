import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CircularTimerProps {
  remaining: number;
  total?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

export default function CircularTimer({
  remaining,
  total = 10,
  size = 54,
  strokeWidth = 4,
  color = '#7C3AED',
  trackColor = '#F3F4F6',
  textColor,
}: CircularTimerProps & { textColor?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Ensure progress is between 0 and 1
  const progress = Math.min(Math.max(remaining / total, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.content}>
          <Text style={[styles.text, { fontSize: size * 0.35, color: textColor ?? color }]}>
            {Math.max(0, Math.ceil(remaining))}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    transform: [{ rotate: '0deg' }],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
