import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function LoadingState() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.text} />
      <Text style={styles.text}>Loading events...</Text>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      paddingVertical: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      marginTop: 12,
      color: t.textSecondary,
      fontSize: 15,
    },
  });
}
