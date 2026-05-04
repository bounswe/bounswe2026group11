/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EventMapView from './EventMapView';
import type { MapRegion } from './EventMapView';
import type { EventSummary } from '@/models/event';

// ── react-native mock ──────────────────────────────────────────────────────────

jest.mock('react-native', () => {
  const ReactLocal = require('react');

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

  return {
    ActivityIndicator: ({ testID }: { testID?: string }) =>
      ReactLocal.createElement('div', { 'data-testid': testID ?? 'activity-indicator', role: 'progressbar' }),
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

  const MapView = ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) =>
    ReactLocal.createElement('div', { 'data-testid': testID ?? 'map-surface' }, children);

  const Marker = ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) =>
    ReactLocal.createElement('div', { 'data-testid': testID }, children);

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
      { 'data-testid': testID, onClick: onPress },
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
    theme: {
      primary: '#111827',
      text: '#111827',
      textSecondary: '#6B7280',
      textOnPrimary: '#FFFFFF',
      surface: '#FFFFFF',
      errorText: '#DC2626',
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

// ── tests ──────────────────────────────────────────────────────────────────────

describe('EventMapView', () => {
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

    it('displays the event title in the callout', () => {
      render(
        <EventMapView
          events={[makeEvent({ title: 'Trail Run' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

      expect(screen.getByText('Trail Run')).toBeTruthy();
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

      const callout = screen.getByTestId('callout-evt-42');
      fireEvent.click(callout);

      expect(onMarkerPress).toHaveBeenCalledWith('evt-42');
    });
  });

  describe('callout content', () => {
    it('shows category name in the callout', () => {
      render(
        <EventMapView
          events={[makeEvent({ category_name: 'Sports' })]}
          isLoading={false}
          apiError={null}
          region={DEFAULT_REGION}
          onMarkerPress={jest.fn()}
        />,
      );

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

      expect(screen.getByText(/Belgrad Forest/)).toBeTruthy();
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

      expect(screen.queryByText(/📍/)).toBeNull();
    });
  });
});
