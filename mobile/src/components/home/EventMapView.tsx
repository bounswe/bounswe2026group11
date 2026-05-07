import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Callout,
  Marker,
  PROVIDER_GOOGLE,
  type MapMarker,
} from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import type { EventSummary } from '@/models/event';
import { formatEventDateLabel } from '@/utils/eventDate';
import {
  getEventCategoryPresentation,
  type EventCategoryPresentation,
} from '@/utils/eventCategoryPresentation';

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
  /** Extra top pixels to add to map padding (e.g. safe-area inset when map is full-screen). */
  headerTopInset?: number;
}

interface MappableEvent {
  event: EventSummary;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  presentation: EventCategoryPresentation; 
  groupSize: number;
}

type EventWithCoordinates = EventSummary & {
  location_lat: number;
  location_lon: number;
};

const DISCOVERY_MAP_PADDING_BASE = {
  top: 120,
  right: 20,
  bottom: 96,
  left: 20,
};

function hasMappableCoordinate(
  event: EventSummary,
): event is EventWithCoordinates {
  return (
    typeof event.location_lat === 'number' &&
    typeof event.location_lon === 'number' &&
    Number.isFinite(event.location_lat) &&
    Number.isFinite(event.location_lon)
  );
}

function getDenseCoordinateKey(event: {
  location_lat: number;
  location_lon: number;
}): string {
  return `${event.location_lat.toFixed(4)}:${event.location_lon.toFixed(4)}`;
}

function getDenseMarkerOffset(
  groupIndex: number,
  groupSize: number,
  region: MapRegion,
): { latitude: number; longitude: number } {
  if (groupSize <= 1) {
    return { latitude: 0, longitude: 0 };
  }

  const markersPerRing = 8;
  const ring = Math.floor(groupIndex / markersPerRing) + 1;
  const ringPosition = groupIndex % markersPerRing;
  const visibleInRing = Math.min(groupSize, markersPerRing);
  const angle = (Math.PI * 2 * ringPosition) / visibleInRing - Math.PI / 2;
  const regionScale = Math.min(region.latitudeDelta, region.longitudeDelta);
  const baseRadius = Math.min(Math.max(regionScale * 0.002, 0.00006), 0.00035);
  const radius = baseRadius * Math.min(ring, 2.5);

  return {
    latitude: Math.sin(angle) * radius,
    longitude: Math.cos(angle) * radius,
  };
}

function buildMappableEvents(
  events: EventSummary[],
  region: MapRegion,
  isDark: boolean,
): MappableEvent[] {
  const eventsWithCoordinates = events.filter(hasMappableCoordinate);
  const denseGroups = new Map<string, EventWithCoordinates[]>();

  eventsWithCoordinates.forEach((event) => {
    const key = getDenseCoordinateKey(event);
    const group = denseGroups.get(key) ?? [];
    group.push(event);
    denseGroups.set(key, group);
  });

  return eventsWithCoordinates.map((event) => {
    const group = denseGroups.get(getDenseCoordinateKey(event)) ?? [event];
    const groupIndex = group.indexOf(event);
    const offset = getDenseMarkerOffset(groupIndex, group.length, region);

    return {
      event,
      coordinate: {
        latitude: event.location_lat + offset.latitude,
        longitude: event.location_lon + offset.longitude,
      },
      presentation: getEventCategoryPresentation(event.category_name, isDark),
      groupSize: group.length,
    };
  });
}

function getImageUrl(event: EventSummary): string | null {
  const imageUrl = event.image_url?.trim();
  return imageUrl && imageUrl.length > 0 ? imageUrl : null;
}

type ImageStatus = 'READY' | 'FAILED';

interface EventMapMarkerProps {
  item: MappableEvent;
  styles: ReturnType<typeof makeStyles>;
  isSelected: boolean;
  imageStatus: ImageStatus | undefined;
  onSelect: (eventId: string) => void;
  onOpen: (eventId: string) => void;
}

