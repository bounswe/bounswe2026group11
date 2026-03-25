import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function LoadingState() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.text}>Loading events...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 15,
  },
});