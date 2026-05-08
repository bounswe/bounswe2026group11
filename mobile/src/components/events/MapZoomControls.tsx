import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  disabled?: boolean;
}

export default function MapZoomControls({ onZoomIn, onZoomOut, disabled }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.btn}
        onPress={onZoomIn}
        disabled={disabled}
        accessibilityLabel="Zoom in"
        testID="map-zoom-in"
      >
        <Text style={styles.label}>+</Text>
      </TouchableOpacity>
      <View style={styles.separator} />
      <TouchableOpacity
        style={styles.btn}
        onPress={onZoomOut}
        disabled={disabled}
        accessibilityLabel="Zoom out"
        testID="map-zoom-out"
      >
        <Text style={styles.label}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      top: 10,
      right: 10,
      borderRadius: 10,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    btn: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    separator: {
      height: 1,
      backgroundColor: t.border,
    },
    label: {
      fontSize: 22,
      fontWeight: '700',
      color: t.text,
      lineHeight: 24,
    },
  });
}
