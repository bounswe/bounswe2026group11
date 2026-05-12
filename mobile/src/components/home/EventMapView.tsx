import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, {
  Callout,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapMarker,
} from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { DARK_MAP_STYLE } from '@/theme/mapStyle';
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

export interface MapCoordinate {
  lat: number;
  lon: number;
}

interface EventMapViewProps {
  events: EventSummary[];
  isLoading: boolean;
  apiError: string | null;
  region: MapRegion;
  filterCenter?: MapCoordinate;
  filterRadiusMeters?: number;
  currentLocation?: MapCoordinate | null;
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
}

interface MapCluster {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  events: EventWithCoordinates[];
}

type MapItem =
  | { type: 'EVENT'; item: MappableEvent }
  | { type: 'CLUSTER'; cluster: MapCluster };

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

const CLUSTER_DISTANCE_RATIO = 0.08;
const MIN_CLUSTER_DELTA = 0.0001;
const MIN_CLUSTER_ZOOM_DELTA = 0.006;
const ANDROID_MARKER_TRACKING_SETTLE_MS = 650;
const EARTH_RADIUS_METERS = 6371008.8;
const RADIUS_BOUNDARY_SEGMENTS = 144;
const RADIUS_BOUNDARY_DASH_PATTERN = [1, 10];

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

function getClusterDistanceRatio(
  event: EventWithCoordinates,
  cluster: MapCluster,
  region: MapRegion,
): number {
  const latitudeDelta = Math.max(Math.abs(region.latitudeDelta), MIN_CLUSTER_DELTA);
  const longitudeDelta = Math.max(Math.abs(region.longitudeDelta), MIN_CLUSTER_DELTA);
  const latitudeRatio = (event.location_lat - cluster.coordinate.latitude) / latitudeDelta;
  const longitudeRatio = (event.location_lon - cluster.coordinate.longitude) / longitudeDelta;

  return Math.sqrt(latitudeRatio * latitudeRatio + longitudeRatio * longitudeRatio);
}

function addEventToCluster(cluster: MapCluster, event: EventWithCoordinates): void {
  const nextSize = cluster.events.length + 1;

  cluster.coordinate = {
    latitude:
      (cluster.coordinate.latitude * cluster.events.length + event.location_lat) /
      nextSize,
    longitude:
      (cluster.coordinate.longitude * cluster.events.length + event.location_lon) /
      nextSize,
  };
  cluster.events.push(event);
}

function buildMapItems(
  events: EventSummary[],
  region: MapRegion,
  isDark: boolean,
): MapItem[] {
  const eventsWithCoordinates = events.filter(hasMappableCoordinate);
  const clusters: MapCluster[] = [];

  eventsWithCoordinates.forEach((event) => {
    const cluster = clusters.find(
      (candidate) =>
        getClusterDistanceRatio(event, candidate, region) <=
        CLUSTER_DISTANCE_RATIO,
    );

    if (cluster) {
      addEventToCluster(cluster, event);
      return;
    }

    clusters.push({
      id: event.id,
      coordinate: {
        latitude: event.location_lat,
        longitude: event.location_lon,
      },
      events: [event],
    });
  });

  return clusters.map((cluster) => {
    if (cluster.events.length > 1) {
      const id = cluster.events.map((event) => event.id).sort().join('-');

      return {
        type: 'CLUSTER',
        cluster: {
          ...cluster,
          id,
        },
      };
    }

    const event = cluster.events[0];

    return {
      type: 'EVENT',
      item: {
        event,
        coordinate: {
          latitude: event.location_lat,
          longitude: event.location_lon,
        },
        presentation: getEventCategoryPresentation(event.category_name, isDark),
      },
    };
  });
}

function getImageUrl(event: EventSummary): string | null {
  const imageUrl = event.image_url?.trim();
  return imageUrl && imageUrl.length > 0 ? imageUrl : null;
}

