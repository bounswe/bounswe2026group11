/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventMapView from './EventMapView';
import type { MapRegion } from './EventMapView';
import type { EventSummary } from '@/models/event';

var mockImagePrefetch: jest.Mock<Promise<boolean>, [string]>;
var mockRedrawCallout: jest.Mock;
var mockShowCallout: jest.Mock;

// ── react-native mock ──────────────────────────────────────────────────────────

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  mockImagePrefetch = jest.fn<Promise<boolean>, [string]>(() =>
    Promise.resolve(true),
  );

  const rnProps = new Set([
    'accessibilityLabel',
    'accessibilityRole',
    'accessibilityState',
    'activeOpacity',
    'numberOfLines',
    'showsVerticalScrollIndicator',
    'testID',
  ]);

  const strip = (props: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (!rnProps.has(key)) out[key] = props[key];
    }
    if (props.testID) out['data-testid'] = props.testID;
    if (props.accessibilityLabel) out['aria-label'] = props.accessibilityLabel;
    if (props.accessibilityRole) out['role'] = props.accessibilityRole;
    return out;
  };

  const mergeStyle = (style: unknown): React.CSSProperties | undefined => {
    if (Array.isArray(style)) {
      return style.reduce(
        (acc: Record<string, unknown>, item: unknown) => ({
          ...acc,
          ...(mergeStyle(item) ?? {}),
        }),
        {},
      ) as React.CSSProperties;
    }
    if (style && typeof style === 'object') return style as React.CSSProperties;
    return undefined;
  };

  const container =
    (tag: string) =>
      ({ children, style, ...props }: { children?: React.ReactNode; style?: unknown }) =>
        ReactLocal.createElement(
          tag,
          { style: mergeStyle(style), ...strip(props as Record<string, unknown>) },
          children,
        );

  const button =
    ({
      children,
      onPress,
      style,
      disabled,
      ...props
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      style?: unknown;
      disabled?: boolean;
    }) =>
      ReactLocal.createElement(
        'button',
        {
          type: 'button',
          disabled,
          style: mergeStyle(style),
          onClick: disabled ? undefined : onPress,
          ...strip(props as Record<string, unknown>),
        },
        children,
      );

  const MockImage = ({
    source,
    style,
    testID,
    onLoad,
    onError,
  }: {
    source?: { uri?: string };
    style?: unknown;
    testID?: string;
    onLoad?: () => void;
    onError?: () => void;
  }) =>
    ReactLocal.createElement('img', {
      'data-testid': testID,
      alt: '',
      src: source?.uri ?? '',
      style: mergeStyle(style),
      onLoad,
      onError,
    });

  MockImage.prefetch = (imageUrl: string) => mockImagePrefetch(imageUrl);

  return {
    ActivityIndicator: ({ testID }: { testID?: string }) =>
      ReactLocal.createElement('div', { 'data-testid': testID ?? 'activity-indicator', role: 'progressbar' }),
    Image: MockImage,
    Platform: { OS: 'ios' },
    StyleSheet: { create: <T,>(s: T) => s },
    Text: container('span'),
    TouchableOpacity: button,
    View: container('div'),
  };
});

// ── react-native-maps mock ─────────────────────────────────────────────────────

jest.mock('react-native-maps', () => {
  const ReactLocal = require('react');
  mockRedrawCallout = jest.fn();
  mockShowCallout = jest.fn();

  const MapView = ({
    children,
    testID,
    mapPadding,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    mapPadding?: unknown;
    onPress?: () => void;
  }) =>
    ReactLocal.createElement(
      'div',
      {
        'data-testid': testID ?? 'map-surface',
        'data-map-padding': mapPadding ? JSON.stringify(mapPadding) : undefined,
        onClick: onPress,
      },
      children,
    );

  const Marker = ReactLocal.forwardRef(
    (
      {
        children,
        testID,
        coordinate,
        onPress,
      }: {
        children?: React.ReactNode;
        testID?: string;
        coordinate?: { latitude: number; longitude: number };
        onPress?: () => void;
      },
      ref: React.Ref<unknown>,
    ) => {
      ReactLocal.useImperativeHandle(ref, () => ({
        redrawCallout: mockRedrawCallout,
        showCallout: mockShowCallout,
      }));

      return ReactLocal.createElement(
        'div',
        {
          'data-testid': testID,
          'data-coordinate': coordinate ? JSON.stringify(coordinate) : undefined,
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation();
            onPress?.();
          },
        },
        children,
      );
    },
  );

  const Callout = ({
    children,
    onPress,
    testID,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    ReactLocal.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          onPress?.();
        },
      },
      children,
    );

  return {
    __esModule: true,
    default: MapView,
    Marker,
    Callout,
    PROVIDER_GOOGLE: 'google',
  };
});

