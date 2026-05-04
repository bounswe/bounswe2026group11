import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import type { EventSummary } from '@/models/event';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface EventMapViewProps {
  events: EventSummary[];
  isLoading: boolean;
  apiError: string | null;
  region: MapRegion;
  onMarkerPress: (eventId: string) => void;
}

function formatStartTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function EventMapView({
  events,
  isLoading,
  apiError,
  region,
  onMarkerPress,
}: EventMapViewProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const mappableEvents = useMemo(
    () =>
      events.filter(
        (e) => e.location_lat != null && e.location_lon != null,
      ),
    [events],
  );

  if (isLoading) {
    return (
      <View style={styles.centeredState} testID="map-loading">
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (apiError) {
    return (
      <View style={styles.centeredState} testID="map-error">
        <Text style={styles.stateText}>{apiError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="event-map-view">
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={region}
        testID="map-surface"
      >
        {mappableEvents.map((event) => (
          <Marker
            key={event.id}
            identifier={event.id}
            coordinate={{
              latitude: event.location_lat as number,
              longitude: event.location_lon as number,
            }}
            pinColor={theme.primary}
            testID={`marker-${event.id}`}
          >
            <Callout
              tooltip
              onPress={() => onMarkerPress(event.id)}
              testID={`callout-${event.id}`}
            >
              <View style={styles.callout}>
                <Text style={styles.calloutCategory}>
                  {event.category_name}
                </Text>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.calloutMeta}>
                  🗓 {formatStartTime(event.start_time)}
                </Text>
                {event.location_address ? (
                  <Text style={styles.calloutMeta} numberOfLines={1}>
                    📍 {event.location_address}
                  </Text>
                ) : null}
                <Text style={styles.calloutMeta}>
                  👥 {event.approved_participant_count}
                  {event.capacity != null ? ` / ${event.capacity}` : ''} going
                </Text>
                <View style={styles.calloutDivider} />
                <Text style={styles.calloutHint}>Tap to view details →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {!isLoading && mappableEvents.length === 0 && (
        <View style={styles.emptyOverlay} testID="map-empty">
          <Text style={styles.emptyTitle}>No events on the map</Text>
          <Text style={styles.emptySubtitle}>
            Events will appear here once location data is available.
          </Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateText: {
      color: t.errorText,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    emptyOverlay: {
      position: 'absolute',
      bottom: 32,
      left: 20,
      right: 20,
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      color: t.textSecondary,
      textAlign: 'center',
    },
    callout: {
      width: 240,
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    calloutCategory: {
      fontSize: 11,
      fontWeight: '600',
      color: t.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    calloutTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
      marginBottom: 6,
    },
    calloutMeta: {
      fontSize: 12,
      color: t.textSecondary,
      marginBottom: 3,
    },
    calloutDivider: {
      height: 1,
      backgroundColor: t.divider,
      marginVertical: 8,
    },
    calloutHint: {
      fontSize: 12,
      fontWeight: '600',
      color: t.primary,
      textAlign: 'right',
    },
  });
}