function buildRadiusBoundaryCoordinates(
  center: MapCoordinate,
  radiusMeters: number,
): Array<{ latitude: number; longitude: number }> {
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const centerLatitude = (center.lat * Math.PI) / 180;
  const centerLongitude = (center.lon * Math.PI) / 180;
  const sinCenterLatitude = Math.sin(centerLatitude);
  const cosCenterLatitude = Math.cos(centerLatitude);
  const sinAngularDistance = Math.sin(angularDistance);
  const cosAngularDistance = Math.cos(angularDistance);

  return Array.from({ length: RADIUS_BOUNDARY_SEGMENTS + 1 }, (_value, index) => {
    const bearing = (2 * Math.PI * index) / RADIUS_BOUNDARY_SEGMENTS;
    const latitude = Math.asin(
      sinCenterLatitude * cosAngularDistance +
        cosCenterLatitude * sinAngularDistance * Math.cos(bearing),
    );
    const longitude =
      centerLongitude +
      Math.atan2(
        Math.sin(bearing) * sinAngularDistance * cosCenterLatitude,
        cosAngularDistance - sinCenterLatitude * Math.sin(latitude),
      );

    return {
      latitude: (latitude * 180) / Math.PI,
      longitude: (longitude * 180) / Math.PI,
    };
  });
}

type ImageStatus = 'READY' | 'FAILED';

function useAndroidMarkerTracking(deps: React.DependencyList): boolean {
  const [tracksViewChanges, setTracksViewChanges] = useState(
    Platform.OS === 'android',
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setTracksViewChanges(false);
      return undefined;
    }

    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, ANDROID_MARKER_TRACKING_SETTLE_MS);

    return () => clearTimeout(timer);
  }, deps);

  return Platform.OS === 'android' ? tracksViewChanges : false;
}

interface EventCalloutContentProps {
  item: MappableEvent;
  styles: ReturnType<typeof makeStyles>;
  imageStatus: ImageStatus | undefined;
  onImageLoad?: () => void;
}

