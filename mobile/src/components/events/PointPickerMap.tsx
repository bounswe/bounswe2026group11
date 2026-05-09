import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { DARK_MAP_STYLE } from '@/theme/mapStyle';
import { reverseGeocode } from '@/services/eventService';
import MapZoomControls from './MapZoomControls';

interface Props {
  lat: number | null;
  lon: number | null;
  disabled?: boolean;
  onSelect: (lat: number, lon: number, label?: string | null) => void;
}

const DEFAULT_REGION = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function PointPickerMap({ lat, lon, disabled, onSelect }: Props) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mapRef = useRef<MapView>(null);
  const lastRegionRef = useRef(DEFAULT_REGION);

  const region = useMemo(() => {
    if (lat == null || lon == null) {
      lastRegionRef.current = DEFAULT_REGION;
      return DEFAULT_REGION;
    }
    const next = {
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    lastRegionRef.current = next;
    return next;
  }, [lat, lon]);

  const handleZoom = useCallback((factor: number) => {
    const r = lastRegionRef.current;
    const next = {
      ...r,
      latitudeDelta: Math.max(0.0005, r.latitudeDelta * factor),
      longitudeDelta: Math.max(0.0005, r.longitudeDelta * factor),
    };
    lastRegionRef.current = next;
    mapRef.current?.animateToRegion(next, 200);
  }, []);

  const handlePress = useCallback(
    async (latitude: number, longitude: number) => {
      if (disabled) return;
      onSelect(latitude, longitude);
      try {
        const result = await reverseGeocode(latitude, longitude);
        if (result?.display_name) {
          onSelect(latitude, longitude, result.display_name);
        }
      } catch {
        // Best effort.
      }
    },
    [disabled, onSelect],
  );

  return (
    <View style={styles.container}>
      <MapView
        key={`point-picker-map-${isDark ? 'dark' : 'light'}`}
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        customMapStyle={isDark ? DARK_MAP_STYLE : []}
        initialRegion={region}
        onRegionChangeComplete={(r) => {
          lastRegionRef.current = r;
        }}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          void handlePress(latitude, longitude);
        }}
        testID="point-picker-map"
      >
        {lat != null && lon != null && (
          <Marker coordinate={{ latitude: lat, longitude: lon }} />
        )}
      </MapView>
      <MapZoomControls
        onZoomIn={() => handleZoom(0.5)}
        onZoomOut={() => handleZoom(2)}
        disabled={disabled}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      height: 200,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
    },
    map: {
      flex: 1,
    },
  });
}
