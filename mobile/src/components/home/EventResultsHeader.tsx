import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EventResultsHeaderProps {
  count: number;
}

export default function EventResultsHeader({
  count,
}: EventResultsHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{count} events</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    marginBottom: 14,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
});