function EventCalloutContent({
  item,
  styles,
  imageStatus,
  onImageLoad,
}: EventCalloutContentProps) {
  const [hasImageRenderError, setHasImageRenderError] = useState(false);
  const { t } = useTranslation();
  const { event, presentation } = item;
  const imageUrl = getImageUrl(event);
  const calloutImageUrl =
    imageUrl && !hasImageRenderError && imageStatus !== 'FAILED' ? imageUrl : null;

  useEffect(() => {
    setHasImageRenderError(false);
  }, [event.id, imageUrl]);

  return (
    <View style={styles.callout}>
      <View style={styles.calloutMainRow}>
        {calloutImageUrl ? (
          <Image
            source={{ uri: calloutImageUrl }}
            style={styles.calloutImage}
            resizeMode="cover"
            fadeDuration={0}
            onLoad={onImageLoad}
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
          👥 {event.capacity != null
            ? i18n.t('home.map.participantsWithCapacity', {
                count: event.approved_participant_count,
                capacity: event.capacity,
              })
            : i18n.t('home.map.participants', {
                count: event.approved_participant_count,
              })}
        </Text>
      </View>

      <View style={styles.calloutDivider} />
      <Text style={styles.calloutHint}>
        {t('home.map.calloutHint')}
      </Text>
    </View>
  );
}

interface AndroidEventCalloutProps {
  item: MappableEvent;
  styles: ReturnType<typeof makeStyles>;
  imageStatus: ImageStatus | undefined;
  headerTopInset: number;
  onOpen: (eventId: string) => void;
}

function AndroidEventCallout({
  item,
  styles,
  imageStatus,
  headerTopInset,
  onOpen,
}: AndroidEventCalloutProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.androidCalloutLayer,
        { top: headerTopInset + 238 },
      ]}
      testID={`android-callout-layer-${item.event.id}`}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onOpen(item.event.id)}
        accessibilityLabel={`Open ${item.event.title}`}
        accessibilityRole="button"
        testID={`android-callout-${item.event.id}`}
      >
        <EventCalloutContent
          item={item}
          styles={styles}
          imageStatus={imageStatus}
        />
      </TouchableOpacity>
    </View>
  );
}

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
  const [isCalloutImageLoaded, setIsCalloutImageLoaded] = useState(false);
  const { event, coordinate, presentation } = item;
  const imageUrl = getImageUrl(event);
  const hasCalloutImage = Boolean(imageUrl && imageStatus !== 'FAILED');
  const tracksViewChanges = useAndroidMarkerTracking([
    event.id,
    presentation.color,
    presentation.emoji,
    isSelected,
  ]);

  useEffect(() => {
    setIsCalloutImageLoaded(false);
  }, [imageUrl]);

  const redrawCallout = useCallback(() => {
    markerRef.current?.redrawCallout?.();
  }, []);

  // iOS uses the native callout. Android renders a normal overlay instead
  // because Google Maps InfoWindow snapshots do not reliably decode images.
  useEffect(() => {
    if (Platform.OS === 'android') return;
    if (!isSelected) return;
    const t = setTimeout(() => {
      markerRef.current?.showCallout?.();
      if (hasCalloutImage && isCalloutImageLoaded) {
        redrawCallout();
      }
    }, 40);
    return () => clearTimeout(t);
  }, [
    isSelected,
    imageStatus,
    imageUrl,
    hasCalloutImage,
    isCalloutImageLoaded,
    redrawCallout,
  ]);

  // Once the image view has decoded, redraw the native callout snapshot so it
  // reflects the real image rather than Android's first empty InfoWindow pass.
  useEffect(() => {
    if (Platform.OS === 'android') return;
    if (!isSelected || !hasCalloutImage || !isCalloutImageLoaded) return;
    redrawCallout();
  }, [isSelected, hasCalloutImage, isCalloutImageLoaded, redrawCallout]);

  // Re-show callout when the screen regains focus while this marker is still
  // selected (e.g. returning from the event detail screen).
  useFocusEffect(
    useCallback(() => {
      suppressNextDeselectRef.current = false;
      if (Platform.OS === 'android') return undefined;
      if (!isSelected) return;
      const t = setTimeout(() => {
        markerRef.current?.showCallout?.();
        if (hasCalloutImage && isCalloutImageLoaded) {
          redrawCallout();
        }
      }, 200);
      return () => clearTimeout(t);
    }, [
      isSelected,
      imageStatus,
      imageUrl,
      hasCalloutImage,
      isCalloutImageLoaded,
      redrawCallout,
    ]),
  );

  return (
    <Marker
      ref={markerRef}
      key={event.id}
      identifier={event.id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={isSelected ? 1000 : 1}
      onPress={() => onSelect(event.id)}
      onDeselect={() => {
        if (Platform.OS === 'android') return;
        // The deselect that fires as navigation begins must not clear selection;
        // useFocusEffect resets this flag when the screen comes back into focus.
        if (suppressNextDeselectRef.current) return;
        onSelect('');
      }}
      stopPropagation
      testID={`marker-${event.id}`}
      accessibilityLabel={`${event.title} map marker`}
      accessibilityRole="button"
    >
      <View style={styles.markerWrap} collapsable={false}>
        <View
          style={[
            styles.markerBubble,
            { backgroundColor: presentation.color },
            isSelected && styles.markerBubbleSelected,
          ]}
          testID={`marker-bubble-${event.id}`}
        >
          <Text style={styles.markerEmoji}>{presentation.emoji}</Text>
        </View>
        <View
          style={[
            styles.markerTail,
            { borderTopColor: presentation.color },
          ]}
        />
      </View>

      {Platform.OS === 'android' ? null : (
        <Callout
          tooltip
          accessibilityLabel={`Open ${event.title}`}
          accessibilityRole="button"
          onPress={() => {
            // Mark that the next onDeselect should be suppressed — it fires as
            // the navigation transition starts and must not clear the selection.
            suppressNextDeselectRef.current = true;
            onOpen(event.id);
          }}
          testID={`callout-${event.id}`}
        >
          <EventCalloutContent
            item={item}
            styles={styles}
            imageStatus={imageStatus}
            onImageLoad={() => {
              setIsCalloutImageLoaded(true);
              redrawCallout();
            }}
          />
        </Callout>
      )}
    </Marker>
  );
}

interface ClusterMapMarkerProps {
  cluster: MapCluster;
  styles: ReturnType<typeof makeStyles>;
  onPress: (cluster: MapCluster) => void;
}

