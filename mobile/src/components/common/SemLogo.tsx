import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SemLogoProps {
  size?: 'sm' | 'lg';
}

export default function SemLogo({ size = 'lg' }: SemLogoProps) {
  const s = size === 'sm' ? small : large;
  return (
    <View style={styles.row}>
      <View style={styles.pinContainer}>
        <View style={[styles.pinCircle, s.pinCircle]}>
          <View style={[styles.pinHole, s.pinHole]} />
        </View>
        <View style={[styles.pinPointer, s.pinPointer]} />
      </View>
      <Text style={[styles.semText, s.semText]}>SEM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: 2,
  },
  pinCircle: {
    borderRadius: 999,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHole: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  pinPointer: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0a0a0a',
    marginTop: -1,
  },
  semText: {
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#0a0a0a',
    letterSpacing: -1,
  },
});

const large = StyleSheet.create({
  pinCircle: { width: 54, height: 54 },
  pinHole: { width: 24, height: 24 },
  pinPointer: { borderLeftWidth: 15, borderRightWidth: 15, borderTopWidth: 26 },
  semText: { fontSize: 88, lineHeight: 96, letterSpacing: -3 },
});

const small = StyleSheet.create({
  pinCircle: { width: 22, height: 22 },
  pinHole: { width: 10, height: 10 },
  pinPointer: { borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10 },
  semText: { fontSize: 36, lineHeight: 40, letterSpacing: -1 },
});
