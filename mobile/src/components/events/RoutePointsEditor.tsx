import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { DARK_MAP_STYLE } from '@/theme/mapStyle';
import type { LocationSuggestion } from '@/models/event';
import type { RouteWaypoint } from '@/viewmodels/event/useCreateEventViewModel';
import { fetchRoutedGeometry, reverseGeocode } from '@/services/eventService';
import MapZoomControls from './MapZoomControls';
import { useTranslation } from 'react-i18next';

const ROUTED_GEOMETRY_DEBOUNCE_MS = 400;

interface Props {
  routePoints: RouteWaypoint[];
  locationQuery: string;
  isSearching: boolean;
  suggestions: LocationSuggestion[];
  errorText?: string | null;
  disabled?: boolean;
  onSearch: (query: string) => void;
  onAddFromSuggestion: (suggestion: LocationSuggestion) => void;
  onAddFromCoordinate: (lat: number, lon: number, label?: string | null) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onUpdateLabel: (index: number, label: string) => void;
}

const DEFAULT_REGION = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function RoutePointsEditor({
  routePoints,
  locationQuery,
  isSearching,
  suggestions,
  errorText,
  disabled,
  onSearch,
  onAddFromSuggestion,
  onAddFromCoordinate,
  onRemove,
  onMove,
  onUpdateLabel,
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mapRef = useRef<MapView>(null);
  const lastRegionRef = useRef(DEFAULT_REGION);
  const [routedGeometry, setRoutedGeometry] = useState<Array<{ lat: number; lon: number }> | null>(
    null,
  );

  // Debounced fetch of the road-following geometry so the in-create preview
  // matches what the detail page will render after submit. While a fetch is in
  // flight (or if it fails) we fall back to straight segments between waypoints.
  useEffect(() => {
    if (routePoints.length < 2) {
      setRoutedGeometry(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      fetchRoutedGeometry(routePoints.map((p) => ({ lat: p.lat, lon: p.lon })))
        .then((geom) => {
          if (!cancelled) setRoutedGeometry(geom);
        })
        .catch(() => {
          if (!cancelled) setRoutedGeometry(null);
        });
    }, ROUTED_GEOMETRY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [routePoints]);

  const handleZoom = useCallback((factor: number) => {
    const region = lastRegionRef.current;
    const next = {
      ...region,
      latitudeDelta: Math.max(0.0005, region.latitudeDelta * factor),
      longitudeDelta: Math.max(0.0005, region.longitudeDelta * factor),
    };
    lastRegionRef.current = next;
    mapRef.current?.animateToRegion(next, 200);
  }, []);

  const handleMapPress = useCallback(
    async (lat: number, lon: number) => {
      if (disabled) return;
      const insertIndex = routePoints.length;
      onAddFromCoordinate(lat, lon);
      try {
        const result = await reverseGeocode(lat, lon);
        if (result?.display_name) {
          onUpdateLabel(insertIndex, result.display_name);
        }
      } catch {
        // Reverse geocoding is best-effort; the waypoint is still placed.
      }
    },
    [disabled, routePoints.length, onAddFromCoordinate, onUpdateLabel],
  );

  const polylineCoords: LatLng[] = useMemo(() => {
    if (routedGeometry && routedGeometry.length >= 2) {
      return routedGeometry.map((p) => ({ latitude: p.lat, longitude: p.lon }));
    }
    return routePoints.map((p) => ({ latitude: p.lat, longitude: p.lon }));
  }, [routedGeometry, routePoints]);

  const initialRegion = useMemo(() => {
    if (routePoints.length === 0) {
      lastRegionRef.current = DEFAULT_REGION;
      return DEFAULT_REGION;
    }
    const lats = routePoints.map((p) => p.lat);
    const lons = routePoints.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    const latDelta = Math.max(0.01, (maxLat - minLat) * 1.5);
    const lonDelta = Math.max(0.01, (maxLon - minLon) * 1.5);
    const region = {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta,
    };
    lastRegionRef.current = region;
    return region;
  }, [routePoints]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, errorText ? styles.searchInputError : null]}
          placeholder={t('events.create.route.searchPlaceholder')}
          placeholderTextColor={theme.placeholder}
          value={locationQuery}
          onChangeText={onSearch}
          editable={!disabled}
          testID="route-search-input"
        />
        {isSearching && (
          <ActivityIndicator size="small" color={theme.text} style={styles.searchSpinner} />
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer} testID="route-search-suggestions">
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.lat}-${s.lon}-${i}`}
              style={styles.suggestionItem}
              onPress={() => onAddFromSuggestion(s)}
              testID={`route-suggestion-${i}`}
            >
              <Feather name="plus-circle" size={16} color={theme.primary} />
              <Text style={styles.suggestionText} numberOfLines={2}>
                {s.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.hint}>
        {t('events.create.route.hint')}
      </Text>

      <View style={styles.mapContainer}>
        <MapView
          key={`route-editor-map-${isDark ? 'dark' : 'light'}`}
          ref={mapRef}
          style={styles.map}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          customMapStyle={isDark ? DARK_MAP_STYLE : []}
          initialRegion={initialRegion}
          onRegionChangeComplete={(region) => {
            lastRegionRef.current = region;
          }}
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            void handleMapPress(latitude, longitude);
          }}
          testID="route-editor-map"
        >
          {routePoints.length >= 2 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={theme.primary}
              strokeWidth={4}
            />
          )}
          {routePoints.map((p, i) => (
            <Marker
              key={`${p.lat}-${p.lon}-${i}`}
              coordinate={{ latitude: p.lat, longitude: p.lon }}
              title={`${i + 1}. ${p.label ?? `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`}`}
            />
          ))}
        </MapView>
        <MapZoomControls
          onZoomIn={() => handleZoom(0.5)}
          onZoomOut={() => handleZoom(2)}
          disabled={disabled}
        />
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {routePoints.length > 0
            ? t('events.create.route.waypoints_withCount', { count: routePoints.length })
            : t('events.create.route.waypoints')}
        </Text>
      </View>

      {routePoints.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="map-pin" size={20} color={theme.textTertiary} />
          <Text style={styles.emptyStateText}>{t('events.create.route.empty')}</Text>
        </View>
      ) : (
        routePoints.map((p, i) => (
          <View
            key={`waypoint-${i}-${p.lat}-${p.lon}`}
            style={styles.waypointRow}
            testID={`waypoint-row-${i}`}
          >
            <View style={styles.waypointIndex}>
              <Text style={styles.waypointIndexText}>{i + 1}</Text>
            </View>
            <View style={styles.waypointCopy}>
              <Text style={styles.waypointLabel} numberOfLines={2}>
                {p.label ?? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`}
              </Text>
              {p.label && (
                <Text style={styles.waypointCoords}>
                  {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                </Text>
              )}
            </View>
            <View style={styles.waypointActions}>
              <TouchableOpacity
                style={[styles.iconBtn, i === 0 && styles.iconBtnDisabled]}
                onPress={() => onMove(i, -1)}
                disabled={i === 0 || disabled}
                testID={`waypoint-up-${i}`}
                accessibilityLabel={t('events.create.route.moveUp')}
              >
                <Feather
                  name="chevron-up"
                  size={18}
                  color={i === 0 ? theme.textMuted : theme.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.iconBtn,
                  i === routePoints.length - 1 && styles.iconBtnDisabled,
                ]}
                onPress={() => onMove(i, 1)}
                disabled={i === routePoints.length - 1 || disabled}
                testID={`waypoint-down-${i}`}
                accessibilityLabel={t('events.create.route.moveDown')}
              >
                <Feather
                  name="chevron-down"
                  size={18}
                  color={i === routePoints.length - 1 ? theme.textMuted : theme.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => onRemove(i)}
                disabled={disabled}
                testID={`waypoint-remove-${i}`}
                accessibilityLabel={t('events.create.route.remove')}
              >
                <Feather name="trash-2" size={16} color={theme.errorText} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      gap: 8,
    },
    searchRow: {
      position: 'relative',
    },
    searchInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.text,
      backgroundColor: t.surface,
    },
    searchInputError: {
      borderColor: t.errorBorder,
    },
    searchSpinner: {
      position: 'absolute',
      right: 12,
      top: 12,
    },
    suggestionsContainer: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceVariant,
      overflow: 'hidden',
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    suggestionText: {
      flex: 1,
      fontSize: 13,
      color: t.text,
    },
    hint: {
      fontSize: 12,
      color: t.textTertiary,
    },
    mapContainer: {
      height: 200,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
    },
    map: {
      flex: 1,
    },
    listHeader: {
      marginTop: 4,
    },
    listHeaderText: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    emptyState: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderStyle: 'dashed',
      backgroundColor: t.surfaceVariant,
    },
    emptyStateText: {
      flex: 1,
      fontSize: 13,
      color: t.textTertiary,
    },
    waypointRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    waypointIndex: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waypointIndexText: {
      fontSize: 13,
      fontWeight: '700',
      color: t.textOnPrimary,
    },
    waypointCopy: {
      flex: 1,
      gap: 2,
    },
    waypointLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: t.text,
    },
    waypointCoords: {
      fontSize: 11,
      color: t.textMuted,
    },
    waypointActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceVariant,
      borderWidth: 1,
      borderColor: t.border,
    },
    iconBtnDisabled: {
      opacity: 0.45,
    },
    errorText: {
      fontSize: 13,
      color: t.errorText,
    },
  });
}