function EventMapMarker({
  item,
  styles,
  isSelected,
  imageStatus,
  onSelect,
  onOpen,
}: EventMapMarkerProps) {
  const markerRef = useRef<MapMarker | null>(null);
  // Prevents the deselect that fires during outgoing navigation from clearing selection.
  const suppressNextDeselectRef = useRef(false);
  const [hasImageRenderError, setHasImageRenderError] = useState(false);
  // Tracks whether the image inside the callout has finished loading.
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const { event, coordinate, presentation, groupSize } = item;
  const imageUrl = getImageUrl(event);
  // Hide the callout image if the render raised an error OR the prefetch
  // explicitly failed (resolved to false) — show the category placeholder instead.
  const calloutImageUrl =
    imageUrl && !hasImageRenderError && imageStatus !== 'FAILED' ? imageUrl : null;

  useEffect(() => {
    setHasImageRenderError(false);
    setIsImageLoaded(false);
  }, [imageUrl]);

  // Show callout when this marker is selected.
  // On Android, defer until imageStatus is resolved so the InfoWindow
  // bitmap snapshot captures the already-loaded image.
  // On iOS the callout is a live view, so open immediately.
  useEffect(() => {
    if (!isSelected) return;
    if (Platform.OS === 'android' && imageUrl && imageStatus === undefined) {
      return; // wait — effect will re-run when imageStatus is set
    }
    const t = setTimeout(() => markerRef.current?.showCallout?.(), 40);
    return () => clearTimeout(t);
  }, [isSelected, imageStatus, imageUrl]);

  // On iOS, once the prefetch settles as READY, redraw the callout so the
  // native bubble snapshot reflects the freshly loaded image.
  useEffect(() => {
    if (!isSelected || Platform.OS === 'android') return;
    if (!imageUrl || imageStatus !== 'READY') return;
    markerRef.current?.redrawCallout?.();
  }, [isSelected, imageUrl, imageStatus]);

  // Re-show callout when the screen regains focus while this marker is still
  // selected (e.g. returning from the event detail screen).
  useFocusEffect(
    useCallback(() => {
      suppressNextDeselectRef.current = false;
      if (!isSelected) return;
      if (Platform.OS === 'android' && imageUrl && imageStatus === undefined) {
        return;
      }
      const t = setTimeout(() => markerRef.current?.showCallout?.(), 200);
      return () => clearTimeout(t);
    }, [isSelected, imageStatus, imageUrl]),
  );

  return (
    <Marker
      ref={markerRef}
      key={event.id}
      identifier={event.id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      // Keep tracking until the callout image has loaded so the native bubble
      // gets a chance to reflect the loaded image.
      tracksViewChanges={isSelected && !isImageLoaded}
      zIndex={isSelected ? 1000 : 1}
      onPress={() => onSelect(event.id)}
      onDeselect={() => {
        // The deselect that fires as navigation begins must not clear selection;
        // useFocusEffect resets this flag when the screen comes back into focus.
        if (suppressNextDeselectRef.current) return;
        onSelect('');
      }}
      stopPropagation
      testID={`marker-${event.id}`}
    >
      <View style={styles.markerWrap}>
        <View
          style={[
            styles.markerBubble,
            { backgroundColor: presentation.color },
            isSelected && styles.markerBubbleSelected,
          ]}
          testID={`marker-bubble-${event.id}`}
        >
          <Text style={styles.markerEmoji}>{presentation.emoji}</Text>
          {groupSize > 1 ? (
            <View style={styles.markerCountBadge}>
              <Text style={styles.markerCountText}>{groupSize}</Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.markerTail,
            { borderTopColor: presentation.color },
          ]}
        />
      </View>

      <Callout
        tooltip
        onPress={() => {
          // Mark that the next onDeselect should be suppressed — it fires as
          // the navigation transition starts and must not clear the selection.
          suppressNextDeselectRef.current = true;
          onOpen(event.id);
        }}
        testID={`callout-${event.id}`}
      >
        <View style={styles.callout}>
          <View style={styles.calloutMainRow}>
            {calloutImageUrl ? (
              <Image
                source={{ uri: calloutImageUrl }}
                style={styles.calloutImage}
                resizeMode="cover"
                onLoad={() => {
                  setIsImageLoaded(true);
                  // On iOS the callout is a live view — refresh it so the
                  // loaded image replaces the loading placeholder.
                  // On Android the callout is only opened after the image is
                  // prefetched, so no refresh is needed here.
                  if (Platform.OS !== 'android') {
                    markerRef.current?.redrawCallout?.();
                  }
                }}
                onError={() => setHasImageRenderError(true)}
                testID={`callout-image-${event.id}`}
              />
            ) : (
              <View
                style={[
                  styles.calloutImagePlaceholder,
                  {
                    backgroundColor: presentation.tintColor,
                    borderColor: presentation.color,
                  },
                ]}
                testID={`callout-image-placeholder-${event.id}`}
              >
                <Text style={styles.calloutImageEmoji}>
                  {presentation.emoji}
                </Text>
              </View>
            )}

            <View style={styles.calloutBody}>
              <View
                style={[
                  styles.calloutCategoryPill,
                  {
                    backgroundColor: presentation.tintColor,
                    borderColor: presentation.color,
                  },
                ]}
              >
                <Text style={styles.calloutCategoryEmoji}>
                  {presentation.emoji}
                </Text>
                <Text
                  style={[
                    styles.calloutCategoryText,
                    { color: presentation.color },
                  ]}
                  numberOfLines={1}
                >
                  {presentation.label}
                </Text>
              </View>

              <Text style={styles.calloutTitle} numberOfLines={2}>
                {event.title}
              </Text>
            </View>
          </View>

          <View style={styles.calloutMetaGroup}>
            <Text style={styles.calloutMeta} numberOfLines={1}>
              🗓 {formatEventDateLabel(event.start_time, event.end_time)}
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
          </View>

          <View style={styles.calloutDivider} />
          <Text style={styles.calloutHint}>Tap to view details →</Text>
        </View>
      </Callout>
    </Marker>
  );
}

export default function EventMapView({
  events,
  isLoading,
  apiError,
  region,
  onMarkerPress,
  headerTopInset = 0,
}: EventMapViewProps) {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mapPadding = useMemo(
    () => ({ ...DISCOVERY_MAP_PADDING_BASE, top: DISCOVERY_MAP_PADDING_BASE.top + headerTopInset }),
    [headerTopInset],
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [imageStatusByUrl, setImageStatusByUrl] = useState<
    Record<string, ImageStatus>
  >({});

  const mappableEvents = useMemo(
    () => buildMappableEvents(events, region, isDark),
    [events, region, isDark],
  );

  const selectedEvent = useMemo(
    () =>
      mappableEvents.find((item) => item.event.id === selectedEventId) ?? null,
    [mappableEvents, selectedEventId],
  );

  // Eagerly prefetch event images so the Android InfoWindow bitmap snapshot
  // always captures a fully-loaded image when the callout is first opened.
  useEffect(() => {
    const urls = Array.from(
      new Set(
        mappableEvents
          .map((item) => getImageUrl(item.event))
          .filter((url): url is string => url !== null),
      ),
    );
    urls.forEach((url) => {
      if (imageStatusByUrl[url]) return;
      Image.prefetch(url)
        .then((success) => {
          setImageStatusByUrl((prev) => ({ ...prev, [url]: success ? 'READY' : 'FAILED' }));
        })
        .catch(() => {
          setImageStatusByUrl((prev) => ({ ...prev, [url]: 'FAILED' }));
        });
    });
  }, [imageStatusByUrl, mappableEvents]);

  useEffect(() => {
    if (selectedEventId && !selectedEvent) {
      setSelectedEventId(null);
    }
  }, [selectedEvent, selectedEventId]);

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
        mapPadding={mapPadding}
        onPress={() => setSelectedEventId(null)}
        testID="map-surface"
      >
        {mappableEvents.map((item) => {
          const imgUrl = getImageUrl(item.event);
          return (
            <EventMapMarker
              key={item.event.id}
              item={item}
              styles={styles}
              isSelected={item.event.id === selectedEventId}
              imageStatus={imgUrl ? imageStatusByUrl[imgUrl] : 'READY'}
              onSelect={(eventId) => setSelectedEventId(eventId || null)}
              onOpen={onMarkerPress}
            />
          );
        })}
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
      bottom: 24,
      left: 20,
      right: 20,
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
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
    markerWrap: {
      alignItems: 'center',
    },
    markerBubble: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 3,
      borderColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.24,
      shadowRadius: 8,
      elevation: 6,
    },
    markerBubbleSelected: {
      borderWidth: 4,
      shadowOpacity: 0.34,
      shadowRadius: 12,
      elevation: 8,
      // Transform only the bubble (not the tail), so the pin tip stays
      // exactly over the coordinate while the bubble pops up.
      transform: [{ translateY: -5 }, { scale: 1.1 }],
    },
    markerEmoji: {
      fontSize: 22,
      lineHeight: 26,
    },
    markerTail: {
      width: 0,
      height: 0,
      marginTop: -3,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderTopWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
    },
    markerCountBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 19,
      height: 19,
      borderRadius: 10,
      paddingHorizontal: 4,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerCountText: {
      fontSize: 10,
      fontWeight: '800',
      color: t.text,
    },
    callout: {
      width: 296,
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    calloutMainRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    calloutImage: {
      width: 78,
      height: 78,
      borderRadius: 12,
      backgroundColor: t.imagePlaceholder,
    },
    calloutImagePlaceholder: {
      width: 78,
      height: 78,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calloutImageEmoji: {
      fontSize: 32,
      lineHeight: 38,
    },
    calloutBody: {
      flex: 1,
      minWidth: 0,
    },
    calloutCategoryPill: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginBottom: 7,
    },
    calloutCategoryEmoji: {
      fontSize: 12,
      lineHeight: 14,
    },
    calloutCategoryText: {
      flexShrink: 1,
      fontSize: 11,
      fontWeight: '800',
    },
    calloutTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
      lineHeight: 21,
    },
    calloutMetaGroup: {
      marginTop: 10,
    },
    calloutMeta: {
      fontSize: 13,
      color: t.textSecondary,
      lineHeight: 18,
      marginBottom: 4,
    },
    calloutDivider: {
      height: 1,
      backgroundColor: t.divider,
      marginVertical: 8,
    },
    calloutHint: {
      fontSize: 13,
      fontWeight: '600',
      color: t.primary,
      textAlign: 'right',
    },
  });
}