function ClusterMapMarker({
  cluster,
  styles,
  onPress,
}: ClusterMapMarkerProps) {
  const tracksViewChanges = useAndroidMarkerTracking([
    cluster.id,
    cluster.events.length,
  ]);

  return (
    <Marker
      key={cluster.id}
      identifier={`cluster-${cluster.id}`}
      coordinate={cluster.coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={500}
      onPress={() => onPress(cluster)}
      stopPropagation
      testID={`cluster-marker-${cluster.id}`}
    >
      <View style={styles.clusterWrap} collapsable={false}>
        <View style={styles.clusterBubble}>
          <Text style={styles.clusterCount}>{cluster.events.length}</Text>
        </View>
      </View>
    </Marker>
  );
}

interface CurrentLocationMarkerProps {
  coordinate: MapCoordinate;
  styles: ReturnType<typeof makeStyles>;
}

function CurrentLocationMarker({
  coordinate,
  styles,
}: CurrentLocationMarkerProps) {
  return (
    <Marker
      identifier="current-location"
      coordinate={{
        latitude: coordinate.lat,
        longitude: coordinate.lon,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      zIndex={1001}
      testID="current-location-marker"
    >
      <View style={styles.currentLocationOuter}>
        <View style={styles.currentLocationDot} />
      </View>
    </Marker>
  );
}

export default function EventMapView({
  events,
  isLoading,
  apiError,
  region,
  filterCenter,
  filterRadiusMeters = 0,
  currentLocation = null,
  onMarkerPress,
  headerTopInset = 0,
}: EventMapViewProps) {
  const { theme, isDark } = useTheme();
  // Subscribe to language so category presentation labels re-render on locale change.
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mapRef = useRef<MapView | null>(null);
  const [visibleRegion, setVisibleRegion] = useState<MapRegion>(region);
  const [androidMarkerRenderKey, setAndroidMarkerRenderKey] = useState(0);
  const mapPadding = useMemo(
    () => ({ ...DISCOVERY_MAP_PADDING_BASE, top: DISCOVERY_MAP_PADDING_BASE.top + headerTopInset }),
    [headerTopInset],
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [imageStatusByUrl, setImageStatusByUrl] = useState<
    Record<string, ImageStatus>
  >({});

  useEffect(() => {
    setVisibleRegion(region);
    mapRef.current?.animateToRegion(region, 250);
  }, [region]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      setAndroidMarkerRenderKey((revision) => revision + 1);
      return undefined;
    }, []),
  );

  const mapItems = useMemo(
    () => buildMapItems(events, visibleRegion, isDark),
    [events, visibleRegion, isDark],
  );
  const eventItems = useMemo(
    () =>
      mapItems.flatMap((item) =>
        item.type === 'EVENT' ? [item.item] : [],
      ),
    [mapItems],
  );
  const hasMappableEvents = useMemo(
    () => events.some(hasMappableCoordinate),
    [events],
  );

  const selectedEvent = useMemo(
    () =>
      eventItems.find((item) => item.event.id === selectedEventId) ?? null,
    [eventItems, selectedEventId],
  );
  const selectedEventImageUrl = selectedEvent
    ? getImageUrl(selectedEvent.event)
    : null;

  // Eagerly prefetch event images so selected callouts can render without
  // waiting on a cold network decode.
  useEffect(() => {
    const urls = Array.from(
      new Set(
        eventItems
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
  }, [eventItems, imageStatusByUrl]);

  useEffect(() => {
    if (selectedEventId && !selectedEvent) {
      setSelectedEventId(null);
    }
  }, [selectedEvent, selectedEventId]);

  const handleClusterPress = useCallback(
    (cluster: MapCluster) => {
      setSelectedEventId(null);

      const nextRegion = {
        latitude: cluster.coordinate.latitude,
        longitude: cluster.coordinate.longitude,
        latitudeDelta: Math.max(
          visibleRegion.latitudeDelta * 0.45,
          MIN_CLUSTER_ZOOM_DELTA,
        ),
        longitudeDelta: Math.max(
          visibleRegion.longitudeDelta * 0.45,
          MIN_CLUSTER_ZOOM_DELTA,
        ),
      };

      setVisibleRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 250);
    },
    [visibleRegion],
  );

  const handleLocateCurrentLocation = useCallback(() => {
    if (!currentLocation) return;

    const nextRegion = {
      latitude: currentLocation.lat,
      longitude: currentLocation.lon,
      latitudeDelta: visibleRegion.latitudeDelta,
      longitudeDelta: visibleRegion.longitudeDelta,
    };

    setVisibleRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 250);
  }, [currentLocation, visibleRegion]);

  const filterCenterCoordinate = useMemo(
    () => ({
      lat: filterCenter?.lat ?? region.latitude,
      lon: filterCenter?.lon ?? region.longitude,
    }),
    [filterCenter?.lat, filterCenter?.lon, region.latitude, region.longitude],
  );
  const radiusBoundaryCoordinates = useMemo(
    () =>
      filterRadiusMeters > 0
        ? buildRadiusBoundaryCoordinates(filterCenterCoordinate, filterRadiusMeters)
        : [],
    [filterCenterCoordinate, filterRadiusMeters],
  );
  const radiusStrokeColor = isDark
    ? 'rgba(96, 165, 250, 0.82)'
    : 'rgba(37, 99, 235, 0.72)';

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
        key={`event-map-${isDark ? 'dark' : 'light'}`}
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        customMapStyle={isDark ? DARK_MAP_STYLE : []}
        initialRegion={region}
        mapPadding={mapPadding}
        onRegionChangeComplete={(nextRegion) => {
          setVisibleRegion({
            latitude: nextRegion.latitude,
            longitude: nextRegion.longitude,
            latitudeDelta: nextRegion.latitudeDelta,
            longitudeDelta: nextRegion.longitudeDelta,
          });
        }}
        onPress={() => setSelectedEventId(null)}
        testID="map-surface"
      >
        {filterRadiusMeters > 0 ? (
          <Polyline
            coordinates={radiusBoundaryCoordinates}
            strokeWidth={3}
            strokeColor={radiusStrokeColor}
            lineDashPattern={RADIUS_BOUNDARY_DASH_PATTERN}
            lineCap="round"
            geodesic
            testID="filter-radius-circle"
          />
        ) : null}

        {mapItems.map((item) => {
          if (item.type === 'CLUSTER') {
            return (
              <ClusterMapMarker
                key={`cluster-${item.cluster.id}`}
                cluster={item.cluster}
                styles={styles}
                onPress={handleClusterPress}
              />
            );
          }

          const imgUrl = getImageUrl(item.item.event);
          const isSelected = item.item.event.id === selectedEventId;
          return (
            <EventMapMarker
              key={[
                item.item.event.id,
                isSelected ? 'selected' : 'idle',
                Platform.OS === 'android' ? androidMarkerRenderKey : 0,
              ].join('-')}
              item={item.item}
              styles={styles}
              isSelected={isSelected}
              imageStatus={imgUrl ? imageStatusByUrl[imgUrl] : 'READY'}
              onSelect={(eventId) => setSelectedEventId(eventId || null)}
              onOpen={onMarkerPress}
            />
          );
        })}

        {currentLocation ? (
          <CurrentLocationMarker
            coordinate={currentLocation}
            styles={styles}
          />
        ) : null}
      </MapView>

      {Platform.OS === 'android' && selectedEvent ? (
        <AndroidEventCallout
          item={selectedEvent}
          styles={styles}
          imageStatus={
            selectedEventImageUrl
              ? imageStatusByUrl[selectedEventImageUrl]
              : 'READY'
          }
          headerTopInset={headerTopInset}
          onOpen={onMarkerPress}
        />
      ) : null}

      {currentLocation ? (
        <TouchableOpacity
          style={styles.locateButton}
          onPress={handleLocateCurrentLocation}
          accessibilityRole="button"
          accessibilityLabel="Go to current location"
          activeOpacity={0.85}
          testID="current-location-button"
        >
          <Feather name="navigation" size={20} color={theme.primary} />
        </TouchableOpacity>
      ) : null}

      {!isLoading && !hasMappableEvents && (
        <View
          style={[
            styles.emptyOverlay,
            currentLocation && styles.emptyOverlayWithLocateButton,
          ]}
          testID="map-empty"
        >
          <Text style={styles.emptyTitle}>{t('home.map.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('home.map.emptySubtitle')}
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
    emptyOverlayWithLocateButton: {
      bottom: 90,
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
    locateButton: {
      position: 'absolute',
      right: 18,
      bottom: 28,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    androidCalloutLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 20,
      elevation: 20,
    },
    markerWrap: {
      width: 76,
      height: 76,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'visible',
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
      ...(Platform.OS === 'android'
        ? {
            width: 48,
            height: 48,
            borderRadius: 24,
          }
        : {
            // Transform only the bubble (not the tail), so the pin tip stays
            // exactly over the coordinate while the bubble pops up.
            transform: [{ translateY: -5 }, { scale: 1.1 }],
          }),
    },
    markerEmoji: {
      fontSize: 22,
      lineHeight: 26,
      includeFontPadding: false,
      textAlign: 'center',
      textAlignVertical: 'center',
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
    clusterWrap: {
      width: 82,
      height: 82,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    clusterBubble: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: t.primary,
      borderWidth: 3,
      borderColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.24,
      shadowRadius: 8,
      elevation: 7,
    },
    clusterCount: {
      fontSize: 22,
      lineHeight: 26,
      fontWeight: '800',
      color: t.textOnPrimary,
      includeFontPadding: false,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    currentLocationOuter: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(37, 99, 235, 0.18)',
      borderWidth: 2,
      borderColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 5,
    },
    currentLocationDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#2563EB',
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
