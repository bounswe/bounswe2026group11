import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SemSplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.pinContainer}>
          <View style={styles.pinCircle}>
            <View style={styles.pinHole} />
          </View>
          <View style={styles.pinPointer} />
        </View>
        <Text style={styles.semText}>SEM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  pinCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHole: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  pinPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderTopWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#0a0a0a',
    marginTop: -2,
  },
  semText: {
    fontSize: 88,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#0a0a0a',
    letterSpacing: -3,
    lineHeight: 96,
  },
});
