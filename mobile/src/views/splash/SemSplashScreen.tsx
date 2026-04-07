import React from 'react';
import { View, StyleSheet } from 'react-native';
import SemLogo from '@/components/common/SemLogo';

export default function SemSplashScreen() {
  return (
    <View style={styles.container}>
      <SemLogo size="lg" />
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
});