// ── @/theme mock ───────────────────────────────────────────────────────────────

jest.mock('@/theme', () => ({
  useTheme: () => ({
    isDark: false,
    theme: {
      primary: '#111827',
      text: '#111827',
      textSecondary: '#6B7280',
      textTertiary: '#9CA3AF',
      textMuted: '#64748B',
      textOnPrimary: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceVariant: '#F9FAFB',
      surfaceAlt: '#F1F5F9',
      border: '#E5E7EB',
      borderStrong: '#D1D5DB',
      divider: '#E5E7EB',
      errorText: '#DC2626',
      imagePlaceholder: '#E5E7EB',
    },
  }),
}));

// ── helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_REGION: MapRegion = {
  latitude: 41.0422,
  longitude: 29.0083,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

function makeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: 'evt-1',
    title: 'Test Event',
    category_name: 'Sports',
    start_time: '2026-06-01T10:00:00Z',
    privacy_level: 'PUBLIC',
    approved_participant_count: 5,
    is_favorited: false,
    host_score: { final_score: null, hosted_event_rating_count: 0 },
    location_lat: 41.0422,
    location_lon: 29.0083,
    ...overrides,
  };
}

function selectMarker(eventId = 'evt-1'): void {
  fireEvent.click(screen.getByTestId(`marker-${eventId}`));
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('EventMapView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockImagePrefetch.mockResolvedValue(true);
  });

  describe('loading state', () => {
    it('renders a loading indicator and hides the map surface', () => {
      render(
        <EventMapView
          events={[]}
          isLoading
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.getByTestId('map-loading')).toBeTruthy();
      expect(screen.queryByTestId('map-surface')).toBeNull();
    });
  });

  describe('error state', () => {
    it('renders the error message and hides the map surface', () => {
      render(
        <EventMapView
          events={[]}
          isLoading={false}
          apiError="Could not load events."
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.getByTestId('map-error')).toBeTruthy();
      expect(screen.getByText('Could not load events.')).toBeTruthy();
      expect(screen.queryByTestId('map-surface')).toBeNull();
    });
  });

  describe('empty state', () => {
    it('shows the map surface and the empty overlay when no events have coordinates', () => {
      const eventWithoutCoords = makeEvent({
        location_lat: null,
        location_lon: null,
      });

      render(
        <EventMapView
          events={[eventWithoutCoords]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.getByTestId('map-surface')).toBeTruthy();
      expect(screen.getByTestId('map-empty')).toBeTruthy();
      expect(screen.getByText('No events on the map')).toBeTruthy();
    });

    it('shows the empty overlay when the events list is empty', () => {
      render(
        <EventMapView
          events={[]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.getByTestId('map-empty')).toBeTruthy();
    });
  });

  describe('marker rendering', () => {
    it('renders a marker for each event that has valid coordinates', () => {
      const events = [
        makeEvent({ id: 'evt-1', title: 'Event One', location_lat: 41.0, location_lon: 29.0 }),
        makeEvent({ id: 'evt-2', title: 'Event Two', location_lat: 41.1, location_lon: 29.1 }),
        makeEvent({ id: 'evt-3', title: 'Event Three', location_lat: null, location_lon: null }),
      ];

      render(
        <EventMapView
          events={events}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.getByTestId('marker-evt-1')).toBeTruthy();
      expect(screen.getByTestId('marker-evt-2')).toBeTruthy();
      expect(screen.queryByTestId('marker-evt-3')).toBeNull();
    });

    it('does not show the empty overlay when at least one event has coordinates', () => {
      render(
        <EventMapView
          events={[makeEvent()]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.queryByTestId('map-empty')).toBeNull();
    });

    it('displays the event title in the native callout after a marker is selected', () => {
      render(
        <EventMapView
          events={[makeEvent({ title: 'Trail Run' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker();

      expect(screen.getByText('Trail Run')).toBeTruthy();
    });

    it('uses a category-colored emoji marker for events', () => {
      render(
        <EventMapView
          events={[makeEvent({ id: 'evt-sports', category_name: 'Sports' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      const markerBubble = screen.getByTestId('marker-bubble-evt-sports');

      expect(screen.getAllByText('🏃').length).toBeGreaterThan(0);
      expect(markerBubble.getAttribute('style')).toContain(
        'background-color: rgb(37, 99, 235)',
      );
    });

    it('offsets markers that are geographically very close', () => {
      render(
        <EventMapView
          events={[
            makeEvent({ id: 'evt-1', location_lat: 41.0422, location_lon: 29.0083 }),
            makeEvent({ id: 'evt-2', location_lat: 41.04221, location_lon: 29.00831 }),
          ]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      const firstCoordinate = screen
        .getByTestId('marker-evt-1')
        .getAttribute('data-coordinate');
      const secondCoordinate = screen
        .getByTestId('marker-evt-2')
        .getAttribute('data-coordinate');

      expect(firstCoordinate).toBeTruthy();
      expect(secondCoordinate).toBeTruthy();
      expect(firstCoordinate).not.toEqual(secondCoordinate);
    });

    it('shows participant count and capacity when both are present', () => {
      render(
        <EventMapView
          events={[
            makeEvent({
              approved_participant_count: 8,
              capacity: 20,
            }),
          ]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker();

      expect(screen.getByText(/8.*20.*going/s)).toBeTruthy();
    });

    it('shows participant count without capacity when capacity is not set', () => {
      render(
        <EventMapView
          events={[makeEvent({ approved_participant_count: 5, capacity: undefined })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker();

      expect(screen.getByText(/5.*going/s)).toBeTruthy();
      expect(screen.queryByText(/\//)).toBeNull();
    });
  });

  describe('navigation', () => {
    it('calls onMarkerPress with the event id when the callout is pressed', () => {
      const onMarkerPress = jest.fn();
      render(
        <EventMapView
          events={[makeEvent({ id: 'evt-42' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={onMarkerPress}
        />,
      );

      selectMarker('evt-42');
      fireEvent.click(screen.getByTestId('callout-evt-42'));

      expect(onMarkerPress).toHaveBeenCalledWith('evt-42');
    });
  });

  describe('callout content', () => {
    it('shows category name in the native callout', () => {
      render(
        <EventMapView
          events={[makeEvent({ category_name: 'Sports' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker();

      expect(screen.getByText('Sports')).toBeTruthy();
    });

    it('shows location address when present', () => {
      render(
        <EventMapView
          events={[makeEvent({ location_address: 'Belgrad Forest, Istanbul' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker();

      expect(screen.getByText(/Belgrad Forest/)).toBeTruthy();
    });

    it('shows a small event image in the native callout when available', async () => {
      render(
        <EventMapView
          events={[
            makeEvent({
              id: 'evt-image',
              image_url: 'https://example.com/event.jpg',
            }),
          ]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker('evt-image');
      const image = await screen.findByTestId('callout-image-evt-image');

      expect(image).toBeTruthy();
      expect(image.getAttribute('src')).toBe('https://example.com/event.jpg');
      expect(mockImagePrefetch).toHaveBeenCalledWith('https://example.com/event.jpg');
      expect(screen.queryByTestId('callout-image-placeholder-evt-image')).toBeNull();
      await waitFor(() => expect(mockRedrawCallout).toHaveBeenCalled());
    });

    it('falls back to the category placeholder when image prefetch fails', async () => {
      mockImagePrefetch.mockResolvedValue(false);

      render(
        <EventMapView
          events={[
            makeEvent({
              id: 'evt-broken-prefetch',
              image_url: 'https://example.com/missing.jpg',
            }),
          ]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker('evt-broken-prefetch');

      await waitFor(() =>
        expect(
          screen.getByTestId('callout-image-placeholder-evt-broken-prefetch'),
        ).toBeTruthy(),
      );
      expect(screen.queryByTestId('callout-image-evt-broken-prefetch')).toBeNull();
    });

    it('falls back to the category placeholder when the callout image fails', async () => {
      render(
        <EventMapView
          events={[
            makeEvent({
              id: 'evt-broken-image',
              image_url: 'https://example.com/missing.jpg',
            }),
          ]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker('evt-broken-image');
      const image = await screen.findByTestId('callout-image-evt-broken-image');
      fireEvent.error(image);

      expect(screen.getByTestId('callout-image-placeholder-evt-broken-image')).toBeTruthy();
      expect(screen.queryByTestId('callout-image-evt-broken-image')).toBeNull();
    });

    it('uses a category placeholder when the callout has no image', () => {
      render(
        <EventMapView
          events={[makeEvent({ id: 'evt-no-image', image_url: null })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker('evt-no-image');

      expect(screen.getByTestId('callout-image-placeholder-evt-no-image')).toBeTruthy();
      expect(screen.queryByTestId('callout-image-evt-no-image')).toBeNull();
    });

    it('omits location line when address is not set', () => {
      render(
        <EventMapView
          events={[makeEvent({ location_address: null })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      selectMarker();

      expect(screen.queryByText(/📍/)).toBeNull();
    });
  });
});
